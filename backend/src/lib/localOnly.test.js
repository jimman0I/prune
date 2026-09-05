import { describe, it, expect } from 'vitest';
import { isTrustedRequest } from './localOnly.js';

const req = (over = {}) => ({ origin: undefined, host: '127.0.0.1:3101', ...over });
const check = (over) => isTrustedRequest(req(over), { port: 3101 });

describe('isTrustedRequest', () => {
  it('accepts the packaged app, which sends no Origin at all', () => {
    // Electron loads the UI from file://, and a fetch from there sends
    // either no Origin or the literal "null".
    expect(check({ origin: undefined })).toBe(true);
    expect(check({ origin: 'null' })).toBe(true);
    expect(check({ origin: 'file://' })).toBe(true);
  });

  it('accepts the dev server', () => {
    expect(check({ origin: 'http://localhost:5174' })).toBe(true);
    expect(check({ origin: 'http://127.0.0.1:5174' })).toBe(true);
  });

  it('REFUSES a web page', () => {
    // The whole reason this file exists. Any site the user is browsing
    // could otherwise POST to /quarantine/path and move a folder, or
    // POST /quarantine/empty and destroy every undo the app holds.
    expect(check({ origin: 'https://evil.example.com' })).toBe(false);
    expect(check({ origin: 'http://example.com' })).toBe(false);
    // Including one that merely starts with a trusted string.
    expect(check({ origin: 'http://localhost:5174.evil.com' })).toBe(false);
    expect(check({ origin: 'http://127.0.0.1.evil.com' })).toBe(false);
  });

  it('REFUSES a spoofed Host, which is what DNS rebinding looks like', () => {
    // The attack that works even with a correct Origin check: a domain
    // that resolves to 127.0.0.1, so the browser believes it is
    // same-origin. The Host header still carries the attacker's name.
    expect(check({ host: 'evil.example.com' })).toBe(false);
    expect(check({ host: 'evil.example.com:3101' })).toBe(false);
    expect(check({ host: 'prune.local:3101' })).toBe(false);
  });

  it('accepts either loopback spelling on the right port', () => {
    expect(check({ host: 'localhost:3101' })).toBe(true);
    expect(check({ host: '127.0.0.1:3101' })).toBe(true);
    expect(check({ host: '[::1]:3101' })).toBe(true);
  });

  it('refuses a request with no Host at all', () => {
    // HTTP/1.1 requires one. Its absence is a hand-made request.
    expect(check({ host: undefined })).toBe(false);
    expect(check({ host: '' })).toBe(false);
  });

  it('is not case sensitive about the host', () => {
    expect(check({ host: 'LOCALHOST:3101' })).toBe(true);
  });
});
