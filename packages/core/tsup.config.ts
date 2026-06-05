import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    dts: true,
    clean: true,
    outDir: 'dist',
    sourcemap: true,
    external: ['rst-compiler'],
  },
  {
    entry: { react: 'src/renderer/react/index.ts' },
    format: ['esm'],
    dts: true,
    clean: false,
    outDir: 'dist',
    sourcemap: true,
    external: ['react', 'react-dom'],
  },
  {
    entry: { markdown: 'src/renderer/markdown/index.ts' },
    format: ['esm'],
    dts: true,
    clean: false,
    outDir: 'dist',
    sourcemap: true,
  },
])
