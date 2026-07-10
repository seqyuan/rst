/**
 * CSV Table directive plugin.
 * Parses .. csv-table:: directives with :file: or inline CSV content.
 */
import type { DirectivePlugin } from './directives'
import type { RstDirective } from '../ast/types'
import type { HtmlRenderer } from '../renderer/html/index'
import { escapeHtml, type RenderContext } from '../renderer/base'

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

      if (file) {
        ctx.write(`<!-- csv-table: file="${escapeHtml(file)}" -->\n`)
        ctx.write(`<table class="csv-table" data-file="${escapeHtml(file)}">\n`)
        if (headerRows > 0) ctx.write('<thead><tr><th>(loading...)</th></tr></thead>\n')
        ctx.write('</table>\n')
        return
      }

      const bodyText = (directive.rawBody ?? directive.children
        .map(c => c.text)
        .join('\n'))
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

      if (headerRows > 0) {
        ctx.write('<thead>\n')
        for (let i = 0; i < headerRows && i < rows.length; i++) {
          writeCsvTableRow(ctx, rows[i]!, 'th', widths)
        }
        ctx.write('</thead>\n')
      }

      ctx.write('<tbody>\n')
      for (let i = headerRows; i < rows.length; i++) {
        writeCsvTableRow(ctx, rows[i]!, 'td', widths)
      }
      ctx.write('</tbody>\n')
      ctx.write('</table>\n')
    })
  },
}

function writeCsvTableRow(
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
          i++
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
