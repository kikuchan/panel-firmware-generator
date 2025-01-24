module.exports = {
  plugins: ['prettier-plugin-organize-imports', 'prettier-plugin-tailwindcss'],

  printWidth: 120,
  tabWidth: 2,
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  bracketSpacing: true,
  bracketSameLine: true,
  arrowParens: 'always',

  organizeImportsSkipDestructiveCodeActions: true,
};
