<!--
  FuseTour - Content-only tour card for the Fuse tab walkthrough.

  Renders the icon, title, description, dots, and buttons for the current stop.
  Does NOT render overlays or position itself - the parent (FuseLayout) handles that.

  variant="fullscreen": large centered layout for when the tour takes over the screen.
  variant="banner":     compact horizontal-ish layout for when the tour sits above content.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { fuseTourState } from "../../state/fuse-tour-state.svelte";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";

  let {
    variant = "fullscreen" as "fullscreen" | "banner",
  }: {
    variant?: "fullscreen" | "banner";
  } = $props();

  interface StopContent {
    icon: string;
    iconColor: string;
    title: string;
    description: string;
    buttonText: string;
  }

  const STOP_CONTENT: StopContent[] = [
    {
      icon: "fa-fire",
      iconColor: "var(--tour-accent)",
      title: "Fuse",
      description:
        "Pick a blue prop path and a red prop path, then merge them into one complete sequence.",
      buttonText: "Show me",
    },
    {
      icon: "fa-columns",
      iconColor: "var(--tour-accent)",
      title: "Blue on the left, red on the right",
      description:
        "Both step in sync. The grid shows notation, the animation shows motion.",
      buttonText: "Next",
    },
    {
      icon: "fa-shuffle",
      iconColor: "var(--tour-accent)",
      title: "Try shuffling",
      description: "Tap a Shuffle button to see a different prop path.",
      buttonText: "",
    },
    {
      icon: "fa-fire",
      iconColor: "var(--tour-accent)",
      title: "Fuse them together",
      description: "When you like both sides, tap Fuse.",
      buttonText: "",
    },
  ];

  const current = $derived(
    STOP_CONTENT[fuseTourState.currentStopIndex] ?? STOP_CONTENT[0]!
  );

  // Shuffle stop: user must shuffle to advance, not tap Next.
  const isWaiting = $derived(
    fuseTourState.currentStop === "shuffle" && !fuseTourState.actionCompleted
  );

  // Show Next button only when there's button text and we're not waiting for action.
  const showNext = $derived(!!current.buttonText && !isWaiting);

  let hapticService: HapticFeedback | null = null;
  try {
    hapticService = getHapticFeedback();
  } catch {}

  function handleNext() {
    if (isWaiting) return;
    hapticService?.trigger("selection");
    fuseTourState.advance();
  }

  function handleSkip() {
    hapticService?.trigger("selection");
    fuseTourState.skip();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!fuseTourState.isActive) return;
    if (event.key === "Escape") {
      event.preventDefault();
      handleSkip();
    } else if (
      showNext &&
      (event.key === "Enter" || event.key === " " || event.key === "ArrowRight")
    ) {
      event.preventDefault();
      handleNext();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      fuseTourState.goBack();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if fuseTourState.isActive}
  <div class="tour-content {variant}">
    <div
      class="tour-icon"
      class:icon-sm={variant === "banner"}
      style="--icon-color: {current.iconColor};"
    >
      <i class="fas {current.icon}" aria-hidden="true"></i>
    </div>

    <div class="tour-text">
      <h3 class="tour-title" class:title-sm={variant === "banner"}>
        {current.title}
      </h3>
      <p class="tour-desc" class:desc-sm={variant === "banner"}>
        {current.description}
      </p>
    </div>

    <div class="tour-footer" class:footer-row={variant === "banner"}>
      <div class="tour-dots">
        {#each STOP_CONTENT as _, i}
          <div
            class="dot"
            class:active={i === fuseTourState.currentStopIndex}
            class:completed={i < fuseTourState.currentStopIndex}
          ></div>
        {/each}
      </div>

      <div class="tour-actions">
        <button class="skip-btn" onclick={handleSkip}>Skip</button>

        {#if isWaiting}
          <span class="waiting-hint">
            <i class="fas fa-hand-pointer" aria-hidden="true"></i>
            Shuffle to continue
          </span>
        {:else if showNext}
          <button class="next-btn" onclick={handleNext}>
            {current.buttonText}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  /* ── Base layout ─────────────────────────────────────────────────── */

  .tour-content {
    /* Module-scoped tour accent — the deliberate Fuse orange, tokenized so it
       tracks the theme warning ramp while keeping the hex as fallback. */
    --tour-accent: var(--semantic-warning, #f97316);
    --tour-accent-light: var(--semantic-warning, #fb923c);
    --tour-accent-dark: var(--semantic-warning, #ea580c);

    display: flex;
    align-items: center;
    width: 100%;
    box-sizing: border-box;
  }

  /* Fullscreen: tall centered column */
  .tour-content.fullscreen {
    flex-direction: column;
    justify-content: center;
    gap: 20px;
    padding: 32px 24px;
    text-align: center;
    height: 100%;
  }

  /* Banner: compact column centred, sits above content */
  .tour-content.banner {
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    text-align: center;
  }

  /* ── Icon ────────────────────────────────────────────────────────── */

  .tour-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border-radius: 50%;
    background: color-mix(in srgb, var(--icon-color) 20%, transparent);
    border: 1.5px solid color-mix(in srgb, var(--icon-color) 35%, transparent);
    color: var(--icon-color);

    /* Fullscreen size (default) */
    width: 80px;
    height: 80px;
    font-size: 1.75rem;
  }

  .tour-icon.icon-sm {
    width: 40px;
    height: 40px;
    font-size: 1rem;
  }

  /* ── Text block ──────────────────────────────────────────────────── */

  .tour-text {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .tour-title {
    margin: 0;
    font-size: 2rem;
    font-weight: 700;
    color: white;
    line-height: 1.2;
  }

  .tour-title.title-sm {
    font-size: 1rem;
  }

  .tour-desc {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
    line-height: 1.6;
    max-width: 340px;
  }

  .fullscreen .tour-desc {
    align-self: center;
  }

  .tour-desc.desc-sm {
    font-size: var(--font-size-compact, 12px);
    max-width: 280px;
    line-height: 1.45;
  }

  /* ── Footer (dots + actions) ─────────────────────────────────────── */

  .tour-footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  /* Banner collapses dots + actions into one row */
  .tour-footer.footer-row {
    flex-direction: row;
    justify-content: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  /* ── Progress dots ───────────────────────────────────────────────── */

  .tour-dots {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.15));
    transition: background 0.2s ease, transform 0.2s ease;
  }

  .dot.active {
    background: var(--tour-accent);
    transform: scale(1.25);
  }

  .dot.completed {
    background: var(--theme-stroke-strong, rgba(255, 255, 255, 0.4));
  }

  /* ── Action buttons ──────────────────────────────────────────────── */

  .tour-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .skip-btn {
    padding: 12px 24px;
    min-height: 48px;
    background: transparent;
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }

  .skip-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
    color: var(--theme-text, white);
  }

  .next-btn {
    padding: 12px 28px;
    min-height: 48px;
    background: linear-gradient(
      135deg,
      var(--tour-accent-light) 0%,
      var(--tour-accent) 50%,
      var(--tour-accent-dark) 100%
    );
    border: none;
    border-radius: 10px;
    color: white;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: filter 0.15s ease, transform 0.1s ease;
  }

  .next-btn:hover {
    filter: brightness(1.1);
  }

  .next-btn:active {
    transform: scale(0.97);
  }

  /* ── Shuffle hint ────────────────────────────────────────────────── */

  .waiting-hint {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    min-height: 48px;
    color: var(--tour-accent);
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }

  /* ── Reduced motion ──────────────────────────────────────────────── */

  @media (prefers-reduced-motion: reduce) {
    .dot {
      transition: none;
    }
    .skip-btn,
    .next-btn {
      transition: none;
    }
    .next-btn:active {
      transform: none;
    }
    .waiting-hint {
      animation: none;
      opacity: 1;
    }
  }
</style>
