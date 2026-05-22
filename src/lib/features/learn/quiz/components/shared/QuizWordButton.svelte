<script lang="ts">
  let {
    word,
    state,
    disabled,
    onclick,
  }: {
    word: string;
    state: "default" | "correct" | "incorrect" | "dimmed";
    disabled: boolean;
    onclick: () => void;
  } = $props();
</script>

<button
  class="word-btn"
  class:correct={state === "correct"}
  class:incorrect={state === "incorrect"}
  class:dimmed={state === "dimmed"}
  {onclick}
  {disabled}
  aria-label="Answer: {word}"
>
  <span class="word-text">{word}</span>
  {#if state === "correct"}
    <span class="result-icon correct-icon">✓</span>
  {:else if state === "incorrect"}
    <span class="result-icon incorrect-icon">✗</span>
  {/if}
</button>

<style>
  .word-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 0.875rem 1.25rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 14px;
    cursor: pointer;
    transition: all var(--duration-normal) cubic-bezier(0.16, 1, 0.3, 1);
  }

  .word-btn:hover:not(:disabled) {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-color: color-mix(in srgb, var(--theme-accent) 40%, transparent);
    transform: translateY(-3px);
    box-shadow: 0 8px 24px color-mix(in srgb, var(--theme-accent) 20%, transparent);
  }

  .word-btn:active:not(:disabled) {
    transform: translateY(-1px) scale(0.98);
  }

  .word-text {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--theme-text, #ffffff);
    font-family: "JetBrains Mono", "Fira Code", "SF Mono", monospace;
    letter-spacing: 0.15em;
    text-shadow: 0 2px 8px color-mix(in srgb, var(--theme-panel-bg) 60%, transparent);
  }

  .word-btn.correct {
    background: color-mix(in srgb, var(--semantic-success) 20%, transparent);
    border-color: color-mix(in srgb, var(--semantic-success) 60%, transparent);
    animation: correctPulse 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes correctPulse {
    0% {
      transform: scale(1);
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--semantic-success) 40%, transparent);
    }
    50% {
      transform: scale(1.02);
      box-shadow: 0 0 0 10px transparent;
    }
    100% {
      transform: scale(1);
      box-shadow: 0 0 0 0 transparent;
    }
  }

  .word-btn.incorrect {
    background: color-mix(in srgb, var(--semantic-error) 20%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error) 60%, transparent);
    animation: incorrectShake var(--duration-dramatic) ease-out;
  }

  @keyframes incorrectShake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-5px); }
    40%, 80% { transform: translateX(5px); }
  }

  .word-btn.dimmed {
    opacity: 0.35;
    cursor: default;
  }

  .word-btn:disabled {
    cursor: default;
  }

  .result-icon {
    position: absolute;
    top: 8px;
    right: 10px;
    font-size: 0.9rem;
    font-weight: bold;
    animation: iconPop var(--duration-emphasis) cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes iconPop {
    from { transform: scale(0); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .correct-icon { color: var(--semantic-success); }
  .incorrect-icon { color: var(--semantic-error); }

  @media (min-width: 600px) {
    .word-btn {
      padding: 1rem 1.5rem;
      border-radius: 16px;
    }
    .word-text { font-size: 1.75rem; }
  }

  @media (min-width: 900px) {
    .word-btn {
      padding: 1.125rem 1.75rem;
      border-radius: 18px;
    }
    .word-text { font-size: 2rem; }
  }

  @media (prefers-reduced-motion: reduce) {
    .word-btn.correct, .word-btn.incorrect, .result-icon {
      animation: none;
    }
    .word-btn {
      transition: background 0.15s ease, border-color 0.15s ease;
    }
  }
</style>
