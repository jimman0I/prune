import { describe, it, expect, vi } from 'vitest';
import { errorResponse, jsonErrors } from './jsonErrors.js';

/** app.errors.test.js drives this through a real server, which covers
 * what a client actually receives. Two things it cannot reach are here:
 * the decision itself, in isolation, and the case where a response is
 * already on the wire.
 */

const bodyParserError = (type, status) => Object.assign(
  new SyntaxError('Unexpected end of JSON input'),
  { type, status, statusCode: status, expose: true }
);

describe('errorResponse', () => {
  it('names each way a body can be rejected', () => {
    expect(errorResponse(bodyParserError('entity.parse.failed', 400)))
      .toEqual({ status: 400, body: { error: 'That request body was not valid JSON.' } });
    expect(errorResponse(bodyParserError('entity.too.large', 413)).status).toBe(413);
    expect(errorResponse(bodyParserError('charset.unsupported', 415)).status).toBe(415);
  });

  it('never repeats the error it was given', () => {
    // The whole point. Express's own handler renders err.stack, and on
    // this machine that named the install directory and the internals of
    // body-parser. Nothing from the error object may reach the body.
    const err = new Error('ENOENT: no such file, open C:\\Users\\someone\\secret.json');
    err.stack = 'Error: ENOENT\n    at C:\\Games\\shortcuts\\lol\\prune\\backend\\node_modules\\thing.js:4:1';
    const text = JSON.stringify(errorResponse(err));
    expect(text).not.toContain('C:\\');
    expect(text).not.toContain('node_modules');
    expect(text).not.toContain('ENOENT');
    expect(text).toContain('Something went wrong inside Prune.');
  });

  it('honours a 4xx the middleware named, and treats everything else as ours', () => {
    // A 4xx says the request was wrong; a 5xx says this app was. Passing
    // a dependency's 500 through unexamined would let it claim the
    // caller's mistake was ours, or the reverse.
    expect(errorResponse({ status: 415 }).status).toBe(415);
    expect(errorResponse({ statusCode: 400 }).status).toBe(400);
    expect(errorResponse({ status: 502 }).status).toBe(500);
    expect(errorResponse({ status: 'nonsense' }).status).toBe(500);
    expect(errorResponse(new Error('anything')).status).toBe(500);
    expect(errorResponse(undefined).status).toBe(500);
  });

  it('does not blame the caller for a fault of ours, or the reverse', () => {
    expect(errorResponse({ status: 400 }).body.error).toMatch(/could not be understood/);
    expect(errorResponse({ status: 500 }).body.error).toMatch(/inside Prune/);
  });
});

describe('the middleware', () => {
  const fakeRes = () => {
    const res = {
      headersSent: false,
      statusCode: null,
      sent: null,
      status(code) { res.statusCode = code; return res; },
      json(body) { res.sent = body; return res; }
    };
    return res;
  };

  it('takes four arguments, which is how Express recognises it at all', () => {
    // Not a style point. Express identifies an error handler by arity;
    // written with three it silently becomes ordinary middleware that
    // never runs, and the HTML stack traces come straight back.
    expect(jsonErrors().length).toBe(4);
  });

  it('answers with the JSON body', () => {
    const res = fakeRes();
    jsonErrors(() => {})(bodyParserError('entity.parse.failed', 400), {}, res, () => {});
    expect(res.statusCode).toBe(400);
    expect(res.sent).toEqual({ error: 'That request body was not valid JSON.' });
  });

  it('leaves a response that is already on the wire alone', () => {
    // The event-stream routes send their 200 and headers before any work
    // starts. Writing an error object into an open stream would corrupt
    // it rather than explain anything, so this hands back to Express,
    // whose own behaviour here is to destroy the socket -- the client
    // sees a truncated stream, which is exactly what happened.
    const res = fakeRes();
    res.headersSent = true;
    const next = vi.fn();
    const err = new Error('failed mid-stream');
    jsonErrors(() => {})(err, {}, res, next);
    expect(next).toHaveBeenCalledWith(err);
    expect(res.sent).toBeNull();
    expect(res.statusCode).toBeNull();
  });

  it('logs the detail rather than sending it', () => {
    // Someone debugging this needs the stack. The request that caused it
    // does not get to read it.
    const log = vi.fn();
    const err = new Error('ENOENT: open C:\\Users\\someone\\secret.json');
    jsonErrors(log)(err, { method: 'POST', originalUrl: '/api/settings' }, fakeRes(), () => {});
    expect(log).toHaveBeenCalledWith('Unhandled error while serving', 'POST', '/api/settings', err);
  });

  it('does not log a caller mistake as an internal fault', () => {
    // A malformed body is not something to investigate, and a log that
    // fills with them is a log nobody reads.
    const log = vi.fn();
    jsonErrors(log)(bodyParserError('entity.parse.failed', 400), {}, fakeRes(), () => {});
    expect(log).not.toHaveBeenCalled();
  });
});
