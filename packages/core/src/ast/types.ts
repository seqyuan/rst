// ---------------------------------------------------------------------------
// RST AST: the unified intermediate representation for all renderers
// ---------------------------------------------------------------------------

/**
 * All RST node types in our unified AST.
 * Mirrors the key concepts from Python docutils + rst-compiler.
 */
export type RstNodeType =
  // Structural
  | 'Document'
  | 'Section'
  | 'Paragraph'
  | 'Transition'
  // Inline
  | 'Text'
  | 'Emphasis'
  | 'StrongEmphasis'
  | 'InlineLiteral'
  | 'InterpretedText'
  | 'HyperlinkRef'
  | 'SubstitutionRef'
  | 'FootnoteRef'
  | 'CitationRef'
  | 'InlineTarget'
  // Lists
  | 'BulletList'
  | 'BulletListItem'
  | 'EnumeratedList'
  | 'EnumeratedListItem'
  | 'DefinitionList'
  | 'DefinitionListItem'
  | 'FieldList'
  | 'FieldListItem'
  | 'OptionList'
  | 'OptionListItem'
  // Blocks
  | 'LiteralBlock'
  | 'LineBlock'
  | 'Blockquote'
  | 'BlockquoteAttribution'
  | 'DoctestBlock'
  // Explicit Markup
  | 'Directive'
  | 'Comment'
  | 'FootnoteDef'
  | 'CitationDef'
  | 'HyperlinkTarget'
  | 'SubstitutionDef'
  // Table
  | 'Table'
  | 'TableRow'
  | 'TableCell'

/** A position in source text (0-indexed lines). */
export interface RstSourceLocation {
  startLine: number
  endLine: number // exclusive
}

/** Base interface for all RST AST nodes. */
export interface RstNode {
  readonly type: RstNodeType
  readonly source: RstSourceLocation
  /** Raw text content (before any interpretation). */
  readonly text: string
}

// ---------------------------------------------------------------------------
// Structural nodes
// ---------------------------------------------------------------------------

export interface RstDocument extends RstNode {
  type: 'Document'
  children: RstBlockNode[]
}

export interface RstSection extends RstNode {
  type: 'Section'
  /** The section heading text. */
  title: string
  /** Heading level (1-based, root sections start at 1). */
  level: number
  children: RstBlockNode[]
  /** Sub-sections nested at deeper levels. */
  subsections: RstSection[]
}

export interface RstParagraph extends RstNode {
  type: 'Paragraph'
  children: RstInlineNode[]
}

export interface RstTransition extends RstNode {
  type: 'Transition'
  text: ''
}

// ---------------------------------------------------------------------------
// Inline nodes
// ---------------------------------------------------------------------------

export interface RstText extends RstNode {
  type: 'Text'
}

export interface RstEmphasis extends RstNode {
  type: 'Emphasis'
  children: RstInlineNode[]
}

export interface RstStrongEmphasis extends RstNode {
  type: 'StrongEmphasis'
  children: RstInlineNode[]
}

export interface RstInlineLiteral extends RstNode {
  type: 'InlineLiteral'
}

export interface RstInterpretedText extends RstNode {
  type: 'InterpretedText'
  /** The role prefix, e.g. "ref", "doc", "math", "pep". */
  role: string
  /** Display text (empty string if inline target is the body). */
  displayText: string
  /** The raw body text inside backticks. */
  body: string
}

export interface RstHyperlinkRef extends RstNode {
  type: 'HyperlinkRef'
  /** The target URL or reference name. */
  target: string
  /** Display text. */
  displayText: string
}

export interface RstSubstitutionRef extends RstNode {
  type: 'SubstitutionRef'
  /** The substitution reference name. */
  refName: string
}

export interface RstFootnoteRef extends RstNode {
  type: 'FootnoteRef'
  /** Auto-numbered or explicit label. */
  label: string
}

export interface RstCitationRef extends RstNode {
  type: 'CitationRef'
  label: string
}

export interface RstInlineTarget extends RstNode {
  type: 'InlineTarget'
  /** The target name. */
  name: string
}

// ---------------------------------------------------------------------------
// List nodes
// ---------------------------------------------------------------------------

export interface RstBulletList extends RstNode {
  type: 'BulletList'
  children: RstBulletListItem[]
}

export interface RstBulletListItem extends RstNode {
  type: 'BulletListItem'
  children: RstBlockNode[]
}

export interface RstEnumeratedList extends RstNode {
  type: 'EnumeratedList'
  /** The enumeration style: arabic, loweralpha, upperalpha, lowerroman, upperroman, auto. */
  enumType: string
  /** Starting number. */
  start: number
  children: RstEnumeratedListItem[]
}

export interface RstEnumeratedListItem extends RstNode {
  type: 'EnumeratedListItem'
  children: RstBlockNode[]
}

export interface RstDefinitionList extends RstNode {
  type: 'DefinitionList'
  children: RstDefinitionListItem[]
}

export interface RstDefinitionListItem extends RstNode {
  type: 'DefinitionListItem'
  term: RstInlineNode[]
  definition: RstBlockNode[]
}

export interface RstFieldList extends RstNode {
  type: 'FieldList'
  children: RstFieldListItem[]
}

export interface RstFieldListItem extends RstNode {
  type: 'FieldListItem'
  name: string
  body: RstBlockNode[]
}

export interface RstOptionList extends RstNode {
  type: 'OptionList'
  children: RstOptionListItem[]
}

export interface RstOptionListItem extends RstNode {
  type: 'OptionListItem'
  options: string[]
  description: RstBlockNode[]
}

// ---------------------------------------------------------------------------
// Block nodes
// ---------------------------------------------------------------------------

export interface RstLiteralBlock extends RstNode {
  type: 'LiteralBlock'
  /** Optional language for syntax highlighting. */
  language?: string
  /** Line number display. */
  lineNumbers?: boolean
}

export interface RstLineBlock extends RstNode {
  type: 'LineBlock'
  lines: string[]
}

export interface RstBlockquote extends RstNode {
  type: 'Blockquote'
  children: RstBlockNode[]
  /** Optional attribution line. */
  attribution?: RstBlockquoteAttribution
}

export interface RstBlockquoteAttribution extends RstNode {
  type: 'BlockquoteAttribution'
}

export interface RstDoctestBlock extends RstNode {
  type: 'DoctestBlock'
}

// ---------------------------------------------------------------------------
// Explicit markup
// ---------------------------------------------------------------------------

export interface RstDirective extends RstNode {
  type: 'Directive'
  /** Directive name (lowercased): "image", "code", "note", "math", etc. */
  name: string
  /** Raw arguments after the directive name. */
  arguments: string[]
  /** Key-value options (parsed from the field list). */
  options: Record<string, string>
  /** Raw directive body text after indentation normalization. */
  rawBody?: string
  /** Body content (for directives like code, math, etc.). */
  children: RstBlockNode[]
}

export interface RstComment extends RstNode {
  type: 'Comment'
}

export interface RstFootnoteDef extends RstNode {
  type: 'FootnoteDef'
  label: string
  children: RstBlockNode[]
}

export interface RstCitationDef extends RstNode {
  type: 'CitationDef'
  label: string
  children: RstBlockNode[]
}

export interface RstHyperlinkTarget extends RstNode {
  type: 'HyperlinkTarget'
  /** The target name. */
  name: string
  /** The resolved URL. */
  url: string
}

export interface RstSubstitutionDef extends RstNode {
  type: 'SubstitutionDef'
  name: string
  children: RstBlockNode[]
}

// ---------------------------------------------------------------------------
// Table nodes
// ---------------------------------------------------------------------------

export interface RstTable extends RstNode {
  type: 'Table'
  /** Column widths (empty = auto). */
  widths: number[]
  /** Whether the first row is a header row. */
  headerRows: number
  children: RstTableRow[]
}

export interface RstTableRow extends RstNode {
  type: 'TableRow'
  children: RstTableCell[]
}

export interface RstTableCell extends RstNode {
  type: 'TableCell'
  /** How many columns this cell spans. */
  colspan: number
  /** How many rows this cell spans. */
  rowspan: number
  children: RstBlockNode[]
}

// ---------------------------------------------------------------------------
// Union types for convenience
// ---------------------------------------------------------------------------

export type RstInlineNode =
  | RstText
  | RstEmphasis
  | RstStrongEmphasis
  | RstInlineLiteral
  | RstInterpretedText
  | RstHyperlinkRef
  | RstSubstitutionRef
  | RstFootnoteRef
  | RstCitationRef
  | RstInlineTarget

export type RstBlockNode =
  | RstSection
  | RstParagraph
  | RstTransition
  | RstLiteralBlock
  | RstLineBlock
  | RstBlockquote
  | RstDoctestBlock
  | RstBulletList
  | RstEnumeratedList
  | RstDefinitionList
  | RstFieldList
  | RstOptionList
  | RstDirective
  | RstComment
  | RstFootnoteDef
  | RstCitationDef
  | RstHyperlinkTarget
  | RstSubstitutionDef
  | RstTable
