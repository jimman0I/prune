//! CSS-style transitions, ticked by the app only while one is moving.
//!
//! A [`Tween`] is one CSS `transition` on one number: a duration, a delay
//! and a cubic-bezier curve. Changing its target mid-flight starts from
//! wherever it is, and going back to where it came from is shortened the
//! way CSS shortens a reversed transition, so a pointer skimming the rail
//! does not make it crawl back over the full duration.
//!
//! A new transition starts at the first [`Tween::tick`] after it is set, as
//! a CSS transition starts on the next frame. That also keeps `update`
//! free of clock reads, so tests drive time by hand.

use std::time::{Duration, Instant};

/// `cubic-bezier(x1, y1, x2, y2)`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CubicBezier(pub f32, pub f32, pub f32, pub f32);

/// `cubic-bezier(0.4, 0, 0.2, 1)`: 3.x's rail width and active mark, and
/// Tailwind's default curve for every other `transition-*`.
pub const STANDARD: CubicBezier = CubicBezier(0.4, 0.0, 0.2, 1.0);

impl CubicBezier {
    /// The curve's progress at time fraction `t` (0..=1).
    pub fn ease(&self, t: f32) -> f32 {
        let t = t.clamp(0.0, 1.0);
        if t == 0.0 || t == 1.0 {
            return t;
        }
        let CubicBezier(x1, y1, x2, y2) = *self;
        let bez = |a: f32, b: f32, s: f32| {
            let u = 1.0 - s;
            3.0 * u * u * s * a + 3.0 * u * s * s * b + s * s * s
        };
        // Solve x(s) = t by bisection: x(s) is monotonic for 0 <= x1, x2 <= 1.
        let (mut lo, mut hi) = (0.0f32, 1.0f32);
        let mut s = t;
        for _ in 0..40 {
            let x = bez(x1, x2, s);
            if (x - t).abs() < 1e-6 {
                break;
            }
            if x < t {
                lo = s;
            } else {
                hi = s;
            }
            s = (lo + hi) / 2.0;
        }
        bez(y1, y2, s)
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Tween {
    value: f32,
    from: f32,
    to: f32,
    curve: CubicBezier,
    duration: Duration,
    delay: Duration,
    /// When the running transition began (before its delay). `None` while
    /// waiting for its first tick.
    start: Option<Instant>,
    moving: bool,
}

impl Tween {
    /// A value at rest.
    pub fn at(value: f32) -> Self {
        Tween {
            value,
            from: value,
            to: value,
            curve: STANDARD,
            duration: Duration::ZERO,
            delay: Duration::ZERO,
            start: None,
            moving: false,
        }
    }

    pub fn value(&self) -> f32 {
        self.value
    }

    pub fn target(&self) -> f32 {
        self.to
    }

    pub fn is_moving(&self) -> bool {
        self.moving
    }

    /// Transitions to `to`. With `instant` (reduced motion) it jumps there.
    pub fn set(&mut self, to: f32, duration: Duration, delay: Duration, curve: CubicBezier, instant: bool) {
        if instant || duration.is_zero() {
            *self = Tween::at(to);
            return;
        }
        if to == self.to {
            return;
        }
        let mut duration = duration;
        // CSS's reversing shortening: heading back to where a running
        // transition started takes only as long as it has come so far.
        if self.moving && to == self.from && self.to != self.from {
            let portion = ((self.value - self.from) / (self.to - self.from)).clamp(0.0, 1.0);
            duration = duration.mul_f32(portion);
        }
        self.from = self.value;
        self.to = to;
        self.curve = curve;
        self.duration = duration;
        self.delay = delay;
        self.start = None;
        self.moving = self.value != to;
        if !self.moving {
            *self = Tween::at(to);
        }
    }

    /// Advances to `now`.
    pub fn tick(&mut self, now: Instant) {
        if !self.moving {
            return;
        }
        let start = *self.start.get_or_insert(now);
        let elapsed = now.saturating_duration_since(start);
        let Some(running) = elapsed.checked_sub(self.delay) else {
            return;
        };
        let t = if self.duration.is_zero() { 1.0 } else { running.as_secs_f32() / self.duration.as_secs_f32() };
        if t >= 1.0 {
            *self = Tween::at(self.to);
        } else {
            self.value = self.from + (self.to - self.from) * self.curve.ease(t);
        }
    }
}

/// Windows' "Animation effects" is off (`SPI_GETCLIENTAREAANIMATION`), so
/// transitions jump to their end, as 3.x's reduced-motion rules do.
#[cfg(windows)]
pub fn reduced_motion() -> bool {
    use windows::Win32::UI::WindowsAndMessaging::{
        SPI_GETCLIENTAREAANIMATION, SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS, SystemParametersInfoW,
    };
    let mut enabled = windows::core::BOOL(1);
    // SAFETY: `enabled` is a BOOL, which this action writes.
    let ok = unsafe {
        SystemParametersInfoW(
            SPI_GETCLIENTAREAANIMATION,
            0,
            Some((&raw mut enabled).cast()),
            SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS(0),
        )
    };
    ok.is_ok() && !enabled.as_bool()
}

#[cfg(not(windows))]
pub fn reduced_motion() -> bool {
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    const MS: fn(u64) -> Duration = Duration::from_millis;

    #[test]
    fn curve_endpoints_and_shape() {
        assert_eq!(STANDARD.ease(0.0), 0.0);
        assert_eq!(STANDARD.ease(1.0), 1.0);
        // cubic-bezier(0.4,0,0.2,1) at x=0.5 is y=0.77556 (solved
        // independently to double precision).
        assert!((STANDARD.ease(0.5) - 0.77556).abs() < 1e-3, "{}", STANDARD.ease(0.5));
        let mut last = 0.0;
        for i in 1..=100 {
            let v = STANDARD.ease(i as f32 / 100.0);
            assert!(v >= last, "monotonic");
            last = v;
        }
    }

    #[test]
    fn starts_on_the_first_tick_and_honours_the_delay() {
        let mut t = Tween::at(0.0);
        t.set(100.0, MS(300), MS(100), STANDARD, false);
        assert!(t.is_moving());
        let t0 = Instant::now();
        t.tick(t0);
        t.tick(t0 + MS(99));
        assert_eq!(t.value(), 0.0);
        t.tick(t0 + MS(250));
        assert!(t.value() > 0.0 && t.value() < 100.0);
        t.tick(t0 + MS(400));
        assert_eq!(t.value(), 100.0);
        assert!(!t.is_moving());
    }

    #[test]
    fn instant_jumps() {
        let mut t = Tween::at(0.0);
        t.set(5.0, MS(300), MS(0), STANDARD, true);
        assert_eq!(t.value(), 5.0);
        assert!(!t.is_moving());
    }

    #[test]
    fn reversing_takes_only_as_long_as_it_came() {
        let mut t = Tween::at(0.0);
        t.set(100.0, MS(300), MS(0), STANDARD, false);
        let t0 = Instant::now();
        t.tick(t0);
        t.tick(t0 + MS(60));
        let reached = t.value();
        assert!(reached > 0.0 && reached < 100.0);
        t.set(0.0, MS(300), MS(0), STANDARD, false);
        let t1 = t0 + MS(60);
        t.tick(t1);
        let portion = reached / 100.0;
        t.tick(t1 + MS(300).mul_f32(portion) + MS(1));
        assert_eq!(t.value(), 0.0, "done in the shortened time");
    }
}
