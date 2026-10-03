const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  SHRED_FLAG, FIND_FLAG, OPEN_REQUEST_CHANNEL, OPEN_REQUEST_READY_CHANNEL,
  isAcceptablePath, parseOpenRequest, createOpenRequestRelay
} = require('./explorerRequests.cjs');

/* Requests that arrive on the command line: Explorer's right-click entries run
 * `Prune.exe --shred "<path>"` and `Prune.exe --find-program "<path>"`
 * (backend/src/services/explorerMenu.js). Whatever is on a command line is
 * untrusted input, so what is held still here is how strictly it is read: an
 * absolute path, a sane length, no control characters, at most one request --
 * and that a request is only ever a request to SHOW something, never to do it. */

const EXE = 'C:\\Users\\me\\AppData\\Local\\Programs\\Prune\\Prune.exe';

test('the two flags and the two channels are fixed, and the menu writes the same flags', () => {
  assert.equal(SHRED_FLAG, '--shred');
  assert.equal(FIND_FLAG, '--find-program');
  assert.equal(OPEN_REQUEST_CHANNEL, 'prune:open-request');
  assert.equal(OPEN_REQUEST_READY_CHANNEL, 'prune:open-request:ready');
});

test('accepts an absolute drive path and nothing that merely resembles one', () => {
  for (const good of ['C:\\Users\\me\\old.docx', 'D:\\Old files\\secrets (1).txt', 'c:\\a', 'E:\\', 'C:\\Users\\me\\Ünï\\ファイル.txt']) {
    assert.equal(isAcceptablePath(good), true, good);
  }
  for (const bad of [
    '', 'C:', 'C:foo', 'foo\\bar', '\\\\server\\share\\a.txt', '/etc/passwd', '.\\a', '..\\a', 'file:///C:/a',
    'C:\\a\\..\\b', 'C:\\a\\..', 'C:\\a\\<b>', 'C:\\a|b', 'C:\\a?b', 'C:\\a*b', 'C:\\a"b', 'C:\\a:b',
    'C:\\a\nb', 'C:\\a\rb', 'C:\\a\u0000b', 'C:\\a\tb', 'C:\\a\u007fb', `C:\\${'x'.repeat(5000)}`,
    null, undefined, 42, {}, ['C:\\a']
  ]) {
    assert.equal(isAcceptablePath(bad), false, JSON.stringify(bad));
  }
});

test('reads one shred request, and one find-program request', () => {
  assert.deepEqual(parseOpenRequest([EXE, '--shred', 'C:\\old.docx']), { request: { kind: 'shred', path: 'C:\\old.docx' }, rejected: null });
  assert.deepEqual(parseOpenRequest([EXE, '--find-program', 'C:\\Games\\Acme\\acme.exe']), { request: { kind: 'find-program', path: 'C:\\Games\\Acme\\acme.exe' }, rejected: null });
});

test('finds the flag among the other arguments Electron and Windows add', () => {
  const argv = [EXE, '--allow-file-access-from-files', '--shred', 'C:\\old.docx', '--no-sandbox'];
  assert.deepEqual(parseOpenRequest(argv).request, { kind: 'shred', path: 'C:\\old.docx' });
});

test('no request is not an error', () => {
  for (const argv of [[EXE], [EXE, '--start-minimized'], [], null, undefined, 'nonsense', [EXE, 'C:\\old.docx']]) {
    assert.deepEqual(parseOpenRequest(argv), { request: null, rejected: null }, JSON.stringify(argv));
  }
});

test('argv[0] is the program and never a request, whatever it is called', () => {
  assert.deepEqual(parseOpenRequest(['--shred', 'C:\\old.docx']), { request: null, rejected: null });
});

test('more than one request is refused whole: it never picks one', () => {
  for (const argv of [
    [EXE, '--shred', 'C:\\a.txt', '--shred', 'C:\\b.txt'],
    [EXE, '--shred', 'C:\\a.txt', '--find-program', 'C:\\b.exe'],
    [EXE, '--find-program', 'C:\\a.exe', '--find-program', 'C:\\b.exe']
  ]) {
    assert.deepEqual(parseOpenRequest(argv), { request: null, rejected: 'duplicate' }, JSON.stringify(argv));
  }
});

test('a flag with no usable path is refused, never completed with a guess', () => {
  assert.deepEqual(parseOpenRequest([EXE, '--shred']), { request: null, rejected: 'missingPath' });
  for (const value of ['', 'old.docx', '..\\old.docx', '--find-program', '--start-minimized', 'C:\\a\nb', 'C:\\a<b']) {
    assert.deepEqual(parseOpenRequest([EXE, '--shred', value]), { request: null, rejected: 'badPath' }, JSON.stringify(value));
  }
  assert.deepEqual(parseOpenRequest([EXE, '--shred', 42]), { request: null, rejected: 'badPath' });
});

test('the --flag=value spelling is not accepted', () => {
  assert.deepEqual(parseOpenRequest([EXE, '--shred=C:\\old.docx']), { request: null, rejected: 'badPath' });
  assert.deepEqual(parseOpenRequest([EXE, '--find-program=C:\\a.exe']), { request: null, rejected: 'badPath' });
});

test('a lookalike flag is not a request', () => {
  assert.deepEqual(parseOpenRequest([EXE, '--shredder', 'C:\\old.docx']), { request: null, rejected: null });
  assert.deepEqual(parseOpenRequest([EXE, '-shred', 'C:\\old.docx']), { request: null, rejected: null });
});

test('what comes out is a new plain object holding only the kind and the path', () => {
  const { request } = parseOpenRequest([EXE, '--shred', 'C:\\old.docx']);
  assert.deepEqual(Object.keys(request).sort(), ['kind', 'path']);
});

/* ---- the relay: nothing is lost before the page is listening ---- */

function relay(over = {}) {
  const sent = [];
  const r = createOpenRequestRelay({ send: (request) => { sent.push(request); }, ...over });
  return { r, sent };
}
const shred = (path) => ({ kind: 'shred', path });

test('a request that arrives before the page is ready waits, and is delivered once it is', () => {
  const { r, sent } = relay();
  r.handle(shred('C:\\a'));
  assert.deepEqual(sent, []);
  assert.equal(r.pending(), 1);
  r.setReady(true);
  assert.deepEqual(sent, [shred('C:\\a')]);
  assert.equal(r.pending(), 0);
});

test('once the page is ready a request goes straight through', () => {
  const { r, sent } = relay();
  r.setReady(true);
  r.handle(shred('C:\\a'));
  assert.deepEqual(sent, [shred('C:\\a')]);
});

test('waiting requests are delivered in the order they came, and only once', () => {
  const { r, sent } = relay();
  r.handle(shred('C:\\a'));
  r.handle({ kind: 'find-program', path: 'C:\\b.exe' });
  r.setReady(true);
  r.setReady(true);
  assert.deepEqual(sent, [shred('C:\\a'), { kind: 'find-program', path: 'C:\\b.exe' }]);
});

test('a page that goes away (a reload) holds new requests until it is back', () => {
  const { r, sent } = relay();
  r.setReady(true);
  r.setReady(false);
  r.handle(shred('C:\\a'));
  assert.deepEqual(sent, []);
  r.setReady(true);
  assert.deepEqual(sent, [shred('C:\\a')]);
});

test('only the newest few waiting requests are kept', () => {
  const { r, sent } = relay({ maxPending: 3 });
  for (const n of [1, 2, 3, 4, 5]) r.handle(shred(`C:\\${n}`));
  assert.equal(r.pending(), 3);
  r.setReady(true);
  assert.deepEqual(sent.map((q) => q.path), ['C:\\3', 'C:\\4', 'C:\\5']);
});

test('a request that is not one is dropped, not forwarded', () => {
  const { r, sent } = relay();
  r.setReady(true);
  for (const bad of [null, undefined, 'x', {}, { kind: 'shred' }, { kind: 'delete', path: 'C:\\a' }, { kind: 'shred', path: 'relative' }, { kind: 'shred', path: 'C:\\a\nb' }]) {
    r.handle(bad);
  }
  assert.deepEqual(sent, []);
});

test('a send that fails (the window is going away) keeps the request for the next page', () => {
  let fail = true;
  const sent = [];
  const r = createOpenRequestRelay({ send: (request) => { if (fail) throw new Error('destroyed'); sent.push(request); } });
  r.setReady(true);
  r.handle(shred('C:\\a'));
  assert.deepEqual(sent, []);
  assert.equal(r.pending(), 1);
  fail = false;
  r.setReady(true);
  assert.deepEqual(sent, [shred('C:\\a')]);
});
