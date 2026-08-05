/**
 * claimedViewTransitionName — a Svelte action that stamps a
 * `view-transition-name` only when this element is the one that owns it.
 *
 * The View Transitions API aborts the whole transition with InvalidStateError
 * if two elements carry the same name at capture time, and TKA legitimately
 * mounts the same logical element twice for a beat: a crossfade keeps the
 * outgoing screen alive while the incoming one paints. Routing every stamp
 * through the name registry means the copy that is on its way out quietly
 * gives the name up and the incoming copy takes it — the morph keeps working
 * instead of silently dying.
 *
 * `enabled: false` releases the claim immediately, which is how a surface
 * hands its names to the surface replacing it.
 */
import { claimViewTransitionName } from "./view-transition-name-registry";

export interface ClaimedViewTransitionNameParams {
  /** The name to claim. Must be unique per logical element per document. */
  name: string;
  /** False releases the claim and clears the stamp. Defaults to true. */
  enabled?: boolean;
}

export function claimedViewTransitionName(
  node: HTMLElement,
  params: ClaimedViewTransitionNameParams
) {
  let release: (() => void) | null = null;

  function apply(next: ClaimedViewTransitionNameParams): void {
    release?.();
    release = null;
    node.style.viewTransitionName = "";

    if (next.enabled === false || !next.name) return;
    release = claimViewTransitionName(next.name, (granted) => {
      node.style.viewTransitionName = granted ? next.name : "";
    });
  }

  apply(params);

  return {
    update(next: ClaimedViewTransitionNameParams) {
      apply(next);
    },
    destroy() {
      release?.();
      release = null;
    },
  };
}
