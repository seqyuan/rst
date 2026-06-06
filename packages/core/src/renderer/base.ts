import type { RstNode, RstDocument } from '../ast/types'

// ---------------------------------------------------------------------------
// Renderer interface: a backend that converts RST AST to a target format
// ---------------------------------------------------------------------------

/**
 * Context passed to every node renderer.
 * Carries accumulated output plus shared state (e.g. heading counters, link resolvers).
 */
export interface RenderContext {
  /** Append raw output (typically HTML string or markdown text). */
  write(s: string): void
  /** Document being rendered. Used by document-level directives such as contents. */
  document: RstDocument
  /** Current list of registered footnote definitions, keyed by label. */
  footnotes: Map<string, string>
  /** Current list of registered citation definitions, keyed by label. */
  citations: Map<string, string>
  /** Current list of hyperlink targets, keyed by name. */
  linkTargets: Map<string, string>
  /** Heading counter for generating anchor IDs. */
  headingIds: Map<string, number>
  /** Arbitrary user data passed through from top-level render call. */
  data: Record<string, unknown>
}

/**
 * Signature of a node-type-specific render function.
 */
export type NodeRenderer<T extends RstNode = RstNode> = (node: T, ctx: RenderContext) => void

/**
 * A renderer backend maps RST node types to output functions.
 */
export interface RstRenderer {
  readonly name: string
  render(document: RstDocument, context?: Partial<RenderContext>): string
  renderNode(node: RstNode, ctx: RenderContext): void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function idFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-') // keep CJK characters
    .replace(/^-|-$/g, '')
}
