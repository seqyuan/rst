# @seqyuan/vite-plugin-rst

Import `.rst` files in Vite projects as HTML strings, Markdown, React
components, or metadata.

Part of the [rst-renderer](../..) monorepo. See the
[main README](../../README.md) for RST support details.

## Install

```bash
pnpm add -D @seqyuan/vite-plugin-rst
pnpm add @seqyuan/rst-renderer
```

## Usage

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import rst from '@seqyuan/vite-plugin-rst'

export default defineConfig({ plugins: [rst()] })
```

```ts
// Default: HTML (also exports `meta`)
import { html, meta } from './doc.rst'
// id = '/abs/doc.rst'
// html: rendered HTML string
// meta: { title: string, headings: string[] }

// With query params:
import md from './doc.rst?md'        // Markdown string
import meta from './doc.rst?meta'    // metadata only
import page from './doc.rst?react'   // React component module
```

### Options

```ts
rst({ defaultFormat: 'html' }) // 'html' | 'md' | 'react'
```

Editing an `.rst` file triggers a full reload.

## License

MIT
