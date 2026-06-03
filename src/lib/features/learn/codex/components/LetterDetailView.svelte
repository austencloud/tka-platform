<!--
Letter Detail View - Detailed view for a specific letter

Shows all pictographs for a selected letter with:
- Letter name and basic information
- Grid of all 8 pictographs (for one grid mode)
- Explanation of what characterizes this letter
- Back button to return to codex grid
-->
<script lang="ts">
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import SimpleGlassScroll from "../../../../shared/foundation/ui/SimpleGlassScroll.svelte";
  import PictographContainer from "../../../../shared/pictograph/shared/components/PictographContainer.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  // Props
  let {
    letter,
    pictographs,
    onBack,
    onPictographClick,
  }: {
    letter: string;
    pictographs: PictographData[];
    onBack: () => void;
    onPictographClick?: (pictograph: PictographData) => void;
  } = $props();

  // Letter explanations - placeholder for now, you'll provide the real content
  const letterExplanations: Record<
    string,
    { title: string; description: string }
  > = {
    A: {
      title: "Letter A - The Foundation",
      description:
        "Letter A is characterized by its consistent start and end positions. All A pictographs share the same fundamental movement pattern, varying only in rotation and orientation.",
    },
    // Add more as we go
  };

  const explanation = $derived(
    letterExplanations[letter] || {
      title: t("learn_letter_title", { letter }),
      description: t("learn_explanation_coming_soon"),
    }
  );

  function handlePictographClick(pictograph: PictographData) {
    onPictographClick?.(pictograph);
  }

  // Get a label for the pictograph based on its properties
  function getPictographLabel(pictograph: PictographData): string {
    const parts: string[] = [];

    // Get start and end positions
    if (pictograph.startPosition) {
      parts.push(`${pictograph.startPosition}`);
    }

    // Get orientation from first available motion
    const motion = pictograph.motions?.blue || pictograph.motions?.red;
    if (motion) {
      // Add start orientation
      if (motion.startOrientation) {
        parts.push(motion.startOrientation);
      }

      // Add grid mode if available
      if (motion.gridMode) {
        parts.push(motion.gridMode);
      }
    }

    // If we have no info, use the ID or a simple label
    if (parts.length === 0) {
      return pictograph.id || t("learn_variation");
    }

    return parts.join(" • ");
  }
</script>

<div class="letter-detail-view">
  <!-- Header with back button -->
  <div class="detail-header">
    <button class="back-button" onclick={onBack} aria-label={t("learn_back_to_codex")}>
      <i class="fas fa-arrow-left" aria-hidden="true"></i>
    </button>
    <div class="letter-title">
      <h2>{explanation.title}</h2>
    </div>
  </div>

  <!-- Scrollable content -->
  <div class="content-wrapper">
    <SimpleGlassScroll variant="primary" height="100%">
      <div class="detail-content">
        <!-- Explanation section -->
        <div class="explanation-section">
          <p class="explanation-text">{explanation.description}</p>
        </div>

        <!-- Pictograph grid -->
        <div class="pictograph-section">
          <h3 class="section-heading">
            {t("learn_all_pictographs", { letter, count: pictographs.length })}
          </h3>
          <div
            class="pictograph-grid"
            class:has-eight={pictographs.length === 8}
          >
            {#each pictographs as pictograph (pictograph.id)}
              <div
                class="pictograph-item"
                onclick={() => handlePictographClick(pictograph)}
                onkeydown={(e) =>
                  (e.key === "Enter" || e.key === " ") &&
                  handlePictographClick(pictograph)}
                role="button"
                tabindex="0"
                aria-label={t("learn_view_pictograph_details")}
              >
                <PictographContainer pictographData={pictograph} />
              </div>
            {/each}
          </div>

          {#if pictographs.length === 0}
            <div class="empty-state">
              <p>{t("learn_no_pictographs")}</p>
            </div>
          {/if}
        </div>
      </div>
    </SimpleGlassScroll>
  </div>
</div>

<style>
  .letter-detail-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background: transparent;
    overflow: hidden;
  }

  /* Header */
  .detail-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.5rem;
    background: var(--theme-card-bg);
    border-bottom: 1px solid var(--theme-stroke);
    flex-shrink: 0;
  }

  .back-button {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 10px;
    color: var(--theme-text-muted);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    flex-shrink: 0;
  }

  .back-button:hover {
    background: var(--theme-stroke);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
    transform: translateX(-2px);
  }

  .back-button:active {
    transform: translateX(0) scale(0.95);
  }

  .back-button i {
    font-size: 1.125rem;
  }

  .letter-title {
    flex: 1;
  }

  .letter-title h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--theme-text);
    background: linear-gradient(
      135deg,
      var(--theme-accent) 0%,
      var(--theme-accent-strong, var(--theme-accent)) 100%
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* Content wrapper */
  .content-wrapper {
    flex: 1;
    min-height: 0;
  }

  .detail-content {
    padding: 1.5rem;
  }

  /* Explanation section */
  .explanation-section {
    margin-bottom: 2rem;
    padding: 1.25rem;
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, var(--theme-accent-strong)) 8%,
      transparent
    );
    border: 1px solid
      color-mix(
        in srgb,
        var(--theme-accent-strong, var(--theme-accent-strong)) 20%,
        transparent
      );
    border-radius: 12px;
  }

  .explanation-text {
    margin: 0;
    font-size: 0.9375rem;
    line-height: 1.6;
    color: var(--theme-text-muted);
  }

  /* Pictograph section */
  .pictograph-section {
    margin-bottom: 2rem;
  }

  .section-heading {
    margin: 0 0 1rem 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--theme-text);
  }

  .pictograph-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr); /* 4 columns for optimal layout */
    gap: 1rem;
    max-width: 100%;
  }

  /* Optimal 2×4 layout for 8 pictographs */
  .pictograph-grid.has-eight {
    grid-template-rows: repeat(2, 1fr);
  }

  .pictograph-item {
    cursor: pointer;
    transition: all var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
  }

  .pictograph-item:hover {
    transform: scale(1.05);
  }

  .pictograph-item:active {
    transform: scale(0.98);
    transition-duration: var(--duration-instant);
  }

  .empty-state {
    padding: 3rem 1rem;
    text-align: center;
    color: var(--theme-text-dim);
  }

  .empty-state p {
    margin: 0;
    font-size: 0.875rem;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .detail-header {
      padding: 0.75rem 1rem;
    }

    .back-button {
      width: var(--min-touch-target); /* Keep 48px on mobile */
      height: var(--min-touch-target);
    }

    .letter-title h2 {
      font-size: 1.25rem;
    }

    .detail-content {
      padding: 1rem;
    }

    .explanation-section {
      padding: 1rem;
      margin-bottom: 1.5rem;
    }

    .explanation-text {
      font-size: 0.875rem;
    }

    .section-heading {
      font-size: 1rem;
    }

    .pictograph-grid {
      gap: 0.75rem;
    }
  }

  @media (max-width: 480px) {
    .pictograph-grid {
      gap: 0.5rem;
    }
  }

  /* Very small screens - switch to 2 columns */
  @media (max-width: 380px) {
    .pictograph-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 0.5rem;
    }

    .pictograph-grid.has-eight {
      grid-template-rows: repeat(4, 1fr); /* 4 rows × 2 columns */
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .back-button,
    .pictograph-item {
      transition: none;
    }
  }
</style>
