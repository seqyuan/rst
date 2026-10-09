import { describe, it, expect } from 'vitest'
import type { Plugin } from 'vite'
import rstPlugin from './index'

const ctx = {
  error(message: string): never {
    throw new Error(message)
  },
}

type Transform = (this: unknown, code: string, id: string) => Promise<{ code: string } | null>

/** `plugin.transform` may be a function or an `{ handler }` object hook. */
function getTransform(plugin: Plugin): Transform {
  const transform = plugin.transform
  if (typeof transform === 'function') return transform as Transform
  return (transform as { handler: Transform }).handler
}

const RST = 'Hello\n=====\n\nThis is **bold**.\n'

describe('vite-plugin-rst', () => {
  it('renders .rst to an HTML module by default', async () => {
    const plugin = rstPlugin()
    const result = await getTransform(plugin).call(ctx, RST, '/tmp/hello.rst')
    expect(result?.code).toContain('export const html')
    expect(result?.code).toContain('<strong>bold</strong>')
  })

  it('renders Markdown with ?md', async () => {
    const plugin = rstPlugin()
    const result = await getTransform(plugin).call(ctx, RST, '/tmp/hello.rst?md')
    expect(result?.code).toContain('export default')
    expect(result?.code).toContain('bold')
  })

  it('exports metadata with ?meta without importing the renderer', async () => {
    const plugin = rstPlugin()
    const result = await getTransform(plugin).call(ctx, RST, '/tmp/hello.rst?meta')
    expect(result?.code).toContain('export const meta')
    expect(result?.code).toContain('Hello')
  })

  it('ignores non-rst modules', async () => {
    const plugin = rstPlugin()
    const result = await getTransform(plugin).call(ctx, 'const a = 1', '/tmp/a.ts')
    expect(result).toBeNull()
  })
})
