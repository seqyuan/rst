#!/usr/bin/env node
// ---------------------------------------------------------------------------
// rst-render — CLI tool for reStructuredText
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname, extname, basename } from 'node:path'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderRst, renderRstTemplate, MarkdownRenderer, createBuiltinParser } = require('@seqyuan/rst-renderer')

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

interface Args {
  input?: string
  output?: string
  format: 'html' | 'md' | 'react' | 'rst'
  data?: string
  vars: Record<string, string>
  standalone: boolean
  help: boolean
}

function parseArgs(raw: string[]): Args {
  const args: Args = { format: 'html', vars: {}, help: false, standalone: false }
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
        args.format = 'rst'
        break
      case '--standalone':
      case '-s':
        args.standalone = true
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

const HELP = `
rst-render — Render reStructuredText to HTML, Markdown, or React

Usage:
  rst-render <input.rst> [options]

Options:
  -o, --output <path>   Write output to file (default: stdout)
  -s, --standalone      Bundle into self-contained HTML (inline CSS + images)
  --md, --markdown       Output Markdown instead of HTML
  --react                Output React component code
  -t, --template         Render as Jinja2 template → RST, then to HTML
  -d, --data <path>      JSON file with template context data
  -v, --var key=value    Template variable (repeatable)
  -h, --help             Show this help

Examples:
  rst-render README.rst
  rst-render report.rst -o report.html --standalone
  rst-render docs.rst --md
  rst-render template.rst.j2 -t -d data.json -v title="My Report" -o out.html -s
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

function main() {
  const args = parseArgs(process.argv.slice(2))

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

  // Load template data if specified
  let templateContext: Record<string, unknown> = { ...args.vars }
  if (args.data) {
    try {
      const dataJson = JSON.parse(readFileSync(resolve(args.data), 'utf-8'))
      templateContext = { ...templateContext, ...dataJson }
    } catch {
      console.error(`Error: Cannot parse data file "${args.data}"`)
      process.exit(1)
    }
  }

  let output: string

  try {
    switch (args.format) {
      case 'md': {
        const parser = createBuiltinParser()
        const document = parser.parse({ input: source }).document
        output = new MarkdownRenderer({ headingOffset: 1 }).render(document)
        break
      }
      case 'rst': {
        output = renderRstTemplate(source, templateContext)
        break
      }
      case 'react': {
        const parser = createBuiltinParser()
        const document = parser.parse({ input: source }).document
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
        output = renderRst(source)
        break
    }
  } catch (err) {
    console.error('Error:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  }

  // Standalone bundling
  if (args.standalone && args.format === 'html') {
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

main()
