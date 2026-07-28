<!--
  UserSearchInput - Shared user search with autocomplete

  Reusable component for searching users by name or email.
  Uses UserSearcher service for efficient Firestore queries.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { searchUsers as searchUsersService } from "./services/user-searcher";
  import RobustAvatar from "$lib/shared/components/avatar/RobustAvatar.svelte";
  import type { UserSearchResult } from "./services/types";
  import { onDestroy } from "svelte";

  type UserResult = UserSearchResult;

  interface Props {
    selectedUserId?: string;
    selectedUserDisplay?: string;
    onSelect: (user: UserResult) => void;
    placeholder?: string;
    disabled?: boolean;
    useFixedPosition?: boolean;
    inlineResults?: boolean;
    excludeUserIds?: string[];
    autofocus?: boolean;
  }

  let {
    selectedUserId = "",
    selectedUserDisplay = "",
    onSelect,
    placeholder = "Search by name or email...",
    disabled = false,
    useFixedPosition = false,
    inlineResults = false,
    excludeUserIds = [],
    autofocus = false,
  }: Props = $props();

  let inputElement: HTMLInputElement | undefined = $state();
  let dropdownStyle = $state("");
  const componentId = $props.id();
  const resultsId = `${componentId}-results`;

  let searchQuery = $state("");
  let searchResults = $state<UserResult[]>([]);
  let isSearching = $state(false);
  let showResults = $state(false);
  let activeIndex = $state(-1);
  let searchTimeout: number | null = null;
  let searchRequestId = 0;
  let wasCleared = $state(false);
  const activeResultId = $derived(
    showResults && activeIndex >= 0
      ? `${resultsId}-option-${activeIndex}`
      : undefined
  );

  // Services
  const hapticService = getHapticFeedback();

  // Auto-focus when requested
  $effect(() => {
    if (autofocus && inputElement && !disabled) {
      // Small delay to ensure DOM is ready after transitions
      requestAnimationFrame(() => {
        inputElement?.focus();
      });
    }
  });

  // Pre-fill if we have a selected user (but not if user cleared it)
  $effect(() => {
    if (selectedUserDisplay && !searchQuery && !wasCleared) {
      searchQuery = selectedUserDisplay;
    }
  });

  /**
   * Search users using the UserSearcher service
   */
  async function searchUsers(queryText: string): Promise<UserResult[]> {
    return searchUsersService(queryText, {
      excludeUserIds,
      limit: 10,
    });
  }

  async function handleSearchInput() {
    const requestId = ++searchRequestId;
    if (searchTimeout) {
      clearTimeout(searchTimeout);
      searchTimeout = null;
    }

    if (wasCleared && searchQuery) {
      wasCleared = false;
    }

    const q = searchQuery.trim();

    if (!q || q.length < 2) {
      searchResults = [];
      showResults = false;
      activeIndex = -1;
      isSearching = false;
      return;
    }

    searchTimeout = window.setTimeout(async () => {
      isSearching = true;
      try {
        const results = await searchUsers(q);
        if (requestId !== searchRequestId) return;
        searchResults = results;
        showResults = true;
        activeIndex = -1;
        if (!inlineResults) {
          updateDropdownPosition();
        }
      } catch (error) {
        if (requestId !== searchRequestId) return;
        console.error("Failed to search users:", error);
        searchResults = [];
      } finally {
        if (requestId === searchRequestId) {
          isSearching = false;
          searchTimeout = null;
        }
      }
    }, 300);
  }

  function handleSelectUser(user: UserResult) {
    searchRequestId++;
    if (searchTimeout) clearTimeout(searchTimeout);
    hapticService?.trigger("selection");
    searchQuery = user.displayName || user.username || "";
    showResults = false;
    searchResults = [];
    activeIndex = -1;
    isSearching = false;
    onSelect(user);
  }

  function setActiveIndex(index: number): void {
    if (searchResults.length === 0) {
      activeIndex = -1;
      return;
    }

    activeIndex = (index + searchResults.length) % searchResults.length;
    requestAnimationFrame(() => {
      document
        .getElementById(`${resultsId}-option-${activeIndex}`)
        ?.scrollIntoView({ block: "nearest" });
    });
  }

  function handleInputKeydown(event: KeyboardEvent): void {
    if (
      !showResults &&
      (event.key === "ArrowDown" || event.key === "ArrowUp") &&
      searchResults.length > 0
    ) {
      showResults = true;
    }

    if (!showResults) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex(activeIndex + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex(
          activeIndex <= 0 ? searchResults.length - 1 : activeIndex - 1
        );
        break;
      case "Enter": {
        const activeResult = searchResults[activeIndex];
        if (!activeResult) return;
        event.preventDefault();
        handleSelectUser(activeResult);
        break;
      }
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        showResults = false;
        activeIndex = -1;
        break;
    }
  }

  function updateDropdownPosition() {
    if (!useFixedPosition || !inputElement) {
      dropdownStyle = "";
      return;
    }
    const rect = inputElement.getBoundingClientRect();
    dropdownStyle = `position: fixed; top: ${rect.bottom + 8}px; left: ${rect.left}px; width: ${rect.width}px;`;
  }

  function handleFocus() {
    if (searchResults.length > 0) {
      showResults = true;
      if (!inlineResults) {
        updateDropdownPosition();
      }
    }
  }

  function handleBlur() {
    if (inlineResults) {
      return;
    }
    setTimeout(() => {
      showResults = false;
      activeIndex = -1;
    }, 200);
  }

  function clearSelection() {
    searchRequestId++;
    if (searchTimeout) clearTimeout(searchTimeout);
    hapticService?.trigger("selection");
    wasCleared = true;
    searchQuery = "";
    searchResults = [];
    showResults = false;
    activeIndex = -1;
    isSearching = false;
  }

  onDestroy(() => {
    searchRequestId++;
    if (searchTimeout) clearTimeout(searchTimeout);
  });
</script>

<div class="user-search" role="search">
  <div class="search-input-wrapper">
    <i class="fas fa-search search-icon" aria-hidden="true"></i>
    <input
      type="search"
      class="search-input"
      name="user-search-query"
      bind:this={inputElement}
      bind:value={searchQuery}
      oninput={handleSearchInput}
      onkeydown={handleInputKeydown}
      onfocus={handleFocus}
      onblur={handleBlur}
      {placeholder}
      {disabled}
      autocomplete="off"
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={showResults}
      aria-controls={showResults ? resultsId : undefined}
      aria-activedescendant={activeResultId}
      aria-label="Search users"
      data-1p-ignore
      data-lpignore="true"
      data-form-type="other"
    />
    {#if isSearching}
      <i class="fas fa-spinner fa-spin loading-icon" aria-hidden="true"></i>
    {:else if searchQuery && !disabled}
      <button
        type="button"
        class="clear-btn"
        onclick={clearSelection}
        aria-label="Clear search"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    {/if}
  </div>

  <!-- Screen reader status announcement -->
  <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
    {#if isSearching}
      Searching...
    {:else if showResults && searchResults.length > 0}
      {searchResults.length} user{searchResults.length === 1 ? "" : "s"} found
    {:else if showResults && searchResults.length === 0 && searchQuery.length >= 2}
      No users found
    {/if}
  </div>

  {#if showResults && searchResults.length > 0}
    <div
      id={resultsId}
      class="search-results"
      class:fixed-position={useFixedPosition}
      class:inline={inlineResults}
      style={inlineResults ? "" : dropdownStyle}
      role="listbox"
      aria-label="Search results"
    >
      {#each searchResults as user, index (user.uid)}
        <button
          id="{resultsId}-option-{index}"
          type="button"
          class="result-item"
          class:selected={user.uid === selectedUserId}
          class:active={index === activeIndex}
          role="option"
          aria-selected={user.uid === selectedUserId}
          tabindex="-1"
          onclick={() => handleSelectUser(user)}
          onmouseenter={() => {
            activeIndex = index;
          }}
        >
          <RobustAvatar
            src={user.photoURL}
            name={user.displayName || user.username || "User"}
            alt=""
            customSize={36}
          />
          <div class="result-info">
            <span class="result-name">{user.displayName || "No name"}</span>
            <span class="result-username"
              >@{user.username || user.uid.slice(0, 8)}</span
            >
          </div>
          <i class="fas fa-check result-check" aria-hidden="true"></i>
        </button>
      {/each}
    </div>
  {/if}

  {#if showResults && searchResults.length === 0 && searchQuery.length >= 2 && !isSearching}
    <div
      id={resultsId}
      class="search-results"
      class:fixed-position={useFixedPosition}
      class:inline={inlineResults}
      style={inlineResults ? "" : dropdownStyle}
      role="listbox"
      aria-label="Search results"
    >
      <div class="no-results">
        <i class="fas fa-user-slash" aria-hidden="true"></i>
        No users found
      </div>
    </div>
  {/if}
</div>

<style>
  /* Screen reader only - visually hidden but accessible */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .user-search {
    position: relative;
    width: 100%;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 16px;
    color: rgba(255, 255, 255, 0.75);
    font-size: var(--font-size-sm);
    pointer-events: none;
  }

  .loading-icon {
    position: absolute;
    right: 16px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
  }

  .clear-btn {
    position: absolute;
    right: 0;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    z-index: 2;
  }

  .clear-btn::before {
    content: "";
    position: absolute;
    width: 28px;
    height: 28px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    transition: all var(--duration-fast) ease;
  }

  .clear-btn:hover::before {
    background: rgba(255, 255, 255, 0.2);
  }

  .clear-btn:hover {
    color: white;
  }

  .clear-btn i {
    position: relative;
    z-index: 1;
  }

  .search-input {
    width: 100%;
    min-height: var(--min-touch-target);
    padding: 0 48px;
    background: var(
      --theme-card-bg,
      linear-gradient(135deg, #2d2d3a 0%, #25252f 100%)
    );
    border: 2px solid var(--theme-stroke, var(--theme-stroke-strong));
    border-radius: 12px;
    color: var(--theme-text);
    font-size: var(--font-size-sm);
    transition: all var(--duration-normal) ease;
    box-shadow: var(--theme-shadow, 0 2px 8px var(--theme-shadow));
  }

  .search-input:focus {
    outline: none;
    border-color: var(--theme-accent, var(--theme-accent));
    box-shadow: 0 0 0 3px
      color-mix(in srgb, var(--theme-accent) 20%, transparent);
  }

  .search-input::placeholder {
    color: rgba(255, 255, 255, 0.75);
  }

  .search-input::-webkit-search-cancel-button {
    display: none;
    appearance: none;
  }

  .search-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Search Results */
  .search-results {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    background: var(
      --theme-panel-bg,
      linear-gradient(135deg, #2d2d3a 0%, #25252f 100%)
    );
    border: 2px solid var(--theme-stroke, var(--theme-stroke-strong));
    border-radius: 12px;
    overflow: hidden;
    z-index: 100;
    box-shadow: var(--theme-shadow, 0 8px 24px rgba(0, 0, 0, 0.5));
    max-height: 320px;
    overflow-y: auto;
  }

  .search-results:not(.inline) {
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  .search-results:not(.inline)::-webkit-scrollbar {
    width: 8px;
  }

  .search-results:not(.inline)::-webkit-scrollbar-track {
    background: var(--scrollbar-track, transparent);
  }

  .search-results:not(.inline)::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2));
    border-radius: 4px;
  }

  .search-results:not(.inline)::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover, rgba(255, 255, 255, 0.35));
  }

  .search-results.fixed-position {
    z-index: var(--z-dropdown);
  }

  .search-results.inline {
    position: relative;
    top: auto;
    left: auto;
    right: auto;
    margin-top: 12px;
  }

  .result-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: var(--min-touch-target);
    padding: 10px 16px;
    background: transparent;
    border: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    text-align: left;
  }

  .result-item:last-child {
    border-bottom: none;
  }

  .result-item:hover,
  .result-item.active {
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
  }

  .result-item.selected {
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
  }

  .result-item :global(.robust-avatar) {
    flex-shrink: 0;
  }

  .result-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .result-name {
    color: rgba(255, 255, 255, 0.95);
    font-size: var(--font-size-sm);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .result-username {
    color: rgba(255, 255, 255, 0.75);
    font-size: var(--font-size-compact);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .result-check {
    color: var(--theme-text-dim); /* Improved contrast for WCAG AAA */
    font-size: var(--font-size-sm);
    opacity: 0;
    transition: opacity var(--duration-fast) ease;
    flex-shrink: 0;
  }

  .result-item:hover .result-check,
  .result-item.active .result-check {
    opacity: 1;
    color: var(--theme-accent, var(--theme-accent));
  }

  .result-item.selected .result-check {
    opacity: 1;
    color: var(--theme-accent, var(--theme-accent));
  }

  .no-results {
    padding: 32px 16px;
    text-align: center;
    color: rgba(255, 255, 255, 0.75);
    font-size: var(--font-size-sm);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .no-results i {
    font-size: var(--font-size-3xl);
    opacity: 0.5;
  }
</style>
