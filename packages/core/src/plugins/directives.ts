import type { RstDirective } from '../ast/types'
import type { RenderContext } from '../renderer/base'
import { escapeHtml } from '../renderer/base'
import type { HtmlRenderer } from '../renderer/html/index'
import { collectHeadingItems, parseToctreeEntries } from '../utils/toc'
import type { BundledLanguage, Highlighter } from 'shiki'
import { csvTablePlugin } from './csv-table'

/**
 * A directive plugin that hooks into the HTML renderer.
 * Each plugin registers one or more directive names.
 */
export interface DirectivePlugin {
  readonly name: string
  readonly directives: string[]
  install(renderer: HtmlRenderer): void
}

// ---------------------------------------------------------------------------
// Built-in directive plugins
// ---------------------------------------------------------------------------

/** Image directive: .. image:: path.png */
export const imagePlugin: DirectivePlugin = {
  name: 'image',
  directives: ['image', 'figure'],
  install(renderer) {
    renderer.registerDirective('image', (directive, ctx) => {
      const src = directive.arguments[0] ?? ''
      const alt = directive.options['alt'] ?? ''
      const width = directive.options['width'] ?? ''
      const height = directive.options['height'] ?? ''
      const align = directive.options['align'] ?? ''

      const attrs: string[] = [`src="${src}"`]
      if (alt) attrs.push(`alt="${alt}"`)
      if (width) attrs.push(`width="${width}"`)
      if (height) attrs.push(`height="${height}"`)
      if (align) attrs.push(`align="${align}"`)

      ctx.write(`<img ${attrs.join(' ')} />\n`)
    })

    renderer.registerDirective('figure', (directive, ctx, renderChildren) => {
      ctx.write('<figure>\n')
      const src = directive.arguments[0] ?? ''
      ctx.write(`<img src="${src}" />\n`)
      if (directive.children.length > 0) {
        ctx.write('<figcaption>')
        renderChildren(directive.children, ctx)
        ctx.write('</figcaption>\n')
      }
      ctx.write('</figure>\n')
    })
  },
}

/** Admonition directives: note, warning, tip, etc. */
export const admonitionPlugin: DirectivePlugin = {
  name: 'admonition',
  directives: [
    'admonition', 'attention', 'caution', 'danger', 'error',
    'hint', 'important', 'note', 'tip', 'warning',
  ],
  install(renderer) {
    const handler = (directive: RstDirective, ctx: RenderContext, renderChildren: (blocks: typeof directive.children, ctx: RenderContext) => void) => {
      const type = directive.name.toLowerCase()
      const title = directive.arguments[0] ?? type.charAt(0).toUpperCase() + type.slice(1)
      ctx.write(`<div class="admonition admonition-${type}">\n`)
      ctx.write(`<p class="admonition-title">${title}</p>\n`)
      renderChildren(directive.children, ctx)
      ctx.write('</div>\n')
    }

    for (const name of this.directives) {
      renderer.registerDirective(name, handler)
    }
  },
}

const SHIKI_COMMON_LANGS = [
  'javascript', 'typescript', 'python', 'bash', 'shell', 'json', 'yaml',
  'markdown', 'r', 'sql', 'go', 'rust', 'html', 'css', 'text',
] as const

let shikiHighlighter: Highlighter | null = null
let shikiInitStarted = false
const shikiLoadedLangs = new Set<string>()
const shikiPendingLangs = new Set<string>()

function initShiki(): void {
  if (shikiInitStarted) return
  shikiInitStarted = true

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const shiki = require('shiki') as typeof import('shiki')
    if (typeof shiki.getSingletonHighlighter !== 'function') return

    void shiki.getSingletonHighlighter({
      themes: ['github-light'],
      langs: [...SHIKI_COMMON_LANGS],
    }).then((highlighter) => {
      shikiHighlighter = highlighter
      for (const lang of SHIKI_COMMON_LANGS) {
        shikiLoadedLangs.add(lang)
      }
    }).catch(() => { /* fallback to plain pre/code */ })
  } catch { /* Shiki not installed */ }
}

function asShikiLang(lang: string): BundledLanguage {
  return lang as BundledLanguage
}

function shikiHighlight(code: string, lang: string): string {
  if (!shikiHighlighter || !lang) return ''

  const normalizedLang = lang.toLowerCase()
  if (!shikiLoadedLangs.has(normalizedLang)) {
    if (!shikiPendingLangs.has(normalizedLang)) {
      shikiPendingLangs.add(normalizedLang)
      void shikiHighlighter.loadLanguage(asShikiLang(normalizedLang))
        .then(() => {
          shikiLoadedLangs.add(normalizedLang)
          shikiPendingLangs.delete(normalizedLang)
        })
        .catch(() => {
          shikiPendingLangs.delete(normalizedLang)
        })
    }
    return ''
  }

  try {
    return shikiHighlighter.codeToHtml(code, { lang: asShikiLang(normalizedLang), theme: 'github-light' })
  } catch {
    return ''
  }
}

/** Code directive with optional Shiki syntax highlighting. */
export const codePlugin: DirectivePlugin = {
  name: 'code',
  directives: ['code', 'code-block', 'sourcecode', 'highlight'],
  install(renderer) {
    initShiki()

    renderer.registerDirective('code', (directive, ctx, renderChildren) => {
      const language = directive.arguments[0] ?? directive.options['language'] ?? ''

      // Collect code content
      const codeParts: string[] = []
      const subCtx = { ...ctx, write: (s: string) => codeParts.push(s) }
      renderChildren(directive.children, subCtx)
      const code = codeParts.join('')

      try {
        if (language && code.trim()) {
          const html = shikiHighlight(code, language)
          if (html) {
            ctx.write(html + '\n')
            return
          }
        }
      } catch { /* fallback */ }

      const langAttr = language ? ` data-language="${language}"` : ''
      ctx.write(`<pre class="code-block"${langAttr}><code>${escapeHtml(code)}</code></pre>\n`)
    })
  },
}

/** Math directive with KaTeX rendering. */
export const mathPlugin: DirectivePlugin = {
  name: 'math',
  directives: ['math'],
  install(renderer) {
    let katexRender: ((latex: string) => string) | null = null
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const katex = require('katex') as typeof import('katex')
      if (katex.renderToString) {
        katexRender = (latex: string) => {
          try {
            return katex.renderToString(latex, { throwOnError: false, displayMode: true })
          } catch {
            return ''
          }
        }
      }
    } catch { /* KaTeX not installed */ }

    renderer.registerDirective('math', (directive, ctx, renderChildren) => {
      const mathParts: string[] = []
      const subCtx = { ...ctx, write: (s: string) => mathParts.push(s) }
      renderChildren(directive.children, subCtx)
      const latex = mathParts.join('').trim()

      if (katexRender && latex) {
        try {
          const html = katexRender(latex)
          if (html) {
            ctx.write(`<div class="math">${html}</div>\n`)
            return
          }
        } catch { /* fallback */ }
      }

      // Fallback: LaTeX source wrapped in div
      ctx.write(`<div class="math">\\[${escapeHtml(latex)}\\]</div>\n`)
    })
  },
}

/** Contents / toctree directive: .. contents:: */
export const contentsPlugin: DirectivePlugin = {
  name: 'contents',
  directives: ['contents', 'toctree'],
  install(renderer) {
    renderer.registerDirective('contents', (directive, ctx) => {
      const depth = parsePositiveIntOption(directive.options['depth']) ?? Number.POSITIVE_INFINITY
      const title = directive.arguments.join(' ').trim() || directive.options['caption'] || 'Contents'
      const headings = collectHeadingItems(ctx.document, depth)

      if (headings.length === 0) {
        ctx.write('<!-- contents: empty -->\n')
        return
      }

      ctx.write('<nav class="rst-contents-card" aria-label="Table of contents">\n')
      ctx.write(`<p class="rst-contents-title">${escapeHtml(title)}</p>\n`)
      ctx.write('<ol class="rst-contents-list">\n')
      for (const item of headings) {
        const levelAttr = item.level > 1 ? ` data-level="${item.level}"` : ''
        ctx.write(`<li class="rst-contents-item"${levelAttr}>`)
        ctx.write(`<a href="${escapeHtml(item.href)}">${escapeHtml(item.title)}</a>`)
        ctx.write('</li>\n')
      }
      ctx.write('</ol>\n')
      ctx.write('</nav>\n')
    })

    renderer.registerDirective('toctree', (directive, ctx) => {
      const title = directive.options['caption'] || directive.arguments.join(' ').trim() || 'Related Pages'
      const entries = parseToctreeEntries(directive.rawBody ?? '')

      if (entries.length === 0) {
        ctx.write('<!-- toctree: empty -->\n')
        return
      }

      ctx.write('<nav class="rst-toctree-card" aria-label="Document tree">\n')
      ctx.write(`<p class="rst-toctree-title">${escapeHtml(title)}</p>\n`)
      ctx.write('<div class="rst-toctree-grid">\n')
      for (const entry of entries) {
        ctx.write(`<a class="rst-toctree-link" href="${escapeHtml(entry.href)}">`)
        ctx.write(`<span class="rst-toctree-link-title">${escapeHtml(entry.title)}</span>`)
        ctx.write(`<span class="rst-toctree-link-path">${escapeHtml(entry.href)}</span>`)
        ctx.write('</a>\n')
      }
      ctx.write('</div>\n')
      ctx.write('</nav>\n')
    })
  },
}

export { csvTablePlugin }

/** List table directive: .. list-table:: */
export const listTablePlugin: DirectivePlugin = {
  name: 'list-table',
  directives: ['list-table'],
  install(renderer) {
    renderer.registerDirective('list-table', (directive, ctx) => {
      const headerRows = parseInt(directive.options['header-rows'] ?? '0', 10)
      const widths = directive.options['widths']
        ? directive.options['widths'].split(/[\s,]+/).map(Number)
        : []

      const rows = parseListTableRows(directive.rawBody ?? '')
      if (rows.length === 0) {
        ctx.write('<!-- list-table: empty -->\n')
        return
      }

      ctx.write('<table class="list-table">\n')

      if (headerRows > 0) {
        ctx.write('<thead>\n')
        for (let i = 0; i < headerRows && i < rows.length; i++) {
          writeListTableRow(ctx, rows[i]!, 'th', widths)
        }
        ctx.write('</thead>\n')
      }

      ctx.write('<tbody>\n')
      for (let i = headerRows; i < rows.length; i++) {
        writeListTableRow(ctx, rows[i]!, 'td', widths)
      }
      ctx.write('</tbody>\n')
      ctx.write('</table>\n')
    })
  },
}

/** Replace directive: .. |ref| replace:: content */
export const replacePlugin: DirectivePlugin = {
  name: 'replace',
  directives: ['replace', 'unicode'],
  install(renderer) {
    renderer.registerDirective('replace', (directive, ctx, renderChildren) => {
      renderChildren(directive.children, ctx)
    })
  },
}

/** Raw directive: .. raw:: html */
export const rawPlugin: DirectivePlugin = {
  name: 'raw',
  directives: ['raw'],
  install(renderer) {
    renderer.registerDirective('raw', (directive, ctx, renderChildren) => {
      const format = directive.arguments[0] ?? 'html'
      if (format === 'html') {
        renderChildren(directive.children, ctx)
      }
      // Other formats are silently ignored
    })
  },
}

/** Container directive: .. container:: name */
export const containerPlugin: DirectivePlugin = {
  name: 'container',
  directives: ['container'],
  install(renderer) {
    renderer.registerDirective('container', (directive, ctx, renderChildren) => {
      const className = directive.arguments[0] ?? ''
      ctx.write(`<div class="${className}">\n`)
      renderChildren(directive.children, ctx)
      ctx.write('</div>\n')
    })
  },
}

/** Include directive: .. include:: path.rst */
export const includePlugin: DirectivePlugin = {
  name: 'include',
  directives: ['include'],
  install(renderer) {
    renderer.registerDirective('include', (directive, ctx) => {
      const path = directive.arguments[0] ?? ''
      // File inclusion is resolved at the application level.
      // Render a placeholder that can be processed by a build system.
      ctx.write(`<!-- include: ${escapeHtml(path)} -->\n`)
    })
  },
}

/** All built-in directive plugins in recommended order. */
export const builtinDirectivePlugins: DirectivePlugin[] = [
  imagePlugin,
  admonitionPlugin,
  codePlugin,
  mathPlugin,
  contentsPlugin,
  csvTablePlugin,
  listTablePlugin,
  replacePlugin,
  rawPlugin,
  containerPlugin,
  includePlugin,
]

function writeListTableRow(
  ctx: RenderContext,
  row: string[],
  tag: 'th' | 'td',
  widths: number[],
): void {
  ctx.write('<tr>')
  for (let i = 0; i < row.length; i++) {
    const cell = escapeHtml(row[i]!)
    const style = widths[i] ? ` style="width:${widths[i]}%"` : ''
    ctx.write(`<${tag}${style}>${cell}</${tag}>`)
  }
  ctx.write('</tr>\n')
}

function parseListTableRows(rawBody: string): string[][] {
  const lines = rawBody.split(/\r?\n/)
  const rows: string[][] = []
  let currentRow: string[] | null = null
  let currentCellIndex = -1

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const rowMatch = line.match(/^\s*\*\s+-\s+(.*)$/)
    if (rowMatch) {
      if (currentRow) rows.push(currentRow)
      currentRow = [rowMatch[1]!.trim()]
      currentCellIndex = 0
      continue
    }

    const cellMatch = line.match(/^\s+-\s+(.*)$/)
    if (cellMatch && currentRow) {
      currentRow.push(cellMatch[1]!.trim())
      currentCellIndex = currentRow.length - 1
      continue
    }

    if (currentRow && currentCellIndex >= 0) {
      const continuation = trimmed
      currentRow[currentCellIndex] = `${currentRow[currentCellIndex]} ${continuation}`.trim()
    }
  }

  if (currentRow) rows.push(currentRow)
  return rows
}

function parsePositiveIntOption(value: string | undefined): number | null {
  if (!value) return null
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}
