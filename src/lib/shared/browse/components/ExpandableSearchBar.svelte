<!--
  ExpandableSearchBar - Collapsible search input for sequence filtering

  - Shows as magnifying glass icon when collapsed
  - Expands to search input on click
  - Automatically triggers TKA Virtual Keyboard on focus
  - Suppresses system keyboard for focused notation entry
  - Auto-collapses on blur when empty
-->
<script lang="ts">
  import { onMount, tick } from "svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import VirtualKeyboard from "$lib/shared/components/touch/VirtualKeyboard.svelte";

  interface Props {
    onSearch: (query: string) => void;
    onClear?: () => void;
    placeholder?: string;
    value?: string;
    /** Live count of matches to show in the virtual keyboard header */
    resultCount?: number;
  }

  let {
    onSearch,
    onClear,
    placeholder = "Search...",
    value = "",
    resultCount = 0,
  }: Props = $props();

  // Local state - initialized empty; the $effect below syncs the prop value
  // on mount (and on subsequent changes) to avoid capturing the initial prop
  // value outside a reactive context (svelte state_referenced_locally).
  let isExpanded = $state(false);
  let inputValue = $state("");
  let inputRef: HTMLInputElement | null = $state(null);
  let containerRef: HTMLDivElement | null = $state(null);
  let showVirtualKeyboard = $state(false);
  const hasFinePointer =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: fine)").matches;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let collapseTimer: ReturnType<typeof setTimeout> | null = null;
  let focusTimer: ReturnType<typeof setTimeout> | null = null;

  // Track the last value received from the parent to avoid reset loops
  let lastSyncedValue = "";

  // Sync internal state with external value prop
  $effect(() => {
    if (value !== lastSyncedValue) {
      inputValue = value;
      lastSyncedValue = value;
      if (value.trim() && !isExpanded) {
        isExpanded = true;
      }
    }
  });

  const SEARCH_DEBOUNCE_MS = 250;
  const COLLAPSE_DELAY_MS = 150;

  // Expand and focus input
  function handleExpand(event: MouseEvent) {
    event.stopPropagation();
    isExpanded = true;
    if (!hasFinePointer) showVirtualKeyboard = true;
    if (focusTimer) clearTimeout(focusTimer);
    focusTimer = setTimeout(() => inputRef?.focus(), 0);
  }

  function handleFocus() {
    if (!hasFinePointer) showVirtualKeyboard = true;
  }

  function handleCollapse() {
    if (collapseTimer) clearTimeout(collapseTimer);
    collapseTimer = setTimeout(() => {
      if (!inputValue.trim() && !showVirtualKeyboard) {
        isExpanded = false;
      }
    }, COLLAPSE_DELAY_MS);
  }

  function handleInput() {
    // When typing manually, we update lastSyncedValue to prevent the effect from resetting us
    lastSyncedValue = inputValue;
    triggerSearch();
  }

  function triggerSearch() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      onSearch(inputValue.trim());
    }, SEARCH_DEBOUNCE_MS);
  }

  function handleClear() {
    inputValue = "";
    lastSyncedValue = "";
    onSearch("");
    onClear?.();
    showVirtualKeyboard = false;
    inputRef?.blur();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      if (showVirtualKeyboard) {
        showVirtualKeyboard = false;
        inputRef?.blur();
      } else {
        handleClear();
        isExpanded = false;
      }
    } else if (event.key === "Enter") {
      showVirtualKeyboard = false;
      inputRef?.blur();
    }
  }

  async function insertChar(char: string) {
    if (!inputRef) return;
    const start = inputRef.selectionStart ?? inputValue.length;
    const end = inputRef.selectionEnd ?? inputValue.length;

    // Update local state
    const newValue = inputValue.slice(0, start) + char + inputValue.slice(end);
    inputValue = newValue;

    // CRITICAL: Update lastSyncedValue immediately to prevent the prop-sync effect
    // from reverting this local change before the parent can process the search update.
    lastSyncedValue = newValue;

    triggerSearch();

    // Wait for Svelte to update the DOM value
    await tick();

    // Restore selection/focus
    if (inputRef) {
      inputRef.focus();
      const newPos = start + char.length;
      inputRef.setSelectionRange(newPos, newPos);
    }
  }

  async function handleBackspace() {
    if (!inputRef) return;
    const start = inputRef.selectionStart ?? 0;
    const end = inputRef.selectionEnd ?? 0;

    let newPos = start;
    if (start === end) {
      if (start === 0) return;
      inputValue = inputValue.slice(0, start - 1) + inputValue.slice(start);
      newPos = start - 1;
    } else {
      inputValue = inputValue.slice(0, start) + inputValue.slice(end);
      newPos = start;
    }

    lastSyncedValue = inputValue;
    triggerSearch();
    await tick();
    if (inputRef) {
      inputRef.focus();
      inputRef.setSelectionRange(newPos, newPos);
    }
  }

  function handlePointerDownOutside(event: PointerEvent) {
    if (
      containerRef &&
      !containerRef.contains(event.target as Node) &&
      !inputValue.trim() &&
      !showVirtualKeyboard
    ) {
      isExpanded = false;
      showVirtualKeyboard = false;
    }
  }

  onMount(() => {
    document.addEventListener("pointerdown", handlePointerDownOutside, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDownOutside, true);
      if (debounceTimer) clearTimeout(debounceTimer);
      if (collapseTimer) clearTimeout(collapseTimer);
      if (focusTimer) clearTimeout(focusTimer);
    };
  });
</script>

<div
  class="search-container"
  class:expanded={isExpanded}
  class:kb-active={showVirtualKeyboard}
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
        bind:value={inputValue}
        oninput={handleInput}
        onkeydown={handleKeydown}
        onblur={handleCollapse}
        onfocus={handleFocus}
        {placeholder}
        aria-label={t('browse_search_sequences')}
        inputmode={hasFinePointer ? undefined : "none"}
      />
      {#if inputValue}
        <button
          class="clear-button"
          onclick={handleClear}
          type="button"
          aria-label={t('browse_clear_search')}
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      {/if}
    </div>

    {#if showVirtualKeyboard}
      <VirtualKeyboard
        bind:isOpen={showVirtualKeyboard}
        value={inputValue}
        {resultCount}
        onKey={insertChar}
        onBackspace={handleBackspace}
        onClear={handleClear}
        onClose={() => {
          showVirtualKeyboard = false;
          inputRef?.blur();
        }}
      />
    {/if}
  {:else}
    <button
      class="search-button"
      onclick={handleExpand}
      type="button"
      aria-label={t('browse_open_search')}
      aria-expanded="false"
    >
      <i class="fas fa-search" aria-hidden="true"></i>
    </button>
  {/if}
</div>

<style>
  .search-container {
    --control-height: var(--min-touch-target);
    --transition-duration: var(--duration-normal, 200ms);

    position: relative;
    display: flex;
    align-items: center;
    height: var(--control-height);
    width: var(--control-height);
    overflow: visible;
    transition: width var(--transition-duration) ease;
    flex-shrink: 0;
    z-index: 10;
  }

  .search-container.expanded {
    width: clamp(200px, 40vw, 400px);
    z-index: var(--z-dropdown);
  }

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
    position: relative;
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

  .clear-button::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);
  }

  .clear-button:hover {
    background: color-mix(in srgb, var(--theme-text) 10%, transparent);
    color: var(--theme-text);
  }

  .clear-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 1px;
  }

  @media (max-width: 640px) {
    .search-container.expanded {
      width: clamp(160px, 50vw, 300px);
    }

    /* On mobile, if keyboard is active, keep the top search bar as a compact icon
       so it doesn't overlay the 'My Library' toggle. Input happens in the keyboard header. */
    .search-container.expanded.kb-active {
      width: var(--control-height);
    }

    .search-container.kb-active .search-input-wrapper {
      padding: 0;
      justify-content: center;
      border-color: transparent;
      background: transparent;
    }

    .search-container.kb-active .search-input,
    .search-container.kb-active .clear-button {
      display: none;
    }

    .search-input-wrapper {
      padding: 0 10px;
      gap: 6px;
    }
  }
</style>
