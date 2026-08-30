import { untrack } from "svelte";

/**
 * Keep-alive visibility for a split-pane content overlay (Card / Videos /
 * Mandala / Tunnel panes in ViewerSplitPane).
 *
 * Once the user opens a pane it stays mounted for the rest of the session —
 * switching back to it is instant instead of paying a full teardown+rebuild.
 * Visibility is a separate flag: the pane mounts hidden and is revealed on the
 * next animation frame so its fade-in transition actually plays (adding the
 * element already-visible would skip the CSS transition).
 */
export interface PaneKeepAlive {
  /** True once the pane has ever been active — it never unmounts after that. */
  readonly mounted: boolean;
  /** Drives the pane's hidden class (fades out instead of unmounting). */
  readonly shown: boolean;
  /** Live "is this pane the selected content right now" flag. */
  readonly active: boolean;
}

export function createPaneKeepAlive(
  isActive: () => boolean,
  isReady: () => boolean = () => true
): PaneKeepAlive {
  let mounted = $state(false);
  let shown = $state(false);
  const active = $derived.by(isActive);

  $effect(() => {
    const ready = isReady();
    if (active) {
      // `mounted` is read untracked: the first activation writes it, and a
      // tracked read would re-trigger this effect into the else-branch below,
      // revealing the pane in the same flush it mounts — which skips the
      // fade-in entirely.
      if (untrack(() => mounted)) {
        shown = ready;
      } else {
        mounted = true;
        if (!ready) return;
        // The pane can be deselected again before this frame fires — the /q
        // scan page does exactly that: it boots on whatever view the phone
        // last used (say, Tunnel), then immediately resets to the split view.
        // Revealing unconditionally here left that stale pane painted over
        // the split view until the user toggled views by hand. Only reveal
        // if the pane is still the selected content when the frame arrives.
        requestAnimationFrame(() => {
          if (isActive()) shown = true;
        });
      }
    } else {
      shown = false;
    }
  });

  return {
    get mounted() {
      return mounted;
    },
    get shown() {
      return shown;
    },
    get active() {
      return active;
    },
  };
}
