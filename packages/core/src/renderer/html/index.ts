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
  RstLiteralBlock, RstLineBlock,
  RstBlockquote, RstBlockquoteAttribution,
  RstDoctestBlock,
  RstDirective, RstComment,
  RstFootnoteDef, RstCitationDef,
  RstHyperlinkTarget, RstSubstitutionDef,
  RstTable, RstTableRow, RstTableCell, RstNode, RstBlockNode,
} from '../../ast/types'
import { RenderContext, RstRenderer, escapeHtml, idFromTitle } from '../base'

// ---------------------------------------------------------------------------
// HTML Renderer
// ---------------------------------------------------------------------------

export class HtmlRenderer implements RstRenderer {
  readonly name = 'html'

  private nodeRenderers = new Map<string, (node: RstNode, ctx: RenderContext) => void>()

  constructor() {
    // Register all node renderers (type cast needed for contravariance)
    const reg = this.register.bind(this)
    reg('Document', this.renderDocument)
    reg('Section', this.renderSection)
    reg('Paragraph', this.renderParagraph)
    reg('Transition', this.renderTransition)
    reg('Text', this.renderText)
    reg('Emphasis', this.renderEmphasis)
    reg('StrongEmphasis', this.renderStrongEmphasis)
    reg('InlineLiteral', this.renderInlineLiteral)
    reg('InterpretedText', this.renderInterpretedText)
    reg('HyperlinkRef', this.renderHyperlinkRef)
    reg('SubstitutionRef', this.renderSubstitutionRef)
    reg('FootnoteRef', this.renderFootnoteRef)
    reg('CitationRef', this.renderCitationRef)
    reg('InlineTarget', this.renderInlineTarget)
    reg('BulletList', this.renderBulletList)
    reg('BulletListItem', this.renderBulletListItem)
    reg('EnumeratedList', this.renderEnumeratedList)
    reg('EnumeratedListItem', this.renderEnumeratedListItem)
    reg('DefinitionList', this.renderDefinitionList)
    reg('DefinitionListItem', this.renderDefinitionListItem)
    reg('FieldList', this.renderFieldList)
    reg('FieldListItem', this.renderFieldListItem)
    reg('OptionList', this.renderOptionList)
    reg('OptionListItem', this.renderOptionListItem)
    reg('LiteralBlock', this.renderLiteralBlock)
    reg('LineBlock', this.renderLineBlock)
    reg('Blockquote', this.renderBlockquote)
    reg('BlockquoteAttribution', this.renderBlockquoteAttribution)
    reg('DoctestBlock', this.renderDoctestBlock)
    reg('Directive', this.renderDirective)
    reg('Comment', this.renderComment)
    reg('FootnoteDef', this.renderFootnoteDef)
    reg('CitationDef', this.renderCitationDef)
    reg('HyperlinkTarget', this.renderHyperlinkTarget)
    reg('SubstitutionDef', this.renderSubstitutionDef)
    reg('Table', this.renderTable)
    reg('TableRow', this.renderTableRow)
    reg('TableCell', this.renderTableCell)
  }

  /** Register or override a node-type renderer. */
  register(type: string, fn: (...args: any[]) => void): this {
    this.nodeRenderers.set(type, fn.bind(this) as (node: RstNode, ctx: RenderContext) => void)
    return this
  }

  /** For external plugins to add custom directive renderers. */
  registerDirective(name: string, fn: (
    directive: RstDirective,
    ctx: RenderContext,
    renderChildBlocks: (blocks: RstBlockNode[], ctx: RenderContext) => void,
  ) => void): this {
    this._directiveRenderers.set(name.toLowerCase(), fn)
    return this
  }

  private _directiveRenderers = new Map<string, (
    directive: RstDirective,
    ctx: RenderContext,
    renderChildBlocks: (blocks: RstBlockNode[], ctx: RenderContext) => void,
  ) => void>()

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  render(document: RstDocument, context?: Partial<RenderContext>): string {
    const buf: string[] = []
    const ctx: RenderContext = {
      write: (s: string) => buf.push(s),
      footnotes: new Map(),
      citations: new Map(),
      linkTargets: new Map(),
      headingIds: new Map(),
      data: {},
      ...context,
    }

    // Collect metadata: link targets, footnotes, citations
    for (const child of document.children) {
      this._collectMeta(child, ctx)
    }

    // Render body content
    for (const child of document.children) {
      this.renderNode(child, ctx)
    }

    // Append footnotes and citations at the end
    this._appendFootnotes(ctx, buf)

    return buf.join('')
  }

  renderNode(node: RstNode, ctx: RenderContext): void {
    const fn = this.nodeRenderers.get(node.type)
    if (fn) {
      fn(node, ctx)
    } else {
      // Fallback: render children
      if ('children' in node && Array.isArray(node.children)) {
        for (const child of (node as { children: RstNode[] }).children) {
          this.renderNode(child, ctx)
        }
      }
    }
  }

  /** Render child block nodes sequentially. */
  renderChildBlocks(children: RstBlockNode[], ctx: RenderContext): void {
    for (const child of children) {
      this.renderNode(child, ctx)
    }
  }

  // -----------------------------------------------------------------------
  // Meta collection pass
  // -----------------------------------------------------------------------

  private _collectMeta(node: RstNode, ctx: RenderContext): void {
    if (node.type === 'HyperlinkTarget') {
      const t = node as RstHyperlinkTarget
      ctx.linkTargets.set(t.name, t.url)
    } else if (node.type === 'FootnoteDef') {
      const fn = node as RstFootnoteDef
      const fb: string[] = []
      const subCtx = { ...ctx, write: (s: string) => fb.push(s) }
      for (const c of fn.children) this.renderNode(c, subCtx)
      ctx.footnotes.set(fn.label, fb.join(''))
    } else if (node.type === 'CitationDef') {
      const cit = node as RstCitationDef
      const cb: string[] = []
      const subCtx = { ...ctx, write: (s: string) => cb.push(s) }
      for (const c of cit.children) this.renderNode(c, subCtx)
      ctx.citations.set(cit.label, cb.join(''))
    }

    if ('children' in node && Array.isArray(node.children)) {
      for (const child of (node as { children: RstNode[] }).children) {
        this._collectMeta(child, ctx)
      }
    }
  }

  private _appendFootnotes(ctx: RenderContext, buf: string[]): void {
    if (ctx.footnotes.size === 0 && ctx.citations.size === 0) return

    buf.push('<hr class="footnotes-sep">\n')
    buf.push('<section class="footnotes">\n')
    buf.push('<ol class="footnotes-list">\n')

    for (const [label, html] of ctx.footnotes) {
      buf.push(`<li id="fn-${escapeHtml(label)}" class="footnote-item">${html}</li>\n`)
    }
    for (const [label, html] of ctx.citations) {
      buf.push(`<li id="cite-${escapeHtml(label)}" class="citation-item">${html}</li>\n`)
    }

    buf.push('</ol>\n')
    buf.push('</section>\n')
  }

  // -----------------------------------------------------------------------
  // Structural
  // -----------------------------------------------------------------------

  private renderDocument  (node: RstDocument, ctx: RenderContext): void {
    for (const child of node.children) {
      this.renderNode(child, ctx)
    }
  }

  private renderSection  (node: RstSection, ctx: RenderContext): void {
    const hLevel = Math.min(node.level + 1, 6)
    const id = idFromTitle(node.title)

    // Ensure unique ID
    const count = ctx.headingIds.get(id) ?? 0
    const uniqueId = count === 0 ? id : `${id}-${count}`
    ctx.headingIds.set(id, count + 1)

    ctx.write(`<h${hLevel} id="${uniqueId}">${escapeHtml(node.title)}</h${hLevel}>\n`)

    for (const child of node.children) {
      this.renderNode(child, ctx)
    }
  }

  private renderParagraph  (node: RstParagraph, ctx: RenderContext): void {
    ctx.write('<p>')
    for (const child of node.children) {
      this.renderNode(child, ctx)
    }
    ctx.write('</p>\n')
  }

  private renderTransition  (_node: RstTransition, ctx: RenderContext): void {
    ctx.write('<hr>\n')
  }

  // -----------------------------------------------------------------------
  // Inline
  // -----------------------------------------------------------------------

  private renderText  (node: RstText, ctx: RenderContext): void {
    ctx.write(escapeHtml(node.text))
  }

  private renderEmphasis  (node: RstEmphasis, ctx: RenderContext): void {
    ctx.write('<em>')
    for (const child of node.children) this.renderNode(child, ctx)
    ctx.write('</em>')
  }

  private renderStrongEmphasis  (node: RstStrongEmphasis, ctx: RenderContext): void {
    ctx.write('<strong>')
    for (const child of node.children) this.renderNode(child, ctx)
    ctx.write('</strong>')
  }

  private renderInlineLiteral  (node: RstInlineLiteral, ctx: RenderContext): void {
    ctx.write(`<code>${escapeHtml(node.text)}</code>`)
  }

  private renderInterpretedText  (node: RstInterpretedText, ctx: RenderContext): void {
    // Default: render as <span> with role class
    const text = node.displayText || node.body
    ctx.write(`<span class="interpreted-${escapeHtml(node.role)}">${escapeHtml(text)}</span>`)
  }

  private renderHyperlinkRef  (node: RstHyperlinkRef, ctx: RenderContext): void {
    let url = node.target

    // Resolve named targets
    if (!url.startsWith('http') && !url.startsWith('/') && !url.startsWith('#')) {
      url = ctx.linkTargets.get(node.target) ?? `#${node.target}`
    }

    ctx.write(`<a href="${escapeHtml(url)}">${escapeHtml(node.displayText || node.target)}</a>`)
  }

  private renderSubstitutionRef  (node: RstSubstitutionRef, ctx: RenderContext): void {
    ctx.write(`<!-- substitution-ref: ${escapeHtml(node.refName)} -->`)
  }

  private renderFootnoteRef  (node: RstFootnoteRef, ctx: RenderContext): void {
    const label = escapeHtml(node.label)
    ctx.write(`<sup><a href="#fn-${label}" id="fnref-${label}">[${label}]</a></sup>`)
  }

  private renderCitationRef  (node: RstCitationRef, ctx: RenderContext): void {
    const label = escapeHtml(node.label)
    ctx.write(`<a href="#cite-${label}">[${label}]</a>`)
  }

  private renderInlineTarget  (node: RstInlineTarget, ctx: RenderContext): void {
    ctx.write(`<span id="${escapeHtml(node.name)}"></span>`)
  }

  // -----------------------------------------------------------------------
  // Lists
  // -----------------------------------------------------------------------

  private renderBulletList  (node: RstBulletList, ctx: RenderContext): void {
    ctx.write('<ul>\n')
    for (const item of node.children) this.renderNode(item, ctx)
    ctx.write('</ul>\n')
  }

  private renderBulletListItem  (node: RstBulletListItem, ctx: RenderContext): void {
    ctx.write('<li>')
    for (const child of node.children) this.renderNode(child, ctx)
    ctx.write('</li>\n')
  }

  private renderEnumeratedList  (node: RstEnumeratedList, ctx: RenderContext): void {
    const typeMap: Record<string, string> = {
      arabic: '1', loweralpha: 'a', upperalpha: 'A',
      lowerroman: 'i', upperroman: 'I', auto: '1',
    }
    const type = typeMap[node.enumType] ?? '1'
    const start = node.start > 1 ? ` start="${node.start}"` : ''

    ctx.write(`<ol type="${type}"${start}>\n`)
    for (const item of node.children) this.renderNode(item, ctx)
    ctx.write('</ol>\n')
  }

  private renderEnumeratedListItem  (node: RstEnumeratedListItem, ctx: RenderContext): void {
    ctx.write('<li>')
    for (const child of node.children) this.renderNode(child, ctx)
    ctx.write('</li>\n')
  }

  private renderDefinitionList  (node: RstDefinitionList, ctx: RenderContext): void {
    ctx.write('<dl>\n')
    for (const item of node.children) this.renderNode(item, ctx)
    ctx.write('</dl>\n')
  }

  private renderDefinitionListItem  (node: RstDefinitionListItem, ctx: RenderContext): void {
    ctx.write('<dt>')
    for (const t of node.term) this.renderNode(t, ctx)
    ctx.write('</dt>\n<dd>')
    for (const c of node.definition) this.renderNode(c, ctx)
    ctx.write('</dd>\n')
  }

  private renderFieldList  (node: RstFieldList, ctx: RenderContext): void {
    ctx.write('<dl class="field-list">\n')
    for (const item of node.children) this.renderNode(item, ctx)
    ctx.write('</dl>\n')
  }

  private renderFieldListItem  (node: RstFieldListItem, ctx: RenderContext): void {
    ctx.write(`<dt>${escapeHtml(node.name)}</dt>\n<dd>`)
    for (const b of node.body) this.renderNode(b, ctx)
    ctx.write('</dd>\n')
  }

  private renderOptionList  (node: RstOptionList, ctx: RenderContext): void {
    ctx.write('<dl class="option-list">\n')
    for (const item of node.children) this.renderNode(item, ctx)
    ctx.write('</dl>\n')
  }

  private renderOptionListItem  (node: RstOptionListItem, ctx: RenderContext): void {
    const opts = node.options.map((o: string) => `<code>${escapeHtml(o)}</code>`).join(', ')
    ctx.write(`<dt>${opts}</dt>\n<dd>`)
    for (const d of node.description) this.renderNode(d, ctx)
    ctx.write('</dd>\n')
  }

  // -----------------------------------------------------------------------
  // Block elements
  // -----------------------------------------------------------------------

  private renderLiteralBlock  (node: RstLiteralBlock, ctx: RenderContext): void {
    const langClass = node.language ? ` class="language-${escapeHtml(node.language)}"` : ''
    ctx.write(`<pre${langClass}><code>${escapeHtml(node.text)}</code></pre>\n`)
  }

  private renderLineBlock  (node: RstLineBlock, ctx: RenderContext): void {
    ctx.write('<div class="line-block">\n')
    for (const line of node.lines) {
      ctx.write(`<div class="line">${escapeHtml(line)}</div>\n`)
    }
    ctx.write('</div>\n')
  }

  private renderBlockquote  (node: RstBlockquote, ctx: RenderContext): void {
    ctx.write('<blockquote>\n')
    for (const child of node.children) this.renderNode(child, ctx)
    if (node.attribution) this.renderNode(node.attribution, ctx)
    ctx.write('</blockquote>\n')
  }

  private renderBlockquoteAttribution  (node: RstBlockquoteAttribution, ctx: RenderContext): void {
    ctx.write(`<footer>— ${escapeHtml(node.text)}</footer>\n`)
  }

  private renderDoctestBlock  (node: RstDoctestBlock, ctx: RenderContext): void {
    ctx.write(`<pre class="doctest"><code>${escapeHtml(node.text)}</code></pre>\n`)
  }

  // -----------------------------------------------------------------------
  // Directive (extensible)
  // -----------------------------------------------------------------------

  private renderDirective  (node: RstDirective, ctx: RenderContext): void {
    const customRenderer = this._directiveRenderers.get(node.name.toLowerCase())
    if (customRenderer) {
      customRenderer(node, ctx, this.renderChildBlocks.bind(this))
      return
    }

    // Default: render body contents (handles code blocks, admonitions, etc.)
    for (const child of node.children) {
      this.renderNode(child, ctx)
    }
  }

  // -----------------------------------------------------------------------
  // Explicit markup
  // -----------------------------------------------------------------------

  private renderComment  (_node: RstComment, _ctx: RenderContext): void {
    // Comments are not rendered
  }

  private renderFootnoteDef  (_node: RstFootnoteDef, _ctx: RenderContext): void {
    // Already collected in _collectMeta; rendered at the end
  }

  private renderCitationDef  (_node: RstCitationDef, _ctx: RenderContext): void {
    // Already collected in _collectMeta; rendered at the end
  }

  private renderHyperlinkTarget  (_node: RstHyperlinkTarget, _ctx: RenderContext): void {
    // Already collected in _collectMeta; not rendered in body
  }

  private renderSubstitutionDef  (_node: RstSubstitutionDef, _ctx: RenderContext): void {
    // Deferred to substitution resolution
  }

  // -----------------------------------------------------------------------
  // Table
  // -----------------------------------------------------------------------

  private renderTable  (node: RstTable, ctx: RenderContext): void {
    ctx.write('<table>\n')
    if (node.headerRows > 0) {
      ctx.write('<thead>\n')
      for (let i = 0; i < node.headerRows && i < node.children.length; i++) {
        const row = node.children[i]!
        ctx.write('<tr>')
        for (const cell of row.children) {
          this.renderNode(cell, ctx)
        }
        ctx.write('</tr>\n')
      }
      ctx.write('</thead>\n')
    }
    ctx.write('<tbody>\n')
    for (let i = node.headerRows; i < node.children.length; i++) {
      const row = node.children[i]!
      ctx.write('<tr>')
      for (const cell of row.children) {
        this.renderNode(cell, ctx)
      }
      ctx.write('</tr>\n')
    }
    ctx.write('</tbody>\n')
    ctx.write('</table>\n')
  }

  private renderTableRow  (_node: RstTableRow, _ctx: RenderContext): void {
    // Handled by renderTable
  }

  private renderTableCell  (node: RstTableCell, ctx: RenderContext): void {
    const tag = ctx.data['_inThead'] ? 'th' : 'td'
    const attrs: string[] = []
    if (node.colspan > 1) attrs.push(`colspan="${node.colspan}"`)
    if (node.rowspan > 1) attrs.push(`rowspan="${node.rowspan}"`)
    const attrStr = attrs.length > 0 ? ` ${attrs.join(' ')}` : ''

    ctx.write(`<${tag}${attrStr}>`)
    for (const child of node.children) this.renderNode(child, ctx)
    ctx.write(`</${tag}>`)
  }
}
