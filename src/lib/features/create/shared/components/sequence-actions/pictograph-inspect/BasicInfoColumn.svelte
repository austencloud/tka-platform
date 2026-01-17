<script lang="ts">
  /**
   * Basic Info Column
   *
   * Displays basic beat information and lookup keys for debugging.
   */
  import type { StepData } from "../../../domain/models/StepData";
  import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
  import { formatBasicInfo } from "./formatters";

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
  }

  let {
    displayData,
    blueMotion,
    redMotion,
    lookupKeys,
    copiedSection,
    onCopy,
  }: Props = $props();

  function formatLookupKeysText(): string {
    if (!lookupKeys) return "";
    return `Grid Mode: ${lookupKeys.gridMode}\nOri Key: ${lookupKeys.oriKey}\nTurns Tuple: ${lookupKeys.turnsTuple}\nBlue Rot Key: ${lookupKeys.blueRotationOverrideKey ?? "N/A"}\nRed Rot Key: ${lookupKeys.redRotationOverrideKey ?? "N/A"}`;
  }
</script>

<section class="column basic-column">
  <div class="column-header">
    <h3>Basic Info</h3>
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
  </div>

  <div class="data-block">
    <div class="data-row">
      <span class="key">Beat #</span>
      <span class="val">{displayData?.stepNumber ?? "—"}</span>
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
      <span class="val">{displayData?.blueReversal ?? "—"}</span>
    </div>
    <div class="data-row">
      <span class="key">Red Rev</span>
      <span class="val">{displayData?.redReversal ?? "—"}</span>
    </div>
    <div class="data-row">
      <span class="key">ID</span>
      <span class="val mono small">{displayData?.id ?? "—"}</span>
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

<style>
  .column {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .column-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .column-header h3 {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--theme-text);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .copy-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid var(--theme-stroke-strong);
    background: var(--theme-card-bg);
    color: var(--theme-text-dim);
    cursor: pointer;
    font-size: 0.75rem;
    transition: all var(--duration-fast) ease;
  }

  .copy-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .copy-btn.small {
    padding: 4px 8px;
    font-size: 0.7rem;
  }

  .copied-label {
    color: var(--semantic-success);
    font-weight: 600;
  }

  .data-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .data-block.compact {
    gap: 4px;
  }

  .data-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 10px;
    background: rgba(0, 0, 0, 0.25);
    border-radius: 6px;
    gap: 12px;
  }

  .key {
    font-size: 0.75rem;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }

  .val {
    font-size: 0.85rem;
    color: var(--theme-text);
    font-weight: 500;
    text-align: right;
    user-select: all;
  }

  .val.highlight {
    color: #06b6d4;
    font-weight: 700;
    font-size: 1rem;
  }

  .val.mono {
    font-family: "SF Mono", Monaco, "Cascadia Code", monospace;
  }

  .val.small {
    font-size: 0.7rem;
    word-break: break-all;
  }

  /* Lookup Keys Section */
  .subsection {
    margin-top: 8px;
    padding-top: 12px;
    border-top: 1px dashed var(--theme-stroke);
  }

  .lookup-keys-section {
    background: rgba(6, 182, 212, 0.08);
    border: 1px solid rgba(6, 182, 212, 0.2);
    border-radius: 8px;
    padding: 12px;
    margin-top: 12px;
  }

  .subsection-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .subsection-header h4 {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: flex;
    align-items: center;
    gap: 6px;
    color: #06b6d4;
  }

  .subsection-header h4 i {
    font-size: 0.7rem;
  }

  .data-row.key-row {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .key-val {
    font-size: 0.8rem;
    color: #22d3ee;
    background: rgba(0, 0, 0, 0.3);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .data-row.highlight-key {
    background: rgba(6, 182, 212, 0.15);
    border: 1px solid rgba(6, 182, 212, 0.3);
  }

  .data-row.highlight-key .key-val {
    color: #67e8f9;
    font-weight: 600;
  }

  .data-row.blue-key {
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.2);
  }

  .data-row.blue-key .key-val {
    color: var(--semantic-info);
  }

  .data-row.red-key {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .data-row.red-key .key-val {
    color: var(--semantic-error);
  }
</style>
