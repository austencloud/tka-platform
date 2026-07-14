<script lang="ts">
  /**
   * One hybrid "stage": the hold-in-hand ChoreoCard paired with a live 2D
   * animation canvas of the same sequence. The canvas sits above the card; the
   * whole stage rings in the sequence-viewer's gold playback glow while it's in
   * view (the `.step-cell.current` recipe — `--semantic-warning`).
   *
   * Scroll-triggered by design: the InlineAnimationPlayer is LAZY-MOUNTED the
   * first time the stage nears the viewport (IntersectionObserver, armed early
   * via rootMargin), so a page can hold many stages without paying for players
   * the reader hasn't scrolled to yet (the player warns about stacking 100+).
   * Once mounted it stays mounted and loops; the gold ring follows live
   * visibility so a row of stages lights up together as it scrolls into frame.
   */
  import { onMount } from "svelte";
  import InlineAnimationPlayer from "$lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte";
  import ChoreoCard from "$lib/features/choreo-card/components/ChoreoCard.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  let {
    sequence,
    propType,
    bpm = 60,
  }: {
    sequence: SequenceData;
    /** Fixed prop family for both hands (STAFF on word/LOOP pages, HAND on motion pages). */
    propType: PropType;
    bpm?: number;
  } = $props();

  let stageEl: HTMLElement | undefined = $state();
  // `near` gates the player MOUNT: true within one screen of the viewport, false
  // once it's more than a screen away. Unmounting offscreen stops the player's
  // rAF loop and frees its canvas, so a page of many stages only runs the ones
  // near the reader (the player warns about stacking 100+). The one-screen buffer
  // is the hysteresis that keeps normal scrolling from mounting/unmounting on
  // every frame. The reserved .canvas-box square stays, so a mount/unmount never
  // shifts the card below it.
  let near = $state(false);
  // Live on-screen visibility — drives the gold playback ring only when the
  // stage is actually in frame (tighter than `near`).
  let inView = $state(false);

  onMount(() => {
    const el = stageEl;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      // No IO (old engines / SSR fallback): just show it playing.
      near = true;
      inView = true;
      return;
    }
    // Mount/unmount gate — one screen of buffer each side.
    const nearIO = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) near = entry.isIntersecting;
      },
      { root: null, rootMargin: "100% 0px", threshold: 0 }
    );
    // Gold-ring gate — actual on-screen presence.
    const viewIO = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) inView = entry.isIntersecting;
      },
      { root: null, rootMargin: "0px", threshold: 0.15 }
    );
    nearIO.observe(el);
    viewIO.observe(el);
    return () => {
      nearIO.disconnect();
      viewIO.disconnect();
    };
  });
</script>

<figure class="card-stage" class:in-view={inView} bind:this={stageEl}>
  <div class="canvas-box">
    {#if near}
      <InlineAnimationPlayer
        {sequence}
        chrome="minimal"
        fill={true}
        autoPlay={true}
        externalBpm={bpm}
        bluePropType={propType}
        redPropType={propType}
      />
    {/if}
  </div>

  <div class="card-box">
    <ChoreoCard
      {sequence}
      bluePropType={propType}
      redPropType={propType}
      showQRCodes={false}
      showNotes={false}
      showLoopGlyph={true}
    />
  </div>
</figure>

<style>
  .card-stage {
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.55rem;
    padding: 0.6rem;
    border-radius: 16px;
    /* Idle: a quiet hairline so the stage reads as a discrete unit; the gold
       ring below overrides border + shadow when it's the active (in-view) one. */
    border: 1.5px solid color-mix(in oklab, var(--ink, #1a1a1a) 12%, transparent);
    transition:
      border-color var(--duration-normal, 260ms) ease,
      box-shadow var(--duration-normal, 260ms) ease,
      background var(--duration-normal, 260ms) ease;
  }

  /* Playing = a calm warm border only. The animating canvas already reads as
     "live", so three of these side by side stay quiet. No glow. */
  .card-stage.in-view {
    border-color: color-mix(in srgb, var(--semantic-warning) 42%, transparent);
  }

  /* The full gold playback glow — the sequence viewer's `.step-cell.current`
     recipe — is reserved for the ONE stage you point at, so only one lights up
     at a time (a real selection, not noise across the whole row). */
  @media (hover: hover) and (pointer: fine) {
    .card-stage:hover {
      border-color: color-mix(in srgb, var(--semantic-warning) 85%, transparent);
      box-shadow:
        0 0 12px color-mix(in srgb, var(--semantic-warning) 38%, transparent),
        0 0 24px color-mix(in srgb, var(--semantic-warning) 16%, transparent);
      background: color-mix(in srgb, var(--semantic-warning) 6%, transparent);
    }
  }

  /* Reserved square for the canvas — mounts/paints without shifting the card
     below it (no-layout-shift). */
  .canvas-box {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    border-radius: 12px;
    overflow: hidden;
    background: color-mix(in oklab, var(--ink, #1a1a1a) 6%, transparent);
  }
  .canvas-box :global(.inline-animation-player) {
    width: 100%;
    height: 100%;
  }

  /* Reserved 5:7 physical-card box — the client-rendered image drops in without
     resizing the stage. */
  .card-box {
    width: 100%;
    aspect-ratio: 5 / 7;
    display: flex;
  }
  .card-box :global(.choreo-card) {
    border-radius: 12px;
  }

  @media (prefers-reduced-motion: reduce) {
    .card-stage {
      transition: none;
    }
  }
</style>
