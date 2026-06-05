/**
 * Adapter that converts rst-compiler's AST into our unified RST AST.
 *
 * This allows us to benefit from rst-compiler's mature parsing while
 * keeping our own clean AST as the single source of truth for rendering.
 *
 * Usage:
 *   import { RstToHtmlCompiler } from 'rst-compiler'
 *   const rstCompiler = new RstToHtmlCompiler()
 *   const parserOutput = rstCompiler.parse(rstSource)
 *   const document = convertCompilerAst(parserOutput)
 */

import type {
  RstDocument,
  RstSection,
  RstParagraph,
  RstText,
  RstBlockNode,
  RstInlineNode,
  RstBlockquoteAttribution,
} from '../ast/types'
import { RstParser, RstParserOptions, RstParserOutput } from './index'

/**
 * Create a parser backend powered by rst-compiler.
 * Requires 'rst-compiler' to be installed as a dependency.
 */
export function createRstCompilerParser(): RstParser {
  let compiler: typeof import('rst-compiler').RstToHtmlCompiler | null = null

  function getCompiler() {
    if (compiler) return compiler
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { RstToHtmlCompiler } = require('rst-compiler') as typeof import('rst-compiler')
      compiler = RstToHtmlCompiler
      return compiler
    } catch {
      throw new Error(
        'rst-compiler is not installed. Install it with: pnpm add rst-compiler'
      )
    }
  }

  return {
    name: 'rst-compiler',

    parse(opts: RstParserOptions): RstParserOutput {
      const RstToHtmlCompiler = getCompiler()

      const c = new RstToHtmlCompiler()
      let input = opts.input
      if (opts.epilog) input += `\n\n${opts.epilog}`

      const compilerOutput = c.parse(input, { quiet: opts.quiet })

      const document: RstDocument = {
        type: 'Document',
        source: { startLine: 0, endLine: 0 },
        text: '',
        children: [],
      }

      // Convert rst-compiler nodes to our AST
      const root = (compilerOutput as { root: { children: unknown[] } }).root
      for (const child of root.children) {
        const converted = convertNode(child)
        if (converted) {
          document.children.push(converted)
        }
      }

      return {
        document,
        warnings: c.outputWarnings.slice(),
        errors: c.outputErrors.slice(),
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function filterNull<T>(arr: (T | null | undefined)[]): T[] {
  return arr.filter((x): x is T => x != null)
}

function convertNodes(arr: unknown[]): RstBlockNode[] {
  return filterNull(arr.map(convertNode))
}

function convertInlines(arr: unknown[]): RstInlineNode[] {
  return filterNull(arr.map(convertInline))
}

// ---------------------------------------------------------------------------
// Node conversion (rst-compiler AST → our AST)
// ---------------------------------------------------------------------------

function convertNode(node: unknown): RstBlockNode | null {
  const n = node as Record<string, unknown>
  if (!n || typeof n !== 'object') return null

  const nodeType = n.nodeType as string

  switch (nodeType) {
    case 'Section': {
      const section: RstSection = {
        type: 'Section',
        source: toSource(n),
        text: n.textContent as string,
        title: n.textContent as string,
        level: (n.level as number) ?? 1,
        children: [],
        subsections: [],
      }
      const children = (n as { children: unknown[] }).children
      if (children) {
        for (const c of children) {
          const conv = convertNode(c)
          if (conv) section.children.push(conv)
        }
      }
      return section
    }

    case 'Paragraph': {
      const children = (n as { children: unknown[] }).children
      const para: RstParagraph = {
        type: 'Paragraph',
        source: toSource(n),
        text: n.textContent as string,
        children: children?.map(convertInline).filter((x): x is RstInlineNode => x != null) as RstParagraph['children'] ?? [],
      }
      return para
    }

    case 'Transition':
      return {
        type: 'Transition',
        source: toSource(n),
        text: '',
      }

    // Lists
    case 'BulletList':
      return convertBulletList(n)
    case 'EnumeratedList':
      return convertEnumeratedList(n)
    case 'DefinitionList':
      return convertDefinitionList(n)
    case 'FieldList':
      return convertFieldList(n)
    case 'OptionList':
      return convertOptionList(n)

    // Blocks
    case 'LiteralBlock':
      return {
        type: 'LiteralBlock',
        source: toSource(n),
        text: n.textContent as string,
      }
    case 'LineBlock':
      return {
        type: 'LineBlock',
        source: toSource(n),
        text: n.textContent as string,
        lines: (n as { lines: string[] }).lines ?? [n.textContent as string],
      }
    case 'Blockquote':
      return convertBlockquote(n)
    case 'DoctestBlock':
      return {
        type: 'DoctestBlock',
        source: toSource(n),
        text: n.textContent as string,
      }

    // Explicit markup
    case 'Directive':
      return convertDirective(n)
    case 'Comment':
      return {
        type: 'Comment',
        source: toSource(n),
        text: n.textContent as string,
      }
    case 'FootnoteDef':
      return convertFootnoteDef(n)
    case 'CitationDef':
      return convertCitationDef(n)
    case 'HyperlinkTarget':
      return {
        type: 'HyperlinkTarget',
        source: toSource(n),
        text: '',
        name: (n as { name: string }).name ?? '',
        url: (n as { url: string }).url ?? '',
      }
    case 'SubstitutionDef':
      return {
        type: 'SubstitutionDef',
        source: toSource(n),
        text: '',
        name: (n as { name: string }).name ?? '',
        children: [],
      }

    // Table
    case 'Table':
      return convertTable(n)

    default:
      return null
  }
}

function convertInline(node: unknown): RstParagraph['children'][number] | null {
  const n = node as Record<string, unknown>
  if (!n || typeof n !== 'object') return null

  const nodeType = n.nodeType as string

  switch (nodeType) {
    case 'Text':
      return {
        type: 'Text',
        source: toSource(n),
        text: n.textContent as string,
      } as RstText

    case 'Emphasis':
      return {
        type: 'Emphasis',
        source: toSource(n),
        text: n.textContent as string,
        children: (n as { children: unknown[] }).children?.map(convertInline).filter((x): x is RstInlineNode => x != null) ?? [],
      }

    case 'StrongEmphasis':
    case 'Strong': {
      const inlineChildren = (n as { children: unknown[] }).children?.map(convertInline).filter((x): x is RstInlineNode => x != null) ?? []
      return {
        type: 'StrongEmphasis',
        source: toSource(n),
        text: n.textContent as string,
        children: inlineChildren.length > 0 ? inlineChildren : [{ type: 'Text', source: toSource(n), text: n.textContent as string } as RstText],
      }
    }

    case 'InlineLiteral':
    case 'Literal':
      return {
        type: 'InlineLiteral',
        source: toSource(n),
        text: n.textContent as string,
      }

    case 'InterpretedText':
      return {
        type: 'InterpretedText',
        source: toSource(n),
        text: n.textContent as string,
        role: (n as { role: string }).role ?? '',
        displayText: (n as { displayText: string }).displayText ?? '',
        body: (n as { body: string }).body ?? n.textContent as string,
      }

    case 'HyperlinkRef':
      return {
        type: 'HyperlinkRef',
        source: toSource(n),
        text: n.textContent as string,
        target: (n as { target: string }).target ?? '',
        displayText: (n as { displayText: string }).displayText ?? '',
      }

    case 'SubstitutionRef':
      return {
        type: 'SubstitutionRef',
        source: toSource(n),
        text: '',
        refName: (n as { refName: string }).refName ?? '',
      }

    case 'FootnoteRef':
      return {
        type: 'FootnoteRef',
        source: toSource(n),
        text: n.textContent as string,
        label: (n as { label: string }).label ?? '',
      }

    case 'CitationRef':
      return {
        type: 'CitationRef',
        source: toSource(n),
        text: n.textContent as string,
        label: (n as { label: string }).label ?? '',
      }

    case 'InlineInternalTarget':
    case 'InlineTarget':
      return {
        type: 'InlineTarget',
        source: toSource(n),
        text: '',
        name: (n as { name: string }).name ?? '',
      }

    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Helper converters
// ---------------------------------------------------------------------------

function toSource(n: Record<string, unknown>): RstDocument['source'] {
  const src = n.source as { startLineIdx: number; endLineIdx: number } | undefined
  return {
    startLine: src?.startLineIdx ?? 0,
    endLine: src?.endLineIdx ?? 0,
  }
}

function convertBulletList(n: Record<string, unknown>): RstBlockNode {
  const children = (n as { children: unknown[] }).children ?? []
  return {
    type: 'BulletList',
    source: toSource(n),
    text: '',
    children: children.map(c => {
      const item = c as Record<string, unknown>
      return {
        type: 'BulletListItem',
        source: toSource(item),
        text: '',
        children: convertNodes(item.children as unknown[]) ?? [],
      }
    }),
  }
}

function convertEnumeratedList(n: Record<string, unknown>): RstBlockNode {
  const children = (n as { children: unknown[] }).children ?? []
  return {
    type: 'EnumeratedList',
    source: toSource(n),
    text: '',
    enumType: (n as { enumType: string }).enumType ?? 'arabic',
    start: (n as { start: number }).start ?? 1,
    children: children.map(c => {
      const item = c as Record<string, unknown>
      return {
        type: 'EnumeratedListItem',
        source: toSource(item),
        text: '',
        children: convertNodes(item.children as unknown[]) ?? [],
      }
    }),
  }
}

function convertDefinitionList(n: Record<string, unknown>): RstBlockNode {
  const children = (n as { children: unknown[] }).children ?? []
  return {
    type: 'DefinitionList',
    source: toSource(n),
    text: '',
    children: children.map(c => {
      const item = c as Record<string, unknown>
      return {
        type: 'DefinitionListItem',
        source: toSource(item),
        text: '',
        term: convertInlines(item.term as unknown[]) ?? [],
        definition: convertNodes(item.definition as unknown[]) ?? [],
      }
    }),
  }
}

function convertFieldList(n: Record<string, unknown>): RstBlockNode {
  const children = (n as { children: unknown[] }).children ?? []
  return {
    type: 'FieldList',
    source: toSource(n),
    text: '',
    children: children.map(c => {
      const item = c as Record<string, unknown>
      return {
        type: 'FieldListItem',
        source: toSource(item),
        text: '',
        name: (item as { name: string }).name ?? '',
        body: convertNodes(item.body as unknown[]) ?? [],
      }
    }),
  }
}

function convertOptionList(n: Record<string, unknown>): RstBlockNode {
  const children = (n as { children: unknown[] }).children ?? []
  return {
    type: 'OptionList',
    source: toSource(n),
    text: '',
    children: children.map(c => {
      const item = c as Record<string, unknown>
      return {
        type: 'OptionListItem',
        source: toSource(item),
        text: '',
        options: (item as { options: string[] }).options ?? [],
        description: convertNodes(item.description as unknown[]) ?? [],
      }
    }),
  }
}

function convertBlockquote(n: Record<string, unknown>): RstBlockNode {
  const children = (n as { children: unknown[] }).children ?? []
  const attribution = (n as { attribution: unknown }).attribution
  return {
    type: 'Blockquote',
    source: toSource(n),
    text: '',
    children: children.map(convertNode).filter((x): x is RstBlockNode => x != null),
    attribution: attribution ? convertNode(attribution) as unknown as RstBlockquoteAttribution : undefined,
  }
}

function convertDirective(n: Record<string, unknown>): RstBlockNode {
  return {
    type: 'Directive',
    source: toSource(n),
    text: n.textContent as string,
    name: ((n as { name: string }).name ?? '').toLowerCase(),
    arguments: (n as { arguments: string[] }).arguments ?? [],
    options: (n as { options: Record<string, string> }).options ?? {},
    children: ((n as { children: unknown[] }).children ?? [])
      .map(convertNode).filter((x): x is RstBlockNode => x != null),
  }
}

function convertFootnoteDef(n: Record<string, unknown>): RstBlockNode {
  const children = (n as { children: unknown[] }).children ?? []
  return {
    type: 'FootnoteDef',
    source: toSource(n),
    text: '',
    label: (n as { label: string }).label ?? '',
    children: children.map(convertNode).filter((x): x is RstBlockNode => x != null),
  }
}

function convertCitationDef(n: Record<string, unknown>): RstBlockNode {
  const children = (n as { children: unknown[] }).children ?? []
  return {
    type: 'CitationDef',
    source: toSource(n),
    text: '',
    label: (n as { label: string }).label ?? '',
    children: children.map(convertNode).filter((x): x is RstBlockNode => x != null),
  }
}

function convertTable(n: Record<string, unknown>): RstBlockNode {
  const children = (n as { children: unknown[] }).children ?? []
  return {
    type: 'Table',
    source: toSource(n),
    text: '',
    widths: (n as { widths: number[] }).widths ?? [],
    headerRows: (n as { headerRows: number }).headerRows ?? 0,
    children: children.map(row => {
      const r = row as Record<string, unknown>
      return {
        type: 'TableRow',
        source: toSource(r),
        text: '',
        children: ((r.children as unknown[]) ?? []).map(cell => {
          const cl = cell as Record<string, unknown>
          return {
            type: 'TableCell',
            source: toSource(cl),
            text: '',
            colspan: (cl as { colspan: number }).colspan ?? 1,
            rowspan: (cl as { rowspan: number }).rowspan ?? 1,
            children: ((cl.children as unknown[]) ?? []).map(convertNode).filter((x): x is RstBlockNode => x != null),
          }
        }),
      }
    }),
  }
}
