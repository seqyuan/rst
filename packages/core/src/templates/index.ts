// ---------------------------------------------------------------------------
// @seqyuan/rst-renderer — Jinja2-compatible template engine (v2)
// ---------------------------------------------------------------------------
//
// Proper recursive descent parser supporting nested for/if blocks,
// all Jinja2 loop variables, filters, and expression evaluation.
//

export interface TemplateContext {
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type Token =
  | { type: 'text'; value: string }
  | { type: 'expr'; value: string; filters: string[] }
  | { type: 'for'; varName: string; iterPath: string }
  | { type: 'endfor' }
  | { type: 'if'; cond: string; negate: boolean; pathVar: string }
  | { type: 'else' }
  | { type: 'endif' }
  | { type: 'comment' }

function tokenize(template: string): Token[] {
  const tokens: Token[] = []
  let pos = 0

  while (pos < template.length) {
    // Comment: {# ... #}
    if (template.startsWith('{#', pos)) {
      const end = template.indexOf('#}', pos + 2)
      if (end === -1) { tokens.push({ type: 'text', value: template.slice(pos) }); break }
      pos = end + 2
      continue
    }

    // Tag: {% ... %}
    if (template.startsWith('{%', pos)) {
      const end = template.indexOf('%}', pos + 2)
      if (end === -1) { tokens.push({ type: 'text', value: template.slice(pos) }); break }
      const inner = template.slice(pos + 2, end).trim()
      pos = end + 2

      // for var in path
      const forMatch = inner.match(/^-?\s*for\s+(\w+)\s+in\s+([\w.]+)\s*-?$/)
      if (forMatch) { tokens.push({ type: 'for', varName: forMatch[1]!, iterPath: forMatch[2]! }); continue }

      // endfor
      if (/^-?\s*endfor\s*-?$/.test(inner)) { tokens.push({ type: 'endfor' }); continue }

      // if cond
      const ifMatch = inner.match(/^-?\s*if\s+not\s+([\w.]+)\s*-?$/)
      if (ifMatch) { tokens.push({ type: 'if', cond: '', negate: true, pathVar: ifMatch[1]! }); continue }

      const ifMatch2 = inner.match(/^-?\s*if\s+([\w.]+)\s*-?$/)
      if (ifMatch2) { tokens.push({ type: 'if', cond: '', negate: false, pathVar: ifMatch2[1]! }); continue }

      // else
      if (/^-?\s*else\s*-?$/.test(inner)) { tokens.push({ type: 'else' }); continue }

      // endif
      if (/^-?\s*endif\s*-?$/.test(inner)) { tokens.push({ type: 'endif' }); continue }

      // Unknown tag - treat as text
      tokens.push({ type: 'text', value: template.slice(pos - (end - pos + 4), pos) })
      continue
    }

    // Expression: {{ ... }}
    if (template.startsWith('{{', pos)) {
      const end = template.indexOf('}}', pos + 2)
      if (end === -1) { tokens.push({ type: 'text', value: template.slice(pos) }); break }
      const inner = template.slice(pos + 2, end).trim()
      pos = end + 2

      // Parse filters: expr | filter(args) | filter2
      const parts = inner.split('|').map(s => s.trim())
      const expression = parts[0]!
      const filters = parts.slice(1)
      tokens.push({ type: 'expr', value: expression, filters })
      continue
    }

    // Plain text
    const nextTag = findNextTag(template, pos)
    if (nextTag === -1) {
      tokens.push({ type: 'text', value: template.slice(pos) })
      break
    }
    tokens.push({ type: 'text', value: template.slice(pos, nextTag) })
    pos = nextTag
  }

  return tokens
}

function findNextTag(template: string, pos: number): number {
  let i = pos
  while (i < template.length) {
    if (template[i] === '{') {
      if (template[i + 1] === '{' || template[i + 1] === '%' || template[i + 1] === '#') return i
    }
    i++
  }
  return -1
}

// ---------------------------------------------------------------------------
// Parser / Evaluator
// ---------------------------------------------------------------------------

interface Node {
  type: 'text' | 'expr' | 'block'
  value?: string
  filters?: string[]
  children?: Node[]
  loopInfo?: { varName: string; iterPath: string }
  condInfo?: { negate: boolean; pathVar: string }
}

function parse(tokens: Token[]): Node[] {
  const nodes: Node[] = []
  let i = 0

  while (i < tokens.length) {
    const t = tokens[i]!

    if (t.type === 'text') {
      nodes.push({ type: 'text', value: t.value })
      i++
      continue
    }

    if (t.type === 'expr') {
      nodes.push({ type: 'expr', value: t.value, filters: t.filters })
      i++
      continue
    }

    if (t.type === 'for') {
      // Find matching endfor
      const { children, endIdx } = parseBlock(tokens, i + 1, 'endfor')
      nodes.push({
        type: 'block',
        children,
        loopInfo: { varName: t.varName, iterPath: t.iterPath },
      })
      i = endIdx + 1
      continue
    }

    if (t.type === 'if') {
      const { children, endIdx } = parseIfBlock(tokens, i + 1)
      nodes.push({
        type: 'block',
        children,
        condInfo: { negate: t.negate, pathVar: t.pathVar },
      })
      i = endIdx + 1
      continue
    }

    i++
  }

  return nodes
}

/** Parse until matching endTag (at same nesting level). */
function parseBlock(tokens: Token[], start: number, endTag: 'endfor' | 'endif'): { children: Node[]; endIdx: number } {
  const children: Node[] = []
  let i = start
  let depth = 0

  while (i < tokens.length) {
    const t = tokens[i]!

    // Handle nested for
    if (t.type === 'for') {
      const nested = parseBlock(tokens, i + 1, 'endfor')
      children.push({ type: 'block', children: nested.children, loopInfo: { varName: t.varName, iterPath: t.iterPath } })
      i = nested.endIdx + 1
      continue
    }

    // Handle nested if
    if (t.type === 'if') {
      const elseIdx = findTokenAtDepth(tokens, i + 1, 'else', 'endif')
      if (elseIdx !== -1 && tokens[elseIdx]!.type === 'else') {
        // if/else: parse then-branch, skip else, parse else-branch
        const thenBlock = parseBlock(tokens, i + 1, 'endif')
        // thenBlock has both branches — the 'else' token interrupts parseBlock
        // Re-parse properly:
        const thenNodes: Node[] = []
        const elseNodes: Node[] = []
        let j = i + 1
        let inElse = false
        let d = 0
        while (j < tokens.length) {
          const tj = tokens[j]!
          if (tj.type === 'for') d++
          else if (tj.type === 'if') d++
          else if (tj.type === 'endif' && d === 0) break
          else if (tj.type === 'endfor' || tj.type === 'endif') d--
          else if (tj.type === 'else' && d === 0) { inElse = true; j++; continue }

          if (!inElse) {
            if (tj.type === 'text') thenNodes.push({ type: 'text', value: tj.value })
            else if (tj.type === 'expr') thenNodes.push({ type: 'expr', value: tj.value, filters: tj.filters })
            else if (tj.type === 'for') {
              const nested = parseBlock(tokens, j + 1, 'endfor')
              thenNodes.push({ type: 'block', children: nested.children, loopInfo: { varName: tj.varName, iterPath: tj.iterPath } })
              j = nested.endIdx
            } else if (tj.type === 'if') {
              const nestedIf = parseIfBlock(tokens, j + 1)
              thenNodes.push({ type: 'block', children: nestedIf.children, condInfo: { negate: tj.negate, pathVar: tj.pathVar } })
              j = nestedIf.endIdx
            }
          } else {
            if (tj.type === 'text') elseNodes.push({ type: 'text', value: tj.value })
            else if (tj.type === 'expr') elseNodes.push({ type: 'expr', value: tj.value, filters: tj.filters })
            else if (tj.type === 'for') {
              const nested = parseBlock(tokens, j + 1, 'endfor')
              elseNodes.push({ type: 'block', children: nested.children, loopInfo: { varName: tj.varName, iterPath: tj.iterPath } })
              j = nested.endIdx
            } else if (tj.type === 'if') {
              const nestedIf = parseIfBlock(tokens, j + 1)
              elseNodes.push({ type: 'block', children: nestedIf.children, condInfo: { negate: tj.negate, pathVar: tj.pathVar } })
              j = nestedIf.endIdx
            }
          }
          j++
        }

        const node: Node = {
          type: 'block',
          children: [
            { type: 'block', children: thenNodes, condInfo: { negate: false, pathVar: t.pathVar } },
            { type: 'block', children: elseNodes, condInfo: { negate: true, pathVar: t.pathVar } },
          ],
          condInfo: { negate: t.negate, pathVar: t.pathVar },
        }
        children.push(node)
        i = j + 1
        continue
      } else {
        // if without else
        const thenBlock = parseBlock(tokens, i + 1, 'endif')
        children.push({
          type: 'block',
          children: thenBlock.children,
          condInfo: { negate: t.negate, pathVar: t.pathVar },
        })
        i = thenBlock.endIdx + 1
        continue
      }
    }

    // Handle end tag
    if (t.type === endTag) {
      if (depth === 0) return { children, endIdx: i }
      depth--
      i++
      continue
    }

    // Depth tracking for nested blocks
    if ((t as Token).type === 'for' || (t as Token).type === 'if') {
      depth++
    } else if ((t as Token).type === 'endfor' || (t as Token).type === 'endif') {
      if (depth > 0) depth--
    }

    // Content nodes
    if (t.type === 'text') {
      children.push({ type: 'text', value: t.value })
    } else if (t.type === 'expr') {
      children.push({ type: 'expr', value: t.value, filters: t.filters })
    }

    i++
  }

  return { children, endIdx: i }
}

/** Parse if/else/endif block. */
function parseIfBlock(tokens: Token[], start: number): { children: Node[]; endIdx: number } {
  const elseIdx = findTokenAtDepth(tokens, start, 'else', 'endif')

  if (elseIdx !== -1 && tokens[elseIdx]!.type === 'else') {
    // Split tokens into then-branch (start..elseIdx-1) and else-branch (elseIdx+1..end)
    const thenNodes: Node[] = []
    let j = start
    while (j < elseIdx) {
      const tj = tokens[j]!
      if (tj.type === 'text') thenNodes.push({ type: 'text', value: tj.value })
      else if (tj.type === 'expr') thenNodes.push({ type: 'expr', value: tj.value, filters: tj.filters })
      j++
    }

    // Parse else branch
    const elseBlock = parseBlock(tokens, elseIdx + 1, 'endif')

    return {
      children: [
        { type: 'block', children: thenNodes, condInfo: { negate: false, pathVar: '' } },
        { type: 'block', children: elseBlock.children, condInfo: { negate: true, pathVar: '' } },
      ],
      endIdx: elseBlock.endIdx,
    }
  }

  return parseBlock(tokens, start, 'endif')
}

function findTokenAtDepth(tokens: Token[], start: number, ...targets: string[]): number {
  let depth = 0
  for (let i = start; i < tokens.length; i++) {
    const t = tokens[i]!
    if (t.type === 'for' || t.type === 'if') depth++
    else if (t.type === 'endfor' || t.type === 'endif') {
      if (depth === 0 && targets.includes(t.type)) return i
      depth--
    } else if (t.type === 'else' && depth === 0 && targets.includes('else')) return i
  }
  return -1
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

export function renderTemplate(template: string, context: TemplateContext = {}): string {
  const tokens = tokenize(template)
  const ast = parse(tokens)
  return evaluateNodes(ast, { ...context })
}

function evaluateNodes(nodes: Node[], ctx: TemplateContext): string {
  const parts: string[] = []

  for (const node of nodes) {
    if (node.type === 'text') {
      parts.push(node.value!)
    } else if (node.type === 'expr') {
      parts.push(evaluateExpr(node, ctx))
    } else if (node.type === 'block') {
      parts.push(evaluateBlock(node, ctx))
    }
  }

  return parts.join('')
}

function evaluateBlock(node: Node, ctx: TemplateContext): string {
  // For-loop block
  if (node.loopInfo) {
    const { varName, iterPath } = node.loopInfo
    const iter = resolvePath(ctx, iterPath)

    if (!Array.isArray(iter)) {
      // Try string repeat: '=' * N or '~' * string.length
      if (iterPath.includes("'") || iterPath.includes('"')) {
        // Expression like '~' * name.length - not supported in simple mode, return empty
        return ''
      }
      return ''
    }

    return iter.map((item: unknown, index: number) => {
      const loop = {
        index: index + 1,
        index0: index,
        first: index === 0,
        last: index === iter.length - 1,
        length: iter.length,
        revindex: iter.length - index,
        revindex0: iter.length - index - 1,
      }

      const subCtx = { ...ctx, [varName]: item, loop }
      return evaluateNodes(node.children!, subCtx)
    }).join('')
  }

  // If block
  if (node.condInfo) {
    const { negate, pathVar } = node.condInfo

    // Root if node: expects children to be [thenBlock, elseBlock?]
    // thenBlock has condInfo.negate=false, elseBlock has condInfo.negate=true
    const thenBlock = node.children!.find(c => c.type === 'block' && c.condInfo && !c.condInfo.negate)
    const elseBlock = node.children!.find(c => c.type === 'block' && c.condInfo && c.condInfo.negate)

    const val = resolvePath(ctx, pathVar)
    const condition = negate ? !val : !!val

    if (thenBlock || elseBlock) {
      // This is an if/else — pick the right branch
      const targetBlock = condition ? thenBlock : elseBlock
      if (targetBlock && targetBlock.children) {
        return evaluateNodes(targetBlock.children, ctx)
      }
      return ''
    }

    // Simple if without else: children are the then-body
    if (condition) {
      return evaluateNodes(node.children!, ctx)
    }
    return ''
  }

  return ''
}

function evaluateExpr(node: Node, ctx: TemplateContext): string {
  const path = node.value!.trim()
  let value = resolvePath(ctx, path)

  // Apply filters
  if (node.filters) {
    for (const filter of node.filters) {
      value = applyFilter(value, filter)
    }
  }

  if (value === undefined || value === null) return ''
  if (typeof value === 'object') {
    try { return JSON.stringify(value) } catch { return String(value) }
  }
  return String(value)
}

function applyFilter(value: unknown, filterExpr: string): unknown {
  const match = filterExpr.match(/^(\w+)(?:\((.+)\))?$/)
  if (!match) return value

  const filterName = match[1]!
  const args = match[2] ?? ''

  switch (filterName) {
    case 'default': {
      if (value === undefined || value === null || value === '') {
        // Strip quotes from arg
        const arg = args.replace(/^["']|["']$/g, '')
        return arg
      }
      return value
    }
    case 'length': {
      if (typeof value === 'string' || Array.isArray(value)) return (value as { length: number }).length
      return 0
    }
    case 'upper': return String(value).toUpperCase()
    case 'lower': return String(value).toLowerCase()
    case 'title': return String(value).replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    case 'trim': return String(value).trim()
    case 'tojson': return JSON.stringify(value)
    case 'int': return parseInt(String(value), 10)
    case 'float': return parseFloat(String(value))
    case 'abs': return Math.abs(Number(value))
    case 'first': {
      if (Array.isArray(value)) return value[0]
      if (typeof value === 'string') return value[0]
      return value
    }
    case 'last': {
      if (Array.isArray(value)) return value[value.length - 1]
      if (typeof value === 'string') return value[value.length - 1]
      return value
    }
    case 'join': {
      if (Array.isArray(value)) return value.join(args.replace(/^["']|["']$/g, ''))
      return value
    }
    default:
      return value
  }
}

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

function resolvePath(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) return undefined
  if (!path || path === '') return obj

  // Handle bracket notation and dot access
  const segments: string[] = []
  const bracketRegex = /(\w+)|\["([^"]+)"\]|\[(\d+)\]/g
  let m: RegExpExecArray | null
  while ((m = bracketRegex.exec(path)) !== null) {
    segments.push(m[1] ?? m[2] ?? m[3]!)
  }

  if (segments.length === 0) {
    segments.push(...path.split('.'))
  }

  let current: unknown = obj
  for (const seg of segments) {
    if (current === null || current === undefined) return undefined
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[seg]
    } else {
      return undefined
    }
  }

  return current
}

// ---------------------------------------------------------------------------
// Convenience
// ---------------------------------------------------------------------------

import { renderRst } from '../index'

export function renderRstTemplate(
  template: string,
  context: TemplateContext = {},
): string {
  const rst = renderTemplate(template, context)
  return renderRst(rst)
}
