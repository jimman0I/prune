//! Colour tokens, copied from `frontend/src/index.css` (`:root` is dark,
//! `:root[data-theme='light']` is light). The `palette_matches_index_css`
//! test parses that file, so a drift in either place fails the build.

use iced::Color;
use prune_core::settings::ThemeChoice;

/// The 3.x colour tokens the native UI paints with. Field `a_b` is `--a-b`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Palette {
    pub bg_base: Color,
    pub bg_panel: Color,
    pub text_primary: Color,
    pub text_secondary: Color,
    pub text_muted: Color,
    pub accent_primary: Color,
    pub accent_primary_soft: Color,
    pub accent_primary_deep: Color,
    pub accent_ink: Color,
    pub danger: Color,
    pub danger_soft: Color,
    pub warning: Color,
    pub success: Color,
    pub border_subtle: Color,
    pub border_hover: Color,
    pub control_border: Color,
    pub surface_subtle: Color,
    pub surface_hover: Color,
    pub surface_strong: Color,
    pub scrim: Color,
    /// `.glass-panel`'s fill and edge (the nav rail, cards, dialogs).
    pub glass_bg: Color,
    pub glass_border: Color,
}

/// An opaque colour from a `#rrggbb` value.
const fn rgb(r: u8, g: u8, b: u8) -> Color {
    rgba(r, g, b, 1.0)
}

const fn rgba(r: u8, g: u8, b: u8, a: f32) -> Color {
    Color { r: r as f32 / 255.0, g: g as f32 / 255.0, b: b as f32 / 255.0, a }
}

static DARK: Palette = Palette {
    bg_base: rgb(0x09, 0x09, 0x0b),
    bg_panel: rgb(0x13, 0x13, 0x16),
    text_primary: rgb(0xfa, 0xfa, 0xfa),
    text_secondary: rgb(0xa1, 0xa1, 0xaa),
    text_muted: rgb(0x85, 0x85, 0x8f),
    accent_primary: rgb(0x18, 0xa9, 0xc2),
    accent_primary_soft: rgba(24, 169, 194, 0.12),
    accent_primary_deep: rgb(0x14, 0x8b, 0x9f),
    accent_ink: rgb(0x09, 0x09, 0x0b),
    danger: rgb(0xec, 0x51, 0x62),
    danger_soft: rgba(236, 81, 98, 0.12),
    warning: rgb(0xf5, 0x9e, 0x0b),
    success: rgb(0x5d, 0xb8, 0x72),
    border_subtle: rgba(255, 255, 255, 0.06),
    border_hover: rgba(255, 255, 255, 0.25),
    control_border: rgba(255, 255, 255, 0.36),
    surface_subtle: rgba(255, 255, 255, 0.025),
    surface_hover: rgba(255, 255, 255, 0.05),
    surface_strong: rgba(255, 255, 255, 0.11),
    scrim: rgba(2, 8, 20, 0.62),
    glass_bg: rgba(9, 9, 11, 0.6),
    glass_border: rgba(255, 255, 255, 0.06),
};

static LIGHT: Palette = Palette {
    bg_base: rgb(0xf7, 0xf6, 0xf4),
    bg_panel: rgb(0xff, 0xff, 0xff),
    text_primary: rgb(0x1c, 0x19, 0x17),
    text_secondary: rgb(0x57, 0x53, 0x4e),
    text_muted: rgb(0x6b, 0x65, 0x5f),
    accent_primary: rgb(0x11, 0x72, 0x8d),
    accent_primary_soft: rgba(17, 114, 141, 0.07),
    accent_primary_deep: rgb(0x0e, 0x5d, 0x73),
    accent_ink: rgb(0xff, 0xff, 0xff),
    danger: rgb(0xa3, 0x2f, 0x06),
    danger_soft: rgba(163, 47, 6, 0.1),
    warning: rgb(0x7d, 0x4d, 0x05),
    success: rgb(0x11, 0x66, 0x32),
    border_subtle: rgba(28, 25, 23, 0.1),
    border_hover: rgba(28, 25, 23, 0.32),
    control_border: rgba(28, 25, 23, 0.5),
    surface_subtle: rgba(28, 25, 23, 0.028),
    surface_hover: rgba(28, 25, 23, 0.05),
    surface_strong: rgba(28, 25, 23, 0.09),
    scrim: rgba(28, 25, 23, 0.32),
    glass_bg: rgba(255, 255, 255, 0.72),
    glass_border: rgba(28, 25, 23, 0.08),
};

pub fn palette(dark: bool) -> &'static Palette {
    if dark { &DARK } else { &LIGHT }
}

/// Whether Windows apps are set to the light theme, or `None` when the
/// setting cannot be read.
#[cfg(windows)]
pub fn os_prefers_light() -> Option<bool> {
    use windows::Win32::System::Registry::{HKEY_CURRENT_USER, RRF_RT_REG_DWORD, RegGetValueW};
    use windows::core::w;

    let mut data = 0u32;
    let mut len = size_of::<u32>() as u32;
    // SAFETY: `data` and `len` outlive the call and `len` is its byte size.
    let status = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            w!(r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"),
            w!("AppsUseLightTheme"),
            RRF_RT_REG_DWORD,
            None,
            Some((&mut data as *mut u32).cast()),
            Some(&mut len),
        )
    };
    status.is_ok().then_some(data != 0)
}

#[cfg(not(windows))]
pub fn os_prefers_light() -> Option<bool> {
    None
}

/// System follows the OS; an unknown OS setting is dark, the 3.x default.
pub fn is_dark(choice: ThemeChoice, os_light: Option<bool>) -> bool {
    match choice {
        ThemeChoice::Dark => true,
        ThemeChoice::Light => false,
        ThemeChoice::System => !os_light.unwrap_or(false),
    }
}

/// The bundled fonts (Geist 400/500/600/700, JetBrains Mono 400/500/600) as
/// TrueType bytes, for the app to register at startup (Task 5).
pub fn font_bytes() -> [&'static [u8]; 7] {
    [
        include_bytes!("../assets/fonts/Geist-Regular.ttf"),
        include_bytes!("../assets/fonts/Geist-Medium.ttf"),
        include_bytes!("../assets/fonts/Geist-SemiBold.ttf"),
        include_bytes!("../assets/fonts/Geist-Bold.ttf"),
        include_bytes!("../assets/fonts/JetBrainsMono-Regular.ttf"),
        include_bytes!("../assets/fonts/JetBrainsMono-Medium.ttf"),
        include_bytes!("../assets/fonts/JetBrainsMono-SemiBold.ttf"),
    ]
}
