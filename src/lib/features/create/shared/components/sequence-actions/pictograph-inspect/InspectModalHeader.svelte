<script lang="ts">
  /**
   * Inspect Modal Header
   *
   * Header with title, badges, and copy buttons for the pictograph inspector.
   */
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
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
    <div class="terminal-dots">
      <span class="dot dot-red"></span>
      <span class="dot dot-yellow"></span>
      <span class="dot dot-green"></span>
    </div>
    <h2>inspect</h2>
    <span class="separator">/</span>
    <span class="beat-tag">beat:{displayData?.stepNumber ?? stepData.stepNumber}</span>
    {#if displayData?.letter ?? stepData.letter}
      <span class="separator">/</span>
      <span class="letter-tag">{displayData?.letter ?? stepData.letter}</span>
    {/if}
    {#if isCalculating}
      <span class="calculating">
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
      idleIcon="fa-terminal"
      labels={{ idle: "Copy AI", success: "Copied!" }}
      disabled={isCalculating}
    />
    <CopyForAIButton
      getData={getCopyJsonData}
      ariaLabel="Copy JSON"
      variant="icon-text"
      size="sm"
      idleIcon="fa-brackets-curly"
      labels={{ idle: "JSON", success: "Copied!" }}
      disabled={isCalculating}
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
    padding: 10px 16px;
    border-bottom: 1px solid #30363d;
    background: #161b22;
    flex-wrap: wrap;
    gap: 10px;
    font-family: "SF Mono", "Cascadia Code", "Fira Code", Monaco, Consolas,
      monospace;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .terminal-dots {
    display: flex;
    gap: 6px;
    margin-right: 4px;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .dot-red {
    background: #ff5f57;
  }

  .dot-yellow {
    background: #febc2e;
  }

  .dot-green {
    background: #28c840;
  }

  .header-left h2 {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
    color: #7ee787;
    letter-spacing: 0.5px;
  }

  .separator {
    color: #484f58;
    font-size: 0.85rem;
    font-weight: 400;
  }

  .beat-tag {
    font-size: 0.8rem;
    font-weight: 500;
    color: #8b949e;
  }

  .letter-tag {
    font-size: 0.9rem;
    font-weight: 700;
    color: #79c0ff;
  }

  .calculating {
    color: #8b949e;
    font-size: 0.8rem;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .close-btn {
    width: 36px;
    height: 36px;
    border-radius: 6px;
    border: 1px solid #30363d;
    background: transparent;
    color: #8b949e;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--duration-fast, 0.15s) ease;
    margin-left: 4px;
    font-size: 0.8rem;
  }

  .close-btn:hover {
    background: #21262d;
    color: #e6edf3;
    border-color: #484f58;
  }

  .close-btn:focus-visible {
    outline: 2px solid #58a6ff;
    outline-offset: 1px;
  }

  @media (max-width: 600px) {
    .header-left h2 {
      display: none;
    }

    .terminal-dots {
      display: none;
    }
  }
</style>
