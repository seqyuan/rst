#!/usr/bin/env node
// ---------------------------------------------------------------------------
// rst-render — CLI tool for reStructuredText
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname, extname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { buildTemplateContext, parseScanSpec } from './context'
import type { ScanSpec } from './context'

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

interface Args {
  input?: string
  output?: string
  format: 'html' | 'md' | 'react' | 'template'
  data?: string
  vars: Record<string, string>
  scans: ScanSpec[]
  expandIncludes: boolean
  standalone: boolean
  help: boolean
}

export function parseArgs(raw: string[]): Args {
  const args: Args = {
    format: 'html',
    vars: {},
    scans: [],
    expandIncludes: false,
    help: false,
    standalone: false,
  }
  let i = 0

  while (i < raw.length) {
    const arg = raw[i]!

    switch (arg) {
      case '-h':
      case '--help':
        args.help = true
        break
      case '-o':
      case '--output':
        args.output = raw[++i]
        break
      case '--md':
      case '--markdown':
        args.format = 'md'
        break
      case '--react':
        args.format = 'react'
        break
      case '--template':
      case '-t':
        args.format = 'template'
        break
      case '--standalone':
      case '-s':
        args.standalone = true
        break
      case '--expand-includes':
        args.expandIncludes = true
        break
      case '--data':
      case '-d':
        args.data = raw[++i]
        break
      case '--var':
      case '-v': {
        const kv = raw[++i]
        if (kv) {
          const eq = kv.indexOf('=')
          if (eq > 0) args.vars[kv.slice(0, eq)] = kv.slice(eq + 1)
          else args.vars[kv] = 'true'
        }
        break
      }
      case '--scan': {
        const scan = raw[++i]
        if (scan) args.scans.push(parseScanSpec(scan, args.scans.length))
        break
      }
      default:
        if (!arg.startsWith('-') && !args.input) {
          args.input = arg
        }
        break
    }
    i++
  }

  return args
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

export const HELP = `
rst-render — Render reStructuredText to HTML, Markdown, or React

Usage:
  rst-render <input.rst> [options]

Options:
  -o, --output <path>   Write output to file (default: stdout)
  -s, --standalone      Bundle into self-contained HTML (inline CSS + images)
  --md, --markdown       Output Markdown instead of HTML
  --react                Output React component code
  -t, --template         Render input as a Jinja2 template before HTML output
  -d, --data <path>      JSON file with template context data
  -v, --var key=value    Template variable (repeatable)
  --scan name=glob       Scan files relative to the input file directory
  --expand-includes      Resolve .. include:: directives before parsing
  -h, --help             Show this help

Examples:
  rst-render README.rst
  rst-render report.rst -o report.html --standalone
  rst-render docs.rst --md
  rst-render template.rst.j2 -t -d project.json --scan plots=upload/plots/*_umap.png -o out.html -s
`.trim()

// ---------------------------------------------------------------------------
// Standalone bundler: inline CSS + images into HTML
// ---------------------------------------------------------------------------

function makeStandalone(html: string, inputPath: string): string {
  const baseDir = dirname(resolve(inputPath))

  // Inline local <link rel="stylesheet" href="...">
  html = html.replace(
    /<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"[^>]*>/gi,
    (_match, href: string) => {
      if (href.startsWith('http')) return _match
      const cssPath = resolve(baseDir, href)
      if (!existsSync(cssPath)) return _match
      return `<style>\n${readFileSync(cssPath, 'utf-8')}\n</style>`
    },
  )

  // Inline local <img src="..."> as base64
  html = html.replace(
    /(<img[^>]+src=")([^"]+)("[^>]*>)/gi,
    (_match: string, prefix: string, src: string, suffix: string) => {
      if (src.startsWith('http') || src.startsWith('data:')) return _match
      const imgPath = resolve(baseDir, src)
      if (!existsSync(imgPath)) return _match
      const ext = extname(imgPath).slice(1).toLowerCase()
      const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`
      const data = readFileSync(imgPath)
      const b64 = data.toString('base64')
      return `${prefix}data:${mime};base64,${b64}${suffix}`
    },
  )

  // Inline local <script src="...">
  html = html.replace(
    /(<script[^>]+src=")([^"]+\.js)("[^>]*>)<\/script>/gi,
    (_match: string, prefix: string, src: string, suffix: string) => {
      if (src.startsWith('http')) return _match
      const jsPath = resolve(baseDir, src)
      if (!existsSync(jsPath)) return _match
      return `<script>${readFileSync(jsPath, 'utf-8')}</script>`
    },
  )

  return html
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function loadRenderer() {
  return import('@seqyuan/rst-renderer')
}

export async function main(rawArgs = process.argv.slice(2)) {
  const args = parseArgs(rawArgs)

  if (args.help || !args.input) {
    console.log(HELP)
    process.exit(args.help ? 0 : 1)
  }

  const inputPath = resolve(args.input)
  let source = ''

  try {
    source = readFileSync(inputPath, 'utf-8')
  } catch {
    console.error(`Error: Cannot read file "${args.input}"`)
    process.exit(1)
  }

  let templateContext: Record<string, unknown> = {}
  try {
    templateContext = buildTemplateContext(args.data, args.vars, args.scans, dirname(inputPath))
  } catch (err) {
    console.error('Error:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  }

  let output: string

  try {
    const {
      renderRst,
      renderRstTemplate,
      MarkdownRenderer,
      createBuiltinParser,
      expandIncludes,
    } = await loadRenderer()

    const includeResolver = args.expandIncludes
      ? { baseDir: dirname(inputPath) }
      : undefined

    switch (args.format) {
      case 'md': {
        const parser = createBuiltinParser()
        const rstSource = includeResolver ? expandIncludes(source, includeResolver) : source
        const document = parser.parse({ input: rstSource }).document
        output = new MarkdownRenderer({ headingOffset: 1 }).render(document)
        break
      }
      case 'template': {
        output = renderRstTemplate(source, templateContext, { includeResolver })
        break
      }
      case 'react': {
        const parser = createBuiltinParser()
        const rstSource = includeResolver ? expandIncludes(source, includeResolver) : source
        const document = parser.parse({ input: rstSource }).document
        output = `import { ReactRenderer } from '@seqyuan/rst-renderer/react'

const renderer = new ReactRenderer()
export default function RstDocument() {
  return renderer.render(${JSON.stringify(document, null, 2)})
}
`
        break
      }
      case 'html':
      default:
        output = renderRst(source, { includeResolver })
        break
    }
  } catch (err) {
    console.error('Error:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  }

  // Standalone bundling
  if (args.standalone && (args.format === 'html' || args.format === 'template')) {
    output = makeStandalone(output, inputPath)
  }

  if (args.output) {
    writeFileSync(resolve(args.output), output, 'utf-8')
    const sizeKB = (Buffer.byteLength(output, 'utf-8') / 1024).toFixed(1)
    console.error(`Wrote ${args.output} (${sizeKB} KB)${args.standalone ? ' [standalone]' : ''}`)
  } else {
    process.stdout.write(output)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main()
}
