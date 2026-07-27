/**
 * LiveSlots — the liveness coordinator prototype from
 * `docs/superpowers/specs/2026-07-26-profile-as-stage-design.md`.
 *
 * Every expensive tile on the profile registers here with its medium. One
 * IntersectionObserver tracks which tiles are on screen; on every scroll frame
 * the visible tiles are ranked by distance from the viewport centre and the
 * top N per medium are granted a live token. Everything else renders its
 * poster.
 *
 * Single owner by design. Three bands each running their own observer would
 * race for the GPU — the archive band alone can register hundreds of tiles,
 * and `activate-when-near` is one-shot (activate, never revoke) so it cannot
 * express a budget that has to be handed back on scroll.
 *
 * Tiles receive their status through a callback rather than reading a reactive
 * map: a Map keyed by element would re-run every tile's effect on every scroll
 * frame, which is exactly the cost this class exists to bound.
 */

export type Medium = "sequence" | "mandala" | "scene" | "tunnel";

export const MEDIA: readonly Medium[] = ["sequence", "mandala", "scene", "tunnel"];

interface Slot {
  readonly medium: Medium;
  readonly onChange: (live: boolean) => void;
  visible: boolean;
  distance: number;
  live: boolean;
}

/** Starting budgets. Tunable live on the test page — these are guesses until
 *  measured, which is the whole point of the prototype. */
export const DEFAULT_BUDGETS: Record<Medium, number> = {
  sequence: 6,
  mandala: 8,
  // Scene3DPreview provides the sandbox: a seeded viewer-3d context per tile,
  // reading and writing no global state, so tiles can coexist. Each live tile
  // is a full WebGL context with its own environment — by far the most
  // expensive thing on this page — so this starts at 2, the smallest budget
  // that can actually prove concurrency works. Tune it with the on-page
  // controls; this is the number most likely to move once measured on a real GPU.
  scene: 2,
  // Tunnels DO have one: TunnelDetailPreview mounts the real renderer behind a
  // per-instance seam. Deliberately small — TunnelArtView can route trails
  // through the WebGL2 overlay, so this is the budget most likely to need
  // lowering once measured. Tune it with the on-page controls.
  tunnel: 2,
};

export class LiveSlots {
  /** Live-tunable so the page can expose sliders. */
  budgets = $state<Record<Medium, number>>({ ...DEFAULT_BUDGETS });

  /** Observed counts, for the on-page readout. */
  liveCount = $state<Record<Medium, number>>({
    sequence: 0,
    mandala: 0,
    scene: 0,
    tunnel: 0,
  });

  #slots = new Map<Element, Slot>();
  #observer: IntersectionObserver | null = null;
  #frame = 0;
  #onScroll = () => this.schedule();

  /** Svelte action: `<div use:slots.tile={{ medium, onChange }}>`. */
  tile = (
    node: HTMLElement,
    params: { medium: Medium; onChange: (live: boolean) => void }
  ) => {
    this.#ensureObserver();
    this.#slots.set(node, {
      medium: params.medium,
      onChange: params.onChange,
      visible: false,
      distance: Number.POSITIVE_INFINITY,
      live: false,
    });
    this.#observer?.observe(node);
    this.schedule();

    return {
      destroy: () => {
        this.#observer?.unobserve(node);
        this.#slots.delete(node);
        this.schedule();
      },
    };
  };

  /** Recompute after a budget change, a band toggle, or a content swap. */
  schedule() {
    if (this.#frame) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      this.#recompute();
    });
  }

  destroy() {
    this.#observer?.disconnect();
    this.#observer = null;
    if (this.#frame) cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    this.#slots.clear();
    window.removeEventListener("scroll", this.#onScroll);
    window.removeEventListener("resize", this.#onScroll);
  }

  #ensureObserver() {
    if (this.#observer || typeof IntersectionObserver === "undefined") return;

    // A generous margin so a tile has already claimed (or been denied) its
    // token before it is actually looked at — the swap from poster to live
    // never happens under the user's eye mid-scroll.
    this.#observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const slot = this.#slots.get(entry.target);
          if (slot) slot.visible = entry.isIntersecting;
        }
        this.schedule();
      },
      { rootMargin: "240px 0px" }
    );

    window.addEventListener("scroll", this.#onScroll, { passive: true });
    window.addEventListener("resize", this.#onScroll, { passive: true });
  }

  #recompute() {
    const centre = window.innerHeight / 2;
    const ranked: Record<Medium, Slot[]> = {
      sequence: [],
      mandala: [],
      scene: [],
      tunnel: [],
    };

    for (const [node, slot] of this.#slots) {
      if (!slot.visible) {
        slot.distance = Number.POSITIVE_INFINITY;
        continue;
      }
      const box = node.getBoundingClientRect();
      slot.distance = Math.abs(box.top + box.height / 2 - centre);
      ranked[slot.medium].push(slot);
    }

    const counts: Record<Medium, number> = {
      sequence: 0,
      mandala: 0,
      scene: 0,
      tunnel: 0,
    };

    for (const medium of MEDIA) {
      const group = ranked[medium];
      group.sort((a, b) => a.distance - b.distance);
      const budget = this.budgets[medium];

      group.forEach((slot, index) => {
        const live = index < budget;
        if (live) counts[medium]++;
        if (slot.live !== live) {
          slot.live = live;
          slot.onChange(live);
        }
      });
    }

    // Slots that scrolled out entirely still hold a stale token.
    for (const slot of this.#slots.values()) {
      if (!slot.visible && slot.live) {
        slot.live = false;
        slot.onChange(false);
      }
    }

    this.liveCount = counts;
  }
}
