/**
 * Same-document View Transitions wrapper (Baseline 2025). Not router
 * navigation — SvelteKit onNavigate does not apply to component-state screen
 * changes. Skips under prefers-reduced-motion (the API does not honor it
 * natively).
 */
export function withViewTransition(mutate: () => void): void {
  const reduced =
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  const start = (document as Document & {
    startViewTransition?: (cb: () => void) => unknown;
  }).startViewTransition;
  if (reduced || typeof start !== "function") {
    mutate();
    return;
  }
  const transition = start.call(document, mutate) as
    | { ready?: Promise<void> }
    | undefined;
  // A skipped transition rejects `ready`; unhandled, that becomes a console
  // error and a PostHog $exception.
  transition?.ready?.catch(() => {});
}
