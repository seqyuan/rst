import { globSync, readFileSync, statSync, existsSync } from 'node:fs'
import { resolve, dirname, extname, basename } from 'node:path'

interface ScanSpec {
  key: string
  pattern: string
}

export interface ScanMatch {
  path: string
  absPath: string
  name: string
  stem: string
  ext: string
  dir: string
  size: number
}

function normalizePath(path: string): string {
  return path.replaceAll('\\', '/')
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseScanSpec(raw: string, index: number): ScanSpec {
  const eq = raw.indexOf('=')
  if (eq > 0) {
    return {
      key: raw.slice(0, eq),
      pattern: raw.slice(eq + 1),
    }
  }

  return {
    key: index === 0 ? 'scan' : `scan${index + 1}`,
    pattern: raw,
  }
}

export function collectScanMatches(spec: ScanSpec, baseDir: string): ScanMatch[] {
  return globSync(spec.pattern, { cwd: baseDir, withFileTypes: false })
    .map(path => normalizePath(path))
    .sort((a, b) => a.localeCompare(b))
    .flatMap((path) => {
      const absPath = resolve(baseDir, path)
      if (!existsSync(absPath)) return []

      const stats = statSync(absPath)
      if (!stats.isFile()) return []

      const ext = extname(path)
      const dir = normalizePath(dirname(path))

      return [{
        path,
        absPath: normalizePath(absPath),
        name: basename(path),
        stem: basename(path, ext),
        ext,
        dir: dir === '.' ? '' : dir,
        size: stats.size,
      }]
    })
}

export function buildTemplateContext(
  dataPath: string | undefined,
  vars: Record<string, string>,
  scans: ScanSpec[],
  scanBaseDir: string,
): Record<string, unknown> {
  const context: Record<string, unknown> = {}

  if (dataPath) {
    const dataJson = JSON.parse(readFileSync(resolve(dataPath), 'utf-8'))
    if (!isPlainObject(dataJson)) {
      throw new Error(`Data file "${dataPath}" must contain a JSON object`)
    }
    Object.assign(context, dataJson)
  }

  if (scans.length > 0) {
    const scanContext: Record<string, ScanMatch[]> = {}
    for (const spec of scans) {
      const matches = collectScanMatches(spec, scanBaseDir)
      scanContext[spec.key] = matches

      if (/^[A-Za-z_]\w*$/.test(spec.key) && !(spec.key in context)) {
        context[spec.key] = matches
      }
    }

    const existingScans = isPlainObject(context.scans) ? context.scans : {}
    context.scans = { ...existingScans, ...scanContext }
  }

  return { ...context, ...vars }
}

export type { ScanSpec }
