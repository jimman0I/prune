//! The Win32 half: process tree, windows, memory, CPU time, image path.

use std::collections::{HashMap, HashSet};
use std::ffi::c_void;

use windows::Win32::Foundation::{CloseHandle, FILETIME, HANDLE, HWND, LPARAM};
use windows::Win32::Storage::FileSystem::{GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW};
use windows::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, PROCESSENTRY32W, Process32FirstW, Process32NextW, TH32CS_SNAPPROCESS,
};
use windows::Win32::System::ProcessStatus::{
    GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS, PROCESS_MEMORY_COUNTERS_EX,
};
use windows::Win32::System::Threading::{
    GetProcessTimes, OpenProcess, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_TERMINATE,
    QueryFullProcessImageNameW, TerminateProcess,
};
use windows::Win32::UI::WindowsAndMessaging::{EnumWindows, GetWindowThreadProcessId, IsWindowVisible};
use windows::core::{BOOL, PCWSTR, PWSTR};

/// `(pid, parent pid)` for every process.
pub fn snapshot() -> Vec<(u32, u32)> {
    let mut out = Vec::new();
    unsafe {
        let Ok(h) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) else {
            return out;
        };
        let mut e = PROCESSENTRY32W { dwSize: size_of::<PROCESSENTRY32W>() as u32, ..Default::default() };
        if Process32FirstW(h, &mut e).is_ok() {
            loop {
                out.push((e.th32ProcessID, e.th32ParentProcessID));
                if Process32NextW(h, &mut e).is_err() {
                    break;
                }
            }
        }
        let _ = CloseHandle(h);
    }
    out
}

/// Pids whose executable file name is `name` (lower-case compare), however
/// privileged the process is.
pub fn pids_named(name: &str) -> Vec<u32> {
    let mut out = Vec::new();
    unsafe {
        let Ok(h) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) else {
            return out;
        };
        let mut e = PROCESSENTRY32W { dwSize: size_of::<PROCESSENTRY32W>() as u32, ..Default::default() };
        if Process32FirstW(h, &mut e).is_ok() {
            loop {
                let n = &e.szExeFile;
                let len = n.iter().position(|&c| c == 0).unwrap_or(n.len());
                if String::from_utf16_lossy(&n[..len]).to_lowercase() == name {
                    out.push(e.th32ProcessID);
                }
                if Process32NextW(h, &mut e).is_err() {
                    break;
                }
            }
        }
        let _ = CloseHandle(h);
    }
    out
}

/// `root` and every descendant, by parent links. Works after `root` has
/// exited: its children keep the parent id they were started with.
pub fn tree(root: u32) -> HashSet<u32> {
    let procs = snapshot();
    let mut set = HashSet::from([root]);
    loop {
        let before = set.len();
        for &(pid, parent) in &procs {
            if pid != 0 && set.contains(&parent) {
                set.insert(pid);
            }
        }
        if set.len() == before {
            return set;
        }
    }
}

/// A pid that is not in the process list is gone (the tree helper keeps
/// the root id in the set even after it exits).
pub fn alive(pids: &HashSet<u32>) -> HashSet<u32> {
    let live: HashSet<u32> = snapshot().into_iter().map(|(p, _)| p).collect();
    pids.intersection(&live).copied().collect()
}

struct Owned(HANDLE);
impl Drop for Owned {
    fn drop(&mut self) {
        unsafe {
            let _ = CloseHandle(self.0);
        }
    }
}

fn open(pid: u32, access: windows::Win32::System::Threading::PROCESS_ACCESS_RIGHTS) -> Option<Owned> {
    unsafe { OpenProcess(access, false, pid).ok().map(Owned) }
}

/// Lower-cased full image path, `None` when the process cannot be opened
/// (an elevated process from a limited one).
pub fn image_path(pid: u32) -> Option<String> {
    let h = open(pid, PROCESS_QUERY_LIMITED_INFORMATION)?;
    let mut buf = vec![0u16; 1024];
    let mut len = buf.len() as u32;
    unsafe { QueryFullProcessImageNameW(h.0, PROCESS_NAME_WIN32, PWSTR(buf.as_mut_ptr()), &mut len).ok()? };
    Some(String::from_utf16_lossy(&buf[..len as usize]).to_lowercase())
}

/// Every running process whose image is exactly `exe` (lower-cased).
pub fn pids_with_image(exe_lower: &str) -> Vec<u32> {
    snapshot().into_iter().map(|(p, _)| p).filter(|&p| image_path(p).is_some_and(|i| i == exe_lower)).collect()
}

struct Probe<'a> {
    pids: &'a HashSet<u32>,
    found: bool,
}

unsafe extern "system" fn each_window(hwnd: HWND, lparam: LPARAM) -> BOOL {
    unsafe {
        let probe = &mut *(lparam.0 as *mut Probe);
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if probe.pids.contains(&pid) && IsWindowVisible(hwnd).as_bool() {
            probe.found = true;
            return BOOL(0);
        }
    }
    BOOL(1)
}

/// Is there a visible top-level window owned by any of `pids`?
pub fn has_visible_window(pids: &HashSet<u32>) -> bool {
    let mut probe = Probe { pids, found: false };
    unsafe {
        // Stopping the enumeration early makes EnumWindows return an error.
        let _ = EnumWindows(Some(each_window), LPARAM(&mut probe as *mut Probe as isize));
    }
    probe.found
}

/// `(working set bytes, private bytes)` of one process.
pub fn memory(pid: u32) -> Option<(u64, u64)> {
    let h = open(pid, PROCESS_QUERY_LIMITED_INFORMATION)?;
    let mut c = PROCESS_MEMORY_COUNTERS_EX { cb: size_of::<PROCESS_MEMORY_COUNTERS_EX>() as u32, ..Default::default() };
    unsafe {
        GetProcessMemoryInfo(h.0, &mut c as *mut _ as *mut PROCESS_MEMORY_COUNTERS, c.cb).ok()?;
    }
    Some((c.WorkingSetSize as u64, c.PrivateUsage as u64))
}

fn ft(f: FILETIME) -> u64 {
    (u64::from(f.dwHighDateTime) << 32) | u64::from(f.dwLowDateTime)
}

/// Kernel + user time in 100 ns units.
pub fn cpu_time(pid: u32) -> Option<u64> {
    let h = open(pid, PROCESS_QUERY_LIMITED_INFORMATION)?;
    let (mut c, mut e, mut k, mut u) =
        (FILETIME::default(), FILETIME::default(), FILETIME::default(), FILETIME::default());
    unsafe { GetProcessTimes(h.0, &mut c, &mut e, &mut k, &mut u).ok()? };
    Some(ft(k) + ft(u))
}

/// CPU time of every pid that can be read, keyed by pid.
pub fn cpu_times(pids: &HashSet<u32>) -> HashMap<u32, u64> {
    pids.iter().filter_map(|&p| cpu_time(p).map(|t| (p, t))).collect()
}

/// Terminate each pid; returns how many could not be terminated.
pub fn kill(pids: &HashSet<u32>) -> usize {
    let mut failed = 0;
    for &p in pids {
        match open(p, PROCESS_TERMINATE) {
            Some(h) => unsafe {
                if TerminateProcess(h.0, 1).is_err() {
                    failed += 1;
                }
            },
            None => failed += 1,
        }
    }
    failed
}

/// The product version of an exe as `3.2.0`, from its version resource.
pub fn file_version(path: &str) -> Option<String> {
    let wide: Vec<u16> = path.encode_utf16().chain(Some(0)).collect();
    unsafe {
        let size = GetFileVersionInfoSizeW(PCWSTR(wide.as_ptr()), None);
        if size == 0 {
            return None;
        }
        let mut data = vec![0u8; size as usize];
        GetFileVersionInfoW(PCWSTR(wide.as_ptr()), None, size, data.as_mut_ptr() as *mut c_void).ok()?;
        let mut ptr: *mut c_void = std::ptr::null_mut();
        let mut len = 0u32;
        let root: Vec<u16> = "\\".encode_utf16().chain(Some(0)).collect();
        if !VerQueryValueW(data.as_ptr() as *const c_void, PCWSTR(root.as_ptr()), &mut ptr, &mut len).as_bool()
            || ptr.is_null()
            || (len as usize) < 20
        {
            return None;
        }
        // VS_FIXEDFILEINFO: dwProductVersionMS/LS are the 5th and 6th u32.
        let words = ptr as *const u32;
        let (ms, ls) = (*words.add(4), *words.add(5));
        let (a, b, c, d) = (ms >> 16, ms & 0xffff, ls >> 16, ls & 0xffff);
        Some(if d == 0 { format!("{a}.{b}.{c}") } else { format!("{a}.{b}.{c}.{d}") })
    }
}
