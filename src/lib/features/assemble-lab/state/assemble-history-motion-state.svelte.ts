import {
  createAssembleHistoryTransition,
  type AssembleHistoryDirection,
  type AssembleHistoryTransition,
} from "../services/assemble-history-transition-planner";
import type { AssembleSnapshot } from "./assemble-state-types";

const HISTORY_MOTION_DURATION_MS = 360;

export function createAssembleHistoryMotionState(
  onTransition?: (
    direction: AssembleHistoryDirection,
    label: string,
    from: AssembleSnapshot,
    to: AssembleSnapshot
  ) => void
) {
  let transition = $state<AssembleHistoryTransition | null>(null);
  let epoch = $state(0);
  let timer: ReturnType<typeof setTimeout> | null = null;

  function start(
    direction: AssembleHistoryDirection,
    label: string,
    from: AssembleSnapshot,
    to: AssembleSnapshot
  ): void {
    if (timer !== null) clearTimeout(timer);
    transition = createAssembleHistoryTransition(direction, label, from, to);
    epoch += 1;
    onTransition?.(direction, label, from, to);
    timer = setTimeout(() => {
      transition = null;
      timer = null;
    }, HISTORY_MOTION_DURATION_MS);
  }

  function clear(): void {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    transition = null;
  }

  return {
    get transition() {
      return transition;
    },
    get epoch() {
      return epoch;
    },
    start,
    clear,
  };
}
