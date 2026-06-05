#!/usr/bin/env node
// ---------------------------------------------------------------------------
// rst-render — CLI tool for reStructuredText
// ---------------------------------------------------------------------------
//
// Usage:
//   rst-render input.rst              → HTML to stdout
//   rst-render input.rst -o out.html  → HTML to file
//   rst-render input.rst --md          → Markdown to stdout
//   rst-render input.rst --react       → React component to stdout
//   rst-render input.rst --template    → render Jinja2 template to RST
//   rst-render -h                      → help
//

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
  help: boolean
}

function parseArgs(raw: string[]): Args {
  const args: Args = { format: 'html', vars: {}, help: false }
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
  --md, --markdown       Output Markdown instead of HTML
  --react                Output React component code
  -t, --template         Render as Jinja2 template → RST, then to HTML
  -d, --data <path>      JSON file with template context data
  -v, --var key=value    Template variable (repeatable)
  -h, --help             Show this help

Examples:
  rst-render README.rst
  rst-render report.rst -o report.html
  rst-render docs.rst --md
  rst-render template.rst.j2 -t -d data.json -v title="My Report"
`.trim()

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
        // For React, output a JSX module
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

  if (args.output) {
    writeFileSync(resolve(args.output), output, 'utf-8')
    console.error(`Wrote ${args.output} (${output.length} bytes)`)
  } else {
    process.stdout.write(output)
  }
}

main()
