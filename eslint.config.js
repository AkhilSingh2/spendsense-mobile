const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/**',
      'web-build/**',
      'server/**',
      'node_modules/**',
      '.expo/**',
      'coverage/**',
      'docs/**',
    ],
  },
]);
