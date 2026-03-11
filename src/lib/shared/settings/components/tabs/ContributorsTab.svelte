<!--
  ContributorsTab.svelte - Admin tab for managing the curated contributors list

  Contributors are developers credited in release notes changelog entries.
  Only admins can add, edit, or delete contributors.
  Non-admins see an access-denied message.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import type { Contributor } from "$lib/features/feedback/domain/models/contributor-models";
  import type { IContributorLoader } from "$lib/features/feedback/services/contracts/IContributorLoader";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";

  let contributors = $state<Contributor[]>([]);
  let isLoading = $state(true);
  let isAdding = $state(false);
  let editingId = $state<string | null>(null);

  // Add form state
  let newName = $state("");
  let newAvatarUrl = $state("");

  // Edit form state
  let editName = $state("");
  let editAvatarUrl = $state("");

  let deleteConfirmId = $state<string | null>(null);

  const isAdmin = $derived(authState.isEffectiveAdmin);
  let isVisible = $state(false);

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

  async function handleAdd() {
    if (!newName.trim() || !newAvatarUrl.trim()) return;
    try {
      const loader = container.items.contributorLoader as IContributorLoader;
      const id = await loader.add({
        displayName: newName.trim(),
        avatarUrl: newAvatarUrl.trim(),
      });
      contributors = [
        ...contributors,
        { id, displayName: newName.trim(), avatarUrl: newAvatarUrl.trim() },
      ];
      newName = "";
      newAvatarUrl = "";
      isAdding = false;
      toast.success("Contributor added");
    } catch {
      toast.error("Failed to add contributor");
    }
  }

  function startEdit(c: Contributor) {
    editingId = c.id;
    editName = c.displayName;
    editAvatarUrl = c.avatarUrl;
  }

  function cancelEdit() {
    editingId = null;
  }

  async function saveEdit() {
    if (!editingId || !editName.trim() || !editAvatarUrl.trim()) return;
    try {
      const loader = container.items.contributorLoader as IContributorLoader;
      await loader.update(editingId, {
        displayName: editName.trim(),
        avatarUrl: editAvatarUrl.trim(),
      });
      contributors = contributors.map((c) =>
        c.id === editingId
          ? { ...c, displayName: editName.trim(), avatarUrl: editAvatarUrl.trim() }
          : c
      );
      editingId = null;
      toast.success("Contributor updated");
    } catch {
      toast.error("Failed to update contributor");
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

  function truncateUrl(url: string, maxLength = 40): string {
    if (url.length <= maxLength) return url;
    return url.slice(0, maxLength) + "...";
  }

  onMount(() => {
    void loadContributors();
    setTimeout(() => (isVisible = true), 30);
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
            newName = "";
            newAvatarUrl = "";
          }
        }}
        aria-label={isAdding ? "Cancel adding" : "Add contributor"}
      >
        <i class="fas {isAdding ? 'fa-times' : 'fa-plus'}" aria-hidden="true"></i>
        {isAdding ? "Cancel" : "Add"}
      </button>
    </header>

    <!-- Add form -->
    {#if isAdding}
      <section class="add-form">
        <h2 class="section-title">
          <i class="fas fa-user-plus" aria-hidden="true"></i>
          New Contributor
        </h2>
        <div class="form-fields">
          <label class="field">
            <span class="field-label">Display Name</span>
            <input
              type="text"
              class="field-input"
              bind:value={newName}
              placeholder="e.g. Kevin Tran"
            />
          </label>
          <label class="field">
            <span class="field-label">Avatar URL</span>
            <input
              type="url"
              class="field-input"
              bind:value={newAvatarUrl}
              placeholder="https://github.com/user.png"
            />
          </label>
        </div>
        <div class="form-actions">
          <button
            type="button"
            class="glass-btn"
            onclick={() => {
              isAdding = false;
              newName = "";
              newAvatarUrl = "";
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            class="glass-btn primary"
            disabled={!newName.trim() || !newAvatarUrl.trim()}
            onclick={handleAdd}
          >
            <i class="fas fa-check" aria-hidden="true"></i>
            Add Contributor
          </button>
        </div>
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
        <p>No contributors yet. Add developers to credit them in release notes.</p>
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
              {#if editingId === contributor.id}
                <!-- Edit mode -->
                <div class="edit-form">
                  <label class="field">
                    <span class="field-label">Display Name</span>
                    <input
                      type="text"
                      class="field-input"
                      bind:value={editName}
                    />
                  </label>
                  <label class="field">
                    <span class="field-label">Avatar URL</span>
                    <input
                      type="url"
                      class="field-input"
                      bind:value={editAvatarUrl}
                    />
                  </label>
                  <div class="form-actions">
                    <button type="button" class="glass-btn" onclick={cancelEdit}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      class="glass-btn primary"
                      disabled={!editName.trim() || !editAvatarUrl.trim()}
                      onclick={saveEdit}
                    >
                      <i class="fas fa-check" aria-hidden="true"></i>
                      Save
                    </button>
                  </div>
                </div>
              {:else}
                <!-- Display mode -->
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
                    <span class="card-url">{truncateUrl(contributor.avatarUrl)}</span>
                    {#if contributor.userId}
                      <span class="card-uid">UID: {contributor.userId}</span>
                    {/if}
                  </div>
                  <div class="card-actions">
                    {#if deleteConfirmId === contributor.id}
                      <span class="confirm-text">Delete?</span>
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
                        class="icon-btn"
                        onclick={() => startEdit(contributor)}
                        aria-label="Edit {contributor.displayName}"
                      >
                        <i class="fas fa-pen" aria-hidden="true"></i>
                      </button>
                      <button
                        type="button"
                        class="icon-btn danger"
                        onclick={() => (deleteConfirmId = contributor.id)}
                        aria-label="Delete {contributor.displayName}"
                      >
                        <i class="fas fa-trash" aria-hidden="true"></i>
                      </button>
                    {/if}
                  </div>
                </div>
              {/if}
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

  /* Add / Edit form */
  .add-form,
  .edit-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md, 16px);
    padding: var(--spacing-md, 16px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
  }

  .form-fields {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 8px);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .field-input {
    padding: 10px 12px;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 14px);
    outline: none;
    transition: border-color var(--duration-fast) ease;
  }

  .field-input:focus {
    border-color: var(--theme-accent, #f59e0b);
  }

  .field-input::placeholder {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
  }

  .form-actions {
    display: flex;
    gap: 8px;
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

  .card-url {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-uid {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-family: monospace;
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

  /* Glass buttons - same pattern as EditableChangelogItem */
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

    .spinner {
      animation: none;
    }
  }
</style>
