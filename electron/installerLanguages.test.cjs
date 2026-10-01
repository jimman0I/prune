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

// The stock "who should this be installed for" page (electron-builder's
// own MultiUser install-mode page) ships translations for only about 20
// of Prune's 40 installer languages; these 19 are the ones build/
// installer.nsh patches by hand -- see the comment above its own copy of
// this list. Reported directly: the page right after the language choice
// stayed in English for a language the installer otherwise offers fully.
const INSTALL_MODE_LANGS = [
  'AFRIKAANS', 'ARABIC', 'CATALAN', 'WELSH', 'GREEK', 'ESTONIAN', 'HEBREW',
  'INDONESIAN', 'ICELANDIC', 'LITHUANIAN', 'MALAY', 'PASHTO', 'PORTUGUESE',
  'ROMANIAN', 'ALBANIAN', 'SERBIAN', 'THAI', 'UKRAINIAN', 'VIETNAMESE'
];
const INSTALL_MODE_STRINGS = [
  'whoShouldThisApplicationBeInstalledFor', 'chooseInstallationOptions',
  'chooseUninstallationOptions', 'selectUserMode', 'whichInstallationRemove',
  'whichInstallationShouldBeRemoved', 'forAll', 'onlyForMe', 'perMachineInstall',
  'perMachineInstallExists', 'perUserInstall', 'perUserInstallExists',
  'reinstallUpgrade', 'uninstall', 'loginWithAdminAccount', 'freshInstallForAll',
  'freshInstallForCurrent'
];

// electron-builder's own app-builder-lib/templates/nsis/assistedMessages.yml
// ships real translations for these 20 (uppercased NSIS display names,
// same special-casing nsisLang.js's own createAddLangsMacro uses: zh_CN
// -> SimpChinese, zh_TW -> TradChinese, nb_NO -> Norwegian, pt_BR ->
// PortugueseBR, es -> SpanishInternational). Read directly from that file
// by the test below, not copied here, so this list cannot drift from it.
function assistedMessagesCoverage() {
  const file = require.resolve('app-builder-lib/templates/nsis/assistedMessages.yml');
  const yaml = readFileSync(file, 'utf8');
  const { load } = require('js-yaml');
  const data = load(yaml);
  const codes = new Set();
  for (const translations of Object.values(data)) {
    for (const code of Object.keys(translations)) if (code !== 'en') codes.add(code);
  }
  const SPECIAL = { zh_CN: 'SIMPCHINESE', zh_TW: 'TRADCHINESE', nb_NO: 'NORWEGIAN', no: 'NORWEGIAN', pt_BR: 'PORTUGUESEBR', es: 'SPANISHINTERNATIONAL' };
  const { langIdToName } = require('app-builder-lib/out/util/langs');
  const names = new Set();
  for (const code of codes) {
    if (SPECIAL[code]) { names.add(SPECIAL[code]); continue; }
    const lang = code.includes('_') ? code.slice(0, code.indexOf('_')) : code;
    const name = langIdToName[lang];
    if (name) names.add(name.toUpperCase());
  }
  return names;
}
const EB_COVERED = assistedMessagesCoverage();

test('every language the install-mode page patch covers has every one of its strings', () => {
  const missing = [];
  for (const lang of INSTALL_MODE_LANGS) {
    for (const id of INSTALL_MODE_STRINGS) {
      const found = langStrings.find((s) => s.id === id && s.lang === lang);
      if (!found || !found.text.trim()) missing.push(`${lang}: ${id}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('every one of Prune\'s 40 installer languages gets the install-mode page patched or already has it from electron-builder', () => {
  // electron-builder's own assistedMessages.yml (not read here -- it's
  // inside node_modules, not this repo) covers a fixed set of languages
  // on its own; this file's job is only the languages it does NOT cover.
  // The one thing worth guarding here is that this set never silently
  // drifts out of sync with Prune's real installerLanguages list -- a
  // language added to one without the other either patches a language
  // the installer no longer offers (harmless but stale) or leaves a
  // newly-added language unpatched (the exact bug this file exists to
  // catch). electron-builder's own coverage is assumed stable; if it
  // ever ships a translation for one of these 19, this patch simply
  // becomes redundant (NSIS takes the LAST declaration), not wrong.
  const offered = new Set(nsisLanguageNames().map((name) => name.toUpperCase()));
  const patched = new Set(INSTALL_MODE_LANGS);
  const offeredButUnaccountedFor = [...offered].filter((name) => name !== 'ENGLISH' && !patched.has(name) && !EB_COVERED.has(name));
  assert.deepEqual(offeredButUnaccountedFor, [], 'a language the installer offers is neither patched here nor known to be covered by electron-builder');
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

test('writes the language it was run in', () => {
  const customInstall = script.match(/!macro customInstall([\s\S]*?)!macroend/)[1];
  assert.match(customInstall, /"language":"\$\(appLangCode\)"/);
});

test('writes the language even on an upgrade, where the Updates page skips itself', () => {
  // Regression: this used to be written only inside the SAME
  // `${If} $updatesChoice != ""}` branch as updateCheck, so it inherited
  // updateCheck's fresh-install-only gate too -- $updatesChoice is only
  // ever set by updatesPageLeave, which only runs if updatesPageCreate
  // didn't Abort, which it does whenever settings.json already exists
  // (i.e. every upgrade). Reported directly: picking Greek in the
  // installer on an upgrade left the app in English. The language must
  // reach installer-choices.json on every non-silent install regardless
  // of whether $updatesChoice ever got set -- i.e. there must be a
  // FileWrite of language alone, outside any $updatesChoice check.
  const customInstall = script.match(/!macro customInstall([\s\S]*?)!macroend/)[1];
  assert.match(
    customInstall,
    /FileWrite \$0 '\{"language":"\$\(appLangCode\)"\}'/,
    'no unconditional (no-updateCheck) language-only FileWrite found'
  );
});

test('never writes updateCheck when the Updates page was skipped', () => {
  // The other half of the same fix: decoupling language from
  // $updatesChoice must not accidentally start writing updateCheck
  // unconditionally too -- an unticked box on a page nobody saw must
  // still never turn off a setting silently.
  const customInstall = script.match(/!macro customInstall([\s\S]*?)!macroend/)[1];
  const updateCheckWrites = [...customInstall.matchAll(/FileWrite \$0 '([^']*)'/g)]
    .map((m) => m[1])
    .filter((line) => line.includes('updateCheck'));
  assert.ok(updateCheckWrites.length > 0, 'no FileWrite mentions updateCheck at all');
  for (const line of updateCheckWrites) {
    // Every line that writes updateCheck must be inside the
    // $updatesChoice != "" branch -- checked structurally: find that
    // line's own FileWrite statement and confirm an
    // `${If} $updatesChoice != ""}` appears before it, before the
    // matching ${EndIf}, within customInstall.
    const idx = customInstall.indexOf(`FileWrite $0 '${line}'`);
    const before = customInstall.slice(0, idx);
    assert.match(before, /\$\{If\}\s+\$updatesChoice\s+!=\s+""[\s\S]*$/, `updateCheck write not gated: ${line}`);
  }
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
