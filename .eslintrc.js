module.exports = {
  plugins: ['@typescript-eslint', 'import', 'prettier', 'mocha'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12,
    tsconfigRootDir: __dirname,
    project: 'tsconfig.json',
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.ts', '.tsx', '.js', 'jsx'],
      },
      typescript: {
        alwaysTryTypes: true,
      },
    },
  },
  rules: {
    'no-param-reassign': 0,
    'prefer-destructuring': 0,
    '@typescript-eslint/naming-convention': 0,
    'import/extensions': 0,
    "@typescript-eslint/no-explicit-any": 0,
  },
};
