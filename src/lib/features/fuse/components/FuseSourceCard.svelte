<script lang="ts">
  import type { BrowseViewMode } from "$lib/shared/browse/domain/browse-view-mode";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import { getSequenceDisplayName } from "$lib/shared/foundation/services/word-deriver";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import ChoreoCard from "$lib/shared/sequence-viewer/components/ChoreoCard.svelte";
  import { getFuseContext } from "../context/fuse-context";
  import type { FuseSide } from "../state/fuse-shuffle-pool.svelte";

  let {
    side,
    showInlineNotation,
    onViewNotation,
  }: {
    side: FuseSide;
    showInlineNotation: boolean;
    onViewNotation: (side: FuseSide) => void;
  } = $props();

  const { state } = getFuseContext();
  const settings = getSettings();
  const source = $derived(side === "blue" ? state.blue : state.red);
  const label = $derived(side === "blue" ? "Blue" : "Red");
  const headingId = $derived(`fuse-${side}-heading`);
  const displayName = $derived.by(() => {
    if (!source.sequence) return "";
    return simplifyRepeatedWord(getSequenceDisplayName(source.sequence));
  });
  const viewMode = $derived<BrowseViewMode>({
    subject: "props",
    granularity: "solo",
    color: side,
  });
  const cardColumns = $derived(
    (source.sequence?.steps.length ?? 0) <= 4 ? 2 : 4
  );
  const viewDisabled = $derived(source.isLoading || state.isFusing);
  const sourceControlsDisabled = $derived(
    state.isLoadingLength || state.pendingSide !== null || state.isFusing
  );
</script>

<section
  class="source-card {side}-source"
  class:loading={source.isLoading}
  aria-labelledby={headingId}
  aria-busy={source.isLoading}
>
  <div class="source-heading-row">
    <span class="source-dot" aria-hidden="true"></span>
    <h3 id={headingId}>{label}<span class="sr-only"> path</span></h3>
    {#if source.sequence}
      <p class="source-name" title={displayName}>{displayName}</p>
    {:else if source.isLoading}
      <span class="name-skeleton" aria-hidden="true"></span>
    {:else}
      <p class="source-unavailable">No path available</p>
    {/if}
    <span class="pool-count">
      {#if source.sequence && source.poolSize > 0}
        {source.poolPosition} of {source.poolSize}
      {:else}
        &nbsp;
      {/if}
    </span>
  </div>

  {#if showInlineNotation}
    <div class="notation-stage">
      {#if source.sequence}
        <div class="notation-scroll themed-scrollbar">
          <ChoreoCard
            sequence={source.sequence}
            browseViewMode={viewMode}
            columnCount={cardColumns}
            includeStartPosition={false}
            showWord={false}
            showStepNumbers={true}
            showDifficultyLevel={false}
            showCreatorName={false}
            showNotes={false}
            showBirthday={false}
            showLoopGlyph={false}
            darkMode={true}
            bluePropType={settings.bluePropType}
            redPropType={settings.redPropType}
            hideSoloHeader={true}
            fitWidth={true}
          />
        </div>
      {:else if source.isLoading}
        <div class="notation-skeleton" aria-hidden="true"></div>
      {:else}
        <p class="notation-empty">No notation to show.</p>
      {/if}
    </div>
  {:else}
    <div class="notation-reserve" aria-hidden="true"></div>
    {#if source.sequence}
      <div class="notation-button">
        <PanelButton
          variant="secondary"
          fullWidth={true}
          disabled={viewDisabled}
          onclick={() => onViewNotation(side)}
        >
          <i class="fas fa-table-cells" aria-hidden="true"></i>
          View {label} notation
        </PanelButton>
      </div>
    {/if}
  {/if}

  <div class="source-actions">
    <PanelButton
      variant="secondary"
      fullWidth={true}
      disabled={sourceControlsDisabled || !source.canGoBack}
      onclick={() => state.previous(side)}
    >
      <i class="fas fa-arrow-rotate-left" aria-hidden="true"></i>
      Back
    </PanelButton>
    <PanelButton
      variant="secondary"
      fullWidth={true}
      disabled={sourceControlsDisabled || !source.sequence}
      onclick={() => void state.shuffle(side)}
    >
      <i class="fas fa-shuffle" aria-hidden="true"></i>
      Shuffle {label}
    </PanelButton>
  </div>

  {#if source.revision > 1}
    {#key source.revision}
      <span class="change-flash" aria-hidden="true"></span>
    {/key}
  {/if}
</section>

<style>
  .source-card {
    --source-color: var(--prop-blue, #2196f3);
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-md, 14px);
    min-width: 0;
    padding: var(--settings-spacing-md, 16px);
    overflow: hidden;
    border: 1px solid
      color-mix(in srgb, var(--source-color) 32%, var(--theme-stroke));
    border-radius: var(--settings-radius-lg, 20px);
    background:
      linear-gradient(
        145deg,
        color-mix(in srgb, var(--source-color) 8%, transparent),
        transparent 42%
      ),
      var(--theme-card-bg, rgba(255, 255, 255, 0.045));
  }

  .blue-source {
    grid-area: blue;
  }

  .red-source {
    --source-color: var(--prop-red, #f44336);
    grid-area: red;
  }

  .source-card.loading {
    border-style: dashed;
  }

  .source-heading-row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 36px;
  }

  .source-dot {
    width: 12px;
    height: 12px;
    flex: 0 0 auto;
    border-radius: 50%;
    background: var(--source-color);
    box-shadow: 0 0 0 5px
      color-mix(in srgb, var(--source-color) 13%, transparent);
  }

  .source-name,
  h3 {
    margin: 0;
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

  h3 {
    flex: 0 0 auto;
    color: color-mix(in srgb, var(--source-color) 72%, var(--theme-text));
    font-size: var(--font-size-compact, 12px);
    font-weight: 750;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .pool-count {
    min-width: 7ch;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.58));
    font-size: var(--font-size-compact, 12px);
    font-variant-numeric: tabular-nums;
    font-weight: 650;
    text-align: right;
  }

  .source-name {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    color: var(--theme-text, #fff);
    font-size: clamp(1.05rem, 2.4cqw, 1.35rem);
    font-weight: 760;
    letter-spacing: 0.015em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .source-unavailable,
  .notation-empty {
    margin: 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.58));
    font-size: var(--font-size-min, 14px);
  }

  .source-unavailable {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .notation-empty {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    min-height: 150px;
    padding: 18px;
    text-align: center;
  }

  .name-skeleton,
  .notation-skeleton {
    background: color-mix(in srgb, var(--theme-text, white) 8%, transparent);
    animation: loading-pulse 1.4s ease-in-out infinite;
  }

  .name-skeleton {
    flex: 1 1 auto;
    max-width: 55%;
    height: 20px;
    border-radius: 7px;
  }

  .notation-stage {
    position: relative;
    flex: 1 1 180px;
    min-height: 150px;
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-md, 14px);
    background: color-mix(in srgb, var(--theme-panel-bg) 84%, black);
  }

  .notation-scroll {
    width: 100%;
    height: 100%;
    overflow: auto;
  }

  .notation-skeleton {
    width: 100%;
    height: 100%;
  }

  .notation-button {
    min-height: var(--min-touch-target, 44px);
  }

  .notation-reserve {
    display: none;
  }

  .source-actions {
    display: grid;
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
    gap: var(--settings-spacing-sm, 8px);
    margin-top: auto;
  }

  .change-flash {
    position: absolute;
    inset: 2px;
    pointer-events: none;
    border: 2px solid color-mix(in srgb, var(--source-color) 72%, white);
    border-radius: calc(var(--settings-radius-lg, 20px) - 2px);
    animation: source-change 240ms ease-out both;
  }

  @keyframes source-change {
    0% {
      opacity: 0;
      transform: scale(0.99);
    }
    35% {
      opacity: 0.85;
    }
    100% {
      opacity: 0;
      transform: scale(1);
    }
  }

  @keyframes loading-pulse {
    0%,
    100% {
      opacity: 0.45;
    }
    50% {
      opacity: 0.9;
    }
  }

  @container fuse (max-width: 599px) {
    .source-card {
      padding: 14px;
      gap: 11px;
    }

    .source-actions {
      margin-top: 0;
    }
  }

  @container fuse (min-width: 600px) {
    .notation-button {
      display: none;
    }

    .notation-reserve {
      display: block;
      flex: 1 1 180px;
      min-height: 150px;
      border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
      border-radius: var(--settings-radius-md, 14px);
      background: color-mix(in srgb, var(--theme-text, white) 4%, transparent);
    }
  }

  /* One-page fit layouts only (mirrors FuseLayout's fr-row conditions).
     min-height: 0 lets the card shrink inside its fr row; anywhere else it
     zeroes the card's minimum contribution and collapses the auto grid rows.
     The notation stage gives up its tall floor and scrolls internally. */
  @container fuse (min-width: 600px) and (min-height: 600px) {
    .source-card {
      min-height: 0;
      gap: var(--settings-spacing-sm, 10px);
    }

    .notation-stage,
    .notation-reserve {
      min-height: 64px;
    }
  }

  @container fuse (min-width: 1100px) {
    .source-card {
      padding: clamp(14px, 1.4cqw, 22px);
    }
  }

  /* Locked desktop columns get their taller notation floor back. */
  @container fuse (min-width: 1100px) and (min-height: 780px) {
    .notation-stage,
    .notation-reserve {
      min-height: 120px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .name-skeleton,
    .notation-skeleton,
    .change-flash {
      animation: none;
    }
  }
</style>
