# Startup, memory and idle CPU

`prune-measure` (in `native/tools/measure`) takes the same three numbers
from any Prune build, so 3.x and 4.0 are compared by one method.

```
prune-measure --exe <path> [--runs 5] [--settle 30] [--cpu-window 10]
              [--env KEY=VALUE]... [--kill-existing [--restore]] [--out file.json]
```

## Method

Per run, after one discarded warm-up run:

1. Launch the exe and start a clock.
2. `first_window_ms`: the time until the first visible top-level window
   owned by the process tree (`EnumWindows` + `IsWindowVisible`, polled
   every 5 ms; the tree is walked from parent process ids each poll, so
   Electron's renderer, GPU and utility processes count).
3. Wait `--settle` seconds after that window (default 30).
4. `working_set_mb` / `private_mb`: `GetProcessMemoryInfo` summed over the
   whole tree. Working set counts shared pages once per process, so it
   over-states a multi-process app; `private_mb` is the honest companion.
5. `cpu_pct`: kernel + user time (`GetProcessTimes`) summed over the tree
   across a 10 s window, as a share of the whole machine (Task Manager's
   convention: 100 is every logical core busy). `cpu_ms` is the same in
   milliseconds, `cpu_since_launch_ms` the CPU used since launch (it shows
   the counter reads, and what starting up costs).
6. Kill the whole tree and wait until nothing of it is left.

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

The tool will not launch into a running instance (it would hand off and
exit). It refuses unless `--kill-existing` is given, which closes instances
of that exact image path only, and `--restore` starts one again at the end.

## Measuring 3.x

`run-baseline.cmd` registers a one-shot Interactive / Limited scheduled
task for the current user (so it runs in the real desktop session, not in a
sandboxed shell with a virtualized view of the system), runs
`prune-measure --exe %LOCALAPPDATA%\Programs\Prune\Prune.exe --runs 5
--settle 30 --kill-existing --restore --out native\perf\baseline-3.2.0.json`,
waits, prints the progress log, and unregisters the task. Build the tool
first (`cargo build --release -p prune-measure` in `native`).

It closes the running Prune and launches then kills it 6 times (about 45 s
each, about 5 minutes), then starts Prune again. Not yet run: it needs the
owner's go-ahead.

## Phase 1 numbers

Measured on the development machine (16 logical processors), release
build, `UNREVO_SETTINGS_PATH` pointing at a scratch profile.

| | 3.2.0 (Electron) | 4.0 (native) |
|---|---|---|
| first window | not yet measured | 224.6 ms |
| first frame | n/a | 363.6 ms |
| working set | not yet measured | 41.9 MB (private 13.1 MB) |
| idle CPU | not yet measured | 0.000 % (about 344 ms CPU spent starting up) |
| processes | not yet measured | 1 |

4.0 runs: `phase1-4.0.json`. 3.x runs (when measured): `baseline-3.2.0.json`.
