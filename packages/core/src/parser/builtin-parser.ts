/**
 * A simple built-in RST parser that handles the core syntax.
 * Designed as a fallback / self-contained parser when rst-compiler is not available.
 *
 * This is a minimal implementation covering:
 * - Sections (with underline/overline decoration)
 * - Paragraphs
 * - Inline markup (**bold**, *italic*, ``code``)
 * - Bullet lists, enumerated lists
 * - Literal blocks (::)
 * - Directives (.. directive::)
 * - Comments (..)
 * - Hyperlink targets (.. _name: url)
 * - Transitions (----)
 * - Blockquotes (indented)
 *
 * For full RST parsing, use the rst-compiler adapter instead.
 */

import type {
  RstDocument, RstSection, RstParagraph, RstText,
  RstEmphasis, RstStrongEmphasis, RstInlineLiteral,
  RstInlineNode, RstBlockNode, RstLiteralBlock,
  RstBulletList, RstBulletListItem,
  RstEnumeratedList, RstEnumeratedListItem,
  RstDirective, RstComment, RstHyperlinkTarget,
  RstTransition, RstBlockquote,
} from '../ast/types'
import { RstParser, RstParserOptions, RstParserOutput } from './index'

// ---------------------------------------------------------------------------
// Line-by-line tokenizer
// ---------------------------------------------------------------------------

type LineToken =
  | { type: 'blank' }
  | { type: 'text'; text: string }
  | { type: 'decoration'; char: string; length: number }
  | { type: 'bullet'; bullet: string; indent: number; text: string }
  | { type: 'enum'; num: string; indent: number; text: string }
  | { type: 'directive'; name: string; args: string; indent: number }
  | { type: 'comment'; indent: number }
  | { type: 'target'; name: string; url: string }

function tokenizeLine(line: string): LineToken {
  // Blank line
  if (/^\s*$/.test(line)) return { type: 'blank' }

  const trimmed = line.trimStart()
  const indent = line.length - trimmed.length

  // Section decoration: entire line of same char, >= 3 length, only one char type
  // Must come BEFORE transition check since same pattern is used for both
  if (/^([-=~`'^"+*#.:]{3,})\s*$/.test(trimmed) && new Set(trimmed.replace(/\s+$/, '')).size === 1) {
    const ch = trimmed.trimEnd()
    return { type: 'decoration', char: ch[0]!, length: ch.length }
  }

  // Directive: starts with ".. "
  const dirMatch = trimmed.match(/^\.\.\s+(?:(\w[\w-]*)::\s*(.*)|(.*))$/)
  if (dirMatch) {
    if (dirMatch[1]) {
      return { type: 'directive', name: dirMatch[1], args: dirMatch[2] ?? '', indent }
    }
    return { type: 'comment', indent }
  }

  // Hyperlink target: .. _name: url
  const targetMatch = trimmed.match(/^\.\.\s+_(.+):\s*(.*)$/)
  if (targetMatch) {
    return { type: 'target', name: targetMatch[1]!, url: targetMatch[2] ?? '' }
  }

  // Section decoration: entire line of same char, >= 3 length, only one char type
  if (/^([-=~`'^"+*#.:]{3,})\s*$/.test(trimmed) && new Set(trimmed.replace(/\s+$/, '')).size === 1) {
    const ch = trimmed.trimEnd()
    return { type: 'decoration', char: ch[0]!, length: ch.length }
  }

  // Bullet list item: starts with -, *, +
  const bulletMatch = trimmed.match(/^([-*+])\s+(.*)$/)
  if (bulletMatch) {
    return { type: 'bullet', bullet: bulletMatch[1]!, indent, text: bulletMatch[2]! }
  }

  // Enumerated list: starts with digit/dot, letter/paren, roman numeral
  const enumMatch = trimmed.match(/^(\d+\.|[a-zA-Z]\.|\([a-zA-Z]\)|[ivxlcdm]+\.)\s+(.*)$/i)
  if (enumMatch) {
    return { type: 'enum', num: enumMatch[1]!, indent, text: enumMatch[2]! }
  }

  return { type: 'text', text: line }
}

// ---------------------------------------------------------------------------
// Inline parser
// ---------------------------------------------------------------------------

/**
 * Parse inline markup within a text string.
 * Supports: **bold**, *italic*, ``code``, `interpreted`
 */
function parseInline(text: string): RstInlineNode[] {
  const nodes: RstInlineNode[] = []
  let remaining = text

  while (remaining.length > 0) {
    // Find the earliest markup occurrence
    let bestMatch: { type: string; full: string; content: string; index: number } | null = null

    for (const { regex, type } of [
      { regex: /\*\*(.+?)\*\*/g, type: 'StrongEmphasis' },
      { regex: /\*(.+?)\*/g, type: 'Emphasis' },
      { regex: /``(.+?)``/g, type: 'InlineLiteral' },
      { regex: /`([^`]+)`/g, type: 'InlineLiteral' },
    ]) {
      regex.lastIndex = 0
      const m = regex.exec(remaining)
      if (m && (bestMatch === null || m.index < bestMatch.index)) {
        bestMatch = { type, full: m[0], content: m[1]!, index: m.index }
      }
    }

    if (bestMatch === null) {
      // No markup found, push remaining as text
      nodes.push(textNode(remaining))
      break
    }

    // Push text before the match
    if (bestMatch.index > 0) {
      nodes.push(textNode(remaining.slice(0, bestMatch.index)))
    }

    // Push the matched node
    if (bestMatch.type === 'StrongEmphasis') {
      nodes.push({
        type: 'StrongEmphasis',
        source: { startLine: 0, endLine: 0 },
        text: bestMatch.content,
        children: parseInline(bestMatch.content),
      })
    } else if (bestMatch.type === 'Emphasis') {
      nodes.push({
        type: 'Emphasis',
        source: { startLine: 0, endLine: 0 },
        text: bestMatch.content,
        children: parseInline(bestMatch.content),
      })
    } else {
      nodes.push({
        type: 'InlineLiteral',
        source: { startLine: 0, endLine: 0 },
        text: bestMatch.content,
      })
    }

    remaining = remaining.slice(bestMatch.index + bestMatch.full.length)
  }

  return nodes
}

function textNode(text: string): RstText {
  return { type: 'Text', source: { startLine: 0, endLine: 0 }, text }
}

// ---------------------------------------------------------------------------
// Block-level parser
// ---------------------------------------------------------------------------

interface ParserState {
  lines: string[]
  pos: number
  warnings: string[]
  errors: string[]
}

function peek(state: ParserState): string | null {
  return state.pos < state.lines.length ? state.lines[state.pos]! : null
}

function next(state: ParserState): string {
  return state.lines[state.pos++]!
}

function hasMore(state: ParserState): boolean {
  return state.pos < state.lines.length
}

/**
 * Main parser entry point.
 */
export function createBuiltinParser(): RstParser {
  return {
    name: 'builtin',

    parse(opts: RstParserOptions): RstParserOutput {
      const lines = opts.input.split('\n')
      const state: ParserState = { lines, pos: 0, warnings: [], errors: [] }

      const document: RstDocument = {
        type: 'Document',
        source: { startLine: 0, endLine: lines.length },
        text: '',
        children: [],
      }

      // Parse sections (top-level only initially)
      document.children = parseSections(state, 1)

      return {
        document,
        warnings: state.warnings,
        errors: state.errors,
      }
    },
  }
}

/**
 * Parse top-level sections and content.
 * A section = heading line + decoration line (or decoration + heading + decoration for overline).
 */
function parseSections(state: ParserState, level: number): RstBlockNode[] {
  const blocks: RstBlockNode[] = []

  while (hasMore(state)) {
    const lineNum = state.pos
    const line = peek(state)!

    if (!line || line.trim() === '') {
      next(state)
      continue
    }

    const token = tokenizeLine(line)

    // Check for section heading
    if (token.type === 'text' && hasMore(state)) {
      const nextLine = state.lines[state.pos + 1]
      if (nextLine !== undefined) {
        const nextToken = tokenizeLine(nextLine)
        if (nextToken.type === 'decoration') {
          // Check for overline (decoration before heading)
          if (tokenizeLine(state.lines[state.pos + 2] ?? '').type === 'text') {
            // This is a section with overline+underline
            const decoLine = next(state) // decoration
            const headingLine = next(state) // title
            next(state) // decoration
            const section = parseSectionBody(state, level, headingLine)
            blocks.push(section)
            continue
          }

          // Standard section: heading + underline
          next(state) // heading
          next(state) // decoration
          const section = parseSectionBody(state, level, line)
          blocks.push(section)
          continue
        }
      }
    }

    // Parse other block types
    const block = parseBlock(state)
    if (block) {
      blocks.push(block)
    }
  }

  return blocks
}

function parseSectionBody(state: ParserState, level: number, title: string): RstSection {
  const section: RstSection = {
    type: 'Section',
    source: { startLine: state.pos, endLine: state.pos },
    text: title,
    title,
    level,
    children: [],
    subsections: [],
  }

  const startPos = state.pos

  while (hasMore(state)) {
    const line = peek(state)!

    if (!line || line.trim() === '') {
      next(state)
      continue
    }

    // Peek ahead to detect next section at same or higher level
    const token = tokenizeLine(line)
    if (token.type === 'text') {
      const nextLine = state.lines[state.pos + 1]
      if (nextLine !== undefined && tokenizeLine(nextLine).type === 'decoration') {
        // A new section starts here — stop parsing this section's body
        break
      }
    }

    const block = parseBlock(state)
    if (block) {
      section.children.push(block)
    }
  }

  section.source.endLine = state.pos
  return section
}

/**
 * Parse a single block-level element: paragraph, list, directive, etc.
 */
function parseBlock(state: ParserState): RstBlockNode | null {
  const line = peek(state)
  if (!line || line.trim() === '') {
    next(state)
    return null
  }

  const lineNum = state.pos
  const token = tokenizeLine(line)

  switch (token.type) {
    case 'decoration':
      // A decoration line that is not adjacent to a heading = transition
      next(state)
      return { type: 'Transition', source: { startLine: lineNum, endLine: lineNum + 1 }, text: '' }

    case 'directive':
      return parseDirective(state, token)

    case 'comment':
      next(state)
      return { type: 'Comment', source: { startLine: lineNum, endLine: lineNum + 1 }, text: '' }

    case 'target':
      next(state)
      return { type: 'HyperlinkTarget', source: { startLine: lineNum, endLine: lineNum + 1 }, text: '', name: token.name, url: token.url }

    case 'bullet':
      return parseBulletList(state, token)

    case 'enum':
      return parseEnumeratedList(state, token)

    case 'text':
      // Could be a paragraph or a literal block
      if (line.trimEnd().endsWith('::')) {
        return parseLiteralBlock(state, lineNum)
      }
      return parseParagraph(state, lineNum)

    default:
      next(state)
      return null
  }
}

function parseParagraph(state: ParserState, startLine: number): RstParagraph {
  const lines: string[] = [next(state)]

  // Consume continuation lines (non-blank, non-special)
  while (hasMore(state)) {
    const l = peek(state)!
    if (!l || l.trim() === '') break

    const t = tokenizeLine(l)
    if (t.type !== 'text') break

    lines.push(next(state))
  }

  const text = lines.join(' ').replace(/\s+/g, ' ')
  return {
    type: 'Paragraph',
    source: { startLine, endLine: state.pos },
    text,
    children: parseInline(text),
  }
}

function parseLiteralBlock(state: ParserState, startLine: number): RstLiteralBlock {
  // The :: marker might be on its own line or on the paragraph end
  let line = next(state).replace(/::$/, '').trim()
  const codeLines: string[] = []
  if (line) codeLines.push(line)

  // Skip blank line after ::
  if (hasMore(state) && peek(state)!.trim() === '') {
    next(state)
  }

  // Consume indented lines
  while (hasMore(state)) {
    const l = peek(state)!
    if (!l || l === '') {
      codeLines.push('')
      next(state)
      continue
    }

    const leadingSpace = l.length - l.trimStart().length
    if (leadingSpace === 0 && !/^\s*$/.test(l)) break

    codeLines.push(l)
    next(state)
  }

  // Trim common indent
  const content = trimCommonIndent(codeLines)

  return {
    type: 'LiteralBlock',
    source: { startLine, endLine: state.pos },
    text: content,
  }
}

function parseDirective(state: ParserState, token: LineToken & { type: 'directive' }): RstDirective | RstComment {
  next(state) // consume directive line

  const bodyLines: string[] = []
  const options: Record<string, string> = {}
  let startLine = state.pos

  while (hasMore(state)) {
    const l = peek(state)!
    if (!l || l.trim() === '') {
      next(state)
      break
    }

    // Nested directive
    if (l.trimStart().startsWith('.. ')) break

    const indent = l.length - l.trimStart().length
    if (indent === 0 && token.indent === 0) break

    next(state)

    // Field option: :name: value
    const optMatch = l.trim().match(/^:(\w[\w-]*):\s*(.*)$/)
    if (optMatch) {
      options[optMatch[1]!] = optMatch[2] ?? ''
      continue
    }

    bodyLines.push(l)
  }

  const name = token.name.toLowerCase()

  // Basic directive types we handle inline
  const bodyChildren: RstBlockNode[] = []
  if (bodyLines.length > 0) {
    const text = bodyLines.join('\n')
    // For code-like directives, treat body as a literal block
    if (['code', 'code-block', 'sourcecode', 'math'].includes(name)) {
      bodyChildren.push({
        type: 'LiteralBlock',
        source: { startLine: startLine, endLine: state.pos },
        text,
        language: name === 'math' ? undefined : options['language'],
      })
    } else {
      bodyChildren.push({
        type: 'Paragraph',
        source: { startLine: startLine, endLine: state.pos },
        text,
        children: parseInline(text),
      })
    }
  }

  return {
    type: 'Directive',
    source: { startLine: startLine, endLine: state.pos },
    text: '',
    name,
    arguments: token.args ? token.args.split(/\s+/) : [],
    options,
    children: bodyChildren,
  }
}

function parseBulletList(state: ParserState, firstToken: LineToken & { type: 'bullet' }): RstBulletList {
  const items: RstBulletListItem[] = []
  let startLine = state.pos
  const baseIndent = firstToken.indent

  while (hasMore(state)) {
    const l = peek(state)!
    if (!l) break
    const t = tokenizeLine(l)
    if (t.type !== 'bullet') break
    if (t.indent !== baseIndent) break // same indent level

    const itemStart = state.pos
    next(state)

    const item: RstBulletListItem = {
      type: 'BulletListItem',
      source: { startLine: itemStart, endLine: state.pos },
      text: '',
      children: [],
    }

    // Parse item body: can be paragraph followed by sub-blocks
    if (t.text) {
      item.children.push({
        type: 'Paragraph',
        source: { startLine: itemStart, endLine: itemStart + 1 },
        text: t.text,
        children: parseInline(t.text),
      })
    }

    // Parse continuation / sub-blocks (indented more than base)
    while (hasMore(state)) {
      const cl = peek(state)!
      if (!cl || cl.trim() === '') break
      const clTrimmed = cl.trimStart()
      const clIndent = cl.length - clTrimmed.length
      if (clIndent <= baseIndent) break

      // Check if it's another bullet/enum at the continuation indent
      const ct = tokenizeLine(cl)
      if (ct.type === 'bullet' || ct.type === 'enum') break

      const block = parseBlock(state)
      if (block) item.children.push(block)
    }

    item.source.endLine = state.pos
    items.push(item)
  }

  return {
    type: 'BulletList',
    source: { startLine, endLine: state.pos },
    text: '',
    children: items,
  }
}

function parseEnumeratedList(state: ParserState, firstToken: LineToken & { type: 'enum' }): RstEnumeratedList {
  const items: RstEnumeratedListItem[] = []
  let startLine = state.pos
  const baseIndent = firstToken.indent

  while (hasMore(state)) {
    const l = peek(state)!
    if (!l) break
    const t = tokenizeLine(l)
    if (t.type !== 'enum') break
    if (t.indent !== baseIndent) break

    const itemStart = state.pos
    next(state)

    const item: RstEnumeratedListItem = {
      type: 'EnumeratedListItem',
      source: { startLine: itemStart, endLine: state.pos },
      text: '',
      children: [],
    }

    if (t.text) {
      item.children.push({
        type: 'Paragraph',
        source: { startLine: itemStart, endLine: itemStart + 1 },
        text: t.text,
        children: parseInline(t.text),
      })
    }

    item.source.endLine = state.pos
    items.push(item)
  }

  return {
    type: 'EnumeratedList',
    source: { startLine, endLine: state.pos },
    text: '',
    enumType: 'arabic',
    start: 1,
    children: items,
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function trimCommonIndent(lines: string[]): string {
  if (lines.length === 0) return ''

  // Find minimum non-blank indent
  let minIndent = Infinity
  for (const l of lines) {
    if (l.trim() === '') continue
    const indent = l.length - l.trimStart().length
    if (indent < minIndent) minIndent = indent
  }

  if (minIndent === Infinity) minIndent = 0

  return lines.map(l => l.slice(minIndent)).join('\n')
}
