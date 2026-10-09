/**
 * CSV Table directive plugin.
 * Parses .. csv-table:: directives with :file: or inline CSV content.
 */
import type { DirectivePlugin } from './directives'
import type { RstDirective } from '../ast/types'
import type { HtmlRenderer } from '../renderer/html/index'
import { escapeHtml, type RenderContext } from '../renderer/base'
import { optionalRequire } from '../utils/optional-modules'

/**
 * Best-effort read of a `:file:`-referenced CSV relative to `ctx.data.baseDir`
 * (or `process.cwd()`), returning `null` in browser bundles or when the file
 * is missing so callers can fall back to a placeholder.
 */
function readCsvFile(file: string, ctx: RenderContext): string | null {
  const fs = optionalRequire('node:fs') as typeof import('node:fs') | null
  const path = optionalRequire('node:path') as typeof import('node:path') | null
  if (!fs || !path) return null

  const proc = (globalThis as { process?: { cwd?: () => string } }).process
  const baseDir = typeof ctx.data['baseDir'] === 'string'
    ? (ctx.data['baseDir'] as string)
    : (proc?.cwd?.() ?? '.')
  const abs = path.isAbsolute(file) ? file : path.resolve(baseDir, file)

  try {
    if (!fs.existsSync(abs)) return null
    return fs.readFileSync(abs, 'utf-8')
  } catch {
    return null
  }
}

export const csvTablePlugin: DirectivePlugin = {
  name: 'csv-table',
  directives: ['csv-table'],

  install(renderer: HtmlRenderer) {
    renderer.registerDirective('csv-table', (directive: RstDirective, ctx: RenderContext) => {
      const widths = directive.options['widths']
        ? directive.options['widths'].split(/[\s,]+/).map(Number)
        : []
      const file = directive.options['file'] ?? ''
      const caption = directive.arguments.join(' ').trim()

      // RST's standard way of declaring a header is `:header: a, b, c`
      // (a comma-separated list); `:header-rows: 1` is also accepted.
      const headerOption = (directive.options['header'] ?? '').trim()
      let headerRows = parseInt(directive.options['header-rows'] ?? '0', 10)
      if (!Number.isFinite(headerRows) || headerRows < 0) headerRows = 0

      const fileContent = file ? readCsvFile(file, ctx) : null

      if (file && fileContent === null) {
        // The file could not be read (browser bundle, missing file, or no
        // filesystem access): emit a resolvable placeholder for the host app.
        ctx.write(`<!-- csv-table: file="${escapeHtml(file)}" -->\n`)
        ctx.write(`<table class="csv-table" data-file="${escapeHtml(file)}">\n`)
        if (caption) ctx.write(`<caption>${escapeHtml(caption)}</caption>\n`)
        ctx.write('</table>\n')
        return
      }

      const bodyText = (fileContent ?? directive.rawBody ?? directive.children
        .map(c => c.text)
        .join('\n'))
        .trim()

      if (!bodyText) {
        ctx.write('<!-- csv-table: empty -->\n')
        return
      }

      let rows = parseCsv(bodyText)

      if (headerOption) {
        rows = [headerOption.split(',').map(cell => cell.trim()), ...rows]
        headerRows = 1
      }

      if (rows.length === 0) {
        ctx.write('<!-- csv-table: no rows -->\n')
        return
      }

      ctx.write('<table class="csv-table">\n')
      if (caption) ctx.write(`<caption>${escapeHtml(caption)}</caption>\n`)

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
