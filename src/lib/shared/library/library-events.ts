/**
 * library-events.ts
 *
 * Cross-module event bus for mutations to a user's saved sequence collection.
 *
 * WHY THIS EXISTS:
 * The sequence viewer drawer lives outside the browse/train/create modules and
 * has no direct reference to their state. When a user deletes a sequence from
 * the viewer, any module that displays the user's sequences needs to reload so
 * stale entries don't remain on screen.
 *
 * HOW IT WORKS:
 * The viewer dispatches `notifyLibraryMutated()` after a destructive operation.
 * Any module that displays the user's sequences subscribes with `onLibraryMutated()`.
 *
 * KNOWN SUBSCRIBERS (update this list when adding a new subscriber):
 * - browse-state-factory.svelte.ts  — reloads the active gallery source
 * - SequenceBrowser.svelte (Train)  — reloads the sequence picker list
 *
 * TO ADD A NEW SUBSCRIBER:
 * 1. In your state factory or component, call `onLibraryMutated(fn)` inside
 *    a `$effect` so it auto-unregisters on component destroy:
 *
 *    $effect(() => onLibraryMutated(() => reloadMyData()));
 *
 * 2. Add your file to the KNOWN SUBSCRIBERS list above.
 */

export const LIBRARY_MUTATED_EVENT = "tka:library-mutated";

/**
 * Dispatch a library mutation notification. Call this after any destructive
 * operation (delete, bulk-delete) that other modules should react to.
 */
export function notifyLibraryMutated(): void {
  window.dispatchEvent(new CustomEvent(LIBRARY_MUTATED_EVENT));
}

/**
 * Subscribe to library mutation notifications. Returns an unsubscribe function.
 * When used inside a Svelte `$effect`, cleanup is automatic.
 *
 * @example
 * $effect(() => onLibraryMutated(() => loadSequences()));
 */
export function onLibraryMutated(handler: () => void): () => void {
  window.addEventListener(LIBRARY_MUTATED_EVENT, handler);
  return () => window.removeEventListener(LIBRARY_MUTATED_EVENT, handler);
}
