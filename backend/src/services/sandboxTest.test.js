import { describe, it, expect, afterEach } from 'vitest';
import { runSandboxTest } from './sandboxTest.js';

// Real bug this whole function exists to prevent: a naive sandbox test
// pointed at a literal path INSIDE the real Temp root (e.g.
// "%TEMP%\unrevo-sandbox") would still be scanned/cleaned by the REAL
// tempFiles category. This test asserts runSandboxTest never touches this
// machine's actual env vars for real Temp/LocalAppData roots -- only that
// it temporarily overrode and then fully restored them.
describe('runSandboxTest (real execution, no mocking)', () => {
  const realTemp = process.env.UNREVO_TEMP_ROOT;
  const realWinTemp = process.env.UNREVO_WINDOWS_TEMP_ROOT;
  const realLocalAppData = process.env.UNREVO_LOCALAPPDATA_ROOT;

  afterEach(() => {
    // Guard the guard -- if runSandboxTest's own restore ever regresses,
    // this test file must not leak env var pollution into whatever runs
    // after it either.
    if (realTemp === undefined) delete process.env.UNREVO_TEMP_ROOT; else process.env.UNREVO_TEMP_ROOT = realTemp;
    if (realWinTemp === undefined) delete process.env.UNREVO_WINDOWS_TEMP_ROOT; else process.env.UNREVO_WINDOWS_TEMP_ROOT = realWinTemp;
    if (realLocalAppData === undefined) delete process.env.UNREVO_LOCALAPPDATA_ROOT; else process.env.UNREVO_LOCALAPPDATA_ROOT = realLocalAppData;
  });

  it('really scans, really cleans, and reports every step as passed', async () => {
    const report = await runSandboxTest();

    expect(report.error).toBeNull();
    expect(report.steps.length).toBeGreaterThan(0);
    for (const step of report.steps) {
      expect(step.passed, `step "${step.name}" failed: ${step.detail}`).toBe(true);
    }
    expect(report.passed).toBe(true);
  });

  it('restores the real env vars afterward, even though it overrode them mid-run', async () => {
    process.env.UNREVO_TEMP_ROOT = 'C:\\sentinel-before';
    await runSandboxTest();
    expect(process.env.UNREVO_TEMP_ROOT).toBe('C:\\sentinel-before');
  });

  it('leaves no sandbox directory behind on disk after finishing', async () => {
    const report = await runSandboxTest();
    const createStep = report.steps.find(s => s.name.toLowerCase().includes('sandbox directory'));
    expect(createStep).toBeDefined();
    // The directory path was reported as this step's detail -- confirm it
    // really doesn't exist anymore now that the run has finished.
    const { existsSync } = await import('node:fs');
    expect(existsSync(createStep.detail)).toBe(false);
  });
});
