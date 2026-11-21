// A release build is a GUI program: no console window behind it.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use std::time::Instant;

use iced::{font, theme};
use prune_app::app::{App, Startup};
use prune_app::single_instance::{self, Claim};
use prune_app::{motion, screen, window_state};
use prune_core::settings;

fn view(app: &App, _window: iced::window::Id) -> iced::Element<'_, prune_app::app::Message> {
    app.view()
}

fn main() -> iced::Result {
    let started = Instant::now();
    let args: Vec<String> = std::env::args().collect();
    // A render needs no window and must not claim the single-instance
    // mutex, so it runs beside a Prune that is open.
    if let Some(parsed) = prune_app::render::parse_args(&args) {
        prune_app::render::attach_console();
        let code = match parsed {
            Ok((dir, options)) => prune_app::render::run(&dir, &options),
            Err(e) => {
                eprintln!("{e}");
                2
            }
        };
        std::process::exit(code);
    }
    let later_launches = match single_instance::claim(&args) {
        Claim::First(rx) => rx,
        // The running Prune has been told; this launch is done.
        Claim::Second => return Ok(()),
    };

    let state_path = window_state::path();
    let startup = Startup {
        settings: settings::load(&settings::settings_path()),
        window_state: window_state::load(&state_path),
        window_state_path: Some(state_path),
        os_light: prune_app::theme::os_prefers_light(),
        reduced_motion: motion::reduced_motion(),
        trace_startup: (std::env::var_os("PRUNE_TRACE_STARTUP").is_some_and(|v| v == "1")).then_some(started),
    };
    // iced asks for a boot function it may call more than once in
    // principle; it runs once, and takes the startup state when it does.
    let tray_commands = prune_app::tray::install_event_forwarding();
    let once = Mutex::new(Some((startup, later_launches, tray_commands)));
    let boot = move || {
        let (startup, rx, tray_rx) = once.lock().ok().and_then(|mut g| g.take()).unwrap_or_else(|| {
            (
                Startup::default(),
                iced::futures::channel::mpsc::unbounded().1,
                iced::futures::channel::mpsc::unbounded().1,
            )
        });
        App::boot(startup, rx, tray_rx)
    };

    let mut program = iced::daemon(boot, App::update, view)
        .title(|_: &App, _| String::from("Prune"))
        .subscription(App::subscription)
        .scale_factor(|app: &App, _| app.scale_factor())
        .theme(|app: &App, _| if app.is_dark() { iced::Theme::Dark } else { iced::Theme::Light })
        .style(|app: &App, _| theme::Style {
            background_color: app.palette().bg_base,
            text_color: app.palette().text_primary,
        })
        .default_font(screen::geist(font::Weight::Normal));
    for bytes in prune_app::theme::font_bytes() {
        program = program.font(bytes);
    }
    program.run()
}
