import { describe, it, expect } from 'vitest'
import { createBuiltinParser, MarkdownRenderer } from '../src/index.ts'

describe('MarkdownRenderer', () => {
  const parser = createBuiltinParser()
  const renderer = new MarkdownRenderer()

  function md(rst: string): string {
    const doc = parser.parse({ input: rst }).document
    return renderer.render(doc)
  }

  it('renders headings', () => {
    const renderer2 = new MarkdownRenderer({ headingOffset: 1 })
    const result = renderer2.render(parser.parse({ input: 'Hello\n=====\n\nPara.' }).document)
    expect(result).toContain('## Hello')
    expect(result).toContain('Para')
  })

  it('renders inline markup', () => {
    const result = md('Test\n====\n\nThis is **bold** and *italic* and `code`.')
    expect(result).toContain('**bold**')
    expect(result).toContain('*italic*')
    expect(result).toContain('`code`')
  })

  it('renders bullet lists', () => {
    const result = md('List\n====\n\n- item 1\n- item 2')
    expect(result).toContain('- item 1')
    expect(result).toContain('- item 2')
  })

  it('renders literal blocks as fenced code', () => {
    const result = md('Code\n====\n\nExample::\n\n  console.log("hi")')
    expect(result).toContain('```')
    expect(result).toContain('console.log("hi")')
  })

  it('renders transitions', () => {
    const result = md('A\n=\n\nPara 1.\n\n----\n\nPara 2.')
    expect(result).toContain('---')
  })

  it('renders directive image', () => {
    const result = md('Doc\n===\n\n.. image:: pic.png\n   :alt: My Pic')
    expect(result).toContain('![My Pic](pic.png)')
  })

  it('renders directive note', () => {
    const result = md('Doc\n===\n\n.. note:: Important note here.')
    expect(result).toContain('> **Important:**')
    expect(result).toContain('Important:')
  })

  it('renders directive code with language', () => {
    const result = md('Doc\n===\n\n.. code:: python\n\n   print("hello")')
    expect(result).toContain('```python')
  })

  it('renders list-table directive body as best-effort Markdown', () => {
    const result = md(`Doc
===

.. list-table::
   :header-rows: 1

   * - Sample
     - Note
   * - WT_Control
     - Wild type`)

    expect(result).toContain('Sample')
    expect(result).toContain('WT\\_Control')
    expect(result).toContain('Wild type')
  })

  it('renders contents directive as Markdown links', () => {
    const result = md(`Doc
===

.. contents:: Outline
   :depth: 2

Section A
---------

Section B
---------

Subsection
~~~~~~~~~~`)

    expect(result).toContain('**Outline**')
    expect(result).toContain('[Doc](#doc)')
    expect(result).toContain('[Section A](#section-a)')
    expect(result).toContain('[Section B](#section-b)')
    expect(result).not.toContain('[Subsection](#subsection)')
  })

  it('renders toctree directive as Markdown link list', () => {
    const result = md(`Doc
===

.. toctree::
   :caption: Related Reports

   qc-summary
   UMAP Gallery <reports/umap-gallery.html>`)

    expect(result).toContain('**Related Reports**')
    expect(result).toContain('[qc summary](qc-summary)')
    expect(result).toContain('[UMAP Gallery](reports/umap-gallery.html)')
  })
})
