import { describe, it, expect } from 'vitest'
import { renderTemplate, renderRstTemplate } from '../src/index.ts'

describe('Template Engine v2', () => {
  // -----------------------------------------------------------------------
  // Basic
  // -----------------------------------------------------------------------
  it('interpolates variables', () => {
    expect(renderTemplate('Hello {{ name }}!', { name: 'World' })).toBe('Hello World!')
  })

  it('handles default filter', () => {
    expect(renderTemplate('{{ x|default("N/A") }}', {})).toBe('N/A')
    expect(renderTemplate('{{ x|default("N/A") }}', { x: 'val' })).toBe('val')
  })

  it('handles missing variables', () => {
    expect(renderTemplate('{{ missing }}', {})).toBe('')
  })

  it('handles tojson filter', () => {
    const r = renderTemplate('{{ obj|tojson }}', { obj: { a: 1 } })
    expect(r).toBe('{"a":1}')
  })

  // -----------------------------------------------------------------------
  // For loops
  // -----------------------------------------------------------------------
  it('processes simple for loops', () => {
    const r = renderTemplate('{% for item in items %}{{ item }},{% endfor %}', { items: ['a', 'b', 'c'] })
    expect(r).toBe('a,b,c,')
  })

  it('provides loop.index', () => {
    const r = renderTemplate('{% for s in items %}{{ loop.index }}:{{ s }} {% endfor %}', { items: ['A', 'B'] })
    expect(r).toBe('1:A 2:B ')
  })

  it('provides loop.first / loop.last', () => {
    const r = renderTemplate(
      '{% for s in items %}{% if not loop.first %}, {% endif %}{{ s }}{% endfor %}',
      { items: ['A', 'B', 'C'] },
    )
    expect(r).toBe('A, B, C')
  })

  it('provides loop.revindex', () => {
    const r = renderTemplate('{% for s in items %}{{ loop.revindex }} {% endfor %}', { items: ['A', 'B', 'C'] })
    expect(r).toBe('3 2 1 ')
  })

  // -----------------------------------------------------------------------
  // Nested for loops (v2 feature)
  // -----------------------------------------------------------------------
  it('supports nested for loops', () => {
    const template = `{% for group in groups %}
Group: {{ group.name }}
{% for item in group.items %}
  - {{ item }}
{% endfor %}
{% endfor %}`
    const ctx = {
      groups: [
        { name: 'G1', items: ['a', 'b'] },
        { name: 'G2', items: ['c', 'd', 'e'] },
      ],
    }
    const r = renderTemplate(template, ctx)
    expect(r).toContain('Group: G1')
    expect(r).toContain('- a')
    expect(r).toContain('- b')
    expect(r).toContain('Group: G2')
    expect(r).toContain('- c')
    expect(r).toContain('- d')
    expect(r).toContain('- e')
  })

  it('supports triple nested loops', () => {
    const template = `{% for a in items %}
A{{ a }}:
{% for b in items %}
  B{{ b }}:
{% for c in items %}
    C{{ c }}
{% endfor %}
{% endfor %}
{% endfor %}`
    const r = renderTemplate(template, { items: ['x', 'y'] })
    expect(r).toContain('A')
    expect(r).toContain('B')
    expect(r).toContain('C')
    // Count occurrences
    expect(r.match(/Cx/g)?.length).toBeGreaterThanOrEqual(4) // nested 2*2*2
  })

  // -----------------------------------------------------------------------
  // If/else
  // -----------------------------------------------------------------------
  it('handles if/else', () => {
    expect(renderTemplate('{% if flag %}YES{% else %}NO{% endif %}', { flag: true })).toBe('YES')
    expect(renderTemplate('{% if flag %}YES{% else %}NO{% endif %}', { flag: false })).toBe('NO')
  })

  it('handles if not', () => {
    expect(renderTemplate('{% if not flag %}YES{% else %}NO{% endif %}', { flag: false })).toBe('YES')
    expect(renderTemplate('{% if not flag %}YES{% else %}NO{% endif %}', { flag: true })).toBe('NO')
  })

  it('handles nested if inside for', () => {
    const template = `{% for item in items %}
{% if item.active %}
* {{ item.name }}
{% else %}
  {{ item.name }} (inactive)
{% endif %}
{% endfor %}`
    const ctx = {
      items: [
        { name: 'A', active: true },
        { name: 'B', active: false },
        { name: 'C', active: true },
      ],
    }
    const r = renderTemplate(template, ctx)
    expect(r).toContain('* A')
    expect(r).toContain('B (inactive)')
    expect(r).toContain('* C')
  })

  // -----------------------------------------------------------------------
  // Filters
  // -----------------------------------------------------------------------
  it('supports length filter', () => {
    expect(renderTemplate('{{ items|length }}', { items: ['a', 'b', 'c'] })).toBe('3')
    expect(renderTemplate('{{ name|length }}', { name: 'hello' })).toBe('5')
  })

  it('supports upper/lower/title filters', () => {
    expect(renderTemplate('{{ x|upper }}', { x: 'hello' })).toBe('HELLO')
    expect(renderTemplate('{{ x|lower }}', { x: 'HELLO' })).toBe('hello')
  })

  it('supports join filter', () => {
    const r = renderTemplate('{{ items|join(", ") }}', { items: ['a', 'b', 'c'] })
    expect(r).toBe('a, b, c')
  })

  // -----------------------------------------------------------------------
  // Path access
  // -----------------------------------------------------------------------
  it('handles dotted access', () => {
    expect(renderTemplate('{{ user.profile.name }}', { user: { profile: { name: 'Alice' } } })).toBe('Alice')
  })

  it('handles bracket access', () => {
    expect(renderTemplate('{{ items["key"] }}', { items: { key: 'value' } })).toBe('value')
  })

  // -----------------------------------------------------------------------
  // Annopi-style templates
  // -----------------------------------------------------------------------
  it('renders annopi report with nested loops', () => {
    const template = `Cell Ranger 分析
================

{% for sample in samples %}
{{ sample.name }}
{{ '=' * sample.name.length }}

{% for file in sample.files %}
- {{ file }}
{% endfor %}

{% endfor %}
`
    const r = renderRstTemplate(template, {
      samples: [
        { name: 'CTRL', files: ['summary.csv', 'plot.png'] },
        { name: 'KO', files: ['metrics.tsv'] },
      ],
    })

    expect(r).toContain('Cell Ranger')
    expect(r).toContain('CTRL')
    expect(r).toContain('KO')
    expect(r).toContain('summary.csv')
    expect(r).toContain('plot.png')
    expect(r).toContain('metrics.tsv')
  })
})
