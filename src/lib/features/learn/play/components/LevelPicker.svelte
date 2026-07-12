<!--
LevelPicker — the level ladder for one arcade game.

Rendered by PlayHub at phase "level-select". Pure presentation: every phase
mutation goes through the arcade session (startLevel / quitToHub) — PlayHub
owns the view-transition wrapping. Locked levels stay real buttons
(aria-disabled) so they remain discoverable; they just refuse the click.
-->
<script lang="ts">
  import type {
    GameDefinition,
    GameProgress,
    LevelDefinition,
    LevelMode,
  } from "../domain/arcade-types";
  import { getArcadeSession } from "../state/arcade-session-state.svelte";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";

  let { game, progress }: { game: GameDefinition; progress: GameProgress } =
    $props();

  const session = getArcadeSession();

  function modeSummary(mode: LevelMode): string {
    switch (mode.kind) {
      case "fixed":
        return `${mode.questionCount} questions`;
      case "countdown":
        return `${mode.seconds} seconds`;
      case "survival":
        return `${mode.maxMisses} misses`;
    }
  }

  function starsFor(level: LevelDefinition): number {
    return progress.starsByLevel[String(level.levelNumber)] ?? 0;
  }

  function isLocked(level: LevelDefinition): boolean {
    return level.levelNumber > progress.levelsUnlocked;
  }

  function levelLabel(level: LevelDefinition): string {
    if (isLocked(level)) {
      return `Level ${level.levelNumber}: ${level.title} — locked`;
    }
    return `Level ${level.levelNumber}: ${level.title}, ${modeSummary(level.mode)}, ${starsFor(level)} of 3 stars`;
  }

  function handleLevelClick(level: LevelDefinition) {
    if (isLocked(level)) return;
    getHapticFeedback().trigger("selection");
    session.startLevel(game, level);
  }

  function handleBack() {
    getHapticFeedback().trigger("selection");
    session.quitToHub();
  }
</script>

{#snippet starIcon(filled: boolean)}
  <svg
    class="star"
    class:filled
    width="16"
    height="16"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      d="M12 2l2.94 6.36 6.96.6-5.27 4.6 1.58 6.81L12 16.77l-6.21 3.6 1.58-6.81L2.1 8.96l6.96-.6L12 2z"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      stroke-width={filled ? 0 : 1.5}
      stroke-linejoin="round"
    />
  </svg>
{/snippet}

<div class="level-picker" style="--game-accent: {game.accentColor}">
  <header class="picker-header">
    <button
      type="button"
      class="back-button"
      onclick={handleBack}
      aria-label="Back to games"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
    </button>
    <div class="header-text">
      <h2 class="game-title">{game.title}</h2>
      <p class="game-tagline">{game.tagline}</p>
    </div>
    <div class="best-badge">
      <span class="best-label">Best</span>
      <span class="best-value">
        {progress.totalPlays > 0 ? progress.bestScore : "—"}
      </span>
    </div>
  </header>

  <div class="level-ladder">
    {#each game.levels as level (level.levelNumber)}
      {@const locked = isLocked(level)}
      {@const earned = starsFor(level)}
      <button
        type="button"
        class="level-row"
        class:locked
        aria-disabled={locked}
        aria-label={levelLabel(level)}
        onclick={() => handleLevelClick(level)}
      >
        <span class="level-number" aria-hidden="true">{level.levelNumber}</span>
        <span class="level-info">
          <span class="level-title">{level.title}</span>
          <span class="level-mode">{modeSummary(level.mode)}</span>
        </span>
        <span class="level-status" aria-hidden="true">
          {#if locked}
            <svg
              class="lock-glyph"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          {:else}
            <span class="star-row">
              {@render starIcon(earned >= 1)}
              {@render starIcon(earned >= 2)}
              {@render starIcon(earned >= 3)}
            </span>
          {/if}
        </span>
      </button>
    {/each}
  </div>
</div>

<style>
  .level-picker {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg, 1rem);
    width: 100%;
    max-width: 560px;
    margin: 0 auto;
    padding: var(--spacing-lg, 1rem);
  }

  /* Header */
  .picker-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-md, 0.75rem);
  }

  .back-button {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text, #ffffff);
    cursor: pointer;
    transition: filter var(--duration-fast, 150ms) ease;
  }

  .back-button:hover {
    filter: brightness(1.2);
  }

  .back-button:active {
    filter: brightness(0.9);
  }

  .header-text {
    flex: 1;
    min-width: 0;
  }

  .game-title {
    margin: 0;
    font-size: var(--font-size-xl, 1.25rem);
    font-weight: 700;
    color: var(--theme-text, #ffffff);
  }

  .game-tagline {
    margin: 0.125rem 0 0 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  .best-badge {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    flex-shrink: 0;
    /* Reserve width for a five-digit best so a first score doesn't shove the header */
    min-width: 4.5ch;
  }

  .best-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .best-value {
    font-size: var(--font-size-lg, 1.125rem);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--game-accent);
  }

  /* Ladder */
  .level-ladder {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 0.5rem);
  }

  .level-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-md, 0.75rem);
    width: 100%;
    min-height: calc(var(--min-touch-target, 44px) + 12px);
    padding: var(--spacing-sm, 0.5rem) var(--spacing-md, 0.75rem);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 12px;
    cursor: pointer;
    text-align: left;
    transition:
      transform var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease,
      filter var(--duration-fast, 150ms) ease;
  }

  .level-row:hover:not(.locked) {
    transform: translateY(-2px);
    border-color: color-mix(in srgb, var(--game-accent) 45%, transparent);
    filter: brightness(1.1);
  }

  .level-row:active:not(.locked) {
    transform: translateY(0);
    filter: brightness(0.95);
  }

  .level-row.locked {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .level-number {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--game-accent) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--game-accent) 40%, transparent);
    color: var(--game-accent);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .level-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    gap: 0.125rem;
  }

  .level-title {
    font-size: var(--font-size-base, 1rem);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .level-mode {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-variant-numeric: tabular-nums;
  }

  .level-status {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    /* Same footprint for lock glyph and star row — no shift when a level unlocks */
    min-width: 56px;
    justify-content: flex-end;
  }

  .star-row {
    display: flex;
    gap: 0.125rem;
  }

  .star {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
  }

  .star.filled {
    color: var(--game-accent);
  }

  .lock-glyph {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  @media (prefers-reduced-motion: reduce) {
    .back-button,
    .level-row {
      transition: none;
    }

    .level-row:hover:not(.locked) {
      transform: none;
    }
  }
</style>
