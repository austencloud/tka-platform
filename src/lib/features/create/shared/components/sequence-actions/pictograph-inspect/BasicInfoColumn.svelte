<script lang="ts">
  /**
   * Basic Info Column
   *
   * Displays basic beat information and lookup keys for debugging.
   */
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
  import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
  import { formatBasicInfo } from "./formatters";
  import CollapsibleSection from "$lib/features/admin/components/feature-flags/shared/CollapsibleSection.svelte";

  interface LookupKeys {
    gridMode: string;
    oriKey: string;
    turnsTuple: string;
    blueRotationOverrideKey: string | null;
    redRotationOverrideKey: string | null;
  }

  interface Props {
    displayData: StepData | null;
    blueMotion: MotionData | undefined;
    redMotion: MotionData | undefined;
    lookupKeys: LookupKeys | null;
    copiedSection: string | null;
    onCopy: (text: string, section: string) => void;
    open: boolean;
    onToggle: (next: boolean) => void;
  }

  let {
    displayData,
    blueMotion,
    redMotion,
    lookupKeys,
    copiedSection,
    onCopy,
    open,
    onToggle,
  }: Props = $props();

  function formatLookupKeysText(): string {
    if (!lookupKeys) return "";
    return `Grid Mode: ${lookupKeys.gridMode}\nOri Key: ${lookupKeys.oriKey}\nTurns Tuple: ${lookupKeys.turnsTuple}\nBlue Rot Key: ${lookupKeys.blueRotationOverrideKey ?? "N/A"}\nRed Rot Key: ${lookupKeys.redRotationOverrideKey ?? "N/A"}`;
  }
</script>

<CollapsibleSection title="Basic Info" {open} onToggle={onToggle} icon="fa-circle-info">
  {#snippet headerAction()}
    <button
      class="copy-btn"
      onclick={() =>
        onCopy(formatBasicInfo(displayData, blueMotion, redMotion), "basic")}
      title="Copy Basic Info"
    >
      <i class="fas fa-copy" aria-hidden="true"></i>
      {#if copiedSection === "basic"}<span class="copied-label">Copied!</span
        >{/if}
    </button>
  {/snippet}

<section class="column basic-column">
  <div class="data-block">
    <div class="data-row">
      <span class="key">Beat #</span>
      <span class="val">{displayData?.stepNumber ?? "-"}</span>
    </div>
    <div class="data-row">
      <span class="key">Letter</span>
      <span class="val highlight">{displayData?.letter ?? "None"}</span>
    </div>
    <div class="data-row">
      <span class="key">Grid Mode</span>
      <span class="val"
        >{blueMotion?.gridMode ?? redMotion?.gridMode ?? "N/A"}</span
      >
    </div>
    <div class="data-row">
      <span class="key">Prop Type</span>
      <span class="val"
        >{blueMotion?.propType ?? redMotion?.propType ?? "N/A"}</span
      >
    </div>
    <div class="data-row">
      <span class="key">Start Pos</span>
      <span class="val">{displayData?.startPosition ?? "N/A"}</span>
    </div>
    <div class="data-row">
      <span class="key">End Pos</span>
      <span class="val">{displayData?.endPosition ?? "N/A"}</span>
    </div>
    <div class="data-row">
      <span class="key">Blue Rev</span>
      <span class="val">{displayData?.blueReversal ?? "-"}</span>
    </div>
    <div class="data-row">
      <span class="key">Red Rev</span>
      <span class="val">{displayData?.redReversal ?? "-"}</span>
    </div>
    <div class="data-row">
      <span class="key">ID</span>
      <span class="val mono small">{displayData?.id ?? "-"}</span>
    </div>
  </div>

  <!-- Lookup Keys Section -->
  {#if lookupKeys}
    <div class="subsection lookup-keys-section">
      <div class="subsection-header">
        <h4>
          <i class="fas fa-key" aria-hidden="true"></i>
          Lookup Keys
        </h4>
        <button
          class="copy-btn small"
          onclick={() => onCopy(formatLookupKeysText(), "keys")}
          title="Copy Lookup Keys"
        >
          <i class="fas fa-copy" aria-hidden="true"></i>
          {#if copiedSection === "keys"}<span class="copied-label">!</span>{/if}
        </button>
      </div>
      <div class="data-block compact">
        <div class="data-row key-row">
          <span class="key">Grid Mode</span>
          <span class="val mono key-val">{lookupKeys.gridMode}</span>
        </div>
        <div class="data-row key-row">
          <span class="key">Ori Key</span>
          <span class="val mono key-val">{lookupKeys.oriKey}</span>
        </div>
        <div class="data-row key-row highlight-key">
          <span class="key">Turns Tuple</span>
          <span class="val mono key-val">{lookupKeys.turnsTuple}</span>
        </div>
        {#if lookupKeys.blueRotationOverrideKey}
          <div class="data-row key-row blue-key">
            <span class="key">Blue Rot Key</span>
            <span class="val mono key-val"
              >{lookupKeys.blueRotationOverrideKey}</span
            >
          </div>
        {/if}
        {#if lookupKeys.redRotationOverrideKey}
          <div class="data-row key-row red-key">
            <span class="key">Red Rot Key</span>
            <span class="val mono key-val"
              >{lookupKeys.redRotationOverrideKey}</span
            >
          </div>
        {/if}
      </div>
    </div>
  {/if}
</section>
</CollapsibleSection>

<style>
  .column {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 6px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .copy-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    font-size: var(--font-size-compact, 12px);
    font-family: inherit;
    transition: all var(--duration-fast, 0.15s) ease;
  }

  .copy-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #fff);
    border-color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .copy-btn:focus-visible {
    outline: 2px solid var(--semantic-info, #79c0ff);
    outline-offset: 1px;
  }

  .copy-btn.small {
    padding: 2px 6px;
    font-size: var(--font-size-compact, 12px);
  }

  .copied-label {
    color: var(--semantic-success, #7ee787);
    font-weight: 600;
  }

  .data-block {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .data-block.compact {
    gap: 2px;
  }

  .data-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 4px 8px;
    gap: 12px;
    border-radius: 6px;
  }

  .data-row:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.04));
  }

  .key {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    white-space: nowrap;
  }

  .val {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text, #fff);
    font-weight: 400;
    text-align: right;
    user-select: all;
  }

  .val.highlight {
    color: var(--semantic-info, #79c0ff);
    font-weight: 600;
    font-size: var(--font-size-sm, 14px);
  }

  .val.mono {
    font-family: inherit;
  }

  .val.small {
    font-size: var(--font-size-compact, 12px);
    word-break: break-all;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  /* Lookup Keys Section */
  .subsection {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .lookup-keys-section {
    background: rgba(56, 139, 253, 0.06);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 4px;
    padding: 8px;
    margin-top: 8px;
  }

  .subsection-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .subsection-header h4 {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    display: flex;
    align-items: center;
    gap: 5px;
    color: var(--semantic-info, #79c0ff);
  }

  .subsection-header h4 i {
    font-size: var(--font-size-compact, 12px);
  }

  .data-row.key-row {
    background: transparent;
  }

  .key-val {
    font-size: var(--font-size-compact, 12px);
    color: #d2a8ff;
    background: rgba(110, 64, 170, 0.15);
    padding: 1px 6px;
    border-radius: 3px;
  }

  .data-row.highlight-key {
    background: rgba(56, 139, 253, 0.08);
  }

  .data-row.highlight-key .key-val {
    color: var(--semantic-info, #79c0ff);
    font-weight: 600;
    background: rgba(56, 139, 253, 0.15);
  }

  .data-row.blue-key .key-val {
    color: var(--semantic-info, #79c0ff);
    background: rgba(56, 139, 253, 0.12);
  }

  .data-row.red-key .key-val {
    color: var(--semantic-error, #f85149);
    background: rgba(248, 81, 73, 0.12);
  }
</style>
