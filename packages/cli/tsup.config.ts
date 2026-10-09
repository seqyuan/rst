import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { cli: 'src/cli.ts' },
  format: ['esm'],
  clean: true,
  outDir: 'dist',
  // NOTE: do NOT add `banner: { js: '#!/usr/bin/env node' }` here.
  // src/cli.ts already starts with that shebang and esbuild preserves it, so a
  // banner would emit a duplicated shebang and Node would fail with
  // "SyntaxError: Invalid or unexpected token" on the second line.
  external: ['@seqyuan/rst-renderer'],
})
