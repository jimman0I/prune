//! The Win32 half: the job the measured app runs in, windows, memory, CPU
//! time, image path.
//!
//! The measured process tree is a job object, not a walk of parent process
//! ids. A parent id is only a number: once the parent exits, Windows can
//! hand the same id to an unrelated process, and a tree built from parent
//! links would take that process in (and kill it). A job's members are
//! tracked by the kernel, everything the app starts joins it from its
//! first instruction, and the whole tree is killed in one call.

use std::collections::HashSet;
use std::ffi::c_void;
use std::io;
use std::os::windows::io::AsRawHandle;
use std::os::windows::process::CommandExt;
use std::process::{Child, Command};
use std::time::{Duration, Instant};

use windows::Win32::Foundation::{CloseHandle, HANDLE, HWND, LPARAM};
use windows::Win32::Graphics::Dwm::{DWMWA_CLOAKED, DwmGetWindowAttribute};
use windows::Win32::Storage::FileSystem::{GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW};
use windows::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, PROCESSENTRY32W, Process32FirstW, Process32NextW, TH32CS_SNAPPROCESS, TH32CS_SNAPTHREAD,
    THREADENTRY32, Thread32First, Thread32Next,
};
use windows::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, IsProcessInJob, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    JOBOBJECT_BASIC_ACCOUNTING_INFORMATION, JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JobObjectBasicAccountingInformation,
    JobObjectBasicProcessIdList, JobObjectExtendedLimitInformation, QueryInformationJobObject, SetInformationJobObject,
    TerminateJobObject,
};
use windows::Win32::System::ProcessStatus::{
    GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS, PROCESS_MEMORY_COUNTERS_EX,
};
use windows::Win32::System::Threading::{
    CREATE_SUSPENDED, OpenProcess, OpenThread, PROCESS_ACCESS_RIGHTS, PROCESS_NAME_WIN32,
    PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_TERMINATE, QueryFullProcessImageNameW, ResumeThread,
    THREAD_SUSPEND_RESUME, TerminateProcess,
};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GWL_EXSTYLE, GetWindowLongW, GetWindowThreadProcessId, IsWindowVisible, WS_EX_TOOLWINDOW,
};
use windows::core::{BOOL, PCWSTR, PWSTR};

/// Every process id, with its executable's file name.
fn processes() -> Vec<(u32, String)> {
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
                out.push((e.th32ProcessID, String::from_utf16_lossy(&n[..len])));
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
    processes().into_iter().filter(|(_, n)| n.to_lowercase() == name).map(|(p, _)| p).collect()
}

struct Owned(HANDLE);
impl Drop for Owned {
    fn drop(&mut self) {
        unsafe {
            let _ = CloseHandle(self.0);
        }
    }
}

fn open(pid: u32, access: PROCESS_ACCESS_RIGHTS) -> Option<Owned> {
    unsafe { OpenProcess(access, false, pid).ok().map(Owned) }
}

/// Lower-cased full image path of an open process.
fn image_of(h: &Owned) -> Option<String> {
    let mut buf = vec![0u16; 1024];
    let mut len = buf.len() as u32;
    unsafe { QueryFullProcessImageNameW(h.0, PROCESS_NAME_WIN32, PWSTR(buf.as_mut_ptr()), &mut len).ok()? };
    Some(String::from_utf16_lossy(&buf[..len as usize]).to_lowercase())
}

/// Every running process whose image is exactly `exe` (lower-cased). A
/// process that cannot be opened (an elevated one, from a limited session)
/// has no readable path and is not listed.
pub fn pids_with_image(exe_lower: &str) -> Vec<u32> {
    processes()
        .into_iter()
        .map(|(p, _)| p)
        .filter(|&p| {
            open(p, PROCESS_QUERY_LIMITED_INFORMATION).and_then(|h| image_of(&h)).is_some_and(|i| i == exe_lower)
        })
        .collect()
}

/// Terminates every process whose image is exactly `exe` (lower-cased) and
/// nothing else: the path is read from the same handle that terminates, so
/// a process id reused in between cannot be hit. Returns how many matched
/// and how many of those could not be terminated.
pub fn kill_image(exe_lower: &str) -> (usize, usize) {
    let (mut matched, mut failed) = (0, 0);
    for (p, _) in processes() {
        let Some(h) = open(p, PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_TERMINATE) else { continue };
        if image_of(&h).is_some_and(|i| i == exe_lower) {
            matched += 1;
            if unsafe { TerminateProcess(h.0, 1) }.is_err() {
                failed += 1;
            }
        }
    }
    (matched, failed)
}

/// The job one measured launch runs in.
pub struct Job(Owned);

impl Job {
    /// A new job that kills everything in it when its handle closes, so an
    /// early exit or a panic of this tool never leaves the app running.
    pub fn new() -> io::Result<Job> {
        unsafe {
            let job = Job(Owned(CreateJobObjectW(None, PCWSTR::null())?));
            let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
            limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            SetInformationJobObject(
                job.0.0,
                JobObjectExtendedLimitInformation,
                &limits as *const _ as *const c_void,
                size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            )?;
            Ok(job)
        }
    }

    /// Starts `cmd` suspended, puts it in the job, then lets it run: it and
    /// everything it starts are in the job before any of its code runs. The
    /// launch error (an elevation-required manifest, say) is `cmd.spawn()`'s.
    ///
    /// Also returns how long the process was held suspended: finding its
    /// thread to resume takes a snapshot of every thread on the machine
    /// (tens of ms; std does not hand out the thread handle), time in which
    /// the app has not started, so the caller takes it off its clock.
    pub fn spawn(&self, cmd: &mut Command) -> io::Result<(Child, Duration)> {
        let mut child = cmd.creation_flags(CREATE_SUSPENDED.0).spawn()?;
        let held = Instant::now();
        let joined = unsafe { AssignProcessToJobObject(self.0.0, HANDLE(child.as_raw_handle())) };
        let started = joined.map_err(io::Error::other).and_then(|()| resume(child.id()));
        let held = held.elapsed();
        if let Err(e) = started {
            let _ = child.kill();
            let _ = child.wait();
            return Err(e);
        }
        Ok((child, held))
    }

    /// The ids of the processes in the job now.
    pub fn pids(&self) -> HashSet<u32> {
        // JOBOBJECT_BASIC_PROCESS_ID_LIST: two u32 counts, then the ids.
        let mut buf = vec![0usize; 2 + 1024];
        let ok = unsafe {
            QueryInformationJobObject(
                Some(self.0.0),
                JobObjectBasicProcessIdList,
                buf.as_mut_ptr() as *mut c_void,
                (buf.len() * size_of::<usize>()) as u32,
                None,
            )
        };
        if ok.is_err() {
            return HashSet::new();
        }
        let listed = unsafe { *(buf.as_ptr() as *const u32).add(1) } as usize;
        // The ids start at the struct's `ProcessIdList`, 8 bytes in.
        let ids = &buf[8 / size_of::<usize>()..];
        ids[..listed.min(ids.len())].iter().map(|&p| p as u32).collect()
    }

    fn accounting(&self) -> JOBOBJECT_BASIC_ACCOUNTING_INFORMATION {
        let mut info = JOBOBJECT_BASIC_ACCOUNTING_INFORMATION::default();
        let _ = unsafe {
            QueryInformationJobObject(
                Some(self.0.0),
                JobObjectBasicAccountingInformation,
                &mut info as *mut _ as *mut c_void,
                size_of::<JOBOBJECT_BASIC_ACCOUNTING_INFORMATION>() as u32,
                None,
            )
        };
        info
    }

    /// Kernel + user time of everything that has run in the job, exited
    /// processes included, in 100 ns units.
    pub fn cpu_time(&self) -> u64 {
        let a = self.accounting();
        (a.TotalUserTime.max(0) + a.TotalKernelTime.max(0)) as u64
    }

    /// How many processes in the job are still running.
    pub fn active(&self) -> u32 {
        self.accounting().ActiveProcesses
    }

    /// `(working set bytes, private bytes)` summed over the job's processes.
    /// Each is checked to still be in the job on the handle it is read from.
    pub fn memory(&self) -> (u64, u64) {
        let (mut ws, mut private) = (0, 0);
        for p in self.pids() {
            let Some(h) = open(p, PROCESS_QUERY_LIMITED_INFORMATION) else { continue };
            let mut member = BOOL(0);
            if unsafe { IsProcessInJob(h.0, Some(self.0.0), &mut member) }.is_err() || !member.as_bool() {
                continue;
            }
            if let Some((w, pr)) = memory_of(&h) {
                ws += w;
                private += pr;
            }
        }
        (ws, private)
    }

    /// Kills everything in the job.
    pub fn terminate(&self) {
        let _ = unsafe { TerminateJobObject(self.0.0, 1) };
    }
}

/// Resumes the threads of a process created suspended (its first thread).
fn resume(pid: u32) -> io::Result<()> {
    let mut resumed = 0;
    unsafe {
        let snap = CreateToolhelp32Snapshot(TH32CS_SNAPTHREAD, 0).map_err(io::Error::other)?;
        let snap = Owned(snap);
        let mut e = THREADENTRY32 { dwSize: size_of::<THREADENTRY32>() as u32, ..Default::default() };
        if Thread32First(snap.0, &mut e).is_ok() {
            loop {
                if e.th32OwnerProcessID == pid
                    && let Ok(t) = OpenThread(THREAD_SUSPEND_RESUME, false, e.th32ThreadID)
                {
                    let t = Owned(t);
                    if ResumeThread(t.0) != u32::MAX {
                        resumed += 1;
                    }
                }
                if Thread32Next(snap.0, &mut e).is_err() {
                    break;
                }
            }
        }
    }
    if resumed == 0 { Err(io::Error::other(format!("could not resume process {pid}"))) } else { Ok(()) }
}

struct Probe<'a> {
    pids: &'a HashSet<u32>,
    found: bool,
}

/// A window a person can see: visible, not cloaked (DWM draws nothing of a
/// cloaked window) and not a tool window. winit's message window is a
/// visible, transparent 16x16 tool window, there from the first moments of
/// startup; counting it would time that window instead of the app's.
unsafe fn seen(hwnd: HWND) -> bool {
    unsafe {
        if !IsWindowVisible(hwnd).as_bool() || GetWindowLongW(hwnd, GWL_EXSTYLE) as u32 & WS_EX_TOOLWINDOW.0 != 0 {
            return false;
        }
        let mut cloaked = 0u32;
        let _ = DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, &mut cloaked as *mut u32 as *mut c_void, 4);
        cloaked == 0
    }
}

unsafe extern "system" fn each_window(hwnd: HWND, lparam: LPARAM) -> BOOL {
    unsafe {
        let probe = &mut *(lparam.0 as *mut Probe);
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if probe.pids.contains(&pid) && seen(hwnd) {
            probe.found = true;
            return BOOL(0);
        }
    }
    BOOL(1)
}

/// Is there a top-level window a person can see owned by any of `pids`?
pub fn has_visible_window(pids: &HashSet<u32>) -> bool {
    let mut probe = Probe { pids, found: false };
    unsafe {
        // Stopping the enumeration early makes EnumWindows return an error.
        let _ = EnumWindows(Some(each_window), LPARAM(&mut probe as *mut Probe as isize));
    }
    probe.found
}

/// `(working set bytes, private bytes)` of one open process.
fn memory_of(h: &Owned) -> Option<(u64, u64)> {
    let mut c = PROCESS_MEMORY_COUNTERS_EX { cb: size_of::<PROCESS_MEMORY_COUNTERS_EX>() as u32, ..Default::default() };
    unsafe {
        GetProcessMemoryInfo(h.0, &mut c as *mut _ as *mut PROCESS_MEMORY_COUNTERS, c.cb).ok()?;
    }
    Some((c.WorkingSetSize as u64, c.PrivateUsage as u64))
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_job_holds_the_whole_tree_and_kills_it() {
        let job = Job::new().unwrap();
        // cmd starts ping: a child of the launched process.
        let mut cmd = Command::new("cmd.exe");
        cmd.args(["/c", "ping -n 30 127.0.0.1 >nul"]);
        let (mut child, _held) = job.spawn(&mut cmd).unwrap();
        let deadline = Instant::now() + Duration::from_secs(10);
        while job.active() < 2 && Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(20));
        }
        let pids = job.pids();
        assert_eq!(pids.len(), 2, "cmd and ping: {pids:?}");
        assert!(pids.contains(&child.id()));
        assert!(job.memory().0 > 0, "memory is read from the members");
        job.terminate();
        let _ = child.wait();
        let deadline = Instant::now() + Duration::from_secs(10);
        while job.active() > 0 && Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(20));
        }
        assert_eq!(job.active(), 0, "nothing of the tree is left");
        assert!(job.pids().is_empty());
    }

    #[test]
    fn kill_image_touches_only_that_exact_path() {
        // The same program under a path of its own, beside the original.
        let dir = std::env::temp_dir().join(format!("prune-measure-kill-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let system = std::path::PathBuf::from(std::env::var("SystemRoot").unwrap()).join(r"System32\PING.EXE");
        let copy = dir.join("ping-copy.exe");
        std::fs::copy(&system, &copy).unwrap();
        let ping = |exe: &std::path::Path| {
            Command::new(exe).args(["-n", "30", "127.0.0.1"]).stdout(std::process::Stdio::null()).spawn().unwrap()
        };
        let (mut target, mut other) = (ping(&copy), ping(&system));
        let lower = copy.to_string_lossy().to_lowercase();
        assert_eq!(pids_with_image(&lower), vec![target.id()]);

        assert_eq!(kill_image(&lower), (1, 0));
        let _ = target.wait();
        assert!(other.try_wait().unwrap().is_none(), "the same program at another path is left alone");
        let _ = other.kill();
        let _ = other.wait();
        assert_eq!(kill_image(&lower), (0, 0), "nothing left to match");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
