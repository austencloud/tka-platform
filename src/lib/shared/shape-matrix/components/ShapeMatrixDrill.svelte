<!--
  ShapeMatrixDrill.svelte

  The payoff panel for a clicked shape-matrix cell: the six timing-and-
  direction realizations that draw that mandala (SS/TS/QS/SO/TO/QO), each a
  labeled thumbnail with its element accent and parity badge. Picking one
  crossfades to the hero player — the prop actually drawing that mandala with
  a fading trail.

  Reuses the lab drill's own pipeline (buildModeCards / MODE_ORDER / MODE_LABEL,
  see build-realization-cards.ts) rather than re-deriving it. Differs from the
  lab's ShapeMatrixDrillModal (features/lab/vtg-lab) in host and payoff: this
  is not a modal (the public route hosts it inline; Phase 3 wraps it in
  Drawer), and instead of baked front/back deck-card faces it plays the real
  animation via InlineAnimationPlayer — the actual point of a public
  destination is watching the prop draw the shape, not reviewing a card.

  InlineAnimationPlayer lives under features/browse/sequences/display/... .
  Importing a features/browse component from a shared component already has
  precedent: SequenceHeroDemo.svelte (src/lib/shared/landing/components/) does
  exactly this via the same LazyMount + dynamic-import idiom, and
  SequencePanel.svelte (src/lib/shared/sequence-viewer/components/) imports
  features/browse/creators state directly. InlineAnimationPlayer is itself a
  broadly-shared display primitive (gallery, Arena, guide, now this) despite
  its folder location, not a feature-internal component — so this follows the
  established pattern rather than route-level prop-injection.

  Crossfade: `fill` mode inside `.drill-stage`, a reserved box, per
  .claude/rules/crossfade-primitive.md and no-layout-shift.md — the grid and
  the hero player occupy the same reserved box, so neither the size control
  above nor anything below this component moves when a tile is picked or the
  user goes back.

  Phase 3 re-hosts this component inside a Drawer (bottom sheet on mobile,
  right panel on desktop — see the shape-matrix route). The drawer gives this
  component a fixed-height flex box to fill (`GalleryFilterSheet` idiom), so
  `.drill`/`.drill-stage` are flex-filled here rather than sized off `vh`
  units, which would fight the drawer's own height budget.
-->
<script lang="ts">
  import LazyMount from "$lib/shared/components/LazyMount.svelte";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import { buildModeCards, type ModeCard } from "../services/build-realization-cards";
  import { flowerKey, flowerLabel, type Flower } from "../domain/flower-signature";
  import type { ShapeMatrixData } from "../services/shape-matrix-flowers";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";

  interface Props {
    pair: { blue: Flower; red: Flower };
    data: ShapeMatrixData;
  }
  let { pair, data }: Props = $props();

  let cards = $state<ModeCard[]>([]);
  let loading = $state(true);
  let buildError = $state(false);
  let selected = $state<ModeCard | null>(null);

  // Rebuild the six realizations whenever a new cell is clicked. Reset the
  // hero selection too — a fresh cell always opens back on the grid of six.
  $effect(() => {
    const p = pair;
    loading = true;
    cards = [];
    selected = null;

    const overlay = {
      blue: data.blue.get(flowerKey(p.blue))?.blue ?? [],
      red: data.red.get(flowerKey(p.red))?.red ?? [],
      clubTipDx: data.clubTipDx,
    };

    buildError = false;
    let cancelled = false;
    (async () => {
      try {
        const built = await buildModeCards(p, overlay);
        if (!cancelled) {
          cards = built;
          loading = false;
        }
      } catch (err) {
        // Without this, a rejected build leaves "Building realizations…" up
        // forever with no signal — the exact failure Austen hit on 2026-07-18.
        console.error("shape-matrix drill build failed", err);
        if (!cancelled) {
          buildError = true;
          loading = false;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  });
</script>

<section class="drill" aria-label="Shape matrix realizations">
  <header class="drill-header">
    <h2>
      Blue <span class="flower-label blue">{flowerLabel(pair.blue)}</span> over red
      <span class="flower-label red">{flowerLabel(pair.red)}</span>
    </h2>
    <p class="drill-sub">Six timing-and-direction realizations trace this shape.</p>
  </header>

  <div class="drill-stage">
    <Crossfade key={selected ? selected.mode : "grid"} fill mode="crossfade">
      {#if selected}
        {@const chosen = selected}
        <div class="hero">
          <button type="button" class="back-btn" onclick={() => (selected = null)}>
            <i class="fas fa-arrow-left" aria-hidden="true"></i>
            <span>Back to the six</span>
          </button>
          <div class="hero-player">
            <LazyMount
              loader={() =>
                import(
                  "$lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte"
                )}
              active={true}
              props={{
                sequence: chosen.seq,
                autoPlay: true,
                chrome: "minimal",
                fill: true,
                bluePropType: "club",
                redPropType: "club",
              }}
            />
          </div>
          <p class="hero-caption">
            <span class="mode-label">{chosen.modeLabel}</span>
            <span class="mode-code">{chosen.mode}</span>
            <span class="word">{simplifyRepeatedWord(chosen.word)}</span>
          </p>
        </div>
      {:else if loading}
        <div class="status">Building realizations… first build takes a few seconds.</div>
      {:else if buildError}
        <div class="status">Could not build the realizations for this cell. Reload and try again.</div>
      {:else if cards.length === 0}
        <div class="status">No realizations found for this pair.</div>
      {:else}
        <div class="mode-grid">
          {#each cards as c (c.mode)}
            <button
              type="button"
              class="mode-thumb"
              style="--el: {c.accent}"
              onclick={() => (selected = c)}
            >
              <img class="thumb-img" src={c.frontUrl} alt={`${c.modeLabel} realization`} />
              <span class="thumb-label">{c.modeLabel}</span>
              <span class="thumb-code">{c.mode}</span>
              <span class="thumb-parity" class:ok={c.matched}>
                {#if c.matched}
                  <i class="fas fa-check" aria-hidden="true"></i> match
                {:else}
                  <i class="fas fa-triangle-exclamation" aria-hidden="true"></i> {c.maxDist.toFixed(0)}px
                {/if}
              </span>
            </button>
          {/each}
        </div>
      {/if}
    </Crossfade>
  </div>
</section>

<style>
  /* Fills whatever height its host gives it. Standalone (pre-Phase-3) usage
     had `margin-top` and no fixed parent height, relying on `.drill-stage`'s
     own `vh`-derived height; the Drawer host now provides a fixed-height flex
     box (GalleryFilterSheet idiom), so this flexes to fill it instead. */
  .drill {
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .drill-header {
    margin-bottom: 0.8rem;
    flex-shrink: 0;
  }
  .drill-header h2 {
    font-size: clamp(1.05rem, 1rem + 0.2vw, 1.3rem);
    font-weight: 700;
    color: oklch(0.92 0.02 270);
    margin: 0 0 0.3rem;
  }
  .flower-label.blue {
    color: var(--prop-blue, oklch(0.68 0.14 255));
  }
  .flower-label.red {
    color: var(--prop-red, oklch(0.68 0.16 25));
  }
  .drill-sub {
    margin: 0;
    font-size: clamp(0.82rem, 0.78rem + 0.12vw, 0.95rem);
    color: oklch(0.68 0.02 270);
  }

  /* Fixed-height stage: the grid of six and the hero player share this exact
     box, so switching between them (or clicking Back) never shifts the size
     control or lineage prose around this section (no-layout-shift.md). */
  .drill-stage {
    position: relative;
    flex: 1;
    min-height: 0;
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid oklch(0.4 0.04 270 / 0.16);
    background: #0a0f14;
  }

  .mode-grid {
    height: 100%;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    gap: 0.9rem;
    padding: 1rem;
    align-content: start;
  }

  .mode-thumb {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    padding: 0.7rem;
    min-height: 44px;
    border: 1px solid color-mix(in srgb, var(--el) 40%, transparent);
    border-left: 3px solid var(--el);
    border-radius: 12px;
    background: color-mix(in srgb, var(--el) 7%, transparent);
    color: oklch(0.9 0.02 270);
    font-family: inherit;
    cursor: pointer;
    transition:
      transform 160ms ease,
      background 160ms ease;
  }
  .mode-thumb:hover {
    transform: translateY(-2px);
    background: color-mix(in srgb, var(--el) 14%, transparent);
  }
  .mode-thumb:focus-visible {
    outline: 2px solid var(--el);
    outline-offset: 2px;
  }

  .thumb-img {
    width: 100%;
    aspect-ratio: 5 / 7;
    object-fit: contain;
    border-radius: 6px;
    background: #fff;
  }
  .thumb-label {
    font-size: 0.85rem;
    font-weight: 700;
  }
  .thumb-code {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--el);
  }
  .thumb-parity {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.68rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    padding: 1px 7px;
    border-radius: 6px;
    color: #ffcf8a;
    background: rgba(255, 176, 92, 0.14);
    border: 1px solid rgba(255, 176, 92, 0.5);
  }
  .thumb-parity.ok {
    color: #7ef0b0;
    background: rgba(52, 211, 153, 0.14);
    border-color: rgba(52, 211, 153, 0.5);
  }

  .status {
    height: 100%;
    display: grid;
    place-items: center;
    color: oklch(0.72 0.012 270);
    padding: 1.5rem;
    text-align: center;
  }

  .hero {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 0.8rem;
    gap: 0.6rem;
  }

  /* Real button per clickables-look-like-buttons.md: visible background,
     border, padding, hover state, and the 44px touch-target floor. */
  .back-btn {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 44px;
    padding: 0 1rem;
    font-size: 0.9rem;
    font-weight: 650;
    font-family: inherit;
    color: oklch(0.92 0.02 270);
    background: oklch(0.24 0.03 270 / 0.5);
    border: 1px solid oklch(0.5 0.06 270 / 0.35);
    border-radius: 10px;
    cursor: pointer;
    transition:
      background 160ms ease,
      border-color 160ms ease;
    flex-shrink: 0;
  }
  .back-btn:hover {
    background: oklch(0.3 0.04 270 / 0.6);
    border-color: oklch(0.6 0.08 270 / 0.55);
  }

  .hero-player {
    flex: 1;
    min-height: 0;
    border-radius: 12px;
    overflow: hidden;
  }

  .hero-caption {
    flex-shrink: 0;
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 0.6rem;
    margin: 0;
    font-size: clamp(0.85rem, 0.8rem + 0.1vw, 0.98rem);
    color: oklch(0.85 0.02 270);
  }
  .mode-code {
    color: oklch(0.68 0.02 270);
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .word {
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.06em;
  }

  @media (prefers-reduced-motion: reduce) {
    .mode-thumb,
    .back-btn {
      transition: none;
    }
    .mode-thumb:hover {
      transform: none;
    }
  }
</style>
