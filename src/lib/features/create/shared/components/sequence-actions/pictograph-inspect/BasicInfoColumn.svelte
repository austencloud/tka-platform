<script lang="ts">
  /**
   * Basic Info Column
   *
   * Displays basic beat information and lookup keys for debugging.
   */
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
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

<style>
  .column {
    background: #0d1117;
    border: 1px solid #21262d;
    border-radius: 6px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 0;
    font-family: "SF Mono", "Cascadia Code", "Fira Code", Monaco, Consolas,
      monospace;
  }

  .column-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 8px;
    margin-bottom: 4px;
    border-bottom: 1px solid #21262d;
  }

  .column-header h3 {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 600;
    color: #8b949e;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .copy-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid #30363d;
    background: transparent;
    color: #8b949e;
    cursor: pointer;
    font-size: 0.7rem;
    font-family: inherit;
    transition: all var(--duration-fast, 0.15s) ease;
  }

  .copy-btn:hover {
    background: #21262d;
    color: #e6edf3;
    border-color: #484f58;
  }

  .copy-btn:focus-visible {
    outline: 2px solid #58a6ff;
    outline-offset: 1px;
  }

  .copy-btn.small {
    padding: 2px 6px;
    font-size: 0.65rem;
  }

  .copied-label {
    color: #7ee787;
    font-weight: 600;
  }

  .data-block {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .data-block.compact {
    gap: 0;
  }

  .data-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 8px;
    gap: 12px;
    border-bottom: 1px solid #161b22;
  }

  .data-row:hover {
    background: rgba(136, 198, 255, 0.04);
  }

  .key {
    font-size: 0.7rem;
    color: #7d8590;
    white-space: nowrap;
  }

  .val {
    font-size: 0.8rem;
    color: #e6edf3;
    font-weight: 400;
    text-align: right;
    user-select: all;
  }

  .val.highlight {
    color: #79c0ff;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .val.mono {
    font-family: inherit;
  }

  .val.small {
    font-size: 0.65rem;
    word-break: break-all;
    color: #7d8590;
  }

  /* Lookup Keys Section */
  .subsection {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #21262d;
  }

  .lookup-keys-section {
    background: rgba(56, 139, 253, 0.06);
    border: 1px solid #1f3a5f;
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
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    display: flex;
    align-items: center;
    gap: 5px;
    color: #58a6ff;
  }

  .subsection-header h4 i {
    font-size: 0.6rem;
  }

  .data-row.key-row {
    background: transparent;
    border-bottom: 1px solid #161b22;
  }

  .key-val {
    font-size: 0.75rem;
    color: #d2a8ff;
    background: rgba(110, 64, 170, 0.15);
    padding: 1px 6px;
    border-radius: 3px;
  }

  .data-row.highlight-key {
    background: rgba(56, 139, 253, 0.08);
  }

  .data-row.highlight-key .key-val {
    color: #79c0ff;
    font-weight: 600;
    background: rgba(56, 139, 253, 0.15);
  }

  .data-row.blue-key .key-val {
    color: #58a6ff;
    background: rgba(56, 139, 253, 0.12);
  }

  .data-row.red-key .key-val {
    color: #f85149;
    background: rgba(248, 81, 73, 0.12);
  }
</style>
