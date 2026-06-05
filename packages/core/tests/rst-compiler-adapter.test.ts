import { describe, it, expect } from 'vitest'
import { createRstCompilerParser, HtmlRenderer, builtinDirectivePlugins } from '../src/index.ts'

describe('rst-compiler Adapter', () => {
  it('parses RST using rst-compiler backend', () => {
    const parser = createRstCompilerParser()
    const result = parser.parse({ input: 'Hello\n=====\n\nThis is a **test** paragraph.' })

    expect(result.errors).toHaveLength(0)
    expect(result.document.type).toBe('Document')
    expect(result.document.children.length).toBeGreaterThan(0)

    // rst-compiler places sections and paragraphs as siblings at document level
    const section = result.document.children.find(c => c.type === 'Section')
    expect(section).toBeDefined()
    expect(section!.title).toBe('Hello')

    const paragraph = result.document.children.find(c => c.type === 'Paragraph')
    expect(paragraph).toBeDefined()
  })

  it('parses complex RST with rst-compiler', () => {
    const parser = createRstCompilerParser()
    const input = `Document Title
==============

Section One
-----------

This is a paragraph with **bold** and *italic* text.

- item 1
- item 2

.. note:: This is important!

Section Two
-----------

.. code:: python

   def hello():
       print("world")

Final paragraph with \`inline code\`.
`
    const result = parser.parse({ input })

    expect(result.errors).toHaveLength(0)
    const doc = result.document
    expect(doc.children.length).toBeGreaterThan(0)

    // Should have sections
    const sections = doc.children.filter(c => c.type === 'Section')
    expect(sections.length).toBeGreaterThanOrEqual(1)
  })

  it('renders HTML through rst-compiler parser', () => {
    const parser = createRstCompilerParser()
    const doc = parser.parse({ input: 'Title\n=====\n\nHello **world**.' }).document

    const renderer = new HtmlRenderer()
    for (const plugin of builtinDirectivePlugins) {
      plugin.install(renderer)
    }

    const html = renderer.render(doc)
    expect(html).toContain('<strong>world</strong>')
    expect(html).toContain('Title')
  })

  it('handles empty input gracefully', () => {
    const parser = createRstCompilerParser()
    const result = parser.parse({ input: '' })
    expect(result.document.type).toBe('Document')
    expect(result.document.children).toHaveLength(0)
  })

  it('handles directives with rst-compiler', () => {
    const parser = createRstCompilerParser()
    const input = 'Doc\n===\n\n.. image:: /path/to/img.png\n   :alt: Test Image'
    const result = parser.parse({ input })

    expect(result.errors).toHaveLength(0)
    const doc = result.document
    const directives = doc.findAllChildren ? undefined : undefined // rst-compiler node API

    // At minimum, should parse without errors
    expect(doc.children.length).toBeGreaterThan(0)
  })
})
