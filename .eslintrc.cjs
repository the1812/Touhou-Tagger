module.exports = {
  extends: ['@the1812/eslint-config'],
  rules: {
    'class-methods-use-this': 'off',
  },
  overrides: [
    {
      files: ['*-mappings.ts'],
      rules: {
        '@typescript-eslint/naming-convention': [
          'error',
          {
            selector: 'property',
            format: ['strictCamelCase', 'StrictPascalCase'],
            filter: {
              regex: '[-/]|^[.]',
              match: false,
            },
          },
        ],
      },
    },
  ],
}
