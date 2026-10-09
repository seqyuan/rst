import { describe, it, expect } from 'vitest'
import {
  renderRst,
  wrapHtmlDocument,
  DEFAULT_THEME_CSS,
  preloadRenderers,
} from '../src/index.ts'

// ---------------------------------------------------------------------------
// Regression tests for the 0.1.3 fix set.
// ---------------------------------------------------------------------------

describe('code directives', () => {
  it('.. code:: is not double-escaped and keeps its language', () => {
    const html = renderRst('T\n======\n\n.. code:: python\n\n   print(1)\n')
    expect(html).not.toContain('&lt;pre&gt;')
    expect(html).toContain('print')
    // Either Shiki (loaded) or the plain fallback must mark the block.
    expect(html.includes('code-block') || html.includes('shiki')).toBe(true)
  })

  it('.. code-block:: is registered (no fall-through)', () => {
    const html = renderRst('T\n======\n\n.. code-block:: python\n\n   print(2)\n')
    expect(html).not.toContain('&lt;pre&gt;')
    expect(html.includes('code-block') || html.includes('shiki')).toBe(true)
  })

  it('.. highlight:: is a setting directive with no output', () => {
    const html = renderRst('T\n======\n\n.. highlight:: python\n\nAfter.\n')
    expect(html).not.toContain('<pre')
    expect(html).toContain('After.')
  })
})

describe('math', () => {
  it('.. math:: is not double-escaped', () => {
    const html = renderRst('T\n======\n\n.. math::\n\n   E = mc^2\n')
    expect(html).not.toContain('&lt;pre&gt;')
    expect(html).toContain('E = mc')
    expect(html.includes('katex') || html.includes('\\[')).toBe(true)
  })

  it('the inline :math: role is recognised', () => {
    const html = renderRst('T\n======\n\nInline :math:`x^2` done.\n')
    expect(html).not.toContain(':math:<code>')
    expect(html).toContain('math-inline')
  })
})

describe('field lists', () => {
  it('parses :name: value pairs into dl.field-list', () => {
    const html = renderRst('T\n======\n\n:物种: Human (GRCh38)\n:样本数: 3\n')
    expect(html).toContain('class="field-list"')
    expect(html).toContain('<dt>物种</dt>')
    expect(html).toContain('Human (GRCh38)')
    expect(html).toContain('<dt>样本数</dt>')
  })

  it('handles values containing colons', () => {
    const html = renderRst('T\n======\n\n:url: http://a:b/c\n')
    expect(html).toContain('<dt>url</dt>')
    expect(html).toContain('http://a:b/c')
  })
})

describe('tables', () => {
  it('csv-table supports :header: and emits a caption', () => {
    const html = renderRst('T\n======\n\n.. csv-table:: 样本质控\n   :header: 样本, Cells\n\n   WT, 5120\n')
    expect(html).toContain('<caption>样本质控</caption>')
    expect(html).toContain('<thead>')
    expect(html).toContain('<th>样本</th>')
    expect(html).toContain('<th>Cells</th>')
  })

  it('list-table emits its caption', () => {
    const html = renderRst(
      'T\n======\n\n.. list-table:: 样本表\n   :header-rows: 1\n\n   * - A\n     - B\n   * - 1\n     - 2\n',
    )
    expect(html).toContain('<caption>样本表</caption>')
    expect(html).toContain('<thead>')
  })
})

describe('images', () => {
  it('normalises :width: values', () => {
    expect(renderRst('T\n======\n\n.. image:: a.png\n   :width: 600\n')).toContain('width="600"')
    const px = renderRst('T\n======\n\n.. image:: a.png\n   :width: 600px\n')
    expect(px).toContain('style="width:600px"')
    expect(px).not.toContain('width="600px"')
  })

  it('escapes src/alt attributes', () => {
    const html = renderRst('T\n======\n\n.. image:: a"b.png\n   :alt: a"b\n')
    expect(html).toContain('src="a&quot;b.png"')
    expect(html).toContain('alt="a&quot;b"')
  })
})

describe('admonitions and containers', () => {
  it('splits multi-paragraph bodies and drops trailing blank lines', () => {
    const html = renderRst('T\n======\n\n.. note::\n\n   第一段。\n\n   第二段。\n')
    expect(html).toContain('<p>第一段。</p>')
    expect(html).toContain('<p>第二段。</p>')
    expect(html).not.toContain('第一段。\n\n')
  })

  it('escapes the admonition title', () => {
    const html = renderRst('T\n======\n\n.. note:: <b>INJECT</b>\n\n   body\n')
    expect(html).not.toContain('<p class="admonition-title"><b>')
    expect(html).toContain('&lt;b&gt;INJECT&lt;/b&gt;')
  })

  it('escapes the container class name', () => {
    const html = renderRst('T\n======\n\n.. container:: a" onload="x\n\n   y\n')
    expect(html).not.toContain('class="a" ')
    expect(html).toContain('&quot;')
  })
})

describe('headings', () => {
  it('defaults to h2 for level-1 sections (embed-friendly)', () => {
    const html = renderRst('报告标题\n========\n\n章节\n----\n\n正文。\n')
    expect(html).toContain('<h2 id=')
    expect(html).toContain('报告标题</h2>')
    expect(html).toContain('<h3 id=')
  })

  it('starts at h1 when headingOffset is 0', () => {
    const html = renderRst('报告标题\n========\n\n章节\n----\n\n正文。\n', { headingOffset: 0 })
    expect(html).toContain('<h1 id="报告标题">报告标题</h1>')
    expect(html).toContain('<h2 id="章节">章节</h2>')
  })
})

describe('raw / substitutions', () => {
  it('.. raw:: html passes markup through unescaped', () => {
    const html = renderRst('T\n======\n\n.. raw:: html\n\n   <div class="x">hi</div>\n')
    expect(html).toContain('<div class="x">hi</div>')
    expect(html).not.toContain('&lt;div')
  })

  it('resolves |substitution| references', () => {
    const html = renderRst('T\n======\n\n.. |x| replace:: HELLO\n\nUse |x| here.\n')
    expect(html).toContain('Use HELLO here.')
  })
})

describe('lists', () => {
  it('parses definition lists', () => {
    const html = renderRst('T\n======\n\nterm\n   definition text\n')
    expect(html).toContain('<dl>')
    expect(html).toContain('<dt>term</dt>')
    expect(html).toContain('definition text')
  })

  it('parses option lists', () => {
    const html = renderRst('T\n======\n\n-a, --all    Process everything\n-x           Enable X\n')
    expect(html).toContain('class="option-list"')
    expect(html).toContain('<code>-a</code>')
    expect(html).toContain('<code>--all</code>')
    expect(html).toContain('Process everything')
  })
})

describe('wrapHtmlDocument', () => {
  it('produces a complete document with the built-in theme', () => {
    const doc = wrapHtmlDocument(renderRst('报告标题\n========\n\n正文。\n', { headingOffset: 0 }), {
      title: '测试报告',
    })
    expect(doc.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(doc).toContain('<html lang="zh-CN">')
    expect(doc).toContain('<title>测试报告</title>')
    expect(doc).toContain('class="rst-report"')
    expect(doc).toContain(DEFAULT_THEME_CSS.slice(0, 40))
    expect(doc).toContain('</html>')
  })

  it('falls back to the first heading for the title', () => {
    expect(wrapHtmlDocument('<h1>自动标题</h1>')).toContain('<title>自动标题</title>')
    expect(wrapHtmlDocument('<h2>嵌入标题</h2>')).toContain('<title>嵌入标题</title>')
  })

  it('can disable the built-in theme with css: ""', () => {
    const doc = wrapHtmlDocument('<p>x</p>', { css: '' })
    expect(doc).not.toContain('rst-renderer default theme')
  })
})

describe('preloadRenderers', () => {
  it('resolves without throwing', async () => {
    await expect(preloadRenderers()).resolves.toBeUndefined()
  })
})
