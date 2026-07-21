<script lang="ts">
  import { Popover } from "bits-ui";
  import BpmQuickPopover from "$lib/shared/animation-engine/components/controls/BpmQuickPopover.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import ActionButton from "$lib/shared/components/selection/ActionButton.svelte";
  import { getSequenceDisplayName } from "$lib/shared/foundation/services/word-deriver";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import { getFuseContext } from "../context/fuse-context";
  import FuseAnimationPreview from "./FuseAnimationPreview.svelte";
  import FuseMobileControls from "./FuseMobileControls.svelte";

  let {
    onFuse,
    compact = false,
  }: {
    onFuse: () => Promise<void>;
    compact?: boolean;
  } = $props();
  const { state: fuseState } = getFuseContext();
  let tempoOpen = $state(false);

  const blueName = $derived.by(() =>
    fuseState.blue.sequence
      ? simplifyRepeatedWord(getSequenceDisplayName(fuseState.blue.sequence))
      : "Blue path"
  );
  const redName = $derived.by(() =>
    fuseState.red.sequence
      ? simplifyRepeatedWord(getSequenceDisplayName(fuseState.red.sequence))
      : "Red path"
  );
  const previewDescription = $derived(
    fuseState.previewSequence && fuseState.appliedLength
      ? `Combined preview of Blue path ${blueName} and Red path ${redName}, ${fuseState.appliedLength} steps at ${fuseState.bpm} BPM.`
      : "Combined preview is loading."
  );
  const previewRevision = $derived(
    fuseState.blue.revision + fuseState.red.revision
  );
</script>

<section
  class="preview-stage"
  class:compact
  aria-labelledby="fuse-preview-heading"
>
  <h3 id="fuse-preview-heading" class="sr-only">Combined preview</h3>

  <div class="frame-wrap">
    <div class="preview-frame" role="img" aria-label={previewDescription}>
      {#if fuseState.previewSequence}
        <FuseAnimationPreview
          sequence={fuseState.previewSequence}
          currentStep={fuseState.currentStep}
          isPlaying={fuseState.clockRunning}
          onToggle={() => fuseState.toggleClock()}
          onError={(failure) => fuseState.reportPreviewFailure(failure)}
        />
      {:else}
        <div class="preview-placeholder" aria-hidden="true">
          <span class="orbit orbit-blue"></span>
          <span class="orbit orbit-red"></span>
          <i class="fas fa-fire-flame-curved"></i>
        </div>
      {/if}

      {#if previewRevision > 2}
        {#key previewRevision}
          <span class="preview-flash" aria-hidden="true"></span>
        {/key}
      {/if}
    </div>

    {#if !compact && fuseState.error}
      <div class="error-strip" role="alert">
        <p>{fuseState.statusMessage}</p>
        {#if fuseState.canRetry}
          <PanelButton
            variant="secondary"
            disabled={fuseState.isLoadingLength ||
              fuseState.pendingSide !== null}
            onclick={() => void fuseState.retry()}
          >
            <i class="fas fa-arrow-rotate-right" aria-hidden="true"></i>
            Retry
          </PanelButton>
        {/if}
      </div>
    {/if}
  </div>

  {#if compact}
    <FuseMobileControls {onFuse} />
  {:else}
    <p
      id="fuse-action-status"
      class="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {fuseState.statusMessage}
    </p>

    <!-- Playback pauses/resumes by tapping the canvas (tapToToggle + hover
         badge on FuseAnimationPreview). No standalone transport button — the
         app-wide direction is canvas-tap for play/pause. -->
    <div class="stage-controls">
      <div class="bpm-compact">
        <Popover.Root bind:open={tempoOpen}>
          <Popover.Trigger>
            {#snippet child({ props })}
              <button
                {...props}
                class="tempo-trigger"
                type="button"
                disabled={!fuseState.previewSequence || fuseState.isFusing}
                aria-label={`Set tempo, currently ${fuseState.bpm} BPM`}
              >
                <span class="tempo-value">{fuseState.bpm}</span>
                <span class="tempo-unit">BPM</span>
                <i class="fas fa-chevron-up" aria-hidden="true"></i>
              </button>
            {/snippet}
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              side="top"
              align="center"
              sideOffset={10}
              collisionPadding={12}
              class="fuse-tempo-popover"
            >
              <BpmQuickPopover
                bpm={fuseState.bpm}
                onBpmChange={(value) => fuseState.setBpm(value)}
                onClose={() => (tempoOpen = false)}
              />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>

      <div class="fuse-slot">
        <ActionButton
          label="Fuse and open"
          busyLabel="Building fused sequence..."
          icon="fa-fire-flame-curved"
          color="fuse"
          fullWidth={true}
          ariaDisabled={!fuseState.canFuse}
          ariaDescribedBy="fuse-action-status"
          busy={fuseState.isFusing}
          onclick={() => void onFuse()}
        />
      </div>
    </div>
  {/if}
</section>

<style>
  /* bits-ui portals this content to the body end; without an explicit z-index
     it renders under the app chrome and reads as "the popover won't open".
     Matches PracticeBar's .pb-bpm-pop fix. */
  :global(.fuse-tempo-popover) {
    --min-touch-target: 48px;
    z-index: var(--z-dropdown, 1000);
  }

  .preview-stage {
    grid-area: preview;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-md, 14px);
    min-width: 0;
    padding: var(--settings-spacing-md, 16px);
    overflow: hidden;
    border: 1px solid
      color-mix(
        in srgb,
        var(--semantic-warning, #f97316) 35%,
        var(--theme-stroke)
      );
    border-radius: var(--settings-radius-lg, 20px);
    background:
      radial-gradient(
        circle at 50% 42%,
        color-mix(in srgb, var(--semantic-warning, #f97316) 10%, transparent),
        transparent 58%
      ),
      var(--theme-panel-bg, rgba(12, 14, 22, 0.96));
  }

  .sr-only {
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

  .preview-stage.compact {
    height: 100%;
    min-height: 0;
    gap: var(--settings-spacing-sm, 8px);
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }

  .compact .frame-wrap {
    flex: 1 1 0;
    min-height: 0;
  }

  h3 {
    margin: 0;
  }

  .frame-wrap {
    position: relative;
    display: flex;
    flex: 1 1 300px;
    min-width: 0;
    min-height: 260px;
  }

  .preview-frame {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-lg, 18px);
    background:
      linear-gradient(
        var(--theme-stroke, rgba(255, 255, 255, 0.045)) 1px,
        transparent 1px
      ),
      linear-gradient(
        90deg,
        var(--theme-stroke, rgba(255, 255, 255, 0.045)) 1px,
        transparent 1px
      ),
      color-mix(in srgb, var(--theme-card-bg, #161821) 76%, black);
    background-size: 28px 28px;
  }

  .error-strip {
    position: absolute;
    inset-inline: 10px;
    bottom: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--settings-spacing-sm, 8px);
    min-height: var(--min-touch-target, 48px);
    padding: 6px 6px 6px 12px;
    border: 1px solid
      color-mix(in srgb, var(--semantic-error, #fca5a5) 42%, transparent);
    border-radius: var(--settings-radius-md, 12px);
    background: color-mix(
      in srgb,
      var(--semantic-error, #fca5a5) 12%,
      var(--theme-panel-bg, #161821)
    );
  }

  .error-strip p {
    margin: 0;
    color: var(--semantic-error, #fca5a5);
    font-size: var(--font-size-min, 14px);
    line-height: 1.3;
  }

  .preview-placeholder {
    position: relative;
    display: grid;
    place-items: center;
    width: min(54%, 220px);
    aspect-ratio: 1;
    color: var(--semantic-warning, #f97316);
    font-size: clamp(1.8rem, 6cqw, 3.1rem);
  }

  .preview-placeholder i {
    opacity: 0.62;
  }

  .orbit {
    position: absolute;
    inset: 12%;
    border: 2px solid var(--orbit-color);
    border-radius: 50%;
    opacity: 0.35;
  }

  .orbit-blue {
    --orbit-color: var(--prop-blue, #2196f3);
    transform: translateX(-12%);
  }

  .orbit-red {
    --orbit-color: var(--prop-red, #f44336);
    transform: translateX(12%);
  }

  .preview-flash {
    position: absolute;
    inset: 3px;
    pointer-events: none;
    border: 2px solid
      color-mix(in srgb, var(--semantic-warning, #f97316) 72%, white);
    border-radius: calc(var(--settings-radius-lg, 18px) - 2px);
    animation: preview-change 240ms ease-out both;
  }

  .stage-controls {
    display: flex;
    align-items: center;
    gap: var(--settings-spacing-sm, 10px);
    min-height: var(--min-touch-target, 44px);
  }

  /* Inline tempo chips are for wide desktop only; every other width uses the
     compact popover trigger. Only one is ever in flow. */
  .bpm-inline {
    display: none;
    min-width: 0;
  }

  /* With the standalone play/pause button gone (canvas-tap owns playback), the
     tempo control claims the freed width: it grows to a sane cap so BPM reads
     as a real control, while the Fuse button keeps the larger share and
     absorbs any remainder — prominent BPM, no leftover gap. */
  .bpm-compact {
    display: flex;
    flex: 1 1 0;
    min-width: 0;
    max-width: 340px;
  }

  .fuse-slot {
    flex: 2.4 1 0;
    min-width: 0;
  }

  /* Really-big desktop: the tempo controls come out into the open, and the
     Fuse button gives up the excess width it was hogging. */
  @container fuse (min-width: 1500px) {
    .bpm-inline {
      display: block;
      flex: 1 1 auto;
    }

    .bpm-compact {
      display: none;
    }

    .fuse-slot {
      flex: 0 0 clamp(300px, 24cqw, 460px);
    }
  }

  .tempo-trigger {
    display: grid;
    grid-template-columns: auto auto auto;
    align-items: baseline;
    justify-content: center;
    gap: 6px;
    width: 100%;
    min-width: 128px;
    min-height: var(--min-touch-target, 44px);
    padding: 10px 16px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: var(--settings-radius-md, 12px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.055));
    color: var(--theme-text, #fff);
    cursor: pointer;
    transition:
      background var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease;
  }

  .tempo-trigger:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .tempo-trigger:focus-visible {
    outline: 2px solid var(--theme-accent, currentColor);
    outline-offset: 2px;
  }

  .tempo-value {
    font-size: 1.15rem;
    font-variant-numeric: tabular-nums;
    font-weight: 800;
  }

  .tempo-unit,
  .tempo-trigger i {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
  }

  .tempo-trigger i {
    font-size: var(--font-size-compact, 12px);
  }

  @keyframes preview-change {
    0% {
      opacity: 0;
      transform: scale(0.995);
    }
    35% {
      opacity: 0.85;
    }
    100% {
      opacity: 0;
      transform: scale(1);
    }
  }

  @media (hover: hover) and (pointer: fine) {
    .tempo-trigger:hover:not(:disabled) {
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.24));
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.09));
    }
  }

  @container fuse (max-width: 599px) {
    .preview-stage {
      padding: 14px;
    }

    .frame-wrap {
      flex-basis: 260px;
      min-height: 240px;
    }
  }

  /* One-page fit layout (mirrors FuseLayout's fr-row condition). The base
     stack is already canvas-on-top / control-bar-on-bottom: frame-wrap
     flex:1 eats the free height and pushes the control row to the bottom,
     the frame's grid background fills the full width (props center in it,
     so it reads as a wide grid, not empty gutters), and the Fuse button
     (fuse-slot flex:1) stretches across the bar. All this rule does is let
     the stage shrink into its fr row — min-height:0, which must NOT leak to
     the scroll layouts where a zero minimum collapses the grid row. */
  @container fuse (min-width: 600px) and (min-height: 600px) {
    .preview-stage:not(.compact),
    .preview-stage:not(.compact) .frame-wrap {
      min-height: 0;
    }

    /* The animation renders square. Rather than fill the wide frame and
       letterbox onto black canvas bars, hold the frame square and center it
       in the track — the leftover becomes the stage's tinted background as
       symmetric breathing room, with the full-width control bar anchoring
       the bottom. */
    .preview-stage:not(.compact) .frame-wrap {
      justify-content: center;
    }

    .preview-stage:not(.compact) .preview-frame {
      flex: 0 1 auto;
      aspect-ratio: 1;
      height: 100%;
      width: auto;
      max-width: 100%;
    }
  }

  @container fuse (min-width: 1100px) {
    .preview-stage {
      padding: clamp(16px, 1.4cqw, 24px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .preview-flash {
      animation: none;
    }

    .tempo-trigger {
      transition: none;
    }
  }
</style>
