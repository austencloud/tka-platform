export interface MultiSelectionStateDependencies {
  getAllIds: () => readonly string[];
  onModeChange?: (active: boolean) => void;
}

/**
 * Shared selection-mode state for galleries.
 *
 * The host supplies the current selectable ids so "Select all" follows the
 * visible result set instead of holding a stale copy from first render.
 */
export function createMultiSelectionState(
  dependencies: MultiSelectionStateDependencies
) {
  let active = $state(false);
  let selectedIds = $state<Set<string>>(new Set());

  function enter(initialId?: string): void {
    const wasActive = active;
    active = true;
    selectedIds = initialId ? new Set([initialId]) : new Set();
    if (!wasActive) dependencies.onModeChange?.(true);
  }

  function exit(): void {
    const wasActive = active;
    active = false;
    selectedIds = new Set();
    if (wasActive) dependencies.onModeChange?.(false);
  }

  function toggle(id: string): void {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds = next;
  }

  function selectAll(): void {
    selectedIds = new Set(dependencies.getAllIds());
  }

  function clear(): void {
    selectedIds = new Set();
  }

  return {
    get active() {
      return active;
    },
    get selectedIds() {
      return selectedIds;
    },
    get selectedCount() {
      return selectedIds.size;
    },
    enter,
    exit,
    toggle,
    selectAll,
    clear,
  };
}

export type MultiSelectionState = ReturnType<typeof createMultiSelectionState>;
