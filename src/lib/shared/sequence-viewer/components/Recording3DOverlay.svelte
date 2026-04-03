<!--
  Recording3DOverlay.svelte

  Floating overlay for 3D video recording:
  - Countdown (3, 2, 1) before recording starts
  - Recording indicator (red dot + elapsed timer) during capture
-->
<script lang="ts">
  interface Props {
    countdownValue: number;
    isRecording: boolean;
    elapsed: number;
    total: number;
  }

  let { countdownValue, isRecording, elapsed, total }: Props = $props();

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `0:${String(s).padStart(2, "0")}`;
  }
</script>

{#if countdownValue > 0}
  <div class="overlay countdown-overlay" aria-live="assertive">
    {#key countdownValue}
      <div class="countdown-number">
        {countdownValue}
      </div>
    {/key}
  </div>
{/if}

{#if isRecording}
  <div class="overlay recording-badge" aria-live="polite">
    <div class="rec-dot"></div>
    <span class="rec-label">REC</span>
    <span class="rec-timer">{formatTime(elapsed)} / {formatTime(total)}</span>
  </div>
{/if}

<style>
  .overlay {
    position: absolute;
    z-index: 20;
    pointer-events: none;
  }

  /* ── Countdown ── */
  .countdown-overlay {
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.4);
  }

  .countdown-number {
    font-size: 6rem;
    font-weight: 800;
    color: white;
    text-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
    animation: countdown-pop 0.8s ease-out;
    font-variant-numeric: tabular-nums;
  }

  @keyframes countdown-pop {
    0% { transform: scale(1.6); opacity: 0; }
    30% { transform: scale(1); opacity: 1; }
    80% { opacity: 1; }
    100% { opacity: 0.3; }
  }

  /* ── Recording badge ── */
  .recording-badge {
    top: 16px;
    left: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .rec-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #ef4444;
    box-shadow: 0 0 8px #ef4444;
    animation: rec-pulse 1.2s ease-in-out infinite;
  }

  @keyframes rec-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .rec-label {
    font-size: 12px;
    font-weight: 700;
    color: #ef4444;
    letter-spacing: 0.5px;
  }

  .rec-timer {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.8);
    font-variant-numeric: tabular-nums;
  }

  @media (prefers-reduced-motion: reduce) {
    .countdown-number {
      animation: none;
    }
    .rec-dot {
      animation: none;
    }
  }
</style>
