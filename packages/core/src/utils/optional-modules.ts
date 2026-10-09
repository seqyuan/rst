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
/**
 * Best-effort resolution of an optional dependency to an absolute path.
 *
 * Same rationale as {@link optionalRequire}: the package is ESM, so a bare
 * `require.resolve` is not available. Returns `null` when the module cannot be
 * resolved (browser bundles, dependency not installed).
 */
export function optionalRequireResolve(id: string): string | null {
  try {
    const ambient: unknown = typeof require === 'function' ? require : null
    const resolve = (ambient as { resolve?: unknown } | null)?.resolve
    if (typeof resolve === 'function') {
      return (resolve as (id: string) => string)(id)
    }
  } catch {
    /* fall through to the Node ESM path */
  }

  try {
    const proc = (globalThis as { process?: NodeProcessLike }).process
    const nodeModule = proc?.getBuiltinModule?.('module') as
      | { createRequire?: (url: string) => RequireLike & { resolve?: (id: string) => string } }
      | undefined
    const createRequire = nodeModule?.createRequire
    if (typeof createRequire === 'function') {
      const req = createRequire(import.meta.url)
      if (typeof req.resolve === 'function') return req.resolve(id)
    }
  } catch {
    /* not available */
  }

  return null
}

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
