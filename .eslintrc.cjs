const baseConfig = require('@haizel/eslint');

module.exports = {
  ...baseConfig,
  ignorePatterns: Array.from(new Set([...(baseConfig.ignorePatterns ?? []), 'node_modules', 'dist', '.turbo'])),
};
