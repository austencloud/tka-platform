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
    <div class="source-heading">
      <span class="source-dot" aria-hidden="true"></span>
      <div>
        <p class="source-kicker">{label} input</p>
        <h3 id={headingId}>{label} path</h3>
      </div>
    </div>
    <span class="pool-count">
      {#if source.sequence && source.poolSize > 0}
        {source.poolPosition} of {source.poolSize}
      {:else}
        &nbsp;
      {/if}
    </span>
  </div>

  <div class="source-identity">
    {#if source.sequence}
      <p class="source-name" title={displayName}>{displayName}</p>
      <p class="source-meta">{source.sequence.steps.length} steps</p>
    {:else if source.isLoading}
      <div class="identity-skeleton" aria-hidden="true">
        <span></span>
        <span></span>
      </div>
    {:else}
      <p class="source-unavailable">No path available</p>
    {/if}
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
    min-height: 0;
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

  .source-heading-row,
  .source-heading {
    display: flex;
    align-items: center;
  }

  .source-heading-row {
    justify-content: space-between;
    gap: 12px;
    min-height: 42px;
  }

  .source-heading {
    gap: 10px;
    min-width: 0;
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

  .source-kicker,
  .source-name,
  .source-meta,
  h3 {
    margin: 0;
  }

  .source-kicker {
    color: color-mix(in srgb, var(--source-color) 72%, var(--theme-text));
    font-size: var(--font-size-compact, 12px);
    font-weight: 750;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  h3 {
    color: var(--theme-text, #fff);
    font-size: clamp(1rem, 2.2cqw, 1.2rem);
    font-weight: 700;
  }

  .pool-count {
    min-width: 7ch;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.58));
    font-size: var(--font-size-compact, 12px);
    font-variant-numeric: tabular-nums;
    font-weight: 650;
    text-align: right;
  }

  .source-identity {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    min-height: 28px;
  }

  .source-name {
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

  .notation-empty {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    min-height: 150px;
    padding: 18px;
    text-align: center;
  }

  .source-meta {
    flex: 0 0 auto;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.56));
    font-size: var(--font-size-compact, 12px);
    font-variant-numeric: tabular-nums;
  }

  .identity-skeleton {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  .identity-skeleton span,
  .notation-skeleton {
    background: color-mix(in srgb, var(--theme-text, white) 8%, transparent);
    animation: loading-pulse 1.4s ease-in-out infinite;
  }

  .identity-skeleton span:first-child {
    width: 55%;
    height: 20px;
    border-radius: 7px;
  }

  .identity-skeleton span:last-child {
    width: 54px;
    height: 14px;
    border-radius: 5px;
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
      overflow: visible;
    }

    .source-actions {
      margin-top: 0;
    }
  }

  @container fuse (min-width: 1100px) {
    .source-card {
      padding: clamp(14px, 1.4cqw, 22px);
    }

    .notation-stage {
      min-height: 120px;
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

  @media (prefers-reduced-motion: reduce) {
    .identity-skeleton span,
    .notation-skeleton,
    .change-flash {
      animation: none;
    }
  }
</style>
