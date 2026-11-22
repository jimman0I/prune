//! The teal washes behind every screen, as 3.x paints them in
//! `frontend/src/index.css` (`body::before` and `body::after`).
//!
//! 3.x draws four radial gradients over the whole window. They drift slowly
//! there, except with reduced motion or low power, where they hold still at
//! their unmoved position. 4.0 draws that still frame: a moving backdrop
//! would redraw the whole window for as long as Prune is open, and the 0 %
//! idle CPU target rules that out.
//!
//! iced has no radial gradient, so the washes are computed here: all four
//! layers blended in floating point over the ground, then rounded to 8 bits
//! once, with an ordered dither. The washes are a few colour steps deep over
//! hundreds of pixels, so plain rounding shows rings, and rounding each
//! layer on its own (as an SVG renderer does) adds a criss-cross of stripes
//! where the rings cross; Chrome dithers its gradients, so 3.x shows
//! neither. The field is smooth, so it is computed at half the window's
//! logical size and drawn scaled up without filtering, which keeps the
//! dither intact: about 1 MB for the default window. It is computed once
//! per window size and kept until the size or theme changes.

use std::cell::RefCell;

use iced::advanced::image::{self, FilterMethod};
use iced::advanced::layout::{self, Layout};
use iced::advanced::widget::{Tree, tree};
use iced::advanced::{Widget, renderer};
use iced::{Color, Element, Length, Rectangle, Size, mouse};

/// One `radial-gradient(circle at X Y, colour, transparent STOP)`.
struct Wash {
    at: (f32, f32),
    colour: usize,
    stop: f32,
}

/// In paint order, bottom first. Within one `background-image` the first
/// gradient is on top, and `body::after` is painted over `body::before`.
const WASHES: [Wash; 4] = [
    Wash { at: (0.90, 0.90), colour: 2, stop: 0.45 },
    Wash { at: (0.90, 0.15), colour: 1, stop: 0.40 },
    Wash { at: (0.10, 0.10), colour: 0, stop: 0.45 },
    Wash { at: (0.25, 0.85), colour: 1, stop: 0.42 },
];

/// The washes laid out for one window size.
struct Field {
    bg: Color,
    /// Centre x, centre y, radius at the stop, colour.
    washes: [(f32, f32, f32, Color); 4],
}

impl Field {
    fn new(bg: Color, size: Size, colours: [Color; 3]) -> Self {
        let (w, h) = (size.width.max(1.0), size.height.max(1.0));
        let washes = WASHES.map(|wash| {
            let (cx, cy) = (wash.at.0 * w, wash.at.1 * h);
            // `circle` with no size is `farthest-corner`.
            let far = [(0.0, 0.0), (w, 0.0), (0.0, h), (w, h)]
                .iter()
                .map(|&(x, y): &(f32, f32)| ((x - cx).powi(2) + (y - cy).powi(2)).sqrt())
                .fold(0.0_f32, f32::max);
            (cx, cy, (far * wash.stop).max(f32::EPSILON), colours[wash.colour])
        });
        Self { bg, washes }
    }

    /// Each wash's opacity falls linearly from its centre to its stop (CSS
    /// interpolates to `transparent` premultiplied, which is the same thing
    /// for one colour), laid over the ground bottom first.
    fn at(&self, (x, y): (f32, f32)) -> [f32; 3] {
        let mut out = [self.bg.r, self.bg.g, self.bg.b];
        for &(cx, cy, r, c) in &self.washes {
            let d = ((x - cx).powi(2) + (y - cy).powi(2)).sqrt();
            let a = c.a * (1.0 - d / r).clamp(0.0, 1.0);
            if a > 0.0 {
                out = [c.r * a + out[0] * (1.0 - a), c.g * a + out[1] * (1.0 - a), c.b * a + out[2] * (1.0 - a)];
            }
        }
        out
    }
}

/// The colour 3.x shows at `point` of a `size` window whose ground is `bg`,
/// before rounding. The render tests check the drawn window against this.
pub fn colour_at(bg: Color, size: Size, point: (f32, f32), colours: [Color; 3]) -> Color {
    let [r, g, b] = Field::new(bg, size, colours).at(point);
    Color { r, g, b, a: 1.0 }
}

/// 4x4 Bayer thresholds, 0..16.
const BAYER: [[u8; 4]; 4] = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

/// One logical pixel's worth of the window per this many samples, each way.
const STEP: f32 = 2.0;

/// The washes over `bg` for a `size` window, as RGBA rows of
/// `ceil(width / STEP)` x `ceil(height / STEP)` samples, each taken at the
/// centre of the block it stands for.
pub fn pixels(bg: Color, size: Size, colours: [Color; 3]) -> (u32, u32, Vec<u8>) {
    let field = Field::new(bg, size, colours);
    let w = (size.width / STEP).ceil().max(1.0) as u32;
    let h = (size.height / STEP).ceil().max(1.0) as u32;
    let mut out = Vec::with_capacity((w * h * 4) as usize);
    for j in 0..h {
        for i in 0..w {
            let c = field.at(((i as f32 + 0.5) * STEP, (j as f32 + 0.5) * STEP));
            let t = (f32::from(BAYER[(j % 4) as usize][(i % 4) as usize]) + 0.5) / 16.0;
            for v in c {
                out.push((v * 255.0 + t).floor().clamp(0.0, 255.0) as u8);
            }
            out.push(255);
        }
    }
    (w, h, out)
}

/// Fills its space with the washes over `bg`. Put it at the bottom of a stack.
pub struct Aurora {
    bg: Color,
    colours: [Color; 3],
}

pub fn aurora(bg: Color, colours: [Color; 3]) -> Aurora {
    Aurora { bg, colours }
}

/// The last pixels made, and what they were made for.
struct Pixels {
    size: Size,
    bg: Color,
    colours: [Color; 3],
    handle: image::Handle,
}

#[derive(Default)]
struct Made(RefCell<Option<Pixels>>);

impl<Message, Theme, Renderer> Widget<Message, Theme, Renderer> for Aurora
where
    Renderer: renderer::Renderer + image::Renderer<Handle = image::Handle>,
{
    fn tag(&self) -> tree::Tag {
        tree::Tag::of::<Made>()
    }

    fn state(&self) -> tree::State {
        tree::State::new(Made::default())
    }

    fn size(&self) -> Size<Length> {
        Size::new(Length::Fill, Length::Fill)
    }

    fn layout(&mut self, _tree: &mut Tree, _renderer: &Renderer, limits: &layout::Limits) -> layout::Node {
        layout::Node::new(limits.width(Length::Fill).height(Length::Fill).max())
    }

    fn draw(
        &self,
        tree: &Tree,
        renderer: &mut Renderer,
        _theme: &Theme,
        _style: &renderer::Style,
        layout: Layout<'_>,
        _cursor: mouse::Cursor,
        viewport: &Rectangle,
    ) {
        let bounds = layout.bounds();
        let Some(clip) = bounds.intersection(viewport) else { return };
        let made = &tree.state.downcast_ref::<Made>().0;
        let mut made = made.borrow_mut();
        let size = bounds.size();
        let fresh = matches!(&*made, Some(m) if m.size == size && m.bg == self.bg && m.colours == self.colours);
        if !fresh {
            let (w, h, rgba) = pixels(self.bg, size, self.colours);
            let handle = image::Handle::from_rgba(w, h, rgba);
            *made = Some(Pixels { size, bg: self.bg, colours: self.colours, handle });
        }
        let Some(Pixels { handle, .. }) = &*made else { return };
        // Nearest: filtering would blend the dither back into bands.
        let img = image::Image::new(handle.clone()).filter_method(FilterMethod::Nearest);
        // The samples cover ceil(size / STEP) * STEP, a pixel past an odd edge.
        let w = (size.width / STEP).ceil() * STEP;
        let h = (size.height / STEP).ceil() * STEP;
        renderer.draw_image(img, Rectangle { width: w, height: h, ..bounds }, clip);
    }
}

impl<'a, Message, Theme, Renderer> From<Aurora> for Element<'a, Message, Theme, Renderer>
where
    Renderer: renderer::Renderer + image::Renderer<Handle = image::Handle> + 'a,
{
    fn from(a: Aurora) -> Self {
        Element::new(a)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const BG: Color = Color { r: 9.0 / 255.0, g: 9.0 / 255.0, b: 11.0 / 255.0, a: 1.0 };
    const TEAL: Color = Color { r: 24.0 / 255.0, g: 169.0 / 255.0, b: 194.0 / 255.0, a: 0.16 };

    #[test]
    fn full_strength_at_a_centre_falling_off_outwards() {
        let size = Size::new(1000.0, 500.0);
        // (10 %, 10 %) is the top-left wash's centre; the other washes add
        // little there.
        let c = colour_at(BG, size, (100.0, 50.0), [TEAL; 3]);
        let want = TEAL.g * 0.16 + BG.g * 0.84;
        assert!((c.g - want).abs() < 0.02, "{c:?}");
        let near = colour_at(BG, size, (120.0, 60.0), [TEAL; 3]);
        let far = colour_at(BG, size, (400.0, 200.0), [TEAL; 3]);
        assert!(near.g > far.g, "{near:?} {far:?}");
    }

    #[test]
    fn dither_averages_to_the_true_colour() {
        // A flat field (no washes) must come out as the ground, every pixel.
        let clear = Color { a: 0.0, ..TEAL };
        let (w, h, px) = pixels(BG, Size::new(40.0, 40.0), [clear; 3]);
        assert_eq!((w, h), (20, 20));
        assert!(px.chunks(4).all(|p| p == [9, 9, 11, 255]), "{:?}", &px[..8]);
        // Over a 4x4 block the dither's mean is the unrounded value.
        let v = 0.5 / 255.0 + 20.0 / 255.0; // halfway between 20 and 21
        let half = Color { r: v, g: v, b: v, a: 1.0 };
        let (_, _, px) = pixels(half, Size::new(8.0, 8.0), [clear; 3]);
        let mean: f32 = px.chunks(4).map(|p| f32::from(p[0])).sum::<f32>() / 16.0;
        assert!((mean - 20.5).abs() < 0.01, "{mean}");
    }

    #[test]
    fn odd_sizes_round_the_sample_grid_up() {
        let (w, h, px) = pixels(BG, Size::new(1263.0, 851.0), [TEAL; 3]);
        assert_eq!((w, h), (632, 426));
        assert_eq!(px.len(), (632 * 426 * 4) as usize);
    }
}
