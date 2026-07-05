<script lang="ts">
  /**
   * RecordSceneRecordButton
   *
   * Floating record pill at bottom-right of the Record Scene chrome.
   * Triggers the 3D video export pipeline via the passed-in onExport callback.
   *
   * During recording, Recording3DOverlay takes over with countdown + progress
   * UI, so this button only needs to handle the idle and starting states.
   */

  interface Props {
    onExport: () => void;
    isExporting: boolean;
    canvasReady: boolean;
  }

  let { onExport, isExporting, canvasReady }: Props = $props();

  const disabled = $derived(isExporting || !canvasReady);
</script>

<button
  type="button"
  class="record-btn"
  class:disabled
  {disabled}
  onclick={onExport}
  aria-label={isExporting ? "Recording in progress" : !canvasReady ? "Preparing" : "Record scene"}
  title="Record Scene"
>
  {#if !canvasReady}
    <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
    <span>Preparing...</span>
  {:else if isExporting}
    <i class="fas fa-circle pulse" aria-hidden="true"></i>
    <span>Recording</span>
  {:else}
    <span class="dot" aria-hidden="true"></span>
    <span>Record Scene</span>
  {/if}
</button>

<style>
  .record-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    height: 44px;
    padding: 0 20px;
    border-radius: 999px;
    border: 1px solid rgba(239, 68, 68, 0.55);
    background: linear-gradient(
      180deg,
      rgba(239, 68, 68, 0.95) 0%,
      rgba(220, 38, 38, 0.95) 100%
    );
    color: #fff;
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    letter-spacing: 0.02em;
    cursor: pointer;
    box-shadow: 0 6px 20px rgba(239, 68, 68, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.4);
    transition: transform 150ms ease, box-shadow 150ms ease, background 150ms ease;
    backdrop-filter: blur(8px);
  }

  .record-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 8px 26px rgba(239, 68, 68, 0.5), 0 0 0 1px rgba(0, 0, 0, 0.4);
    background: linear-gradient(
      180deg,
      rgba(248, 113, 113, 0.95) 0%,
      rgba(239, 68, 68, 0.95) 100%
    );
  }

  .record-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .record-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    background: linear-gradient(180deg, rgba(120, 120, 120, 0.9), rgba(90, 90, 90, 0.9));
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.15));
    box-shadow: none;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 0 6px rgba(255, 255, 255, 0.6);
  }

  .pulse {
    animation: pulse 1.2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  @media (prefers-reduced-motion: reduce) {
    .pulse {
      animation: none;
    }
  }
</style>
