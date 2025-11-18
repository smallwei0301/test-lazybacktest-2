const coreWebVitalsConfig = require("eslint-config-next/core-web-vitals");

const ignorePatterns = [
  "public/app/js/backtest_corrupted.js",
  "public/batch-optimization.js",
  "public/app/js/worker_backup*.js",
  "public/app/js/worker_backup_before*.js",
];

const legacyPaths = [
  "app/**/*.{ts,tsx}",
  "components/**/*.{ts,tsx}",
  "hooks/**/*.{ts,tsx}",
  "lib/**/*.js",
  "netlify/**/*.js",
  "public/**/*.{js,ts,tsx,d.ts}",
];

module.exports = [
  {
    ignores: ignorePatterns,
  },
  ...coreWebVitalsConfig,
  {
    rules: {
      "no-unused-vars": "warn",
    },
  },
  ...legacyPaths.map((pattern) => ({
    files: [pattern],
    rules: {
      "no-unused-vars": "off",
    },
  })),
];
