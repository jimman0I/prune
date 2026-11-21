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
    use super::{Claim, decode, encode};
    use std::fs::{File, OpenOptions};
    use std::io::{Read, Write};
    use std::os::windows::io::FromRawHandle;
    use std::time::{Duration, Instant};

    use iced::futures::channel::mpsc;
    use windows::Win32::Foundation::{
        CloseHandle, ERROR_ALREADY_EXISTS, ERROR_NO_DATA, ERROR_PIPE_CONNECTED, GetLastError, HANDLE, HLOCAL, LocalFree,
    };
    use windows::Win32::Security::Authorization::{
        ConvertSidToStringSidW, ConvertStringSecurityDescriptorToSecurityDescriptorW, SDDL_REVISION_1,
    };
    use windows::Win32::Security::{
        GetTokenInformation, PSECURITY_DESCRIPTOR, SECURITY_ATTRIBUTES, TOKEN_QUERY, TOKEN_USER, TokenUser,
    };
    use windows::Win32::Storage::FileSystem::{FILE_FLAG_FIRST_PIPE_INSTANCE, PIPE_ACCESS_INBOUND};
    use windows::Win32::System::Pipes::{
        ConnectNamedPipe, CreateNamedPipeW, PIPE_READMODE_BYTE, PIPE_REJECT_REMOTE_CLIENTS, PIPE_TYPE_BYTE,
        PIPE_UNLIMITED_INSTANCES, PIPE_WAIT, PeekNamedPipe,
    };
    use windows::Win32::System::RemoteDesktop::ProcessIdToSessionId;
    use windows::Win32::System::Threading::{CreateMutexW, GetCurrentProcess, GetCurrentProcessId, OpenProcessToken};
    use windows::Win32::UI::WindowsAndMessaging::{ASFW_ANY, AllowSetForegroundWindow};
    use windows::core::{HSTRING, PWSTR};

    /// How long a second launch keeps trying to reach a first that is still
    /// starting up (its mutex exists, its pipe not yet).
    const CONNECT_PATIENCE: Duration = Duration::from_millis(1500);
    /// A later launch's command line is a few paths at most.
    const MAX_MESSAGE: usize = 64 * 1024;
    /// A client gets this long to send its command line and close.
    pub const READ_TIMEOUT: Duration = Duration::from_secs(2);
    /// Tries, 100 ms apart, at creating a pipe instance before giving up.
    const CREATE_ATTEMPTS: u32 = 5;

    pub fn pipe_path(pipe: &str) -> String {
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

    pub fn hand_over(path: &str, args: &[String]) -> bool {
        // Let the first instance take the foreground: Windows only allows
        // it for the process the person just started, which is this one.
        // SAFETY: plain call.
        let _ = unsafe { AllowSetForegroundWindow(ASFW_ANY) };
        let deadline = Instant::now() + CONNECT_PATIENCE;
        loop {
            match OpenOptions::new().write(true).open(path) {
                Ok(mut pipe) => return pipe.write_all(&encode(args)).is_ok(),
                Err(_) if Instant::now() < deadline => std::thread::sleep(Duration::from_millis(25)),
                Err(_) => return false,
            }
        }
    }

    /// The SID string of the user this process runs as. An elevated Prune
    /// and a normal launch by the same person share it.
    pub fn user_sid() -> Option<String> {
        // SAFETY: the token handle and buffer are locals, closed and freed
        // here; the SID string is freed with LocalFree as documented.
        unsafe {
            let mut token = HANDLE::default();
            OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token).ok()?;
            let mut len = 0u32;
            let _ = GetTokenInformation(token, TokenUser, None, 0, &mut len);
            let mut buf = vec![0u64; (len as usize).div_ceil(8)];
            let got = GetTokenInformation(token, TokenUser, Some(buf.as_mut_ptr().cast()), len, &mut len);
            let _ = CloseHandle(token);
            got.ok()?;
            let user = &*(buf.as_ptr() as *const TOKEN_USER);
            let mut text = PWSTR::null();
            ConvertSidToStringSidW(user.User.Sid, &mut text).ok()?;
            let sid = text.to_string().ok();
            let _ = LocalFree(Some(HLOCAL(text.0.cast())));
            sid
        }
    }

    /// The pipe's access list, as SDDL: SYSTEM and Administrators in full,
    /// and the person's own account read and write. Without it an elevated
    /// Prune's pipe gets the elevated token's default list, which leaves the
    /// person's normal (non-elevated) launches out, so a Start menu or
    /// Explorer launch could not reach an "always as administrator" Prune.
    pub fn pipe_sddl(user_sid: &str) -> String {
        format!("D:P(A;;GA;;;SY)(A;;GA;;;BA)(A;;GRGW;;;{user_sid})")
    }

    /// The security descriptor for every pipe instance, made once and kept
    /// for the life of the process (as an address: it is never freed).
    fn pipe_security() -> Option<usize> {
        let sddl = pipe_sddl(&user_sid()?);
        let mut sd = PSECURITY_DESCRIPTOR::default();
        // SAFETY: `sd` receives a LocalAlloc'd descriptor, deliberately leaked.
        unsafe {
            ConvertStringSecurityDescriptorToSecurityDescriptorW(&HSTRING::from(sddl), SDDL_REVISION_1, &mut sd, None)
                .ok()?;
        }
        Some(sd.0 as usize)
    }

    pub fn listen(path: String) -> mpsc::UnboundedReceiver<Vec<String>> {
        let (tx, rx) = mpsc::unbounded();
        let name = HSTRING::from(path.as_str());
        let security = pipe_security();
        if security.is_none() {
            eprintln!("single-instance: no pipe security descriptor; using the default");
        }
        // The first instance of the pipe is created before claim() returns,
        // so a launch right after this one always finds it. As a plain
        // number: a HANDLE is a pointer, which is not Send.
        let Some(first) = create_with_retries(&name, true, security) else {
            eprintln!("single-instance: not listening on {path}; later launches will not reach this one");
            return rx;
        };
        let spawned = std::thread::Builder::new().name("single-instance".into()).spawn(move || {
            let mut current = first;
            loop {
                let handle = HANDLE(current as *mut core::ffi::c_void);
                let ok = accept(handle);
                // The next instance exists before this client is served, so a
                // client that never finishes cannot keep others out.
                let next = create_with_retries(&name, false, security);
                if ok {
                    let tx = tx.clone();
                    let _ = std::thread::Builder::new().name("single-instance-client".into()).spawn(move || {
                        if let Some(args) = serve(current, READ_TIMEOUT) {
                            let _ = tx.unbounded_send(args);
                        }
                    });
                } else {
                    // SAFETY: we own `handle` and nothing else uses it.
                    let _ = unsafe { CloseHandle(handle) };
                }
                if tx.is_closed() {
                    return;
                }
                match next {
                    Some(n) => current = n,
                    None => {
                        eprintln!("single-instance: pipe {path} lost; later launches will not reach this one");
                        return;
                    }
                }
            }
        });
        if spawned.is_err() {
            eprintln!("single-instance: could not start the listener thread");
        }
        rx
    }

    /// Waits for a client on `handle`. A client that connected before the
    /// wait (ERROR_PIPE_CONNECTED) counts, and so does one that already
    /// wrote and closed (ERROR_NO_DATA): its bytes are still in the pipe.
    pub fn accept(handle: HANDLE) -> bool {
        // SAFETY: `handle` is a pipe instance this process created.
        match unsafe { ConnectNamedPipe(handle, None) } {
            Ok(()) => true,
            Err(e) => e.code() == ERROR_PIPE_CONNECTED.to_hresult() || e.code() == ERROR_NO_DATA.to_hresult(),
        }
    }

    /// Reads one client's command line and closes the instance. A client
    /// that has not finished by `timeout` is dropped without blocking
    /// anyone: the read polls instead of waiting on the pipe.
    pub fn serve(raw: usize, timeout: Duration) -> Option<Vec<String>> {
        let handle = HANDLE(raw as *mut core::ffi::c_void);
        // SAFETY: we own `handle`; File closes it on drop.
        let mut file = unsafe { File::from_raw_handle(handle.0) };
        let deadline = Instant::now() + timeout;
        let mut bytes = Vec::new();
        loop {
            let mut available = 0u32;
            // SAFETY: out-pointer to a local; no data buffer.
            let peek = unsafe { PeekNamedPipe(handle, None, 0, None, Some(&mut available), None) };
            match peek {
                // The client closed its end and everything has been read.
                Err(_) => return Some(decode(&bytes)),
                Ok(()) if available > 0 => {
                    let want = (available as usize).min(MAX_MESSAGE + 1 - bytes.len());
                    let start = bytes.len();
                    bytes.resize(start + want, 0);
                    let n = file.read(&mut bytes[start..]).ok()?;
                    bytes.truncate(start + n);
                    if bytes.len() > MAX_MESSAGE {
                        return None;
                    }
                }
                Ok(()) if Instant::now() >= deadline => return None,
                Ok(()) => std::thread::sleep(Duration::from_millis(10)),
            }
        }
    }

    fn create_with_retries(name: &HSTRING, first: bool, security: Option<usize>) -> Option<usize> {
        for attempt in 1..=CREATE_ATTEMPTS {
            match create(name, first, security) {
                Ok(h) => return Some(h.0 as usize),
                Err(e) => {
                    eprintln!("single-instance: creating pipe {name} (attempt {attempt}): {e}");
                    if attempt < CREATE_ATTEMPTS {
                        std::thread::sleep(Duration::from_millis(100));
                    }
                }
            }
        }
        None
    }

    pub fn create(name: &HSTRING, first: bool, security: Option<usize>) -> windows::core::Result<HANDLE> {
        let mut open = PIPE_ACCESS_INBOUND;
        if first {
            // Fail rather than share a pipe someone else made first.
            open |= FILE_FLAG_FIRST_PIPE_INSTANCE;
        }
        let attributes = security.map(|sd| SECURITY_ATTRIBUTES {
            nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: sd as *mut core::ffi::c_void,
            bInheritHandle: false.into(),
        });
        // SAFETY: valid name; `attributes` outlives the call and points at a
        // descriptor that is never freed.
        let handle = unsafe {
            CreateNamedPipeW(
                name,
                open,
                PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS,
                PIPE_UNLIMITED_INSTANCES,
                0,
                4096,
                0,
                attributes.as_ref().map(|a| a as *const SECURITY_ATTRIBUTES),
            )
        };
        if handle.is_invalid() { Err(windows::core::Error::from_thread()) } else { Ok(handle) }
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

    #[cfg(windows)]
    fn unique_pipe(tag: &str) -> String {
        imp::pipe_path(&format!("prune-test-{tag}-{}-{:?}", std::process::id(), std::thread::current().id()))
    }

    #[cfg(windows)]
    fn next_within(
        rx: &mut iced::futures::channel::mpsc::UnboundedReceiver<Vec<String>>,
        timeout: std::time::Duration,
    ) -> Option<Vec<String>> {
        let deadline = std::time::Instant::now() + timeout;
        loop {
            if let Ok(v) = rx.try_recv() {
                return Some(v);
            }
            if std::time::Instant::now() > deadline {
                return None;
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
    }

    /// The pipe carries an explicit access list naming this user, so a
    /// non-elevated launch reaches an elevated Prune (whose default list
    /// would grant only SYSTEM and Administrators).
    #[cfg(windows)]
    #[test]
    fn pipe_grants_the_current_user_explicitly() {
        use windows::Win32::Foundation::{HLOCAL, LocalFree};
        use windows::Win32::Security::Authorization::{
            ConvertSecurityDescriptorToStringSecurityDescriptorW, GetSecurityInfo, SDDL_REVISION_1, SE_KERNEL_OBJECT,
        };
        use windows::Win32::Security::{DACL_SECURITY_INFORMATION, PSECURITY_DESCRIPTOR};
        use windows::core::{HSTRING, PWSTR};

        let sid = imp::user_sid().expect("this process's user SID");
        assert!(sid.starts_with("S-1-"), "{sid}");
        assert!(imp::pipe_sddl(&sid).contains(&format!("(A;;GRGW;;;{sid})")));

        let path = unique_pipe("acl");
        let mut rx = imp::listen(path.clone());
        // Read the live pipe's DACL back from a second instance made the same way.
        let sddl = imp::pipe_sddl(&sid);
        let mut sd = PSECURITY_DESCRIPTOR::default();
        // SAFETY: out-pointer; freed below.
        unsafe {
            windows::Win32::Security::Authorization::ConvertStringSecurityDescriptorToSecurityDescriptorW(
                &HSTRING::from(sddl),
                SDDL_REVISION_1,
                &mut sd,
                None,
            )
            .unwrap();
        }
        let handle = imp::create(&HSTRING::from(path.as_str()), false, Some(sd.0 as usize))
            .expect("pipe with the explicit descriptor");
        let mut got = PSECURITY_DESCRIPTOR::default();
        let mut text = PWSTR::null();
        // SAFETY: out-pointers; everything is freed or closed below.
        let dacl = unsafe {
            let err = GetSecurityInfo(
                handle,
                SE_KERNEL_OBJECT,
                DACL_SECURITY_INFORMATION,
                None,
                None,
                None,
                None,
                Some(&mut got),
            );
            assert!(err.is_ok(), "{err:?}");
            ConvertSecurityDescriptorToStringSecurityDescriptorW(
                got,
                SDDL_REVISION_1,
                DACL_SECURITY_INFORMATION,
                &mut text,
                None,
            )
            .unwrap();
            let s = text.to_string().unwrap();
            let _ = LocalFree(Some(HLOCAL(text.0.cast())));
            let _ = LocalFree(Some(HLOCAL(got.0)));
            let _ = LocalFree(Some(HLOCAL(sd.0)));
            let _ = windows::Win32::Foundation::CloseHandle(handle);
            s
        };
        // Windows writes some users with a short alias instead of the SID (the
        // built-in Administrator, which CI runs as, becomes "LA"). Put the SID
        // through the same conversion as the owner of a descriptor to get the
        // form the DACL text uses.
        let trustee = {
            let mut owner_sd = PSECURITY_DESCRIPTOR::default();
            let mut owner_text = PWSTR::null();
            // SAFETY: out-pointers; both freed below.
            unsafe {
                windows::Win32::Security::Authorization::ConvertStringSecurityDescriptorToSecurityDescriptorW(
                    &HSTRING::from(format!("O:{sid}")),
                    SDDL_REVISION_1,
                    &mut owner_sd,
                    None,
                )
                .unwrap();
                ConvertSecurityDescriptorToStringSecurityDescriptorW(
                    owner_sd,
                    SDDL_REVISION_1,
                    windows::Win32::Security::OWNER_SECURITY_INFORMATION,
                    &mut owner_text,
                    None,
                )
                .unwrap();
                let s = owner_text.to_string().unwrap();
                let _ = LocalFree(Some(HLOCAL(owner_text.0.cast())));
                let _ = LocalFree(Some(HLOCAL(owner_sd.0)));
                s.trim_start_matches("O:").to_owned()
            }
        };
        assert!(dacl.contains(&format!(";;;{trustee})")), "the pipe's DACL names this user ({trustee}): {dacl}");
        assert!(dacl.starts_with("D:P"), "protected, not inherited: {dacl}");

        // And a client can still hand over through it.
        assert!(imp::hand_over(&path, &["Prune.exe".into(), "--shred".into()]));
        let got = next_within(&mut rx, std::time::Duration::from_secs(2));
        assert_eq!(got, Some(vec!["Prune.exe".to_owned(), "--shred".to_owned()]));
    }

    /// A launch can connect, write and close before the listener gets round
    /// to `ConnectNamedPipe` on that instance (it is busy starting a reader
    /// for the previous one). Windows then reports ERROR_NO_DATA, but the
    /// command line is still in the pipe and must be read, not dropped.
    #[cfg(windows)]
    #[test]
    fn a_client_that_closed_before_connect_is_still_read() {
        use std::io::Write;
        use windows::core::HSTRING;
        let path = unique_pipe("early");
        let handle = imp::create(&HSTRING::from(path.as_str()), true, None).expect("pipe");
        {
            let mut client = std::fs::OpenOptions::new().write(true).open(&path).expect("connect");
            client.write_all(&encode(&["Prune.exe".to_owned(), "--x".to_owned()])).unwrap();
        }
        assert!(imp::accept(handle), "connected, even though the client already left");
        assert_eq!(
            imp::serve(handle.0 as usize, imp::READ_TIMEOUT),
            Some(vec!["Prune.exe".to_owned(), "--x".to_owned()])
        );
    }

    /// A client that connects and never closes does not keep the next
    /// launch out, and is dropped after the read timeout.
    #[cfg(windows)]
    #[test]
    fn a_stuck_client_does_not_block_the_listener() {
        use std::io::Write;
        let path = unique_pipe("stuck");
        let mut rx = imp::listen(path.clone());
        let mut stuck = std::fs::OpenOptions::new().write(true).open(&path).expect("connect");
        stuck.write_all(b"half").unwrap();

        let started = std::time::Instant::now();
        assert!(imp::hand_over(&path, &["Prune.exe".into()]));
        let got = next_within(&mut rx, std::time::Duration::from_secs(1));
        assert_eq!(got, Some(vec!["Prune.exe".to_owned()]));
        assert!(started.elapsed() < std::time::Duration::from_secs(1));

        // After the timeout the stuck client's end is closed under it.
        std::thread::sleep(imp::READ_TIMEOUT + std::time::Duration::from_millis(300));
        assert!(stuck.write_all(b"more").and_then(|_| stuck.flush()).is_err(), "dropped");
        assert_eq!(
            next_within(&mut rx, std::time::Duration::from_millis(100)),
            None,
            "its half message is not delivered"
        );
    }

    #[test]
    fn start_minimized_launch_does_not_reveal() {
        let v = |a: &[&str]| a.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        assert!(should_reveal(&v(&["Prune.exe"])));
        assert!(!should_reveal(&v(&["Prune.exe", "--start-minimized"])));
        assert!(should_reveal(&v(&["--start-minimized"])), "argv[0] is never a flag");
    }
}
