//! The numbers and the JSON they are written as. Pure, so it is tested
//! without launching anything.

use serde_json::{Value, json};

/// One valid measured run.
#[derive(Debug, Clone, PartialEq)]
pub struct Run {
    pub first_window_ms: f64,
    /// `first-frame-ms=` from `PRUNE_TRACE_STARTUP=1`; only 4.x prints it.
    pub first_frame_ms: Option<f64>,
    pub working_set_mb: f64,
    pub private_mb: f64,
    pub cpu_pct: f64,
    pub cpu_ms: f64,
    /// CPU the tree has used since launch, at the start of the CPU window:
    /// proof the counter reads something, and the cost of starting up.
    pub cpu_since_launch_ms: f64,
    pub processes: u32,
}

/// A run that did not measure what was asked: reported, never averaged in.
#[derive(Debug, Clone, PartialEq)]
pub struct Invalid {
    pub run: u32,
    /// `elevation_required`, `relaunched_elevated`, `exited_early`,
    /// `no_window`, `launch_failed`.
    pub kind: String,
    pub reason: String,
}

/// What is the same for every run.
#[derive(Debug, Clone)]
pub struct Meta {
    pub settle_s: u64,
    pub cpu_window_s: u64,
    pub logical_cpus: usize,
    pub existing_instances_closed: usize,
}

/// Median; the mean of the two middle values for an even count.
pub fn median(values: &[f64]) -> Option<f64> {
    if values.is_empty() {
        return None;
    }
    let mut v = values.to_vec();
    v.sort_by(f64::total_cmp);
    let mid = v.len() / 2;
    Some(if v.len() % 2 == 1 { v[mid] } else { (v[mid - 1] + v[mid]) / 2.0 })
}

fn round(x: f64, places: i32) -> f64 {
    let f = 10f64.powi(places);
    (x * f).round() / f
}

fn run_json(r: &Run) -> Value {
    let mut o = json!({
        "first_window_ms": round(r.first_window_ms, 1),
        "working_set_mb": round(r.working_set_mb, 1),
        "private_mb": round(r.private_mb, 1),
        "cpu_pct": round(r.cpu_pct, 3),
        "cpu_ms": round(r.cpu_ms, 1),
        "cpu_since_launch_ms": round(r.cpu_since_launch_ms, 1),
        "processes": r.processes,
    });
    if let Some(f) = r.first_frame_ms {
        o["first_frame_ms"] = json!(round(f, 1));
    }
    o
}

fn med<F: Fn(&Run) -> f64>(runs: &[Run], f: F, places: i32) -> Value {
    let v: Vec<f64> = runs.iter().map(f).collect();
    median(&v).map_or(Value::Null, |m| json!(round(m, places)))
}

/// `{exe, version, runs:[{first_window_ms, working_set_mb, cpu_pct, ..}],
/// median:{..}}`, plus what a reader needs to trust it.
pub fn build_report(exe: &str, version: &str, runs: &[Run], invalid: &[Invalid], meta: &Meta) -> Value {
    let mut median = json!({
        "first_window_ms": med(runs, |r| r.first_window_ms, 1),
        "working_set_mb": med(runs, |r| r.working_set_mb, 1),
        "private_mb": med(runs, |r| r.private_mb, 1),
        "cpu_pct": med(runs, |r| r.cpu_pct, 3),
        "cpu_ms": med(runs, |r| r.cpu_ms, 1),
        "cpu_since_launch_ms": med(runs, |r| r.cpu_since_launch_ms, 1),
        "processes": med(runs, |r| f64::from(r.processes), 0),
    });
    // Only when every valid run has one, so the median is not of a subset.
    if !runs.is_empty() && runs.iter().all(|r| r.first_frame_ms.is_some()) {
        median["first_frame_ms"] = med(runs, |r| r.first_frame_ms.unwrap_or(0.0), 1);
    }
    json!({
        "exe": exe,
        "version": version,
        "method": {
            "warmup_runs_discarded": 1,
            "settle_s": meta.settle_s,
            "cpu_window_s": meta.cpu_window_s,
            "logical_cpus": meta.logical_cpus,
            "existing_instances_closed": meta.existing_instances_closed,
            "cpu_pct_is": "share of the whole machine, summed over the process tree",
            "working_set_is": "summed over the process tree; shared pages count once per process",
        },
        "runs": runs.iter().map(run_json).collect::<Vec<_>>(),
        "median": median,
        "invalid_runs": invalid.iter().map(|i| json!({"run": i.run, "kind": i.kind, "reason": i.reason})).collect::<Vec<_>>(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(w: f64, mb: f64, cpu: f64, frame: Option<f64>) -> Run {
        Run {
            first_window_ms: w,
            first_frame_ms: frame,
            working_set_mb: mb,
            private_mb: mb / 2.0,
            cpu_pct: cpu,
            cpu_ms: cpu * 100.0,
            cpu_since_launch_ms: 50.0,
            processes: 1,
        }
    }

    fn meta() -> Meta {
        Meta { settle_s: 30, cpu_window_s: 10, logical_cpus: 8, existing_instances_closed: 0 }
    }

    #[test]
    fn median_of_odd_and_even() {
        assert_eq!(median(&[3.0, 1.0, 2.0]), Some(2.0));
        assert_eq!(median(&[4.0, 1.0, 3.0, 2.0]), Some(2.5));
        assert_eq!(median(&[7.0]), Some(7.0));
        assert_eq!(median(&[]), None);
    }

    #[test]
    fn json_has_fields() {
        let runs = [run(100.0, 40.0, 0.1, Some(90.0)), run(120.0, 50.0, 0.3, Some(110.0)), run(110.0, 45.0, 0.2, Some(100.0))];
        let j = build_report("C:\\x\\Prune.exe", "4.0.0", &runs, &[], &meta());
        assert_eq!(j["exe"], "C:\\x\\Prune.exe");
        assert_eq!(j["version"], "4.0.0");
        assert_eq!(j["runs"].as_array().unwrap().len(), 3);
        for k in ["first_window_ms", "working_set_mb", "cpu_pct"] {
            assert!(j["runs"][0][k].is_number(), "run.{k}");
            assert!(j["median"][k].is_number(), "median.{k}");
        }
        assert_eq!(j["median"]["first_window_ms"], 110.0);
        assert_eq!(j["median"]["working_set_mb"], 45.0);
        assert_eq!(j["median"]["first_frame_ms"], 100.0);
    }

    #[test]
    fn first_frame_median_only_when_every_run_has_one() {
        let runs = [run(1.0, 1.0, 0.0, Some(1.0)), run(1.0, 1.0, 0.0, None)];
        let j = build_report("e", "v", &runs, &[], &meta());
        assert!(j["median"].get("first_frame_ms").is_none());
    }

    #[test]
    fn invalid_runs_are_reported_not_averaged() {
        let bad = Invalid { run: 2, kind: "relaunched_elevated".into(), reason: "x".into() };
        let j = build_report("e", "v", &[run(10.0, 1.0, 0.0, None)], &[bad], &meta());
        assert_eq!(j["runs"].as_array().unwrap().len(), 1);
        assert_eq!(j["invalid_runs"][0]["kind"], "relaunched_elevated");
        let none = build_report("e", "v", &[], &[], &meta());
        assert!(none["median"]["first_window_ms"].is_null());
    }
}
