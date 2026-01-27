<!--
  ExpandableSearchBar - Collapsible search input for sequence filtering

  - Shows as magnifying glass icon when collapsed
  - Expands to search input on click
  - Filters sequences via contains_letters filter
  - Auto-collapses on blur when empty
  - Greek letter picker for TKA special characters
-->
<script lang="ts">
  import { onMount } from "svelte";

  interface Props {
    onSearch: (query: string) => void;
    onClear?: () => void;
    placeholder?: string;
  }

  let { onSearch, onClear, placeholder = "Search..." }: Props = $props();

  // Greek/special letters available in TKA
  const SPECIAL_LETTERS = [
    // Type 2/3 letters (Shift / Cross-Shift)
    { char: "Σ", label: "Sigma" },
    { char: "Δ", label: "Delta" },
    { char: "Θ", label: "Theta" },
    { char: "Ω", label: "Omega" },
    // Type 4/5 letters (Dash / Dual-Dash)
    { char: "Φ", label: "Phi" },
    { char: "Ψ", label: "Psi" },
    { char: "Λ", label: "Lambda" },
    // Type 6 letters (Static)
    { char: "α", label: "alpha" },
    { char: "β", label: "beta" },
    { char: "γ", label: "gamma" },
  ];

  // Local state
  let isExpanded = $state(false);
  let inputValue = $state("");
  let inputRef: HTMLInputElement | null = $state(null);
  let containerRef: HTMLDivElement | null = $state(null);
  let showGreekPicker = $state(false);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Expand and focus input
  function handleExpand(event: MouseEvent) {
    event.stopPropagation();
    isExpanded = true;
    // Focus after DOM update
    setTimeout(() => inputRef?.focus(), 0);
  }

  // Collapse if empty
  function handleCollapse() {
    // Delay collapse to allow Greek picker clicks to register
    setTimeout(() => {
      if (!inputValue.trim() && !showGreekPicker) {
        isExpanded = false;
      }
    }, 150);
  }

  // Handle input change with debounce
  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    inputValue = target.value;

    // Clear previous timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Debounce search
    debounceTimer = setTimeout(() => {
      onSearch(inputValue.trim());
    }, 250);
  }

  // Clear search
  function handleClear() {
    inputValue = "";
    onSearch("");
    onClear?.();
    showGreekPicker = false;
    inputRef?.focus();
  }

  // Handle keyboard events
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      if (showGreekPicker) {
        showGreekPicker = false;
      } else {
        inputValue = "";
        onSearch("");
        onClear?.();
        isExpanded = false;
        inputRef?.blur();
      }
    }
  }

  // Toggle Greek letter picker
  function toggleGreekPicker(event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    showGreekPicker = !showGreekPicker;
  }

  // Insert Greek letter at cursor position
  function insertLetter(char: string) {
    if (!inputRef) return;

    const start = inputRef.selectionStart ?? inputValue.length;
    const end = inputRef.selectionEnd ?? inputValue.length;

    // Insert character at cursor position
    const newValue =
      inputValue.slice(0, start) + char + inputValue.slice(end);
    inputValue = newValue;

    // Trigger search
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      onSearch(inputValue.trim());
    }, 250);

    // Re-focus input and set cursor after inserted char
    setTimeout(() => {
      inputRef?.focus();
      inputRef?.setSelectionRange(start + char.length, start + char.length);
    }, 0);

    showGreekPicker = false;
  }

  // Handle clicks outside to collapse
  function handleClickOutside(event: MouseEvent) {
    if (
      containerRef &&
      !containerRef.contains(event.target as Node) &&
      !inputValue.trim()
    ) {
      isExpanded = false;
      showGreekPicker = false;
    }
  }

  onMount(() => {
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  });
</script>

<div
  class="search-container"
  class:expanded={isExpanded}
  bind:this={containerRef}
  role="search"
>
  {#if isExpanded}
    <div class="search-input-wrapper">
      <i class="fas fa-search search-icon" aria-hidden="true"></i>
      <input
        type="text"
        class="search-input"
        bind:this={inputRef}
        value={inputValue}
        oninput={handleInput}
        onkeydown={handleKeydown}
        onblur={handleCollapse}
        {placeholder}
        aria-label="Search sequences"
      />
      <!-- Greek letter picker toggle -->
      <button
        class="greek-toggle"
        class:active={showGreekPicker}
        onmousedown={toggleGreekPicker}
        type="button"
        aria-label="Insert Greek letter"
        aria-expanded={showGreekPicker}
        title="Greek letters (Σ, Δ, α, β...)"
      >
        Σ
      </button>
      {#if inputValue}
        <button
          class="clear-button"
          onclick={handleClear}
          type="button"
          aria-label="Clear search"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      {/if}
    </div>

    <!-- Greek letter picker dropdown -->
    {#if showGreekPicker}
      <div class="greek-picker" role="listbox" aria-label="Greek letters">
        {#each SPECIAL_LETTERS as letter}
          <button
            class="greek-letter"
            onmousedown={() => insertLetter(letter.char)}
            type="button"
            aria-label={letter.label}
            title={letter.label}
          >
            {letter.char}
          </button>
        {/each}
      </div>
    {/if}
  {:else}
    <button
      class="search-button"
      onclick={handleExpand}
      type="button"
      aria-label="Open search"
      aria-expanded="false"
    >
      <i class="fas fa-search" aria-hidden="true"></i>
    </button>
  {/if}
</div>

<style>
  .search-container {
    --control-height: var(--min-touch-target, 48px);
    --transition-duration: var(--duration-normal, 200ms);

    position: relative;
    display: flex;
    align-items: center;
    height: var(--control-height);
    width: var(--control-height);
    overflow: visible;
    transition: width var(--transition-duration) ease;
    flex-shrink: 0;
  }

  .search-container.expanded {
    width: clamp(160px, 25vw, 240px);
  }

  /* Collapsed: Icon button */
  .search-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--control-height);
    height: var(--control-height);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-base);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    flex-shrink: 0;
  }

  .search-button:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }

  .search-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  /* Expanded: Input with icon */
  .search-input-wrapper {
    display: flex;
    align-items: center;
    width: 100%;
    height: var(--control-height);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    padding: 0 12px;
    gap: 8px;
    transition: border-color var(--duration-fast) ease;
  }

  .search-input-wrapper:focus-within {
    border-color: var(--theme-accent);
  }

  .search-icon {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    min-width: 0;
    height: 100%;
    background: transparent;
    border: none;
    outline: none;
    color: var(--theme-text);
    font-size: var(--font-size-min, 14px);
    font-family: inherit;
  }

  .search-input::placeholder {
    color: var(--theme-text-dim);
    opacity: 0.7;
  }

  .clear-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    flex-shrink: 0;
  }

  .clear-button:hover {
    background: color-mix(in srgb, var(--theme-text) 10%, transparent);
    color: var(--theme-text);
  }

  .clear-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 1px;
  }

  /* Greek letter toggle button */
  .greek-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: 1px solid var(--theme-stroke);
    border-radius: 6px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-base, 16px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    flex-shrink: 0;
  }

  .greek-toggle:hover {
    background: color-mix(in srgb, var(--theme-text) 10%, transparent);
    color: var(--theme-text);
    border-color: var(--theme-stroke-strong);
  }

  .greek-toggle.active {
    background: var(--theme-accent);
    border-color: var(--theme-accent);
    color: var(--theme-text);
  }

  .greek-toggle:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 1px;
  }

  /* Greek letter picker dropdown */
  .greek-picker {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 4px;
    padding: 8px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    z-index: 100;
    min-width: 180px;
  }

  .greek-letter {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    color: var(--theme-text);
    font-size: var(--font-size-lg, 18px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .greek-letter:hover {
    background: var(--theme-accent);
    border-color: var(--theme-accent);
  }

  .greek-letter:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 1px;
  }

  /* Mobile responsive */
  @media (max-width: 640px) {
    .search-container.expanded {
      width: clamp(140px, 35vw, 200px);
    }

    .search-input-wrapper {
      padding: 0 10px;
      gap: 6px;
    }

    .greek-toggle {
      width: 24px;
      height: 24px;
      font-size: var(--font-size-min, 14px);
    }

    .greek-picker {
      grid-template-columns: repeat(5, 1fr);
      min-width: 160px;
      padding: 6px;
    }

    .greek-letter {
      width: 28px;
      height: 28px;
      font-size: var(--font-size-base, 16px);
    }
  }
</style>
