import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { parseArgs } from './cli'
import { buildTemplateContext, collectScanMatches } from './context'

describe('rst-cli helpers', () => {
  it('parses template vars and scans', () => {
    const args = parseArgs([
      'report.rst.j2',
      '-t',
      '-d', 'project.json',
      '-v', 'project_name=PRJ-001',
      '--expand-includes',
      '--scan', 'plots=upload/plots/*_umap.png',
      '--scan', 'report/source/*.rst',
    ])

    expect(args.input).toBe('report.rst.j2')
    expect(args.format).toBe('template')
    expect(args.data).toBe('project.json')
    expect(args.expandIncludes).toBe(true)
    expect(args.vars.project_name).toBe('PRJ-001')
    expect(args.scans).toEqual([
      { key: 'plots', pattern: 'upload/plots/*_umap.png' },
      { key: 'scan2', pattern: 'report/source/*.rst' },
    ])
  })

  it('collects scan matches with file metadata', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rst-cli-scan-'))

    try {
      mkdirSync(join(dir, 'upload/plots'), { recursive: true })
      writeFileSync(join(dir, 'upload/plots/WT_Control_umap.png'), 'pngdata')
      writeFileSync(join(dir, 'upload/plots/KO_Treated_umap.png'), 'pngdata2')

      const matches = collectScanMatches(
        { key: 'plots', pattern: 'upload/plots/*_umap.png' },
        dir,
      )

      expect(matches).toHaveLength(2)
      expect(matches[0]).toMatchObject({
        path: 'upload/plots/KO_Treated_umap.png',
        name: 'KO_Treated_umap.png',
        stem: 'KO_Treated_umap',
        ext: '.png',
        dir: 'upload/plots',
      })
      expect(matches[1]?.size).toBeGreaterThan(0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('builds template context from data vars and scans', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rst-cli-context-'))

    try {
      mkdirSync(join(dir, 'upload/plots'), { recursive: true })
      writeFileSync(join(dir, 'project.json'), JSON.stringify({
        project_name: 'FromData',
        summary: { species: 'human' },
      }))
      writeFileSync(join(dir, 'upload/plots/S1_umap.png'), 'img')

      const context = buildTemplateContext(
        join(dir, 'project.json'),
        { project_name: 'FromVar', build_date: '2026-06-06' },
        [{ key: 'plots', pattern: 'upload/plots/*_umap.png' }],
        dir,
      )

      expect(context.project_name).toBe('FromVar')
      expect(context.build_date).toBe('2026-06-06')
      expect(context.summary).toEqual({ species: 'human' })
      expect(context.plots).toEqual([
        expect.objectContaining({
          path: 'upload/plots/S1_umap.png',
          stem: 'S1_umap',
        }),
      ])
      expect(context.scans).toEqual({
        plots: [
          expect.objectContaining({
            path: 'upload/plots/S1_umap.png',
          }),
        ],
      })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
