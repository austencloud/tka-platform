<!--
ProgressHeader - Compact inline progress display

Shows:
- Small progress ring (60px)
- Category progress bars inline
- Total concepts completed
-->
<script lang="ts">
  import type { LearningProgress } from "../domain/types";
  import {
    CONCEPT_CATEGORIES,
    getConceptsByCategory,
  } from "../domain/concepts";

  let { progress }: { progress: LearningProgress } = $props();

  const progressPercent = $derived(Math.round(progress.overallProgress));

  // SVG circle calculations for 60px ring
  const circleRadius = 24;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = $derived(
    circumference * (1 - progressPercent / 100)
  );

  // Category stats
  const categoryStats = $derived(
    (["foundation", "letters", "combinations", "advanced"] as const).map(
      (cat) => {
        const concepts = getConceptsByCategory(cat);
        const completed = concepts.filter((c) =>
          progress.completedConcepts.has(c.id)
        ).length;
        return {
          key: cat,
          ...CONCEPT_CATEGORIES[cat],
          completed,
          total: concepts.length,
          percent:
            concepts.length > 0 ? (completed / concepts.length) * 100 : 0,
        };
      }
    )
  );

  const totalCompleted = $derived(progress.completedConcepts.size);
  const totalConcepts = 28;
</script>

<div class="progress-header">
  <!-- Progress ring -->
  <div class="progress-ring-container">
    <svg class="progress-ring" viewBox="0 0 60 60">
      <defs>
        <linearGradient
          id="progressGradient"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stop-color="var(--prop-blue, #4A90E2)" />
          <stop offset="50%" stop-color="var(--theme-accent, #7B68EE)" />
          <stop offset="100%" stop-color="var(--semantic-success, #50C878)" />
        </linearGradient>
      </defs>
      <circle
        cx="30"
        cy="30"
        r={circleRadius}
        fill="none"
        stroke="var(--theme-stroke)"
        stroke-width="4"
      />
      <circle
        class="progress-arc"
        cx="30"
        cy="30"
        r={circleRadius}
        fill="none"
        stroke="url(#progressGradient)"
        stroke-width="4"
        stroke-linecap="round"
        stroke-dasharray={circumference}
        stroke-dashoffset={strokeDashoffset}
        transform="rotate(-90 30 30)"
      />
    </svg>
    <div class="ring-center">
      <span class="percentage">{progressPercent}%</span>
    </div>
  </div>

  <!-- Stats summary -->
  <div class="stats-summary">
    <div class="main-stat">
      <span class="stat-value">{totalCompleted}</span>
      <span class="stat-label">of {totalConcepts} concepts</span>
    </div>

    <!-- Category mini-bars -->
    <div class="category-bars">
      {#each categoryStats as cat (cat.key)}
        <div
          class="category-bar"
          style="--cat-color: {cat.color}"
          title="{cat.name}: {cat.completed}/{cat.total}"
        >
          <i class="fa-solid {cat.icon}" aria-hidden="true"></i>
          <div class="bar-track">
            <div class="bar-fill" style="width: {cat.percent}%"></div>
          </div>
          <span class="bar-count">{cat.completed}/{cat.total}</span>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .progress-header {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding: 0.75rem 1rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    border-radius: 12px;
  }

  .progress-ring-container {
    position: relative;
    width: 60px;
    height: 60px;
    flex-shrink: 0;
  }

  .progress-ring {
    width: 100%;
    height: 100%;
  }

  .progress-arc {
    transition: stroke-dashoffset 0.5s ease;
  }

  .ring-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .percentage {
    font-size: 1rem;
    font-weight: 700;
    color: white;
  }

  .stats-summary {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    min-width: 0;
  }

  .main-stat {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: white;
  }

  .stat-label {
    font-size: 0.9375rem;
    color: var(--theme-text-dim);
  }

  .category-bars {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.625rem;
  }

  .category-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .category-bar i {
    color: var(--cat-color);
    font-size: 0.875rem;
    flex-shrink: 0;
  }

  .bar-track {
    flex: 1;
    height: 6px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 3px;
    overflow: hidden;
    min-width: 24px;
  }

  .bar-fill {
    height: 100%;
    background: var(--cat-color);
    border-radius: 3px;
    transition: width var(--duration-emphasis) ease;
  }

  .bar-count {
    color: var(--theme-text-dim);
    font-size: 0.8125rem;
    flex-shrink: 0;
    min-width: 28px;
  }

  /* Mobile: stack category bars */
  @media (max-width: 500px) {
    .category-bars {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .progress-arc,
    .bar-fill {
      transition: none;
    }
  }
</style>
