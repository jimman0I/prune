//! Content laid out at a fixed width, shown through a narrower (or equal)
//! window onto it.
//!
//! iced clamps every child to its parent's limits, so a 150 px row inside
//! the collapsed rail's 22 px would be squeezed: icons shrink and labels
//! re-wrap on every frame of the rail's width transition. 3.x lays each row
//! out at its full size in both states and lets the narrow rail clip it;
//! this widget does the same. Outside its own bounds the content sees no
//! cursor, so a row hidden by the clip cannot be hovered or clicked.

use iced::advanced::layout::{self, Layout};
use iced::advanced::widget::{Operation, Tree};
use iced::advanced::{Clipboard, Shell, Widget, overlay, renderer};
use iced::{Element, Event, Length, Rectangle, Size, Vector, mouse};

pub struct Overflow<'a, Message, Theme, Renderer> {
    content: Element<'a, Message, Theme, Renderer>,
    inner_width: f32,
    width: Length,
    height: Length,
}

/// `content` laid out `inner_width` wide, whatever room it is given.
pub fn overflow<'a, Message, Theme, Renderer>(
    content: impl Into<Element<'a, Message, Theme, Renderer>>,
    inner_width: f32,
) -> Overflow<'a, Message, Theme, Renderer> {
    Overflow { content: content.into(), inner_width, width: Length::Fill, height: Length::Shrink }
}

impl<'a, Message, Theme, Renderer> Overflow<'a, Message, Theme, Renderer> {
    pub fn width(mut self, width: impl Into<Length>) -> Self {
        self.width = width.into();
        self
    }

    pub fn height(mut self, height: impl Into<Length>) -> Self {
        self.height = height.into();
        self
    }
}

fn visible(cursor: mouse::Cursor, bounds: Rectangle) -> mouse::Cursor {
    if cursor.is_over(bounds) { cursor } else { mouse::Cursor::Unavailable }
}

impl<Message, Theme, Renderer> Widget<Message, Theme, Renderer> for Overflow<'_, Message, Theme, Renderer>
where
    Renderer: renderer::Renderer,
{
    fn children(&self) -> Vec<Tree> {
        vec![Tree::new(&self.content)]
    }

    fn diff(&self, tree: &mut Tree) {
        tree.diff_children(std::slice::from_ref(&self.content));
    }

    fn size(&self) -> Size<Length> {
        Size::new(self.width, self.height)
    }

    fn layout(&mut self, tree: &mut Tree, renderer: &Renderer, limits: &layout::Limits) -> layout::Node {
        let limits = limits.width(self.width).height(self.height);
        let inner = layout::Limits::new(Size::ZERO, Size::new(self.inner_width, limits.max().height));
        let node = self.content.as_widget_mut().layout(&mut tree.children[0], renderer, &inner);
        let size = limits.resolve(self.width, self.height, node.size());
        layout::Node::with_children(size, vec![node])
    }

    fn operate(&mut self, tree: &mut Tree, layout: Layout<'_>, renderer: &Renderer, operation: &mut dyn Operation) {
        let child = layout.children().next().expect("one child");
        self.content.as_widget_mut().operate(&mut tree.children[0], child, renderer, operation);
    }

    fn update(
        &mut self,
        tree: &mut Tree,
        event: &Event,
        layout: Layout<'_>,
        cursor: mouse::Cursor,
        renderer: &Renderer,
        clipboard: &mut dyn Clipboard,
        shell: &mut Shell<'_, Message>,
        viewport: &Rectangle,
    ) {
        let child = layout.children().next().expect("one child");
        self.content.as_widget_mut().update(
            &mut tree.children[0],
            event,
            child,
            visible(cursor, layout.bounds()),
            renderer,
            clipboard,
            shell,
            viewport,
        );
    }

    fn mouse_interaction(
        &self,
        tree: &Tree,
        layout: Layout<'_>,
        cursor: mouse::Cursor,
        viewport: &Rectangle,
        renderer: &Renderer,
    ) -> mouse::Interaction {
        let child = layout.children().next().expect("one child");
        self.content.as_widget().mouse_interaction(
            &tree.children[0],
            child,
            visible(cursor, layout.bounds()),
            viewport,
            renderer,
        )
    }

    fn draw(
        &self,
        tree: &Tree,
        renderer: &mut Renderer,
        theme: &Theme,
        style: &renderer::Style,
        layout: Layout<'_>,
        cursor: mouse::Cursor,
        viewport: &Rectangle,
    ) {
        let bounds = layout.bounds();
        let Some(clip) = bounds.intersection(viewport) else { return };
        let child = layout.children().next().expect("one child");
        renderer.with_layer(clip, |renderer| {
            self.content.as_widget().draw(
                &tree.children[0],
                renderer,
                theme,
                style,
                child,
                visible(cursor, bounds),
                &clip,
            );
        });
    }

    fn overlay<'b>(
        &'b mut self,
        tree: &'b mut Tree,
        layout: Layout<'b>,
        renderer: &Renderer,
        viewport: &Rectangle,
        translation: Vector,
    ) -> Option<overlay::Element<'b, Message, Theme, Renderer>> {
        let child = layout.children().next().expect("one child");
        self.content.as_widget_mut().overlay(&mut tree.children[0], child, renderer, viewport, translation)
    }
}

impl<'a, Message: 'a, Theme: 'a, Renderer> From<Overflow<'a, Message, Theme, Renderer>>
    for Element<'a, Message, Theme, Renderer>
where
    Renderer: renderer::Renderer + 'a,
{
    fn from(o: Overflow<'a, Message, Theme, Renderer>) -> Self {
        Element::new(o)
    }
}
