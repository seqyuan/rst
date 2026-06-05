/**
 * CSV Table directive plugin.
 * Parses .. csv-table:: directives with :file: or inline CSV content.
 */
import type { DirectivePlugin } from './directives.ts'
import type { RstDirective } from '../ast/types.ts'
import type { HtmlRenderer } from '../renderer/html/index.ts'
import type { RenderContext } from '../renderer/base.ts'

export const csvTablePlugin: DirectivePlugin = {
  name: 'csv-table',
  directives: ['csv-table'],

  install(renderer: HtmlRenderer) {
    renderer.registerDirective('csv-table', (directive: RstDirective, ctx: RenderContext) => {
      const headerRows = parseInt(directive.options['header-rows'] ?? '0', 10)
      const widths = directive.options['widths']
        ? directive.options['widths'].split(/[\s,]+/).map(Number)
        : []
      const file = directive.options['file'] ?? ''

      // Get CSV content from either :file: or body
      let csvText = ''
      if (file) {
        // File references are resolved externally — render placeholder
        ctx.write(`<!-- csv-table: file="${file}" -->\n`)
        ctx.write(`<table class="csv-table" data-file="${file}">\n`)
        if (headerRows > 0) ctx.write('<thead><tr><th>(loading...)</th></tr></thead>\n')
        ctx.write('</table>\n')
        return
      }

      // Inline CSV from directive body
      const bodyText = directive.children
        .map(c => c.text)
        .join('\n')
        .trim()

      if (!bodyText) {
        ctx.write('<!-- csv-table: empty -->\n')
        return
      }

      const rows = parseCsv(bodyText)
      if (rows.length === 0) {
        ctx.write('<!-- csv-table: no rows -->\n')
        return
      }

      ctx.write('<table class="csv-table">\n')

      // Header rows
      if (headerRows > 0) {
        ctx.write('<thead>\n')
        for (let i = 0; i < headerRows && i < rows.length; i++) {
          const row = rows[i]!
          ctx.write('<tr>')
          for (const cell of row) {
            ctx.write(`<th>${cell}</th>`)
          }
          ctx.write('</tr>\n')
        }
        ctx.write('</thead>\n')
      }

      // Body rows
      ctx.write('<tbody>\n')
      const startRow = headerRows
      for (let i = startRow; i < rows.length; i++) {
        const row = rows[i]!
        ctx.write('<tr>')
        for (let j = 0; j < row.length; j++) {
          const cell = row[j]!
          const style = widths[j] ? ` style="width:${widths[j]}%"` : ''
          ctx.write(`<td${style}>${cell}</td>`)
        }
        ctx.write('</tr>\n')
      }
      ctx.write('</tbody>\n')
      ctx.write('</table>\n')
    })
  },
}

/**
 * Parse CSV text into a 2D array of strings.
 * Handles quoted fields and escaped quotes.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  const lines = text.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const cells: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i]!
      const next = trimmed[i + 1]

      if (inQuotes) {
        if (ch === '"' && next === '"') {
          current += '"'
          i++ // skip next
        } else if (ch === '"') {
          inQuotes = false
        } else {
          current += ch
        }
      } else {
        if (ch === '"') {
          inQuotes = true
        } else if (ch === ',') {
          cells.push(current.trim())
          current = ''
        } else {
          current += ch
        }
      }
    }
    cells.push(current.trim())

    if (cells.some(c => c !== '')) {
      rows.push(cells)
    }
  }

  return rows
}
