import { cpus, freemem, totalmem } from 'node:os';
import { spawn } from 'node:child_process';
import { cpuTotals, cpuPercentBetween } from '../lib/cpuUsage.js';

/** Live CPU, memory and disk throughput.
 *
 * Two of these are free and one is not, and the difference decided the
 * whole design. CPU and memory come from os.cpus()/freemem() in
 * microseconds. Disk throughput has no Node API at all on Windows, and
 * the obvious answers were measured before anything was built:
 *
 *   Get-Counter, one shot        1684 ms
 *   Get-CimInstance perf data    5884 ms
 *
 * Polling either on a two-second gauge means PowerShell running most of
 * the time -- a resource monitor that measurably degrades the machine it
 * is monitoring. So there is exactly ONE PowerShell process, started
 * lazily, streaming `-Continuous` samples: 1.7 seconds once, then a real
 * reading every second for free.
 *
 * It stops when nobody is looking. The Dashboard stays mounted after a
 * tab switch, so "visible" is not a signal Prune can use -- but a request
 * arriving is, and the stream shuts itself down when they stop coming.
 */

/** No reader for this long and the disk stream shuts down. Comfortably
 * more than the widget's poll interval, so an ordinary gap never kills
 * and restarts it. */
const IDLE_SHUTDOWN_MS = 20_000;

const DISK_COUNTER = String.raw`\PhysicalDisk(_Total)\Disk Bytes/sec`;

let previousCpu = null;
let diskChild = null;
let diskBytesPerSec = null;
let lastRead = 0;
let idleTimer = null;

function startDiskStream() {
  if (diskChild) return;

  const script =
    `Get-Counter '${DISK_COUNTER}' -Continuous -SampleInterval 1 | ` +
    'ForEach-Object { [Console]::Out.WriteLine([math]::Round($_.CounterSamples[0].CookedValue)); [Console]::Out.Flush() }';

  try {
    diskChild = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true
    });
  } catch {
    diskChild = null;
    return;
  }

  let buffer = '';
  diskChild.stdout?.on('data', (chunk) => {
    buffer += chunk.toString();
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      const value = Number(line);
      if (Number.isFinite(value) && value >= 0) diskBytesPerSec = value;
    }
  });

  // A counter that will not start is a missing reading, never an error
  // that reaches the screen. The other two gauges are unaffected by it.
  const stop = () => { diskChild = null; diskBytesPerSec = null; };
  diskChild.on('error', stop);
  diskChild.on('exit', stop);
  diskChild.unref?.();
}

export function stopDiskStream() {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  if (diskChild) {
    const child = diskChild;
    diskChild = null;
    diskBytesPerSec = null;
    try { child.kill(); } catch { /* already gone */ }
  }
}

function armIdleShutdown() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (Date.now() - lastRead >= IDLE_SHUTDOWN_MS) stopDiskStream();
  }, IDLE_SHUTDOWN_MS);
  idleTimer.unref?.();
}

/** One reading of everything.
 *
 * Every field can be null, and null means "no answer yet" rather than
 * zero. The distinction matters most on the very first call: CPU needs
 * two readings to have a percentage at all, and reporting 0% would draw
 * an idle machine at exactly the moment someone is deciding whether it is
 * a good time to start a scan. */
export function readResources() {
  lastRead = Date.now();
  startDiskStream();
  armIdleShutdown();

  const current = cpuTotals(cpus());
  const cpuPercent = cpuPercentBetween(previousCpu, current);
  previousCpu = current;

  const ramTotal = totalmem();
  const ramFree = freemem();
  const ramUsed = ramTotal - ramFree;

  return {
    cpuPercent,
    ram: {
      usedBytes: ramUsed,
      totalBytes: ramTotal,
      percent: ramTotal > 0 ? Math.round((ramUsed / ramTotal) * 100) : null
    },
    // Null until the stream's first sample lands, about two seconds after
    // the widget first asks.
    diskBytesPerSec,
    cores: cpus().length
  };
}
