import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Answering an uninstaller's own wizard, for the programs Prune has no
 * silent switch for.
 *
 * Bulk Crap Uninstaller has this (its UninstallerAutomatizer, Apache-2.0):
 * attach to the uninstaller's windows with UI Automation, press the button
 * whose name is on a list of "go" words, never one on the "cancel" list,
 * pick "reboot later", and give up when the same popup comes back. That is
 * the shape kept here. What Prune adds is a stricter idea of when NOT to
 * answer: an uninstaller's wizard is usually Next, Uninstall, Finish -- but
 * when it asks something only the person can know ("keep your settings?",
 * "tell us why", a field to type in, a button that is neither go nor stop)
 * the wizard is handed back, brought to the front, and the person is told
 * why. A wrong "Yes" to "remove your saved data too?" cannot be undone.
 *
 * Two halves, so every decision is plain JavaScript under test:
 *
 *   OBSERVER  a PowerShell UI Automation loop that only looks and acts.
 *             Each turn it prints one JSON snapshot of the windows owned
 *             by the uninstaller's process tree, then reads one action.
 *   DECIDER   decide() below -- pure, given a snapshot and what it has
 *             already done, returns the action.
 *
 * Only windows of the spawned process and its descendants are ever
 * touched. A launcher's uninstall (steam://uninstall) hands off to the
 * already-running launcher, outside that tree, so it is never answered --
 * which is right: that dialog belongs to the launcher, not to us.
 *
 * Windows' integrity levels decide one limit. An uninstaller that elevates
 * runs above an unelevated Prune, and UI Automation cannot press its
 * buttons (UIPI). The observer detects that and the decider hands the
 * wizard back with that reason, rather than pressing into nothing. */

/* ------------------------------------------------------------ the words */

/** Pressed, in this order of preference when several are on screen. Exact
 * labels after normalising -- "Next >" and "&Next" are "next". */
const GO = [
  'finish', 'uninstall', 'uninstall now', 'remove', 'remove now', 'delete', 'yes',
  'yes, uninstall', 'yes, remove', 'next', 'continue', 'ok', 'close', 'done'
];
/** Never pressed. Their presence alone is not a reason to stop -- every
 * wizard page has a Cancel. */
const STOP = [
  'cancel', 'back', 'no', 'abort', 'decline', 'repair', 'modify', 'change',
  'restart now', 'reboot now', 'restart', 'reboot', 'keep', 'retry', 'ignore'
];
/** Neither: they change nothing about the uninstall, so they neither block
 * an answer nor count as one. NSIS's last page is "Show details" beside
 * "Close". */
const NEUTRAL = ['show details', 'details', 'hide details', 'browse', 'help', 'about', 'more info', 'more information', 'view log'];

/** Standard Win32 dialog control IDs, the same in every language. Only
 * trusted in a classic dialog (#32770), where they are the real IDs:
 * IDOK 1 (NSIS's "Next"/"Uninstall" button too), IDYES 6; IDCANCEL 2,
 * IDABORT 3, IDRETRY 4, IDIGNORE 5, IDNO 7. */
const GO_IDS = ['1', '6'];
const STOP_IDS = ['2', '3', '4', '5', '7'];

/** Text that means the question is about the person's own things. Any of
 * it on the window, and Prune does not answer. */
const PERSONAL = /\b(settings|browsing data|preferences|user data|personal|saved|profiles?|configuration|keep (your|my|the)|your (files|data|documents|projects|library)|bookmarks|history|licen[cs]e key|serial|feedback|survey|tell us|reason|why are you)\b/i;
const RESTART = /\b(restart|reboot)\b/i;
const RESTART_LATER = /\b(later|manually|don'?t|do not|no\b|not now)/i;
/** Ticked boxes worth unticking: they open things or start things. */
const SIDE_EFFECT = /\b(visit|open|website|web site|launch|run |start |show (the )?readme|view (the )?readme|send)\b/i;
const REMOVE_OPTION = /\b(remove|uninstall)\b/i;

export function normalizeLabel(name) {
  return String(name || '')
    .replace(/&(?!&)/g, '')
    .replace(/[<>…]+/g, ' ')
    .replace(/\.{3}/g, ' ')
    .replace(/[:]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** A control's label for showing: accelerator marks and arrows removed,
 * the window's own capitalisation kept. */
export function displayLabel(name) {
  return String(name || '').replace(/&(?!&)/g, '').replace(/[<>]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function classifyButton(button, dialogClass) {
  const label = normalizeLabel(button.name);
  if (STOP.includes(label)) return 'stop';
  if (GO.includes(label)) return 'go';
  if (NEUTRAL.includes(label)) return 'neutral';
  if (dialogClass === '#32770') {
    if (GO_IDS.includes(String(button.automationId))) return 'go';
    if (STOP_IDS.includes(String(button.automationId))) return 'stop';
  }
  return 'unknown';
}

/* ---------------------------------------------------------- the decider */

export const HANDOVER = {
  personal: 'personal',
  typing: 'typing',
  unknownButton: 'unknownButton',
  unknownChoice: 'unknownChoice',
  loop: 'loop',
  elevated: 'elevated',
  tooMany: 'tooMany'
};

const MAX_PRESSES = 30;
const MAX_REPEATS = 3;

export function initialState() {
  return { presses: 0, seen: {} };
}

const footprint = (w) => [w.title, ...(w.texts || []), ...(w.buttons || []).map((b) => `${b.name}:${b.enabled}`)].join('|');

/** The window to work on: an enabled one with something to press. A
 * wizard behind a popup is disabled while the popup is up, so the popup
 * wins without needing to know which is which. */
function pickWindow(windows) {
  const usable = (windows || []).filter((w) => w.enabled !== false);
  return usable.find((w) => (w.buttons || []).some((b) => b.enabled)) || null;
}

/** One step. Returns { action, state } where action is one of
 *   { act: 'wait' }
 *   { act: 'invoke' | 'select' | 'toggle', id, label, window }
 *   { act: 'handover', reason, window, hwnd }
 * and state is the next state. Never mutates its input. */
export function decide(snapshot, state = initialState()) {
  const window = pickWindow(snapshot?.windows);
  if (!window) return { action: { act: 'wait' }, state };
  const hand = (reason) => ({ action: { act: 'handover', reason, window: window.title || '', hwnd: window.hwnd }, state });

  if (window.cannotControl) return hand(HANDOVER.elevated);

  const buttons = (window.buttons || []).filter((b) => b.enabled);
  const kinds = buttons.map((b) => ({ button: b, kind: classifyButton(b, window.className) })).filter((k) => k.kind !== 'neutral');
  const go = kinds.filter((k) => k.kind === 'go');
  // Only Cancel left to press: a progress page, whatever its text says
  // ("Removing data files..." is not a question). Waited out first.
  const onlyCancel = kinds.every((k) => normalizeLabel(k.button.name) === 'cancel' || String(k.button.automationId) === '2');
  if (!go.length && onlyCancel) return { action: { act: 'wait' }, state };

  const words = [window.title, ...(window.texts || []), ...(window.checkboxes || []).map((c) => c.name), ...(window.radios || []).map((r) => r.name)].join(' \n ');
  if (PERSONAL.test(words)) return hand(HANDOVER.personal);
  if ((window.edits || 0) > 0) return hand(HANDOVER.typing);

  // Boxes first: a ticked "restart now" or "open the website" is unticked
  // before the button that would act on it is pressed.
  for (const box of window.checkboxes || []) {
    if (box.checked && box.enabled !== false && (RESTART.test(box.name) || SIDE_EFFECT.test(box.name))) {
      return { action: { act: 'toggle', id: box.id, label: box.name, window: window.title || '' }, state };
    }
  }

  const radios = (window.radios || []).filter((r) => r.enabled !== false);
  if (radios.length) {
    const restartGroup = radios.some((r) => RESTART.test(r.name));
    if (restartGroup) {
      const later = radios.find((r) => RESTART_LATER.test(r.name));
      if (!later) return hand(HANDOVER.unknownChoice);
      if (!later.checked) return { action: { act: 'select', id: later.id, label: later.name, window: window.title || '' }, state };
    } else {
      const remove = radios.find((r) => REMOVE_OPTION.test(r.name));
      if (!remove) return hand(HANDOVER.unknownChoice);
      if (!remove.checked) return { action: { act: 'select', id: remove.id, label: remove.name, window: window.title || '' }, state };
    }
  }

  if (!go.length) {
    // Anything else unanswered -- Retry/Ignore, a No on its own, a button
    // with a name Prune does not know -- is the person's.
    return hand(kinds.some((k) => k.kind === 'unknown') ? HANDOVER.unknownButton : HANDOVER.unknownChoice);
  }
  if (kinds.some((k) => k.kind === 'unknown')) return hand(HANDOVER.unknownButton);

  const rank = (b) => {
    const at = GO.indexOf(normalizeLabel(b.name));
    return at >= 0 ? at : GO.indexOf(b.automationId === '6' ? 'yes' : 'next');
  };
  const choice = go.map((k) => k.button).sort((a, b) => rank(a) - rank(b))[0];

  const print = footprint(window);
  const count = (state.seen[print] || 0) + 1;
  if (count > MAX_REPEATS) return hand(HANDOVER.loop);
  if (state.presses >= MAX_PRESSES) return hand(HANDOVER.tooMany);

  return {
    // The label as the window shows it ("Next", not "next" or "&Next >"):
    // it is what the person reads in Prune while it presses.
    action: { act: 'invoke', id: choice.id, label: displayLabel(choice.name), window: window.title || '' },
    state: { presses: state.presses + 1, seen: { ...state.seen, [print]: count } }
  };
}

/* --------------------------------------------------------- the observer */

/** Prints one JSON line per turn and reads one JSON line back. Exits when
 * the process tree is gone, when stdin closes, or on {"act":"quit"}.
 *
 * Plain Win32 rather than UI Automation. The managed UI Automation client in
 * Windows PowerShell saw every button of a real MessageBox -- the dialog NSIS
 * and Inno uninstallers use for "Are you sure?" -- as an anonymous Pane, and
 * registering its client-side proxies threw. Every classic wizard (NSIS,
 * Inno, InstallShield, MFC, WinForms) is built from real child windows, so
 * the window class, the button style bits and the dialog control ID say
 * exactly what each control is, in any language.
 *
 * Presses are POSTED (BM_CLICK through PostMessage), never sent: a Next
 * that opens a confirmation box would otherwise block this loop inside
 * SendMessage until the box closed -- the box it is supposed to answer. */
export const OBSERVER_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -ReferencedAssemblies Accessibility @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public class PruneWiz {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr parent, EnumProc f, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindowEnabled(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr SendMessageTimeout(IntPtr h, uint msg, IntPtr w, StringBuilder l, uint flags, uint timeout, out IntPtr result);
  [DllImport("user32.dll")] public static extern IntPtr SendMessageTimeout(IntPtr h, uint msg, IntPtr w, IntPtr l, uint flags, uint timeout, out IntPtr result);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int index);
  [DllImport("user32.dll")] public static extern int GetDlgCtrlID(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr h, uint cmd);
  [DllImport("user32.dll")] public static extern bool AllowSetForegroundWindow(int pid);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);

  public static List<IntPtr> TopWindows(HashSet<uint> pids) {
    var list = new List<IntPtr>();
    EnumWindows((h, l) => {
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (pids.Contains(pid) && IsWindowVisible(h)) list.Add(h);
      return true;
    }, IntPtr.Zero);
    return list;
  }
  public static List<IntPtr> Children(IntPtr parent) {
    var list = new List<IntPtr>();
    EnumChildWindows(parent, (h, l) => { list.Add(h); return true; }, IntPtr.Zero);
    return list;
  }
  public static string ClassOf(IntPtr h) { var s = new StringBuilder(256); GetClassName(h, s, 256); return s.ToString(); }
  public static string TextOf(IntPtr h) {
    IntPtr len;
    if (SendMessageTimeout(h, 0x000E, IntPtr.Zero, IntPtr.Zero, 2, 500, out len) == IntPtr.Zero) return "";
    int n = Math.Min((int)len, 4000);
    var s = new StringBuilder(n + 1);
    IntPtr ignored;
    SendMessageTimeout(h, 0x000D, (IntPtr)(n + 1), s, 2, 500, out ignored);
    return s.ToString();
  }
  [DllImport("oleacc.dll")] static extern int AccessibleObjectFromWindow(IntPtr h, uint id, ref Guid iid, [MarshalAs(UnmanagedType.Interface)] out object acc);
  /* MSAA role and checked state: 43 push button, 44 check box, 45 radio
     button; 0 when the control will not say. WinForms draws its radios and
     check boxes as owner-drawn buttons, so the style bits alone call them
     push buttons. */
  public static int[] RoleOf(IntPtr h) {
    try {
      Guid iid = new Guid("618736E0-3C3D-11CF-810C-00AA00389B71");
      object o;
      if (AccessibleObjectFromWindow(h, 0xFFFFFFFC, ref iid, out o) != 0 || o == null) return new int[] { 0, 0 };
      var acc = (Accessibility.IAccessible)o;
      object role = acc.get_accRole(0);
      object state = acc.get_accState(0);
      return new int[] { role is int ? (int)role : 0, state is int ? (int)state : 0 };
    } catch { return new int[] { 0, 0 }; }
  }
  [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  [DllImport("advapi32.dll")] static extern bool OpenProcessToken(IntPtr process, uint access, out IntPtr token);
  [DllImport("advapi32.dll")] static extern bool GetTokenInformation(IntPtr token, int cls, out int info, int len, out int ret);
  /* Whether a process runs elevated (TokenElevation), the same question
     Process Explorer's Elevated column answers. A process whose token cannot
     even be read (SYSTEM, protected) counts as elevated: it is above us. */
  public static bool IsElevated(uint pid) {
    IntPtr proc = OpenProcess(0x1000, false, pid);
    if (proc == IntPtr.Zero) return true;
    try {
      IntPtr token;
      if (!OpenProcessToken(proc, 0x0008, out token)) return true;
      try { int elevated, ret; return !GetTokenInformation(token, 20, out elevated, 4, out ret) || elevated != 0; }
      finally { CloseHandle(token); }
    } finally { CloseHandle(proc); }
  }
  public static int CheckOf(IntPtr h) {
    IntPtr r;
    if (SendMessageTimeout(h, 0x00F0, IntPtr.Zero, IntPtr.Zero, 2, 500, out r) == IntPtr.Zero) return 0;
    return (int)r;
  }
}
"@
$rootPid = [int]$env:PRUNE_WIZARD_PID
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$selfElevated = (New-Object Security.Principal.WindowsPrincipal($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

function Get-Tree {
  $all = Get-CimInstance Win32_Process -Property ProcessId, ParentProcessId -ErrorAction SilentlyContinue
  $set = New-Object 'System.Collections.Generic.HashSet[uint32]'
  [void]$set.Add([uint32]$rootPid)
  $grew = $true
  while ($grew) {
    $grew = $false
    foreach ($p in $all) { if ($set.Contains([uint32]$p.ParentProcessId) -and $set.Add([uint32]$p.ProcessId)) { $grew = $true } }
  }
  $alive = New-Object 'System.Collections.Generic.HashSet[uint32]'
  foreach ($p in $all) { if ($set.Contains([uint32]$p.ProcessId)) { [void]$alive.Add([uint32]$p.ProcessId) } }
  return ,$alive
}

function Test-CannotControl([uint32]$procId) {
  if ($selfElevated) { return $false }
  return [PruneWiz]::IsElevated($procId)
}

function Get-Snapshot($pids) {
  $windows = @()
  foreach ($top in [PruneWiz]::TopWindows($pids)) {
    [uint32]$owner = 0
    [void][PruneWiz]::GetWindowThreadProcessId($top, [ref]$owner)
    $w = [ordered]@{ hwnd = [int64]$top; title = [PruneWiz]::TextOf($top); className = [PruneWiz]::ClassOf($top); enabled = [PruneWiz]::IsWindowEnabled($top); cannotControl = (Test-CannotControl $owner); texts = @(); buttons = @(); radios = @(); checkboxes = @(); edits = 0 }
    foreach ($h in [PruneWiz]::Children($top)) {
      if (-not [PruneWiz]::IsWindowVisible($h)) { continue }
      $cls = [PruneWiz]::ClassOf($h)
      $text = [PruneWiz]::TextOf($h)
      $enabled = [PruneWiz]::IsWindowEnabled($h)
      $style = [PruneWiz]::GetWindowLong($h, -16)
      if ($cls -match 'button') {
        $kind = $style -band 0x0F
        $role = [PruneWiz]::RoleOf($h)
        if ($role[0] -eq 44) { $kind = 3 } elseif ($role[0] -eq 45) { $kind = 9 } elseif ($role[0] -eq 43) { $kind = 0 }
        $entry = [ordered]@{ id = [string][int64]$h; name = $text; automationId = [string][PruneWiz]::GetDlgCtrlID($h); enabled = $enabled }
        if ($kind -eq 7) { continue }
        elseif (@(2, 3, 5, 6) -contains $kind) { $entry.checked = (([PruneWiz]::CheckOf($h) -eq 1) -or ($role[1] -band 0x10) -ne 0); $w.checkboxes += $entry }
        elseif (@(4, 9) -contains $kind) { $entry.checked = (([PruneWiz]::CheckOf($h) -eq 1) -or ($role[1] -band 0x10) -ne 0); $w.radios += $entry }
        else { $w.buttons += $entry }
      } elseif ($cls -match 'edit') {
        if (-not ($style -band 0x800) -and $enabled) { $w.edits++ }
      } elseif ($text) {
        $w.texts += $text
      }
    }
    $windows += $w
  }
  return ,$windows
}

while ($true) {
  $pids = Get-Tree
  if ($pids.Count -eq 0) { [Console]::Out.WriteLine('{"done":true}'); [Console]::Out.Flush(); break }
  $snap = @{ windows = (Get-Snapshot $pids) }
  [Console]::Out.WriteLine((ConvertTo-Json -Compress -Depth 6 -InputObject $snap))
  [Console]::Out.Flush()
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $cmd = $line | ConvertFrom-Json
  $result = 'ok'
  try {
    switch ($cmd.act) {
      'quit' { exit 0 }
      { @('invoke', 'select', 'toggle') -contains $_ } {
        if (-not [PruneWiz]::PostMessage([IntPtr]([int64]$cmd.id), 0x00F5, [IntPtr]::Zero, [IntPtr]::Zero)) { $result = 'error: the message was not delivered' }
      }
      'front' {
        $h = [IntPtr]([int64]$cmd.hwnd)
        [void][PruneWiz]::AllowSetForegroundWindow(-1)
        [void][PruneWiz]::ShowWindow($h, 9)
        [void][PruneWiz]::SetForegroundWindow($h)
      }
    }
  } catch { $result = 'error: ' + $_.Exception.Message }
  if ($cmd.act -ne 'wait') { [Console]::Out.WriteLine((ConvertTo-Json -Compress -InputObject @{ acted = $cmd.act; result = $result })); [Console]::Out.Flush() }
  Start-Sleep -Milliseconds 700
}
`;

/** Answers the wizard of the uninstaller running as `pid`. `onEvent` gets
 * { state: 'answered', act, label, window } after each press and
 * { state: 'handover', reason, window } once, when the person has to take
 * over. Returns { stop }. Best-effort: if the observer cannot start, the
 * uninstaller simply runs as it would have without it. */
export function startWizardAutomation(pid, onEvent, { spawnImpl = spawn } = {}) {
  let state = initialState();
  let finished = false;
  let buffer = '';
  // A file, not -Command -: stdin is the conversation with the observer, so
  // it cannot also carry the script.
  const workDir = mkdtempSync(join(tmpdir(), 'prune-wizard-'));
  const scriptPath = join(workDir, 'observer.ps1');
  // With a BOM: Windows PowerShell 5.1 reads a BOM-less file in the legacy
  // codepage.
  writeFileSync(scriptPath, `﻿${OBSERVER_SCRIPT}`, 'utf8');
  const cleanup = () => { try { rmSync(workDir, { recursive: true, force: true }); } catch { /* best-effort */ } };
  const child = spawnImpl('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
    windowsHide: true,
    env: { ...process.env, PRUNE_WIZARD_PID: String(pid) }
  });
  const send = (action) => { try { child.stdin.write(`${JSON.stringify(action)}\n`); } catch { /* gone */ } };
  const finish = () => {
    if (finished) return;
    finished = true;
    try { child.stdin.end(); } catch { /* gone */ }
  };
  let pending = null;
  child.on('exit', () => { finished = true; cleanup(); });

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    let at;
    while ((at = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, at).trim();
      buffer = buffer.slice(at + 1);
      if (!line.startsWith('{')) continue;
      let message;
      try { message = JSON.parse(line); } catch { continue; }
      if (message.done) { finish(); continue; }
      if (message.acted) {
        if (pending && message.result === 'ok' && ['invoke', 'select', 'toggle'].includes(message.acted)) onEvent?.({ state: 'answered', act: pending.act, label: pending.label, window: pending.window });
        if (pending && message.result !== 'ok') {
          // A press that Windows refused: hand it over rather than retry.
          onEvent?.({ state: 'handover', reason: HANDOVER.elevated, window: pending.window });
          send({ act: 'front', hwnd: pending.hwnd ?? 0 });
          send({ act: 'quit' });
          finish();
        }
        pending = null;
        continue;
      }
      if (finished) { send({ act: 'quit' }); continue; }
      const step = decide(message, state);
      state = step.state;
      const action = step.action;
      if (action.act === 'handover') {
        onEvent?.({ state: 'handover', reason: action.reason, window: action.window });
        send({ act: 'front', hwnd: action.hwnd });
        send({ act: 'quit' });
        finish();
        continue;
      }
      if (action.act !== 'wait') {
        const hwnd = (message.windows || []).find((w) => w.title === action.window)?.hwnd;
        pending = { ...action, hwnd };
      }
      send(action);
    }
  });
  child.on('error', () => { finished = true; cleanup(); });
  child.stdin.on('error', () => { /* the observer exited first */ });
  return {
    stop() {
      if (!finished) send({ act: 'quit' });
      finish();
      try { child.kill(); } catch { /* gone */ }
    },
    child
  };
}
