/**
 * useSortable - Svelte 5 hook for SortableJS integration
 *
 * A battle-tested approach using SortableJS which handles all edge cases
 * including positioning inside modals with CSS transforms.
 *
 * Based on: https://dev.to/jdgamble555/svelte-5-and-sortablejs-5h6j
 */

import Sortable from "sortablejs";

/**
 * Creates a SortableJS instance attached to an element.
 * Automatically cleans up on component unmount.
 *
 * @param getter - Function that returns the target element (or null)
 * @param options - SortableJS options
 */
export function useSortable(
  getter: () => HTMLElement | null,
  options?: Sortable.Options
): void {
  $effect(() => {
    const sortableEl = getter();

    if (!sortableEl) {
      // Element not available yet - effect will re-run when it becomes available
      return;
    }

    console.log("[useSortable] Creating Sortable instance on:", sortableEl);

    const sortable = Sortable.create(sortableEl, {
      ...options,
      // Debug callbacks to verify SortableJS is working
      onStart: (evt) => {
        console.log("[useSortable] Drag started", evt);
        options?.onStart?.(evt);
      },
      onMove: (evt, originalEvent) => {
        console.log("[useSortable] Drag move", evt);
        return options?.onMove?.(evt, originalEvent);
      },
      onEnd: (evt) => {
        console.log("[useSortable] Drag ended", evt);
        options?.onEnd?.(evt);
      },
    });

    console.log("[useSortable] Sortable instance created:", sortable);

    return () => {
      console.log("[useSortable] Destroying Sortable instance");
      sortable.destroy();
    };
  });
}

/**
 * Reorders an array based on a SortableJS drag event.
 * Works with both $state arrays and regular arrays.
 *
 * @param array - The array to reorder
 * @param evt - The SortableJS event containing oldIndex and newIndex
 * @returns A new reordered array
 */
export function reorder<T>(
  array: T[],
  evt: Sortable.SortableEvent
): T[] {
  // Create a working copy using $state.snapshot to handle reactive arrays
  const workArray = $state.snapshot(array) as T[];
  const { oldIndex, newIndex } = evt;

  if (oldIndex === undefined || newIndex === undefined) {
    return workArray;
  }

  if (newIndex === oldIndex) {
    return workArray;
  }

  // Remove the item from old position and insert at new position
  const [movedItem] = workArray.splice(oldIndex, 1);
  workArray.splice(newIndex, 0, movedItem);

  return workArray;
}
