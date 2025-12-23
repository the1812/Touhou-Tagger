import packageJson from './package.json' assert { type: 'json' }

Bun.build({
  entrypoints: ['./src/cli/index.ts'],
  target: 'bun',
  bytecode: true,
  compile: {
    outfile: 'bin/thtag',
    target: 'bun-windows-x64-modern',
    windows: {
      title: 'Touhou Tagger',
      version: packageJson.version,
      icon: './assets/logo.ico',
    },
  },
})
