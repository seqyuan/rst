import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { renderRst, renderTemplate, createBuiltinParser, MarkdownRenderer } from '../src/index.ts'

// ---------------------------------------------------------------------------
// Regression tests for the 0.1.4 fix set.
//   - builtin parser: grid + simple tables
//   - builtin parser: section underline immediately followed by a paragraph
//   - builtin parser: overline sections
//   - template engine: `'=' * name.length`
//   - csv-table `:file:` actually reads the file (baseDir)
//   - Markdown output no longer over-escapes
//   - rst-compiler backend is loadable from ESM
// ---------------------------------------------------------------------------

describe('builtin tables', () => {
  it('parses a grid table with a header', () => {
    const html = renderRst(
      'Title\n=====\n\n+------+------+\n| A    | B    |\n+======+======+\n| 1    | 2    |\n+------+------+\n',
    )
    expect(html).toContain('<table>')
    expect(html).toContain('<thead>')
    expect(html).toContain('<th><p>A</p>')
    expect(html).toContain('<th><p>B</p>')
    expect(html).toContain('<td><p>1</p>')
    expect(html).toContain('<td><p>2</p>')
    expect(html).not.toContain('+------+')
  })

  it('parses a simple table with a header', () => {
    const html = renderRst('Title\n=====\n\nA      B\n=====  =====\n1      2\n')
    expect(html).toContain('<table>')
    expect(html).toContain('<th><p>A</p>')
    expect(html).toContain('<th><p>B</p>')
    expect(html).toContain('<td><p>1</p>')
    expect(html).toContain('<td><p>2</p>')
  })

  it('does not mistake a section underline for a table', () => {
    const html = renderRst('Title\n=====\n\nA paragraph.\n')
    expect(html).not.toContain('<table>')
    expect(html).toContain('A paragraph.')
  })
})

describe('section headings', () => {
  it('keeps the paragraph that immediately follows an underline', () => {
    const html = renderRst('Title\n=====\nSome paragraph text here.\n')
    expect(html).toContain('<h2 id="title">Title</h2>')
    expect(html).toContain('<p>Some paragraph text here.</p>')
    expect(html).not.toContain('id="">')
  })

  it('parses an overline section without emitting a transition', () => {
    const html = renderRst('=========\nTitle\n=========\n\nBody.\n')
    expect(html).toContain('<h2 id="title">Title</h2>')
    expect(html).toContain('Body.')
    expect(html).not.toContain('<hr>')
  })
})

describe('template engine', () => {
  it('resolves string/array length', () => {
    expect(renderTemplate('{{ name.length }}', { name: 'Hello' })).toBe('5')
    expect(renderTemplate('{{ items.length }}', { items: [1, 2, 3] })).toBe('3')
  })

  it("supports the documented string-repeat idiom `'=' * name.length`", () => {
    expect(renderTemplate("{{ '=' * name.length }}", { name: 'Hello' })).toBe('=====')
    expect(renderTemplate("{{ '=' * sample.name.length }}", { sample: { name: 'S1' } })).toBe('==')
    expect(renderTemplate("{{ '~' * 4 }}", {})).toBe('~~~~')
  })

  it('preserves unknown tags verbatim instead of emitting a stray `%}`', () => {
    expect(renderTemplate('before {% unknown foo %} after', {})).toBe('before {% unknown foo %} after')
  })

  it('renders a template-generated section heading', () => {
    const rst = renderTemplate("{{ name }}\n{{ '=' * name.length }}\n\nBody.\n", { name: 'Report' })
    const html = renderRst(rst)
    expect(html).toContain('<h2 id="report">Report</h2>')
    expect(html).toContain('Body.')
  })
})

describe('csv-table :file:', () => {
  it('reads and renders the referenced CSV relative to baseDir', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rst-csv-'))
    try {
      writeFileSync(join(dir, 'qc.csv'), 'sample,cells\nS1,5234\nS2,4891\n')
      const html = renderRst(
        'Title\n=====\n\n.. csv-table:: QC\n   :header-rows: 1\n   :file: qc.csv\n',
        { baseDir: dir },
      )
      expect(html).toContain('<caption>QC</caption>')
      expect(html).toContain('<th>sample</th>')
      expect(html).toContain('<td>S1</td>')
      expect(html).toContain('<td>4891</td>')
      expect(html).not.toContain('data-file=')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('markdown output', () => {
  it('does not over-escape punctuation', () => {
    const doc = createBuiltinParser().parse({
      input: 'Title\n=====\n\nHello-world. This is a.b.c and 50% done.\n',
    }).document
    const md = new MarkdownRenderer({ headingOffset: 1 }).render(doc)
    expect(md).toContain('Hello-world. This is a.b.c and 50% done.')
    expect(md).not.toContain('\\-')
    expect(md).not.toContain('\\.')
  })

  it('still escapes characters that can start markup', () => {
    const doc = createBuiltinParser().parse({
      input: 'Title\n=====\n\nsnake_case and *stars* here.\n',
    }).document
    const md = new MarkdownRenderer({ headingOffset: 1 }).render(doc)
    expect(md).toContain('snake\\_case')
    // RST emphasis becomes Markdown emphasis, not an escaped literal.
    expect(md).toContain('*stars*')
  })
})

describe('rst-compiler backend', () => {
  it('loads and parses through the ESM-safe loader', () => {
    const html = renderRst('Title\n=====\n\nHello **world**.\n', { parser: 'rst-compiler' })
    expect(html).toContain('<h2')
    expect(html).toContain('Title')
    expect(html).toContain('<strong>world</strong>')
  })
})
