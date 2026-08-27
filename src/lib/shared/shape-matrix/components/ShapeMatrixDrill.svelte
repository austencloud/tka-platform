<!--
  ShapeMatrixDrill.svelte

  The elemental drill for a clicked shape-matrix cell: six element-styled VTG
  mode chips (water/earth/sun/fire/air/moon) over a hero stage where the cell's
  mandala renders big and still, then gets traced live by trailing club props
  when an element is picked. One stable screen — no sub-navigation, no card
  thumbnails, no back button. Spec:
  docs/superpowers/specs/2026-07-19-shape-matrix-elemental-drill-design.md

  The hero stage stacks two layers in ONE centered square (the alignment
  contract): a static engine-aligned MandalaHeroLayer canvas underneath, and
  InlineAnimationPlayer on top once an element is active. Both fill the same
  square, so the mandala's hand loci sit exactly under the prop's traced path
  (mandala-hero.ts carries the bake-proven alignment math). Three props make
  the layering actually work — all three are load-bearing:
  - backgroundAlpha: 0 — the player's canvas is TRANSPARENT (alpha context +
    CanvasSurface data-transparent), so the mandala below stays visible while
    the props draw over it. Without this the canvas paints an opaque
    background and "replaces" the mandala (the 2026-07-19 bug).
  - trailSettingsOverride: HERO_TRAIL_PRESET — vivid trail, per-instance,
    never by mutating the global animationSettings singleton.
  - tipEffectMap: HERO_TIP_EFFECT_MAP — the render loop's hasTrailTips gate
    draws ZERO trails without a "trails" tip assignment, whatever the trail
    settings say. Preset and map ship as a pair (see HomeHero).
  The mandala dims to a ghost (opacity 0.55, the bake's value) while the
  props animate over it.

  Element selection is STICKY across cell changes: picking a new cell rebuilds
  the six realizations (cheap — no PNG card bakes on this path, see
  build-mode-realizations.ts) and the active element immediately traces the new
  shape. Re-clicking the active chip deselects back to the still mandala.

  InlineAnimationPlayer lives under features/browse/sequences/display/... .
  Importing a features/browse component from a shared component already has
  precedent: SequenceHeroDemo.svelte (src/lib/shared/landing/components/) does
  exactly this via the same LazyMount + dynamic-import idiom. The {#key} around
  the player remounts it per (mode, pair) — sequences are different objects and
  the player's internal hot-swap is for prop types, not sequence identity.

  The drill owns its own empty state now (pair is nullable): chips disabled,
  "Pick a cell" hint in the hero, caption line reserved but empty — the panel
  structure is constant from load, so first selection causes no layout shift.
-->
<script lang="ts">
  import LazyMount from "$lib/shared/components/LazyMount.svelte";
  import MandalaHeroLayer from "./MandalaHeroLayer.svelte";
  import ElementChipRow from "./ElementChipRow.svelte";
  import {
    buildModeRealizations,
    type ModeRealization,
  } from "../services/build-mode-realizations";
  import {
    flowerKey,
    flowerLabel,
    type Flower,
  } from "../domain/flower-signature";
  import type { ShapeMatrixData } from "../services/shape-matrix-flowers";
  import type { VtgMode } from "../services/shape-matrix-realizations";
  import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import {
    HERO_TRAIL_PRESET,
    HERO_TIP_EFFECT_MAP,
  } from "$lib/shared/landing/data/hero-trail-preset";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";

  interface Props {
    /** Nullable: the drill renders its own "Pick a cell" state before any click. */
    pair: { blue: Flower; red: Flower } | null;
    data: ShapeMatrixData;
    /** Optional composing surface action. The public archive remains a viewer;
     *  pickers can receive the exact realization this drill already built. */
    onselectRealization?: (realization: ModeRealization) => void;
    selectLabel?: string;
  }
  let {
    pair,
    data,
    onselectRealization,
    selectLabel = "Use this realization",
  }: Props = $props();

  // Sticky across pair changes by design (spec: "Selection persistence").
  let selectedMode = $state<VtgMode | null>(null);
  let realizations = $state<ModeRealization[]>([]);
  let building = $state(false);
  let buildError = $state(false);

  const pairKey = $derived(
    pair ? `${flowerKey(pair.blue)}|${flowerKey(pair.red)}` : null
  );

  // The cell's mandala: blue hand's flower merged with red hand's flower — the
  // exact merge renderCell uses for the grid tiles, so the hero IS the cell.
  const heroPaths = $derived.by<MandalaPaths | null>(() => {
    if (!pair) return null;
    return {
      blue: data.blue.get(flowerKey(pair.blue))?.blue ?? [],
      red: data.red.get(flowerKey(pair.red))?.red ?? [],
      purple: [],
    };
  });

  // Build all six eagerly on pair change (cheap without bakes) so element
  // switching is instant; cache per pair so revisiting a cell is free.
  const realizationCache = new Map<string, ModeRealization[]>();

  $effect(() => {
    const p = pair;
    const key = pairKey;
    if (!p || !key) {
      realizations = [];
      return;
    }
    const cached = realizationCache.get(key);
    if (cached) {
      realizations = cached;
      building = false;
      buildError = false;
      return;
    }
    building = true;
    buildError = false;
    realizations = [];
    const overlay = {
      blue: data.blue.get(flowerKey(p.blue))?.blue ?? [],
      red: data.red.get(flowerKey(p.red))?.red ?? [],
      clubTipDx: data.clubTipDx,
    };
    let cancelled = false;
    (async () => {
      try {
        const built = await buildModeRealizations(p, overlay);
        if (!cancelled) {
          realizationCache.set(key, built);
          realizations = built;
          building = false;
        }
      } catch (err) {
        // Without this, a rejected build leaves the chips pointing at nothing
        // with no signal — surface it on the caption line, keep chips usable.
        console.error("shape-matrix elemental drill build failed", err);
        if (!cancelled) {
          buildError = true;
          building = false;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  });

  const activeReal = $derived(
    selectedMode
      ? (realizations.find((r) => r.mode === selectedMode) ?? null)
      : null
  );
  // Mode picked but absent from a completed build (a dropped mode is never
  // substituted) → same caption-line error as a failed build.
  const modeMissing = $derived(
    selectedMode !== null &&
      pair !== null &&
      !building &&
      !buildError &&
      !activeReal
  );

  function elementName(raw: string): string {
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
</script>

<section class="drill" aria-label="Shape matrix realizations">
  <ElementChipRow
    selected={selectedMode}
    disabled={!pair}
    onpick={(m) => (selectedMode = m)}
  />

  <div class="hero-stage">
    <div class="hero-square">
      {#if pair && heroPaths}
        <MandalaHeroLayer
          paths={heroPaths}
          clubTipDx={data.clubTipDx}
          opacity={activeReal ? 0.55 : 1}
        />
        {#if activeReal && pairKey}
          {#key `${activeReal.mode}|${pairKey}`}
            <div class="player-layer">
              <LazyMount
                loader={() =>
                  import("$lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte")}
                active={true}
                props={{
                  sequence: activeReal.seq,
                  autoPlay: true,
                  chrome: "minimal",
                  fill: true,
                  beatIndicators: false,
                  bluePropType: "club",
                  redPropType: "club",
                  trailSettingsOverride: HERO_TRAIL_PRESET,
                  tipEffectMap: HERO_TIP_EFFECT_MAP,
                  backgroundAlpha: 0,
                }}
              />
            </div>
          {/key}
        {/if}
      {:else}
        <div class="hero-hint">
          <p class="hint-lead">Pick a cell</p>
          <p class="hint-sub">
            Its shape opens here. Each element traces it live.
          </p>
        </div>
      {/if}
    </div>
  </div>

  <!-- One reserved caption line: never collapses, so chip picks and cell
       switches shift nothing (no-layout-shift.md). -->
  <p
    class="caption"
    style={activeReal ? `--el: ${activeReal.element.accentColor}` : undefined}
  >
    {#if buildError || modeMissing}
      <span class="cap-err"
        >Could not build this realization. Reload and try again.</span
      >
    {:else if activeReal}
      <span class="cap-element">{elementName(activeReal.element.element)}</span>
      <span class="cap-sep">·</span>
      <span class="cap-tnd">{activeReal.element.name}</span>
      <span class="cap-sep">·</span>
      <span class="cap-word">{simplifyRepeatedWord(activeReal.word)}</span>
    {:else if pair}
      <span>
        Blue <span class="cap-blue">{flowerLabel(pair.blue)}</span> over red
        <span class="cap-red">{flowerLabel(pair.red)}</span>
      </span>
    {/if}
  </p>

  {#if onselectRealization}
    <div class="select-action" class:available={activeReal !== null}>
      <PanelButton
        variant="primary"
        disabled={!activeReal}
        onclick={() => activeReal && onselectRealization(activeReal)}
      >
        <i class="fas fa-person-running" aria-hidden="true"></i>
        {selectLabel}
      </PanelButton>
    </div>
  {/if}
</section>

<style>
  /* Fills whatever height its host gives it: the route's .drill-pane is a
     fixed-height flex box (matched to the matrix stage on wide screens). */
  .drill {
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
    gap: 0.8rem;
  }

  /* The framed stage. container-type: size makes cqw/cqh resolve against this
     box so the square below can take min(height, width) with no JS. */
  .hero-stage {
    position: relative;
    flex: 1;
    min-height: 0;
    display: grid;
    place-items: center;
    container-type: size;
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid oklch(0.4 0.04 270 / 0.16);
    background: #0a0f14;
  }

  /* The shared square: MandalaHeroLayer and the player both fill THIS box, so
     their coordinate frames coincide — that is the alignment contract. */
  .hero-square {
    position: relative;
    aspect-ratio: 1 / 1;
    height: min(100cqh, 100cqw);
  }

  .player-layer {
    position: absolute;
    inset: 0;
  }

  .hero-hint {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    text-align: center;
    gap: 0.3rem;
    padding: 1.5rem;
  }
  .hint-lead {
    margin: 0;
    font-size: clamp(1.05rem, 1rem + 0.2vw, 1.3rem);
    font-weight: 700;
    color: oklch(0.92 0.02 270);
  }
  .hint-sub {
    margin: 0;
    font-size: clamp(0.85rem, 0.8rem + 0.12vw, 0.95rem);
    line-height: 1.55;
    color: oklch(0.68 0.02 270);
  }

  .caption {
    flex-shrink: 0;
    min-height: 1.5em;
    margin: 0;
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 0.45rem;
    font-size: clamp(0.85rem, 0.8rem + 0.1vw, 0.98rem);
    line-height: 1.5;
    text-align: center;
    color: oklch(0.85 0.02 270);
  }
  .select-action {
    flex-shrink: 0;
    min-height: var(--min-touch-target, 44px);
    visibility: hidden;
  }
  .select-action.available {
    visibility: visible;
  }
  .select-action :global(.panel-btn) {
    width: 100%;
  }
  .cap-element {
    font-weight: 700;
    color: var(--el, oklch(0.85 0.02 270));
  }
  .cap-sep {
    color: oklch(0.55 0.015 270);
  }
  .cap-word {
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.06em;
  }
  .cap-err {
    color: #fb8a8a;
  }
  .cap-blue {
    color: var(--prop-blue, oklch(0.68 0.14 255));
  }
  .cap-red {
    color: var(--prop-red, oklch(0.68 0.16 25));
  }
</style>
