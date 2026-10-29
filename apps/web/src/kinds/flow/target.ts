import { Array, Option, pipe } from 'effect'

import { type BoardDoc, findNode } from '../../domain/board'
import type { Target } from './dsl'

/** Блок, на который указывает цель сцены: id блока или первый блок вида. */
export const resolveTarget = (
  doc: BoardDoc,
  target: Target,
): Option.Option<string> =>
  typeof target === 'string'
    ? Option.map(findNode(doc, target), node => node.id)
    : pipe(
        Array.findFirst(doc.nodes, node => node.kind === target.kind),
        Option.map(node => node.id),
      )
