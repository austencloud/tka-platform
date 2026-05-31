/**
 * ArrowAdjustmentUndoStack
 *
 * In-memory stack tracking every WASD arrow adjustment during the current session.
 * Session-scoped: clears on page refresh.
 *
 * Used by ArrowAdjustmentPanel to implement Ctrl+Z undo.
 */

import type { AdjustmentTargetKey } from "../../../../../../features/create/shared/services/arrow-adjustment-orchestrator";

const MAX_STACK_SIZE = 50;

export interface UndoEntry {
  targetKey: AdjustmentTargetKey;
  previousX: number;
  previousY: number;
  newX: number;
  newY: number;
  timestamp: number;
}

let stack: UndoEntry[] = [];

export const arrowAdjustmentUndoStack = {
  push(entry: UndoEntry): void {
    stack.push(entry);
    if (stack.length > MAX_STACK_SIZE) {
      stack.shift();
    }
  },

  pop(): UndoEntry | null {
    return stack.pop() ?? null;
  },

  peek(): UndoEntry | null {
    return stack.length > 0 ? stack[stack.length - 1]! : null;
  },

  get size(): number {
    return stack.length;
  },

  get isEmpty(): boolean {
    return stack.length === 0;
  },

  clear(): void {
    stack = [];
  },
};
