# @seqyuan/rst-renderer

reStructuredText renderer for JavaScript/TypeScript — **RST → HTML / React /
Markdown**, with an optional Jinja2-style template layer and a built-in
single-file report theme.

Part of the [rst-renderer](../..) monorepo. See the
[main README](../../README.md) for the full feature list and RST support
boundaries.

## Install

```bash
pnpm add @seqyuan/rst-renderer   # or: npm install @seqyuan/rst-renderer
```

## Usage

```ts
import { renderRst, wrapHtmlDocument } from '@seqyuan/rst-renderer'

const html = renderRst('Hello\n=====\n\nThis is **bold**.\n')
const page = wrapHtmlDocument(html, { title: 'Hello' }) // complete document + theme
```

### HTML with options

```ts
renderRst(source, {
  parser: 'builtin',          // or 'rst-compiler'
  headingOffset: 1,           // level-1 section → <h2> (default)
  baseDir: process.cwd(),     // resolves .. csv-table:: :file:
  includeResolver: { baseDir: 'docs' }, // expand .. include::
})
```

`preloadRenderers()` awaits Shiki/KaTeX so the first render is highlighted and
math is typeset.

### React

```ts
import { ReactRenderer } from '@seqyuan/rst-renderer/react'

const renderer = new ReactRenderer()
const element = renderer.render(document) // ReactNode
```

### Markdown

```ts
import { MarkdownRenderer, createBuiltinParser } from '@seqyuan/rst-renderer'

const document = createBuiltinParser().parse({ input: source }).document
const md = new MarkdownRenderer({ headingOffset: 1 }).render(document)
```

### Templates

```ts
import { renderRstTemplate } from '@seqyuan/rst-renderer'

const html = renderRstTemplate(
  "{{ name }}\n{{ '=' * name.length }}\n\nBody.\n",
  { name: 'Report' },
)
```

## License

MIT
