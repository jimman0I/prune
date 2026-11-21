# Startup, memory and idle CPU

`prune-measure` (in `native/tools/measure`) takes the same three numbers
from any Prune build, so 3.x and 4.0 are compared by one method.

```
prune-measure --exe <path> [--runs 5] [--settle 30] [--cpu-window 10]
              [--env KEY=VALUE]... [--kill-existing [--restore]] [--out file.json]
```

## Method

Per run, after one discarded warm-up run:

1. Launch the exe inside a new job object and start a clock. It is
   started suspended, put in the job and then resumed, so it and everything
   it starts (Electron's renderer, GPU and utility processes) are in the
   job from their first instruction; the time it is held suspended (a
   thread snapshot to find its thread, about 85 ms) is not counted. The
   job is the process tree: membership is kept by the kernel, so a reused
   process id can never pull in, or get killed as, an unrelated process,
   as a tree built from parent process ids could.
2. `first_window_ms`: the time until the first top-level window of the job
   a person can see: visible, not cloaked, and not a tool window
   (`EnumWindows`, polled every 5 ms). winit's message window is a
   visible, transparent 16x16 tool window that exists from the first
   moments of startup; before this rule it was the window timed, which is
   why earlier 4.0 numbers had the first window well before the first
   frame.
3. Wait `--settle` seconds after that window (default 30).
4. `working_set_mb` / `private_mb`: `GetProcessMemoryInfo` summed over the
   job's processes. Working set counts shared pages once per process, so it
   over-states a multi-process app; `private_mb` is the honest companion.
5. `cpu_pct`: kernel + user time of the job (its accounting counts
   processes that exited too) across a 10 s window, as a share of the whole machine (Task Manager's
   convention: 100 is every logical core busy). `cpu_ms` is the same in
   milliseconds, `cpu_since_launch_ms` the CPU used since launch (it shows
   the counter reads, and what starting up costs).
6. Kill the job and wait until nothing of it is left. The job is also set
   to kill its processes when the tool lets go of it, so a crashed or
   stopped tool never leaves the app running.

The median of the runs is written as `median`. For 4.0 the tool also sets
`PRUNE_TRACE_STARTUP=1` and reads `first-frame-ms=` from stderr; that is
`first_frame_ms` (the first rendered frame after the window is shown, from
process start). 3.x has no such line, so it has no `first_frame_ms`.

A run that did not measure the process asked for is reported under
`invalid_runs` and never averaged in: the exe's manifest needs
administrator rights (`elevation_required`), the launched process exited and
another instance of the same exe appeared outside its tree, which is what
an "always run as administrator" relaunch looks like
(`relaunched_elevated`), or it exited on its own (`exited_early`). The
tool stops at the first elevation problem and exits 1.

`--restore` runs on every way out once the running instance was closed
(a failed result write, a failed close, a panic), through a drop guard.

The tool will not launch into a running instance (it would hand off and
exit). It refuses unless `--kill-existing` is given, which closes processes
whose image is that exact path and nothing else (3.x's helper processes
are the same exe; the path is read from the handle that terminates), and `--restore` starts one again at the end.

## Measuring 3.x

`run-baseline.cmd` registers a one-shot Interactive / Limited scheduled
task for the current user (so it runs in the real desktop session, not in a
sandboxed shell with a virtualized view of the system), runs
`prune-measure --exe %LOCALAPPDATA%\Programs\Prune\Prune.exe --runs 5
--settle 30 --kill-existing --restore --out native\perf\baseline-3.2.0.json`,
waits until the task has really started and then ended (a task that is
still queued is not treated as finished; if the script is stopped the task
is stopped too), prints the progress log, and unregisters the task. The
result is written to a temporary file and moved over `baseline-3.2.0.json`
only when the run was clean; otherwise it is kept as
`baseline-3.2.0.partial.json` and any earlier baseline is left alone. Build the tool
first (`cargo build --release -p prune-measure` in `native`).

It closes the running Prune and launches then kills it 6 times (about 45 s
each, about 5 minutes), then starts Prune again. Not yet run: it needs the
owner's go-ahead.

## Phase 1 numbers

Measured on the development machine (16 logical processors), release
build, `UNREVO_SETTINGS_PATH` pointing at a scratch profile, with the
job-object method above and the system font scan moved off the UI thread
(the earlier numbers, 224.6 ms first window and 363.6 ms first frame,
timed winit's invisible message window and had the scan on the UI thread).

| | 3.2.0 (Electron) | 4.0 (native) |
|---|---|---|
| first window | not yet measured | 324.9 ms |
| first frame | n/a | 334.4 ms |
| working set | not yet measured | 42.0 MB (private 13.1 MB) |
| idle CPU | not yet measured | 0.000 % (about 359 ms CPU spent starting up) |
| processes | not yet measured | 1 |

### Against the 4.0 targets

- **First frame: misses the 300 ms target.** 334.4 ms median (range 301 to
  426 ms), about 34 ms over. The window a person can see appears about
  10 ms before its first frame. Moving the font scan to a thread took
  about 70 ms off (A/B, 5 runs each, twice: 449 and 439 ms before, 370
  and 377 ms after, on a busier machine than this run). The largest cost
  left is inside iced's `run` before the app's boot is called (about
  190 ms: winit's event loop and the executor); `PRUNE_TRACE_STARTUP=1`
  prints `font-scan-start`, `font-scan-done`, `daemon`, `boot`,
  `window-created`, `window-shown` and `first-frame-ms`.
- **Idle memory: meets the 60 MB target** on the working-set basis (the
  spec says working set, and it is the larger, stricter number): 42.0 MB.
  Private bytes are 13.1 MB, so it passes on either basis.
- **Idle CPU: meets 0 %** (0.000 % over 10 s; the timer ticks about every
  15 ms, so read it with `cpu_ms`).

4.0 runs: `phase1-4.0.json`. 3.x runs (when measured): `baseline-3.2.0.json`.
