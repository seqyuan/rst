import type { RstDocument } from '../ast/types'

/**
 * Options passed to every parser.
 */
export interface RstParserOptions {
  /** Initial source text passed to the parser. */
  input: string
  /** Optional text appended to the end before parsing. */
  epilog?: string
  /** Whether to emit warnings to console. */
  quiet?: boolean
}

/**
 * Result of calling parser.parse().
 */
export interface RstParserOutput {
  /** The root document node. */
  document: RstDocument
  /** Any warnings emitted during parsing. */
  warnings: string[]
  /** Any fatal errors. If non-empty, the document may be incomplete. */
  errors: string[]
}

/**
 * Interface that every parser backend must implement.
 */
export interface RstParser {
  /** Human-readable name for this parser backend. */
  readonly name: string
  /** Parse RST source text into a unified RstDocument AST. */
  parse(opts: RstParserOptions): RstParserOutput
}
