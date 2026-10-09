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
  RstDefinitionList, RstDefinitionListItem,
  RstFieldList, RstFieldListItem,
  RstOptionList, RstOptionListItem,
  RstDirective, RstComment, RstHyperlinkTarget,
  RstSubstitutionDef,
  RstTransition, RstBlockquote,
  RstTable, RstTableRow, RstTableCell,
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
  | { type: 'substitution'; name: string; directive: string; args: string; indent: number }
  | { type: 'field'; name: string; text: string; indent: number }

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

  // Substitution definition: .. |name| directive:: args
  const subMatch = trimmed.match(/^\.\.\s+\|([^|]+)\|\s+(\w[\w-]*)::\s*(.*)$/)
  if (subMatch) {
    return {
      type: 'substitution',
      name: subMatch[1]!.trim(),
      directive: subMatch[2]!.toLowerCase(),
      args: subMatch[3] ?? '',
      indent,
    }
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

  // Field list item: :name: value
  const fieldMatch = trimmed.match(/^:([^:\s][^:]*):(?:\s+(.*))?$/)
  if (fieldMatch) {
    return { type: 'field', name: fieldMatch[1]!.trim(), text: (fieldMatch[2] ?? '').trim(), indent }
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
 * Supports: **bold**, *italic*, ``code``, :role:`text`, |substitution|
 */
function parseInline(text: string): RstInlineNode[] {
  const nodes: RstInlineNode[] = []
  let remaining = text

  while (remaining.length > 0) {
    // Find the earliest markup occurrence
    let bestMatch: { type: string; full: string; content: string; index: number; role?: string } | null = null

    for (const { regex, type } of [
      { regex: /:([a-zA-Z][\w-]*):`([^`]+)`/g, type: 'InterpretedText' },
      { regex: /\*\*(.+?)\*\*/g, type: 'StrongEmphasis' },
      { regex: /\*(.+?)\*/g, type: 'Emphasis' },
      { regex: /``(.+?)``/g, type: 'InlineLiteral' },
      { regex: /\|([^|\s][^|]*)\|/g, type: 'SubstitutionRef' },
      { regex: /`([^`]+)`/g, type: 'InlineLiteral' },
    ]) {
      regex.lastIndex = 0
      const m = regex.exec(remaining)
      if (m && (bestMatch === null || m.index < bestMatch.index)) {
        // The role form captures [role, content]; the others capture [content].
        const isRole = type === 'InterpretedText'
        bestMatch = {
          type,
          full: m[0],
          content: (isRole ? m[2] : m[1])!,
          index: m.index,
          ...(isRole ? { role: m[1]! } : {}),
        }
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
    } else if (bestMatch.type === 'InterpretedText') {
      nodes.push({
        type: 'InterpretedText',
        source: { startLine: 0, endLine: 0 },
        text: bestMatch.content,
        role: bestMatch.role ?? '',
        displayText: bestMatch.content,
        body: bestMatch.content,
      })
    } else if (bestMatch.type === 'SubstitutionRef') {
      nodes.push({
        type: 'SubstitutionRef',
        source: { startLine: 0, endLine: 0 },
        text: bestMatch.content,
        refName: bestMatch.content,
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
  sectionLevels: Map<string, number>
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
      const state: ParserState = {
        lines,
        pos: 0,
        warnings: [],
        errors: [],
        sectionLevels: new Map(),
      }

      const document: RstDocument = {
        type: 'Document',
        source: { startLine: 0, endLine: lines.length },
        text: '',
        children: [],
      }

      // Parse sections (top-level only initially)
      document.children = parseSections(state)

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
function parseSections(state: ParserState): RstBlockNode[] {
  const blocks: RstBlockNode[] = []

  while (hasMore(state)) {
    const lineNum = state.pos
    const line = peek(state)!

    if (!line || line.trim() === '') {
      next(state)
      continue
    }

    const token = tokenizeLine(line)

    // Overline section: decoration / title / decoration (same char).
    //
    // This must be checked before the standard form. The previous code looked
    // for `lines[pos + 2]` being *text* while sitting on a title line, which
    // mis-fired whenever a paragraph followed an underline without a blank
    // line, swallowing the paragraph and rendering `<h2>=====</h2>`.
    if (token.type === 'decoration' && hasMore(state)) {
      const titleLine = state.lines[state.pos + 1]
      const underLine = state.lines[state.pos + 2]
      if (titleLine !== undefined && underLine !== undefined) {
        const titleToken = tokenizeLine(titleLine)
        const underToken = tokenizeLine(underLine)
        if (
          titleToken.type === 'text' &&
          underToken.type === 'decoration' &&
          underToken.char === token.char
        ) {
          next(state) // overline
          const headingLine = next(state) // title
          next(state) // underline
          const section = parseSectionBody(state, getSectionLevel(state, token.char), headingLine)
          blocks.push(section)
          continue
        }
      }
    }

    // Standard section: title + underline
    if (token.type === 'text' && hasMore(state)) {
      const nextLine = state.lines[state.pos + 1]
      if (nextLine !== undefined) {
        const nextToken = tokenizeLine(nextLine)
        if (nextToken.type === 'decoration') {
          next(state) // heading
          next(state) // decoration
          const section = parseSectionBody(state, getSectionLevel(state, nextToken.char), line)
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

    case 'substitution':
      return parseSubstitutionDef(state, token)

    case 'field':
      return parseFieldList(state, token)

    case 'text': {
      // Tables must be detected before paragraphs/definitions: a grid table
      // starts with `+---+` and a simple table with `=====  =====`, both of
      // which tokenize as plain text.
      const table = parseTable(state)
      if (table) return table

      // Could be a paragraph, a literal block, a definition list, or an option list
      if (line.trimEnd().endsWith('::')) {
        return parseLiteralBlock(state, lineNum)
      }
      const optionList = parseOptionList(state)
      if (optionList) return optionList
      const definitionList = parseDefinitionList(state)
      if (definitionList) return definitionList
      return parseParagraph(state, lineNum)
    }

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
  const startLine = state.pos
  let seenBody = false

  while (hasMore(state)) {
    const l = peek(state)!
    const trimmed = l.trim()
    const indent = l.length - l.trimStart().length

    if (trimmed === '') {
      if (!seenBody) {
        next(state)
        continue
      }

      next(state)
      bodyLines.push('')
      continue
    }

    if (indent <= token.indent) break

    next(state)

    const bodyText = l.slice(Math.min(indent, token.indent + 3))
    const optMatch = bodyText.trim().match(/^:(\w[\w-]*):\s*(.*)$/)
    if (!seenBody && optMatch) {
      options[optMatch[1]!] = optMatch[2] ?? ''
      continue
    }

    seenBody = true
    bodyLines.push(bodyText)
  }

  const name = token.name.toLowerCase()

  // Drop trailing blank lines: they used to leak into the directive body and
  // render as a stray empty paragraph (`<p>…\n\n</p>`).
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1]!.trim() === '') {
    bodyLines.pop()
  }

  const rawBody = trimCommonIndent(bodyLines)

  // Basic directive types we handle inline
  const bodyChildren: RstBlockNode[] = []
  if (rawBody.trim()) {
    const text = rawBody
    // For code-like / raw directives, treat the body as a literal block
    if (['code', 'code-block', 'sourcecode', 'math', 'raw'].includes(name)) {
      const language = name === 'math' || name === 'raw'
        ? undefined
        : (options['language'] ?? (token.args.trim().split(/\s+/)[0] || undefined))
      bodyChildren.push({
        type: 'LiteralBlock',
        source: { startLine: startLine, endLine: state.pos },
        text,
        language,
      })
    } else {
      // Split the body into separate paragraphs on blank lines: rendering the
      // whole body as a single Paragraph merged multi-paragraph admonitions.
      for (const chunk of text.split(/\n\s*\n/)) {
        const para = chunk.replace(/\s*\n\s*/g, ' ').trim()
        if (!para) continue
        bodyChildren.push({
          type: 'Paragraph',
          source: { startLine: startLine, endLine: state.pos },
          text: para,
          children: parseInline(para),
        })
      }
    }
  }

  return {
    type: 'Directive',
    source: { startLine: startLine, endLine: state.pos },
    text: '',
    name,
    arguments: token.args ? token.args.split(/\s+/) : [],
    options,
    rawBody,
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

/**
 * Parse a field list:
 *
 *   :物种: Human (GRCh38)
 *   :参考基因组: refdata-gex-GRCh38-2024-A
 *
 * Each `:name: value` line becomes a FieldListItem; deeper-indented lines are
 * appended to that item's body.
 */
function parseFieldList(state: ParserState, firstToken: LineToken & { type: 'field' }): RstFieldList {
  const items: RstFieldListItem[] = []
  const startLine = state.pos
  const baseIndent = firstToken.indent

  while (hasMore(state)) {
    const line = peek(state)!
    if (!line || line.trim() === '') break

    const token = tokenizeLine(line)
    if (token.type !== 'field' || token.indent !== baseIndent) break

    const itemStart = state.pos
    next(state)

    const bodyLines: string[] = []
    if (token.text) bodyLines.push(token.text)

    // Continuation lines belonging to this field's body
    while (hasMore(state)) {
      const cont = peek(state)!
      if (!cont || cont.trim() === '') break
      const contIndent = cont.length - cont.trimStart().length
      if (contIndent <= baseIndent) break
      if (tokenizeLine(cont).type !== 'text') break
      bodyLines.push(cont.trim())
      next(state)
    }

    const bodyText = bodyLines.join(' ').replace(/\s+/g, ' ').trim()
    const body: RstBlockNode[] = bodyText
      ? [{
          type: 'Paragraph',
          source: { startLine: itemStart, endLine: state.pos },
          text: bodyText,
          children: parseInline(bodyText),
        }]
      : []

    items.push({
      type: 'FieldListItem',
      source: { startLine: itemStart, endLine: state.pos },
      text: '',
      name: token.name,
      body,
    })
  }

  return {
    type: 'FieldList',
    source: { startLine, endLine: state.pos },
    text: '',
    children: items,
  }
}

/**
 * Parse a definition list:
 *
 *   term
 *       definition
 *
 * A definition item is a text line immediately followed by a more-indented
 * block with no intervening blank line.
 */
function parseDefinitionList(state: ParserState): RstDefinitionList | null {
  const items: RstDefinitionListItem[] = []
  const startLine = state.pos

  while (hasMore(state)) {
    const line = peek(state)!
    if (!line || line.trim() === '') break

    const token = tokenizeLine(line)
    if (token.type !== 'text') break
    if (line.trimEnd().endsWith('::')) break

    const nextLine = state.lines[state.pos + 1]
    if (nextLine === undefined || nextLine.trim() === '') break

    const termIndent = line.length - line.trimStart().length
    const defIndent = nextLine.length - nextLine.trimStart().length
    if (defIndent <= termIndent) break

    const itemStart = state.pos
    const termLine = next(state)
    const defLines: string[] = []

    while (hasMore(state)) {
      const cont = peek(state)!
      if (!cont || cont.trim() === '') break
      const ci = cont.length - cont.trimStart().length
      if (ci <= termIndent) break
      defLines.push(next(state))
    }

    const defText = trimCommonIndent(defLines).trim()
    const definition: RstBlockNode[] = defText
      ? [{
          type: 'Paragraph',
          source: { startLine: itemStart, endLine: state.pos },
          text: defText,
          children: parseInline(defText),
        }]
      : []

    items.push({
      type: 'DefinitionListItem',
      source: { startLine: itemStart, endLine: state.pos },
      text: '',
      term: parseInline(termLine.trim()),
      definition,
    })
  }

  if (items.length === 0) return null
  return {
    type: 'DefinitionList',
    source: { startLine, endLine: state.pos },
    text: '',
    children: items,
  }
}

/** One or more option markers (`-a`, `--all`, `/V`) with an optional inline description. */
const OPTION_LINE = /^(\s*)((?:(?:--?|\/)[^\s,]+)(?:\s*,\s*(?:--?|\/)[^\s,]+)*)(?:\s{2,}(.*))?$/

/**
 * Parse an option list:
 *
 *   -a, --all    Process everything
 *   -x           Enable X
 */
function parseOptionList(state: ParserState): RstOptionList | null {
  const items: RstOptionListItem[] = []
  const startLine = state.pos

  while (hasMore(state)) {
    const line = peek(state)!
    if (!line || line.trim() === '') break

    const m = line.match(OPTION_LINE)
    if (!m) break

    const baseIndent = m[1]!.length
    const inline = (m[3] ?? '').trim()
    const itemStart = state.pos
    next(state)

    const descLines: string[] = []
    if (inline) descLines.push(inline)
    while (hasMore(state)) {
      const cont = peek(state)!
      if (!cont || cont.trim() === '') break
      const ci = cont.length - cont.trimStart().length
      if (ci <= baseIndent) break
      descLines.push(next(state).trim())
    }

    const descText = descLines.join(' ').replace(/\s+/g, ' ').trim()
    items.push({
      type: 'OptionListItem',
      source: { startLine: itemStart, endLine: state.pos },
      text: '',
      options: m[2]!.split(/\s*,\s*/),
      description: descText
        ? [{
            type: 'Paragraph',
            source: { startLine: itemStart, endLine: state.pos },
            text: descText,
            children: parseInline(descText),
          }]
        : [],
    })
  }

  if (items.length === 0) return null
  return {
    type: 'OptionList',
    source: { startLine, endLine: state.pos },
    text: '',
    children: items,
  }
}

/** Parse `.. |name| directive:: value` substitution definitions. */
function parseSubstitutionDef(
  state: ParserState,
  token: LineToken & { type: 'substitution' },
): RstSubstitutionDef {
  const startLine = state.pos
  next(state)

  const lines: string[] = []
  if (token.args.trim()) lines.push(token.args.trim())

  while (hasMore(state)) {
    const line = peek(state)!
    if (!line || line.trim() === '') break
    const indent = line.length - line.trimStart().length
    if (indent <= token.indent) break
    lines.push(next(state).trim())
  }

  return {
    type: 'SubstitutionDef',
    source: { startLine, endLine: state.pos },
    text: '',
    name: token.name,
    directive: token.directive,
    rawValue: lines.join(' ').trim(),
    children: [],
  }
}

// ---------------------------------------------------------------------------
// Tables (grid + simple)
// ---------------------------------------------------------------------------

/** Does this line look like a grid-table border (`+---+---+`)? */
function isGridBorder(line: string): boolean {
  return /^\s*\+(?:[-=]+\+)+\s*$/.test(line)
}

/**
 * Does this line look like a simple-table separator (`=====  =====`)?
 * Requires at least two column groups so a plain section underline (`=====`)
 * is never mistaken for a table.
 */
function isSimpleSeparator(line: string): boolean {
  if (/[^=\-\s]/.test(line)) return false
  const groups = line.match(/[=-]+/g)
  return !!groups && groups.length >= 2
}

/** Try to parse a grid or simple table at the current position. */
function parseTable(state: ParserState): RstTable | null {
  const line = peek(state)
  if (line === null) return null

  if (isGridBorder(line)) return parseGridTable(state)

  const nextLine = state.lines[state.pos + 1]
  const hasSimpleTableStart =
    isSimpleSeparator(line) ||
    (nextLine !== undefined && isSimpleSeparator(nextLine))

  return hasSimpleTableStart ? parseSimpleTable(state) : null
}

function parseGridTable(state: ParserState): RstTable | null {
  const startLine = state.pos
  const lines: string[] = []

  while (hasMore(state)) {
    const l = peek(state)!
    if (isGridBorder(l) || l.trimStart().startsWith('|')) {
      lines.push(next(state))
      continue
    }
    break
  }

  const borderLine = lines.find(isGridBorder)
  if (!borderLine) return null

  const bounds = [...borderLine.matchAll(/\+/g)].map(m => m.index!)
  if (bounds.length < 2) return null

  const rows: RstTableRow[] = []
  let headerRows = 0

  for (const l of lines) {
    if (isGridBorder(l)) {
      // A border containing `=` separates the header from the body.
      if (l.includes('=')) headerRows = Math.max(headerRows, rows.length)
      continue
    }
    if (!l.trimStart().startsWith('|')) continue

    const cells: string[] = []
    for (let i = 0; i < bounds.length - 1; i++) {
      cells.push(l.slice(bounds[i]! + 1, bounds[i + 1]!).trim())
    }
    rows.push(makeTableRow(cells, startLine))
  }

  if (rows.length === 0) return null

  return {
    type: 'Table',
    source: { startLine, endLine: state.pos },
    text: '',
    widths: [],
    headerRows: Math.min(headerRows, rows.length),
    children: rows,
  }
}

function parseSimpleTable(state: ParserState): RstTable | null {
  const startLine = state.pos
  const lines: string[] = []

  while (hasMore(state)) {
    const l = peek(state)!
    if (!l || l.trim() === '') break
    if (isSimpleSeparator(l) || tokenizeLine(l).type === 'text') {
      lines.push(next(state))
      continue
    }
    break
  }

  const sepIndices = lines
    .map((l, i) => (isSimpleSeparator(l) ? i : -1))
    .filter(i => i >= 0)
  if (sepIndices.length === 0) return null

  const topBorder = sepIndices[0] === 0
  const firstDataIndex = topBorder ? 1 : 0

  // Header rows are the data lines before the header separator: the separator
  // directly after a leading top border, or the first separator when there is
  // no top border and at least one preceding data line.
  let headerRows = 0
  if (!topBorder) {
    headerRows = sepIndices[0]!
  } else if (sepIndices.length >= 3) {
    headerRows = sepIndices[1]! - firstDataIndex
  }

  const spans: Array<[number, number]> = []
  for (const m of lines[sepIndices[0]!]!.matchAll(/[=-]+/g)) {
    spans.push([m.index!, m.index! + m[0]!.length])
  }
  if (spans.length < 2) return null

  const rows: RstTableRow[] = []
  for (let i = firstDataIndex; i < lines.length; i++) {
    const l = lines[i]!
    if (isSimpleSeparator(l)) continue

    const cells: string[] = []
    for (let c = 0; c < spans.length; c++) {
      const start = spans[c]![0]
      const end = c + 1 < spans.length ? spans[c + 1]![0] : l.length
      cells.push(l.slice(start, end).trim())
    }
    rows.push(makeTableRow(cells, startLine))
  }

  if (rows.length === 0) return null

  return {
    type: 'Table',
    source: { startLine, endLine: state.pos },
    text: '',
    widths: [],
    headerRows: Math.min(headerRows, rows.length),
    children: rows,
  }
}

function makeTableRow(cells: string[], lineNum: number): RstTableRow {
  return {
    type: 'TableRow',
    source: { startLine: lineNum, endLine: lineNum + 1 },
    text: '',
    children: cells.map((text): RstTableCell => ({
      type: 'TableCell',
      source: { startLine: lineNum, endLine: lineNum + 1 },
      text,
      colspan: 1,
      rowspan: 1,
      children: text
        ? [{
            type: 'Paragraph',
            source: { startLine: lineNum, endLine: lineNum + 1 },
            text,
            children: parseInline(text),
          }]
        : [],
    })),
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

function getSectionLevel(state: ParserState, decorationChar: string): number {
  const existing = state.sectionLevels.get(decorationChar)
  if (existing) return existing

  const nextLevel = state.sectionLevels.size + 1
  state.sectionLevels.set(decorationChar, nextLevel)
  return nextLevel
}
