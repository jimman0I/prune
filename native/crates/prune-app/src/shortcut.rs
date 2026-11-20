//! Which global shortcut a key press is, or none. A port of 3.x's
//! `frontend/src/lib/shortcutMatch.js`, decision for decision.
//!
//! Escape is deliberately not here, as in 3.x: dialogs close themselves.
//! Zoom keys are not here either: in 3.x they are taken by the shell before
//! the page sees them (`electron/zoom.cjs`), see [`crate::zoom`].

/// A key press in the shape 3.x's matcher reads from a DOM `KeyboardEvent`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct KeyPress<'a> {
    /// The character typed (`event.key`), Shift applied, Ctrl not.
    pub key: &'a str,
    /// The physical key (`event.code`): `"Digit1"`, `"Numpad4"`, or `""`.
    pub code: &'a str,
    pub ctrl: bool,
    /// The Windows key (Cmd on a Mac keyboard), which 3.x accepts as Ctrl.
    pub meta: bool,
    pub shift: bool,
    pub alt: bool,
    /// A text field has keyboard focus (3.x: INPUT, TEXTAREA, SELECT or
    /// contentEditable is the event target).
    pub typing: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Shortcut {
    /// Ctrl+, from anywhere.
    Settings,
    /// Ctrl+1 to Ctrl+8: the Nth screen of `Screen::ORDER`, 1-based.
    Screen(usize),
    /// Ctrl+K / Ctrl+F.
    Search,
    /// Ctrl+/ (and Ctrl+?).
    Help,
}

pub fn match_shortcut(event: &KeyPress) -> Option<Shortcut> {
    if !(event.ctrl || event.meta) {
        return None;
    }
    // Ctrl+Alt is how AltGr arrives on many Windows layouts; swallowing it
    // would break typing @ and \. None of the shortcuts use Alt.
    if event.alt {
        return None;
    }
    let key = event.key.to_lowercase();

    // Settings works from anywhere: Ctrl+comma means nothing to a text box.
    if key == "," {
        return Some(Shortcut::Settings);
    }
    // The rest defer to a focused field (Ctrl+F there reaches the field,
    // Ctrl+A is select-all).
    if event.typing {
        return None;
    }
    // Ctrl+1..8 by the key, or by the physical position for layouts (AZERTY)
    // where the unshifted top row types & é " ... Shift is refused on the
    // positional path: Ctrl+Shift+digit is a different chord.
    if let Some(n) = digit_1_to_8(&key) {
        return Some(Shortcut::Screen(n));
    }
    if !event.shift {
        let positional = event.code.strip_prefix("Digit").or_else(|| event.code.strip_prefix("Numpad"));
        if let Some(n) = positional.and_then(digit_1_to_8) {
            return Some(Shortcut::Screen(n));
        }
    }
    match key.as_str() {
        "k" | "f" => Some(Shortcut::Search),
        "/" | "?" => Some(Shortcut::Help),
        _ => None,
    }
}

fn digit_1_to_8(s: &str) -> Option<usize> {
    match s.as_bytes() {
        [d @ b'1'..=b'8'] => Some(usize::from(d - b'0')),
        _ => None,
    }
}
