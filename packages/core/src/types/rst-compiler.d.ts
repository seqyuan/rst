declare module 'rst-compiler' {
  export class RstCompiler {
    readonly outputWarnings: ReadonlyArray<string>
    readonly outputErrors: ReadonlyArray<string>
    nodeParsers: unknown[]
    parse(input: string, opts?: Record<string, unknown>): unknown
  }
  export class RstToHtmlCompiler extends RstCompiler {
    constructor()
  }
  export type RstCompilerPlugin = Record<string, unknown>
}
