<!--
  ArtifactTile — one profile tile, routed by medium.

  Every tile is a fixed-aspect stage that reserves its box before anything
  loads, so granting or revoking a live token never moves a neighbour
  (no-layout-shift.md). The poster/live swap goes through the shared
  `Crossfade` primitive in `fill` mode — the tile IS a sized stage, which is
  exactly the case the default content-sized mode gets wrong
  (crossfade-primitive.md).

  The remount on key flip is deliberate here, not a cost to avoid: revoking a
  token has to actually tear the animation stack down. `LazyMount` alone keeps
  its child mounted forever after first activation, so the AnimationLoop would
  keep running off screen and the budget would mean nothing.
-->
<script lang="ts">
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import LazyMount from "$lib/shared/components/LazyMount.svelte";
  import PropAwareThumbnail from "$lib/shared/browse/components/PropAwareThumbnail.svelte";
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import type { LiveSlots, Medium } from "./live-slots.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  let {
    slots,
    medium,
    title,
    sequence = null,
    poster = null,
    tunnel = null,
    mandala = null,
    lightMode = false,
    size = "md",
    onopen,
  }: {
    slots: LiveSlots;
    medium: Medium;
    title: string;
    /** Sequence media: the notation to animate. */
    sequence?: SequenceData | null;
    /** Scene / tunnel media: the stored WebP poster. */
    poster?: string | null;
    /** Tunnel media: the saved entry, replayed live when the tile holds a token. */
    tunnel?: unknown | null;
    /** Mandala media: everything CollectedMandala carries. */
    mandala?: {
      steps: unknown[];
      variant: "blue" | "red" | "both";
      bluePropType?: string;
      redPropType?: string;
      pathShape?: "arc" | "linear" | "concave" | "hybrid";
    } | null;
    lightMode?: boolean;
    size?: "sm" | "md" | "lg";
    onopen?: () => void;
  } = $props();

  let live = $state(false);

  // A LOOP word repeats by construction, so the raw field is routinely
  // FΨFΨFΨFΨ where the only correct display is FΨ
  // (.claude/rules/simplified-word-display.md).
  //
  // Saved collection entries predate that rule: real 3D-scene names in this
  // account read "FΨFΨFΨFΨ — 3D scene", so the repeated word is a TOKEN inside
  // a longer name and a whole-string simplify is a no-op. Simplify per token,
  // which fixes both the bare-word and the embedded-word case. The underlying
  // stored name is still wrong and wants a data repair.
  const label = $derived(
    (title || "")
      .split(/(\s+)/)
      .map((part) => (part.trim() ? simplifyRepeatedWord(part) || part : part))
      .join("") || "Untitled"
  );

  const mediumLabel: Record<Medium, string> = {
    sequence: "Sequence",
    mandala: "Mandala",
    scene: "3D scene",
    tunnel: "Tunnel",
  };
</script>

<div
  class="tile size-{size}"
  class:is-live={live}
  use:slots.tile={{ medium, onChange: (next) => (live = next) }}
>
  <button class="stage" onclick={onopen} aria-label="Open {label}">
    {#if medium === "sequence" && sequence}
      <Crossfade key={live} fill duration={DURATION.normal}>
        {#if live}
          <LazyMount
            loader={() =>
              import(
                "$lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte"
              )}
            active
            props={{
              sequence,
              autoPlay: true,
              showControls: false,
              chrome: "minimal",
              fill: true,
              interactive: false,
              disableContextMenu: true,
              beatIndicators: false,
              hideStepNumbers: true,
            }}
          />
        {:else}
          <div class="poster">
            <PropAwareThumbnail {sequence} {lightMode} />
          </div>
        {/if}
      </Crossfade>
    {:else if medium === "mandala" && mandala}
      <!-- No stored poster on CollectedMandala — it always renders from steps.
           `animate` is the only thing the token gates, so there is nothing to
           crossfade and nothing to remount. -->
      <div class="poster">
        <SequenceMandala
          sequence={{ steps: mandala.steps }}
          mode="gallery"
          show={mandala.variant}
          bluePropType={mandala.bluePropType}
          redPropType={mandala.redPropType}
          pathShape={mandala.pathShape ?? "arc"}
          animate={live}
          darkMode={!lightMode}
          size={320}
        />
      </div>
    {:else if medium === "tunnel" && tunnel}
      <!-- TunnelDetailPreview mounts the real kaleidoscope renderer with a
           fully per-instance seam (local controller, persist:false effects, and
           capture/restore around the three globals TunnelArtView reads). That
           sandbox is what makes it safe to mount N of them in a gallery — a
           preview must never mutate the user's live viewer state.

           The poster is the resting state, so the box is filled from first
           paint and the token swap costs no layout (no-layout-shift.md). -->
      <Crossfade key={live} fill duration={DURATION.normal}>
        {#if live}
          <LazyMount
            loader={() =>
              import(
                "$lib/features/tunnel-collection/components/TunnelDetailPreview.svelte"
              )}
            active
            props={{ tunnel }}
          />
        {:else if poster}
          <img class="poster-img" src={poster} alt={label} loading="lazy" />
        {:else}
          <div class="poster empty">No preview</div>
        {/if}
      </Crossfade>
    {:else if poster}
      <img class="poster-img" src={poster} alt={label} loading="lazy" />
    {:else}
      <div class="poster empty">No preview</div>
    {/if}
  </button>

  <footer class="meta">
    <span class="label">{label}</span>
    <span class="kind" class:live>{mediumLabel[medium]}</span>
  </footer>
</div>

<style>
  .tile {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
  }

  .stage {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    display: block;
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--theme-stroke);
    border-radius: 0.75rem;
    background: var(--theme-card-bg);
    cursor: pointer;
    transition:
      border-color var(--duration-normal) ease,
      transform var(--duration-normal) ease;
  }

  .stage:hover {
    border-color: var(--theme-stroke-strong);
    transform: translateY(-2px);
  }

  .tile.is-live .stage {
    border-color: color-mix(in srgb, var(--theme-accent) 55%, transparent);
  }

  .poster,
  .poster-img {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .poster-img {
    object-fit: cover;
  }

  .poster.empty {
    color: var(--theme-text-dim);
    font-size: 0.8125rem;
  }

  .meta {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    min-width: 0;
  }

  .label {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--theme-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .kind {
    font-size: 0.6875rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--theme-text-dim);
    white-space: nowrap;
    /* Reserved by the widest state so flipping to live never nudges the
       label (no-layout-shift.md). */
    transition: color var(--duration-normal) ease;
  }

  .kind.live {
    color: var(--theme-accent);
  }

  .size-sm .stage {
    border-radius: 0.5rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .stage,
    .stage:hover {
      transition: none;
      transform: none;
    }
  }
</style>
