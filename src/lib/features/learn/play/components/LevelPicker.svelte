<!--
LevelPicker — the level ladder for one arcade game.

Rendered by PlayHub at phase "level-select". Pure presentation: every phase
mutation goes through the arcade session (startLevel / quitToHub) — PlayHub
owns the view-transition wrapping. Locked levels stay real buttons
(aria-disabled) so they remain discoverable; they just refuse the click.

Below 1024px this is the original stacked list: back + title/tagline + best
badge in one header row, then the ladder. At 1024px+ it becomes a composed
game-detail screen — a bordered/glowing panel with the game's live preview,
title, tagline and stats in a left identity column, and a beefed-up ladder in
a right column — so it reads as a screen built for a big display instead of a
skinny mobile list floating on the starfield. The identity column's title
(<h2 class="identity-title">) and the header's title (<h2 class="game-title">)
are the same information rendered twice on purpose, one hidden per
breakpoint: display:none removes the inactive one from the accessibility
tree, so exactly one heading is ever announced.
-->
<script lang="ts">
  import type {
    GameDefinition,
    GameProgress,
    Grade,
    LevelDefinition,
    LevelMode,
  } from "../domain/arcade-types";
  import { getArcadeSession } from "../state/arcade-session-state.svelte";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { getGamePreview } from "./previews/preview-map";

  let { game, progress }: { game: GameDefinition; progress: GameProgress } =
    $props();

  const session = getArcadeSession();

  const Preview = $derived(getGamePreview(game.id));

  const totalStars = $derived(
    Object.values(progress.starsByLevel).reduce<number>((sum, s) => sum + s, 0)
  );
  const maxStars = $derived(game.levels.length * 3);

  /* Same grade palette as GameCard / Train's PersonalBests+SessionHistory so
     a grade letter means the same color everywhere in the app. */
  function gradeColor(grade: Grade): string {
    switch (grade) {
      case "S":
        return "#fbbf24";
      case "A":
        return "#22c55e";
      case "B":
        return "#3b82f6";
      case "C":
        return "#f59e0b";
      case "D":
        return "#ef4444";
    }
  }

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

<div class="picker-shell">
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

  <div class="identity-column">
    <div class="preview-stage" aria-hidden="true">
      <Preview accent={game.accentColor} />
    </div>
    <h2 class="identity-title">{game.title}</h2>
    <p class="identity-tagline">{game.tagline}</p>
    <div class="stats-block">
      <div class="best-stat">
        <span class="best-stat-label">Best</span>
        <span class="best-stat-value">
          {progress.totalPlays > 0 ? progress.bestScore.toLocaleString() : "—"}
        </span>
        {#if progress.bestGrade}
          <span
            class="grade-chip"
            style="--grade-color: {gradeColor(progress.bestGrade)}"
            >{progress.bestGrade}</span
          >
        {/if}
      </div>
      <div class="stars-stat">★ {totalStars} / {maxStars}</div>
    </div>
  </div>

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
</div>

<style>
  /* Scroll owner: fills whatever the mode panel gives it. margin-block: auto
     on .level-picker below centers the ladder vertically only when there's
     spare height (4K); on a short viewport the auto margins resolve to 0
     and it scrolls exactly as before. */
  .picker-shell {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .level-picker {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg, 1rem);
    width: 100%;
    max-width: 560px;
    margin-inline: auto;
    margin-block: auto;
    padding: var(--spacing-lg, 1rem);
  }

  /* Identity column (preview + title + tagline + stats) only exists as a
     composed left column at 1024px+ — mobile keeps the header-only intro. */
  .identity-column {
    display: none;
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

  /* ── Composed game-detail screen (1024px+) ─────────────────────────────
     Austen's 4K monitor runs Windows display scaling, so the CSS viewport
     is likely ~1920-2000px, not 3840 — growth starts here and scales
     fluidly via clamp()/vw so it doesn't wait for a 2560+ gate that may
     never fire for him. */
  @media (min-width: 1024px) {
    .level-picker {
      max-width: clamp(900px, 72vw, 1500px);
      gap: clamp(1.5rem, 2vw, 2rem);
      padding: clamp(2rem, 2.5vw, 3rem);
      background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
      border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
      border-radius: 24px;
      box-shadow:
        0 32px 80px -32px color-mix(in srgb, var(--game-accent) 32%, transparent),
        0 2px 0 0 color-mix(in srgb, var(--game-accent) 12%, transparent) inset;
      display: grid;
      grid-template-columns: clamp(320px, 26vw, 480px) 1fr;
      grid-template-areas:
        "header header"
        "identity ladder";
      column-gap: clamp(2.5rem, 3vw, 3rem);
      row-gap: clamp(1.5rem, 2vw, 2rem);
      align-items: start;
    }

    .picker-header {
      grid-area: header;
    }

    /* The header keeps only the back button once the identity column takes
       over title/tagline/best duty below. */
    .header-text,
    .best-badge {
      display: none;
    }

    .identity-column {
      grid-area: identity;
      display: flex;
      flex-direction: column;
      gap: var(--spacing-sm, 0.5rem);
    }

    .preview-stage {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 10;
      border-radius: var(--radius-2026-lg, 18px);
      overflow: hidden;
      background:
        radial-gradient(
          120% 85% at 50% 112%,
          color-mix(in srgb, var(--game-accent) 26%, transparent),
          transparent 62%
        ),
        linear-gradient(180deg, rgba(12, 14, 22, 0.6), rgba(7, 9, 15, 0.82));
      border: 1px solid color-mix(in srgb, var(--game-accent) 15%, transparent);
      margin-bottom: 0.5rem;
    }

    .identity-title {
      margin: 0;
      font-size: clamp(1.75rem, 2.2vw, 2.75rem);
      font-weight: 800;
      letter-spacing: -0.01em;
      color: var(--theme-text, #ffffff);
    }

    .identity-tagline {
      margin: 0;
      font-size: var(--font-size-base, 1rem);
      color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    }

    .stats-block {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    }

    .best-stat {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 0.5rem;
      min-height: 2.25rem;
    }

    .best-stat-label {
      font-size: var(--font-size-compact, 12px);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    }

    .best-stat-value {
      font-size: clamp(1.5rem, 2vw, 2rem);
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      color: var(--game-accent);
    }

    .grade-chip {
      align-self: center;
      font-size: var(--font-size-compact, 12px);
      font-weight: 800;
      line-height: 1;
      padding: 4px 8px;
      border-radius: 6px;
      color: var(--grade-color);
      border: 1px solid color-mix(in srgb, var(--grade-color) 55%, transparent);
      background: color-mix(in srgb, var(--grade-color) 14%, transparent);
    }

    .stars-stat {
      font-size: var(--font-size-base, 1rem);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--theme-text-dim, rgba(255, 255, 255, 0.8));
    }

    .level-ladder {
      grid-area: ladder;
      gap: clamp(0.5rem, 0.8vw, 0.75rem);
    }

    /* Rows read as a real ladder on a big display, not a cramped mobile
       list: taller rows, bigger number badge and star glyphs, fluid via
       clamp()/vw so growth is continuous instead of jumping at 2560. */
    .level-row {
      min-height: clamp(76px, 5vw, 92px);
      padding: clamp(0.75rem, 1vw, 1.25rem) clamp(1rem, 1.5vw, 1.5rem);
      border-radius: 14px;
      gap: clamp(0.75rem, 1.2vw, 1.25rem);
    }

    .level-number {
      width: 44px;
      height: 44px;
      font-size: var(--font-size-lg, 1.125rem);
    }

    .level-title {
      font-size: clamp(1.125rem, 1vw, 1.375rem);
    }

    .level-mode {
      font-size: var(--font-size-sm, 0.875rem);
    }

    .level-status {
      min-width: 100px;
    }

    .star-row {
      gap: 0.25rem;
    }

    .star {
      width: clamp(22px, 1.4vw, 28px);
      height: clamp(22px, 1.4vw, 28px);
    }

    .lock-glyph {
      width: 22px;
      height: 22px;
    }
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
