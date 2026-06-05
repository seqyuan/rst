/**
 * A visitor callback that receives an RST node and its current depth.
 * Return `false` to stop traversing that node's children.
 */
export type RstVisitor<T extends RstNode = RstNode> = (node: T, depth: number) => void | false

/**
 * Walk the AST depth-first, calling `visitor` on each node.
 * If the visitor returns `false`, children of that node are skipped.
 */
export function walkAst(node: RstNode, visitor: RstVisitor, depth = 0): void {
  const shouldDescend = visitor(node, depth)
  if (shouldDescend === false) return

  if ('children' in node && Array.isArray(node.children)) {
    for (const child of node.children as RstNode[]) {
      walkAst(child, visitor, depth + 1)
    }
  }
}

import type { RstNode } from './types'
