import { describe, it, expect } from 'vitest'
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
})
