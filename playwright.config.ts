import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  timeout: 30000,
  reporter: 'list',
  use: { trace: 'retain-on-failure' },
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR || 'test-results',
})
