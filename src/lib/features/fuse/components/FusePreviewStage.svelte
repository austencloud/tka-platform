<script lang="ts">
  import { Popover } from "bits-ui";
  import BpmQuickPopover from "$lib/shared/animation-engine/components/controls/BpmQuickPopover.svelte";
  import TransportControls from "$lib/shared/animation-engine/components/controls/TransportControls.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import ActionButton from "$lib/shared/components/selection/ActionButton.svelte";
  import { getSequenceDisplayName } from "$lib/shared/foundation/services/word-deriver";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import { getFuseContext } from "../context/fuse-context";
  import FuseAnimationPreview from "./FuseAnimationPreview.svelte";

  let { onFuse }: { onFuse: () => Promise<void> } = $props();
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

<section class="preview-stage" aria-labelledby="fuse-preview-heading">
  <div class="preview-heading-row">
    <div>
      <p class="preview-kicker">Output</p>
      <h3 id="fuse-preview-heading">Combined preview</h3>
    </div>
    <span class="preview-length">
      {fuseState.appliedLength ? `${fuseState.appliedLength} steps` : "\u00A0"}
    </span>
  </div>

  <div class="preview-frame" role="img" aria-label={previewDescription}>
    {#if fuseState.previewSequence}
      <FuseAnimationPreview
        sequence={fuseState.previewSequence}
        currentStep={fuseState.currentStep}
        isPlaying={fuseState.clockRunning}
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

  <div class="playback-row">
    <TransportControls
      isPlaying={fuseState.clockRunning}
      disabled={!fuseState.previewSequence || fuseState.isFusing}
      onPlaybackToggle={() => fuseState.toggleClock()}
    />

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

  <div class="status-row">
    {#if fuseState.error}
      <p id="fuse-action-status" class="status error-status" role="alert">
        {fuseState.statusMessage}
      </p>
    {:else}
      <p
        id="fuse-action-status"
        class="status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {fuseState.statusMessage}
      </p>
    {/if}

    <div class="retry-slot" class:visible={fuseState.canRetry}>
      {#if fuseState.canRetry}
        <PanelButton
          variant="secondary"
          disabled={fuseState.isLoadingLength || fuseState.pendingSide !== null}
          onclick={() => void fuseState.retry()}
        >
          <i class="fas fa-arrow-rotate-right" aria-hidden="true"></i>
          Retry
        </PanelButton>
      {/if}
    </div>
  </div>

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
</section>

<style>
  :global(.fuse-tempo-popover) {
    --min-touch-target: 48px;
  }

  .preview-stage {
    grid-area: preview;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-md, 14px);
    min-width: 0;
    min-height: 0;
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

  .preview-heading-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 42px;
  }

  .preview-kicker,
  h3,
  .status {
    margin: 0;
  }

  .preview-kicker {
    color: color-mix(
      in srgb,
      var(--semantic-warning, #f97316) 78%,
      var(--theme-text)
    );
    font-size: var(--font-size-compact, 12px);
    font-weight: 750;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  h3 {
    color: var(--theme-text, #fff);
    font-size: clamp(1.05rem, 2.4cqw, 1.35rem);
    font-weight: 720;
  }

  .preview-length {
    min-width: 7ch;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.58));
    font-size: var(--font-size-compact, 12px);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .preview-frame {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1 1 300px;
    min-width: 0;
    min-height: 260px;
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

  .playback-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--settings-spacing-sm, 10px);
    min-height: var(--min-touch-target, 44px);
  }

  .tempo-trigger {
    display: inline-grid;
    grid-template-columns: auto auto auto;
    align-items: baseline;
    justify-content: center;
    gap: 5px;
    min-width: 112px;
    min-height: var(--min-touch-target, 44px);
    padding: 8px 12px;
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
    font-size: var(--font-size-min, 14px);
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

  .status-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    min-height: var(--min-touch-target, 44px);
  }

  .status {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.68));
    font-size: var(--font-size-min, 14px);
    line-height: 1.35;
  }

  .error-status {
    color: var(--semantic-error, #fca5a5);
  }

  .retry-slot {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-width: 88px;
    visibility: hidden;
  }

  .retry-slot.visible {
    visibility: visible;
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
      overflow: visible;
    }

    .preview-frame {
      flex-basis: 260px;
      min-height: 240px;
    }

    .status-row {
      align-items: start;
    }
  }

  @container fuse (min-width: 1100px) {
    .preview-stage {
      padding: clamp(16px, 1.4cqw, 24px);
    }

    .preview-frame {
      min-height: 320px;
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
