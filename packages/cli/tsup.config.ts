import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { cli: 'src/cli.ts' },
  format: ['esm'],
  clean: true,
  outDir: 'dist',
  banner: { js: '#!/usr/bin/env node' },
  external: ['@seqyuan/rst-renderer'],
})
