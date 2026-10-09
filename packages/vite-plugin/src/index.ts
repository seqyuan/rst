// ---------------------------------------------------------------------------
// @seqyuan/vite-plugin-rst — Import .rst files in Vite projects
// ---------------------------------------------------------------------------
//
// Usage (vite.config.ts):
//   import rst from '@seqyuan/vite-plugin-rst'
//   export default defineConfig({ plugins: [rst()] })
//
// Then in your code:
//   import { html, meta } from './doc.rst'
//   // html = rendered HTML string
//   // meta = { title: string, headings: string[] }
//
// Or with query params:
//   import html from './doc.rst?html'     // HTML string (default)
//   import md from './doc.rst?md'         // Markdown string
//   import meta from './doc.rst?meta'     // Metadata only
//

import type { Plugin } from 'vite'

export interface RstPluginOptions {
  /** Default output format when no query param is specified. */
  defaultFormat?: 'html' | 'md' | 'react'
  /** Inject CSS for default styles. */
  includeDefaultStyles?: boolean
}

const RST_FILE_RE = /\.rst(?:\?|$)/
const QUERY_RE = /[?&](html|md|react|meta)(?:&|$)/

interface RstRendererModule {
  renderRst: (source: string) => string
  MarkdownRenderer: new (options?: { headingOffset?: number }) => {
    render: (document: unknown) => string
  }
  createBuiltinParser: () => { parse: (opts: { input: string }) => { document: unknown } }
}

let rendererPromise: Promise<RstRendererModule> | null = null

/**
 * Load `@seqyuan/rst-renderer` via dynamic `import()`.
 *
 * The package is ESM and its `exports` map only declares the `import`
 * condition, so `createRequire(...)('@seqyuan/rst-renderer')` failed with
 * `ERR_PACKAGE_PATH_NOT_EXPORTED`. An async `transform` can simply import it.
 */
function loadRenderer(): Promise<RstRendererModule> {
  if (!rendererPromise) {
    rendererPromise = import('@seqyuan/rst-renderer') as Promise<RstRendererModule>
  }
  return rendererPromise
}

export default function rstPlugin(options: RstPluginOptions = {}): Plugin {
  const { defaultFormat = 'html' } = options

  return {
    name: 'vite-plugin-rst',

    async transform(code: string, id: string) {
      if (!RST_FILE_RE.test(id)) return null

      // Determine output format
      const queryMatch = id.match(QUERY_RE)
      const format = queryMatch ? queryMatch[1]! : defaultFormat

      try {
        if (format === 'meta') {
          return {
            code: exportMeta(code),
            map: null,
          }
        }

        const { renderRst, MarkdownRenderer, createBuiltinParser } = await loadRenderer()
        const parser = createBuiltinParser()

        if (format === 'md') {
          const document = parser.parse({ input: code }).document
          const output = new MarkdownRenderer({ headingOffset: 1 }).render(document)
          return {
            code: `export default ${JSON.stringify(output)}`,
            map: null,
          }
        }

        if (format === 'react') {
          // Generate a React component module
          const document = parser.parse({ input: code }).document
          return {
            code: generateReactModule(document),
            map: null,
          }
        }

        // Default: HTML
        const output = renderRst(code)
        return {
          code: `export const html = ${JSON.stringify(output)}\nexport default html`,
          map: null,
        }
      } catch (err) {
        this.error(`Failed to parse RST file "${id}": ${err instanceof Error ? err.message : String(err)}`)
      }
    },

    handleHotUpdate({ file, server }) {
      if (file.endsWith('.rst')) {
        server.ws.send({ type: 'full-reload' })
      }
    },
  }
}

function exportMeta(source: string): string {
  // Extract title from first heading
  const titleMatch = source.match(/^(.+)\n[=\-~`'^"+*#.:]{3,}\s*$/m)
  const title = titleMatch ? titleMatch[1]! : ''

  // Extract all headings
  const headings: string[] = []
  const headingRe = /^(.+)\n[=\-~`'^"+*#.:]{3,}\s*$/gm
  let m: RegExpExecArray | null
  while ((m = headingRe.exec(source)) !== null) {
    headings.push(m[1]!)
  }

  const meta = { title, headings }
  return `export const meta = ${JSON.stringify(meta)}\nexport default meta`
}

function generateReactModule(document: unknown): string {
  return `import { ReactRenderer } from '@seqyuan/rst-renderer/react'

const document = ${JSON.stringify(document, null, 2)}

const renderer = new ReactRenderer()

export default function RstPage() {
  return renderer.render(document)
}
`
}
