import { describe, it, expect } from 'vitest'
import { renderRst, renderTemplate, renderRstTemplate } from '../src/index.ts'

describe('Template Engine', () => {
  it('interpolates variables', () => {
    const result = renderTemplate('Hello {{ name }}!', { name: 'World' })
    expect(result).toBe('Hello World!')
  })

  it('handles default filter', () => {
    const result = renderTemplate('{{ name|default("Guest") }}', {})
    expect(result).toBe('Guest')
  })

  it('handles missing variables', () => {
    const result = renderTemplate('{{ missing }}', {})
    expect(result).toBe('')
  })

  it('processes for loops', () => {
    const result = renderTemplate(
      'Items:\n{% for item in items %}- {{ item }}\n{% endfor %}',
      { items: ['a', 'b', 'c'] },
    )
    expect(result).toContain('- a')
    expect(result).toContain('- b')
    expect(result).toContain('- c')
  })

  it('provides loop.index', () => {
    const result = renderTemplate(
      '{% for s in samples %}{{ loop.index }}. {{ s }}\n{% endfor %}',
      { samples: ['A', 'B'] },
    )
    expect(result).toContain('1. A')
    expect(result).toContain('2. B')
  })

  it('provides loop.first / loop.last', () => {
    const result = renderTemplate(
      '{% for s in samples %}{% if not loop.last %}{{ s }}, {% else %}{{ s }}{% endif %}{% endfor %}',
      { samples: ['A', 'B', 'C'] },
    )
    expect(result).toBe('A, B, C')
  })

  it('handles if/else', () => {
    const result = renderTemplate(
      '{% if show %}yes{% else %}no{% endif %}',
      { show: true },
    )
    expect(result).toBe('yes')

    const result2 = renderTemplate(
      '{% if show %}yes{% else %}no{% endif %}',
      { show: false },
    )
    expect(result2).toBe('no')
  })

  it('handles dotted access', () => {
    const result = renderTemplate('{{ user.name }}', { user: { name: 'Alice' } })
    expect(result).toBe('Alice')
  })

  it('handles bracket access', () => {
    const result = renderTemplate('{{ items["key"] }}', { items: { key: 'value' } })
    expect(result).toBe('value')
  })

  it('strips comments', () => {
    const result = renderTemplate('before{# this is a comment #}after', {})
    expect(result).toBe('beforeafter')
  })

  it('renders RST template to HTML', () => {
    const html = renderRstTemplate(
      'Title\n=====\n\n{% for s in samples %}- {{ s.name }}\n{% endfor %}',
      { samples: [{ name: 'S1' }, { name: 'S2' }] },
    )
    expect(html).toContain('<h2')
    expect(html).toContain('S1')
    expect(html).toContain('S2')
  })

  it('handles annopi-style RST template', () => {
    const template = `Cellranger Report
===================

Summary
-------

.. csv-table::
   :file: {{ data.tables[0] }}

{% for img in data.images %}
.. image:: ../../upload/{{ img }}
   :width: 600px

{% endfor %}
`
    const context = {
      data: {
        tables: ['summary.csv'],
        images: ['plot1.png', 'plot2.png'],
      },
    }

    const rst = renderTemplate(template, context)
    expect(rst).toContain('summary.csv')
    expect(rst).toContain('plot1.png')
    expect(rst).toContain('plot2.png')
    expect(rst).toContain('Cellranger Report')
  })

  it('renders list-table content from template variables', () => {
    const template = `Report
======

.. list-table::
   :header-rows: 1

   * - Sample
     - Note
{% for sample in samples %}
   * - {{ sample.name }}
     - {{ sample.note }}
{% endfor %}
`

    const html = renderRstTemplate(template, {
      samples: [
        { name: 'WT_Control', note: 'Wild type' },
        { name: 'KO_Treated', note: 'Knockout' },
      ],
    })

    expect(html).toContain('<table class="list-table">')
    expect(html).toContain('WT_Control')
    expect(html).toContain('Knockout')
  })
})
