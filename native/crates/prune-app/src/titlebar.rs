//! The window's title bar.
//!
//! 3.x hides Electron's caption and draws a 40 px strip in `--bg-base` with
//! Windows' own minimize/maximize/close buttons over it, which keeps Snap
//! Layouts and screen-edge hit-testing. 4.0 keeps the real native frame for
//! the same reasons and paints its caption instead: dark mode for the
//! buttons' glyphs, `--bg-base` behind them and the title in
//! `--text-primary`, so it reads as 3.x's bar rather than the system's.
//! Windows 10 ignores the caption colours and keeps only dark mode.

use crate::theme::Palette;

/// `COLORREF` (0x00BBGGRR) for an opaque colour.
pub fn colorref(c: iced::Color) -> u32 {
    let [r, g, b, _] = c.into_rgba8();
    u32::from(r) | (u32::from(g) << 8) | (u32::from(b) << 16)
}

/// Paints the caption of `hwnd` for this theme. Best effort: an older
/// Windows that lacks an attribute just keeps its own colour.
#[cfg(windows)]
pub fn paint(hwnd: windows::Win32::Foundation::HWND, dark: bool, palette: &Palette) {
    use windows::Win32::Graphics::Dwm::{
        DWMWA_CAPTION_COLOR, DWMWA_TEXT_COLOR, DWMWA_USE_IMMERSIVE_DARK_MODE, DwmSetWindowAttribute,
    };
    let dark_mode: i32 = dark.into();
    let caption = colorref(palette.bg_base);
    let text = colorref(palette.text_primary);
    // SAFETY: each pointer is to a local of the size passed with it.
    unsafe {
        let _ = DwmSetWindowAttribute(hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE, (&raw const dark_mode).cast(), 4);
        let _ = DwmSetWindowAttribute(hwnd, DWMWA_CAPTION_COLOR, (&raw const caption).cast(), 4);
        let _ = DwmSetWindowAttribute(hwnd, DWMWA_TEXT_COLOR, (&raw const text).cast(), 4);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::theme::palette;

    #[test]
    fn caption_is_bg_base() {
        // #09090b and #f7f6f4, byte-swapped into COLORREF order.
        assert_eq!(colorref(palette(true).bg_base), 0x000b_0909);
        assert_eq!(colorref(palette(false).bg_base), 0x00f4_f6f7);
    }
}
