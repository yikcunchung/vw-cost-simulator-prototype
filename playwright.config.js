// @ts-check
const { defineConfig, devices } = require('@playwright/test');

// Served over HTTP, not file:// — the audit in a11y-2 is claimed against the
// deployed build, and file:// changes fetch/cache behaviour. 4173 and 4174 are
// already taken by the visualizer and nala suites in this workspace.
const PORT = 4175;

const chrome = devices['Desktop Chrome'];

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  // The four viewports the audit is claimed at. 320x256 @ dsf 4 is literal 400%
  // browser zoom — dsf 1 would be a small screen, which is a different test
  // (a11y-2 trap 4).
  projects: [
    { name: 'desktop-1440', use: { ...chrome, viewport: { width: 1440, height: 900 } } },
    { name: 'tablet-768',   use: { ...chrome, viewport: { width: 768,  height: 1024 } } },
    { name: 'mobile-390',   use: { ...chrome, viewport: { width: 390,  height: 844 } } },
    { name: 'zoom-400',     use: { ...chrome, viewport: { width: 320,  height: 256 }, deviceScaleFactor: 4 } },
  ],
  webServer: {
    command: `python3 -m http.server ${PORT} --bind 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
