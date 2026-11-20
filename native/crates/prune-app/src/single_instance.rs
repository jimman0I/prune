//! One Prune per Windows session.
//!
//! The first process owns the named mutex `Local\Prune-4-single-instance`
//! and listens on a named pipe. A later launch finds the mutex taken, sends
//! its command line down the pipe, lets the first take the foreground and
//! exits 0, as 3.x's `requestSingleInstanceLock` + `second-instance` do. The
//! first brings its window back unless the launch was the silent
//! `--start-minimized` one (3.x's `shouldRevealForSecondInstance`).
//!
//! A profile moved by `UNREVO_SETTINGS_PATH` (tests, a second dev profile)
//! gets its own mutex and pipe, the way Electron keys its lock by the
//! profile directory, so it never hands over to an unrelated Prune.

/// 3.x's `--start-minimized`.
pub const START_MINIMIZED_FLAG: &str = "--start-minimized";

/// Whether a second launch with this command line should bring the window
/// back. `args[0]` is the program and never a flag.
pub fn should_reveal(args: &[String]) -> bool {
    !args.iter().skip(1).any(|a| a == START_MINIMIZED_FLAG)
}

/// The mutex name, and a suffix shared with the pipe.
pub fn names(settings_override: Option<&std::ffi::OsStr>) -> (String, String) {
    let base = "Prune-4-single-instance";
    let suffix = settings_override.map(|p| format!("-{:016x}", fnv1a(p.to_string_lossy().to_lowercase().as_bytes())));
    let suffix = suffix.unwrap_or_default();
    (format!("Local\\{base}{suffix}"), format!("{base}{suffix}"))
}

fn fnv1a(bytes: &[u8]) -> u64 {
    bytes.iter().fold(0xcbf2_9ce4_8422_2325, |h, b| (h ^ u64::from(*b)).wrapping_mul(0x0100_0000_01b3))
}

/// Arguments on the wire: UTF-8, each one ended by a NUL.
pub fn encode(args: &[String]) -> Vec<u8> {
    let mut out = Vec::new();
    for a in args {
        out.extend_from_slice(a.as_bytes());
        out.push(0);
    }
    out
}

pub fn decode(bytes: &[u8]) -> Vec<String> {
    bytes.split(|b| *b == 0).filter(|s| !s.is_empty()).map(|s| String::from_utf8_lossy(s).into_owned()).collect()
}

/// What this process is.
pub enum Claim {
    /// The only Prune: these messages are later launches' arguments.
    First(iced::futures::channel::mpsc::UnboundedReceiver<Vec<String>>),
    /// Another Prune has the session and has been told.
    Second,
}

#[cfg(windows)]
mod imp {
    use super::{Claim, encode, decode};
    use std::fs::{File, OpenOptions};
    use std::io::{Read, Write};
    use std::os::windows::io::FromRawHandle;
    use std::time::{Duration, Instant};

    use iced::futures::channel::mpsc;
    use windows::Win32::Foundation::{ERROR_ALREADY_EXISTS, ERROR_PIPE_CONNECTED, GetLastError, INVALID_HANDLE_VALUE};
    use windows::Win32::Storage::FileSystem::{FILE_FLAG_FIRST_PIPE_INSTANCE, PIPE_ACCESS_INBOUND};
    use windows::Win32::System::Pipes::{
        ConnectNamedPipe, CreateNamedPipeW, PIPE_READMODE_BYTE, PIPE_REJECT_REMOTE_CLIENTS, PIPE_TYPE_BYTE,
        PIPE_UNLIMITED_INSTANCES, PIPE_WAIT,
    };
    use windows::Win32::System::RemoteDesktop::ProcessIdToSessionId;
    use windows::Win32::System::Threading::{CreateMutexW, GetCurrentProcessId};
    use windows::Win32::UI::WindowsAndMessaging::{ASFW_ANY, AllowSetForegroundWindow};
    use windows::core::HSTRING;

    /// How long a second launch keeps trying to reach a first that is still
    /// starting up (its mutex exists, its pipe not yet).
    const CONNECT_PATIENCE: Duration = Duration::from_millis(1500);
    /// A later launch's command line is a few paths at most.
    const MAX_MESSAGE: u64 = 64 * 1024;

    fn pipe_path(pipe: &str) -> String {
        let mut session = 0u32;
        // SAFETY: out-pointer to a local.
        let _ = unsafe { ProcessIdToSessionId(GetCurrentProcessId(), &mut session) };
        format!(r"\\.\pipe\{pipe}-{session}")
    }

    pub fn claim(mutex: &str, pipe: &str, args: &[String]) -> Claim {
        // SAFETY: plain call; the handle is deliberately kept open for the
        // life of the process, which is what holds the claim.
        let owned = unsafe { CreateMutexW(None, false, &HSTRING::from(mutex)) };
        // SAFETY: read straight after the call that set it.
        let existed = unsafe { GetLastError() } == ERROR_ALREADY_EXISTS;
        let path = pipe_path(pipe);
        match owned {
            Ok(_) if !existed => Claim::First(listen(path)),
            // Taken, or the name is unusable: hand over (or give up) and go.
            _ => {
                hand_over(&path, args);
                Claim::Second
            }
        }
    }

    fn hand_over(path: &str, args: &[String]) {
        // Let the first instance take the foreground: Windows only allows
        // it for the process the person just started, which is this one.
        // SAFETY: plain call.
        let _ = unsafe { AllowSetForegroundWindow(ASFW_ANY) };
        let deadline = Instant::now() + CONNECT_PATIENCE;
        loop {
            match OpenOptions::new().write(true).open(path) {
                Ok(mut pipe) => {
                    let _ = pipe.write_all(&encode(args));
                    return;
                }
                Err(_) if Instant::now() < deadline => std::thread::sleep(Duration::from_millis(25)),
                Err(_) => return,
            }
        }
    }

    fn listen(path: String) -> mpsc::UnboundedReceiver<Vec<String>> {
        let (tx, rx) = mpsc::unbounded();
        let name = HSTRING::from(path);
        // The first instance of the pipe is created here, before claim()
        // returns, so a launch right after this one always finds it.
        // As a plain number: a HANDLE is a pointer, which is not Send.
        let mut next = create(&name, true).map(|h| h.0 as isize);
        std::thread::Builder::new()
            .name("single-instance".into())
            .spawn(move || {
                while let Some(raw) = next {
                    let handle = windows::Win32::Foundation::HANDLE(raw as *mut core::ffi::c_void);
                    // SAFETY: `handle` is the pipe created above.
                    let connected = unsafe { ConnectNamedPipe(handle, None) };
                    let ok = connected.is_ok() || connected.as_ref().is_err_and(|e| e.code() == ERROR_PIPE_CONNECTED.to_hresult());
                    // SAFETY: we own `handle`; File closes it on drop.
                    let mut file = unsafe { File::from_raw_handle(handle.0) };
                    if ok {
                        let mut bytes = Vec::new();
                        let _ = (&mut file).take(MAX_MESSAGE).read_to_end(&mut bytes);
                        if tx.unbounded_send(decode(&bytes)).is_err() {
                            return;
                        }
                    }
                    drop(file);
                    next = create(&name, false).map(|h| h.0 as isize);
                }
            })
            .expect("spawn the single-instance listener");
        rx
    }

    fn create(name: &HSTRING, first: bool) -> Option<windows::Win32::Foundation::HANDLE> {
        let mut open = PIPE_ACCESS_INBOUND;
        if first {
            // Fail rather than share a pipe someone else made first.
            open |= FILE_FLAG_FIRST_PIPE_INSTANCE;
        }
        // SAFETY: plain call with a valid name.
        let handle = unsafe {
            CreateNamedPipeW(
                name,
                open,
                PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS,
                PIPE_UNLIMITED_INSTANCES,
                0,
                4096,
                0,
                None,
            )
        };
        (handle != INVALID_HANDLE_VALUE && !handle.is_invalid()).then_some(handle)
    }
}

/// Claims the session for this process, or hands `args` to the Prune that
/// already has it.
#[cfg(windows)]
pub fn claim(args: &[String]) -> Claim {
    let over = std::env::var_os("UNREVO_SETTINGS_PATH").filter(|p| !p.is_empty());
    let (mutex, pipe) = names(over.as_deref());
    imp::claim(&mutex, &pipe, args)
}

#[cfg(not(windows))]
pub fn claim(_args: &[String]) -> Claim {
    Claim::First(iced::futures::channel::mpsc::unbounded().1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_are_3x_style_and_profile_scoped() {
        let (mutex, pipe) = names(None);
        assert_eq!(mutex, r"Local\Prune-4-single-instance");
        assert_eq!(pipe, "Prune-4-single-instance");
        let a = names(Some(std::ffi::OsStr::new(r"C:\Temp\A\settings.json")));
        let a2 = names(Some(std::ffi::OsStr::new(r"c:\temp\a\SETTINGS.json")));
        let b = names(Some(std::ffi::OsStr::new(r"C:\Temp\B\settings.json")));
        assert_eq!(a, a2, "paths are case-insensitive on Windows");
        assert_ne!(a, b);
        assert!(a.0.starts_with(r"Local\Prune-4-single-instance-"));
    }

    #[test]
    fn args_round_trip() {
        let args = vec!["Prune.exe".to_owned(), "--shred".to_owned(), r"C:\a b\ü.txt".to_owned()];
        assert_eq!(decode(&encode(&args)), args);
        assert_eq!(decode(b""), Vec::<String>::new());
    }

    #[test]
    fn start_minimized_launch_does_not_reveal() {
        let v = |a: &[&str]| a.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        assert!(should_reveal(&v(&["Prune.exe"])));
        assert!(!should_reveal(&v(&["Prune.exe", "--start-minimized"])));
        assert!(should_reveal(&v(&["--start-minimized"])), "argv[0] is never a flag");
    }
}
