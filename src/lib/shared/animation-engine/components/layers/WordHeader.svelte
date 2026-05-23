<!--
WordHeader.svelte

Word/sequence name display for animation area.
Displays ABOVE the canvas as a full-width header (matches image export style).

Uses simplifyAndTruncate to match the workspace WordLabel's shortened display.
Truncates to 12 letter units max to reduce visual overwhelm during playback.
Dark mode: Controlled via prop (for preview isolation) or falls back to :root.dark class.
Supports letter highlighting during animation playback.
-->
<script lang="ts">
  import { cubicOut } from "svelte/easing";
  import { safeSlide } from "$lib/shared/utils/transitions";
  import { simplifyAndTruncate } from "$lib/shared/foundation/utils/word-simplifier";
  import { untrack } from "svelte";
  import DifficultyBadge from "$lib/shared/components/DifficultyBadge.svelte";
  import LOOPIconStrip from "$lib/shared/components/LOOPIconStrip.svelte";
  import type { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
  import type { Period } from "$lib/shared/foundation/domain/models/generation/circular-models";
  import { getGlyphCache } from "$lib/shared/render/getGlyphCache";
  import { isDashLetter, getBaseLetter } from "$lib/shared/pictograph/tka-glyph/utils/letter-image-getter";
  import { browser } from "$app/environment";

  const cache = browser ? getGlyphCache() : null;

  function getGlyphUrl(letter: string): string | null {
    if (!cache) return null;
    const base = isDashLetter(letter) ? getBaseLetter(letter) : letter;
    return cache.getGlyphDataUrl(base);
  }

  function isAlphaGlyph(letter: string): boolean {
    const base = isDashLetter(letter) ? getBaseLetter(letter) : letter;
    return base === 'α';
  }

  let {
    word = null,
    visible = true,
    darkMode = false,
    activeStepNumber = null,
    difficultyLevel = null,
    loopComponents = null,
    rotationPeriod,
    inversionPeriod,
    loopPeriod,
  }: {
    word?: string | null;
    visible?: boolean;
    darkMode?: boolean;
    activeStepNumber?: number | null;
    difficultyLevel?: number | null;
    loopComponents?: Set<LOOPComponent> | null;
    rotationPeriod?: Period;
    inversionPeriod?: Period;
    loopPeriod?: number;
  } = $props();

  // Animation state machine: "idle" | "exiting" | "entering"
  let animationPhase = $state<"idle" | "exiting" | "entering">("idle");

  // The word currently being displayed (may lag behind `word` during transitions)
  let displayedWord = $state<string | null>(null);

  // Track for detecting changes (not reactive - only read/written inside the effect)
  let wasVisible = false;
  let lastWord: string | null = null;

  // Timers live at component level so cleanup doesn't race with effect re-runs
  let exitTimer: ReturnType<typeof setTimeout> | undefined;
  let enterTimer: ReturnType<typeof setTimeout> | undefined;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  function clearAnimationTimers() {
    clearTimeout(exitTimer);
    clearTimeout(enterTimer);
    clearTimeout(idleTimer);
    exitTimer = enterTimer = idleTimer = undefined;
  }

  // Exit animation duration (per letter stagger + base)
  const EXIT_DURATION_BASE = 80;
  const EXIT_STAGGER_PER_LETTER = 40;
  const ENTER_DELAY = 100; // Gap between exit and enter

  // Handle visibility and word changes with proper exit → enter sequencing.
  // Only tracks `word` and `visible` props. Internal state (animationPhase,
  // displayedWord, wasVisible, lastWord) is read via untrack() to prevent
  // the effect from re-triggering when it writes to them.
  $effect(() => {
    // Track these two props as dependencies
    const currentWord = word;
    const currentlyVisible = visible;

    // Read internal state without tracking - this effect manages these values,
    // so re-triggering on its own writes would cause a cleanup race condition
    // that clears animation timers before they fire.
    const prevWord = untrack(() => lastWord);
    const prevVisible = untrack(() => wasVisible);
    const currentDisplayedWord = untrack(() => displayedWord);
    const currentPhase = untrack(() => animationPhase);

    const wordChanged = currentWord !== prevWord && currentWord !== null && prevWord !== null;
    const becameVisible = currentlyVisible && !prevVisible;
    const initialMount = currentlyVisible && currentDisplayedWord === null && currentWord !== null;

    if (wordChanged && currentlyVisible && currentPhase === "idle") {
      // Word changed while visible: exit old, then enter new
      clearAnimationTimers();
      animationPhase = "exiting";

      const oldLetterCount = currentDisplayedWord ? simplifyAndTruncate(currentDisplayedWord, 12).length : 1;
      const exitDuration = EXIT_DURATION_BASE + (oldLetterCount * EXIT_STAGGER_PER_LETTER);

      exitTimer = setTimeout(() => {
        displayedWord = currentWord;
        animationPhase = "entering";

        enterTimer = setTimeout(() => {
          animationPhase = "idle";
        }, 400); // Enter animation duration
      }, exitDuration + ENTER_DELAY);
    } else if ((becameVisible || initialMount) && currentPhase === "idle") {
      // First appearance: just enter
      clearAnimationTimers();
      displayedWord = currentWord;
      animationPhase = "entering";

      idleTimer = setTimeout(() => {
        animationPhase = "idle";
      }, 400);
    } else if (!currentlyVisible && prevVisible) {
      // Hiding: reset state
      clearAnimationTimers();
      animationPhase = "idle";
    } else if (currentWord !== prevWord && currentPhase === "idle") {
      // Word changed but wasn't visible before, just update
      displayedWord = currentWord;
    }

    wasVisible = currentlyVisible;
    lastWord = currentWord;
  });

  // Derive display text from displayedWord (the word currently showing)
  // Uses simplifyAndTruncate to match the workspace WordLabel's shortened display
  const displayText = $derived(
    displayedWord ? simplifyAndTruncate(displayedWord, 12) : null
  );

  // Computed: Whether animation highlighting is active
  const hasActiveHighlighting = $derived(
    activeStepNumber !== null && activeStepNumber >= 1
  );

  /**
   * Parse display text into TKA letter units (handles dash-letters like "Λ-")
   */
  const parsedLetters = $derived.by(() => {
    if (!displayText) return [];
    const letters: string[] = [];
    for (let i = 0; i < displayText.length; i++) {
      const char = displayText[i]!;
      const nextChar = displayText[i + 1];
      // Check if this is a dash-letter (e.g., "Λ-", "X-")
      if (nextChar === "-") {
        letters.push(char + "-");
        i++; // Skip the dash on next iteration
      } else {
        letters.push(char);
      }
    }
    return letters;
  });

  /**
   * Active letter index with wrapping for circular sequences (0-indexed)
   */
  const activeLetterIndex = $derived.by(() => {
    if (!hasActiveHighlighting || parsedLetters.length === 0) return -1;
    // activeStepNumber is 1-indexed, modulo to wrap around
    return (activeStepNumber! - 1) % parsedLetters.length;
  });


</script>

{#if visible && displayText}
  <div
    class="word-header"
    class:dark-mode={darkMode}
    data-controlled="true"
    transition:safeSlide={{ duration: 350, easing: cubicOut }}
  >
    {#if difficultyLevel != null}
      <div class="badge-wrapper">
        <DifficultyBadge level={difficultyLevel} size="clamp(24px, 7cqw, 34px)" fontSize="clamp(12px, 4cqw, 18px)" />
      </div>
    {/if}

    <span class="word-text">
      {#if hasActiveHighlighting && parsedLetters.length > 0 && animationPhase === "idle"}
        {#each parsedLetters as letter, index (index)}
          {@const url = getGlyphUrl(letter)}
          <span
            class="letter"
            class:active={activeLetterIndex === index}
          >
            {#if url}
              <img src={url} alt={letter} class="glyph-img" class:alpha-baseline={isAlphaGlyph(letter)} draggable="false" />
              {#if isDashLetter(letter)}<span class="dash-bar"></span>{/if}
            {:else}{letter}{/if}
          </span>
        {/each}
      {:else}
        {#each parsedLetters as letter, index (index)}
          {@const url = getGlyphUrl(letter)}
          <span
            class="letter animated"
            class:entering={animationPhase === "entering"}
            class:exiting={animationPhase === "exiting"}
            class:visible={animationPhase === "idle"}
            style="--letter-index: {index}; --total-letters: {parsedLetters.length}; --reverse-index: {parsedLetters.length - 1 - index}"
          >
            {#if url}
              <img src={url} alt={letter} class="glyph-img" class:alpha-baseline={isAlphaGlyph(letter)} draggable="false" />
              {#if isDashLetter(letter)}<span class="dash-bar"></span>{/if}
            {:else}{letter}{/if}
          </span>
        {/each}
      {/if}
    </span>

    {#if loopComponents}
      <div class="loop-icon-badge">
        <LOOPIconStrip
          activeComponents={loopComponents}
          {rotationPeriod}
          {inversionPeriod}
          period={loopPeriod}
          size={20}
          darkMode={darkMode}
          showFreeformWhenEmpty={false}
        />
      </div>
    {/if}
  </div>
{/if}

<style>
  /* Full-width header attached to canvas (matches image export style) */
  .word-header {
    width: 100%;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    flex-shrink: 0;
    background: var(--theme-panel-bg, rgb(240, 240, 240));
    border-bottom: 1px solid var(--theme-stroke, rgba(0, 0, 0, 0.08));
    /* Smooth transition synced with canvas background (150ms) */
    transition:
      background 150ms ease-out,
      border-color 150ms ease-out;
  }

  .badge-wrapper {
    position: absolute;
    left: clamp(6px, 3cqw, 12px);
    top: 50%;
    transform: translateY(-50%);
  }

  .loop-icon-badge {
    position: absolute;
    right: clamp(6px, 3cqw, 12px);
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    padding: 2px 4px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    height: clamp(24px, 7cqw, 34px);
  }

  .word-header.dark-mode .loop-icon-badge {
    background: rgba(255, 255, 255, 0.1);
  }

  .word-text {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.08em;
    font-size: clamp(12px, 6cqw, 28px);
    max-width: 100%;
    overflow: hidden;
    white-space: nowrap;
    padding: clamp(6px, 3cqw, 12px) clamp(8px, 4cqw, 16px);
  }

  .word-header.dark-mode {
    background: var(--theme-panel-bg, rgb(15, 15, 20));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  :global(:root.dark) .word-header:not([data-controlled]) {
    background: var(--theme-panel-bg, rgb(15, 15, 20));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .glyph-img {
    height: 1em;
    width: auto;
    display: block;
  }

  .glyph-img.alpha-baseline {
    transform: translateY(10%);
  }

  .word-header.dark-mode .glyph-img,
  :global(:root.dark) .word-header:not([data-controlled]) .glyph-img {
    filter: invert(0.9);
  }

  .dash-bar {
    display: inline-block;
    height: 0.20em;
    width: 0.70em;
    background: currentColor;
    border-radius: 9999px;
    flex-shrink: 0;
  }

  .letter {
    display: inline-flex;
    align-items: center;
    gap: 0.08em;
    opacity: 0.2;
    transition:
      filter 0.15s ease,
      opacity 0.15s ease;
  }

  .letter.active {
    opacity: 1;
    filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.3));
  }

  .letter.animated {
    display: inline-flex;
    opacity: 0;
    transform: translateY(8px) scale(0.8);
  }

  .letter.animated.entering {
    animation: letterEnter var(--duration-emphasis) cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    animation-delay: calc(var(--letter-index) * (180ms / max(var(--total-letters), 4)));
  }

  .letter.animated.exiting {
    opacity: 1;
    transform: translateY(0) scale(1);
    animation: letterExit var(--duration-normal) cubic-bezier(0.4, 0, 1, 1) forwards;
    animation-delay: calc(var(--letter-index) * (120ms / max(var(--total-letters), 4)));
  }

  .letter.animated.visible {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  @keyframes letterEnter {
    from { opacity: 0; transform: translateY(8px) scale(0.8); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes letterExit {
    from { opacity: 1; transform: translateY(0) scale(1); }
    to { opacity: 0; transform: translateY(-6px) scale(0.85); }
  }

  @media (prefers-reduced-motion: reduce) {
    .letter.animated,
    .letter.animated.entering,
    .letter.animated.exiting,
    .letter.animated.visible {
      animation: none;
      opacity: 1;
      transform: none;
    }
  }
</style>
