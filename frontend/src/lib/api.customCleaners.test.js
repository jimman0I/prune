import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchCustomCleaners, addCustomLocation, removeCustomLocation, importCleaner, removeImportedCleaner
} from './api.js';

global.fetch = vi.fn();
const reply = (ok, status, body) => ({ ok, status, json: async () => body });
beforeEach(() => { vi.resetAllMocks(); });

describe('custom locations', () => {
  it('lists locations and imported cleaners', async () => {
    fetch.mockResolvedValueOnce(reply(true, 200, { locations: ['D:\\A'], imported: [{ id: 'demo' }] }));
    expect(await fetchCustomCleaners()).toEqual({ locations: ['D:\\A'], imported: [{ id: 'demo' }] });
    expect(fetch.mock.calls[0][0]).toMatch(/\/custom-cleaners$/);
  });

  it('adds one by POSTing JSON', async () => {
    fetch.mockResolvedValueOnce(reply(true, 200, { locations: ['D:\\A'] }));
    await addCustomLocation('D:\\A');
    const [url, init] = fetch.mock.calls[0];
    expect(url).toMatch(/\/custom-cleaners\/locations$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ path: 'D:\\A' });
  });

  it('carries the reason a location was refused, so the screen can say it in the right words', async () => {
    fetch.mockResolvedValueOnce(reply(false, 400, { error: 'nope', reason: 'protected' }));
    await expect(addCustomLocation('C:\\Windows')).rejects.toMatchObject({ reason: 'protected' });
  });

  it('removes one', async () => {
    fetch.mockResolvedValueOnce(reply(true, 200, { locations: [] }));
    await removeCustomLocation('D:\\A');
    expect(fetch.mock.calls[0][0]).toMatch(/\/custom-cleaners\/locations\/remove$/);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ path: 'D:\\A' });
  });
});

describe('importing', () => {
  it('sends the file as plain text with its name in the query, not as JSON', async () => {
    fetch.mockResolvedValueOnce(reply(true, 200, { imported: true, report: {} }));
    await importCleaner('slack.xml', '<cleaner id="slack"/>');
    const [url, init] = fetch.mock.calls[0];
    expect(url).toMatch(/\/custom-cleaners\/import\?name=slack\.xml$/);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('text/plain');
    expect(init.body).toBe('<cleaner id="slack"/>');
  });

  it('encodes the file name', async () => {
    fetch.mockResolvedValueOnce(reply(true, 200, {}));
    await importCleaner('my cleaner & more.xml', '<cleaner/>');
    expect(fetch.mock.calls[0][0]).toContain('name=my%20cleaner%20%26%20more.xml');
  });

  it('carries the importer\'s code when the file is refused', async () => {
    fetch.mockResolvedValueOnce(reply(false, 400, { error: 'x', code: 'notCleaner' }));
    await expect(importCleaner('a.xml', '<html/>')).rejects.toMatchObject({ code: 'notCleaner' });
  });

  it('calls a body that was too large what the importer calls it', async () => {
    fetch.mockResolvedValueOnce(reply(false, 413, { error: 'request entity too large' }));
    await expect(importCleaner('a.xml', 'x')).rejects.toMatchObject({ code: 'tooLarge' });
  });

  it('removes an imported cleaner by id', async () => {
    fetch.mockResolvedValueOnce(reply(true, 200, { removed: true }));
    await removeImportedCleaner('demo');
    expect(fetch.mock.calls[0][0]).toMatch(/\/custom-cleaners\/imported\/demo$/);
    expect(fetch.mock.calls[0][1].method).toBe('DELETE');
  });
});
