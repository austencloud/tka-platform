<!--
WordHeader.svelte

Word/sequence name display for animation area.
Displays ABOVE the canvas as a full-width header (matches image export style).

Uses simplifyRepeatedWord to handle repeated words (e.g., "ABAB" → "AB").
Does NOT truncate - allows full word length when needed for uniqueness.
Dark mode: Controlled via prop (for preview isolation) or falls back to :root.dark class.
Supports letter highlighting during animation playback.
-->
<script lang="ts">
  import { cubicOut, backOut } from "svelte/easing";
  import { safeSlide } from "$lib/shared/utils/transitions";
  import { simplifyRepeatedWord } from "$lib/features/create/shared/workspace-panel/shared/utils/word-simplifier";

  let {
    word = null,
    visible = true,
    darkMode = false,
    activeStepNumber = null,
  }: {
    word?: string | null;
    visible?: boolean;
    darkMode?: boolean;
    /** Current beat number during animation playback (1-indexed) for letter highlighting */
    activeStepNumber?: number | null;
  } = $props();

  // Animation state machine: "idle" | "exiting" | "entering"
  let animationPhase = $state<"idle" | "exiting" | "entering">("idle");

  // The word currently being displayed (may lag behind `word` during transitions)
  let displayedWord = $state<string | null>(null);

  // Track for detecting changes
  let wasVisible = $state(false);
  let lastWord = $state<string | null>(null);

  // Exit animation duration (per letter stagger + base)
  const EXIT_DURATION_BASE = 80;
  const EXIT_STAGGER_PER_LETTER = 40;
  const ENTER_DELAY = 100; // Gap between exit and enter

  // Handle visibility and word changes with proper exit → enter sequencing
  $effect(() => {
    const wordChanged = word !== lastWord && word !== null && lastWord !== null;
    const becameVisible = visible && !wasVisible;
    const initialMount = visible && displayedWord === null && word !== null;

    if (wordChanged && visible && animationPhase === "idle") {
      // Word changed while visible: exit old, then enter new
      animationPhase = "exiting";

      const oldLetterCount = displayedWord ? simplifyRepeatedWord(displayedWord).length : 1;
      const exitDuration = EXIT_DURATION_BASE + (oldLetterCount * EXIT_STAGGER_PER_LETTER);

      setTimeout(() => {
        displayedWord = word;
        animationPhase = "entering";

        setTimeout(() => {
          animationPhase = "idle";
        }, 400); // Enter animation duration
      }, exitDuration + ENTER_DELAY);
    } else if ((becameVisible || initialMount) && animationPhase === "idle") {
      // First appearance: just enter
      displayedWord = word;
      animationPhase = "entering";

      setTimeout(() => {
        animationPhase = "idle";
      }, 400);
    } else if (!visible && wasVisible) {
      // Hiding: reset state
      animationPhase = "idle";
    } else if (word !== lastWord && animationPhase === "idle") {
      // Word changed but wasn't visible before, just update
      displayedWord = word;
    }

    wasVisible = visible;
    lastWord = word;
  });

  // Derive display text from displayedWord (the word currently showing)
  const displayText = $derived(
    displayedWord ? simplifyRepeatedWord(displayedWord) : null
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
    <span class="word-text">
      {#if hasActiveHighlighting && parsedLetters.length > 0 && animationPhase === "idle"}
        <!-- Active playback mode: highlight current letter -->
        {#each parsedLetters as letter, index (index)}
          <span
            class="letter"
            class:active={activeLetterIndex === index}>{letter}</span
          >
        {/each}
      {:else}
        <!-- Animated mode: staggered enter/exit -->
        {#each parsedLetters as letter, index (index)}
          <span
            class="letter animated"
            class:entering={animationPhase === "entering"}
            class:exiting={animationPhase === "exiting"}
            class:visible={animationPhase === "idle"}
            style="--letter-index: {index}; --total-letters: {parsedLetters.length}; --reverse-index: {parsedLetters.length - 1 - index}"
          >{letter}</span>
        {/each}
      {/if}
    </span>
  </div>
{/if}

<style>
  /* Full-width header attached to canvas (matches image export style) */
  .word-header {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    box-sizing: border-box;
    flex-shrink: 0;
    /* Light mode: subtle gray background matching image export */
    background: linear-gradient(
      to bottom,
      rgba(248, 248, 248, 0.98),
      rgba(240, 240, 240, 0.98)
    );
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    /* Smooth transition synced with canvas background (150ms) */
    transition:
      background 150ms ease-out,
      border-color 150ms ease-out;
  }

  .word-text {
    font-family: Georgia, "Times New Roman", serif;
    font-weight: 700;
    /* Scale font with container width (now references content-wrapper which matches canvas) */
    font-size: clamp(12px, 6cqw, 28px);
    letter-spacing: 0.08em;
    text-align: center;
    /* Light mode: dark text, no pill background */
    color: #1f2937;
    /* Smooth transition synced with canvas background (150ms) */
    transition: color var(--duration-fast) ease-out;
    /* Prevent text from overflowing - truncate if needed */
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    /* Padding for word text */
    padding: clamp(6px, 3cqw, 12px) clamp(8px, 4cqw, 16px);
  }

  /* Dark mode: dark background with light text (via prop) */
  .word-header.dark-mode {
    background: linear-gradient(
      to bottom,
      rgba(15, 15, 20, 0.98),
      rgba(10, 10, 15, 0.98)
    );
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .word-header.dark-mode .word-text {
    color: #ffffff;
  }

  /* Fallback: Global .dark class only applies when NOT controlled by prop */
  /* data-controlled attribute marks prop-controlled instances */
  :global(:root.dark) .word-header:not([data-controlled]) {
    background: linear-gradient(
      to bottom,
      rgba(15, 15, 20, 0.98),
      rgba(10, 10, 15, 0.98)
    );
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  :global(:root.dark) .word-header:not([data-controlled]) .word-text {
    color: #ffffff;
  }

  /* Letter highlighting during animation playback */
  .letter {
    display: inline;
    color: rgba(31, 41, 55, 0.3); /* Light mode: dimmed dark text */
    transition:
      color 0.15s ease,
      text-shadow 0.15s ease;
  }

  .letter.active {
    color: #1f2937; /* Light mode: full dark text */
    text-shadow: 0 0 10px rgba(31, 41, 55, 0.3);
  }

  /* Animated letter states (entering, exiting, visible) */
  .letter.animated {
    display: inline-block;
    color: #1f2937; /* Full color during animation (not dimmed) */
    /* Start in hidden state */
    opacity: 0;
    transform: translateY(8px) scale(0.8);
  }

  /* Entering: animate from hidden to visible with staggered delay */
  .letter.animated.entering {
    animation: letterEnter var(--duration-emphasis) cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    animation-delay: calc(var(--letter-index) * (180ms / max(var(--total-letters), 4)));
  }

  /* Exiting: animate from visible to hidden with reverse stagger (last letter exits first visually feels better) */
  .letter.animated.exiting {
    opacity: 1;
    transform: translateY(0) scale(1);
    animation: letterExit var(--duration-normal) cubic-bezier(0.4, 0, 1, 1) forwards;
    animation-delay: calc(var(--letter-index) * (120ms / max(var(--total-letters), 4)));
  }

  /* Idle/visible: fully visible, no animation */
  .letter.animated.visible {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  @keyframes letterEnter {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.8);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes letterExit {
    from {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    to {
      opacity: 0;
      transform: translateY(-6px) scale(0.85);
    }
  }

  /* Dark mode animated letters */
  .word-header.dark-mode .letter.animated {
    color: #ffffff;
  }

  /* Dark mode letter styles */
  .word-header.dark-mode .letter {
    color: rgba(255, 255, 255, 0.25);
  }

  .word-header.dark-mode .letter.active {
    color: #ffffff;
    text-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
  }

  /* Global dark class fallback */
  :global(:root.dark) .word-header:not([data-controlled]) .letter {
    color: rgba(255, 255, 255, 0.25);
  }

  :global(:root.dark) .word-header:not([data-controlled]) .letter.active {
    color: #ffffff;
    text-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
  }

  :global(:root.dark) .word-header:not([data-controlled]) .letter.animated {
    color: #ffffff;
  }

  /* Accessibility: respect reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .letter.animated {
      animation: none;
      opacity: 1;
      transform: none;
    }

    .letter.animated.entering,
    .letter.animated.exiting,
    .letter.animated.visible {
      animation: none;
      opacity: 1;
      transform: none;
    }
  }
</style>
