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
  start.call(document, mutate);
}
