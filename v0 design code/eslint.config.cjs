// Minimal flat config to avoid loading shareable configs/plugins
// This helps avoid circular-config/plugin issues while we stabilize ESLint v9
module.exports = [
  // Base ignores to skip build artifacts
  {
    ignores: ['node_modules/**', '.next/**', 'dist/**'],
  },

  // Legacy public scripts: declare common browser/worker globals and
  // temporarily disable `no-undef` to reduce noise from runtime globals.
  {
    files: ['public/**'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        self: 'readonly',
        importScripts: 'readonly',
        Worker: 'readonly',
        fetch: 'readonly',
        URLSearchParams: 'readonly',
        AbortController: 'readonly',
        console: 'readonly'
      }
    },
    rules: {
      'no-undef': 'off'
    }
  },

  // Default ruleset for other project files (kept minimal for now)
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module'
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off'
    }
  }
  ,
  // TypeScript / TSX override: use @typescript-eslint parser so TS/TSX parse correctly
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        ecmaFeatures: { jsx: true }
      }
    },
    // do not enable heavy TS rules yet; just allow parsing
    rules: {}
  }
];
