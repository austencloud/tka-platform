<script lang="ts">
  interface Props {
    isPlaying: boolean;
    animationReady: boolean;
    showStepGrid: boolean;
    showHistory: boolean;
    onToggleGrid: () => void;
    onTogglePause: () => void;
    onSkip: () => void;
    onCopy: (full: boolean) => void;
    onToggleHistory: () => void;
  }

  let {
    isPlaying,
    animationReady,
    showStepGrid,
    showHistory,
    onToggleGrid,
    onTogglePause,
    onSkip,
    onCopy,
    onToggleHistory,
  }: Props = $props();

  let copyConfirm = $state<"compact" | "full" | null>(null);

  function handleCopyClick(event: MouseEvent) {
    const full = event.shiftKey;
    onCopy(full);
    copyConfirm = full ? "full" : "compact";
    setTimeout(() => (copyConfirm = null), 1500);
  }
</script>

<div class="controls" role="group" aria-label="Playback controls">
  <button
    class="control-btn secondary"
    onclick={onToggleGrid}
    aria-label={showStepGrid ? "Hide notation grid" : "Show notation grid"}
    aria-pressed={showStepGrid}
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  </button>

  <button
    class="control-btn secondary"
    class:copied={copyConfirm !== null}
    onclick={handleCopyClick}
    disabled={!animationReady}
    aria-label={copyConfirm ? `Copied ${copyConfirm}` : "Copy sequence data (shift+click for full JSON)"}
    title="Copy sequence data (shift+click for full JSON)"
  >
    {#if copyConfirm}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    {:else}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    {/if}
  </button>

  <button
    class="control-btn primary"
    onclick={onTogglePause}
    disabled={!animationReady}
    aria-label={isPlaying ? "Pause animation" : "Play animation"}
  >
    {#if isPlaying}
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="6" y="4" width="4" height="16" rx="1" />
        <rect x="14" y="4" width="4" height="16" rx="1" />
      </svg>
    {:else}
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M8 5v14l11-7z" />
      </svg>
    {/if}
  </button>

  <button
    class="control-btn secondary"
    onclick={onSkip}
    disabled={!animationReady}
    aria-label="Skip to next sequence"
  >
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 4v16l10-8z" />
      <rect x="16" y="4" width="2" height="16" />
    </svg>
  </button>

  <button
    class="control-btn secondary"
    class:active={showHistory}
    onclick={onToggleHistory}
    aria-label={showHistory ? "Hide sequence history" : "Show sequence history"}
    aria-pressed={showHistory}
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  </button>
</div>

<style>
  .controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: all var(--duration-normal);
  }

  .control-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .control-btn.primary {
    width: 64px;
    height: 64px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff;
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
  }

  .control-btn.primary:hover:not(:disabled) {
    transform: scale(1.05);
    box-shadow: 0 6px 28px rgba(99, 102, 241, 0.5);
  }

  .control-btn.primary svg {
    width: 28px;
    height: 28px;
  }

  .control-btn.secondary {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
  }

  .control-btn.secondary:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
  }

  .control-btn.secondary svg {
    width: 20px;
    height: 20px;
  }

  .control-btn.copied {
    background: rgba(74, 222, 128, 0.15);
    border-color: rgba(74, 222, 128, 0.3);
    color: rgba(74, 222, 128, 0.9);
  }

  .control-btn.active {
    background: rgba(99, 102, 241, 0.2);
    border-color: rgba(99, 102, 241, 0.4);
    color: #a5b4fc;
  }

  .control-btn:focus-visible {
    outline: 2px solid #6366f1;
    outline-offset: 2px;
  }

  .control-btn.primary:focus-visible {
    outline-color: #fff;
  }
</style>
