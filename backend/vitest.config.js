import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Vitest's 5000ms default is too tight for this suite's real
    // sqlite3.exe shellouts (the bespoke cleaning-engine action types
    // build multi-table SQLite fixtures via several sequential
    // execFileAsync calls each) on a GitHub Actions Windows runner --
    // confirmed by a real CI failure on v2.6.0's build, where multiple
    // tests across sqliteVacuum/json/cookie/mozillaUrlHistory/
    // cleanerRules all timed out at exactly 5000ms despite passing
    // comfortably on this project's own dev machine. An initial bump to
    // 15000 still wasn't enough on that same runner (the real cause,
    // fixed separately in build.yml, is Windows Defender's real-time
    // scan adding latency to every new temp file this suite writes) --
    // this margin is deliberately generous on top of that fix, not a
    // substitute for it. Raised, not mocked-away: these tests are
    // specifically testing real SQLite behavior via the real bundled
    // CLI, and a slower CI runner's process-spawn overhead is a real,
    // honest cost of that, not a hung test to paper over.
    testTimeout: 30000
  }
});
