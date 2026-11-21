//! The nav rail, after 3.x's `frontend/src/components/NavRail.jsx`.
//!
//! A 72 px column is reserved beside the page; the panel inside it widens
//! to 200 px over the page on hover or keyboard focus, so the page never
//! re-lays-out while it moves. Each row is one layout in both states: the
//! icon sits 14 px into the row and never moves (its centre is x = 36), and
//! the label is always there at a fixed width, revealed by opacity.
//!
//! The active mark (a soft accent tint with a 3×20 px pill on its left
//! edge) is one element that slides between rows. Its position is
//! arithmetic on the rows' sizes, as in 3.x: row N is
//! `RAIL_PAD + N × (ROW_HEIGHT + ROW_GAP)` from the panel's top, and
//! Settings, pinned to the bottom, is `ROW_HEIGHT - RAIL_PAD` above the end
//! of the content box (3.x's `calc(100cqh - 20px)`). That is linear in the
//! content height, so a position is kept as `top + share × content_height`
//! and the slide blends those two numbers: it stays right while the window
//! is resized mid-slide.

use std::sync::LazyLock;

use iced::widget::{button, column, container, mouse_area, pin, responsive, row, space, stack, svg, text};
use iced::{Background, Border, Color, Element, Length, Padding, Shadow, Vector, alignment, font};

use prune_core::i18n::Catalog;

use crate::overflow::overflow;
use crate::screen::{Screen, geist, mono};
use crate::theme::Palette;

pub const RAIL_PAD: f32 = 24.0;
pub const ROW_HEIGHT: f32 = 44.0;
pub const ROW_GAP: f32 = 8.0;
pub const COLLAPSED_WIDTH: f32 = 72.0;
pub const EXPANDED_WIDTH: f32 = 200.0;
/// `px-[12px]`: the gutter between the panel's edge and the rows.
const GUTTER: f32 = 12.0;
/// `pl-[14px]`: icon inset inside a row.
const ICON_INSET: f32 = 14.0;
const ICON_SIZE: f32 = 20.0;
/// `w-[118px]` label column.
const LABEL_WIDTH: f32 = 118.0;
/// `gap-3`: icon to label.
const ICON_GAP: f32 = 12.0;
/// A row's content (icon, gap, label), laid out at this width in both states.
pub const ROW_CONTENT_WIDTH: f32 = ICON_SIZE + ICON_GAP + LABEL_WIDTH;
/// `rounded-xl`.
const RADIUS: f32 = 12.0;

/// Where the mark sits for `screen`, as `(top, share)`: its offset from the
/// panel's top is `top + share × content_height`.
pub fn mark_anchor(screen: Screen) -> (f32, f32) {
    match screen {
        Screen::Settings => (-(ROW_HEIGHT - RAIL_PAD), 1.0),
        s => (RAIL_PAD + s.index() as f32 * (ROW_HEIGHT + ROW_GAP), 0.0),
    }
}

/// 3.x's `markOffset`: the mark's offset from the panel's top for `screen`,
/// given the panel's content-box height (`100cqh`: the panel's height less
/// `RAIL_PAD` above and below).
pub fn mark_offset(screen: Screen, content_height: f32) -> f32 {
    let (top, share) = mark_anchor(screen);
    top + share * content_height
}

fn icon_svg(body: &str) -> String {
    format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">{body}</svg>"#
    )
}

/// NavRail.jsx's line icons, path for path, in `Screen::ORDER`.
const ICON_BODIES: [&str; 8] = [
    // Dashboard: a gauge.
    r#"<path d="M3.6 17a9 9 0 1 1 16.8 0"/><path d="M12 15l4-5"/><path d="M12 15v.01"/>"#,
    // Disk Map: a tiled treemap.
    r#"<rect x="3" y="3" width="10" height="10" rx="1.5"/><rect x="15" y="3" width="6" height="6" rx="1.5"/><rect x="15" y="11" width="6" height="10" rx="1.5"/><rect x="3" y="15" width="10" height="6" rx="1.5"/>"#,
    // Applications: three rows.
    r#"<rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="16" width="18" height="4" rx="1"/>"#,
    // Quarantine: a shield with a mark.
    r#"<path d="M12 3l8 4v5c0 4.5-3.2 8.4-8 9.5-4.8-1.1-8-5-8-9.5V7l8-4z"/><path d="M12 8v5"/><path d="M12 16.5v.01"/>"#,
    // Startup: a power symbol.
    r#"<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>"#,
    // Duplicates: two overlapping sheets.
    r#"<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>"#,
    // Deep Clean: a broom.
    r#"<path d="M12 2.5v7.5"/><path d="M8.8 10h6.4l2.8 10.5H6z"/><path d="M7.8 14.2h8.4"/><path d="M12 14.2v6.3"/>"#,
    // Settings: a gear.
    r#"<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>"#,
];

/// The icons as SVG documents, in `Screen::ORDER`.
pub fn icon_sources() -> [String; 8] {
    ICON_BODIES.map(icon_svg)
}

static ICONS: LazyLock<[svg::Handle; 8]> =
    LazyLock::new(|| icon_sources().map(|s| svg::Handle::from_memory(s.into_bytes())));

/// Everything the rail draws from.
#[derive(Clone, Copy)]
pub struct Rail<'a> {
    pub active: Screen,
    /// The row with keyboard focus (3.x's `:focus-visible`).
    pub focus: Option<Screen>,
    /// The row under the pointer.
    pub hover: Option<Screen>,
    pub width: f32,
    pub label_opacity: f32,
    /// The mark's `(top, share)`, mid-slide or at rest.
    pub mark: (f32, f32),
    pub palette: &'static Palette,
    pub catalog: &'a Catalog,
}

/// What the rail's interactions send.
pub struct Events<M> {
    pub navigate: fn(Screen) -> M,
    pub rail_hover: fn(bool) -> M,
    pub item_hover: fn(Screen, bool) -> M,
}

// Function pointers are Copy whatever `M` is, so no `M: Copy` bound.
impl<M> Clone for Events<M> {
    fn clone(&self) -> Self {
        *self
    }
}

impl<M> Copy for Events<M> {}

fn with_alpha(c: Color, a: f32) -> Color {
    Color { a: c.a * a, ..c }
}

/// `src` painted over opaque `dst`.
fn over(src: Color, dst: Color) -> Color {
    let a = src.a;
    Color {
        r: src.r * a + dst.r * (1.0 - a),
        g: src.g * a + dst.g * (1.0 - a),
        b: src.b * a + dst.b * (1.0 - a),
        a: 1.0,
    }
}

/// `.glass-panel` without the backdrop blur: iced has none, so the glass is
/// painted opaque over the page colour. Unblurred translucency would let
/// the page's text show through the expanded rail, which 3.x's blur hides.
fn glass(p: &Palette, dark: bool) -> container::Style {
    let shadow = if dark {
        Shadow { color: Color::from_rgba8(0, 0, 0, 0.2), offset: Vector::new(0.0, 8.0), blur_radius: 32.0 }
    } else {
        Shadow { color: Color::from_rgba8(28, 25, 23, 0.12), offset: Vector::new(0.0, 8.0), blur_radius: 24.0 }
    };
    container::Style {
        background: Some(Background::Color(over(p.glass_bg, p.bg_base))),
        border: Border { color: p.glass_border, width: 1.0, radius: RADIUS.into() },
        shadow,
        ..container::Style::default()
    }
}

pub fn view<'a, M: Clone + 'a>(rail: Rail<'a>, events: Events<M>, dark: bool) -> Element<'a, M> {
    responsive(move |size| layer(rail, events, dark, size.height)).into()
}

fn layer<'a, M: Clone + 'a>(rail: Rail<'a>, events: Events<M>, dark: bool, height: f32) -> Element<'a, M> {
    let p = rail.palette;
    let content_height = (height - 2.0 * RAIL_PAD).max(0.0);

    let rows = Screen::ORDER[..7].iter().map(|s| item(rail, events, *s));
    let list = column(rows)
        .push(space().height(Length::Fill))
        .push(item(rail, events, Screen::Settings))
        .spacing(ROW_GAP)
        .padding([RAIL_PAD, GUTTER])
        .width(Length::Fill)
        .height(Length::Fill);

    let mark_y = rail.mark.0 + rail.mark.1 * content_height;
    let tint = container(space().width(Length::Fill).height(Length::Fill)).style(move |_| container::Style {
        background: Some(Background::Color(p.accent_primary_soft)),
        border: Border { radius: RADIUS.into(), ..Border::default() },
        ..container::Style::default()
    });
    let pill = container(space().width(3).height(20)).style(move |_| container::Style {
        background: Some(Background::Color(p.accent_primary)),
        border: Border { radius: 1.5.into(), ..Border::default() },
        ..container::Style::default()
    });
    let mark =
        pin(stack![container(tint).padding([0.0, GUTTER]).height(ROW_HEIGHT), pin(pill).x(4).y(12)].height(ROW_HEIGHT))
            .y(mark_y)
            .width(Length::Fill)
            .height(Length::Fill);

    let panel = container(stack![
        container(space().width(Length::Fill).height(Length::Fill)).style(move |_| glass(p, dark)),
        mark,
        list,
    ])
    .width(rail.width)
    .height(Length::Fill)
    .clip(true);

    let panel = mouse_area(panel).on_enter((events.rail_hover)(true)).on_exit((events.rail_hover)(false));

    // The Ctrl+N chip beside the widened rail, for the hovered row and the
    // keyboard-focused one. Not hover-only: focus shows it too.
    let mut chips: Vec<Screen> = rail.hover.into_iter().collect();
    if let Some(f) = rail.focus.filter(|f| Some(*f) != rail.hover) {
        chips.push(f);
    }
    let mut layer = stack![panel].width(Length::Fill).height(Length::Fill);
    for s in chips {
        let y = mark_offset(s, content_height);
        layer = layer.push(pin(chip(s, p)).x(rail.width - 4.0).y(y).width(Length::Fill).height(Length::Fill));
    }
    layer.into()
}

fn chip<'a, M: 'a>(screen: Screen, p: &'static Palette) -> Element<'a, M> {
    let label =
        text(format!("Ctrl+{}", screen.index() + 1)).size(11).font(mono(font::Weight::Normal)).color(p.text_muted);
    let boxed = container(label).padding([4, 8]).style(move |_| container::Style {
        background: Some(Background::Color(p.bg_panel)),
        border: Border { color: p.border_subtle, width: 1.0, radius: 6.0.into() },
        shadow: Shadow { color: Color::from_rgba8(0, 0, 0, 0.25), offset: Vector::new(0.0, 10.0), blur_radius: 15.0 },
        ..container::Style::default()
    });
    container(boxed).height(ROW_HEIGHT).align_y(alignment::Vertical::Center).into()
}

fn item<'a, M: Clone + 'a>(rail: Rail<'a>, events: Events<M>, screen: Screen) -> Element<'a, M> {
    let p = rail.palette;
    let active = rail.active == screen;
    let hovered = rail.hover == Some(screen);
    let color = if active {
        p.accent_primary
    } else if hovered {
        p.text_primary
    } else {
        p.text_secondary
    };

    let icon = svg(ICONS[screen.index()].clone())
        .width(ICON_SIZE)
        .height(ICON_SIZE)
        .style(move |_, _| svg::Style { color: Some(color) });
    let label = text(rail.catalog.t(screen.nav_key(), &[]))
        .size(13)
        .line_height(1.15)
        .font(geist(font::Weight::Medium))
        .color(with_alpha(color, rail.label_opacity))
        .width(LABEL_WIDTH);
    // Two lines at most (3.x's line-clamp-2).
    let label = container(label).max_height(2.0 * 13.0 * 1.15 + 0.5).clip(true);

    // One layout in both states (3.x: the row is always its full width and
    // the rail clips it): laid out at ROW_CONTENT_WIDTH even while the rail
    // is 72 px, so the icon stays 20 px and the label never re-wraps, and
    // centred in the 44 px row (3.x's h-11 items-center).
    let body = row![icon, label].spacing(ICON_GAP).height(Length::Fill).align_y(alignment::Vertical::Center);
    let body = overflow(body, ROW_CONTENT_WIDTH).height(Length::Fill);
    let row_button = button(body)
        .padding(Padding { top: 0.0, right: 12.0, bottom: 0.0, left: ICON_INSET })
        .width(Length::Fill)
        .height(ROW_HEIGHT)
        .on_press((events.navigate)(screen))
        .style(move |_, status| {
            let hot = !active && matches!(status, button::Status::Hovered | button::Status::Pressed);
            button::Style {
                background: hot.then_some(Background::Color(p.surface_hover)),
                text_color: color,
                border: Border { radius: RADIUS.into(), ..Border::default() },
                ..button::Style::default()
            }
        });

    let focused = rail.focus == Some(screen);
    let ring = container(space().width(Length::Fill).height(Length::Fill)).style(move |_| container::Style {
        border: Border {
            color: if focused { p.accent_primary } else { Color::TRANSPARENT },
            width: if focused { 2.0 } else { 0.0 },
            radius: RADIUS.into(),
        },
        ..container::Style::default()
    });
    let cell = stack![row_button, ring].width(Length::Fill).height(ROW_HEIGHT);
    mouse_area(cell).on_enter((events.item_hover)(screen, true)).on_exit((events.item_hover)(screen, false)).into()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mark_offset_values() {
        let h = 700.0;
        assert_eq!(mark_offset(Screen::Dashboard, h), 24.0);
        assert_eq!(mark_offset(Screen::DiskMap, h), 76.0);
        assert_eq!(mark_offset(Screen::Applications, h), 128.0);
        assert_eq!(mark_offset(Screen::DeepClean, h), 24.0 + 6.0 * 52.0);
        assert_eq!(mark_offset(Screen::Settings, h), h - 20.0);
        assert_eq!(mark_offset(Screen::Settings, 500.0), 480.0);
    }

    #[test]
    fn settings_row_sits_at_the_bottom() {
        // The Settings row's top is RAIL_PAD + ROW_HEIGHT above the panel's
        // bottom edge; the content box is the panel less RAIL_PAD each side.
        let panel = 800.0;
        let content = panel - 2.0 * RAIL_PAD;
        assert_eq!(mark_offset(Screen::Settings, content), panel - RAIL_PAD - ROW_HEIGHT);
    }

    #[test]
    fn icon_centre_is_x36() {
        assert_eq!(GUTTER + ICON_INSET + ICON_SIZE / 2.0, 36.0);
        assert_eq!(COLLAPSED_WIDTH / 2.0, 36.0);
        // The label fits the expanded row.
        const { assert!(GUTTER + ICON_INSET + ICON_SIZE + 12.0 + LABEL_WIDTH <= EXPANDED_WIDTH - GUTTER) };
    }

    /// Lays one row out the way the rail does, collapsed and expanded, and
    /// checks where its icon and label land: the icon 20×20 with its centre
    /// at x = 36 of the panel, and both centred in the 44 px row.
    #[test]
    fn row_icon_is_full_size_and_centred() {
        use iced::advanced::layout::{Limits, Node};
        use iced::advanced::widget::Tree;
        use iced::{Font, Pixels, Rectangle, Size};

        #[derive(Clone)]
        struct M;
        let catalog = Catalog::load("en");
        let renderer = iced::Renderer::new(Font::DEFAULT, Pixels(16.0));
        // `path` walks child indices from `node`; bounds are relative to the
        // parent, so offsets add up.
        fn at(node: &Node, path: &[usize]) -> Rectangle {
            let mut b = node.bounds();
            let mut n = node;
            for &i in path {
                n = &n.children()[i];
                let c = n.bounds();
                b = Rectangle { x: b.x + c.x, y: b.y + c.y, width: c.width, height: c.height };
            }
            b
        }

        for width in [COLLAPSED_WIDTH, EXPANDED_WIDTH] {
            let rail = Rail {
                active: Screen::Dashboard,
                focus: None,
                hover: None,
                width,
                label_opacity: 1.0,
                mark: mark_anchor(Screen::Dashboard),
                palette: crate::theme::palette(true),
                catalog: &catalog,
            };
            let events = Events { navigate: |_| M, rail_hover: |_| M, item_hover: |_, _| M };
            let mut element: Element<'_, M> = item(rail, events, Screen::Applications);
            let mut tree = Tree::new(element.as_widget());
            // The row's own box: the panel less its 12 px gutters.
            let limits = Limits::new(Size::ZERO, Size::new(width - 2.0 * GUTTER, 1000.0));
            let node = element.as_widget_mut().layout(&mut tree, &renderer, &limits);
            let row = node.bounds();
            assert_eq!((row.width, row.height), (width - 2.0 * GUTTER, ROW_HEIGHT), "rail {width}");

            // mouse_area (its content's node) = stack > [button > overflow >
            // row > [svg, label], ring]
            let icon = at(&node, &[0, 0, 0, 0]);
            let label = at(&node, &[0, 0, 0, 1]);
            assert_eq!((icon.width, icon.height), (ICON_SIZE, ICON_SIZE), "rail {width}: icon {icon:?}");
            assert_eq!(GUTTER + icon.center_x(), 36.0, "rail {width}: icon centre x");
            assert_eq!(icon.center_y(), ROW_HEIGHT / 2.0, "rail {width}: icon centred in the row");
            assert!((label.center_y() - ROW_HEIGHT / 2.0).abs() < 0.5, "rail {width}: label {label:?}");
            assert_eq!(label.width, LABEL_WIDTH, "rail {width}: the label keeps its width, never re-wraps");
        }

        // The mark's pill is 3×20 and centred on the row it marks.
        assert_eq!(12.0 + 20.0 / 2.0, ROW_HEIGHT / 2.0);
    }

    #[test]
    fn icons_match_navrail_jsx() {
        // Every path and shape in NavRail.jsx's ITEMS and SETTINGS_ITEM
        // appears in ours, in order.
        let src = std::fs::read_to_string(
            std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../frontend/src/components/NavRail.jsx"),
        )
        .expect("NavRail.jsx");
        let ours = ICON_BODIES.concat();
        // The report-a-bug beetle after them is an action, not a screen, and
        // Phase 1 has no dialog for it, so it is left out.
        let report = src.find("const REPORT_ICON").expect("REPORT_ICON");
        let theirs: Vec<String> = src[..report]
            .split('<')
            .skip(1)
            .filter(|t| t.starts_with("path ") || t.starts_with("rect ") || t.starts_with("circle "))
            .map(|t| t.split('>').next().unwrap().trim_end().to_owned())
            .collect();
        assert_eq!(theirs.len(), 23, "21 shapes for 7 screens plus the gear's 2");
        let mut at = 0;
        for shape in &theirs {
            let found = ours[at..].find(shape.as_str()).unwrap_or_else(|| panic!("missing {shape}"));
            at += found + shape.len();
        }
        let ours_count =
            ours.matches("<path ").count() + ours.matches("<rect ").count() + ours.matches("<circle ").count();
        assert_eq!(ours_count, theirs.len());
        for s in icon_sources() {
            assert!(s.starts_with("<svg") && s.contains("stroke-width=\"1.8\""));
        }
    }
}
