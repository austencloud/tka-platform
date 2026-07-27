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
  import { fade } from "svelte/transition";
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
    scene = null,
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
    /** Scene media: the saved entry, rendered live when the tile holds a token.
     *  Only set when the scene carries a performance — a look-only save has no
     *  steps to animate, so it stays a poster (see scene3DHasSteps). */
    scene?: unknown | null;
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

  /** Ambient token from the coordinator (or a hover promotion). */
  let live = $state(false);

  /**
   * Hover shows you whatever you are NOT currently seeing.
   *
   * Autoplay is the default because motion is what distinguishes sequences that
   * look alike as stills. But autoplay also TAKES the choreo card away, and
   * once a tile was playing there was no route back to it — you could not look
   * up a sequence's letters, turns or QR without leaving the page. Hover is
   * that route: on a tile that is playing it holds the card up, and on a tile
   * that is resting it plays the animation (LiveSlots grants the token).
   *
   * One rule, both directions, no extra chrome on the tile.
   */
  let hovered = $state(false);
  let liveAtEnter = $state(false);

  /**
   * Hovering a PLAYING tile reveals its card. This never unmounts the player —
   * it raises the poster floor above the live layer in CSS. Unmounting would
   * tear down and rebuild the whole animation stack on every pointer pass,
   * which is the churn the rest gate exists to prevent; a z-index flip costs
   * nothing and the animation is still running when you move away.
   */
  const revealCard = $derived(hovered && liveAtEnter);

  /** What the user is actually watching, for media with no poster to raise. */
  const showLive = $derived(live && !revealCard);

  function onEnter() {
    liveAtEnter = live;
    hovered = true;
  }
  function onLeave() {
    hovered = false;
  }

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
  class:is-live={showLive}
  class:reveal-card={revealCard}
  use:slots.tile={{ medium, onChange: (next) => (live = next) }}
>
  <!-- Pointer + focus handlers live on the button, not the tile wrapper: it is
       the already-interactive element, so the gesture needs no invented ARIA
       role, and keyboard users get the same reveal by tabbing to it. -->
  <button
    class="stage"
    onclick={onopen}
    onpointerenter={onEnter}
    onpointerleave={onLeave}
    onfocusin={onEnter}
    onfocusout={onLeave}
    aria-label="Open {label}"
  >
    {#if medium === "sequence" && sequence}
      <!-- The poster is a PERMANENT FLOOR, not the other half of a crossfade.
           Swapping poster-out/live-in left the box empty while the player's
           chunk loaded and painted, which is the black card that pulls the eye
           harder than the content does. With the thumbnail always beneath, the
           worst case is a still image — black is unreachable by construction.

           A single enter/exit over a permanent floor is `transition:fade`, not
           `<Crossfade>` (crossfade-primitive.md: a lone enter/exit is not a
           crossfade, and a fake key would make the code lie about intent). -->
      <div class="poster floor">
        <PropAwareThumbnail {sequence} {lightMode} />
      </div>
      {#if live}
        <div class="live-layer" transition:fade={{ duration: DURATION.normal }}>
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
        </div>
      {/if}
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
          animate={showLive}
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

           The stored poster stays underneath for the whole tile lifetime (see
           the sequence branch), so the renderer's mount is never a black box. -->
      {#if poster}
        <img class="poster-img floor" src={poster} alt={label} loading="lazy" />
      {:else}
        <div class="poster floor empty">No preview</div>
      {/if}
      {#if live}
        <div class="live-layer" transition:fade={{ duration: DURATION.normal }}>
          <LazyMount
            loader={() =>
              import(
                "$lib/features/tunnel-collection/components/TunnelDetailPreview.svelte"
              )}
            active
            props={{ tunnel }}
          />
        </div>
      {/if}
    {:else if medium === "scene" && scene}
      <!-- Scene3DPreview mounts the real Viewer3DCanvas from a construction
           seed, so it reads and writes none of the user's global viewer state —
           the property that lets several of these coexist at all. Its camera
           orbits on its own, since a tile is watched rather than driven.

           Same permanent-floor shape as the tunnel branch, and it matters most
           here: a WebGL context plus a GLB environment is the slowest thing on
           the page to first paint, so this is the tile that would show black
           longest. Revoking still tears the canvas down — the floor is an
           image, not a retained renderer. -->
      {#if poster}
        <img class="poster-img floor" src={poster} alt={label} loading="lazy" />
      {:else}
        <div class="poster floor empty">No preview</div>
      {/if}
      {#if live}
        <div class="live-layer" transition:fade={{ duration: DURATION.normal }}>
          <LazyMount
            loader={() =>
              import(
                "$lib/features/scene-3d-collection/components/Scene3DPreview.svelte"
              )}
            active
            props={{ scene }}
          />
        </div>
      {/if}
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
  /* Every measure here is `em`, not `rem`: the stage rides a container-query
     font ramp (the same one CreatorsPanel's roster uses), so one declaration
     on the ancestor scales type, gaps and radii together. A `rem` here would
     freeze at 1080p proportions while its neighbours grew — the exact 4K
     failure 4k-native-layout.md describes. */
  .tile {
    display: flex;
    flex-direction: column;
    gap: 0.5em;
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
    border-radius: 0.75em;
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

  /* The floor fills the stage and never leaves. The live layer sits directly
     on top of it, so there is no moment where the tile has nothing in it. */
  .floor {
    position: absolute;
    inset: 0;
  }

  .live-layer {
    position: absolute;
    inset: 0;
    z-index: 1;
  }

  /* Hover on a playing tile lifts the card back over the animation. The player
     keeps running underneath — no remount, and letting go returns you to the
     motion mid-stride. */
  .tile.reveal-card .floor {
    z-index: 2;
  }

  .poster-img {
    object-fit: cover;
  }

  .poster.empty {
    color: var(--theme-text-dim);
    font-size: 0.8125em;
  }

  .meta {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5em;
    min-width: 0;
  }

  .label {
    font-size: 0.9375em;
    font-weight: 600;
    color: var(--theme-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .kind {
    font-size: 0.6875em;
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
    border-radius: 0.5em;
  }

  /* Short-landscape (Z Fold folded, 960x412): a 1:1 tile is taller than the
     viewport, so one tile fills the screen and clips. Cap by viewport height
     instead — the stage stays a stage, it just stops being square. */
  @media (max-height: 560px) {
    .stage {
      aspect-ratio: auto;
      height: 46vh;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .stage,
    .stage:hover {
      transition: none;
      transform: none;
    }
  }
</style>
