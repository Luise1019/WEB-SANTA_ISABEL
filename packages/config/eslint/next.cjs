/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: [require.resolve('./base.cjs'), 'next/core-web-vitals'],
  env: { browser: true, node: true, es2022: true },
  settings: { next: { rootDir: ['apps/web/'] } },
};
