import type { RstDirective } from '../ast/types'
import type { RenderContext } from '../renderer/base'
import { escapeHtml } from '../renderer/base'
import type { HtmlRenderer } from '../renderer/html/index'

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

/** Code directive with optional Shiki syntax highlighting. */
export const codePlugin: DirectivePlugin = {
  name: 'code',
  directives: ['code', 'code-block', 'sourcecode', 'highlight'],
  install(renderer) {
    let shikiHighlight: ((code: string, lang: string) => string) | null = null
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const shiki = require('shiki')
      if (shiki && typeof shiki.codeToHtml === 'function') {
        shikiHighlight = (code, lang) => {
          try {
            // Shiki codeToHtml: may be sync or async depending on version
            const result = (shiki as any).codeToHtml(code, { lang, theme: 'github-light' })
            return typeof result === 'string' ? result : ''
          } catch {
            return ''
          }
        }
      }
    } catch { /* Shiki not installed, use plain pre/code */ }

    renderer.registerDirective('code', (directive, ctx, renderChildren) => {
      const language = directive.arguments[0] ?? directive.options['language'] ?? ''

      // Collect code content
      const codeParts: string[] = []
      const subCtx = { ...ctx, write: (s: string) => codeParts.push(s) }
      renderChildren(directive.children, subCtx)
      const code = codeParts.join('')

      try {
        if (shikiHighlight && language && code.trim()) {
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
    // These are typically handled by the document-level TOC extraction
    renderer.registerDirective('contents', (_directive, ctx) => {
      ctx.write('<!-- Table of Contents placeholder -->\n')
    })
  },
}

/** CSV table directive: .. csv-table:: */
export const csvTablePlugin: DirectivePlugin = {
  name: 'csv-table',
  directives: ['csv-table'],
  install(renderer) {
    renderer.registerDirective('csv-table', (_directive, ctx) => {
      ctx.write('<!-- csv-table placeholder -->\n')
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
  replacePlugin,
  rawPlugin,
  containerPlugin,
  includePlugin,
]
