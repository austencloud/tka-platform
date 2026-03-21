<script lang="ts">
  import { simplifyAndTruncate, simplifyRepeatedWord } from "../../shared/utils/word-simplifier";
  import type { LetterSource } from "$lib/features/create/spell/domain/models/spell-models";
  import { practiceAnimationStyle } from "../../../state/practice-animation-style.svelte";

  // Props
  let {
    word = "",
    scrollMode = false,
    letterSources = null,
    activeStepNumber = null,
  } = $props<{
    word?: string;
    scrollMode?: boolean;
    /** Optional: When provided, renders letters with different styles for original vs bridge */
    letterSources?: LetterSource[] | null;
    /** Optional: Current beat number during animation playback (1-indexed) for letter highlighting */
    activeStepNumber?: number | null;
  }>();

  // Computed: Whether we have letter source data to render styled letters
  const hasLetterSources = $derived(
    letterSources !== null && letterSources.length > 0
  );

  // Computed: Whether animation highlighting is active
  const hasActiveHighlighting = $derived(
    activeStepNumber !== null && activeStepNumber >= 1
  );

  // State
  let showCopiedMessage = $state(false);
  let copiedTimeout: number | null = $state(null);

  // Overflow detection state
  let labelElement: HTMLButtonElement | null = $state(null);
  let scaleFactor = $state(1);

  // Check if this is a contextual message (not a word)
  const isContextualMessage = $derived.by(() => {
    const contextualPhrases = [
      "Configure Your Settings",
      "Drawing Blue Hand Path",
      "Drawing Red Hand Path",
      "Sequence Complete!",
      "Draw Hand Path",
      "Choose your start position!",
      "Choose the blue starting location",
      "Configure sequence parameters",
      "Select your first beat!",
      "Choose your 1st pictograph!",
    ];
    return contextualPhrases.some((phrase) => word.includes(phrase));
  });

  /**
   * Check if text overflows its container and calculate scale factor.
   * Only shrinks when the text actually overflows - never preemptively.
   */
  function checkOverflow() {
    if (!labelElement) return;

    // Find the word-label-area (grandparent) which defines available space
    const wordLabelArea = labelElement.closest('.word-label-area') as HTMLElement | null;
    if (!wordLabelArea) return;

    const availableWidth = wordLabelArea.clientWidth;
    if (availableWidth <= 0) return;

    // Temporarily remove scale to measure true content width
    const prevTransform = labelElement.style.transform;
    labelElement.style.transform = 'none';

    // Force reflow to get accurate measurement
    const contentWidth = labelElement.scrollWidth;

    // Restore transform
    labelElement.style.transform = prevTransform;

    // Only scale down if content actually overflows available space
    // Use a small buffer (95% of available) to prevent edge-case jitter
    if (contentWidth > availableWidth * 0.95) {
      // Allow more aggressive scaling (down to 0.45) for very long words
      const newScale = Math.max(0.45, (availableWidth * 0.95) / contentWidth);
      scaleFactor = newScale;
    } else {
      scaleFactor = 1;
    }
  }

  // Re-check overflow when word changes
  $effect(() => {
    // Track word to trigger re-check
    const _ = word;
    // Reset and recheck after DOM updates
    scaleFactor = 1;
    // Wait for DOM to update with new word before measuring
    requestAnimationFrame(() => {
      checkOverflow();
    });
  });

  // Set up ResizeObserver to detect container size changes
  $effect(() => {
    if (!labelElement) return;

    const wordLabelArea = labelElement.closest('.word-label-area') as HTMLElement | null;

    const resizeObserver = new ResizeObserver(() => {
      checkOverflow();
    });

    if (wordLabelArea) {
      resizeObserver.observe(wordLabelArea);
    }

    return () => resizeObserver.disconnect();
  });

  // Derived simplified word (only truncate actual words, not contextual messages)
  const displayWord = $derived(
    isContextualMessage ? word : simplifyAndTruncate(word, 12)
  );

  // Full simplified word for copying (no truncation/ellipsis)
  const copyableWord = $derived(
    isContextualMessage ? word : simplifyRepeatedWord(word)
  );

  /**
   * Parse display word into TKA letter units (handles dash-letters like "Λ-")
   */
  const parsedLetters = $derived.by(() => {
    if (!displayWord || isContextualMessage) return [];
    const letters: string[] = [];
    for (let i = 0; i < displayWord.length; i++) {
      const char = displayWord[i]!;
      const nextChar = displayWord[i + 1];
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

  // Only show word label if there's an actual word (not empty, not default sequence names)
  const shouldShowWordLabel = $derived.by(() => {
    if (!word) return false;
    // Always show contextual messages
    if (isContextualMessage) return true;
    return true;
  });

  /**
   * Copy word to clipboard and show feedback
   */
  async function copyToClipboard() {
    // Don't copy contextual messages
    if (!word || isContextualMessage) return;

    try {
      await navigator.clipboard.writeText(copyableWord);

      // Show copied message
      showCopiedMessage = true;

      // Clear existing timeout
      if (copiedTimeout !== null) {
        clearTimeout(copiedTimeout);
      }

      // Hide message after 2 seconds
      copiedTimeout = window.setTimeout(() => {
        showCopiedMessage = false;
        copiedTimeout = null;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy word to clipboard:", err);
    }
  }
</script>

{#if shouldShowWordLabel}
  <div class="word-label-container" class:scroll-mode={scrollMode}>
    <button
      bind:this={labelElement}
      class="word-label"
      class:has-word={!!word && !isContextualMessage}
      class:contextual-message={isContextualMessage}
      class:has-letter-sources={hasLetterSources}
      class:is-scaled={scaleFactor < 1}
      style:--scale-factor={scaleFactor}
      onclick={copyToClipboard}
      title={isContextualMessage ? word : "Click to copy '{word}' to clipboard"}
      aria-label={isContextualMessage
        ? word
        : "Current word: {word}. Click to copy."}
    >
      {#if hasLetterSources && !isContextualMessage}
        <!-- Render each letter with styling based on original vs bridge -->
        {#each letterSources as source, index (index)}
          <span
            class="letter"
            class:original={source.isOriginal}
            class:bridge={!source.isOriginal}
            class:active={hasActiveHighlighting && activeLetterIndex === index}>{source.letter}</span
          >
        {/each}
      {:else if !isContextualMessage && parsedLetters.length > 0}
        <!-- Always render as individual letters for smooth transitions -->
        <!-- playback class adds dim styling when animating, fades out when stopped -->
        {#each parsedLetters as letter, index (index)}
          <span
            class="letter"
            class:playback={hasActiveHighlighting}
            class:active={hasActiveHighlighting && activeLetterIndex === index}
            class:active-intense={hasActiveHighlighting && activeLetterIndex === index && practiceAnimationStyle.current === 'intense'}
            class:active-subtle={hasActiveHighlighting && activeLetterIndex === index && practiceAnimationStyle.current === 'subtle'}
            class:active-glow-only={hasActiveHighlighting && activeLetterIndex === index && practiceAnimationStyle.current === 'glow-only'}
            class:active-minimal={hasActiveHighlighting && activeLetterIndex === index && practiceAnimationStyle.current === 'minimal'}
            class:active-wave={hasActiveHighlighting && activeLetterIndex === index && practiceAnimationStyle.current === 'wave'}>{letter}</span
          >
        {/each}
      {:else}
        {displayWord}
      {/if}
    </button>

    {#if showCopiedMessage}
      <div class="copied-message" role="status" aria-live="polite">
        Copied "{copyableWord}"!
      </div>
    {/if}
  </div>
{/if}

<style>
  .word-label-container {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    z-index: 10;
    pointer-events: none;
    /* Enable container queries for intrinsic sizing */
    container-type: inline-size;
    container-name: word-label;
    /* Constrain to parent width - prevents overflow into sibling buttons */
    max-width: 100%;
    overflow: visible;
  }

  .word-label {
    pointer-events: auto;
    font-family: Georgia, serif;
    font-weight: 600;
    /* Auto-scale font based on container width - shrinks for long words */
    font-size: clamp(1rem, 5cqi, 2.5rem);
    color: var(--text-color, #2c3e50);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    border-radius: 8px;
    text-align: center;
    white-space: nowrap;
    /* Constrain to container and show ellipsis if needed.
       Using inline-block (not inline-flex) so text-overflow: ellipsis works
       and centering via text-align doesn't clip both sides. */
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    display: inline-block;
    vertical-align: middle;
    padding: 0 8px;
    margin: 0;
  }

  .word-label:hover {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(4px);
    transform: scale(1.05);
  }

  .word-label:active {
    transform: scale(0.95);
  }

  .word-label.has-word {
    /* Scale based on container width - shrinks only for very long words */
    font-size: clamp(1.25rem, 6cqi, 2rem);
  }

  /* Apply dynamic scale factor when overflow is detected */
  .word-label.is-scaled {
    transform: scale(var(--scale-factor, 1));
    transform-origin: center;
  }

  /* Contextual messages (hand path status, etc.) - Container-aware sizing */
  .word-label.contextual-message {
    font-family:
      -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-weight: 600;
    /* Intrinsic sizing based on container width - scales from 1rem at 300px to 2.5rem at 800px+ */
    font-size: clamp(1rem, 5cqi, 2.5rem);
    max-width: 100%;
    padding: 0.5rem 1rem;
    white-space: nowrap;
    color: var(--text-color, #2c3e50);
  }

  /* Fine-tune sizing at different container widths */
  @container word-label (min-width: 600px) {
    .word-label.contextual-message {
      font-size: clamp(1.25rem, 5.5cqi, 2.5rem);
    }
  }

  @container word-label (min-width: 800px) {
    .word-label.contextual-message {
      font-size: clamp(1.5rem, 6cqi, 3rem);
    }
  }

  .word-label.contextual-message:hover {
    background: transparent;
    transform: none;
    cursor: default;
  }

  .copied-message {
    position: absolute;
    top: 110%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(46, 204, 113, 0.95);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    white-space: nowrap;
    animation: fadeInOut 2s ease;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  @keyframes fadeInOut {
    0% {
      opacity: 0;
      transform: translateX(-50%) translateY(-10px);
    }
    15% {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
    85% {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
    100% {
      opacity: 0;
      transform: translateX(-50%) translateY(-10px);
    }
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .word-label {
      font-size: clamp(1.25rem, 5cqi, 2rem);
      padding: 0.2rem 0.5rem;
    }

    .copied-message {
      font-size: 0.8rem;
      padding: 0.4rem 0.8rem;
    }
  }

  /* Ultra-narrow screens */
  @media (max-width: 480px) {
    .word-label {
      font-size: clamp(1rem, 6vw, 1.75rem);
    }
  }

  /* Letter source styling - original vs bridge letters */
  .letter {
    display: inline;
    /* Smooth transitions for all letter state changes (playback start/stop, highlighting) */
    transition:
      color 0.3s ease,
      text-shadow 0.3s ease,
      opacity 0.3s ease,
      font-weight 0.15s ease;
  }

  .letter.original {
    /* Original letters (user-typed) - bold and bright */
    font-weight: 700;
    color: var(--theme-text, #ffffff);
    opacity: 1;
  }

  .letter.bridge {
    /* Bridge letters (interpolated) - dimmed and smaller */
    font-weight: 400;
    font-size: 0.7em;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    opacity: 0.6;
  }

  /* When has letter sources, no extra spacing between letter spans */
  .word-label.has-letter-sources {
    word-spacing: 0;
    letter-spacing: 0;
  }

  /* Playback mode - non-active letters are dimmed during animation */
  .letter.playback {
    color: rgba(255, 255, 255, 0.25);
  }

  /* =========================================================================
     LETTER ANIMATION STYLES (TEMPORARY - for A/B testing)
     ========================================================================= */

  /* Base active state - shared by all variants */
  .letter.active {
    color: #fff;
    opacity: 1;
    font-weight: 700;
  }

  /* STYLE 1: INTENSE - pop with glow bloom (toned down to 80%) */
  .letter.active-intense {
    text-shadow: 0 0 14px rgba(255, 255, 255, 0.5), 0 0 28px rgba(255, 255, 255, 0.22);
    animation: letterPopIntense var(--duration-normal) cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes letterPopIntense {
    0% {
      transform: scale(1);
      text-shadow: 0 0 0 rgba(255, 255, 255, 0);
    }
    50% {
      transform: scale(1.10);
      text-shadow: 0 0 22px rgba(255, 255, 255, 0.8), 0 0 44px rgba(255, 255, 255, 0.35);
    }
    100% {
      transform: scale(1);
      text-shadow: 0 0 14px rgba(255, 255, 255, 0.5), 0 0 28px rgba(255, 255, 255, 0.22);
    }
  }

  /* STYLE 2: SUBTLE - gentle fade with slight scale */
  .letter.active-subtle {
    text-shadow: 0 0 12px rgba(255, 255, 255, 0.5);
    animation: letterFadeSubtle var(--duration-normal) ease-out;
  }

  @keyframes letterFadeSubtle {
    0% {
      transform: scale(1);
      text-shadow: 0 0 0 rgba(255, 255, 255, 0);
      opacity: 0.5;
    }
    100% {
      transform: scale(1.02);
      text-shadow: 0 0 12px rgba(255, 255, 255, 0.5);
      opacity: 1;
    }
  }

  /* STYLE 3: GLOW-ONLY - no scale, just glow appears */
  .letter.active-glow-only {
    text-shadow: 0 0 16px rgba(255, 255, 255, 0.6);
    animation: letterGlowOnly var(--duration-fast) ease-out;
  }

  @keyframes letterGlowOnly {
    0% {
      text-shadow: 0 0 0 rgba(255, 255, 255, 0);
    }
    100% {
      text-shadow: 0 0 16px rgba(255, 255, 255, 0.6);
    }
  }

  /* STYLE 4: MINIMAL - quick fade, almost instant */
  .letter.active-minimal {
    text-shadow: 0 0 8px rgba(255, 255, 255, 0.4);
    animation: letterMinimal 0.08s ease-out;
  }

  @keyframes letterMinimal {
    0% { opacity: 0.7; }
    100% { opacity: 1; }
  }

  /* STYLE 5: WAVE - pulse outward effect */
  .letter.active-wave {
    text-shadow: 0 0 14px rgba(255, 255, 255, 0.5);
    animation: letterWave var(--duration-dramatic) ease-out;
  }

  @keyframes letterWave {
    0% {
      transform: scale(0.95);
      text-shadow: 0 0 0 rgba(255, 255, 255, 0);
    }
    30% {
      transform: scale(1.08);
      text-shadow: 0 0 24px rgba(255, 255, 255, 0.8);
    }
    100% {
      transform: scale(1);
      text-shadow: 0 0 14px rgba(255, 255, 255, 0.5);
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .copied-message {
      animation: none;
    }
    .active-intense {
      animation: none;
    }
    .active-subtle {
      animation: none;
    }
    .active-glow-only {
      animation: none;
    }
    .active-minimal {
      animation: none;
    }
    .active-wave {
      animation: none;
    }
  }
</style>
