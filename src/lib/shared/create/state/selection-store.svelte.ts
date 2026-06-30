/**
 * Selection Store — scoped, per-instance selection of sequence steps by id.
 *
 * Replaces the `isSelected` flag formerly stored on StepData (sequence-engine
 * unification Phase 2 / sub-migration A — see
 * docs/superpowers/specs/active/2026-06-30-stepdata-step-migration-scope.md).
 * Selection is UI/view state, not sequence content, so it lives here keyed by
 * step id — letting the same sequence open in multiple panels with independent
 * selection, and keeping saved sequences free of transient UI state.
 *
 * Factory form (not a module singleton, unlike selected-arrow-state.svelte.ts)
 * so each surface owns its own selection; follows the runes-factory + getter
 * convention used across the create module.
 */

export interface SelectionStore {
  /** Reactive set of currently-selected step ids. */
  readonly selectedIds: ReadonlySet<string>;
  /** Select a step. Replaces the current selection unless `additive` is set. */
  select(id: string, options?: { additive?: boolean }): void;
  /** Remove a single id from the selection. No-op if not selected. */
  deselect(id: string): void;
  /** Clear the entire selection. */
  clear(): void;
  /** True when `id` is currently selected. */
  isSelected(id: string): boolean;
}

export function createSelectionStore(): SelectionStore {
  const ids = $state(new Set<string>());
  return {
    get selectedIds() {
      return ids;
    },
    select(id: string, options?: { additive?: boolean }) {
      if (!options?.additive) ids.clear();
      ids.add(id);
    },
    deselect(id: string) {
      ids.delete(id);
    },
    clear() {
      ids.clear();
    },
    isSelected(id: string) {
      return ids.has(id);
    },
  };
}
