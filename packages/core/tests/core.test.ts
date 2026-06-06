import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderRst, createBuiltinParser, HtmlRenderer, builtinDirectivePlugins } from '../src/index.ts'

// ---------------------------------------------------------------------------
// Parser tests
// ---------------------------------------------------------------------------

describe('Builtin Parser', () => {
  it('parses a simple document with a title and paragraph', () => {
    const parser = createBuiltinParser()
    const result = parser.parse({ input: 'Hello\n=====\n\nThis is a paragraph.' })

    expect(result.errors).toHaveLength(0)

    const doc = result.document
    expect(doc.type).toBe('Document')
    expect(doc.children.length).toBeGreaterThan(0)

    const section = doc.children[0]!
    expect(section.type).toBe('Section')
    expect(section.title).toBe('Hello')
    expect(section.level).toBe(1)
    expect(section.children.length).toBeGreaterThan(0)

    const para = section.children[0]!
    expect(para.type).toBe('Paragraph')
    expect(para.text).toContain('paragraph')
  })

  it('parses inline markup: bold, italic, code', () => {
    const parser = createBuiltinParser()
    const result = parser.parse({ input: 'Test\n====\n\nThis has **bold**, *italic*, and ``code``.' })

    const section = result.document.children[0]!
    const para = section.children[0]!
    expect(para.type).toBe('Paragraph')

    const hasBold = para.children.some(c => c.type === 'StrongEmphasis')
    const hasItalic = para.children.some(c => c.type === 'Emphasis')
    const hasCode = para.children.some(c => c.type === 'InlineLiteral')
    expect(hasBold).toBe(true)
    expect(hasItalic).toBe(true)
    expect(hasCode).toBe(true)
  })

  it('parses bullet lists', () => {
    const parser = createBuiltinParser()
    const result = parser.parse({ input: 'List\n====\n\n- item 1\n- item 2\n- item 3' })

    const section = result.document.children[0]!
    const list = section.children[0]!
    expect(list.type).toBe('BulletList')
    expect(list.children).toHaveLength(3)
  })

  it('parses literal blocks (::)', () => {
    const parser = createBuiltinParser()
    const input = 'Code\n====\n\nExample::\n\n  def hello():\n      print("world")'
    const result = parser.parse({ input })

    const section = result.document.children[0]!
    const block = section.children[0]!
    expect(block.type).toBe('LiteralBlock')
    expect(block.text).toContain('def hello()')
    expect(block.text).toContain('print("world")')
  })

  it('parses directives', () => {
    const parser = createBuiltinParser()
    const input = 'Doc\n===\n\n.. note:: This is a note.\n\n   More note content.\n\nPara after.'
    const result = parser.parse({ input })

    const section = result.document.children[0]!
    const directive = section.children.find(c => c.type === 'Directive')
    expect(directive).toBeDefined()
    expect(directive!.type).toBe('Directive')
  })

  it('preserves directive raw body across blank lines', () => {
    const parser = createBuiltinParser()
    const input = `Doc
===

.. note::

   First line.

   Second line.`
    const result = parser.parse({ input })

    const section = result.document.children[0]!
    const directive = section.children.find(c => c.type === 'Directive')
    expect(directive).toBeDefined()
    if (directive?.type === 'Directive') {
      expect(directive.rawBody).toContain('First line.')
      expect(directive.rawBody).toContain('Second line.')
    }
  })
})

// ---------------------------------------------------------------------------
// HTML Renderer tests
// ---------------------------------------------------------------------------

describe('HtmlRenderer', () => {
  it('renders a simple document to HTML', () => {
    const html = renderRst('Hello\n=====\n\nThis is **bold** text.')

    expect(html).toContain('<h2 id="hello">Hello</h2>')
    expect(html).toContain('<p>')
    expect(html).toContain('<strong>bold</strong>')
  })

  it('renders bullet lists', () => {
    const html = renderRst('List\n====\n\n- item 1\n- item 2')

    expect(html).toContain('<ul>')
    expect(html).toContain('<li>')
    expect(html).toContain('item 1')
    expect(html).toContain('item 2')
    expect(html).toContain('</ul>')
  })

  it('renders literal blocks as <pre><code>', () => {
    const input = 'Code\n====\n\nExample::\n\n  console.log("hello")'
    const html = renderRst(input)

    expect(html).toContain('<pre>')
    expect(html).toContain('<code>')
    expect(html).toContain('console.log')
  })

  it('escapes HTML in text', () => {
    const html = renderRst('Test\n====\n\n<script>alert(1)</script>')

    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('renders directives with plugins installed', () => {
    const parser = createBuiltinParser()
    const result = parser.parse({ input: 'Doc\n===\n\n.. note:: This is important!\n\n   More text here.' })

    const renderer = new HtmlRenderer()
    for (const plugin of builtinDirectivePlugins) {
      plugin.install(renderer)
    }

    const html = renderer.render(result.document)

    expect(html).toContain('admonition')
    expect(html).toContain('admonition-note')
    expect(html).toContain('This')
  })

  it('renders list-table directives with plugins installed', () => {
    const input = `Doc
===

.. list-table::
   :header-rows: 1
   :widths: 20 80

   * - Sample
     - Note
   * - WT_Control
     - Wild type
   * - KO_Treated
     - Knockout`

    const parser = createBuiltinParser()
    const result = parser.parse({ input })

    const renderer = new HtmlRenderer()
    for (const plugin of builtinDirectivePlugins) {
      plugin.install(renderer)
    }

    const html = renderer.render(result.document)
    expect(html).toContain('<table class="list-table">')
    expect(html).toContain('<th style="width:20%">Sample</th>')
    expect(html).toContain('<td style="width:80%">Wild type</td>')
    expect(html).toContain('KO_Treated')
  })

  it('renders contents directives as a heading TOC card', () => {
    const input = `Doc
===

.. contents:: Report Outline
   :depth: 2

Section A
---------

Intro.

Section B
---------

Subsection
~~~~~~~~~~

Details.`

    const parser = createBuiltinParser()
    const result = parser.parse({ input })

    const renderer = new HtmlRenderer()
    for (const plugin of builtinDirectivePlugins) {
      plugin.install(renderer)
    }

    const html = renderer.render(result.document)
    expect(html).toContain('<nav class="rst-contents-card"')
    expect(html).toContain('Report Outline')
    expect(html).toContain('href="#doc"')
    expect(html).toContain('href="#section-a"')
    expect(html).toContain('href="#section-b"')
    expect(html).not.toContain('href="#subsection"')
  })

  it('renders toctree directives as explicit entry cards', () => {
    const input = `Doc
===

.. toctree::
   :caption: Next Steps

   qc-summary
   UMAP Gallery <reports/umap-gallery.html>`

    const parser = createBuiltinParser()
    const result = parser.parse({ input })

    const renderer = new HtmlRenderer()
    for (const plugin of builtinDirectivePlugins) {
      plugin.install(renderer)
    }

    const html = renderer.render(result.document)
    expect(html).toContain('<nav class="rst-toctree-card"')
    expect(html).toContain('Next Steps')
    expect(html).toContain('href="qc-summary"')
    expect(html).toContain('>qc summary<')
    expect(html).toContain('href="reports/umap-gallery.html"')
    expect(html).toContain('>UMAP Gallery<')
  })

  it('renders an empty document', () => {
    const html = renderRst('')
    expect(html).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('Edge cases', () => {
  it('handles consecutive blank lines', () => {
    const html = renderRst('Title\n=====\n\n\n\nPara here.')
    expect(html).toContain('<p>Para here.</p>')
  })

  it('handles lines with only whitespace', () => {
    const html = renderRst('Title\n=====\n  \nPara.')
    expect(html).toContain('<p>Para.</p>')
  })

  it('parses nested inline markup', () => {
    const html = renderRst('Test\n====\n\n**bold with *italic* inside**')
    expect(html).toContain('<strong>bold with <em>italic</em> inside')
  })

  it('renders transitions', () => {
    const html = renderRst('A\n=\n\nPara 1.\n\n----\n\nPara 2.')
    expect(html).toContain('<hr>')
  })

  it('optionally expands include directives before parsing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rst-include-'))

    try {
      mkdirSync(join(dir, 'shared'), { recursive: true })
      writeFileSync(join(dir, 'shared', 'intro.rst'), 'Included Section\n----------------\n\nIncluded paragraph.')

      const html = renderRst(`Doc
===

.. include:: shared/intro.rst
`, {
        includeResolver: { baseDir: dir },
      })

      expect(html).toContain('Included Section')
      expect(html).toContain('Included paragraph.')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('detects circular include chains', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rst-include-cycle-'))

    try {
      writeFileSync(join(dir, 'a.rst'), '.. include:: b.rst\n')
      writeFileSync(join(dir, 'b.rst'), '.. include:: a.rst\n')

      expect(() => renderRst('.. include:: a.rst\n', {
        includeResolver: { baseDir: dir, maxDepth: 5 },
      })).toThrow(/Circular include detected/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
