# Contributing

## Set expectations first

Prune is one person's project. Pull requests are welcome, but a large one
that arrives unannounced is likely to sit, and may be declined on
direction rather than on quality — which wastes your time more than mine.
**Open an issue before writing anything substantial**, and say what you
mean to change.

Small, self-contained fixes need no preamble. Send them.

[PRODUCT.md](PRODUCT.md) says who this is for and what it is trying to
be. A change that argues with it is a conversation, not a patch.

## Running it

Three terminals. Node 18 or newer; developed on 24.

```bash
cd backend   && npm install && npm run dev    # Express, port 3101
cd frontend  && npm install && npm run dev    # Vite, port 5174
cd electron  && npm install && npm start      # once both are up
```

Tests, which must pass before anything is sent:

```bash
cd backend  && npm test
cd frontend && npm test
```

That is 1,844 of them, roughly half a minute per suite. GitHub Actions
runs both on every push and pull request, on a Windows runner, but a red
build is a slower way to find out than running them first.

**Run one suite at a time.** A handful of backend tests create and delete
a real registry key, because the thing being tested is that Prune removes
something Windows actually holds — a mock cannot prove that. The key name
is unique per process, so two runs no longer destroy each other's
fixture, but they still both drive `reg.exe`, and two suites racing it
will occasionally lose. Measured: one failure across three concurrent
pairs, on a different test each time. If a quarantine test fails and you
have another run going, that is why.

## How code is written here

Read a few files before writing any. The conventions are visible and
consistent, and a patch that ignores them will be asked to change.

**Comments say why, not what.** Nearly every non-obvious decision in this
codebase carries the reason it was made, and often the bug that produced
it. `git log` and the comments are the design documentation; there is no
wiki. If you fix something subtle, write down what made it subtle.

**Tests come first, and they have to be able to fail.** New behaviour
starts with a failing test. More importantly:

> **Break your own test before you send it.** Change the line it covers
> so the behaviour is wrong, and confirm the test goes red. A test that
> stays green against broken code is worse than no test — it is a claim
> of coverage that is not there.

This is not a formality. Several tests in this repo were caught doing
exactly that and were rewritten or deleted; two files carry comments
explaining what could not be tested and why, rather than shipping an
assertion that could not fail.

**Say what you could not test.** If jsdom or the environment genuinely
cannot express the thing, write a comment saying so and how it was
verified instead. `ContextMenu.render.test.jsx` and
`TitleBar.render.test.jsx` both do this.

**Prefer the root cause.** Two symptoms with one cause get one fix. A
guard belongs with the function it protects rather than repeated at every
call site.

## Working on the destructive parts

Deep Clean, the leftover sweep, the uninstaller and Quarantine all remove
things from the machine you are developing on.

- **Use the Sandbox Test in Settings.** It exercises the cleanup engine
  against a throwaway directory and is the intended way to check a change
  to it.
- **Do not test by pressing the real buttons** unless you mean it. Start
  uninstall, Confirm clean, Remove selected and Empty Quarantine all do
  what they say, on your machine.
- **Quarantine is the safety net, so changes to it get extra scrutiny.**
  Everything the cleaner removes is moved there rather than deleted, and
  registry keys are exported before removal. A change that makes a
  restore write the wrong thing, or to the wrong place, defeats every
  other guard in the app.

## Commits

Conventional-commit subjects (`fix(startup): …`, `feat(deep-clean): …`),
and a body that explains the reasoning rather than restating the diff.
The existing log is the reference — commits here tend to be long, because
what was tried and rejected is worth as much as what landed.

Backend and frontend changes are committed separately.

## Security

Do not open a pull request that fixes a vulnerability before it has been
reported and discussed — the diff discloses it. See
[SECURITY.md](SECURITY.md).

## License

Prune is MIT licensed. Anything you contribute is contributed under the
same terms — there is no CLA to sign, and no separate assignment.
