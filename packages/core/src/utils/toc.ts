import type { RstDocument, RstSection } from '../ast/types'
import { idFromTitle } from '../renderer/base'

export interface TocHeadingItem {
  title: string
  level: number
  href: string
}

export interface TocTreeEntry {
  href: string
  title: string
}

export function collectHeadingItems(
  document: RstDocument,
  maxDepth = Number.POSITIVE_INFINITY,
): TocHeadingItem[] {
  const counts = new Map<string, number>()
  const items: TocHeadingItem[] = []

  for (const child of document.children) {
    if (child.type === 'Section') {
      collectSectionHeadingItems(child, maxDepth, counts, items)
    }
  }

  return items
}

export function parseToctreeEntries(rawBody: string): TocTreeEntry[] {
  return rawBody
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith(':'))
    .map(parseToctreeEntry)
    .filter((entry): entry is TocTreeEntry => entry !== null)
}

function collectSectionHeadingItems(
  section: RstSection,
  maxDepth: number,
  counts: Map<string, number>,
  items: TocHeadingItem[],
): void {
  const baseId = idFromTitle(section.title)
  const count = counts.get(baseId) ?? 0
  const uniqueId = count === 0 ? baseId : `${baseId}-${count}`
  counts.set(baseId, count + 1)

  if (section.level <= maxDepth) {
    items.push({
      title: section.title,
      level: section.level,
      href: `#${uniqueId}`,
    })
  }

  const nestedSections = section.subsections.length > 0
    ? section.subsections
    : section.children.filter((child): child is RstSection => child.type === 'Section')

  for (const child of nestedSections) {
    collectSectionHeadingItems(child, maxDepth, counts, items)
  }
}

function parseToctreeEntry(line: string): TocTreeEntry | null {
  const explicitMatch = line.match(/^(.*?)\s*<([^>]+)>\s*$/)
  if (explicitMatch) {
    const title = explicitMatch[1]!.trim()
    const href = explicitMatch[2]!.trim()
    if (!href) return null
    return {
      href,
      title: title || deriveTitleFromHref(href),
    }
  }

  return {
    href: line,
    title: deriveTitleFromHref(line),
  }
}

function deriveTitleFromHref(href: string): string {
  const normalized = href
    .replace(/[#?].*$/, '')
    .replace(/\/$/, '')
  const leaf = normalized.split('/').filter(Boolean).pop() ?? href
  const stem = leaf.replace(/\.[a-z0-9]+$/i, '')

  return stem
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || href
}
