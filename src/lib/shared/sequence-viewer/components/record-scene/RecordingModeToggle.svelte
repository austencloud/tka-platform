<script lang="ts">
  type RecordingMode = "free" | "auto-orbit";

  interface Props {
    mode: RecordingMode;
    onToggle: (mode: RecordingMode) => void;
  }

  let { mode, onToggle }: Props = $props();

  function handleClick() {
    onToggle(mode === "free" ? "auto-orbit" : "free");
  }
</script>

<div class="mode-segment" role="radiogroup" aria-label="Recording camera mode">
  <button
    type="button"
    class="segment-btn"
    class:seg-active={mode === "free"}
    onclick={handleClick}
    role="radio"
    aria-checked={mode === "free"}
    aria-label="Free camera — record manual camera movement"
  >
    <i class="fas fa-hand-paper segment-icon" aria-hidden="true"></i>
    {#if mode === "free"}
      <span class="segment-label">Free</span>
    {/if}
  </button>
  <button
    type="button"
    class="segment-btn"
    class:seg-active={mode === "auto-orbit"}
    onclick={handleClick}
    role="radio"
    aria-checked={mode === "auto-orbit"}
    aria-label="Orbit — camera auto-orbits during recording"
  >
    <i class="fas fa-sync-alt segment-icon" aria-hidden="true"></i>
    {#if mode === "auto-orbit"}
      <span class="segment-label">Orbit</span>
    {/if}
  </button>
</div>

<style>
  .mode-segment {
    display: flex;
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    padding: 4px;
    backdrop-filter: blur(8px);
  }

  .segment-btn {
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);
    padding: 0 0.75rem;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .segment-btn:hover {
    color: var(--theme-text, white);
    background: var(--theme-card-hover-bg);
  }

  .segment-btn.seg-active {
    color: white;
    background: var(--theme-accent);
  }

  .segment-icon {
    font-size: 13px;
  }

  .segment-label {
    font-weight: 500;
  }

  @media (max-width: 600px) {
    .mode-segment {
      padding: 2px;
    }

    .segment-btn {
      padding: 0 0.5rem;
      font-size: var(--font-size-compact, 0.75rem);
    }
  }
</style>
