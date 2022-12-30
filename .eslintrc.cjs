module.exports = {
  env: {
    browser: false,
    es2021: true,
  },
  extends: 'airbnb-base',
  overrides: [
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    // override to not flag .js imports as errors
    'import/extensions': ['error', 'ignorePackages', { js: 'always' }],
  },
};
