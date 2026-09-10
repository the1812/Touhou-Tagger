import fmtConfig from '@the1812/oxc-config/oxfmt'
import lintConfig from '@the1812/oxc-config/oxlint'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  staged: {
    '{*,!(go)/**/*}': 'vp check --fix',
    'go/gui/frontend/**/*': 'vp -C go/gui/frontend check --fix',
  },
  fmt: {
    ...fmtConfig,
    ignorePatterns: [
      ...(fmtConfig.ignorePatterns ?? []),
      'test-files/',
      'patches/',
      'go/',
      'fixtures/**/*.html',
    ],
  },
  lint: {
    extends: [lintConfig],
    categories: { correctness: 'off' },
    ignorePatterns: ['dist/', 'node_modules/', 'test-files/', 'patches/', 'go/'],
    options: { typeAware: true, typeCheck: true },
  },
  test: { fileParallelism: false, testTimeout: 30000 },
})
