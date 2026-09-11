const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const config = require('./electron-builder.config.cjs');
const { LangConfigurator, createAddLangsMacro } = require('app-builder-lib/out/targets/nsis/nsisLang');

/* The installer's languages and its "Check for updates" page.
 *
 * makensis is the final check -- a language it has no file for stops the
 * build -- but it only runs in a full build, and it is quiet about the
 * failure that matters most here: a language with no words for the
 * update page. NSIS falls back to another language's string with a
 * warning nobody reads, and someone who picked Greek gets a checkbox in
 * English. These tests catch that without building anything.
 *
 * The language names come from electron-builder's own mapping, called the
 * way it calls it, rather than from a copy of it that could drift. */

const PAGE_STRINGS = ['updatesTitle', 'updatesSubtitle', 'updatesCheckbox', 'appLangCode'];

function nsisLanguageNames() {
  let lines = [];
  createAddLangsMacro({ macro: (_name, body) => { lines = body; } }, new LangConfigurator(config.nsis));
  return lines.map((line) => line.match(/MUI_LANGUAGE "(.+)"/)[1]);
}

const script = readFileSync(path.join(__dirname, config.nsis.include), 'utf8');
const langStrings = [...script.matchAll(/^\s*LangString\s+(\w+)\s+\$\{LANG_(\w+)\}\s+"([^"]*)"/gm)]
  .map(([, id, lang, text]) => ({ id, lang, text }));

test('the installer offers many languages, English among them', () => {
  const names = nsisLanguageNames();
  assert.ok(names.length >= 40, `only ${names.length}`);
  assert.ok(names.includes('English'));
  assert.ok(names.includes('Greek'));
});

test('every installer language has a Windows language id', () => {
  // electron-builder writes each language's own strings under its Windows
  // LCID, looked up by locale. A code that is not a real locale -- el_EL
  // rather than el_GR, which is what electron-builder's own
  // toLangWithRegion guesses -- looks up nothing, NSIS is handed
  // "undefined", and the build stops on warning 7025. Only in a full
  // build, and only while it builds the uninstaller, which is how it got
  // past the other tests here.
  const { lcid, toLangWithRegion } = require('app-builder-lib/out/util/langs');
  const missing = config.nsis.installerLanguages
    .filter((code) => lcid[toLangWithRegion(code.replace('-', '_'))] === undefined);
  assert.deepEqual(missing, []);
});

test('leaves out every language the pinned NSIS cannot load', () => {
  // electron-builder 26 builds with NSIS 3.0.4.1, whose own Hindi.nsh has
  // an unterminated string on line 128, among the "Choose Users" page's
  // strings. Any build that loads Hindi stops there -- a bug in NSIS's
  // file, not in anything of Prune's. Found by compiling a test installer
  // once per language rather than one four-minute build at a time; Hindi
  // was the only one of 41 that failed.
  const broken = { hi: "NSIS 3.0.4.1's Hindi.nsh:128 has an unterminated string" };
  const offered = config.nsis.installerLanguages.filter((code) => broken[code.slice(0, 2)]);
  assert.deepEqual(offered, []);
});

test('every installer language has every string the update page shows', () => {
  const missing = [];
  for (const name of nsisLanguageNames()) {
    for (const id of PAGE_STRINGS) {
      const found = langStrings.find((s) => s.id === id && s.lang === name.toUpperCase());
      if (!found || !found.text.trim()) missing.push(`${name}: ${id}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('has no strings for a language the installer does not load', () => {
  // A LangString for a language that was never added is a build error.
  const loaded = new Set(nsisLanguageNames().map((name) => name.toUpperCase()));
  const strays = [...new Set(langStrings.map((s) => s.lang))].filter((lang) => !loaded.has(lang));
  assert.deepEqual(strays, []);
});

test('writes the choice where the app reads it, under the name it reads', () => {
  const backend = readFileSync(path.join(__dirname, '..', 'backend', 'src', 'services', 'installerChoices.js'), 'utf8');
  const name = backend.match(/INSTALLER_CHOICES_FILE = '([^']+)'/)[1];
  // %APPDATA%\Prune is Electron's userData for productName "Prune", the
  // folder settings.json lives in -- see main.cjs's settingsPath().
  assert.ok(script.includes(`$APPDATA\\Prune\\${name}`), `installer.nsh does not write $APPDATA\\Prune\\${name}`);
});

test('writes nothing during a silent install, so an update keeps the choice', () => {
  // The updater installs with /S. No page is shown, so no file may be
  // written; if one were, every update would reset the choice.
  const customInstall = script.match(/!macro customInstall([\s\S]*?)!macroend/);
  assert.ok(customInstall, 'no customInstall macro');
  assert.match(customInstall[1], /\$\{IfNot\}\s+\$\{Silent\}[\s\S]*installer-choices\.json[\s\S]*\$\{EndIf\}/);
});

test('writes the language it was run in, alongside the update check', () => {
  const customInstall = script.match(/!macro customInstall([\s\S]*?)!macroend/)[1];
  assert.match(customInstall, /"language":"\$\(appLangCode\)"/);
});

test('every appLangCode is one of the app\'s own 40 languages', async () => {
  // The value written to installer-choices.json, checked against the
  // exact list backend/src/services/installerChoices.js validates it
  // against -- not a copy of that list kept here to drift from it.
  // On Windows a bare "C:\..." path is not a URL the ESM loader accepts.
  const languagesPath = path.join(__dirname, '..', 'backend', 'src', 'services', 'languages.js');
  const { LANGUAGES } = await import(pathToFileURL(languagesPath).href);
  const codes = new Set(LANGUAGES.map((l) => l.code));
  const codeStrings = langStrings.filter((s) => s.id === 'appLangCode');
  assert.ok(codeStrings.length > 0, 'no appLangCode LangStrings found');
  const unknown = codeStrings.filter((s) => !codes.has(s.text)).map((s) => `${s.lang}: "${s.text}"`);
  assert.deepEqual(unknown, []);
});

test('names the installer without spaces, which the updater needs', () => {
  assert.ok(!/\s/.test(config.nsis.artifactName), config.nsis.artifactName);
});

test('points the updater at this repository\'s releases', () => {
  const [github] = config.publish;
  assert.deepEqual(
    { provider: github.provider, owner: github.owner, repo: github.repo },
    { provider: 'github', owner: 'jimman0I', repo: 'prune' }
  );
});

test('packs every file main.cjs loads', () => {
  const main = readFileSync(path.join(__dirname, 'main.cjs'), 'utf8');
  const local = [...main.matchAll(/require\('\.\/([^']+)'\)/g)].map((m) => m[1]);
  const preload = main.match(/path\.join\(__dirname, '([^']+)'\)/g)?.map((m) => m.match(/'([^']+)'\)$/)[1]) ?? [];
  for (const file of ['main.cjs', ...local, ...preload.filter((f) => f.endsWith('.cjs'))]) {
    assert.ok(config.files.includes(file), `${file} is not in files[]`);
  }
});
