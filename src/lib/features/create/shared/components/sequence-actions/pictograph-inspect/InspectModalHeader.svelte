<script lang="ts">
  /**
   * Inspect Modal Header
   *
   * Header with title, badges, and copy buttons for the pictograph inspector.
   */
  import type { StepData } from "../../../domain/models/StepData";
  import CopyForAIButton from "$lib/shared/foundation/ui/CopyForAIButton.svelte";

  interface Props {
    displayData: StepData | null;
    stepData: StepData;
    isCalculating: boolean;
    getCopyAllData: () => string | Promise<string>;
    getCopyJsonData: () => string;
    onClose: () => void;
  }

  let {
    displayData,
    stepData,
    isCalculating,
    getCopyAllData,
    getCopyJsonData,
    onClose,
  }: Props = $props();
</script>

<header class="modal-header">
  <div class="header-left">
    <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
    <h2>Pictograph Inspector</h2>
    <span class="beat-badge"
      >Beat {displayData?.stepNumber ?? stepData.stepNumber}</span
    >
    {#if displayData?.letter ?? stepData.letter}
      <span class="letter-badge">{displayData?.letter ?? stepData.letter}</span>
    {/if}
    {#if isCalculating}
      <span class="calculating-badge">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      </span>
    {/if}
  </div>
  <div class="header-actions">
    <CopyForAIButton
      getData={getCopyAllData}
      ariaLabel="Copy all data for AI"
      variant="icon-text"
      size="sm"
      idleIcon="fa-copy"
      labels={{ idle: "Copy All for AI", success: "Copied!" }}
      disabled={isCalculating}
      class="copy-all-btn"
    />
    <CopyForAIButton
      getData={getCopyJsonData}
      ariaLabel="Copy JSON"
      variant="icon-text"
      size="sm"
      idleIcon="fa-code"
      labels={{ idle: "Copy JSON", success: "Copied!" }}
      disabled={isCalculating}
      class="copy-json-btn"
    />
    <button class="close-btn" onclick={onClose} aria-label="Close">
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>
  </div>
</header>

<style>
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    border-bottom: 1px solid var(--theme-stroke);
    background: rgba(0, 0, 0, 0.3);
    flex-wrap: wrap;
    gap: 12px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-left i {
    color: #06b6d4;
    font-size: 1.2rem;
  }

  .header-left h2 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: white;
  }

  .beat-badge {
    background: rgba(255, 255, 255, 0.1);
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.8);
  }

  .letter-badge {
    background: linear-gradient(135deg, #06b6d4, #0891b2);
    padding: 4px 12px;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 700;
    color: white;
  }

  .calculating-badge {
    color: var(--theme-text-dim);
    font-size: 0.85rem;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .copy-all-btn,
  .copy-json-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
    transition: all var(--duration-fast) ease;
  }

  .copy-all-btn {
    background: linear-gradient(135deg, #06b6d4, #0891b2);
    color: white;
  }

  .copy-all-btn:hover {
    background: linear-gradient(135deg, #22d3ee, #06b6d4);
    transform: translateY(-1px);
  }

  .copy-all-btn:disabled,
  .copy-json-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .copy-json-btn {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
    border: 1px solid var(--theme-stroke-strong);
  }

  .copy-json-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: white;
  }

  .close-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: var(--theme-card-bg);
    color: var(--theme-text-dim);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--duration-fast) ease;
    margin-left: 8px;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: white;
  }

  @media (max-width: 600px) {
    .header-left h2 {
      display: none;
    }
  }
</style>
