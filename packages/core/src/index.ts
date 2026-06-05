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

// Plugins
export type { DirectivePlugin } from './plugins/directives'
export {
  imagePlugin,
  admonitionPlugin,
  codePlugin,
  mathPlugin,
  contentsPlugin,
  csvTablePlugin,
  replacePlugin,
  rawPlugin,
  containerPlugin,
  includePlugin,
  builtinDirectivePlugins,
} from './plugins/directives'
export { csvTablePlugin as csvTableDirectivePlugin } from './plugins/csv-table'

// ---------------------------------------------------------------------------
// Convenience function: one-shot parse + render
// ---------------------------------------------------------------------------

import { HtmlRenderer } from './renderer/html/index'
import { createBuiltinParser } from './parser/builtin-parser'
import { builtinDirectivePlugins } from './plugins/directives'
import type { RstDocument } from './ast/types'

export interface RenderOptions {
  /** Which parser backend to use (default: builtin). */
  parser?: 'builtin' | 'rst-compiler'
  /** Custom directive plugins. */
  plugins?: typeof builtinDirectivePlugins
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
  let document: RstDocument

  if (options.parser === 'rst-compiler') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createRstCompilerParser } = require('./parser/rst-compiler-adapter')
      document = createRstCompilerParser().parse({ input: source }).document
    } catch {
      throw new Error('rst-compiler is not installed. Install it with: pnpm add rst-compiler')
    }
  } else {
    document = createBuiltinParser().parse({ input: source }).document
  }

  const renderer = new HtmlRenderer()

  // Install plugins
  for (const plugin of options.plugins ?? builtinDirectivePlugins) {
    plugin.install(renderer)
  }

  return renderer.render(document)
}
