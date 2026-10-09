// ---------------------------------------------------------------------------
// Lazy loader for optional heavy dependencies (KaTeX, Shiki).
// ---------------------------------------------------------------------------

type RequireLike = (id: string) => unknown

interface NodeProcessLike {
  getBuiltinModule?: (name: string) => unknown
}

/**
 * Best-effort synchronous `require` for optional dependencies.
 *
 * The previous implementation called `require(...)` directly. Because this
 * package ships as ESM, the bundler rewrote those calls into a `__require`
 * shim that throws `Dynamic require of "..." is not supported` whenever the
 * package was consumed with `import`. As a result KaTeX and Shiki silently
 * never loaded (no math, no syntax highlighting) for ESM users.
 *
 * We now try, in order:
 *
 *   1. an ambient CommonJS `require` (CJS entry points, some bundlers, Jest),
 *   2. Node's `module.createRequire` reached through `process.getBuiltinModule`
 *      (Node >= 22.3), which works in ESM too.
 *
 * Returns `null` when the module cannot be loaded (browser bundles, older
 * runtimes, dependency not installed) so callers can fall back gracefully.
 */
export function optionalRequire(id: string): unknown {
  // 1. Ambient CommonJS require.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ambient: unknown = typeof require === 'function' ? require : null
    if (typeof ambient === 'function') {
      return (ambient as RequireLike)(id)
    }
  } catch {
    /* fall through to the Node ESM path */
  }

  // 2. Node ESM: resolve a require scoped to this module.
  try {
    const proc = (globalThis as { process?: NodeProcessLike }).process
    const nodeModule = proc?.getBuiltinModule?.('module') as
      | { createRequire?: (url: string) => RequireLike }
      | undefined
    const createRequire = nodeModule?.createRequire
    if (typeof createRequire === 'function') {
      return createRequire(import.meta.url)(id)
    }
  } catch {
    /* not available */
  }

  return null
}
