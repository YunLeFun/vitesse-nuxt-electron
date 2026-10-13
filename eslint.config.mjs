import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  typescript: true,
  ignores: ['.nuxt/**', '.output/**', 'dist-electron/**', 'out/**', 'playwright-report/**', 'test-results/**'],
}, {
  rules: { 'node/prefer-global/process': 'off', 'node/prefer-global/buffer': 'off' },
}, {
  files: ['**/*.mjs', '**/*.cjs'],
  rules: {
    'unused-imports/no-unused-vars': 'off',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-unmodified-loop-condition': 'off',
  },
}, {
  files: ['scripts/**', 'electron/main.ts'],
  rules: { 'no-console': 'off' },
})
