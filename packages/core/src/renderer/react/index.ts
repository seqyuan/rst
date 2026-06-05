// ---------------------------------------------------------------------------
// @seqyuan/rst-renderer/react — RST → React component tree
// ---------------------------------------------------------------------------

import { createElement, type ReactNode, type ComponentType } from 'react'
import type {
  RstDocument, RstSection, RstParagraph, RstTransition,
  RstText, RstEmphasis, RstStrongEmphasis, RstInlineLiteral,
  RstInterpretedText, RstHyperlinkRef, RstSubstitutionRef,
  RstFootnoteRef, RstCitationRef, RstInlineTarget,
  RstBulletList, RstBulletListItem,
  RstEnumeratedList, RstEnumeratedListItem,
  RstDefinitionList, RstDefinitionListItem,
  RstFieldList, RstFieldListItem,
  RstOptionList, RstOptionListItem,
  RstLiteralBlock, RstLineBlock, RstBlockquote, RstDoctestBlock,
  RstDirective, RstComment,
  RstTable, RstTableRow, RstTableCell,
  RstBlockNode, RstInlineNode,
} from '../../ast/types'
import { idFromTitle } from '../base'

// ---------------------------------------------------------------------------
// Component map
// ---------------------------------------------------------------------------

export interface RstComponentMap {
  Document?: ComponentType<{ node: RstDocument; children?: ReactNode }>
  Section?: ComponentType<{ node: RstSection; children?: ReactNode }>
  Paragraph?: ComponentType<{ node: RstParagraph; children?: ReactNode }>
  Transition?: ComponentType<{ node: RstTransition }>
  Text?: ComponentType<{ node: RstText }>
  Emphasis?: ComponentType<{ node: RstEmphasis; children?: ReactNode }>
  StrongEmphasis?: ComponentType<{ node: RstStrongEmphasis; children?: ReactNode }>
  InlineLiteral?: ComponentType<{ node: RstInlineLiteral }>
  InterpretedText?: ComponentType<{ node: RstInterpretedText }>
  HyperlinkRef?: ComponentType<{ node: RstHyperlinkRef; children?: ReactNode }>
  SubstitutionRef?: ComponentType<{ node: RstSubstitutionRef }>
  FootnoteRef?: ComponentType<{ node: RstFootnoteRef }>
  CitationRef?: ComponentType<{ node: RstCitationRef }>
  InlineTarget?: ComponentType<{ node: RstInlineTarget }>
  BulletList?: ComponentType<{ node: RstBulletList; children?: ReactNode }>
  BulletListItem?: ComponentType<{ node: RstBulletListItem; children?: ReactNode }>
  EnumeratedList?: ComponentType<{ node: RstEnumeratedList; children?: ReactNode }>
  EnumeratedListItem?: ComponentType<{ node: RstEnumeratedListItem; children?: ReactNode }>
  DefinitionList?: ComponentType<{ node: RstDefinitionList; children?: ReactNode }>
  DefinitionListItem?: ComponentType<{ node: RstDefinitionListItem; term?: ReactNode; definition?: ReactNode }>
  FieldList?: ComponentType<{ node: RstFieldList; children?: ReactNode }>
  FieldListItem?: ComponentType<{ node: RstFieldListItem; body?: ReactNode }>
  OptionList?: ComponentType<{ node: RstOptionList; children?: ReactNode }>
  OptionListItem?: ComponentType<{ node: RstOptionListItem; description?: ReactNode }>
  LiteralBlock?: ComponentType<{ node: RstLiteralBlock }>
  LineBlock?: ComponentType<{ node: RstLineBlock }>
  Blockquote?: ComponentType<{ node: RstBlockquote; children?: ReactNode }>
  DoctestBlock?: ComponentType<{ node: RstDoctestBlock }>
  Directive?: ComponentType<{ node: RstDirective; children?: ReactNode }>
  Comment?: ComponentType<{ node: RstComment }>
  Table?: ComponentType<{ node: RstTable; children?: ReactNode }>
  TableRow?: ComponentType<{ node: RstTableRow; children?: ReactNode }>
  TableCell?: ComponentType<{ node: RstTableCell; children?: ReactNode }>
}

// ---------------------------------------------------------------------------
// Default components
// ---------------------------------------------------------------------------

const DefaultDocument: RstComponentMap['Document'] = ({ children }) =>
  createElement('div', { className: 'rst-document' }, children)

const DefaultSection: RstComponentMap['Section'] = ({ node, children }) => {
  const level = Math.min(node.level + 1, 6)
  const H = `h${level}` as 'h1'
  return createElement('section', { className: 'rst-section' },
    createElement(H, { id: idFromTitle(node.title) }, node.title),
    children,
  )
}

const DefaultParagraph: RstComponentMap['Paragraph'] = ({ children }) =>
  createElement('p', { className: 'rst-paragraph' }, children)

const DefaultTransition: RstComponentMap['Transition'] = () =>
  createElement('hr', { className: 'rst-transition' })

const DefaultText: RstComponentMap['Text'] = ({ node }) => node.text as ReactNode

const DefaultEmphasis: RstComponentMap['Emphasis'] = ({ children }) =>
  createElement('em', null, children)

const DefaultStrongEmphasis: RstComponentMap['StrongEmphasis'] = ({ children }) =>
  createElement('strong', null, children)

const DefaultInlineLiteral: RstComponentMap['InlineLiteral'] = ({ node }) =>
  createElement('code', null, node.text)

const DefaultInterpretedText: RstComponentMap['InterpretedText'] = ({ node }) =>
  createElement('span', { className: `rst-interpreted-${node.role}` }, node.displayText || node.body)

const DefaultHyperlinkRef: RstComponentMap['HyperlinkRef'] = ({ node }) =>
  createElement('a', { href: node.target, className: 'rst-link' }, node.displayText || node.target)

const DefaultSubstitutionRef: RstComponentMap['SubstitutionRef'] = () => null
const DefaultFootnoteRef: RstComponentMap['FootnoteRef'] = ({ node }) =>
  createElement('sup', null,
    createElement('a', { href: `#fn-${node.label}`, id: `fnref-${node.label}` }, `[${node.label}]`),
  )
const DefaultCitationRef: RstComponentMap['CitationRef'] = ({ node }) =>
  createElement('a', { href: `#cite-${node.label}` }, `[${node.label}]`)
const DefaultInlineTarget: RstComponentMap['InlineTarget'] = ({ node }) =>
  createElement('span', { id: node.name })

const DefaultBulletList: RstComponentMap['BulletList'] = ({ children }) =>
  createElement('ul', null, children)
const DefaultBulletListItem: RstComponentMap['BulletListItem'] = ({ children }) =>
  createElement('li', null, children)
const DefaultEnumeratedList: RstComponentMap['EnumeratedList'] = ({ node, children }) =>
  createElement('ol', { start: node.start > 1 ? node.start : undefined }, children)
const DefaultEnumeratedListItem: RstComponentMap['EnumeratedListItem'] = ({ children }) =>
  createElement('li', null, children)

const DefaultDefinitionList: RstComponentMap['DefinitionList'] = ({ children }) =>
  createElement('dl', null, children)
const DefaultDefinitionListItem: RstComponentMap['DefinitionListItem'] = ({ term, definition }) =>
  createElement('div', null, createElement('dt', null, term), createElement('dd', null, definition))

const DefaultFieldList: RstComponentMap['FieldList'] = ({ children }) =>
  createElement('dl', null, children)
const DefaultFieldListItem: RstComponentMap['FieldListItem'] = ({ node, body }) =>
  createElement('div', null, createElement('dt', null, node.name), createElement('dd', null, body))

const DefaultOptionList: RstComponentMap['OptionList'] = ({ children }) =>
  createElement('dl', null, children)
const DefaultOptionListItem: RstComponentMap['OptionListItem'] = ({ node, description }) =>
  createElement('div', null,
    createElement('dt', null, node.options.map((o: string) => createElement('code', { key: o }, o))),
    createElement('dd', null, description),
  )

const DefaultLiteralBlock: RstComponentMap['LiteralBlock'] = ({ node }) =>
  createElement('pre', null,
    createElement('code', { className: node.language ? `language-${node.language}` : undefined }, node.text),
  )
const DefaultLineBlock: RstComponentMap['LineBlock'] = ({ node }) =>
  createElement('div', null, node.lines.map((l, i) => createElement('div', { key: i }, l)))

const DefaultBlockquote: RstComponentMap['Blockquote'] = ({ children }) =>
  createElement('blockquote', null, children)
const DefaultDoctestBlock: RstComponentMap['DoctestBlock'] = ({ node }) =>
  createElement('pre', null, createElement('code', null, node.text))
const DefaultDirective: RstComponentMap['Directive'] = ({ node, children }) =>
  createElement('div', { className: `rst-directive rst-directive-${node.name}` }, children)
const DefaultComment: RstComponentMap['Comment'] = () => null

const DefaultTable: RstComponentMap['Table'] = ({ children }) =>
  createElement('table', null, children)
const DefaultTableRow: RstComponentMap['TableRow'] = ({ children }) =>
  createElement('tr', null, children)
const DefaultTableCell: RstComponentMap['TableCell'] = ({ node, children }) =>
  createElement('td', {
    colSpan: node.colspan > 1 ? node.colspan : undefined,
    rowSpan: node.rowspan > 1 ? node.rowspan : undefined,
  }, children)

// ---------------------------------------------------------------------------
// Built-in map
// ---------------------------------------------------------------------------

const defaultComponents: RstComponentMap = {
  Document: DefaultDocument,
  Section: DefaultSection,
  Paragraph: DefaultParagraph,
  Transition: DefaultTransition,
  Text: DefaultText,
  Emphasis: DefaultEmphasis,
  StrongEmphasis: DefaultStrongEmphasis,
  InlineLiteral: DefaultInlineLiteral,
  InterpretedText: DefaultInterpretedText,
  HyperlinkRef: DefaultHyperlinkRef,
  SubstitutionRef: DefaultSubstitutionRef,
  FootnoteRef: DefaultFootnoteRef,
  CitationRef: DefaultCitationRef,
  InlineTarget: DefaultInlineTarget,
  BulletList: DefaultBulletList,
  BulletListItem: DefaultBulletListItem,
  EnumeratedList: DefaultEnumeratedList,
  EnumeratedListItem: DefaultEnumeratedListItem,
  DefinitionList: DefaultDefinitionList,
  DefinitionListItem: DefaultDefinitionListItem,
  FieldList: DefaultFieldList,
  FieldListItem: DefaultFieldListItem,
  OptionList: DefaultOptionList,
  OptionListItem: DefaultOptionListItem,
  LiteralBlock: DefaultLiteralBlock,
  LineBlock: DefaultLineBlock,
  Blockquote: DefaultBlockquote,
  DoctestBlock: DefaultDoctestBlock,
  Directive: DefaultDirective,
  Comment: DefaultComment,
  Table: DefaultTable,
  TableRow: DefaultTableRow,
  TableCell: DefaultTableCell,
}

// ---------------------------------------------------------------------------
// ReactRenderer
// ---------------------------------------------------------------------------

export interface ReactRendererOptions {
  components?: RstComponentMap
}

export class ReactRenderer {
  private comps: RstComponentMap

  constructor(options: ReactRendererOptions = {}) {
    this.comps = { ...defaultComponents, ...options.components }
  }

  render(document: RstDocument): ReactNode {
    return this.renderNode(document)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderNode(node: any): ReactNode {
    const C = (this.comps as any)[node.type]
    if (!C) return null

    switch (node.type) {
      case 'Document':
      case 'Section':
      case 'Paragraph':
      case 'BulletList':
      case 'EnumeratedList':
      case 'DefinitionList':
      case 'FieldList':
      case 'OptionList':
      case 'Blockquote':
      case 'Directive':
      case 'Table':
        return createElement(C, { node },
          node.children.map((c: any, i: number) => this.renderNode(c)),
        )

      case 'BulletListItem':
      case 'EnumeratedListItem':
      case 'TableCell':
        return createElement(C, { node },
          node.children.map((c: any, i: number) => this.renderNode(c)),
        )

      case 'TableRow':
        return createElement(C, { node },
          node.children.map((c: any, i: number) => this.renderNode(c)),
        )

      case 'Emphasis':
      case 'StrongEmphasis':
        return createElement(C, { node },
          node.children.map((c: any, i: number) => this.renderNode(c)),
        )

      case 'DefinitionListItem':
        return createElement(C, {
          node,
          term: node.term.map((t: any, i: number) => this.renderNode(t)),
          definition: node.definition.map((d: any, i: number) => this.renderNode(d)),
        })

      case 'FieldListItem':
        return createElement(C, {
          node,
          body: node.body.map((b: any, i: number) => this.renderNode(b)),
        })

      case 'OptionListItem':
        return createElement(C, {
          node,
          description: node.description.map((d: any, i: number) => this.renderNode(d)),
        })

      case 'HyperlinkRef':
        return createElement(C, { node }, node.displayText || node.target)

      default:
        return createElement(C, { node })
    }
  }
}
