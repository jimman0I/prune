import { readFile, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { settingsPath, updateSettings } from './settings.js';

/** The installer's answer to "Check for updates", handed over to the app.
 *
 * The installer asks the question on a page of its own (see
 * electron/build/installer.nsh), but it cannot write settings.json: NSIS
 * has no JSON, and a reinstall would have to merge into a file it cannot
 * parse. So it leaves this one-line file beside settings.json, and the
 * app applies it on its next start and deletes it.
 *
 * Two rules, both tested. The file answers the one question the installer
 * asked and nothing else -- it sits in a folder the user can write to, so
 * it does not get to rewrite settings. And it is acted on once: an
 * unreadable file is deleted rather than retried on every start. A silent
 * install (the one an update runs) shows no page and writes no file, so an
 * update never changes the choice.
 *
 * Deleted only AFTER the save succeeds, so a save that fails leaves the
 * choice to be applied next time rather than losing it. */
export const INSTALLER_CHOICES_FILE = 'installer-choices.json';

export async function applyInstallerChoices({ dir = dirname(settingsPath()), save = updateSettings } = {}) {
  const file = join(dir, INSTALLER_CHOICES_FILE);

  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    return null; // the common case: no installer has run since last time
  }

  let choice = null;
  try {
    const parsed = JSON.parse(text.replace(/^﻿/, ''));
    if (typeof parsed?.updateCheck === 'boolean') choice = { updateCheck: parsed.updateCheck };
  } catch {
    // Unreadable. Forgotten below, not retried on every start.
  }

  if (choice) await save(choice);
  await unlink(file).catch(() => {});
  return choice;
}
