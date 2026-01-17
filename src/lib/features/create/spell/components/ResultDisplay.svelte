<!--
ResultDisplay.svelte - Shows the generation result

Displays the original word and expanded word with visual differentiation:
- Original letters: Bold, primary color
- Bridge letters: Dimmed, lighter color
-->
<script lang="ts">
  import type { LetterSource } from "../domain/models/spell-models";
  import { GREEK_LETTER_DISPLAY } from "../domain/constants/spell-constants";

  let {
    originalWord,
    expandedWord,
    letterSources,
  }: {
    originalWord: string;
    expandedWord: string;
    letterSources: LetterSource[];
  } = $props();

  // Get display character for a letter
  function getDisplayChar(letter: string): string {
    return GREEK_LETTER_DISPLAY[letter] || letter;
  }

  // Calculate stats
  const bridgeCount = $derived(
    letterSources.filter((s) => !s.isOriginal).length
  );
  const originalCount = $derived(
    letterSources.filter((s) => s.isOriginal).length
  );
</script>

<div class="result-display">
  <div class="result-header">
    <h4>Generated Sequence</h4>
  </div>

  <div class="result-content">
    <!-- Original Word -->
    <div class="result-row">
      <span class="result-label">Your word:</span>
      <span class="result-value original-word">{originalWord}</span>
    </div>

    <!-- Expanded Sequence -->
    <div class="result-row">
      <span class="result-label">Full sequence:</span>
      <div class="expanded-word">
        {#each letterSources as source}
          <span
            class="letter"
            class:original={source.isOriginal}
            class:bridge={!source.isOriginal}
            title={source.isOriginal ? "Original letter" : "Bridge letter"}
          >
            {getDisplayChar(source.letter)}
          </span>
        {/each}
      </div>
    </div>

    <!-- Stats -->
    <div class="result-stats">
      <span class="stat">
        <span class="stat-value">{originalCount}</span> original
      </span>
      {#if bridgeCount > 0}
        <span class="stat-divider">+</span>
        <span class="stat bridge">
          <span class="stat-value">{bridgeCount}</span> bridge
        </span>
      {/if}
      <span class="stat-divider">=</span>
      <span class="stat total">
        <span class="stat-value">{letterSources.length}</span> total
      </span>
    </div>
  </div>

  <div class="legend">
    <span class="legend-item">
      <span class="letter-sample original">A</span> = Your letters
    </span>
    <span class="legend-item">
      <span class="letter-sample bridge">B</span> = Bridge letters
    </span>
  </div>
</div>

<style>
  .result-display {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-md, 16px);
  }

  .result-header {
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    padding-bottom: var(--settings-spacing-sm, 8px);
  }

  .result-header h4 {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .result-content {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-sm, 8px);
  }

  .result-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--settings-spacing-sm, 8px);
  }

  .result-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    min-width: 100px;
  }

  .result-value {
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .original-word {
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .expanded-word {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
  }

  .letter {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    height: 32px;
    padding: 0 4px;
    border-radius: var(--settings-radius-xs, 4px);
    font-size: var(--font-size-md, 16px);
    transition: transform var(--duration-normal) ease;
  }

  .letter:hover {
    transform: scale(1.1);
  }

  .letter.original {
    background: var(--theme-accent, #6366f1);
    color: white;
    font-weight: 600;
  }

  .letter.bridge {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    border: 1px dashed var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .result-stats {
    display: flex;
    align-items: center;
    gap: var(--settings-spacing-sm, 8px);
    padding: var(--settings-spacing-sm, 8px);
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-radius: var(--settings-radius-sm, 8px);
    flex-wrap: wrap;
  }

  .stat {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .stat-value {
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .stat.bridge .stat-value {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .stat.total .stat-value {
    color: var(--theme-accent, #6366f1);
  }

  .stat-divider {
    color: var(--theme-stroke, rgba(255, 255, 255, 0.2));
  }

  .legend {
    display: flex;
    gap: var(--settings-spacing-md, 16px);
    padding-top: var(--settings-spacing-sm, 8px);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-wrap: wrap;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: var(--settings-spacing-xs, 4px);
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .letter-sample {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: var(--settings-radius-xs, 4px);
    font-size: var(--font-size-compact, 12px);
  }

  .letter-sample.original {
    background: var(--theme-accent, #6366f1);
    color: white;
    font-weight: 600;
  }

  .letter-sample.bridge {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    border: 1px dashed var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  /* Reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .letter {
      transition: none;
    }

    .letter:hover {
      transform: none;
    }
  }
</style>
