<script lang="ts">
  import { onDestroy } from "svelte";
  import {
    compressWord,
    simplifyAndTruncate,
    simplifyRepeatedWord,
  } from "$lib/shared/foundation/utils/word-simplifier";
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type {
    ContextMenuEntry,
    ContextMenuState,
  } from "$lib/shared/components/context-menu/context-menu-types";
  import type { LetterSource } from "$lib/shared/create/domain/spell-models";
  import { getErrorHandler } from "$lib/shared/application/get-error-handler";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { getPronunciationPlayer } from "$lib/shared/pronunciation/get-pronunciation-player";
  import type { IPronunciationPlayer } from "$lib/shared/pronunciation/services/types";
  import { practiceAnimationStyle } from "../../../state/practice-animation-style.svelte";
  import { getGlyphCache } from "$lib/shared/render/get-glyph-cache";
  import { isDashLetter, getBaseLetter } from "$lib/shared/pictograph/tka-glyph/utils/letter-image-getter";
  import { browser } from "$app/environment";

  const cache = browser ? getGlyphCache() : null;

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
  let menuState: ContextMenuState = $state({ open: false });

  const LONG_PRESS_MS = 500;
  const DRAG_THRESHOLD_PX = 8;
  const FOLLOW_UP_EVENT_WINDOW_MS = 1_000;
  let longPressTimer: number | null = null;
  let longPressStartX = 0;
  let longPressStartY = 0;
  let longPressMoved = false;
  let suppressClickUntil = 0;
  let suppressContextMenuUntil = 0;
  let pronunciationPlayer: IPronunciationPlayer | null = null;

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
      "Select your first step!",
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

  // LOOP transformations can produce adjacent repeated runs rather than one
  // repeated whole word. Show each run once with the same separator used by
  // animation headers, card glyphs, and exports.
  const compressedSegments = $derived.by(() => {
    if (!word || isContextualMessage) return null;
    const segments = compressWord(word);
    if (!segments.some((segment) => segment.repeat > 1)) return null;
    const letterCount = segments.reduce(
      (count, segment) => count + segment.tokens.length,
      0
    );
    return letterCount <= 12 ? segments : null;
  });

  // Full simplified word for copying (no truncation/ellipsis)
  const copyableWord = $derived(
    isContextualMessage
      ? word
      : compressedSegments
        ? compressedSegments
            .map((segment) => segment.tokens.join(""))
            .join(" · ")
        : simplifyRepeatedWord(word)
  );

  const wordMenuItems: ContextMenuEntry[] = [
    {
      id: "copy-word",
      label: "Copy word",
      icon: "fa-copy",
      action: copyToClipboard,
    },
    {
      id: "read-word-aloud",
      label: "Read aloud",
      icon: "fa-volume-high",
      action: readWordAloud,
    },
  ];

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

  type DisplayUnit =
    | {
        kind: "letter";
        letter: string;
        letterIdx: number;
        source: LetterSource | null;
      }
    | { kind: "dot" };

  const displayUnits = $derived.by((): DisplayUnit[] => {
    if (isContextualMessage) return [];

    if (compressedSegments) {
      const units: DisplayUnit[] = [];
      let letterIdx = 0;
      let sourceOffset = 0;

      compressedSegments.forEach((segment, segmentIdx) => {
        if (segmentIdx > 0) units.push({ kind: "dot" });
        segment.tokens.forEach((letter, tokenIdx) => {
          units.push({
            kind: "letter",
            letter,
            letterIdx: letterIdx++,
            source: letterSources?.[sourceOffset + tokenIdx] ?? null,
          });
        });
        sourceOffset += segment.tokens.length * segment.repeat;
      });

      return units;
    }

    if (hasLetterSources) {
      return letterSources!.map((source: LetterSource, letterIdx: number) => ({
        kind: "letter" as const,
        letter: source.letter,
        letterIdx,
        source,
      }));
    }

    return parsedLetters.map((letter, letterIdx) => ({
      kind: "letter" as const,
      letter,
      letterIdx,
      source: null,
    }));
  });

  /**
   * Active letter index with wrapping for circular sequences (0-indexed).
   * Compressed runs still follow the expanded beat count, then map each beat
   * back to the representative letters visible in the label.
   */
  const activeLetterIndex = $derived.by(() => {
    if (!hasActiveHighlighting) return -1;
    if (compressedSegments) {
      const total = compressedSegments.reduce(
        (count, segment) => count + segment.tokens.length * segment.repeat,
        0
      );
      if (total === 0) return -1;

      let expandedIndex = (activeStepNumber! - 1) % total;
      let displayOffset = 0;
      for (const segment of compressedSegments) {
        const span = segment.tokens.length * segment.repeat;
        if (expandedIndex < span) {
          return displayOffset + (expandedIndex % segment.tokens.length);
        }
        expandedIndex -= span;
        displayOffset += segment.tokens.length;
      }
      return -1;
    }

    const displayedLetterCount = displayUnits.filter(
      (unit) => unit.kind === "letter"
    ).length;
    if (displayedLetterCount === 0) return -1;
    // activeStepNumber is 1-indexed, modulo to wrap around
    return (activeStepNumber! - 1) % displayedLetterCount;
  });

  // Bumped when on-demand glyph loads resolve, so getGlyphUrl re-reads the
  // (non-reactive) GlyphCache and the rendered <img> swaps in once the SVG lands.
  let glyphLoadVersion = $state(0);

  // The letters this label needs glyphs for, from whichever source is active.
  const neededTokens = $derived.by<string[]>(() => {
    if (isContextualMessage) return [];
    return displayUnits.flatMap((unit) =>
      unit.kind === "letter" ? [unit.letter] : []
    );
  });

  // The global startup warm (+layout) is deferred to idle, so the cache is
  // usually cold when this label first paints — without this it falls back to
  // plain text and never recovers (the cache read isn't reactive). Load just
  // the letters this word needs on demand, then trigger a re-read.
  $effect(() => {
    const c = cache;
    if (!c) return;
    const tokens = neededTokens;
    if (tokens.length === 0) return;
    const bases = [
      ...new Set(tokens.map((t) => (isDashLetter(t) ? getBaseLetter(t) : t))),
    ];
    const missing = bases.filter((b) => b && !c.getGlyphDataUrl(b));
    if (missing.length === 0) return;
    c.loadGlyphsByLetter(missing).then(() => {
      glyphLoadVersion++;
    });
  });

  function getGlyphUrl(letter: string): string | null {
    void glyphLoadVersion; // re-read cache after on-demand loads resolve
    if (!cache) return null;
    const base = isDashLetter(letter) ? getBaseLetter(letter) : letter;
    return cache.getGlyphDataUrl(base);
  }

  function isAlphaGlyph(letter: string): boolean {
    const base = isDashLetter(letter) ? getBaseLetter(letter) : letter;
    return base === 'α';
  }

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
    } catch (error) {
      reportWordActionError(
        "Couldn't copy the word. Check clipboard access and try again.",
        "copy-word",
        error
      );
    }
  }

  async function readWordAloud() {
    if (!word || isContextualMessage) return;

    try {
      pronunciationPlayer ??= getPronunciationPlayer();
      await pronunciationPlayer.speak(copyableWord);
    } catch (error) {
      reportWordActionError(
        "Read aloud isn't available on this device.",
        "read-word-aloud",
        error
      );
    }
  }

  function reportWordActionError(
    message: string,
    action: string,
    cause: unknown
  ) {
    const error =
      cause instanceof Error ? cause : new Error(String(cause));
    getErrorHandler().showUserError({
      message,
      technicalDetails: error.message,
      error,
      severity: "warning",
      context: {
        module: "create",
        tab: "generate",
        action,
        additionalData: { word: copyableWord },
      },
    });
  }

  function openWordMenu(x: number, y: number) {
    if (!word || isContextualMessage) return;
    menuState = { open: true, x, y };
  }

  function openWordMenuAtLabel() {
    const rect = labelElement?.getBoundingClientRect();
    openWordMenu(
      rect?.left ?? window.innerWidth / 2,
      (rect?.bottom ?? window.innerHeight / 2) + 4
    );
  }

  function closeWordMenu() {
    menuState = { open: false };
  }

  function clearLongPressTimer() {
    if (longPressTimer === null) return;
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }

  function handlePointerDown(event: PointerEvent) {
    if (
      !word ||
      isContextualMessage ||
      event.button !== 0 ||
      event.pointerType === "mouse"
    ) {
      return;
    }

    clearLongPressTimer();
    longPressMoved = false;
    longPressStartX = event.clientX;
    longPressStartY = event.clientY;
    longPressTimer = window.setTimeout(() => {
      longPressTimer = null;
      if (longPressMoved) return;

      const now = Date.now();
      suppressClickUntil = now + FOLLOW_UP_EVENT_WINDOW_MS;
      suppressContextMenuUntil = now + FOLLOW_UP_EVENT_WINDOW_MS;
      getHapticFeedback().impact("light");
      openWordMenu(longPressStartX, longPressStartY);
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(event: PointerEvent) {
    if (longPressTimer === null || longPressMoved) return;
    const movedX = Math.abs(event.clientX - longPressStartX);
    const movedY = Math.abs(event.clientY - longPressStartY);
    if (movedX <= DRAG_THRESHOLD_PX && movedY <= DRAG_THRESHOLD_PX) return;

    longPressMoved = true;
    suppressClickUntil = Date.now() + FOLLOW_UP_EVENT_WINDOW_MS;
    clearLongPressTimer();
  }

  function handlePointerEnd() {
    clearLongPressTimer();
    longPressMoved = false;
  }

  function handleLabelClick(event: MouseEvent) {
    if (!word || isContextualMessage) return;
    event.preventDefault();

    if (Date.now() < suppressClickUntil) return;
    if (menuState.open) {
      closeWordMenu();
      return;
    }
    openWordMenuAtLabel();
  }

  function handleContextMenu(event: MouseEvent) {
    if (!word || isContextualMessage) return;
    event.preventDefault();
    event.stopPropagation();
    clearLongPressTimer();

    if (Date.now() < suppressContextMenuUntil) return;
    suppressClickUntil = Date.now() + FOLLOW_UP_EVENT_WINDOW_MS;
    if (event.clientX === 0 && event.clientY === 0) {
      openWordMenuAtLabel();
      return;
    }
    openWordMenu(event.clientX, event.clientY);
  }

  onDestroy(() => {
    clearLongPressTimer();
    if (copiedTimeout !== null) clearTimeout(copiedTimeout);
    pronunciationPlayer?.cancel();
  });
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
      disabled={isContextualMessage}
      onclick={handleLabelClick}
      oncontextmenu={handleContextMenu}
      onpointerdown={handlePointerDown}
      onpointermove={handlePointerMove}
      onpointerup={handlePointerEnd}
      onpointercancel={handlePointerEnd}
      onpointerleave={handlePointerEnd}
      title={isContextualMessage ? word : `Open word actions for ${copyableWord}`}
      aria-haspopup={isContextualMessage ? undefined : "menu"}
      aria-expanded={isContextualMessage ? undefined : menuState.open}
      aria-label={isContextualMessage
        ? word
        : `Current word: ${copyableWord}. Open word actions.`}
    >
      {#if !isContextualMessage && displayUnits.length > 0}
        {#each displayUnits as unit, index (index)}
          {#if unit.kind === "dot"}
            <span class="group-dot" aria-hidden="true"></span>
          {:else}
            {@const url = getGlyphUrl(unit.letter)}
            <span
              class="letter"
              class:original={unit.source?.isOriginal === true}
              class:bridge={unit.source?.isOriginal === false}
              class:playback={hasActiveHighlighting && unit.source === null}
              class:active={hasActiveHighlighting &&
                activeLetterIndex === unit.letterIdx}
              class:active-intense={hasActiveHighlighting &&
                activeLetterIndex === unit.letterIdx &&
                practiceAnimationStyle.current === "intense"}
              class:active-subtle={hasActiveHighlighting &&
                activeLetterIndex === unit.letterIdx &&
                practiceAnimationStyle.current === "subtle"}
              class:active-glow-only={hasActiveHighlighting &&
                activeLetterIndex === unit.letterIdx &&
                practiceAnimationStyle.current === "glow-only"}
              class:active-minimal={hasActiveHighlighting &&
                activeLetterIndex === unit.letterIdx &&
                practiceAnimationStyle.current === "minimal"}
              class:active-wave={hasActiveHighlighting &&
                activeLetterIndex === unit.letterIdx &&
                practiceAnimationStyle.current === "wave"}
            >
              {#if url}
                <img
                  src={url}
                  alt={unit.letter}
                  class="glyph-img"
                  class:alpha-baseline={isAlphaGlyph(unit.letter)}
                  draggable="false"
                />
                {#if isDashLetter(unit.letter)}<span class="dash-bar"
                  ></span>{/if}
              {:else}{unit.letter}{/if}
            </span>
          {/if}
        {/each}
      {:else}
        {displayWord}
      {/if}
      {#if !isContextualMessage}
        <i class="fas fa-chevron-down menu-indicator" aria-hidden="true"></i>
      {/if}
    </button>

    {#if !isContextualMessage}
      <ContextMenu
        {menuState}
        items={wordMenuItems}
        onClose={closeWordMenu}
      />
    {/if}

    {#if showCopiedMessage}
      <div class="copied-message" role="status" aria-live="polite">
        Copied “{copyableWord}”
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
    border: 1px solid transparent;
    cursor: pointer;
    transition:
      background-color var(--duration-normal) ease,
      border-color var(--duration-normal) ease,
      box-shadow var(--duration-normal) ease,
      transform var(--duration-normal) ease;
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
    touch-action: manipulation;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  }

  .word-label:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
    backdrop-filter: blur(4px);
    transform: scale(1.05);
  }

  .word-label:active {
    transform: scale(0.95);
  }

  .word-label.has-word {
    font-size: clamp(1.25rem, 6cqi, 2rem);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.12em;
    min-height: var(--min-touch-target, 44px);
    padding: 0.25rem 0.75rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .word-label.has-word[aria-expanded="true"] {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    box-shadow: 0 4px 14px var(--theme-shadow, rgba(0, 0, 0, 0.2));
  }

  .word-label:focus-visible {
    outline: 2px solid var(--theme-accent, #a855f7);
    outline-offset: 2px;
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

  .word-label.contextual-message:disabled {
    opacity: 1;
  }

  .menu-indicator {
    margin-left: 0.25em;
    font-size: 0.4em;
    opacity: 0.55;
    flex-shrink: 0;
    transition: transform var(--duration-fast, 100ms) ease;
  }

  .word-label[aria-expanded="true"] .menu-indicator {
    transform: rotate(180deg);
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

  .letter {
    display: inline-flex;
    align-items: center;
    gap: 0.08em;
    transition:
      filter 0.3s ease,
      opacity 0.3s ease;
  }

  .glyph-img {
    height: 1em;
    width: auto;
    display: block;
    filter: invert(0.9);
  }

  .glyph-img.alpha-baseline {
    transform: translateY(10%);
  }

  .dash-bar {
    display: inline-block;
    height: 0.20em;
    width: 0.70em;
    background: currentColor;
    border-radius: 9999px;
    flex-shrink: 0;
  }

  /* Segment separator for compressed words (HΨ- · GΨ-). */
  .group-dot {
    display: inline-block;
    width: 0.15em;
    height: 0.15em;
    margin: 0 0.1em;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.4;
    flex-shrink: 0;
  }

  .letter.original {
    opacity: 1;
  }

  .letter.bridge {
    opacity: 0.4;
    font-size: 0.7em;
  }

  /* When has letter sources, no extra spacing between letter spans */
  .word-label.has-letter-sources {
    word-spacing: 0;
    letter-spacing: 0;
  }

  .letter.playback {
    opacity: 0.25;
  }

  .letter.active {
    opacity: 1;
  }

  .letter.active-intense {
    filter: drop-shadow(0 0 14px rgba(255, 255, 255, 0.5)) drop-shadow(0 0 28px rgba(255, 255, 255, 0.22));
    animation: letterPopIntense var(--duration-normal) cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes letterPopIntense {
    0% { transform: scale(1); filter: none; }
    50% { transform: scale(1.10); filter: drop-shadow(0 0 22px rgba(255, 255, 255, 0.8)); }
    100% { transform: scale(1); filter: drop-shadow(0 0 14px rgba(255, 255, 255, 0.5)); }
  }

  .letter.active-subtle {
    filter: drop-shadow(0 0 12px rgba(255, 255, 255, 0.5));
    animation: letterFadeSubtle var(--duration-normal) ease-out;
  }

  @keyframes letterFadeSubtle {
    0% { transform: scale(1); opacity: 0.5; }
    100% { transform: scale(1.02); opacity: 1; filter: drop-shadow(0 0 12px rgba(255, 255, 255, 0.5)); }
  }

  .letter.active-glow-only {
    filter: drop-shadow(0 0 16px rgba(255, 255, 255, 0.6));
    animation: letterGlowOnly var(--duration-fast) ease-out;
  }

  @keyframes letterGlowOnly {
    0% { filter: none; }
    100% { filter: drop-shadow(0 0 16px rgba(255, 255, 255, 0.6)); }
  }

  .letter.active-minimal {
    filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.4));
    animation: letterMinimal 0.08s ease-out;
  }

  @keyframes letterMinimal {
    0% { opacity: 0.7; }
    100% { opacity: 1; }
  }

  .letter.active-wave {
    filter: drop-shadow(0 0 14px rgba(255, 255, 255, 0.5));
    animation: letterWave var(--duration-dramatic) ease-out;
  }

  @keyframes letterWave {
    0% { transform: scale(0.95); filter: none; }
    30% { transform: scale(1.08); filter: drop-shadow(0 0 24px rgba(255, 255, 255, 0.8)); }
    100% { transform: scale(1); filter: drop-shadow(0 0 14px rgba(255, 255, 255, 0.5)); }
  }

  @media (prefers-reduced-motion: reduce) {
    .copied-message { animation: none; }
    .active-intense,
    .active-subtle,
    .active-glow-only,
    .active-minimal,
    .active-wave { animation: none; }
    .menu-indicator { transition: none; }
  }
</style>
