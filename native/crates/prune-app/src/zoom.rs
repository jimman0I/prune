//! Text zoom: a port of 3.x's `electron/zoom.cjs`.
//!
//! Levels are Chromium's own, because 3.x saves them that way in
//! `window-state.json`: 0 is 100% and every whole step multiplies by 1.2,
//! so the range [-2, 3] is about 69% to 173%. The factor is applied as
//! iced's scale factor, on top of the display's own scaling.

use serde_json::Value;

pub const ZOOM_STEP: f64 = 0.5;
pub const ZOOM_MIN: f64 = -2.0;
pub const ZOOM_MAX: f64 = 3.0;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ZoomAction {
    In,
    Out,
    Reset,
}

fn clamp(level: f64) -> f64 {
    level.clamp(ZOOM_MIN, ZOOM_MAX)
}

/// Snapped to a whole step so repeated additions never drift off the grid.
fn snap(level: f64) -> f64 {
    // JS Math.round rounds halves up; f64::round rounds them away from 0.
    (level / ZOOM_STEP + 0.5).floor() * ZOOM_STEP
}

/// What a key press means for zoom. Only Ctrl with an optional Shift (Shift
/// is how a US layout types `+`); Alt or the Windows key held means another
/// chord. Auto-repeat is kept so holding the key keeps stepping. `key` is the
/// character, so the numpad's + and - arrive as the same '+' and '-'.
pub fn zoom_action_for_input(key: &str, control: bool, alt: bool, meta: bool) -> Option<ZoomAction> {
    if !control || alt || meta {
        return None;
    }
    match key {
        "=" | "+" => Some(ZoomAction::In),
        "-" => Some(ZoomAction::Out),
        "0" => Some(ZoomAction::Reset),
        _ => None,
    }
}

/// The level after an action, always inside [ZOOM_MIN, ZOOM_MAX]. No action
/// (3.x: an unknown one) leaves the clamped, snapped level.
pub fn apply_zoom_action(level: f64, action: Option<ZoomAction>) -> f64 {
    let current = if level.is_finite() { level } else { 0.0 };
    match action {
        Some(ZoomAction::In) => clamp(snap(current + ZOOM_STEP)),
        Some(ZoomAction::Out) => clamp(snap(current - ZOOM_STEP)),
        Some(ZoomAction::Reset) => 0.0,
        None => clamp(snap(current)),
    }
}

/// The level to restore from saved window state. Anything that is not an
/// object with a finite numeric `zoomLevel` means 100%.
pub fn resolve_saved_zoom(saved: Option<&Value>) -> f64 {
    match saved.and_then(|s| s.as_object()).and_then(|o| o.get("zoomLevel")).and_then(Value::as_f64) {
        Some(level) if level.is_finite() => clamp(snap(level)),
        _ => 0.0,
    }
}

/// Chromium's level-to-factor curve: 1.2 per whole step.
pub fn factor(level: f64) -> f64 {
    1.2f64.powf(level)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// electron/zoom.test.cjs, case for case.
    #[test]
    fn zoom_steps_match_3x() {
        let key = |k| zoom_action_for_input(k, true, false, false);
        // Ctrl+= and Ctrl++ zoom in, including the shifted and numpad forms
        assert_eq!(key("="), Some(ZoomAction::In));
        assert_eq!(key("+"), Some(ZoomAction::In));
        // Ctrl+- zooms out and Ctrl+0 resets
        assert_eq!(key("-"), Some(ZoomAction::Out));
        assert_eq!(key("0"), Some(ZoomAction::Reset));
        // ignores everything that is not exactly a zoom chord
        assert_eq!(zoom_action_for_input("=", false, false, false), None, "no Ctrl");
        assert_eq!(zoom_action_for_input("-", true, true, false), None, "Alt held");
        assert_eq!(zoom_action_for_input("-", true, false, true), None, "Win held");
        assert_eq!(key("a"), None);
        assert_eq!(key("k"), None, "the app's own Ctrl+K passes through");
        assert_eq!(key(""), None);

        // steps by ZOOM_STEP and resets to 0
        assert_eq!(apply_zoom_action(0.0, Some(ZoomAction::In)), ZOOM_STEP);
        assert_eq!(apply_zoom_action(0.0, Some(ZoomAction::Out)), -ZOOM_STEP);
        assert_eq!(apply_zoom_action(2.0, Some(ZoomAction::Reset)), 0.0);
        assert_eq!(apply_zoom_action(1.0, None), 1.0);
        // clamps to the range
        assert_eq!(apply_zoom_action(ZOOM_MAX, Some(ZoomAction::In)), ZOOM_MAX);
        assert_eq!(apply_zoom_action(ZOOM_MIN, Some(ZoomAction::Out)), ZOOM_MIN);
        let mut level = 0.0;
        for _ in 0..100 {
            level = apply_zoom_action(level, Some(ZoomAction::In));
        }
        assert_eq!(level, ZOOM_MAX);
        for _ in 0..100 {
            level = apply_zoom_action(level, Some(ZoomAction::Out));
        }
        assert_eq!(level, ZOOM_MIN);
        // an unclamped level from elsewhere is pulled back into range
        assert_eq!(apply_zoom_action(99.0, Some(ZoomAction::Out)), ZOOM_MAX);
        assert_eq!(apply_zoom_action(-99.0, Some(ZoomAction::In)), ZOOM_MIN);
        assert_eq!(apply_zoom_action(f64::NAN, Some(ZoomAction::In)), ZOOM_STEP);
        // range: includes 100%, at least two steps up, not past the layout
        const {
            assert!(ZOOM_MIN < 0.0 && ZOOM_MAX > 0.0);
            assert!(ZOOM_MAX >= 2.0);
            assert!(ZOOM_MAX <= 4.0 && ZOOM_MIN >= -3.0);
        }

        // resolveSavedZoom: a valid saved level, snapped and clamped
        assert_eq!(resolve_saved_zoom(Some(&json!({ "zoomLevel": 1 }))), 1.0);
        assert_eq!(resolve_saved_zoom(Some(&json!({ "zoomLevel": 99 }))), ZOOM_MAX);
        assert_eq!(resolve_saved_zoom(Some(&json!({ "zoomLevel": -99 }))), ZOOM_MIN);
        assert_eq!(resolve_saved_zoom(Some(&json!({ "zoomLevel": 0.7 }))), 0.5, "snapped");
        assert_eq!(resolve_saved_zoom(Some(&json!({ "zoomLevel": 0.25 }))), 0.5, "halves round up, as Math.round");
        // anything unusable means 100%
        for bad in [json!(null), json!({}), json!({ "zoomLevel": "big" }), json!("x"), json!(4)] {
            assert_eq!(resolve_saved_zoom(Some(&bad)), 0.0, "{bad}");
        }
        assert_eq!(resolve_saved_zoom(None), 0.0);
    }

    #[test]
    fn factor_is_chromiums_curve() {
        assert_eq!(factor(0.0), 1.0);
        assert!((factor(1.0) - 1.2).abs() < 1e-12);
        assert!((factor(-1.0) - 1.0 / 1.2).abs() < 1e-12);
        assert!((factor(ZOOM_MAX) - 1.728).abs() < 1e-9);
    }
}
