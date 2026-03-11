<!--
  ContributorsTab.svelte - Admin tab for managing the curated contributors list

  Contributors are linked to existing user accounts. Admins search for users
  by name and add them to the curated contributor list.
  Non-admins see an access-denied message.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import type { Contributor } from "$lib/features/feedback/domain/models/contributor-models";
  import type { IContributorLoader } from "$lib/features/feedback/services/contracts/IContributorLoader";
  import type { IUserRepository } from "$lib/shared/community/services/contracts/IUserRepository";
  import type { EnhancedUserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";

  let contributors = $state<Contributor[]>([]);
  let isLoading = $state(true);
  let isAdding = $state(false);

  // User search state
  let searchQuery = $state("");
  let searchResults = $state<EnhancedUserProfile[]>([]);
  let isSearching = $state(false);
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  let deleteConfirmId = $state<string | null>(null);

  const isAdmin = $derived(authState.isEffectiveAdmin);
  let isVisible = $state(false);

  // Track which userIds are already contributors to avoid duplicates in search
  const contributorUserIds = $derived(
    new Set(contributors.map((c) => c.userId))
  );

  async function loadContributors() {
    isLoading = true;
    try {
      const loader = container.items.contributorLoader as IContributorLoader;
      contributors = await loader.getAll();
    } catch {
      toast.error("Failed to load contributors");
    } finally {
      isLoading = false;
    }
  }

  function handleSearchInput() {
    if (searchTimeout) clearTimeout(searchTimeout);

    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      searchResults = [];
      isSearching = false;
      return;
    }

    isSearching = true;
    searchTimeout = setTimeout(() => {
      void performSearch(trimmed);
    }, 300);
  }

  async function performSearch(term: string) {
    try {
      const userRepo = container.items.userRepository as IUserRepository;
      const users = await userRepo.getUsers({ limit: 20 });

      // Client-side filter by displayName or username
      const lower = term.toLowerCase();
      searchResults = users.filter(
        (u) =>
          !contributorUserIds.has(u.id) &&
          (u.displayName.toLowerCase().includes(lower) ||
            u.username.toLowerCase().includes(lower))
      );
    } catch {
      toast.error("Failed to search users");
      searchResults = [];
    } finally {
      isSearching = false;
    }
  }

  async function handleAddUser(user: EnhancedUserProfile) {
    try {
      const loader = container.items.contributorLoader as IContributorLoader;
      const id = await loader.addByUserId(user.id);
      contributors = [
        ...contributors,
        {
          id,
          userId: user.id,
          displayName: user.displayName,
          avatarUrl: user.avatar ?? "",
        },
      ];
      searchQuery = "";
      searchResults = [];
      isAdding = false;
      toast.success(`${user.displayName} added as contributor`);
    } catch {
      toast.error("Failed to add contributor");
    }
  }

  async function handleDelete(id: string) {
    try {
      const loader = container.items.contributorLoader as IContributorLoader;
      await loader.delete(id);
      contributors = contributors.filter((c) => c.id !== id);
      deleteConfirmId = null;
      toast.success("Contributor removed");
    } catch {
      toast.error("Failed to delete contributor");
    }
  }

  function getInitials(name: string): string {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  onMount(() => {
    void loadContributors();
    setTimeout(() => (isVisible = true), 30);

    return () => {
      if (searchTimeout) clearTimeout(searchTimeout);
    };
  });
</script>

<div class="contributors-tab" class:visible={isVisible}>
  {#if !isAdmin}
    <!-- Non-admin access denied -->
    <div class="access-denied">
      <div class="access-icon">
        <i class="fas fa-lock" aria-hidden="true"></i>
      </div>
      <h2>Admin access required</h2>
      <p>Only administrators can manage the contributors list.</p>
    </div>
  {:else}
    <!-- Header -->
    <header class="tab-header">
      <div class="header-icon">
        <i class="fas fa-users" aria-hidden="true"></i>
      </div>
      <div class="header-content">
        <h1>Contributors</h1>
        <p>Manage developers credited in release notes</p>
      </div>
      <button
        type="button"
        class="glass-btn primary add-btn"
        onclick={() => {
          isAdding = !isAdding;
          if (!isAdding) {
            searchQuery = "";
            searchResults = [];
          }
        }}
        aria-label={isAdding ? "Cancel adding" : "Add contributor"}
      >
        <i class="fas {isAdding ? 'fa-times' : 'fa-plus'}" aria-hidden="true"></i>
        {isAdding ? "Cancel" : "Add"}
      </button>
    </header>

    <!-- Add form - user search -->
    {#if isAdding}
      <section class="add-form">
        <h2 class="section-title">
          <i class="fas fa-search" aria-hidden="true"></i>
          Find User Account
        </h2>
        <div class="search-wrapper">
          <input
            type="text"
            class="field-input"
            bind:value={searchQuery}
            oninput={handleSearchInput}
            placeholder="Search by name or username..."
          />
          {#if isSearching}
            <div class="search-spinner">
              <div class="spinner-sm"></div>
            </div>
          {/if}
        </div>

        {#if searchResults.length > 0}
          <ul class="search-results" role="listbox">
            {#each searchResults as user (user.id)}
              <li class="search-result-item" role="option" aria-selected="false">
                <button
                  type="button"
                  class="result-btn"
                  onclick={() => handleAddUser(user)}
                >
                  <div class="avatar-wrapper">
                    {#if user.avatar}
                      <img
                        src={user.avatar}
                        alt={user.displayName}
                        class="avatar"
                        onerror={(e) => {
                          const target = e.currentTarget as HTMLImageElement;
                          target.style.display = "none";
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = "flex";
                        }}
                      />
                    {/if}
                    <span
                      class="avatar fallback"
                      style={user.avatar ? "display: none" : ""}
                    >
                      {getInitials(user.displayName)}
                    </span>
                  </div>
                  <div class="result-info">
                    <span class="result-name">{user.displayName}</span>
                    <span class="result-username">@{user.username}</span>
                  </div>
                  <i class="fas fa-plus result-add-icon" aria-hidden="true"></i>
                </button>
              </li>
            {/each}
          </ul>
        {:else if searchQuery.trim().length >= 2 && !isSearching}
          <p class="no-results">No matching users found</p>
        {/if}
      </section>
    {/if}

    <!-- Loading state -->
    {#if isLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading contributors...</p>
      </div>
    {:else if contributors.length === 0}
      <!-- Empty state -->
      <div class="empty-state">
        <div class="empty-icon">
          <i class="fas fa-users" aria-hidden="true"></i>
        </div>
        <p>No contributors yet. Search for user accounts to credit them in release notes.</p>
      </div>
    {:else}
      <!-- Contributors list -->
      <section class="contributors-list">
        <h2 class="section-title">
          <i class="fas fa-users" aria-hidden="true"></i>
          {contributors.length} contributor{contributors.length === 1 ? "" : "s"}
        </h2>

        <ul class="card-list" role="list">
          {#each contributors as contributor (contributor.id)}
            <li class="contributor-card">
              <div class="card-content">
                <div class="avatar-wrapper">
                  {#if contributor.avatarUrl}
                    <img
                      src={contributor.avatarUrl}
                      alt={contributor.displayName}
                      class="avatar"
                      onerror={(e) => {
                        const target = e.currentTarget as HTMLImageElement;
                        target.style.display = "none";
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = "flex";
                      }}
                    />
                  {/if}
                  <span
                    class="avatar fallback"
                    style={contributor.avatarUrl ? "display: none" : ""}
                  >
                    {getInitials(contributor.displayName)}
                  </span>
                </div>
                <div class="card-info">
                  <span class="card-name">{contributor.displayName}</span>
                </div>
                <div class="card-actions">
                  {#if deleteConfirmId === contributor.id}
                    <span class="confirm-text">Remove?</span>
                    <button
                      type="button"
                      class="glass-btn danger"
                      onclick={() => handleDelete(contributor.id)}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      class="glass-btn"
                      onclick={() => (deleteConfirmId = null)}
                    >
                      No
                    </button>
                  {:else}
                    <button
                      type="button"
                      class="icon-btn danger"
                      onclick={() => (deleteConfirmId = contributor.id)}
                      aria-label="Remove {contributor.displayName}"
                    >
                      <i class="fas fa-trash" aria-hidden="true"></i>
                    </button>
                  {/if}
                </div>
              </div>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  {/if}
</div>

<style>
  .contributors-tab {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg, 24px);
    padding: var(--spacing-lg, 24px);
    opacity: 0;
    transform: translateY(10px);
    transition:
      opacity var(--duration-emphasis) ease,
      transform var(--duration-emphasis) ease;
  }

  .contributors-tab.visible {
    opacity: 1;
    transform: translateY(0);
  }

  /* Header */
  .tab-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-md, 16px);
  }

  .header-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    color: white;
    flex-shrink: 0;
  }

  .header-content {
    flex: 1;
    min-width: 0;
  }

  .header-content h1 {
    font-size: var(--font-size-xl, 20px);
    font-weight: 600;
    color: var(--theme-text, #fff);
    margin: 0;
  }

  .header-content p {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    margin: 4px 0 0;
  }

  .add-btn {
    flex: 0 0 auto;
  }

  /* Section title */
  .section-title {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
  }

  .section-title i {
    font-size: 12px;
    opacity: 0.7;
  }

  /* Add form - search */
  .add-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md, 16px);
    padding: var(--spacing-md, 16px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
  }

  .search-wrapper {
    position: relative;
  }

  .search-spinner {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
  }

  .spinner-sm {
    width: 16px;
    height: 16px;
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-top-color: var(--theme-accent, #f59e0b);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .field-input {
    width: 100%;
    padding: 10px 12px;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 14px);
    outline: none;
    transition: border-color var(--duration-fast) ease;
    box-sizing: border-box;
  }

  .field-input:focus {
    border-color: var(--theme-accent, #f59e0b);
  }

  .field-input::placeholder {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
  }

  /* Search results */
  .search-results {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 280px;
    overflow-y: auto;
  }

  .search-result-item {
    border-radius: 8px;
  }

  .result-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    width: 100%;
    padding: 10px 12px;
    background: none;
    border: 1px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    color: inherit;
  }

  .result-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .result-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .result-name {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  .result-username {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .result-add-icon {
    color: var(--theme-accent, #f59e0b);
    font-size: var(--font-size-compact, 12px);
    opacity: 0;
    transition: opacity var(--duration-fast) ease;
  }

  .result-btn:hover .result-add-icon {
    opacity: 1;
  }

  .no-results {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    margin: 0;
    text-align: center;
    padding: var(--spacing-sm, 8px) 0;
  }

  /* Contributors list */
  .contributors-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md, 16px);
  }

  .card-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 8px);
  }

  .contributor-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
    transition: border-color var(--duration-fast) ease;
  }

  .contributor-card:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .card-content {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
  }

  /* Avatar */
  .avatar-wrapper {
    flex-shrink: 0;
  }

  .avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
  }

  .avatar.fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    color: var(--theme-accent);
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    line-height: 1;
  }

  /* Card info */
  .card-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .card-name {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  /* Card actions */
  .card-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .confirm-text {
    font-size: var(--font-size-compact, 12px);
    color: var(--semantic-error, #ef4444);
    font-weight: 600;
    white-space: nowrap;
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    padding: 0;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .icon-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, #fff);
  }

  .icon-btn.danger:hover {
    color: var(--semantic-error, #ef4444);
    border-color: color-mix(in srgb, var(--semantic-error) 25%, transparent);
    background: var(--semantic-error-dim, rgba(239, 68, 68, 0.1));
  }

  .icon-btn i {
    font-size: var(--font-size-compact, 12px);
  }

  /* Glass buttons */
  .glass-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: var(--min-touch-target);
    padding: 0 14px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    font-size: var(--font-size-compact);
    font-weight: 500;
    color: var(--theme-text);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .glass-btn:hover:not(:disabled) {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
    transform: translateY(-1px);
  }

  .glass-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .glass-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .glass-btn i {
    font-size: var(--font-size-compact);
  }

  .glass-btn.primary {
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent-strong)) 15%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent-strong)) 30%,
      transparent
    );
    color: var(--theme-accent);
  }

  .glass-btn.primary:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-accent) 25%, transparent);
    border-color: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent-strong)) 45%,
      transparent
    );
    color: var(--theme-accent-strong);
  }

  .glass-btn.danger {
    background: var(--semantic-error-dim);
    border-color: color-mix(in srgb, var(--semantic-error) 25%, transparent);
    color: color-mix(in srgb, var(--semantic-error) 90%, white);
  }

  .glass-btn.danger:hover:not(:disabled) {
    background: color-mix(in srgb, var(--semantic-error) 18%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error) 40%, transparent);
    color: var(--semantic-error);
  }

  /* Loading state */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-md, 16px);
    padding: var(--spacing-xl, 48px) 0;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-top-color: var(--theme-accent, #f59e0b);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .loading-state p {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    margin: 0;
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-md, 16px);
    padding: var(--spacing-xl, 48px) var(--spacing-lg, 24px);
    text-align: center;
  }

  .empty-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
  }

  .empty-state p {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    margin: 0;
    max-width: 320px;
    line-height: 1.5;
  }

  /* Access denied */
  .access-denied {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-md, 16px);
    padding: var(--spacing-xl, 48px) var(--spacing-lg, 24px);
    text-align: center;
  }

  .access-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: var(--semantic-error-dim, rgba(239, 68, 68, 0.1));
    border: 1.5px solid color-mix(in srgb, var(--semantic-error) 25%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    color: var(--semantic-error, #ef4444);
  }

  .access-denied h2 {
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    color: var(--theme-text, #fff);
    margin: 0;
  }

  .access-denied p {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    margin: 0;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .contributors-tab {
      transition: none;
    }

    .spinner,
    .spinner-sm {
      animation: none;
    }
  }
</style>
