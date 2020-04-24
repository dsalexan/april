module.exports = {
  "env": {
    "browser": true,
    "node": true,
    "es6": true,
    "commonjs": true
  },
  "parserOptions": {
    "ecmaVersion": 8,
    "sourceType": "module",
  },
  "extends": [
    "react-app",
    "eslint:recommended",
    "plugin:prettier/recommended"
  ],
  "plugins": [
    "prettier"
  ],
  "rules": {
    "prettier/prettier": "error",
    
    'no-console': 'warn',
    'no-debugger': 'warn',
    camelcase: 'off',
    'max-len': [
      'warn',
      {
        code: 130
      }
    ],
    'prefer-destructuring': 'error',
    'radix': 'off',
    'consistent-return': 'error',
    'import/no-named-as-default-member': 'off',
    'consistent-return': 'off',
    'prefer-destructuring': 'warn',
    'no-unused-vars': 'warn',
    'no-extend-native': 'off',
  }
}