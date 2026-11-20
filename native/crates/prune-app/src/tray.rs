//! The notification-area icon and "close hides to the tray".
//!
//! 3.x (`backend/src/lib/trayManager.js`) always shows the icon, with a menu
//! of "Open Prune" and "Quit" (and a Quick Clean item that comes back with
//! the cleaner, Phase 3), and a left click opens the window. Closing the
//! window hides it when `minimizeToTray` is on and quits otherwise. The menu
//! labels are English-only, as in 3.x.
//!
//! The icon is created on the UI thread, whose Win32 message loop is the one
//! winit already runs, so nothing here polls. tray-icon calls a handler from
//! that loop when the icon or the menu is used; the handler pushes a
//! [`TrayCommand`] down a channel that a `Task` started at boot listens to,
//! the same way later launches arrive. At rest there is no subscription and
//! no timer: a hidden Prune costs 0% CPU.

use iced::futures::channel::mpsc::UnboundedReceiver;

/// What the person asked of the tray.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrayCommand {
    Open,
    Quit,
}

/// 3.x's menu labels, verbatim.
pub const OPEN_LABEL: &str = "Open Prune";
pub const QUIT_LABEL: &str = "Quit";

/// The tooltip over the icon.
pub const TOOLTIP: &str = "Prune";

/// Menu item ids, in the order of the menu.
pub const OPEN_ID: &str = "prune-tray-open";
pub const QUIT_ID: &str = "prune-tray-quit";

/// The menu as (id, label) rows.
pub const MENU: [(&str, &str); 2] = [(OPEN_ID, OPEN_LABEL), (QUIT_ID, QUIT_LABEL)];

/// What closing the window does.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CloseAction {
    /// Hide the window; the tray icon is how it comes back.
    HideToTray,
    /// Save and exit.
    Quit,
}

/// Closing hides only when the setting is on and the icon is really there:
/// a hidden window with no icon would be a window nobody can get back
/// (3.x's `waitForTray` guards the same thing).
pub fn close_action(minimize_to_tray: bool, tray_present: bool) -> CloseAction {
    if minimize_to_tray && tray_present { CloseAction::HideToTray } else { CloseAction::Quit }
}

/// The command a menu item stands for.
pub fn command_for_menu_id(id: &str) -> Option<TrayCommand> {
    match id {
        OPEN_ID => Some(TrayCommand::Open),
        QUIT_ID => Some(TrayCommand::Quit),
        _ => None,
    }
}

/// A click opens on the left button's release, once (Windows reports the
/// press and the release; the press alone would fire before the person lets
/// go, and a double click would otherwise open twice).
pub fn command_for_click(left_button: bool, released: bool) -> Option<TrayCommand> {
    (left_button && released).then_some(TrayCommand::Open)
}

/// The image data of the `size`x`size` entry of an `.ico` file. Prune's icon
/// stores PNG entries, which is what this returns; a BMP entry is not one.
pub fn ico_png(ico: &[u8], size: u32) -> Option<&[u8]> {
    const PNG: [u8; 4] = [0x89, b'P', b'N', b'G'];
    let count = usize::from(u16::from_le_bytes([*ico.get(4)?, *ico.get(5)?]));
    (0..count).find_map(|i| {
        let entry = ico.get(6 + 16 * i..22 + 16 * i)?;
        // A stored width of 0 means 256.
        let width = if entry[0] == 0 { 256 } else { u32::from(entry[0]) };
        if width != size {
            return None;
        }
        let len = u32::from_le_bytes(entry[8..12].try_into().ok()?) as usize;
        let offset = u32::from_le_bytes(entry[12..16].try_into().ok()?) as usize;
        let data = ico.get(offset..offset.checked_add(len)?)?;
        data.starts_with(&PNG).then_some(data)
    })
}

/// Decodes PNG bytes to 8-bit RGBA: pixels, width, height.
pub fn decode_png_rgba(png_bytes: &[u8]) -> Option<(Vec<u8>, u32, u32)> {
    let mut decoder = png::Decoder::new(std::io::Cursor::new(png_bytes));
    decoder.set_transformations(png::Transformations::EXPAND | png::Transformations::ALPHA);
    let mut reader = decoder.read_info().ok()?;
    let mut buf = vec![0; reader.output_buffer_size()?];
    let info = reader.next_frame(&mut buf).ok()?;
    if info.color_type != png::ColorType::Rgba || info.bit_depth != png::BitDepth::Eight {
        return None;
    }
    buf.truncate(info.buffer_size());
    Some((buf, info.width, info.height))
}

/// Wires the tray's click and menu events to a channel. Call once, before the
/// icon exists; the receiver is what the app listens to.
#[cfg(windows)]
pub fn install_event_forwarding() -> UnboundedReceiver<TrayCommand> {
    imp::install()
}

#[cfg(not(windows))]
pub fn install_event_forwarding() -> UnboundedReceiver<TrayCommand> {
    iced::futures::channel::mpsc::unbounded().1
}

/// The live icon. Dropping it removes the icon from the notification area.
pub struct Tray {
    #[cfg(windows)]
    _icon: tray_icon::TrayIcon,
}

impl Tray {
    /// Creates the icon and its menu. Must run on the thread that pumps
    /// Windows messages (the UI thread). `None` if Windows refused.
    #[cfg(windows)]
    pub fn create() -> Option<Tray> {
        imp::create().map(|_icon| Tray { _icon })
    }

    #[cfg(not(windows))]
    pub fn create() -> Option<Tray> {
        None
    }
}

#[cfg(windows)]
mod imp {
    use std::sync::OnceLock;

    use iced::futures::channel::mpsc::{self, UnboundedReceiver, UnboundedSender};
    use tray_icon::menu::{Menu, MenuEvent, MenuItem};
    use tray_icon::{Icon, MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};

    use super::{MENU, TOOLTIP, TrayCommand, command_for_click, command_for_menu_id, decode_png_rgba, ico_png};

    static ICO: &[u8] = include_bytes!("../../../../electron/build/icon.ico");

    /// Kept so a debug build can post a command by itself (`PRUNE_TEST_TRAY`).
    static SENDER: OnceLock<UnboundedSender<TrayCommand>> = OnceLock::new();

    pub fn install() -> UnboundedReceiver<TrayCommand> {
        let (tx, rx) = mpsc::unbounded();
        let _ = SENDER.set(tx.clone());
        let clicks = tx.clone();
        TrayIconEvent::set_event_handler(Some(move |event: TrayIconEvent| {
            if let TrayIconEvent::Click { button, button_state, .. } = event {
                let command = command_for_click(button == MouseButton::Left, button_state == MouseButtonState::Up);
                if let Some(command) = command {
                    let _ = clicks.unbounded_send(command);
                }
            }
        }));
        MenuEvent::set_event_handler(Some(move |event: MenuEvent| {
            if let Some(command) = command_for_menu_id(&event.id.0) {
                let _ = tx.unbounded_send(command);
            }
        }));
        rx
    }

    pub fn create() -> Option<TrayIcon> {
        let (rgba, w, h) = decode_png_rgba(ico_png(ICO, 32)?)?;
        let icon = Icon::from_rgba(rgba, w, h).ok()?;
        let menu = Menu::new();
        for (id, label) in MENU {
            menu.append(&MenuItem::with_id(id, label, true, None)).ok()?;
        }
        let tray = TrayIconBuilder::new()
            .with_icon(icon)
            .with_tooltip(TOOLTIP)
            .with_menu(Box::new(menu))
            // The left click opens the window; the menu is the right click's.
            .with_menu_on_left_click(false)
            .build()
            .ok()?;
        #[cfg(debug_assertions)]
        self_test();
        Some(tray)
    }

    /// Debug builds only: `PRUNE_TEST_TRAY=quit` sends the menu's Quit once
    /// the icon exists, so a script can check the whole path to a clean exit
    /// without anybody clicking the notification area.
    #[cfg(debug_assertions)]
    fn self_test() {
        if std::env::var("PRUNE_TEST_TRAY").is_ok_and(|v| v == "quit")
            && let Some(tx) = SENDER.get()
        {
            let _ = tx.unbounded_send(TrayCommand::Quit);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn close_hides_when_minimize_to_tray() {
        assert_eq!(close_action(true, true), CloseAction::HideToTray);
    }

    #[test]
    fn close_quits_otherwise() {
        assert_eq!(close_action(false, true), CloseAction::Quit);
        assert_eq!(close_action(false, false), CloseAction::Quit);
        // No icon, no hiding: the window could not be brought back.
        assert_eq!(close_action(true, false), CloseAction::Quit);
    }

    #[test]
    fn menu_labels_match_3x() {
        let labels: Vec<&str> = MENU.iter().map(|(_, l)| *l).collect();
        assert_eq!(labels, ["Open Prune", "Quit"]);
        assert_eq!(command_for_menu_id(MENU[0].0), Some(TrayCommand::Open));
        assert_eq!(command_for_menu_id(MENU[1].0), Some(TrayCommand::Quit));
        assert_eq!(command_for_menu_id("something-else"), None);
    }

    #[test]
    fn left_click_opens_once_on_release() {
        assert_eq!(command_for_click(true, true), Some(TrayCommand::Open));
        assert_eq!(command_for_click(true, false), None, "the press alone does nothing");
        assert_eq!(command_for_click(false, true), None, "right click is the menu's");
    }

    #[test]
    fn the_icon_file_holds_a_decodable_32px_png() {
        let ico = include_bytes!("../../../../electron/build/icon.ico");
        let (pixels, w, h) = decode_png_rgba(ico_png(ico, 32).expect("a 32x32 entry")).expect("decodes");
        assert_eq!((w, h), (32, 32));
        assert_eq!(pixels.len(), 32 * 32 * 4);
        assert!(pixels.chunks(4).any(|p| p[3] > 0), "not blank");
        assert!(ico_png(ico, 7).is_none());
        assert!(ico_png(&[0, 0, 1], 32).is_none(), "a truncated file is not an icon");
    }
}
