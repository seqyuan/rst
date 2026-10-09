import type { RstDirective } from '../ast/types'
import type { RenderContext } from '../renderer/base'
import { escapeHtml } from '../renderer/base'
import type { HtmlRenderer } from '../renderer/html/index'
import { collectHeadingItems, parseToctreeEntries } from '../utils/toc'
import { optionalRequire } from '../utils/optional-modules'
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

      const attrs: string[] = [`src="${escapeHtml(src)}"`]
      if (alt) attrs.push(`alt="${escapeHtml(alt)}"`)
      if (align) attrs.push(`align="${escapeHtml(align)}"`)
      attrs.push(...sizeAttrs(width, height))

      ctx.write(`<img ${attrs.join(' ')} />\n`)
    })

    renderer.registerDirective('figure', (directive, ctx, renderChildren) => {
      const src = directive.arguments[0] ?? ''
      const alt = directive.options['alt'] ?? ''
      const width = directive.options['width'] ?? ''
      const height = directive.options['height'] ?? ''
      const align = directive.options['align'] ?? ''

      const attrs: string[] = [`src="${escapeHtml(src)}"`]
      if (alt) attrs.push(`alt="${escapeHtml(alt)}"`)
      if (align) attrs.push(`align="${escapeHtml(align)}"`)
      attrs.push(...sizeAttrs(width, height))

      ctx.write('<figure>\n')
      ctx.write(`<img ${attrs.join(' ')} />\n`)
      if (directive.children.length > 0) {
        ctx.write('<figcaption>')
        renderChildren(directive.children, ctx)
        ctx.write('</figcaption>\n')
      }
      ctx.write('</figure>\n')
    })
  },
}

/**
 * Build width/height attributes for an image.
 *
 * RST allows `:width: 600` (pixels) and `:width: 600px` / `:width: 50%`.
 * The HTML `width` attribute only accepts a plain integer, so anything else
 * is emitted as a CSS declaration instead of being copied verbatim into a
 * (invalid) `width="600px"` attribute the browser would ignore.
 */
function sizeAttrs(width: string, height: string): string[] {
  const attrs: string[] = []
  const styles: string[] = []

  for (const [prop, value] of [['width', width], ['height', height]] as const) {
    const v = value.trim()
    if (!v) continue
    if (/^\d+$/.test(v)) {
      attrs.push(`${prop}="${v}"`)
    } else {
      styles.push(`${prop}:${v}`)
    }
  }

  if (styles.length > 0) attrs.push(`style="${escapeHtml(styles.join(';'))}"`)
  return attrs
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
      ctx.write(`<div class="admonition admonition-${escapeHtml(type)}">\n`)
      ctx.write(`<p class="admonition-title">${escapeHtml(title)}</p>\n`)
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
let shikiInitPromise: Promise<void> | null = null
const shikiLoadedLangs = new Set<string>()
const shikiPendingLangs = new Set<string>()

/**
 * Kick off Shiki loading and return the in-flight promise.
 * Loading is idempotent; awaiting it (see `preloadRenderers`) guarantees the
 * first render is highlighted instead of falling back to plain text.
 */
function initShiki(): Promise<void> {
  if (!shikiInitPromise) shikiInitPromise = loadShiki()
  return shikiInitPromise
}

async function loadShiki(): Promise<void> {
  try {
    const shiki = optionalRequire('shiki') as typeof import('shiki') | null
    if (!shiki || typeof shiki.getSingletonHighlighter !== 'function') return

    const highlighter = await shiki.getSingletonHighlighter({
      themes: ['github-light'],
      langs: [...SHIKI_COMMON_LANGS],
    })
    shikiHighlighter = highlighter
    for (const lang of SHIKI_COMMON_LANGS) {
      shikiLoadedLangs.add(lang)
    }
  } catch {
    /* fallback to plain pre/code */
  }
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

/**
 * Extract the raw source text of a directive body.
 *
 * Directives such as `code` and `math` must not render their children to
 * collect content: the literal-block renderer already produces HTML
 * (`<pre><code>…`), and escaping that HTML again yielded output such as
 * `&lt;pre&gt;&lt;code&gt;…` that also broke KaTeX (it received HTML as LaTeX).
 */
function collectDirectiveText(directive: RstDirective): string {
  const parts: string[] = []
  for (const child of directive.children) {
    const text = (child as { text?: unknown }).text
    if (typeof text === 'string' && text.length > 0) parts.push(text)
  }
  if (parts.length > 0) return parts.join('\n')
  // Strip the single trailing newline the tokenizer leaves behind.
  return (directive.rawBody ?? '').replace(/\n$/, '')
}

type KatexRenderer = (latex: string, displayMode: boolean) => string
let katexRenderer: KatexRenderer | null | undefined

/** Lazily resolve KaTeX, or `null` when it is unavailable. */
function getKatex(): KatexRenderer | null {
  if (katexRenderer !== undefined) return katexRenderer
  katexRenderer = null

  const katex = optionalRequire('katex') as
    | { renderToString?: (latex: string, opts?: unknown) => string }
    | null
  if (katex && typeof katex.renderToString === 'function') {
    const renderToString = katex.renderToString.bind(katex)
    katexRenderer = (latex, displayMode) => {
      try {
        return renderToString(latex, { throwOnError: false, displayMode })
      } catch {
        return ''
      }
    }
  }
  return katexRenderer
}

/**
 * Warm up optional renderers (KaTeX, Shiki). Await once before rendering a
 * batch — e.g. from the CLI — so the first document gets full syntax
 * highlighting and math instead of silently falling back.
 */
export async function preloadRenderers(): Promise<void> {
  getKatex()
  await initShiki()
}

/** Code directive with optional Shiki syntax highlighting. */
export const codePlugin: DirectivePlugin = {
  name: 'code',
  directives: ['code', 'code-block', 'sourcecode'],
  install(renderer) {
    void initShiki()

    const handler = (directive: RstDirective, ctx: RenderContext) => {
      const language = directive.arguments[0] ?? directive.options['language'] ?? ''
      const code = collectDirectiveText(directive)

      try {
        if (language && code.trim()) {
          const html = shikiHighlight(code, language)
          if (html) {
            ctx.write(html + '\n')
            return
          }
        }
      } catch { /* fallback */ }

      const langAttr = language ? ` data-language="${escapeHtml(language)}"` : ''
      ctx.write(`<pre class="code-block"${langAttr}><code>${escapeHtml(code)}</code></pre>\n`)
    }

    // Register every accepted name — previously only `code` was registered, so
    // `.. code-block::` silently fell through and lost its language/marking.
    for (const name of this.directives) {
      renderer.registerDirective(name, handler)
    }
  },
}

/** `.. highlight:: lang` is a setting directive and produces no output. */
export const highlightPlugin: DirectivePlugin = {
  name: 'highlight',
  directives: ['highlight'],
  install(renderer) {
    renderer.registerDirective('highlight', () => { /* setting only */ })
  },
}

/** Math directive with KaTeX rendering plus the inline `:math:` role. */
export const mathPlugin: DirectivePlugin = {
  name: 'math',
  directives: ['math'],
  install(renderer) {
    const renderMath = (latex: string, displayMode: boolean): string => {
      const trimmed = latex.trim()
      if (!trimmed) return ''

      const katex = getKatex()
      if (katex) {
        const html = katex(trimmed, displayMode)
        if (html) return html
      }

      const escaped = escapeHtml(trimmed)
      return displayMode ? `\\[${escaped}\\]` : `\\(${escaped}\\)`
    }

    renderer.registerDirective('math', (directive, ctx) => {
      const latex = collectDirectiveText(directive)
      ctx.write(`<div class="math">${renderMath(latex, true)}</div>\n`)
    })

    // Inline role: :math:`E = mc^2`
    renderer.registerInlineRole('math', (text, ctx) => {
      ctx.write(`<span class="math math-inline">${renderMath(text, false)}</span>`)
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

      const caption = directive.arguments.join(' ').trim()
      const rows = parseListTableRows(directive.rawBody ?? '')
      if (rows.length === 0) {
        ctx.write('<!-- list-table: empty -->\n')
        return
      }

      ctx.write('<table class="list-table">\n')
      if (caption) ctx.write(`<caption>${escapeHtml(caption)}</caption>\n`)

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

/** Raw directive: .. raw:: html — emits the body verbatim, no escaping. */
export const rawPlugin: DirectivePlugin = {
  name: 'raw',
  directives: ['raw'],
  install(renderer) {
    renderer.registerDirective('raw', (directive, ctx) => {
      const format = (directive.arguments[0] ?? 'html').toLowerCase()
      if (format !== 'html') return // other formats are silently ignored
      const body = (directive.rawBody ?? '').replace(/\n$/, '')
      if (body) ctx.write(body + '\n')
    })
  },
}

/** Container directive: .. container:: name */
export const containerPlugin: DirectivePlugin = {
  name: 'container',
  directives: ['container'],
  install(renderer) {
    renderer.registerDirective('container', (directive, ctx, renderChildren) => {
      const className = directive.arguments.join(' ').trim()
      ctx.write(`<div${className ? ` class="${escapeHtml(className)}"` : ''}>\n`)
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
  highlightPlugin,
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
