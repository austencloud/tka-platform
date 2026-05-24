<!--
  LetterPickerSheet.svelte - Modal for selecting starting letter filter
-->
<script lang="ts">
  interface Props {
    currentLetter: string | null;
    onSelect: (letter: string | null) => void;
    onClose: () => void;
  }

  let { currentLetter, onSelect, onClose }: Props = $props();

  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClose();
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="letter-sheet-overlay" onclick={onClose} aria-hidden="true">
  <div
    class="letter-sheet"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    role="dialog"
    tabindex="-1"
  >
    <div class="sheet-header">
      <span>Starting Letter</span>
      <button
        class="close-btn"
        onclick={onClose}
        aria-label="Close letter picker"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>
    <div class="letter-grid">
      <button
        class="letter-btn"
        class:active={currentLetter === null}
        onclick={() => onSelect(null)}
      >
        All
      </button>
      {#each LETTERS as letter}
        <button
          class="letter-btn"
          class:active={currentLetter === letter}
          onclick={() => onSelect(letter)}
        >
          {letter}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .letter-sheet-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-modal);
    animation: fadeIn var(--duration-normal) ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .letter-sheet {
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 20px;
    padding: 24px;
    max-width: 450px;
    width: 92%;
    max-height: 80vh;
    overflow-y: auto;
    animation: slideUp var(--duration-emphasis) ease;
    box-shadow: var(--theme-shadow, 0 14px 36px rgba(0, 0, 0, 0.4));
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }

  @keyframes slideUp {
    from {
      transform: translateY(30px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }

  .sheet-header span {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--theme-text, white);
    letter-spacing: 0.3px;
  }

  .close-btn {
    width: var(--min-touch-target); /* WCAG AAA touch target */
    height: var(--min-touch-target);
    border-radius: 50%;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-hover-bg);
    color: var(--theme-text-dim);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-compact);
    transition: all var(--duration-normal) ease;
  }

  .close-btn:hover {
    background: var(--theme-accent);
    border-color: var(--theme-accent);
    color: white;
    transform: rotate(90deg);
    box-shadow: 0 0 12px
      color-mix(in srgb, var(--theme-accent) 30%, transparent);
  }

  .letter-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 10px;
  }

  .letter-btn {
    aspect-ratio: 1;
    border-radius: 12px;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-panel-elevated-bg);
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: var(--font-size-min);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .letter-btn:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text, white);
    transform: translateY(-2px) scale(1.05);
  }

  .letter-btn.active {
    background: color-mix(in srgb, var(--theme-accent) 25%, transparent);
    border-color: var(--theme-accent);
    color: var(--theme-accent);
    box-shadow: 0 0 12px
      color-mix(in srgb, var(--theme-accent) 30%, transparent);
  }

  .letter-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .letter-sheet,
    .letter-btn {
      animation: none;
      transition: none;
    }
  }
</style>
