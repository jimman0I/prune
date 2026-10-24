# Privacy

Prune is a local program. It has no account, no telemetry, no crash reporting
and no analytics, and it does not upload your files, your program list or
anything else about your PC. This page says what it keeps on your machine,
where, and how you get it back or get rid of it.

## What leaves your PC

Nothing, with one opt-in exception.

- The Prune window talks only to its own backend on `127.0.0.1`, inside your PC.
- **Settings → Check for updates** is off by default. The installer's
  Updates page offers the same choice as an unticked box. Turned on, Prune asks
  `api.github.com` once a day whether a newer release exists. The request
  carries a User-Agent and nothing else. Only clicking the update button
  downloads the installer, from the GitHub release.

## What Prune keeps on your PC

Everything lives in one folder, `%APPDATA%\Prune`, and nothing in it is sent
anywhere. An upgrade leaves it alone, and so does uninstalling Prune.

| What | Where | Why it exists |
|---|---|---|
| Quarantined files and folders | `quarantine\` | Leftovers and cleaned files are moved here first, so removal can be undone. Each batch has a `manifest.json` recording where every item came from. |
| Registry exports | `registry-backups\` | A full export of a program's registry keys, made before an uninstall removes anything. |
| Scheduled-task backups | `task-backups\` | The definition of a scheduled task Prune removed, so it can be put back. |
| Settings | `settings.json` | Your choices: language, theme, cleaner rules you switched off, exclusions, the update-check switch. |
| Scan records | `disk-scans\`, `folder-sizes.json`, `install-traces\`, `scheduled-clean-report.json`, `stats.json` | Saved Disk Map scans, measured folder sizes (re-measured after a day), what the install monitor recorded, the last few scheduled-clean runs, and the running total of space freed. |

These hold file and folder paths and program names from your own PC. They are
read only by Prune on that PC.

## Getting data back, and deleting it

- **Restore.** Quarantine lists every batch. Restoring puts files back where
  they came from and re-imports the exported registry keys. Registry exports and
  scheduled-task backups are listed and restorable in the Backup Manager.
- **Delete permanently.** Deleting a Quarantine batch, emptying Quarantine, or
  deleting a backup removes it for good. That is the only point at which
  quarantined data is gone.
- **Automatic deletion.** Quarantine is kept until you restore or delete it.
  Settings has an optional retention window and an optional size cap; both are
  off by default, and when one is on, Prune deletes the oldest batches itself.
- **Everything at once.** Close Prune and delete `%APPDATA%\Prune`. That removes
  the quarantine, backups, settings and scan records, and cannot be undone.

## Questions

Open an issue at <https://github.com/jimman0I/prune/issues>. To report a
security problem privately, see [SECURITY.md](SECURITY.md).
