<!-- src/lib/features/store/components/CardAnatomy.svelte -->
<script lang="ts">
  /**
   * Front + back of a real Choreo Card for the marketing page.
   * Front = baked print render (Firebase Storage URL from the admin cover
   * bake, instant load). Back = live CardBack render fed the same sequence,
   * so the anatomy can never drift from the real card design.
   *
   * No markers sit on the cards. The page's legend rows drive `highlight`;
   * the matching region gets a spotlight (everything else dims) so the
   * cards stay pristine until the reader asks about a part.
   */
  import { onMount } from "svelte";
  import { loadActiveProducts } from "../services/product-loader";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import CardBack from "$lib/features/choreo-card/components/card-back/CardBack.svelte";
  import { computeFrontRegions } from "../services/card-front-regions";
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type {
    ContextMenuState,
    ContextMenuEntry,
  } from "$lib/shared/components/context-menu/context-menu-types";
  import { composeMenu } from "$lib/shared/components/context-menu/compose-menu";
  import { buildCardMenuSection } from "$lib/shared/choreo-card/services/card-menu-section";
  import { featureFlagService } from "$lib/shared/auth/services/post-hog-feature-flag-service.svelte";

  let {
    highlight = null,
    onhighlight,
  }: { highlight?: string | null; onhighlight?: (id: string | null) => void } = $props();

  // The shown card. First paint uses a real baked cover (instant). Shuffle
  // GENERATES a fresh card at a random count (8/12/16) with a turn pattern, so
  // the reader sees the real variety — different words, mandalas, LOOP types,
  // difficulties, and step counts. The anatomy stays accurate because front
  // regions are computed from the print layout for that step count, and back
  // regions are measured off the live CardBack DOM.
  type Shown = { sequence: SequenceData; frontUrl: string; stepCount: number };
  let shown = $state<Shown | null>(null);
  let shuffling = $state(false);

  const frontRegions = $derived(shown ? computeFrontRegions(shown.stepCount) : null);

  // Admin-only right-click → copy the shown card's sequence data (and the rest
  // of the canonical card admin actions). Non-admins get the native menu. Reuses
  // the shared ContextMenu primitive + buildCardMenuSection — no bespoke menu.
  let menuState = $state<ContextMenuState>({ open: false });
  const menuItems = $derived<ContextMenuEntry[]>(
    shown
      ? composeMenu([
          {
            header: "Card",
            entries: buildCardMenuSection({
              isAdmin: featureFlagService.isAdmin,
              sequenceForImageActions: shown.sequence,
            }),
          },
        ])
      : [],
  );

  function openCardMenu(e: MouseEvent): void {
    // Only hijack right-click for admins with a card in view; otherwise leave the
    // browser's native context menu alone.
    if (!featureFlagService.isAdmin || !shown) return;
    e.preventDefault();
    menuState = { open: true, x: e.clientX, y: e.clientY };
  }

  onMount(async () => {
    try {
      const products = await loadActiveProducts();
      for (const p of products) {
        const baked = (p.coverCards ?? []).find((c) => c.imageUrl && c.sequence);
        if (baked?.imageUrl) {
          shown = {
            sequence: baked.sequence,
            frontUrl: baked.imageUrl,
            stepCount: baked.sequence.steps?.length ?? 8,
          };
          break;
        }
      }
    } catch (error) {
      console.warn("[CardAnatomy] product load failed; keeping text-only anatomy", error);
    }
  });

  const COUNTS = [8, 12, 16] as const;

  async function shuffle() {
    if (shuffling) return;
    shuffling = true;
    try {
      const [{ generationOrchestrator }, gen, circ, grid, prop, renderMod] = await Promise.all([
        import("$lib/shared/create/services/generation-orchestrator"),
        import("$lib/shared/foundation/domain/models/generation/generate-models"),
        import("$lib/shared/foundation/domain/models/generation/circular-models"),
        import("$lib/shared/pictograph/grid/domain/enums/grid-enums"),
        import("$lib/shared/pictograph/prop/domain/enums/prop-type"),
        import("../services/cover-front-renderer"),
      ]);

      const loops = [circ.LOOPType.ROTATED, circ.LOOPType.MIRRORED, circ.LOOPType.SWAPPED, circ.LOOPType.FLIPPED];
      const count = COUNTS[Math.floor(Math.random() * COUNTS.length)]!;
      const loopType = loops[Math.floor(Math.random() * loops.length)]!;
      // Max turn intensity 1, but let ~60% of cards carry a turn pattern.
      const turnIntensity = Math.random() < 0.6 ? 1 : 0;
      const period =
        count % 4 === 0 && Math.random() < 0.5 ? circ.Period.QUARTERED : circ.Period.HALVED;

      const sequence = await generationOrchestrator.generateSequence({
        mode: gen.GenerationMode.CIRCULAR,
        length: count,
        gridMode: grid.GridMode.DIAMOND,
        propType: prop.PropType.STAFF,
        difficulty: gen.DifficultyLevel.INTERMEDIATE,
        propContinuity: gen.PropContinuity.CONTINUOUS,
        turnIntensity,
        loopType,
        period,
      });

      const frontUrl = await renderMod.renderCoverFront(
        { sequence },
        { deckName: "Choreo Cards", propType: prop.PropType.STAFF }
      );

      onhighlight?.(null);
      shown = { sequence, frontUrl, stepCount: sequence.steps?.length ?? count };
    } catch (error) {
      console.error("[CardAnatomy] shuffle generation failed", error);
    } finally {
      shuffling = false;
    }
  }

  // Back regions are measured off the live CardBack DOM at hover time, so
  // they track the real element positions regardless of theme border width
  // or how many LOOP icons this card shows. Multiple matches union (loop-col).
  const BACK_SELECTORS: Record<string, string> = {
    turn: ".corner.top-left",
    reversal: ".corner.top-right",
    mandala: ".mandala-anchor",
    looptype: ".loop-col",
    difficulty: ".level-badge-slot > :first-child",
    startpos: ".corner.bottom-left",
    stepcount: ".corner.bottom-right",
  };

  const PAD = 1; // % breathing room around the measured element

  let backBox: HTMLElement | null = $state(null);

  function measureBack(id: string) {
    const sel = BACK_SELECTORS[id];
    if (!sel || !backBox) return null;
    const els = backBox.querySelectorAll(sel);
    if (els.length === 0) return null;
    const b = backBox.getBoundingClientRect();
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      left = Math.min(left, r.left);
      top = Math.min(top, r.top);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
    }
    return {
      x: ((left - b.left) / b.width) * 100 - PAD,
      y: ((top - b.top) / b.height) * 100 - PAD,
      w: ((right - left) / b.width) * 100 + 2 * PAD,
      h: ((bottom - top) / b.height) * 100 + 2 * PAD,
    };
  }

  const activeRegion = $derived.by(() => {
    if (!highlight) return null;
    const front = frontRegions?.[highlight];
    if (front) return { face: "front" as const, ...front };
    const rg = measureBack(highlight);
    return rg ? { face: "back" as const, ...rg } : null;
  });

  // Reverse direction: pointing at a card part highlights it (and the page's
  // legend row via onhighlight). Same rects the spotlight uses, so the hit
  // zones and the drawn regions can't disagree.
  const inRect = (x: number, y: number, r: { x: number; y: number; w: number; h: number }) =>
    x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

  function pointerPct(e: PointerEvent) {
    const b = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: ((e.clientX - b.left) / b.width) * 100, y: ((e.clientY - b.top) / b.height) * 100 };
  }

  function frontHit(e: PointerEvent) {
    if (!frontRegions) return;
    const p = pointerPct(e);
    for (const [id, rg] of Object.entries(frontRegions)) {
      if (inRect(p.x, p.y, rg)) return onhighlight?.(id);
    }
    onhighlight?.(null);
  }

  function backHit(e: PointerEvent) {
    const p = pointerPct(e);
    for (const id of Object.keys(BACK_SELECTORS)) {
      const rg = measureBack(id);
      if (rg && inRect(p.x, p.y, rg)) return onhighlight?.(id);
    }
    onhighlight?.(null);
  }
</script>

{#snippet spotlight(face: "front" | "back")}
  {#if activeRegion && activeRegion.face === face}
    <div
      class="region"
      style="left: {activeRegion.x}%; top: {activeRegion.y}%; width: {activeRegion.w}%; height: {activeRegion.h}%"
    ></div>
  {/if}
{/snippet}

{#if shown}
  <div class="anatomy-stack">
    <div class="anatomy" class:busy={shuffling}>
    <figure class="face" class:backgrounded={activeRegion && activeRegion.face !== "front"}>
      <!-- Hover affordance only; the legend buttons are the keyboard/AT path. -->
      <div
        class="card-box"
        role="presentation"
        class:dimmable={activeRegion?.face === "front"}
        onpointermove={frontHit}
        onpointerleave={() => onhighlight?.(null)}
        oncontextmenu={openCardMenu}
      >
        <img src={shown.frontUrl} alt="Front of a real Choreo Card" />
        {@render spotlight("front")}
      </div>
      <figcaption>Front</figcaption>
    </figure>

    <figure class="face" class:backgrounded={activeRegion && activeRegion.face !== "back"}>
      <div
        class="card-box back"
        role="presentation"
        bind:this={backBox}
        class:dimmable={activeRegion?.face === "back"}
        onpointermove={backHit}
        onpointerleave={() => onhighlight?.(null)}
        oncontextmenu={openCardMenu}
      >
        <CardBack sequence={shown.sequence} />
        {@render spotlight("back")}
      </div>
      <figcaption>Back</figcaption>
    </figure>
    </div>

    <div class="shuffle-bar">
      <button type="button" class="shuffle-btn" onclick={shuffle} disabled={shuffling}>
        {#if shuffling}
          <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
          <span>Dealing a card…</span>
        {:else}
          <i class="fas fa-shuffle" aria-hidden="true"></i>
          <span>Shuffle another card</span>
        {/if}
      </button>
    </div>
  </div>

  <ContextMenu {menuState} items={menuItems} onClose={() => (menuState = { open: false })} />
{/if}

<style>
  .anatomy-stack {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }

  .anatomy {
    display: flex;
    gap: clamp(1rem, 3vw, 2.5rem);
    justify-content: center;
    flex-wrap: wrap;
    width: 100%;
    transition: opacity 160ms ease;
  }
  .anatomy.busy {
    opacity: 0.55;
  }

  .shuffle-bar {
    display: flex;
    justify-content: center;
  }

  .shuffle-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    min-height: 44px;
    padding: 0.65rem 1.4rem;
    font: inherit;
    font-size: 0.95rem;
    font-weight: 600;
    color: oklch(0.93 0.01 270);
    background: oklch(0.28 0.03 275 / 0.5);
    border: 1px solid oklch(0.6 0.08 275 / 0.35);
    border-radius: 999px;
    cursor: pointer;
    transition:
      background 160ms ease,
      border-color 160ms ease,
      transform 160ms ease;
  }
  .shuffle-btn:hover,
  .shuffle-btn:focus-visible {
    background: oklch(0.34 0.05 275 / 0.6);
    border-color: oklch(0.68 0.12 275 / 0.6);
  }
  .shuffle-btn:active {
    transform: translateY(1px);
  }
  .shuffle-btn:disabled {
    cursor: default;
    opacity: 0.75;
  }
  .shuffle-btn:focus-visible {
    outline: 2px solid oklch(0.7 0.1 275 / 0.7);
    outline-offset: 2px;
  }
  .shuffle-btn i {
    font-size: 0.9rem;
    color: oklch(0.78 0.13 275);
  }
  @media (prefers-reduced-motion: reduce) {
    .shuffle-btn {
      transition: none;
    }
  }

  .face {
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    flex: 1 1 240px;
    transition: opacity 200ms ease;
  }

  /* When the focus is on the other face, this one steps back. */
  .face.backgrounded {
    opacity: 0.45;
  }

  .card-box {
    position: relative;
    width: 100%;
    max-width: 430px;
    aspect-ratio: 5 / 7;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
    /* Hover reveals info about the part under the cursor; clicking does
       nothing. `help` is the honest affordance (pointer would imply a
       navigation that never happens). */
    cursor: help;
  }

  .card-box img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  /* CardBack fills its parent and sizes with container query units. */
  .card-box.back {
    container-type: size;
  }

  /* Spotlight: the region outline plus a huge shadow that dims the rest of
     the card (clipped by the card's overflow:hidden). */
  .region {
    position: absolute;
    border-radius: 10px;
    outline: 1.5px solid oklch(0.95 0.01 270 / 0.9);
    box-shadow: 0 0 0 200vmax oklch(0.08 0.02 270 / 0.55);
    pointer-events: none;
    animation: region-in 180ms ease both;
  }

  @keyframes region-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .region {
      animation: none;
    }
    .face {
      transition: none;
    }
  }

  figcaption {
    font-size: 0.85rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: oklch(0.65 0.02 270);
  }
</style>
