/** The last answer, for requests nothing else answered.
 *
 * Every route in this app replies with JSON carrying an `error` string,
 * and every caller in the frontend reads `data.error`. Express's own
 * fallback does neither: it renders an HTML page containing err.stack,
 * which on this machine meant a response naming the install directory,
 * the node_modules path, and the internals of body-parser and raw-body.
 * A malformed request body was enough to get one -- no privilege, no
 * unusual route, just a truncated POST.
 *
 * So: the shape a client already expects, and a sentence a person can
 * read, with the detail going to the log where a developer can find it
 * rather than onto the wire where nobody should.
 *
 * Almost everything that reaches here comes from express.json() rather
 * than from a route. Route handlers do their own try/catch, and an async
 * handler's rejection would not arrive here anyway -- Express 4 only
 * forwards what a handler throws synchronously, which an async function
 * never does. This is the backstop for the middleware in front of them.
 */

/** What each body-parser failure is, said plainly.
 *
 * Deliberately not err.message. For a parse failure that message is
 * harmless ("Unexpected end of JSON input") but written for a compiler
 * author; for anything else it is an unknown string from a dependency,
 * and this is the one place with no route-level knowledge of whether it
 * is safe to repeat. */
const MESSAGES = {
  'entity.parse.failed': 'That request body was not valid JSON.',
  'entity.too.large': 'That request body is too large for Prune to accept.',
  'entity.verify.failed': 'That request body could not be verified.',
  'encoding.unsupported': 'That request used a content encoding Prune does not accept.',
  'charset.unsupported': 'That request used a character set Prune does not accept.',
  'request.aborted': 'That request was cut off before it finished sending.',
  'request.size.invalid': 'That request declared a length that did not match what it sent.',
  'parameters.too.many': 'That request had too many parameters.'
};

/** Body-parser sets both, and they can disagree with each other across
 * versions; a 4xx it named is honoured, anything else is ours. */
function statusFor(err) {
  const declared = Number(err?.status ?? err?.statusCode);
  if (Number.isInteger(declared) && declared >= 400 && declared <= 499) return declared;
  return 500;
}

/** An error, as the body and status a client should see. Pure, so the
 * decision about what leaves this process is testable on its own. */
export function errorResponse(err) {
  const status = statusFor(err);
  const named = MESSAGES[err?.type];
  if (named) return { status, body: { error: named } };
  return {
    status,
    body: {
      error: status === 500
        ? 'Something went wrong inside Prune.'
        : 'That request could not be understood.'
    }
  };
}

/** Express error middleware. Four arguments, and they matter: Express
 * identifies an error handler by arity, and dropping the unused `next`
 * would silently turn this into an ordinary middleware that never runs. */
export function jsonErrors(log = console.error) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    // A response already on the wire cannot be replaced with a JSON body.
    // The event-stream routes send their 200 and their headers before any
    // work starts, so writing an error object into one would corrupt the
    // stream rather than explain anything. Express's own handler destroys
    // the socket in this case, which is the honest outcome: the client
    // sees a truncated stream, which is what actually happened.
    if (res.headersSent) return next(err);

    const { status, body } = errorResponse(err);
    // The detail goes here, not to the client. Someone debugging this
    // needs the stack; the request that caused it does not get to read it.
    if (status === 500) log('Unhandled error while serving', req?.method, req?.originalUrl, err);
    res.status(status).json(body);
  };
}
