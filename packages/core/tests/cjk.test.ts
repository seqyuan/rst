import { describe, it, expect } from 'vitest'
import { renderRst, renderRstTemplate, createBuiltinParser, MarkdownRenderer } from '../src/index.ts'

describe('CJK / Chinese Content', () => {
  it('parses Chinese headings and paragraphs', () => {
    const html = renderRst('单细胞分析报告\n==============\n\n本报告使用 Cell Ranger 对单细胞样本进行了比对和定量分析。')

    expect(html).toContain('单细胞分析报告')
    expect(html).toContain('Cell Ranger')
    expect(html).toContain('<h2')
    expect(html).toContain('<p>')
  })

  it('generates valid heading IDs for Chinese titles', () => {
    const html = renderRst('质控统计汇总\n============\n\n内容。')

    // Chinese characters should be preserved in IDs (not stripped)
    expect(html).toContain('id="')
    // Should contain Chinese chars in the ID
    const idMatch = html.match(/id="([^"]+)"/)
    expect(idMatch).toBeTruthy()
    if (idMatch) {
      expect(idMatch[1]).toMatch(/[\u4e00-\u9fff]/) // contains CJK
    }
  })

  it('parses Chinese inline text with mixed English', () => {
    const html = renderRst('分析\n====\n\n使用 **Cell Ranger** 进行 `count` 分析。')

    expect(html).toContain('<strong>Cell Ranger</strong>')
    expect(html).toContain('<code>count</code>')
  })

  it('renders annopi-style report template', () => {
    const template = `Cell Ranger 分析
================

本模块使用 Cell Ranger {{ version }} 对 {{ count }} 个单细胞样本进行分析。

分析概览
--------

{% for sample in samples %}
{{ sample.name }}
{{ '~' * sample.name.length }}

- 样本编号：{{ loop.index }}
- FASTQ 目录：{{ sample.fastq }}

{% endfor %}
`

    const context = {
      version: '7.2.0',
      count: 3,
      samples: [
        { name: 'CTRL', fastq: '/data/CTRL' },
        { name: 'Treat24h', fastq: '/data/Treat24h' },
        { name: 'Treat48h', fastq: '/data/Treat48h' },
      ],
    }

    const rst = renderRstTemplate(template, context)

    // Template variables should be resolved
    expect(rst).toContain('7.2.0')
    expect(rst).toContain('3')
    expect(rst).toContain('CTRL')
    expect(rst).toContain('Treat24h')
    expect(rst).toContain('/data/CTRL')
  })

  it('handles Chinese punctuation in text', () => {
    const html = renderRst('测试\n====\n\n这是一个测试：包含中文标点，以及英文.标点。')

    expect(html).toContain('这是一个测试：包含中文标点，以及英文.标点。')
  })

  it('renders Chinese content to Markdown', () => {
    const parser = createBuiltinParser()
    const doc = parser.parse({ input: '中文标题\n========\n\n中文段落内容。' }).document
    const md = new MarkdownRenderer({ headingOffset: 1 }).render(doc)

    expect(md).toContain('## 中文标题')
    expect(md).toContain('中文段落内容')
  })

  it('renders annopi Cell Ranger template end-to-end', () => {
    const template = `Cell Ranger 分析报告
====================

项目信息
--------

- 项目名称：{{ project_name }}
- 分析日期：{{ date }}

样本列表
--------

{% for sample in samples %}
{{ sample.name }}
{{ '~' * sample.name.length }}

- 样本编号：{{ sample.id }}
- 物种：{{ sample.species|default("human") }}

{% endfor %}
`

    const context = {
      project_name: 'PRJ-2026-001',
      date: '2026-06-05',
      samples: [
        { id: 'S1', name: 'WT_Control', species: 'mouse' },
        { id: 'S2', name: 'KO_Treated' },
      ],
    }

    const rst = renderRstTemplate(template, context)
    const html = renderRst(rst)

    expect(html).toContain('PRJ-2026-001')
    expect(html).toContain('2026-06-05')
    expect(html).toContain('WT_Control')
    expect(html).toContain('KO_Treated')
    expect(html).toContain('mouse')
    expect(html).toContain('human') // default filter
  })

  it('nested for loops with Chinese content', () => {
    const template = `报告
====

{% for group in groups %}
{{ group.name }}
{{ '=' * 4 }}

{% for sample in group.samples %}
- {{ sample }}
{% endfor %}

{% endfor %}
`
    const context = {
      groups: [
        { name: '对照组', samples: ['样本A', '样本B'] },
        { name: '实验组', samples: ['样本C', '样本D', '样本E'] },
      ],
    }

    const rst = renderRstTemplate(template, context)
    expect(rst).toContain('对照组')
    expect(rst).toContain('实验组')
    expect(rst).toContain('样本A')
    expect(rst).toContain('样本E')
  })
})
