//! `prune-measure`: the same startup / memory / idle-CPU measurement for
//! Prune 3.x (Electron) and 4.x (native), so the two numbers compare.
//!
//! Usage: `prune-measure --exe <path> [--runs 5] [--settle 30] [--out file.json]
//! [--cpu-window 10] [--env KEY=VALUE]... [--kill-existing [--restore]]`
//!
//! Method, per run: launch, poll every 5 ms for the first visible
//! top-level window owned by the process tree, wait `--settle` seconds after
//! it, read the working set of the whole tree, measure CPU over
//! `--cpu-window` seconds, kill the whole tree. One warm-up run first,
//! discarded. A run that did not measure the process that was asked for (it
//! needed elevation, relaunched itself elevated, exited) is reported in
//! `invalid_runs`, never averaged in.

mod report;
#[cfg(windows)]
mod win;

use std::process::ExitCode;

#[derive(Debug, PartialEq)]
pub struct Args {
    pub exe: String,
    pub runs: u32,
    pub settle: u64,
    pub cpu_window: u64,
    pub out: Option<String>,
    pub env: Vec<(String, String)>,
    pub kill_existing: bool,
    pub restore: bool,
}

pub fn parse_args<I: IntoIterator<Item = String>>(it: I) -> Result<Args, String> {
    let mut a = Args {
        exe: String::new(),
        runs: 5,
        settle: 30,
        cpu_window: 10,
        out: None,
        env: Vec::new(),
        kill_existing: false,
        restore: false,
    };
    let mut it = it.into_iter();
    while let Some(flag) = it.next() {
        let mut val = |name: &str| it.next().ok_or_else(|| format!("{name} needs a value"));
        match flag.as_str() {
            "--exe" => a.exe = val("--exe")?,
            "--runs" => a.runs = val("--runs")?.parse().map_err(|_| "--runs must be a number")?,
            "--settle" => a.settle = val("--settle")?.parse().map_err(|_| "--settle must be seconds")?,
            "--cpu-window" => {
                a.cpu_window = val("--cpu-window")?.parse().map_err(|_| "--cpu-window must be seconds")?
            }
            "--out" => a.out = Some(val("--out")?),
            "--env" => {
                let kv = val("--env")?;
                let (k, v) = kv.split_once('=').ok_or("--env must be KEY=VALUE")?;
                a.env.push((k.to_string(), v.to_string()));
            }
            "--kill-existing" => a.kill_existing = true,
            "--restore" => a.restore = true,
            other => return Err(format!("unknown argument {other}")),
        }
    }
    if a.exe.is_empty() {
        return Err("--exe <path> is required".into());
    }
    if a.runs == 0 {
        return Err("--runs must be at least 1".into());
    }
    Ok(a)
}

/// The number in a `first-frame-ms=12.3` line.
pub fn parse_first_frame(line: &str) -> Option<f64> {
    line.split("first-frame-ms=").nth(1)?.split_whitespace().next()?.parse().ok()
}

#[cfg(not(windows))]
fn main() -> ExitCode {
    eprintln!("prune-measure measures Windows processes");
    ExitCode::from(2)
}

#[cfg(windows)]
fn main() -> ExitCode {
    let args = match parse_args(std::env::args().skip(1)) {
        Ok(a) => a,
        Err(e) => {
            eprintln!("prune-measure: {e}");
            return ExitCode::from(2);
        }
    };
    measure::run(&args)
}

#[cfg(windows)]
mod measure {
    use std::collections::HashSet;
    use std::io::{BufRead, BufReader};
    use std::os::windows::process::CommandExt;
    use std::process::{Child, Command, ExitCode, Stdio};
    use std::sync::{Arc, Mutex};
    use std::thread::sleep;
    use std::time::{Duration, Instant};

    use super::{Args, parse_first_frame};
    use crate::report::{Invalid, Meta, Run, build_report};
    use crate::win;

    const POLL: Duration = Duration::from_millis(5);
    const FIRST_WINDOW_TIMEOUT: Duration = Duration::from_secs(60);
    const ERROR_ELEVATION_REQUIRED: i32 = 740;
    const DETACHED_PROCESS: u32 = 0x0000_0008;

    /// Starts the owner's app again when dropped, on every exit path after
    /// it was closed (early return, write failure, panic).
    struct Restore<'a> {
        exe: &'a str,
        armed: bool,
    }

    impl Drop for Restore<'_> {
        fn drop(&mut self) {
            if self.armed {
                // Through the shell so it is not a child of this process (and
                // so not of a scheduled task's job, which would keep the task
                // "running" for as long as the app lives).
                let _ = Command::new("explorer.exe").arg(self.exe).creation_flags(DETACHED_PROCESS).spawn();
            }
        }
    }

    struct Ctx<'a> {
        args: &'a Args,
        exe: String,
        exe_lower: String,
        cpus: usize,
    }

    fn bad(run: u32, kind: &str, reason: String) -> Invalid {
        Invalid { run, kind: kind.into(), reason }
    }

    /// Kill everything in the job and wait until nothing of it is left.
    fn kill_tree(job: &win::Job) {
        for _ in 0..8 {
            job.terminate();
            if job.active() == 0 {
                return;
            }
            sleep(Duration::from_millis(150));
        }
    }

    /// A process running this exe that is not in our tree. By image path
    /// when it can be read, else by file name: an elevated process cannot be
    /// opened from a limited one, so its path is invisible. Any instance of
    /// the exe that existed before the run was closed or refused at start.
    fn foreign_instance(ctx: &Ctx, tree: &HashSet<u32>) -> Option<u32> {
        let by_path = win::pids_with_image(&ctx.exe_lower);
        let name = std::path::Path::new(&ctx.exe_lower).file_name()?.to_string_lossy().into_owned();
        let by_name = win::pids_named(&name);
        by_path.into_iter().chain(by_name).find(|p| !tree.contains(p))
    }

    /// The root exited. Was it a relaunch into a process we cannot see
    /// (elevated), or did it just exit?
    fn diagnose_exit(ctx: &Ctx, run: u32, job: &win::Job, status: String, phase: &str) -> Invalid {
        // An elevated relaunch can take a moment to appear.
        for _ in 0..30 {
            let tree = job.pids();
            if let Some(p) = foreign_instance(ctx, &tree) {
                return bad(
                    run,
                    "relaunched_elevated",
                    format!(
                        "the launched process exited ({status}) {phase} and another instance of the same exe (pid {p}) appeared outside its tree: it relaunched itself, most likely elevated (an 'always run as administrator' setting). That instance was not measured and was left running"
                    ),
                );
            }
            // An elevated process cannot be opened from here, so it may not
            // show in the image-path list at all; its window will still be
            // visible, and nothing of our tree is alive.
            sleep(Duration::from_millis(100));
        }
        bad(
            run,
            "exited_early",
            format!("the launched process exited ({status}) {phase}, and no other instance of it could be seen"),
        )
    }

    fn one_run(ctx: &Ctx, run: u32) -> Result<Run, Invalid> {
        let a = ctx.args;
        let mut cmd = Command::new(&ctx.exe);
        if let Some(dir) = std::path::Path::new(&ctx.exe).parent() {
            cmd.current_dir(dir);
        }
        cmd.envs(a.env.iter().map(|(k, v)| (k, v)))
            .env("PRUNE_TRACE_STARTUP", "1")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped());
        // The app and everything it starts run in this job: the tree is
        // read from it and killed through it (see win.rs).
        let job = match win::Job::new() {
            Ok(j) => j,
            Err(e) => return Err(bad(run, "launch_failed", format!("could not create a job object: {e}"))),
        };
        let start = Instant::now();
        let (mut child, held): (Child, Duration) = match job.spawn(&mut cmd) {
            Ok(c) => c,
            Err(e) if e.raw_os_error() == Some(ERROR_ELEVATION_REQUIRED) => {
                return Err(bad(
                    run,
                    "elevation_required",
                    "the exe's manifest requires administrator rights, so it cannot be launched from a limited session; nothing was measured".into(),
                ));
            }
            Err(e) => return Err(bad(run, "launch_failed", e.to_string())),
        };

        // Drain stderr for the whole run (an undrained pipe would stall the
        // app) and keep the startup trace line when there is one.
        let frame: Arc<Mutex<Option<f64>>> = Arc::new(Mutex::new(None));
        if let Some(err) = child.stderr.take() {
            let frame = Arc::clone(&frame);
            std::thread::spawn(move || {
                let mut r = BufReader::new(err);
                let mut buf = Vec::new();
                loop {
                    buf.clear();
                    match r.read_until(b'\n', &mut buf) {
                        Ok(0) | Err(_) => break,
                        Ok(_) => {
                            if let Some(ms) = parse_first_frame(&String::from_utf8_lossy(&buf)) {
                                *frame.lock().unwrap() = Some(ms);
                            }
                        }
                    }
                }
            });
        }

        let outcome = (|| -> Result<Run, Invalid> {
            // First visible window owned by the tree.
            let first_window = loop {
                if let Ok(Some(st)) = child.try_wait() {
                    return Err(diagnose_exit(ctx, run, &job, st.to_string(), "before showing a window"));
                }
                let t = job.pids();
                if win::has_visible_window(&t) {
                    // Not counting the time it was held suspended.
                    break start.elapsed().saturating_sub(held);
                }
                if start.elapsed() > FIRST_WINDOW_TIMEOUT {
                    if let Some(p) = foreign_instance(ctx, &t) {
                        return Err(bad(
                            run,
                            "relaunched_elevated",
                            format!(
                                "no visible window in the launched tree within 60 s, but another instance of the same exe (pid {p}) is running outside it: it most likely relaunched itself elevated. That instance was not measured and was left running"
                            ),
                        ));
                    }
                    return Err(bad(run, "no_window", "no visible window within 60 s".into()));
                }
                sleep(POLL);
            };

            // Settle, watching that the process we launched stays up.
            let settled = Instant::now() + Duration::from_secs(a.settle);
            while Instant::now() < settled {
                if let Ok(Some(st)) = child.try_wait() {
                    return Err(diagnose_exit(ctx, run, &job, st.to_string(), "while settling"));
                }
                sleep(Duration::from_millis(100));
            }

            let (ws, private) = job.memory();
            let procs = job.active();
            let cpu0 = job.cpu_time();
            let since_launch = cpu0;
            let w0 = Instant::now();
            let end = w0 + Duration::from_secs(a.cpu_window);
            while Instant::now() < end {
                if let Ok(Some(st)) = child.try_wait() {
                    return Err(diagnose_exit(ctx, run, &job, st.to_string(), "during the CPU window"));
                }
                sleep(Duration::from_millis(100));
            }
            let wall_100ns = w0.elapsed().as_secs_f64() * 1e7;
            let used = job.cpu_time().saturating_sub(cpu0) as f64;
            let mb = |b: u64| b as f64 / (1024.0 * 1024.0);
            Ok(Run {
                first_window_ms: first_window.as_secs_f64() * 1000.0,
                first_frame_ms: None,
                working_set_mb: mb(ws),
                private_mb: mb(private),
                cpu_pct: used / wall_100ns / ctx.cpus as f64 * 100.0,
                cpu_ms: used / 1e4,
                cpu_since_launch_ms: since_launch as f64 / 1e4,
                processes: procs,
            })
        })();

        kill_tree(&job);
        let _ = child.wait();
        sleep(Duration::from_millis(300)); // let the stderr thread see EOF
        outcome.map(|mut r| {
            r.first_frame_ms = *frame.lock().unwrap();
            r
        })
    }

    pub fn run(args: &Args) -> ExitCode {
        let exe = match std::path::absolute(&args.exe) {
            Ok(p) => p.to_string_lossy().into_owned(),
            Err(e) => {
                eprintln!("prune-measure: {e}");
                return ExitCode::from(2);
            }
        };
        if !std::path::Path::new(&exe).is_file() {
            eprintln!("prune-measure: {exe} is not a file");
            return ExitCode::from(2);
        }
        let exe_lower = exe.to_lowercase();
        let cpus = std::thread::available_parallelism().map_or(1, usize::from);

        // Never launch into someone's running instance: it would hand off
        // and exit. Closing it is opt-in, by the exact image path only.
        let existing = win::pids_with_image(&exe_lower);
        let mut closed = 0;
        // Armed before the first kill, so a half-finished close is restored too.
        let mut restore = Restore { exe: &exe, armed: false };
        if !existing.is_empty() {
            if !args.kill_existing {
                eprintln!(
                    "prune-measure: {} instance(s) of {exe} are already running (pids {existing:?}); close them, or pass --kill-existing (add --restore to start one again at the end)",
                    existing.len()
                );
                return ExitCode::from(2);
            }
            restore.armed = args.restore;
            // Only processes whose image is this exe: 3.x's helper processes
            // (renderer, GPU, crash handler) are the same exe, and nothing
            // else is ever touched.
            for _ in 0..8 {
                if win::kill_image(&exe_lower).0 == 0 {
                    break;
                }
                sleep(Duration::from_millis(250));
            }
            if !win::pids_with_image(&exe_lower).is_empty() {
                eprintln!("prune-measure: could not close the running instance (elevated?); nothing was measured");
                return ExitCode::from(2);
            }
            closed = existing.len();
            sleep(Duration::from_secs(2));
        }

        let ctx = Ctx { args, exe: exe.clone(), exe_lower, cpus };
        let version = win::file_version(&exe).unwrap_or_else(|| "unknown".into());
        eprintln!(
            "prune-measure: {exe} (version {version}), {} runs after 1 warm-up, settle {} s",
            args.runs, args.settle
        );

        let mut runs = Vec::new();
        let mut invalid = Vec::new();
        // Run 0 is the discarded warm-up.
        for i in 0..=args.runs {
            let label = if i == 0 { "warm-up".to_string() } else { format!("run {i}/{}", args.runs) };
            match one_run(&ctx, i) {
                Ok(r) => {
                    eprintln!(
                        "  {label}: window {:.0} ms, {:.1} MB, cpu {:.3}%, {} processes{}",
                        r.first_window_ms,
                        r.working_set_mb,
                        r.cpu_pct,
                        r.processes,
                        r.first_frame_ms.map_or(String::new(), |f| format!(", first frame {f:.0} ms"))
                    );
                    if i > 0 {
                        runs.push(r);
                    }
                }
                Err(inv) => {
                    eprintln!("  {label}: INVALID ({}): {}", inv.kind, inv.reason);
                    let stop =
                        matches!(inv.kind.as_str(), "elevation_required" | "relaunched_elevated" | "launch_failed");
                    invalid.push(inv);
                    if stop {
                        break; // every further run would fail the same way
                    }
                }
            }
            sleep(Duration::from_secs(1));
        }

        let meta = Meta {
            settle_s: args.settle,
            cpu_window_s: args.cpu_window,
            logical_cpus: cpus,
            existing_instances_closed: closed,
        };
        let json = build_report(&exe, &version, &runs, &invalid, &meta);
        let text = serde_json::to_string_pretty(&json).expect("report is plain data");
        match &args.out {
            Some(path) => {
                if let Some(dir) = std::path::Path::new(path).parent() {
                    let _ = std::fs::create_dir_all(dir);
                }
                if let Err(e) = std::fs::write(path, format!("{text}\n")) {
                    eprintln!("prune-measure: writing {path}: {e}");
                    return ExitCode::from(2);
                }
                eprintln!("prune-measure: wrote {path}");
            }
            None => println!("{text}"),
        }

        if runs.len() as u32 == args.runs && invalid.is_empty() { ExitCode::SUCCESS } else { ExitCode::from(1) }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn p(a: &[&str]) -> Result<Args, String> {
        parse_args(a.iter().map(|s| s.to_string()))
    }

    #[test]
    fn defaults_and_flags() {
        let a = p(&["--exe", "x.exe"]).unwrap();
        assert_eq!((a.runs, a.settle, a.cpu_window), (5, 30, 10));
        let a = p(&[
            "--exe",
            "x.exe",
            "--runs",
            "3",
            "--settle",
            "5",
            "--out",
            "o.json",
            "--env",
            "A=b=c",
            "--kill-existing",
            "--restore",
        ])
        .unwrap();
        assert_eq!((a.runs, a.settle, a.out.as_deref()), (3, 5, Some("o.json")));
        assert_eq!(a.env, vec![("A".to_string(), "b=c".to_string())]);
        assert!(a.kill_existing && a.restore);
    }

    #[test]
    fn bad_arguments_are_refused() {
        assert!(p(&[]).is_err());
        assert!(p(&["--exe", "x", "--runs", "0"]).is_err());
        assert!(p(&["--exe", "x", "--runs", "many"]).is_err());
        assert!(p(&["--exe", "x", "--env", "NOEQUALS"]).is_err());
        assert!(p(&["--exe", "x", "--wat"]).is_err());
        assert!(p(&["--exe"]).is_err());
    }

    #[test]
    fn reads_the_startup_trace_line() {
        assert_eq!(parse_first_frame("first-frame-ms=143.2"), Some(143.2));
        assert_eq!(parse_first_frame("[trace] first-frame-ms=9.0 extra"), Some(9.0));
        assert_eq!(parse_first_frame("nothing here"), None);
    }
}
