# rst-renderer

[![CI](https://github.com/seqyuan/rst/actions/workflows/test.yml/badge.svg)](https://github.com/seqyuan/rst/actions/workflows/test.yml)
[![npm](https://img.shields.io/npm/v/@seqyuan/rst-renderer.svg)](https://www.npmjs.com/package/@seqyuan/rst-renderer)
[![license](https://img.shields.io/npm/l/@seqyuan/rst-renderer.svg)](#license)

reStructuredText renderer for JavaScript/TypeScript — **RST → HTML / React /
Markdown**, plus a CLI and a Vite plugin for generating data-driven,
single-file reports.

It is not a full Sphinx replacement. It focuses on the RST subset that report
generation actually needs: headings, lists, literal blocks, directives, simple
and grid tables, admonitions, images, math (KaTeX), syntax highlighting
(Shiki), and an optional Jinja2-style template layer.

## Packages

| Package | Description |
| ------- | ----------- |
| [`@seqyuan/rst-renderer`](./packages/core) | Core library: parser + HTML / React / Markdown renderers, template engine, theme |
| [`@seqyuan/rst-cli`](./packages/cli) | `rst-render` command for the terminal, with templates, `--scan` and standalone HTML |
| [`@seqyuan/vite-plugin-rst`](./packages/vite-plugin) | Import `.rst` files directly in Vite projects |

All three packages are version-aligned.

## Requirements

- Node.js **>= 22** (the CLI uses `fs.globSync`; optional loaders use
  `process.getBuiltinModule`).

## Install

The packages work with any npm-compatible package manager. `npm` and `pnpm`
commands are interchangeable — pick one and stay consistent inside a project.

```bash
# Library (HTML / React / Markdown)
pnpm add @seqyuan/rst-renderer
npm install @seqyuan/rst-renderer

# CLI (global)
pnpm add -g @seqyuan/rst-cli
npm install -g @seqyuan/rst-cli

# Vite plugin (plus the renderer it transforms with)
pnpm add -D @seqyuan/vite-plugin-rst
pnpm add @seqyuan/rst-renderer
npm install -D @seqyuan/vite-plugin-rst
npm install @seqyuan/rst-renderer
```

Command equivalents:

| pnpm | npm |
| ---- | --- |
| `pnpm add <pkg>` | `npm install <pkg>` |
| `pnpm add -D <pkg>` | `npm install -D <pkg>` |
| `pnpm add -g <pkg>` | `npm install -g <pkg>` |
| `pnpm dlx <pkg>` | `npx <pkg>` |

## Quick start

### Library

```ts
import { renderRst, wrapHtmlDocument } from '@seqyuan/rst-renderer'

const rst = `
Hello rst-renderer
==================

This is **bold** and *italic* text.

.. note::

   Use ``wrapHtmlDocument`` to get a complete, styled page.
`

const html = renderRst(rst)                 // HTML fragment (level-1 → <h2>)
const page = wrapHtmlDocument(html, { title: 'Hello' }) // full document + theme
```

Rendering backends:

```ts
// React
import { ReactRenderer } from '@seqyuan/rst-renderer/react'

// Markdown
import { MarkdownRenderer, createBuiltinParser } from '@seqyuan/rst-renderer'
const doc = createBuiltinParser().parse({ input: rst }).document
const md = new MarkdownRenderer({ headingOffset: 1 }).render(doc)
```

### CLI

```bash
# HTML fragment to stdout
rst-render input.rst

# Self-contained single-file HTML report
rst-render input.rst -s -o report.html

# Markdown / React
rst-render input.rst --md
rst-render input.rst --react
```

Key options: `-o/--output`, `-s/--standalone`, `--title`, `--css`, `--no-theme`,
`--fragment`, `--md`, `--react`, `-t/--template`, `-d/--data`, `-v/--var`,
`--scan name=glob`, `--expand-includes`. Run `rst-render --help` for the full list.

### Vite

```ts
// vite.config.ts
import rst from '@seqyuan/vite-plugin-rst'

export default defineConfig({ plugins: [rst()] })
```

```ts
import { html, meta } from './doc.rst'   // rendered HTML + metadata
import md from './doc.rst?md'            // Markdown string
import meta from './doc.rst?meta'        // { title, headings }
```

## Data-driven reports (templates)

Keep structure in a `.rst.j2` template and inject project data at render time.
The template engine supports variables, `if`/`else`, `for` loops with `loop.*`
variables, and filters (`default`, `length`, `upper`, `lower`, `join`,
`tojson`, `int`, `float`, `abs`, `first`, `last`, `trim`).

```jinja
{{ project_name }}
{{ '=' * project_name.length }}

.. list-table:: Samples
   :header-rows: 1

   * - Name
     - Image
{% for plot in plots %}
   * - {{ plot.stem }}
     - {{ plot.path }}
{% endfor %}

.. image:: {{ plots[0].path }}
```

```bash
rst-render report.rst.j2 \
  -t \
  -d project.json \
  --scan plots=upload/plots/*_umap.png \
  --expand-includes \
  -o report.html -s
```

`--scan name=glob` injects an array under both `name` and `scans.name`; each
entry has `path`, `absPath`, `name`, `stem`, `ext`, `dir` and `size`. `-s`
inlines CSS and images so the report is a single, emailable file.

## Supported RST (and boundaries)

- **Core**: headings (underline and overline), paragraphs, bullet / enumerated /
  definition / field / option lists, literal blocks, line blocks, block quotes,
  transitions, comments, footnotes and citations, hyperlink targets,
  substitutions.
- **Tables**: `.. csv-table::` (inline CSV or `:file:`), `.. list-table::`, and
  builtin simple (`====  ====`) and grid (`+---+---+`) tables.
- **Directives**: `image`, `figure`, admonitions (`note`, `warning`, `tip`, …),
  `code` / `code-block` / `sourcecode` (Shiki), `math` (KaTeX, block + inline
  role), `contents`, `toctree`, `raw:: html`, `container`, `include`, `replace`,
  `highlight`.
- **Not supported / intentionally limited**: full Sphinx cross-referencing and
  project graph, autodoc, roles beyond `:math:`, complex grid tables with
  spans. `include` is a build-time concern (use `--expand-includes`); `toctree`
  renders only the entries you list.

Optional integrations degrade gracefully: if Shiki or KaTeX are unavailable,
code falls back to plain `<pre>` and math falls back to escaped LaTeX.

## Documentation

The full documentation site lives in [`web/`](./web) (Fumadocs):

- Quick Start, RST Writing Rules, CLI, Template Engine
- HTML / React / Markdown rendering, Vite plugin
- Bioinformatics report tutorial

## Development

```bash
corepack pnpm install
corepack pnpm --filter "./packages/*" -r build

corepack pnpm --filter @seqyuan/rst-renderer test
corepack pnpm --filter @seqyuan/rst-cli test
corepack pnpm --filter @seqyuan/vite-plugin-rst test
```

See [CHANGELOG.md](./CHANGELOG.md) for release notes.

## License

[MIT](./LICENSE) © seqyuan
