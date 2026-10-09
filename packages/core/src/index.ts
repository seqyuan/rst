// ---------------------------------------------------------------------------
// @seqyuan/rst-renderer — Main entry point
// ---------------------------------------------------------------------------

// AST types
export type {
  RstNode, RstNodeType, RstSourceLocation,
  RstDocument, RstSection, RstParagraph, RstTransition,
  RstText, RstEmphasis, RstStrongEmphasis, RstInlineLiteral,
  RstInterpretedText, RstHyperlinkRef, RstSubstitutionRef,
  RstFootnoteRef, RstCitationRef, RstInlineTarget,
  RstBulletList, RstBulletListItem,
  RstEnumeratedList, RstEnumeratedListItem,
  RstDefinitionList, RstDefinitionListItem,
  RstFieldList, RstFieldListItem,
  RstOptionList, RstOptionListItem,
  RstLiteralBlock, RstLineBlock, RstBlockquote,
  RstBlockquoteAttribution, RstDoctestBlock,
  RstDirective, RstComment, RstFootnoteDef, RstCitationDef,
  RstHyperlinkTarget, RstSubstitutionDef,
  RstTable, RstTableRow, RstTableCell,
  RstInlineNode, RstBlockNode,
} from './ast/index'

// AST utilities
export { walkAst } from './ast/visitor'
export type { RstVisitor } from './ast/visitor'

// Parser interface
export type { RstParser, RstParserOptions, RstParserOutput } from './parser/index'

// Parser implementations
export { createBuiltinParser } from './parser/builtin-parser'
export { createRstCompilerParser } from './parser/rst-compiler-adapter'
export { expandIncludes } from './preprocess/includes'
export type { IncludeExpansionOptions } from './preprocess/includes'

// Renderer
export { HtmlRenderer } from './renderer/html/index'
export { ReactRenderer } from './renderer/react/index'
export type { ReactRendererOptions, RstComponentMap } from './renderer/react/index'
export { MarkdownRenderer } from './renderer/markdown/index'
export type { MarkdownRendererOptions } from './renderer/markdown/index'
export type { RstRenderer, RenderContext } from './renderer/base'
export { escapeHtml, idFromTitle } from './renderer/base'

// Templates
export { renderTemplate, renderRstTemplate } from './templates/index'
export type { TemplateContext } from './templates/index'

// Theme + full-document wrapper
export { DEFAULT_THEME_CSS, wrapHtmlDocument } from './theme/index'
export type { WrapHtmlDocumentOptions } from './theme/index'

// Plugins
export type { DirectivePlugin } from './plugins/directives'
export {
  imagePlugin,
  admonitionPlugin,
  codePlugin,
  highlightPlugin,
  mathPlugin,
  contentsPlugin,
  csvTablePlugin,
  listTablePlugin,
  replacePlugin,
  rawPlugin,
  containerPlugin,
  includePlugin,
  builtinDirectivePlugins,
  preloadRenderers,
} from './plugins/directives'

// ---------------------------------------------------------------------------
// Convenience function: one-shot parse + render
// ---------------------------------------------------------------------------

import { HtmlRenderer } from './renderer/html/index'
import { createBuiltinParser } from './parser/builtin-parser'
import { createRstCompilerParser } from './parser/rst-compiler-adapter'
import { builtinDirectivePlugins } from './plugins/directives'
import type { RstDocument } from './ast/types'
import { expandIncludes } from './preprocess/includes'

export interface RenderOptions {
  /** Which parser backend to use (default: builtin). */
  parser?: 'builtin' | 'rst-compiler'
  /** Custom directive plugins. */
  plugins?: typeof builtinDirectivePlugins
  /** Expand .. include:: directives before parsing. */
  includeResolver?: {
    baseDir: string
    maxDepth?: number
  }
  /**
   * Offset added to RST section levels when choosing an `<hN>` tag.
   * Default `1` (level-1 section -> `<h2>`). Pass `0` for a standalone
   * document whose top-level title should be `<h1>`.
   */
  headingOffset?: number
  /**
   * Base directory for resolving `.. csv-table:: :file:` references at render
   * time. Defaults to the process working directory when running in Node.
   */
  baseDir?: string
}

/**
 * Parse RST source and render to HTML in one call.
 *
 * @example
 * ```ts
 * const html = renderRst('Hello\n=====\n\nThis is **bold** text.')
 * ```
 */
export function renderRst(source: string, options: RenderOptions = {}): string {
  if (options.includeResolver) {
    source = expandIncludes(source, options.includeResolver)
  }

  let document: RstDocument

  if (options.parser === 'rst-compiler') {
    // The adapter loads `rst-compiler` lazily and throws a clear error when it
    // is missing; do not wrap this in a try/catch that masks real parse errors.
    document = createRstCompilerParser().parse({ input: source }).document
  } else {
    document = createBuiltinParser().parse({ input: source }).document
  }

  const renderer = new HtmlRenderer({ headingOffset: options.headingOffset })

  // Install plugins
  for (const plugin of options.plugins ?? builtinDirectivePlugins) {
    plugin.install(renderer)
  }

  const context = options.baseDir ? { data: { baseDir: options.baseDir } } : undefined
  return renderer.render(document, context)
}
