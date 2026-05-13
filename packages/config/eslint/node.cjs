/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: [require.resolve('./base.cjs')],
  env: { node: true, es2022: true },
};
