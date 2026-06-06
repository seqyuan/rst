export interface IncludeExpansionOptions {
  /** Base directory used to resolve relative include paths. */
  baseDir: string
  /** Maximum recursive include depth. */
  maxDepth?: number
}

interface IncludeExpansionState {
  stack: string[]
  depth: number
}

export function expandIncludes(
  source: string,
  options: IncludeExpansionOptions,
): string {
  return expandIncludesInternal(source, options, { stack: [], depth: 0 })
}

function expandIncludesInternal(
  source: string,
  options: IncludeExpansionOptions,
  state: IncludeExpansionState,
): string {
  const maxDepth = options.maxDepth ?? 10
  if (state.depth > maxDepth) {
    throw new Error(`Include expansion exceeded max depth of ${maxDepth}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync, existsSync } = require('node:fs') as typeof import('node:fs')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { resolve, dirname, isAbsolute } = require('node:path') as typeof import('node:path')

  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const match = line.match(/^(\s*)\.\.\s+include::\s+(.+?)\s*$/)
    if (!match) {
      out.push(line)
      continue
    }

    const indent = match[1] ?? ''
    const includeTarget = stripQuotes(match[2] ?? '')

    let j = i + 1
    while (j < lines.length) {
      const next = lines[j]!
      if (next.trim() === '') break

      const nextIndent = next.length - next.trimStart().length
      if (nextIndent <= indent.length) break

      const bodyText = next.slice(Math.min(nextIndent, indent.length + 3)).trim()
      if (!/^:(\w[\w-]*):\s*(.*)$/.test(bodyText)) break
      j++
    }

    const absPath = isAbsolute(includeTarget)
      ? includeTarget
      : resolve(options.baseDir, includeTarget)

    if (state.stack.includes(absPath)) {
      const chain = [...state.stack, absPath].join(' -> ')
      throw new Error(`Circular include detected: ${chain}`)
    }

    if (!existsSync(absPath)) {
      throw new Error(`Included file not found: ${absPath}`)
    }

    const includedSource = readFileSync(absPath, 'utf-8').replace(/\r\n/g, '\n')
    const expanded = expandIncludesInternal(
      includedSource,
      { ...options, baseDir: dirname(absPath) },
      { stack: [...state.stack, absPath], depth: state.depth + 1 },
    )

    out.push(...indentIncludedSource(expanded, indent))
    i = j - 1
  }

  return out.join('\n')
}

function indentIncludedSource(source: string, indent: string): string[] {
  if (!indent) return source.split('\n')
  return source.split('\n').map(line => line.trim() ? `${indent}${line}` : line)
}

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, '')
}
