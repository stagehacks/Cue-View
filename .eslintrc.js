module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
    node: true,
  },
  extends: ['airbnb-base', 'prettier'],
  parserOptions: {
    ecmaVersion: 13,
  },
  rules: {
    'import/no-extraneous-dependencies': 0,
    'no-unused-vars': ['error', { args: 'none' }],
    'no-console': 'off',
    'no-alert': 'off',
    'no-plusplus': 'off',
    'import/extensions': 'off',
    'prefer-destructuring': 'off',
    'no-use-before-define': 'off',
    'space-infix-ops': 'warn',
    'no-bitwise': 'off',
    'no-restricted-globals': 'off'
  },
};
