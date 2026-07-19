<!--
  SequenceHeroDemo

  A live sequence embed for public marketing pages: a real SequenceData
  object playing in the standalone InlineAnimationPlayer with minimal chrome.
  Originated as /composer's ComposerHeroDemo (hardcoded to the CΨΩX fixture);
  generalized so any public page can drop in its own sequence + caption note
  without re-deriving the LazyMount/aspect-ratio/idle-activation plumbing.

  The player chunk is heavy (whole animation engine), so it goes through
  LazyMount and only starts importing after hydration hits idle. The stage
  box is fixed with aspect-ratio so the prose below never shifts when the
  player mounts (no-layout-shift rule).

  The LazyMount below is NOT keyed on the sequence id. InlineAnimationPlayer
  already reloads its own animation in place whenever its `sequence` prop's
  id changes (its own $effect, InlineAnimationPlayer.svelte:365-381) — no
  remount needed. LazyMount forwards prop updates into an already-mounted
  child reactively (proven by existing load-bearing usages: GeneratePanel
  reads a live `isDesktop` through it, CreationWorkspaceArea reads live
  `animatingStepNumber`/`currentDisplayWord` through it — both would be
  visibly frozen after first mount if LazyMount's `{...props}` spread wasn't
  reactive). Keying here would remount the whole player — and the whole
  animation engine chunk-load again — on every reroll/act advance instead of
  swapping a prop.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import LazyMount from "$lib/shared/components/LazyMount.svelte";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { TrailSettings } from "$lib/shared/animation-engine/domain/types/trail-types";
  import type { TipEffectMap } from "$lib/shared/animation-engine/domain/types/tip-effect-types";

  let {
    sequence,
    note,
    bluePropType,
    redPropType,
    onReroll,
    rerolling = false,
    onLoopComplete,
    trailSettingsOverride = null,
    tipEffectMap = undefined,
    externalBpm,
  }: {
    /** Null while the host is still producing the sequence (e.g. /composer's
        per-visit generated demo) — the stage box and caption line keep their
        reserved footprint and the player mounts when it lands. */
    sequence: SequenceData | null;
    note: string;
    /** Optional prop-type override so per-prop pages can render the same
        sequence with fans/clubs/buugeng instead of the default staves. */
    bluePropType?: string;
    redPropType?: string;
    /** When provided, a dice button appears that asks the host to swap in a
        freshly generated sequence in place (no page reload). Notation pages
        omit it, so their static demo is unchanged. */
    onReroll?: () => void;
    /** Host-owned in-flight flag while a reroll generates. */
    rerolling?: boolean;
    /** Forwarded to InlineAnimationPlayer. The homepage hero attract act
        wires this to advance its walk on every loop wraparound; every other
        host omits it and pays no cost (InlineAnimationPlayer no-ops when
        absent). */
    onLoopComplete?: () => void;
    /** Forwarded to InlineAnimationPlayer. Null (default) keeps today's
        behavior for every host that omits it: the global trail settings
        singleton. The hero passes its own vivid preset here instead of
        mutating that singleton (which the in-app Compose panel also reads). */
    trailSettingsOverride?: TrailSettings | null;
    /** Forwarded to InlineAnimationPlayer. Trails only render for tips with a
        "trails" assignment (the render loop's hasTrailTips gate) — the hero
        passes a cell-wide map; hosts that omit it get no trails, as before. */
    tipEffectMap?: TipEffectMap;
    /** Forwarded to InlineAnimationPlayer to pin playback tempo externally.
        The hero pins this at 60 so a visitor's persisted Compose speed can't
        skew the marketing surface. Omit to use the player's own default. */
    externalBpm?: number | null;
  } = $props();

  const word = $derived(sequence ? simplifyRepeatedWord(sequence.word) : "");

  let active = $state(false);

  onMount(() => {
    // Static prerendered page: let the prose paint first, then pull the engine.
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => (active = true), { timeout: 2500 });
    } else {
      setTimeout(() => (active = true), 300);
    }
  });
</script>

<div class="hero-demo">
  <figure class="demo-figure">
    <div class="demo-stage">
      <!-- Not keyed on sequence id — the mounted player reloads onto a new
           sequence in place (see script comment above). The aspect-ratio box
           holds constant regardless, so no layout shift either way. -->
      <LazyMount
        loader={() =>
          import(
            "$lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte"
          )}
        active={active && !!sequence}
        props={{
          sequence,
          autoPlay: true,
          chrome: "minimal",
          fill: true,
          bluePropType,
          redPropType,
          onLoopComplete,
          trailSettingsOverride,
          tipEffectMap,
          externalBpm: externalBpm ?? null,
        }}
      />
    </div>
    <!-- Line is always reserved; it becomes visible only once the word is
         known, so the note never shifts sideways when the word lands. Only
         the word crossfades (it's the part that actually changes between
         sequences) — the note is host-owned static text. -->
    <figcaption class:pending={!sequence}>
      <Crossfade key={word}>
        <span class="tka-font demo-word">{word}</span>
      </Crossfade>
      <span class="demo-note">{note}</span>
    </figcaption>
  </figure>

  {#if onReroll}
    <div class="reroll-row">
      <button
        type="button"
        class="reroll-button"
        onclick={onReroll}
        disabled={rerolling || !sequence}
      >
        <i class="fas {rerolling ? 'fa-circle-notch fa-spin' : 'fa-dice'}" aria-hidden="true"></i>
        <span>{rerolling ? "Rolling..." : "Roll a new one"}</span>
      </button>
    </div>
  {/if}
</div>

<style>
  .hero-demo {
    margin: 2.4rem auto 0;
    /* width, not just max-width: inside a column-flex host the auto inline
       margins would otherwise shrink this to fit-content (the caption line,
       ~290px). In block-context hosts width:100% + max-width is identical to
       the old behavior. */
    width: 100%;
    max-width: min(26rem, 100%);
  }
  /* Figure holds only the image + its caption (a11y: figcaption stays the
     figure's last child). The reroll control is a sibling below it. */
  .demo-figure {
    margin: 0;
  }
  .demo-stage {
    position: relative;
    aspect-ratio: 1;
    border-radius: 18px;
    overflow: hidden;
    background: oklch(0.16 0.018 270 / 0.45);
    border: 1px solid oklch(0.4 0.04 270 / 0.14);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
  }

  figcaption {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 0.55rem;
    margin-top: 0.8rem;
    font-size: clamp(0.85rem, 0.8rem + 0.12vw, 1rem);
    color: oklch(0.6 0.02 270);
  }

  .demo-word {
    font-size: clamp(1.05rem, 1rem + 0.15vw, 1.25rem);
    color: oklch(0.88 0.03 270);
  }

  .demo-note {
    font-style: italic;
  }

  figcaption.pending {
    visibility: hidden;
  }

  /* Composer-only dice: a real button (clickables-look-like-buttons), quiet
     fill so the player stays the hero. Always present once rendered, so no
     shift when the host toggles the rolling state. */
  .reroll-row {
    display: flex;
    justify-content: center;
    margin-top: 1rem;
  }
  .reroll-button {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    min-height: 44px;
    padding: 0 1.4rem;
    font-size: clamp(0.95rem, 0.9rem + 0.12vw, 1.08rem);
    font-weight: 650;
    font-family: inherit;
    color: oklch(0.9 0.015 270);
    border: 1px solid oklch(0.5 0.06 270 / 0.3);
    border-radius: 12px;
    background: oklch(0.3 0.04 270 / 0.18);
    cursor: pointer;
    transition:
      transform 160ms ease,
      border-color 160ms ease,
      background 160ms ease,
      opacity 160ms ease;
  }
  .reroll-button:hover:not(:disabled) {
    transform: translateY(-2px);
    background: oklch(0.34 0.05 270 / 0.26);
    border-color: oklch(0.6 0.08 270 / 0.5);
  }
  .reroll-button:disabled {
    opacity: 0.6;
    cursor: default;
  }

  /* Ultrawide: the hero holds its own against the big-screen composition —
     height-keyed so it scales with the screen, capped at 78rem so a very tall
     display doesn't blow the stage past what the player fills. Type is on the
     base ramps above; this block is layout-only. After the base rules so it
     wins by source order. */
  @media (min-width: 1680px) {
    .hero-demo {
      max-width: min(60vh, 78rem);
    }
    .reroll-button {
      min-height: 52px;
      padding: 0 1.8rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .reroll-button {
      transition: none;
    }
    .reroll-button:hover:not(:disabled) {
      transform: none;
    }
  }
</style>
