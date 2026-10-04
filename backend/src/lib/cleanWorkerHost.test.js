import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { runCleanJobInWorker, ABORT_GRACE_MS } from './cleanWorkerHost.js';
import { wipeInProgress } from './cleanerActions/wipeFreeSpace.js';

/** The host's job is the protocol around a worker thread: relaying what it
 * reports in order, turning its failures into rejections, and ending it on
 * Stop. That is tested against a stand-in worker so each case is exact; the
 * real thread, and that its answers equal the in-thread ones, is
 * cleanWorker.integration.test.js. */

class FakeWorker extends EventEmitter {
  constructor(url, options) {
    super();
    this.url = url;
    this.options = options;
    this.posted = [];
    this.terminated = 0;
  }
  postMessage(message) { this.posted.push(message); }
  terminate() { this.terminated++; return Promise.resolve(0); }
  say(message) { this.emit('message', message); }
}

function start(job, options = {}) {
  let worker;
  const promise = runCleanJobInWorker(job, {
    ...options,
    createWorker: (url, opts) => { worker = new FakeWorker(url, opts); return worker; }
  });
  return { promise, worker: () => worker };
}

afterEach(() => { vi.useRealTimers(); });

describe('runCleanJobInWorker', () => {
  it('hands the job to the worker as its workerData', async () => {
    const job = { op: 'scan', guards: { excludeFolders: ['C:\\x'], installedProgramNames: new Set(['a']) } };
    const { promise, worker } = start(job);
    expect(worker().options.workerData).toBe(job);
    worker().say({ type: 'done', summary: {} });
    await promise;
  });

  it('relays rules and progress in the order they were reported, then resolves with the summary', async () => {
    const seen = [];
    const { promise, worker } = start({ op: 'scan' }, {
      onItem: (item) => seen.push(['rule', item.id]),
      onProgress: (progress) => seen.push(['progress', progress.id])
    });
    worker().say({ type: 'progress', progress: { id: 'a' } });
    worker().say({ type: 'rule', item: { id: 'a' } });
    worker().say({ type: 'progress', progress: { id: 'b' } });
    worker().say({ type: 'rule', item: { id: 'b' } });
    worker().say({ type: 'done', summary: { aborted: false, scanned: 2 } });

    expect(await promise).toEqual({ aborted: false, scanned: 2 });
    expect(seen).toEqual([['progress', 'a'], ['rule', 'a'], ['progress', 'b'], ['rule', 'b']]);
  });

  it('ends the worker once it has answered', async () => {
    const { promise, worker } = start({ op: 'scan' });
    worker().say({ type: 'done', summary: {} });
    await promise;
    expect(worker().terminated).toBe(1);
  });

  it('ignores anything the worker says after it has answered', async () => {
    const onItem = vi.fn();
    const { promise, worker } = start({ op: 'scan' }, { onItem });
    worker().say({ type: 'done', summary: { n: 1 } });
    worker().say({ type: 'rule', item: { id: 'late' } });
    worker().say({ type: 'done', summary: { n: 2 } });
    expect(await promise).toEqual({ n: 1 });
    expect(onItem).not.toHaveBeenCalled();
  });

  describe('failures', () => {
    it('rejects with the worker\'s error message', async () => {
      const { promise, worker } = start({ op: 'execute' });
      worker().say({ type: 'error', message: 'Unknown clean job "x".' });
      await expect(promise).rejects.toThrow('Unknown clean job "x".');
      expect(worker().terminated).toBe(1);
    });

    it('rejects when the worker throws outside its job', async () => {
      const { promise, worker } = start({ op: 'scan' });
      worker().emit('error', new Error('module not found'));
      await expect(promise).rejects.toThrow('module not found');
    });

    it('rejects when the thread ends without an answer', async () => {
      const { promise, worker } = start({ op: 'scan' });
      worker().emit('exit', 1);
      await expect(promise).rejects.toThrow(/stopped before it finished.*1/);
    });

    it('rejects, and ends the worker, when relaying a rule throws', async () => {
      const { promise, worker } = start({ op: 'scan' }, { onItem: () => { throw new Error('socket closed'); } });
      worker().say({ type: 'rule', item: { id: 'a' } });
      await expect(promise).rejects.toThrow('socket closed');
      expect(worker().terminated).toBe(1);
    });

    it('rejects when the worker cannot be created at all', async () => {
      await expect(runCleanJobInWorker({ op: 'scan' }, {
        createWorker: () => { throw new Error('DataCloneError'); }
      })).rejects.toThrow('DataCloneError');
    });
  });

  describe('Stop on a scan', () => {
    it('ends the thread at once and resolves as aborted, without waiting for a rule', async () => {
      const controller = new AbortController();
      const { promise, worker } = start({ op: 'scan' }, { signal: controller.signal });
      worker().say({ type: 'rule', item: { id: 'a' } });
      controller.abort();
      expect(await promise).toEqual({ aborted: true });
      expect(worker().terminated).toBe(1);
      expect(worker().posted).toEqual([]);
    });

    it('relays nothing after the Stop', async () => {
      const controller = new AbortController();
      const onItem = vi.fn();
      const { promise, worker } = start({ op: 'scan' }, { signal: controller.signal, onItem });
      controller.abort();
      await promise;
      worker().say({ type: 'rule', item: { id: 'late' } });
      expect(onItem).not.toHaveBeenCalled();
    });

    it('does not start work for a signal that is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();
      const { promise, worker } = start({ op: 'scan' }, { signal: controller.signal });
      expect(await promise).toEqual({ aborted: true });
      expect(worker().terminated).toBe(1);
    });
  });

  describe('Stop on a clean', () => {
    it('asks the worker to stop and lets the rule it is in finish, as the in-thread clean always did', async () => {
      const controller = new AbortController();
      const items = [];
      const { promise, worker } = start({ op: 'execute', ids: ['a', 'b'] }, { signal: controller.signal, onItem: (i) => items.push(i.id) });
      controller.abort();

      expect(worker().posted).toEqual([{ type: 'abort' }]);
      expect(worker().terminated).toBe(0);             // not cut off

      worker().say({ type: 'rule', item: { id: 'a', freedBytes: 5 } });   // the rule in flight completes
      worker().say({ type: 'done', summary: { aborted: true, executed: 1 } });
      expect(await promise).toEqual({ aborted: true, executed: 1 });
      expect(items).toEqual(['a']);
    });

    it('ends the thread anyway if the rule never finishes', async () => {
      vi.useFakeTimers();
      const controller = new AbortController();
      const { promise, worker } = start({ op: 'execute', ids: ['a'] }, { signal: controller.signal, graceMs: 1000 });
      controller.abort();
      await vi.advanceTimersByTimeAsync(999);
      expect(worker().terminated).toBe(0);
      await vi.advanceTimersByTimeAsync(1);
      expect(await promise).toEqual({ aborted: true });
      expect(worker().terminated).toBe(1);
    });

    it('allows a rule a generous time by default', () => {
      expect(ABORT_GRACE_MS).toBeGreaterThanOrEqual(10_000);
    });
  });

  describe('free-space wipe', () => {
    it('lets this thread know a wipe is running in the worker, and that it has ended with the job', async () => {
      const { promise, worker } = start({ op: 'execute', ids: ['wipe'] });
      expect(wipeInProgress()).toBe(false);
      worker().say({ type: 'wipe', running: true });
      expect(wipeInProgress()).toBe(true);
      worker().say({ type: 'wipe', running: false });
      expect(wipeInProgress()).toBe(false);
      worker().say({ type: 'done', summary: {} });
      await promise;
    });

    it('clears the flag when the thread is ended in the middle of a wipe', async () => {
      const controller = new AbortController();
      const { promise, worker } = start({ op: 'scan' }, { signal: controller.signal });
      worker().say({ type: 'wipe', running: true });
      expect(wipeInProgress()).toBe(true);
      controller.abort();
      await promise;
      expect(wipeInProgress()).toBe(false);
    });

    it('clears the flag when the worker dies in the middle of a wipe', async () => {
      const { promise, worker } = start({ op: 'execute', ids: ['wipe'] });
      worker().say({ type: 'wipe', running: true });
      worker().emit('exit', 1);
      await expect(promise).rejects.toThrow();
      expect(wipeInProgress()).toBe(false);
    });
  });
});
