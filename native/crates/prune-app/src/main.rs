use iced::widget::space;
use iced::Element;

#[derive(Default)]
struct Prune;

#[derive(Debug, Clone)]
enum Message {}

impl Prune {
    fn update(&mut self, message: Message) {
        match message {}
    }

    fn view(&self) -> Element<'_, Message> {
        space().into()
    }
}

fn main() -> iced::Result {
    iced::application(Prune::default, Prune::update, Prune::view)
        .title("Prune")
        .run()
}
