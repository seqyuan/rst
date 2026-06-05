// ---------------------------------------------------------------------------
// @seqyuan/rst-renderer/markdown — RST → Markdown conversion
// ---------------------------------------------------------------------------

import type {
  RstNode, RstDocument, RstSection, RstParagraph, RstTransition,
  RstText, RstEmphasis, RstStrongEmphasis, RstInlineLiteral,
  RstInterpretedText, RstHyperlinkRef, RstSubstitutionRef,
  RstFootnoteRef, RstCitationRef, RstInlineTarget,
  RstBulletList, RstBulletListItem,
  RstEnumeratedList, RstEnumeratedListItem,
  RstDefinitionList, RstDefinitionListItem,
  RstFieldList, RstFieldListItem,
  RstOptionList, RstOptionListItem,
  RstLiteralBlock, RstLineBlock, RstBlockquote,
  RstDoctestBlock,
  RstDirective, RstComment,
  RstTable, RstTableRow, RstTableCell,
  RstBlockNode, RstInlineNode,
} from '../../ast/types.ts'

// ---------------------------------------------------------------------------
// MarkdownRenderer
// ---------------------------------------------------------------------------

export interface MarkdownRendererOptions {
  /** Heading level offset (e.g., 1 means RST h1 becomes Markdown ##). */
  headingOffset?: number
  /** Enable GFM table syntax. */
  gfmTables?: boolean
  /** Wrap width for text (0 = no wrap). */
  wrapWidth?: number
}

export class MarkdownRenderer {
  private opts: Required<MarkdownRendererOptions>

  constructor(options: MarkdownRendererOptions = {}) {
    this.opts = {
      headingOffset: options.headingOffset ?? 0,
      gfmTables: options.gfmTables ?? true,
      wrapWidth: options.wrapWidth ?? 0,
    }
  }

  render(document: RstDocument): string {
    const buf: string[] = []
    for (const child of document.children) {
      this.renderBlock(child, buf)
    }
    return buf.join('')
  }

  // -----------------------------------------------------------------------
  // Block rendering
  // -----------------------------------------------------------------------

  private renderBlock(node: RstBlockNode, buf: string[]): void {
    switch (node.type) {
      case 'Section': this.renderSection(node, buf); break
      case 'Paragraph': this.renderParagraph(node, buf); break
      case 'Transition': buf.push('---\n\n'); break
      case 'BulletList': this.renderBulletList(node, buf); break
      case 'EnumeratedList': this.renderEnumeratedList(node, buf); break
      case 'DefinitionList': this.renderDefinitionList(node, buf); break
      case 'FieldList': this.renderFieldList(node, buf); break
      case 'OptionList': this.renderOptionList(node, buf); break
      case 'LiteralBlock': this.renderLiteralBlock(node, buf); break
      case 'LineBlock': this.renderLineBlock(node, buf); break
      case 'Blockquote': this.renderBlockquote(node, buf); break
      case 'DoctestBlock': this.renderDoctestBlock(node, buf); break
      case 'Directive': this.renderDirective(node, buf); break
      case 'Table': this.renderTable(node, buf); break
      case 'Comment': break
      case 'FootnoteDef':
      case 'CitationDef':
      case 'HyperlinkTarget':
      case 'SubstitutionDef':
        break // handled separately or ignored
    }
  }

  private renderSection(node: RstSection, buf: string[]): void {
    const level = Math.min(node.level + this.opts.headingOffset, 6)
    buf.push('#'.repeat(level) + ' ' + node.title + '\n\n')
    for (const child of node.children) {
      this.renderBlock(child, buf)
    }
    for (const sub of node.subsections) {
      this.renderSection(sub, buf)
    }
  }

  private renderParagraph(node: RstParagraph, buf: string[]): void {
    const text = this.renderInlines(node.children)
    buf.push(text + '\n\n')
  }

  private renderBulletList(node: RstBulletList, buf: string[]): void {
    for (const item of node.children) {
      buf.push('- ')
      this.renderListItemContent(item.children, buf, '  ')
    }
    buf.push('\n')
  }

  private renderEnumeratedList(node: RstEnumeratedList, buf: string[]): void {
    let counter = node.start
    for (const item of node.children) {
      buf.push(`${counter}. `)
      this.renderListItemContent(item.children, buf, '   ')
      counter++
    }
    buf.push('\n')
  }

  private renderListItemContent(children: RstBlockNode[], buf: string[], indent: string): void {
    if (children.length === 0) {
      buf.push('\n')
      return
    }

    // First child determines inline vs block
    const first = children[0]!
    if (first.type === 'Paragraph' && children.length === 1) {
      buf.push(this.renderInlines(first.children) + '\n')
    } else {
      buf.push('\n')
      for (const child of children) {
      this.renderBlockIndented(child, buf, indent)
      }
    }
  }

  private renderBlockIndented(node: RstBlockNode, buf: string[], indent: string): void {
    const tmp: string[] = []
    this.renderBlock(node, tmp)
    buf.push(...tmp.map(line => indent + line))
  }

  private renderDefinitionList(node: RstDefinitionList, buf: string[]): void {
    for (const item of node.children) {
      const term = this.renderInlines(item.term)
      buf.push(`**${term}**\n\n`)
      for (const def of item.definition) {
        const tmp: string[] = []
        this.renderBlock(def, tmp)
        buf.push(': ' + tmp.join('').replace(/\n/g, '\n  ') + '\n')
      }
      buf.push('\n')
    }
  }

  private renderFieldList(node: RstFieldList, buf: string[]): void {
    for (const item of node.children) {
      const bodyTexts: string[] = []
      for (const b of item.body) { this.renderBlock(b, bodyTexts) }
      buf.push(`**${item.name}:** ${bodyTexts.join(' ').trim()}\n\n`)
    }
  }

  private renderOptionList(node: RstOptionList, buf: string[]): void {
    for (const item of node.children) {
      const descTexts: string[] = []
      for (const d of item.description) { this.renderBlock(d, descTexts) }
      const opts = item.options.map(o => '`' + o + '`').join(', ')
      buf.push(`- ${opts}: ${descTexts.join(' ').trim()}\n`)
    }
    buf.push('\n')
  }

  private renderLiteralBlock(node: RstLiteralBlock, buf: string[]): void {
    const lang = node.language || ''
    buf.push('```' + lang + '\n')
    buf.push(node.text + '\n')
    buf.push('```\n\n')
  }

  private renderLineBlock(node: RstLineBlock, buf: string[]): void {
    for (const line of node.lines) {
      buf.push(line + '  \n')
    }
    buf.push('\n')
  }

  private renderBlockquote(node: RstBlockquote, buf: string[]): void {
    for (const child of node.children) {
      const tmp: string[] = []
      this.renderBlock(child, tmp)
      buf.push(...tmp.map(line => '> ' + line))
    }
    buf.push('\n')
  }

  private renderDoctestBlock(node: RstDoctestBlock, buf: string[]): void {
    buf.push('```pycon\n' + node.text + '\n```\n\n')
  }

  private renderDirective(node: RstDirective, buf: string[]): void {
    const name = node.name

    // Handle common directives
    switch (name) {
      case 'image':
      case 'figure': {
        const src = node.arguments[0] ?? ''
        const alt = node.options['alt'] ?? ''
        buf.push(`![${alt}](${src})\n\n`)
        return
      }

      case 'note':
      case 'warning':
      case 'tip':
      case 'important':
      case 'caution':
      case 'danger':
      case 'hint':
      case 'attention':
      case 'error': {
        const title = node.arguments[0] ?? name.charAt(0).toUpperCase() + name.slice(1)
        buf.push(`> **${title}:** `)
        for (const child of node.children) {
          if (child.type === 'Paragraph') {
            buf.push(this.renderInlines(child.children))
          }
        }
        buf.push('\n>\n\n')
        return
      }

      case 'code':
      case 'code-block':
      case 'sourcecode': {
        const lang = node.arguments[0] ?? node.options['language'] ?? ''
        buf.push('```' + lang + '\n')
        for (const child of node.children) {
          if (child.type === 'LiteralBlock') buf.push(child.text + '\n')
        }
        buf.push('```\n\n')
        return
      }

      case 'math': {
        buf.push('$$\n')
        for (const child of node.children) {
          if (child.type === 'Paragraph') buf.push(this.renderInlines(child.children) + '\n')
        }
        buf.push('$$\n\n')
        return
      }

      case 'contents':
      case 'toctree':
        buf.push('<!-- TOC -->\n\n')
        return

      case 'raw': {
        const format = node.arguments[0]
        if (format === 'html' || format === 'markdown') {
          for (const child of node.children) {
            if (child.type === 'Paragraph') buf.push(this.renderInlines(child.children) + '\n')
          }
          buf.push('\n')
        }
        return
      }

      case 'container': {
        for (const child of node.children) {
          this.renderBlock(child, buf)
        }
        return
      }

      default:
        // Fallback: render children as best-effort
        for (const child of node.children) {
          this.renderBlock(child, buf)
        }
    }
  }

  private renderTable(node: RstTable, buf: string[]): void {
    if (!this.opts.gfmTables || node.children.length === 0) {
      // Fallback: render as HTML table
      buf.push('<table>\n')
      for (const row of node.children) {
        buf.push('<tr>')
        for (const cell of row.children) {
          const tag = 'td'
          buf.push(`<${tag}>`)
          for (const child of cell.children) {
            const tmp: string[] = []
            this.renderBlock(child, tmp)
            buf.push(tmp.join(''))
          }
          buf.push(`</${tag}>`)
        }
        buf.push('</tr>\n')
      }
      buf.push('</table>\n\n')
      return
    }

    // GFM table
    for (let i = 0; i < node.children.length; i++) {
      const row = node.children[i]!
      buf.push('| ')
      const cellTexts: string[] = []
      for (const cell of row.children) {
        const tmp: string[] = []
        for (const child of cell.children) {
          if (child.type === 'Paragraph') {
            tmp.push(this.renderInlines(child.children))
          }
        }
        cellTexts.push(tmp.join(' ').replace(/\|/g, '\\|').trim())
      }
      buf.push(cellTexts.join(' | '))
      buf.push(' |\n')

      // Header row separator
      if (i === 0 && node.headerRows > 0) {
        buf.push('| ')
        buf.push(cellTexts.map(() => '---').join(' | '))
        buf.push(' |\n')
      }
    }
    buf.push('\n')
  }

  // -----------------------------------------------------------------------
  // Inline rendering
  // -----------------------------------------------------------------------

  private renderInlines(nodes: RstInlineNode[]): string {
    return nodes.map(n => this.renderInline(n)).join('')
  }

  private renderInline(node: RstInlineNode): string {
    switch (node.type) {
      case 'Text': return this.escapeMd(node.text)
      case 'Emphasis': return '*' + this.renderInlines(node.children) + '*'
      case 'StrongEmphasis': return '**' + this.renderInlines(node.children) + '**'
      case 'InlineLiteral': return '`' + node.text + '`'
      case 'InterpretedText': return node.displayText || node.body
      case 'HyperlinkRef': return `[${node.displayText || node.target}](${node.target})`
      case 'SubstitutionRef': return `|${node.refName}|`
      case 'FootnoteRef': return `[^${node.label}]`
      case 'CitationRef': return `[${node.label}]`
      case 'InlineTarget': return ''
      default: return ''
    }
  }

  /** Escape special Markdown characters. */
  private escapeMd(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\*/g, '\\*')
      .replace(/_/g, '\\_')
      .replace(/`/g, '\\`')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/#/g, '\\#')
      .replace(/\+/g, '\\+')
      .replace(/-/g, '\\-')
      .replace(/\./g, '\\.')
      .replace(/!/g, '\\!')
      .replace(/\|/g, '\\|')
      .replace(/~/g, '\\~')
  }
}
