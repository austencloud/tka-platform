<!--
GameCard - Modern card-style game selection button

A visually engaging card with icon, title, and description for
selecting different game types. Features glass morphism styling
and smooth hover animations.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";
  import type { HapticFeedback } from "$lib/shared/application/services/implementations/HapticFeedback";
  import { onMount } from "svelte";
  import { QuizType } from "../domain/enums/quiz-enums";

  // Props
  let {
    text,
    lessonType,
    description = "",
    disabled = false,
    onClicked,
  } = $props<{
    text: string;
    lessonType: QuizType;
    description?: string;
    disabled?: boolean;
    onClicked?: (lessonType: QuizType) => void;
  }>();

  // Services
  let hapticService: HapticFeedback;

  onMount(() => {
    hapticService = getHapticFeedback();
  });

  // Get icon and enhanced text based on game type
  const gameConfig = $derived.by(() => {
    switch (lessonType) {
      case QuizType.PICTOGRAPH_TO_LETTER:
        return {
          icon: "pictograph-to-letter",
          title: "Name That Letter",
          subtitle: "See the pictograph, pick the letter",
        };
      case QuizType.LETTER_TO_PICTOGRAPH:
        return {
          icon: "letter-to-pictograph",
          title: "Find The Pictograph",
          subtitle: "See the letter, pick the symbol",
        };
      case QuizType.VALID_NEXT_PICTOGRAPH:
        return {
          icon: "sequence",
          title: "What Comes Next?",
          subtitle: "Pick the valid continuation",
        };
      case QuizType.SEQUENCE_TO_WORD:
        return {
          icon: "sequence-3d",
          title: "Read the Performer",
          subtitle: "Watch the moves, name the word",
        };
      default:
        return {
          icon: "default",
          title: text,
          subtitle: description,
        };
    }
  });

  // Handle button click
  function handleClick() {
    if (disabled) return;

    // Trigger selection haptic feedback for lesson selection
    hapticService?.trigger("selection");

    onClicked?.(lessonType);
  }
</script>

<button class="quiz-card" class:disabled onclick={handleClick} {disabled} aria-label={gameConfig.title}>
  <!-- Icon area -->
  <div class="card-icon">
    {#if gameConfig.icon === "pictograph-to-letter"}
      <svg viewBox="0 0 48 48" fill="none">
        <!-- Pictograph symbol -->
        <rect
          x="6"
          y="8"
          width="18"
          height="18"
          rx="3"
          stroke="currentColor"
          stroke-width="2.5"
          fill="var(--theme-stroke)"
        />
        <circle cx="15" cy="17" r="4" fill="currentColor" opacity="0.7" />
        <!-- Arrow -->
        <path
          d="M28 17h10m0 0l-4-4m4 4l-4 4"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <!-- Letter A -->
        <text
          x="33"
          y="40"
          font-family="Georgia, serif"
          font-size="16"
          font-weight="bold"
          fill="currentColor">A</text
        >
      </svg>
    {:else if gameConfig.icon === "letter-to-pictograph"}
      <svg viewBox="0 0 48 48" fill="none">
        <!-- Letter A -->
        <text
          x="6"
          y="26"
          font-family="Georgia, serif"
          font-size="20"
          font-weight="bold"
          fill="currentColor">A</text
        >
        <!-- Arrow -->
        <path
          d="M22 17h10m0 0l-4-4m4 4l-4 4"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <!-- Pictograph symbol -->
        <rect
          x="24"
          y="24"
          width="18"
          height="18"
          rx="3"
          stroke="currentColor"
          stroke-width="2.5"
          fill="var(--theme-stroke)"
        />
        <circle cx="33" cy="33" r="4" fill="currentColor" opacity="0.7" />
      </svg>
    {:else if gameConfig.icon === "sequence"}
      <svg viewBox="0 0 48 48" fill="none">
        <!-- Three connected boxes -->
        <rect
          x="4"
          y="16"
          width="12"
          height="12"
          rx="2"
          stroke="currentColor"
          stroke-width="2"
          fill="var(--theme-stroke)"
        />
        <rect
          x="18"
          y="16"
          width="12"
          height="12"
          rx="2"
          stroke="currentColor"
          stroke-width="2"
          fill="var(--theme-stroke)"
        />
        <rect
          x="32"
          y="16"
          width="12"
          height="12"
          rx="2"
          stroke="currentColor"
          stroke-width="2"
          stroke-dasharray="3 2"
        />
        <!-- Question mark -->
        <text
          x="35"
          y="26"
          font-family="Georgia, serif"
          font-size="10"
          font-weight="bold"
          fill="currentColor"
          opacity="0.7">?</text
        >
        <!-- Connecting dots -->
        <circle cx="10" cy="22" r="2" fill="currentColor" opacity="0.5" />
        <circle cx="24" cy="22" r="2" fill="currentColor" opacity="0.5" />
      </svg>
    {:else if gameConfig.icon === "sequence-3d"}
      <svg viewBox="0 0 48 48" fill="none">
        <!-- Performer silhouette -->
        <circle cx="24" cy="10" r="4" fill="currentColor" opacity="0.8" />
        <path
          d="M24 14 L24 28 M18 20 L30 20 M20 36 L24 28 L28 36"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <!-- Question mark bubble -->
        <rect x="30" y="4" width="14" height="12" rx="3" stroke="currentColor" stroke-width="1.5" fill="var(--theme-stroke)" />
        <text x="37" y="13" font-family="Georgia, serif" font-size="9" font-weight="bold" fill="currentColor" text-anchor="middle">?</text>
      </svg>
    {:else}
      <svg viewBox="0 0 48 48" fill="none">
        <circle
          cx="24"
          cy="24"
          r="16"
          stroke="currentColor"
          stroke-width="2.5"
          fill="var(--theme-stroke)"
        />
        <text
          x="24"
          y="29"
          font-family="Georgia, serif"
          font-size="14"
          font-weight="bold"
          fill="currentColor"
          text-anchor="middle">?</text
        >
      </svg>
    {/if}
  </div>

  <!-- Content area -->
  <div class="card-content">
    <h3 class="card-title">{gameConfig.title}</h3>
    <p class="card-subtitle">{gameConfig.subtitle}</p>
  </div>

  <!-- Arrow indicator -->
  <div class="card-arrow">
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  </div>

  <!-- Hover shine effect -->
  <div class="shine-effect"></div>
</button>

<style>
  .quiz-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    padding: 20px 24px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke-strong);
    border-radius: 20px;
    cursor: pointer;
    transition: all var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
    text-align: left;
    box-shadow:
      0 4px 20px color-mix(in srgb, var(--theme-panel-bg) 10%, transparent),
      inset 0 1px 0 color-mix(in srgb, var(--theme-text) 8%, transparent);
  }

  .quiz-card:hover:not(.disabled) {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
    transform: translateY(-3px) scale(1.01);
    box-shadow:
      0 8px 32px color-mix(in srgb, var(--theme-panel-bg) 15%, transparent),
      0 0 0 1px var(--theme-stroke, rgba(255, 255, 255, 0.1)) inset,
      0 0 30px color-mix(in srgb, var(--theme-accent) 10%, transparent);
  }

  .quiz-card:active:not(.disabled) {
    transform: translateY(-1px) scale(0.995);
    transition-duration: var(--duration-instant);
  }

  .quiz-card.disabled {
    opacity: 0.45;
    cursor: not-allowed;
    filter: grayscale(0.3);
  }

  .quiz-card:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 80%, transparent);
    outline-offset: 3px;
  }

  /* Icon area */
  .card-icon {
    flex-shrink: 0;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent) 20%, transparent),
      color-mix(in srgb, var(--theme-accent) 15%, transparent)
    );
    border-radius: 14px;
    color: var(--theme-text);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 30%, transparent);
    transition: all var(--duration-emphasis) ease;
  }

  .card-icon svg {
    width: 32px;
    height: 32px;
  }

  .quiz-card:hover:not(.disabled) .card-icon {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent) 35%, transparent),
      color-mix(in srgb, var(--theme-accent) 25%, transparent)
    );
    border-color: color-mix(in srgb, var(--theme-accent) 50%, transparent);
    transform: scale(1.05);
  }

  /* Content area */
  .card-content {
    flex: 1;
    min-width: 0;
  }

  .card-title {
    margin: 0 0 4px 0;
    font-family: var(
      --font-sans,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif
    );
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    line-height: 1.3;
  }

  .card-subtitle {
    margin: 0;
    font-family: var(
      --font-sans,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif
    );
    font-size: 0.875rem;
    color: var(--theme-text-dim);
    line-height: 1.4;
  }

  /* Arrow indicator */
  .card-arrow {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    transition: all var(--duration-emphasis) ease;
  }

  .quiz-card:hover:not(.disabled) .card-arrow {
    color: var(--theme-text, rgba(255, 255, 255, 0.8));
    transform: translateX(4px);
  }

  /* Shine effect */
  .shine-effect {
    position: absolute;
    top: 0;
    left: -100%;
    width: 50%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      var(--theme-card-bg),
      transparent
    );
    transform: skewX(-20deg);
    transition: left 600ms ease;
    pointer-events: none;
  }

  .quiz-card:hover:not(.disabled) .shine-effect {
    left: 150%;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .quiz-card {
      padding: 18px 20px;
      gap: 14px;
      border-radius: 18px;
    }

    .card-icon {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      border-radius: 12px;
    }

    .card-icon svg {
      width: 28px;
      height: 28px;
    }

    .card-title {
      font-size: 1rem;
    }

    .card-subtitle {
      font-size: 0.8125rem;
    }
  }

  @media (max-width: 480px) {
    .quiz-card {
      padding: 16px 16px;
      gap: 12px;
      border-radius: 16px;
    }

    .card-icon {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      border-radius: 10px;
    }

    .card-icon svg {
      width: 24px;
      height: 24px;
    }

    .card-title {
      font-size: 0.9375rem;
    }

    .card-subtitle {
      font-size: 0.75rem;
    }

    .card-arrow svg {
      width: 18px;
      height: 18px;
    }
  }

  @media (max-width: 360px) {
    .quiz-card {
      padding: 14px 12px;
      gap: 10px;
    }

    .card-icon {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
    }

    .card-icon svg {
      width: 22px;
      height: 22px;
    }

    .card-title {
      font-size: 0.875rem;
    }

    .card-subtitle {
      font-size: var(--font-size-compact, 12px);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .quiz-card,
    .card-icon,
    .card-arrow,
    .shine-effect {
      transition: none;
    }

    .shine-effect {
      display: none;
    }
  }
</style>
