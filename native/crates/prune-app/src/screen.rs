//! The eight screens, in the rail's order, and their empty Phase 1 pages.

use iced::widget::{container, text};
use iced::{Element, Font, Length, font};

use prune_core::i18n::Catalog;

use crate::theme::Palette;

/// A place in the app. The order of [`Screen::ORDER`] is 3.x's
/// `SCREEN_ORDER` (`frontend/src/lib/screenOrder.js`): Ctrl+1 to Ctrl+8 go to
/// the Nth entry, and Settings is last because it sits in the rail's footer.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum Screen {
    #[default]
    Dashboard,
    DiskMap,
    Applications,
    Quarantine,
    Startup,
    Duplicates,
    DeepClean,
    Settings,
}

impl Screen {
    pub const ORDER: [Screen; 8] = [
        Screen::Dashboard,
        Screen::DiskMap,
        Screen::Applications,
        Screen::Quarantine,
        Screen::Startup,
        Screen::Duplicates,
        Screen::DeepClean,
        Screen::Settings,
    ];

    /// 3.x's screen id (`'diskmap'`, `'deepclean'`, ...).
    pub fn key(&self) -> &'static str {
        match self {
            Screen::Dashboard => "dashboard",
            Screen::DiskMap => "diskmap",
            Screen::Applications => "applications",
            Screen::Quarantine => "quarantine",
            Screen::Startup => "startup",
            Screen::Duplicates => "duplicates",
            Screen::DeepClean => "deepclean",
            Screen::Settings => "settings",
        }
    }

    /// The catalog key of the screen's name (NavRail.jsx's `NAV_KEYS`).
    pub fn nav_key(&self) -> &'static str {
        match self {
            Screen::Dashboard => "nav.dashboard",
            Screen::DiskMap => "nav.diskMap",
            Screen::Applications => "nav.applications",
            Screen::Quarantine => "nav.quarantine",
            Screen::Startup => "nav.startup",
            Screen::Duplicates => "nav.duplicates",
            Screen::DeepClean => "nav.deepClean",
            Screen::Settings => "nav.settings",
        }
    }

    /// Position in [`Screen::ORDER`], 0-based.
    pub fn index(&self) -> usize {
        Screen::ORDER.iter().position(|s| s == self).unwrap_or(0)
    }
}

/// Geist, by weight. Registered from `theme::font_bytes()` at startup.
pub fn geist(weight: font::Weight) -> Font {
    Font { weight, ..Font::with_name("Geist") }
}

/// JetBrains Mono, for key chips and other code-like text.
pub fn mono(weight: font::Weight) -> Font {
    Font { weight, ..Font::with_name("JetBrains Mono") }
}

/// An empty screen: its translated title, set like 3.x's page heading
/// (`Page`: 40 px above, 48 px beside; `display-heading text-[30px]
/// leading-none`, Geist 600).
pub fn view<'a, M: 'a>(screen: Screen, catalog: &Catalog, palette: &'static Palette) -> Element<'a, M> {
    let title = text(catalog.t(screen.nav_key(), &[]))
        .size(30)
        .line_height(1.0)
        .font(geist(font::Weight::Semibold))
        .color(palette.text_primary);
    container(title).padding([40, 48]).width(Length::Fill).height(Length::Fill).into()
}
