<!--
HeroConceptCard - Compact, visually appealing card for current concept

Clean design with:
- Gradient background based on category
- Icon, title, description
- Compact meta info
- Prominent CTA
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "../../../shared/application/services/haptic-feedback";
  import { CONCEPT_CATEGORIES } from "../domain/concepts";
  import type { LearnConcept, ConceptStatus } from "../domain/types";

  let {
    concept,
    status,
    onStart,
  }: {
    concept: LearnConcept;
    status: ConceptStatus;
    onStart?: (concept: LearnConcept) => void;
  } = $props();

  const hapticService = getHapticFeedback();

  const category = $derived(CONCEPT_CATEGORIES[concept.category]);
  const isAvailable = $derived(
    status === "available" || status === "in-progress"
  );

  function handleStart() {
    if (!isAvailable) return;
    hapticService?.trigger("selection");
    onStart?.(concept);
  }

  const buttonText = $derived(() => {
    switch (status) {
      case "in-progress":
        return "Continue";
      case "available":
        return "Start";
      case "completed":
        return "Review";
      default:
        return "Locked";
    }
  });

  const buttonIcon = $derived(() => {
    switch (status) {
      case "in-progress":
        return "fa-play";
      case "completed":
        return "fa-rotate";
      case "locked":
        return "fa-lock";
      default:
        return "fa-arrow-right";
    }
  });
</script>

<button
  class="hero-card"
  class:locked={status === "locked"}
  style="--category-color: {category.color}"
  onclick={handleStart}
  disabled={status === "locked"}
  aria-label="{buttonText()} {concept.name}"
>
  <!-- Background gradient overlay -->
  <div class="card-bg"></div>

  <!-- Content -->
  <div class="card-content">
    <!-- Left: Icon -->
    <div class="icon-area">
      <div class="icon-wrapper">
        <i class="fa-solid {concept.icon}" aria-hidden="true"></i>
      </div>
      <span class="category-label">{category.name}</span>
    </div>

    <!-- Center: Info -->
    <div class="info-area">
      <h2 class="title">{concept.name}</h2>
      <p class="description">{concept.description}</p>
      <div class="meta">
        <span class="meta-item">
          <i class="fa-solid fa-clock" aria-hidden="true"></i>
          {concept.estimatedMinutes} min
        </span>
        <span class="meta-item">
          <i class="fa-solid fa-list-check" aria-hidden="true"></i>
          {concept.concepts.length} topics
        </span>
      </div>
    </div>

    <!-- Right: CTA -->
    <div class="cta-area">
      <div class="cta-button">
        <i class="fa-solid {buttonIcon()}" aria-hidden="true"></i>
        <span>{buttonText()}</span>
      </div>
    </div>
  </div>
</button>

<style>
  .hero-card {
    position: relative;
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    padding: 0;
    border: 1px solid color-mix(in srgb, var(--category-color) 30%, transparent);
    border-radius: 16px;
    background: transparent;
    cursor: pointer;
    overflow: hidden;
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease;
    min-height: 120px;
  }

  .hero-card:hover:not(.locked) {
    transform: translateY(-2px);
    box-shadow: 0 8px 32px
      color-mix(in srgb, var(--category-color) 25%, transparent);
  }

  .hero-card:active:not(.locked) {
    transform: translateY(0);
  }

  .hero-card.locked {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .card-bg {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--category-color) 15%, var(--theme-panel-bg)) 0%,
      color-mix(in srgb, var(--category-color) 5%, var(--theme-panel-bg)) 100%
    );
    z-index: 0;
  }

  .card-content {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding: 1.25rem;
  }

  /* Icon area */
  .icon-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .icon-wrapper {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--category-color) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--category-color) 35%, transparent);
    border-radius: 14px;
  }

  .icon-wrapper i {
    font-size: 1.5rem;
    color: var(--category-color);
    filter: drop-shadow(
      0 0 8px color-mix(in srgb, var(--category-color) 50%, transparent)
    );
  }

  .category-label {
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 600;
    color: var(--category-color);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Info area */
  .info-area {
    flex: 1;
    min-width: 0;
    text-align: left;
  }

  .title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--theme-text);
    margin: 0 0 0.25rem;
    line-height: 1.2;
  }

  .description {
    font-size: 0.875rem;
    color: var(--theme-text-dim);
    margin: 0 0 0.625rem;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .meta {
    display: flex;
    gap: 1rem;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8125rem;
    color: var(--theme-text-dim);
  }

  .meta-item i {
    font-size: var(--font-size-compact, 0.75rem);
    color: var(--category-color);
    opacity: 0.7;
  }

  /* CTA area */
  .cta-area {
    flex-shrink: 0;
  }

  .cta-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    padding: 0.875rem 1.25rem;
    min-width: 80px;
    min-height: var(--min-touch-target);
    background: var(--category-color);
    border-radius: 12px;
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--category-color) 40%, transparent);
    transition:
      transform 0.15s ease,
      box-shadow 0.15s ease;
  }

  .hero-card:hover:not(.locked) .cta-button {
    transform: scale(1.05);
    box-shadow: 0 6px 20px
      color-mix(in srgb, var(--category-color) 50%, transparent);
  }

  .cta-button i {
    font-size: 1rem;
    color: var(--theme-text, #ffffff);
  }

  .cta-button span {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .hero-card.locked .cta-button {
    background: var(--theme-card-bg);
    box-shadow: none;
  }

  /* Mobile: stack vertically */
  @media (max-width: 500px) {
    .card-content {
      flex-direction: column;
      text-align: center;
    }

    .info-area {
      text-align: center;
    }

    .meta {
      justify-content: center;
    }

    .cta-button {
      flex-direction: row;
      width: 100%;
      justify-content: center;
      padding: 1rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hero-card,
    .cta-button {
      transition: none;
    }
  }
</style>
