/**
 * library-events.ts
 *
 * Lets different parts of the app react when a sequence is deleted.
 *
 * THE PROBLEM:
 * The sequence detail panel (the drawer that slides open when you tap a sequence)
 * has a delete button. When you delete a sequence there, any other screen that's
 * showing that same sequence needs to remove it from its list — otherwise the
 * deleted sequence stays visible until the next page refresh.
 *
 * The detail panel has no direct connection to those other screens, so it can't
 * just tell them directly.
 *
 * THE SOLUTION:
 * The detail panel shouts "a sequence was deleted" into a shared channel after
 * a delete. Any screen that cares listens to that channel and removes the deleted
 * sequence from its own list when it hears the message.
 *
 * SCREENS THAT CURRENTLY LISTEN:
 * - browse-state-factory.svelte.ts  — the Browse gallery
 * - SequenceBrowser.svelte (Train)  — the sequence picker in Train mode
 *
 * TO ADD A NEW LISTENER:
 * 1. Call `onLibraryMutated(fn)` inside a `$effect` in your component or state file.
 *    The $effect ensures the listener is cleaned up when the screen is closed.
 *
 *    $effect(() => onLibraryMutated((sequenceId) => removeFromMyList(sequenceId)));
 *
 * 2. Add your file to the SCREENS THAT CURRENTLY LISTEN list above.
 */

export const LIBRARY_MUTATED_EVENT = "tka:library-mutated";

/**
 * Call this after deleting a sequence. Any screen that's showing that sequence
 * will hear about it and remove it from its list.
 */
export function notifyLibraryMutated(sequenceId: string): void {
  window.dispatchEvent(
    new CustomEvent(LIBRARY_MUTATED_EVENT, { detail: { sequenceId } })
  );
}

/**
 * Listen for deleted sequences. The handler is called with the deleted sequence's ID
 * so you can remove it from your list. Returns a function that stops listening —
 * inside a $effect this cleanup runs automatically when the screen is closed.
 *
 * @example
 * $effect(() => onLibraryMutated((sequenceId) => removeFromList(sequenceId)));
 */
export function onLibraryMutated(
  handler: (sequenceId: string) => void
): () => void {
  const listener = (e: Event) => {
    const sequenceId = (e as CustomEvent<{ sequenceId: string }>).detail
      .sequenceId;
    handler(sequenceId);
  };
  window.addEventListener(LIBRARY_MUTATED_EVENT, listener);
  return () => window.removeEventListener(LIBRARY_MUTATED_EVENT, listener);
}
