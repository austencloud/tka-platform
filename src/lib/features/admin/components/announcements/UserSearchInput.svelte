<!--
  UserSearchInput - Search and select users

  Inline autocomplete search for finding users by name or email.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { resolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import type { IAnnouncementManager } from "../../services/contracts/IAnnouncementManager";
  import * as m from "$lib/paraglide/messages.js";

  interface Props {
    selectedUserId?: string;
    selectedUserDisplay?: string;
    onSelect: (userId: string, displayName: string, email: string) => void;
  }

  let {
    selectedUserId = "",
    selectedUserDisplay = "",
    onSelect,
  }: Props = $props();

  let announcementService: IAnnouncementManager | null = null;
  let searchQuery = $state("");
  let searchResults = $state<
    Array<{ uid: string; displayName: string; email: string }>
  >([]);
  let isSearching = $state(false);
  let showResults = $state(false);
  let searchTimeout: number | null = null;

  onMount(() => {
    announcementService = resolve<IAnnouncementManager>(
      TYPES.IAnnouncementManager
    );

    // Pre-fill if we have a selected user
    if (selectedUserDisplay) {
      searchQuery = selectedUserDisplay;
    }
  });

  async function handleSearchInput() {
    const query = searchQuery.trim();

    if (!query || query.length < 2) {
      searchResults = [];
      showResults = false;
      return;
    }

    // Debounce search
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    searchTimeout = window.setTimeout(async () => {
      if (!announcementService) return;

      isSearching = true;
      try {
        searchResults = await announcementService.searchUsers(query);
        showResults = true;
      } catch (error) {
        console.error("Failed to search users:", error);
        searchResults = [];
      } finally {
        isSearching = false;
      }
    }, 300);
  }

  function handleSelectUser(user: {
    uid: string;
    displayName: string;
    email: string;
  }) {
    searchQuery = user.displayName || user.email;
    showResults = false;
    searchResults = [];
    onSelect(user.uid, user.displayName, user.email);
  }

  function handleFocus() {
    if (searchResults.length > 0) {
      showResults = true;
    }
  }

  function handleBlur() {
    // Delay to allow click events on results to fire
    setTimeout(() => {
      showResults = false;
    }, 200);
  }
</script>

<div class="user-search">
  <div class="search-input-wrapper">
    <i class="fas fa-search search-icon" aria-hidden="true"></i>
    <input
      type="search"
      class="search-input"
      name="admin-user-search"
      bind:value={searchQuery}
      oninput={handleSearchInput}
      onfocus={handleFocus}
      onblur={handleBlur}
      placeholder={m.search_users_placeholder()}
      autocomplete="off"
      aria-label={m.search_users_aria()}
      data-1p-ignore
      data-lpignore="true"
      data-form-type="other"
    />
    {#if isSearching}
      <i class="fas fa-spinner fa-spin loading-icon" aria-hidden="true"></i>
    {/if}
  </div>

  {#if showResults && searchResults.length > 0}
    <div class="search-results" role="listbox" aria-label={m.search_results()}>
      {#each searchResults as user (user.uid)}
        <button
          type="button"
          class="result-item"
          role="option"
          aria-selected="false"
          onclick={() => handleSelectUser(user)}
        >
          <div class="result-info">
            <span class="result-name">{user.displayName || m.search_no_name()}</span>
            <span class="result-email">{user.email}</span>
          </div>
          <i class="fas fa-check result-check" aria-hidden="true"></i>
        </button>
      {/each}
    </div>
  {/if}

  {#if showResults && searchResults.length === 0 && searchQuery.length >= 2 && !isSearching}
    <div class="search-results">
      <div class="no-results">
        <i class="fas fa-user-slash" aria-hidden="true"></i>
        {m.search_no_users_found()}
      </div>
    </div>
  {/if}
</div>

<style>
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
    color: rgba(255, 255, 255, 0.4);
    font-size: var(--font-size-sm);
    pointer-events: none;
  }

  .loading-icon {
    position: absolute;
    right: 16px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
  }

  .search-input {
    width: 100%;
    min-height: 48px;
    padding: 0 48px 0 48px;
    background: linear-gradient(135deg, #2d2d3a 0%, #25252f 100%);
    border: 2px solid var(--theme-stroke-strong);
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.95);
    font-size: var(--font-size-sm);
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px var(--theme-shadow);
  }

  .search-input:focus {
    outline: none;
    border-color: var(--theme-accent, var(--theme-accent));
    box-shadow: 0 0 0 3px
      color-mix(
        in srgb,
        var(--theme-accent, var(--theme-accent)) 20%,
        transparent
      );
  }

  .search-input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  /* ============================================================================
     SEARCH RESULTS
     ============================================================================ */
  .search-results {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #2d2d3a 0%, #25252f 100%);
    border: 2px solid var(--theme-stroke-strong);
    border-radius: 12px;
    overflow: hidden;
    z-index: 100;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    max-height: 320px;
    overflow-y: auto;
  }

  .result-item {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    background: transparent;
    border: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
  }

  .result-item:last-child {
    border-bottom: none;
  }

  .result-item:hover {
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
  }

  .result-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }

  .result-name {
    color: rgba(255, 255, 255, 0.95);
    font-size: var(--font-size-sm);
    font-weight: 600;
  }

  .result-email {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
  }

  .result-check {
    color: var(--theme-text-dim); /* Improved contrast for WCAG AAA */
    font-size: var(--font-size-sm);
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .result-item:hover .result-check {
    opacity: 1;
    color: var(--theme-accent, var(--theme-accent));
  }

  .no-results {
    padding: 32px 16px;
    text-align: center;
    color: var(--theme-text-dim);
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

  /* ============================================================================
     SCROLLBAR
     ============================================================================ */
  .search-results::-webkit-scrollbar {
    width: 8px;
  }

  .search-results::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
  }

  .search-results::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
  }

  .search-results::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }
</style>
