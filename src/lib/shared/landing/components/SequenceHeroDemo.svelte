<!--
  SequenceHeroDemo

  A live sequence embed for public marketing pages: a real SequenceData
  object playing in the standalone InlineAnimationPlayer with minimal chrome.
  Originated as /composer's ComposerHeroDemo (hardcoded to the CΨΩX fixture);
  generalized so any public page can drop in its own sequence + caption note
  without re-deriving the LazyMount/reserved-stage activation plumbing.

  The player chunk is heavy (whole animation engine), so it goes through
  LazyMount and only starts importing once the stage is near the viewport, the
  current route morph has finished, and the browser reaches idle. The stage
  reserves either a square canvas or a word-header-plus-square-canvas before
  the player mounts, so the prose below never shifts (no-layout-shift rule).

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
  import { MediaQuery } from "svelte/reactivity";
  import { activateWhenNear } from "$lib/actions/activate-when-near";
  import LazyMount from "$lib/shared/components/LazyMount.svelte";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import { isNamedRouteMorphActive } from "$lib/shared/transitions/named-route-morph-state.svelte";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { TnDElement } from "$lib/features/choreo-card/domain/tnd-element";
  import type { TrailSettings } from "$lib/shared/animation-engine/domain/types/trail-types";
  import type { TipEffectMap } from "$lib/shared/animation-engine/domain/types/tip-effect-types";
  import type { PreparedSequenceHandoff } from "$lib/shared/animation-engine/domain/chaining-types";
  import { AnimationVisibilityStateManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

  let {
    sequence,
    element = null,
    note,
    bluePropType,
    redPropType,
    onReroll,
    rerolling = false,
    errorMessage = null,
    onLoopComplete,
    onSequenceBoundary,
    trailSettingsOverride = null,
    tipEffectMap = undefined,
    externalBpm,
    showNotationStrip = false,
    showWordHeader = false,
  }: {
    /** Null while the host is still producing the sequence (e.g. /composer's
        per-visit generated demo) — the stage box and caption line keep their
        reserved footprint and the player mounts when it lands. */
    sequence: SequenceData | null;
    /** TnD element of the current sequence, shown as a small bottom-right badge
        on the canvas. Present only for shape-matrix draws (the homepage hero);
        null (default) on generated draws and every other host — no badge. */
    element?: TnDElement | null;
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
    /** Visible recovery copy when a host cannot produce its sequence. */
    errorMessage?: string | null;
    /** Forwarded to InlineAnimationPlayer. The homepage hero attract act
        wires this to advance its walk on every loop wraparound; every other
        host omits it and pays no cost (InlineAnimationPlayer no-ops when
        absent). */
    onLoopComplete?: () => void;
    /** Supplies an already-generated continuation for a clock-preserving
        handoff inside InlineAnimationPlayer's loop-boundary frame. */
    onSequenceBoundary?: () => PreparedSequenceHandoff | null;
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
    /** Attaches the shared focus-locked pictograph rail directly beneath the
        stage. The rail is lazy, compact, and reserves its full height at SSR;
        other SequenceHeroDemo hosts retain the original visible caption. */
    showNotationStrip?: boolean;
    /** Shows the shared animated word header while preserving the square
        canvas beneath it. The header is isolated from persisted app settings. */
    showWordHeader?: boolean;
  } = $props();

  type LoadStatus = "idle" | "loading" | "loaded" | "error";

  const word = $derived(sequence ? simplifyRepeatedWord(sequence.word) : "");

  // Persist the last element so its icon can fade OUT (stays rendered through the
  // fade) when a generated draw sets element back to null. Only `visible` toggles.
  let shownElement = $state<TnDElement | null>(null);
  $effect(() => {
    if (element) shownElement = element;
  });
  const heroVisibilityManager = new AnimationVisibilityStateManager({
    ephemeral: true,
  });
  const hiddenNotationRail =
    typeof window === "undefined"
      ? null
      : new MediaQuery(
          "(width >= 42rem) and (width < 105rem) and (height >= 500px) and (height < 44rem), (height < 500px), (width >= 105rem) and (height < 64rem)"
        );
  const narrowNotationRail =
    typeof window === "undefined"
      ? null
      : new MediaQuery(
          "(width < 42rem) and (height >= 500px)"
        );
  const shouldMountNotationRail = $derived(
    showNotationStrip && !(hiddenNotationRail?.current ?? false)
  );
  const notationOrientation = $derived(
    narrowNotationRail?.current ? "vertical" : "horizontal"
  );

  let active = $state(false);
  let playerLoadStatus = $state<LoadStatus>("idle");
  let notationLoadStatus = $state<LoadStatus>("idle");
  const pending = $derived(
    sequence
      ? playerLoadStatus === "idle" || playerLoadStatus === "loading"
      : !errorMessage
  );
  const notationBusy = $derived(
    shouldMountNotationRail &&
      (!sequence ||
        notationLoadStatus === "idle" ||
        notationLoadStatus === "loading")
  );
  let reportedStep = $state(0);
  let reportedSequenceId = $state<string | null>(null);
  const notationStep = $derived(
    reportedSequenceId === (sequence?.id ?? null) ? reportedStep : 0
  );

  function handleStepChange(
    currentStep: number,
    sequenceId: string | null
  ): void {
    reportedSequenceId = sequenceId;
    reportedStep = currentStep;
  }

  function activatePlayerWhenNear(node: HTMLElement) {
    return activateWhenNear(node, {
      rootMargin: "240px",
      activate: () => (active = true),
      deferUntilIdle: true,
      idleTimeout: 2500,
      fallbackDelay: 300,
    });
  }
</script>

{#snippet playerPlaceholder()}
  <div class="demo-pending" role="status">
    <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
    <span>Preparing a live sequence...</span>
  </div>
{/snippet}

{#snippet notationPlaceholder()}
  <div class="notation-placeholder" aria-hidden="true"></div>
{/snippet}

<div
  class="hero-demo"
  class:with-notation-strip={showNotationStrip}
  use:activatePlayerWhenNear
>
  <figure class="demo-figure">
    <div class="demo-media">
      <div class="stage-shell">
        <div
          class="demo-stage"
          class:rail-attached={showNotationStrip}
          class:word-header-attached={showWordHeader}
          aria-busy={pending}
        >
          <!-- Not keyed on sequence id — the mounted player reloads onto a new
               sequence in place (see script comment above). The reserved stage
               footprint holds constant, so no layout shift either way. -->
          <LazyMount
            loader={() =>
              import("$lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte")}
            active={active && !!sequence && !isNamedRouteMorphActive()}
            placeholder={playerPlaceholder}
            onStatusChange={(status) => (playerLoadStatus = status)}
            props={{
              sequence,
              autoPlay: true,
              chrome: "minimal",
              fill: true,
              bluePropType,
              redPropType,
              onLoopComplete,
              onSequenceBoundary,
              trailSettingsOverride,
              tipEffectMap,
              externalBpm: externalBpm ?? null,
              showWordHeader,
              visibilityManagerOverride: showWordHeader
                ? heroVisibilityManager
                : undefined,
              onStepChange: shouldMountNotationRail
                ? handleStepChange
                : undefined,
            }}
          >
            {#snippet error(_error, retry)}
              <div class="demo-load-error" role="alert">
                <span>The live preview could not load.</span>
                <button type="button" onclick={retry}>Try again</button>
              </div>
            {/snippet}
          </LazyMount>

          {#if errorMessage && !sequence}
            <div class="demo-load-error" role="alert">
              <span>{errorMessage}</span>
            </div>
          {/if}

          <!-- TnD element indicator (shape-matrix draws only). Absolutely
               positioned inside the fixed-size stage, so it never shifts layout;
               fades on the current element and clips to the stage's rounded
               corners via the parent's overflow:hidden. -->
          {#if shownElement}
            <div
              class="element-badge"
              class:visible={!!element}
              style="--el-accent: {shownElement.accentColor}"
              role="img"
              aria-label={element ? `${shownElement.element} element` : undefined}
              aria-hidden={element ? undefined : "true"}
            >
              <img src={shownElement.iconPath} alt="" />
            </div>
          {/if}
        </div>
      </div>
      {#if showNotationStrip}
        <!-- Same StepStrip used by Play with It and focused practice. Compact
             height-fill makes the pictures legible without making the rail any
             taller; the fixed shell keeps the homepage stable before chunk load. -->
        <div
          class="notation-strip"
          role="group"
          aria-label={sequence
            ? `Pictographs for ${word}`
            : "Pictographs loading"}
          aria-busy={notationBusy}
        >
          <LazyMount
            loader={() => import("$lib/shared/timeline/StepStrip.svelte")}
            active={active &&
              !!sequence &&
              shouldMountNotationRail &&
              !isNamedRouteMorphActive()}
            placeholder={notationPlaceholder}
            onStatusChange={(status) => (notationLoadStatus = status)}
            props={{
              sequence,
              currentStep: notationStep,
              bpm: externalBpm ?? 60,
              density: "compact",
              fillHeight: true,
              anchor: "center",
              orientation: notationOrientation,
              loop: false,
              stepPulse: false,
              bluePropType: bluePropType ?? null,
              redPropType: redPropType ?? null,
            }}
          >
            {#snippet error(_error, retry)}
              <div class="notation-load-error" role="alert">
                <span>Pictographs did not load.</span>
                <button type="button" onclick={retry}>Try again</button>
              </div>
            {/snippet}
          </LazyMount>
        </div>
      {/if}
    </div>
    <!-- Line is always reserved; it becomes visible only once the word is
         known, so the note never shifts sideways when the word lands. Only
         the word crossfades (it's the part that actually changes between
         sequences) — the note is host-owned static text. When the notation
         rail is present this remains the figure's accessible caption without
         competing for visual space. -->
    <figcaption
      class:pending={!sequence}
      class:notation-caption={showNotationStrip}
    >
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
        disabled={rerolling || (!sequence && !errorMessage)}
      >
        <i
          class="fas {pending || rerolling
            ? 'fa-circle-notch fa-spin'
            : errorMessage
              ? 'fa-rotate-right'
              : 'fa-dice'}"
          aria-hidden="true"
        ></i>
        <span
          >{pending
            ? "Preparing..."
            : rerolling
            ? errorMessage
              ? "Trying again..."
              : "Rolling..."
            : errorMessage
              ? "Try again"
              : "Roll a new one"}</span
        >
      </button>
    </div>
    {#if errorMessage && sequence}
      <p class="reroll-error" role="status">{errorMessage}</p>
    {/if}
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
    max-width: var(--hero-demo-max-width, min(26rem, 100%));
    container-type: inline-size;
  }
  .hero-demo.with-notation-strip {
    margin-top: 1.8rem;
  }
  /* Figure holds only the image + its caption (a11y: figcaption stays the
     figure's last child). The reroll control is a sibling below it. */
  .demo-figure {
    margin: 0;
  }
  .demo-media {
    width: 100%;
  }
  .stage-shell {
    min-width: 0;
    container-type: inline-size;
  }
  .demo-stage {
    position: relative;
    box-sizing: border-box;
    aspect-ratio: 1;
    border-radius: 18px;
    overflow: hidden;
    background: oklch(0.16 0.018 270 / 0.45);
    border: 1px solid oklch(0.4 0.04 270 / 0.14);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
  }
  .demo-load-error {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 0.85rem;
    padding: 1.5rem;
    color: oklch(0.9 0.02 270);
    text-align: center;
    background: oklch(0.13 0.018 270 / 0.92);
  }
  .demo-pending {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 0.8rem;
    color: oklch(0.7 0.04 270);
    font-size: var(--font-size-min, 0.875rem);
  }
  .demo-pending i {
    color: oklch(0.76 0.12 285);
    font-size: 1.25rem;
  }

  /* TnD element badge — bottom-right of the canvas, sized in cqi so it scales
     with the stage (the stage-shell is a container). Absolute + always-reserved,
     so no-layout-shift; only opacity/scale animate. */
  .element-badge {
    position: absolute;
    right: clamp(8px, 3cqi, 16px);
    bottom: clamp(8px, 3cqi, 16px);
    z-index: 3;
    display: grid;
    place-items: center;
    width: clamp(28px, 11cqi, 48px);
    height: clamp(28px, 11cqi, 48px);
    padding: clamp(3px, 1.4cqi, 6px);
    border-radius: 50%;
    background: oklch(0.14 0.02 270 / 0.55);
    border: 1.5px solid var(--el-accent, oklch(0.6 0.04 270));
    box-shadow:
      0 0 0 1px oklch(0 0 0 / 0.25),
      0 2px 8px oklch(0 0 0 / 0.35);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    opacity: 0;
    transform: scale(0.9);
    transition:
      opacity 280ms ease,
      transform 280ms ease;
    pointer-events: none;
  }
  .element-badge.visible {
    opacity: 1;
    transform: scale(1);
  }
  .element-badge img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 1px 2px oklch(0 0 0 / 0.4));
  }
  @media (prefers-reduced-motion: reduce) {
    .element-badge {
      transition: none;
      transform: none;
    }
    .element-badge.visible {
      transform: none;
    }
  }
  .demo-load-error button {
    min-height: 44px;
    padding: 0 1rem;
    font: inherit;
    font-weight: 650;
    color: oklch(0.94 0.02 270);
    cursor: pointer;
    border: 1px solid oklch(0.62 0.1 270 / 0.55);
    border-radius: 10px;
    background: oklch(0.36 0.08 270 / 0.5);
  }
  .demo-stage.rail-attached {
    border-bottom: 0;
    border-radius: 18px 18px 0 0;
  }
  .demo-stage.word-header-attached {
    /* WordHeader's glyph line + vertical padding + one-pixel divider. The
       added height is reserved before LazyMount runs, so the canvas stays
       square and the surrounding landing layout never shifts. */
    aspect-ratio: auto;
    height: calc(
      100cqi + clamp(12px, 6cqi, 28px) + clamp(6px, 3cqi, 12px) +
        clamp(6px, 3cqi, 12px) + 1px
    );
  }
  .word-header-attached :global(.word-text) {
    line-height: 1;
  }

  .notation-strip {
    height: 4.125rem;
    overflow: hidden;
    border: 1px solid oklch(0.4 0.04 270 / 0.14);
    border-top: 0;
    border-radius: 0 0 18px 18px;
    background: oklch(0.13 0.018 270 / 0.58);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
  }
  .notation-load-error {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    height: 100%;
    padding-inline: 0.75rem;
    color: oklch(0.82 0.04 270);
    font-size: var(--font-size-min, 0.875rem);
  }
  .notation-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      oklch(0.72 0.04 270 / 0.08),
      transparent
    );
    background-size: 200% 100%;
    animation: notation-placeholder-pulse 1.8s ease-in-out infinite;
  }

  @keyframes notation-placeholder-pulse {
    from {
      background-position: 100% 0;
    }
    to {
      background-position: -100% 0;
    }
  }
  .notation-load-error button {
    min-height: 44px;
    padding-inline: 0.8rem;
    color: oklch(0.94 0.02 270);
    font: inherit;
    font-weight: 650;
    cursor: pointer;
    border: 1px solid oklch(0.62 0.1 270 / 0.55);
    border-radius: 9px;
    background: oklch(0.36 0.08 270 / 0.5);
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
  figcaption.notation-caption {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }

  /* Composer-only dice: a real button (clickables-look-like-buttons), quiet
     fill so the player stays the hero. Always present once rendered, so no
     shift when the host toggles the rolling state. */
  .reroll-row {
    display: flex;
    justify-content: center;
    margin-top: 1rem;
  }
  .with-notation-strip .reroll-row {
    margin-top: 0.85rem;
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
  .reroll-error {
    margin: 0.55rem 0 0;
    color: oklch(0.72 0.1 25);
    font-size: var(--font-size-min, 0.875rem);
    text-align: center;
  }

  /* Ultrawide: the hero holds its own against the big-screen composition —
     height-keyed so it scales with the screen, capped at 78rem so a very tall
     display doesn't blow the stage past what the player fills. Type is on the
     base ramps above; this block is layout-only. After the base rules so it
     wins by source order. */
  @media (width >= 105rem) and (height >= 56.25rem) {
    .hero-demo {
      max-width: var(--hero-demo-wide-max-width, min(60vh, 78rem));
    }
    .notation-strip {
      height: 4.6875rem;
    }
    .reroll-button {
      min-height: 3.25rem;
      padding: 0 1.8rem;
    }
  }

  @media (min-width: 601px) and (width < 105rem) {
    .notation-strip {
      height: 4.375rem;
    }
  }

  /* On a short Fold, the rail makes the animation itself too small to read.
     The same pictographs remain available throughout the site; this front-door
     preview returns the recovered height to the square canvas. */
  @media (width >= 42rem) and (width < 105rem) and (height >= 500px) and (height < 44rem) {
    .with-notation-strip .notation-strip {
      display: none;
    }
    .with-notation-strip .demo-stage.rail-attached {
      border-bottom: 1px solid oklch(0.4 0.04 270 / 0.14);
      border-radius: 18px;
    }
    .with-notation-strip .reroll-row {
      margin-top: 0.35rem;
    }
    .with-notation-strip .reroll-button {
      padding-inline: 0.9rem;
      font-size: 0.875rem;
    }
  }

  /* Short viewports use the animation without the thumbnail rail at every
     width. The rail stays dormant, not merely invisible, through
     shouldMountNotationRail. */
  @media (height < 500px),
    (width >= 105rem) and (height < 64rem) {
    .with-notation-strip .notation-strip {
      display: none;
    }
    .with-notation-strip .demo-stage.rail-attached {
      border-bottom: 1px solid oklch(0.4 0.04 270 / 0.14);
      border-radius: 18px;
    }
    .with-notation-strip .reroll-row {
      margin-top: 0.25rem;
    }
    .with-notation-strip .reroll-button {
      padding-inline: 0.75rem;
      font-size: var(--font-size-min, 0.875rem);
    }
  }

  /* Narrow, tall-enough viewports pair the square with a true vertical
     StepStrip. Both columns reserve their complete footprint before either
     lazy chunk mounts. */
  @media (width < 42rem) and (height >= 500px) {
    .demo-media {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 5.25rem;
      align-items: stretch;
      gap: 0.5rem;
    }
    .with-notation-strip .demo-stage.rail-attached {
      border-bottom: 1px solid oklch(0.4 0.04 270 / 0.14);
      border-radius: 18px;
    }
    .with-notation-strip .notation-strip {
      height: auto;
      border-top: 1px solid oklch(0.4 0.04 270 / 0.14);
      border-radius: 18px;
    }
    .with-notation-strip .reroll-row {
      margin-top: 0.35rem;
    }
    .with-notation-strip .reroll-button {
      padding-inline: 0.9rem;
      font-size: var(--font-size-min, 0.875rem);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .notation-placeholder {
      animation: none;
    }
    .reroll-button {
      transition: none;
    }
    .reroll-button:hover:not(:disabled) {
      transform: none;
    }
    .reroll-button :global(.fa-spin) {
      animation: none !important;
    }
  }
</style>
