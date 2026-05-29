<script lang="ts">
  /**
   * NewMessageSheet
   *
   * Unified flow for starting conversations:
   * - Select 1 recipient → direct message
   * - Select 2+ recipients → auto-creates group
   * - Existing group with same participants is reused
   */

  import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";
  import { onMount } from "svelte";
  import { conversationService } from "$lib/shared/messaging/services/conversation-manager";
  import UserSearchInput from "$lib/shared/user-search/UserSearchInput.svelte";
  import RobustAvatar from "$lib/shared/components/avatar/RobustAvatar.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { inboxState } from "../../state/inbox-state.svelte";
  import { getFollowing } from "$lib/shared/community/services/user-repository";
  import type { UserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
  import type { HapticFeedback } from "$lib/shared/application/services/implementations/HapticFeedback";

  interface Props {
    recipientId?: string | null;
    recipientName?: string | null;
    groupMode?: boolean;
    onConversationCreated: (conversationId: string) => void;
    onCancel: () => void;
  }

  let { recipientId, recipientName, groupMode = false, onConversationCreated, onCancel }: Props =
    $props();

  // Form state
  let selectedUsers = $state<
    Array<{ id: string; displayName: string; avatar?: string }>
  >([]);
  let groupName = $state("");
  let isCreating = $state(false);
  let error = $state<string | null>(null);

  // Search state (for UserSearchInput)
  let searchUserId = $state("");
  let searchUserDisplay = $state("");

  // Suggestions state
  let followedUsers = $state<UserProfile[]>([]);
  let recentUsers = $state<
    Array<{ id: string; displayName: string; avatar?: string }>
  >([]);
  let isLoadingSuggestions = $state(true);

  // Services
  let hapticService: HapticFeedback | undefined;

  // Current user
  const currentUserId = $derived(authState.user?.uid ?? "");

  // Exclude current user and already selected users from search
  const excludeUserIds = $derived([
    currentUserId,
    ...selectedUsers.map((u) => u.id),
  ]);

  // Is this a group (2+ recipients)?
  const isGroup = $derived(selectedUsers.length >= 2);

  // Can we proceed?
  const canProceed = $derived(selectedUsers.length >= 1 && !isCreating);

  // If recipient is pre-selected, add them immediately
  $effect(() => {
    if (recipientId && recipientName && selectedUsers.length === 0) {
      selectedUsers = [{ id: recipientId, displayName: recipientName }];
    }
  });

  onMount(async () => {
    hapticService = getHapticFeedback();
    await loadSuggestions();
  });

  async function loadSuggestions() {
    if (!currentUserId) {
      isLoadingSuggestions = false;
      return;
    }

    isLoadingSuggestions = true;

    try {
      // Load followed users
      if (currentUserId) {
        followedUsers = await getFollowing(currentUserId, 20);
      }

      // Get recent conversation participants
      const conversations = inboxState.conversations
        .filter((c) => c.otherParticipant)
        .slice(0, 5);
      recentUsers = conversations
        .map((conv) => ({
          id: conv.otherParticipant!.userId,
          displayName: conv.otherParticipant!.displayName,
          avatar: conv.otherParticipant!.avatar,
        }))
        .filter((user) => user.id !== currentUserId);
    } catch (err) {
      console.error("[NewMessageSheet] Failed to load suggestions:", err);
    } finally {
      isLoadingSuggestions = false;
    }
  }

  function handleUserSelect(user: {
    uid: string;
    displayName: string;
    username?: string;
    photoURL?: string;
  }) {
    // Check if already selected
    if (selectedUsers.some((u) => u.id === user.uid)) {
      return;
    }

    hapticService?.trigger("selection");
    selectedUsers = [
      ...selectedUsers,
      {
        id: user.uid,
        displayName: user.displayName || user.username || "Unknown",
        avatar: user.photoURL,
      },
    ];
    // Clear search
    searchUserId = "";
    searchUserDisplay = "";
    error = null;
  }

  function handleSuggestionClick(
    userId: string,
    displayName: string,
    avatar?: string
  ) {
    // Check if already selected
    if (selectedUsers.some((u) => u.id === userId)) {
      return;
    }

    hapticService?.trigger("selection");
    selectedUsers = [...selectedUsers, { id: userId, displayName, avatar }];
    error = null;
  }

  function removeUser(userId: string) {
    hapticService?.trigger("selection");
    selectedUsers = selectedUsers.filter((u) => u.id !== userId);
    error = null;
  }

  async function startConversation() {
    if (!canProceed) return;

    isCreating = true;
    error = null;

    try {
      if (selectedUsers.length === 1) {
        // Single recipient → direct message
        const firstUser = selectedUsers[0];
        if (!firstUser) return;
        const result = await conversationService.getOrCreateConversation(
          firstUser.id
        );
        hapticService?.trigger("success");
        onConversationCreated(result.conversation.id);
      } else {
        // Multiple recipients → group conversation
        const participantIds = selectedUsers.map((u) => u.id);
        const result = await conversationService.getOrCreateGroupConversation(
          participantIds,
          groupName.trim() || undefined
        );
        hapticService?.trigger("success");
        onConversationCreated(result.conversation.id);
      }
    } catch (err) {
      console.error("[NewMessageSheet] Failed to start conversation:", err);
      error =
        err instanceof Error ? err.message : "Failed to start conversation";
      hapticService?.trigger("error");
      isCreating = false;
    }
  }

  // Filter suggestions to exclude already selected users
  const availableSuggestions = $derived(
    followedUsers.filter(
      (u) =>
        u.id !== currentUserId && !selectedUsers.some((s) => s.id === u.id)
    )
  );

  const availableRecentUsers = $derived(
    recentUsers.filter(
      (u) =>
        u.id !== currentUserId && !selectedUsers.some((s) => s.id === u.id)
    )
  );

  const hasSuggestions = $derived(
    availableSuggestions.length > 0 || availableRecentUsers.length > 0
  );
</script>

<div class="new-message-sheet">
  {#if isCreating}
    <!-- Creating conversation -->
    <div class="loading-state">
      <div class="spinner-container">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      </div>
      <span>
        {isGroup ? "Starting group conversation..." : "Starting conversation..."}
      </span>
    </div>
  {:else}
    <!-- Fixed top section -->
    <div class="fixed-top">
      {#if error}
        <div class="error-banner" role="alert">
          <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
          <span>{error}</span>
        </div>
      {/if}

      <!-- Selected users as chips -->
      {#if selectedUsers.length > 0}
        <div class="selected-section">
          <div class="selected-header">
            <span class="selected-label">To:</span>
            <span class="selected-count">
              {selectedUsers.length}
              {selectedUsers.length === 1 ? "person" : "people"}
            </span>
          </div>
          <div class="selected-chips">
            {#each selectedUsers as user (user.id)}
              <div class="user-chip">
                <RobustAvatar
                  src={user.avatar}
                  name={user.displayName}
                  alt=""
                  customSize={24}
                />
                <span class="chip-name">{user.displayName}</span>
                <button
                  type="button"
                  class="chip-remove"
                  onclick={() => removeUser(user.id)}
                  aria-label="Remove {user.displayName}"
                >
                  <i class="fas fa-times" aria-hidden="true"></i>
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Group name input (only for groups) -->
      {#if isGroup}
        <div class="group-name-section">
          <label for="group-name" class="form-label">
            Group Name <span class="optional">(optional)</span>
          </label>
          <input
            id="group-name"
            type="text"
            bind:value={groupName}
            placeholder="Enter a name or leave blank for auto-generated"
            maxlength={100}
            class="name-input"
          />
        </div>
      {/if}

      <!-- User search -->
      <div class="search-section">
        <p class="search-label">
          {#if groupMode && selectedUsers.length === 0}
            Select 2 or more people to start a group:
          {:else if groupMode && selectedUsers.length === 1}
            Add at least one more person:
          {:else if selectedUsers.length === 0}
            Search for someone to message:
          {:else}
            Add more people:
          {/if}
        </p>
        <UserSearchInput
          selectedUserId={searchUserId}
          selectedUserDisplay={searchUserDisplay}
          onSelect={handleUserSelect}
          placeholder="Search by name or email..."
          inlineResults={true}
          {excludeUserIds}
        />
      </div>
    </div>

    <!-- Scrollable suggestions -->
    <div class="scrollable-content">
      {#if isLoadingSuggestions}
        <div class="suggestions-loading">
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          <span>Loading suggestions...</span>
        </div>
      {:else if hasSuggestions}
        <div class="suggestions-section">
          <!-- People You Follow -->
          {#if availableSuggestions.length > 0}
            <div class="suggestion-group">
              <h3 class="suggestion-heading">
                <i class="fas fa-user-friends" aria-hidden="true"></i>
                People You Follow
              </h3>
              <div class="suggestion-grid">
                {#each availableSuggestions.slice(0, 12) as user (user.id)}
                  <button
                    class="suggestion-card"
                    onclick={() =>
                      handleSuggestionClick(
                        user.id,
                        user.displayName,
                        user.avatar
                      )}
                    type="button"
                  >
                    <RobustAvatar
                      src={user.avatar}
                      name={user.displayName}
                      alt=""
                      customSize={48}
                    />
                    <span class="suggestion-name">{user.displayName}</span>
                  </button>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Recent Conversations -->
          {#if availableRecentUsers.length > 0}
            <div class="suggestion-group">
              <h3 class="suggestion-heading">
                <i class="fas fa-clock" aria-hidden="true"></i>
                Recent
              </h3>
              <div class="suggestion-list">
                {#each availableRecentUsers as user (user.id)}
                  <button
                    class="suggestion-row"
                    onclick={() =>
                      handleSuggestionClick(
                        user.id,
                        user.displayName,
                        user.avatar
                      )}
                    type="button"
                  >
                    <RobustAvatar
                      src={user.avatar}
                      name={user.displayName}
                      alt=""
                      customSize={40}
                    />
                    <span class="suggestion-row-name">{user.displayName}</span>
                    <i
                      class="fas fa-plus suggestion-add"
                      aria-hidden="true"
                    ></i>
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {:else}
        <!-- No suggestions -->
        <div class="no-suggestions">
          <i class="fas fa-search" aria-hidden="true"></i>
          <p>Use the search bar to find people</p>
        </div>
      {/if}
    </div>

    <!-- Action button (fixed at bottom) -->
    {#if selectedUsers.length > 0}
      <div class="actions">
        <button type="button" class="btn-cancel" onclick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          class="btn-start"
          onclick={startConversation}
          disabled={!canProceed}
        >
          <i
            class="fas {isGroup ? 'fa-users' : 'fa-paper-plane'}"
            aria-hidden="true"
          ></i>
          {isGroup ? "Start Group" : "Start Chat"}
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .new-message-sheet {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    height: 100%;
    min-height: 200px;
    text-align: center;
    color: var(--theme-text-dim);
  }

  .spinner-container {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg);
    border-radius: 50%;
  }

  .loading-state i {
    font-size: var(--font-size-2xl);
    color: var(--theme-accent);
  }

  .fixed-top {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px 16px 0;
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: color-mix(in srgb, var(--semantic-error) 15%, transparent);
    border: 1px solid var(--semantic-error);
    border-radius: 8px;
    color: var(--semantic-error);
    font-size: var(--font-size-sm);
  }

  .selected-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .selected-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .selected-label {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text);
  }

  .selected-count {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  .selected-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .user-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px 6px 6px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 20px;
    animation: chipIn var(--duration-normal) ease-out;
  }

  @keyframes chipIn {
    from {
      opacity: 0;
      transform: scale(0.9);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .chip-name {
    font-size: var(--font-size-compact);
    font-weight: 500;
    color: var(--theme-text);
  }

  .chip-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition:
      background 0.2s ease,
      color 0.2s ease;
  }

  .chip-remove:hover {
    background: color-mix(in srgb, var(--semantic-error) 20%, transparent);
    color: var(--semantic-error);
  }

  .group-name-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-label {
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .form-label .optional {
    font-weight: 400;
    text-transform: none;
    opacity: 0.7;
  }

  .name-input {
    width: 100%;
    padding: 12px 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 10px;
    color: var(--theme-text);
    font-size: var(--font-size-sm);
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .name-input:focus {
    outline: none;
    border-color: var(--theme-accent);
    box-shadow: 0 0 0 3px
      color-mix(in srgb, var(--theme-accent) 20%, transparent);
  }

  .name-input::placeholder {
    color: var(--theme-text-dim);
  }

  .search-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .search-label {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
  }

  .scrollable-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 16px;
  }

  .suggestions-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 32px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
  }

  .suggestions-section {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .suggestion-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .suggestion-heading {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .suggestion-heading i {
    font-size: var(--font-size-compact);
  }

  .suggestion-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
    gap: 12px;
  }

  .suggestion-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    min-height: 80px;
    padding: 12px 8px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    cursor: pointer;
    transition:
      background 0.2s ease,
      border-color 0.2s ease,
      transform 0.15s ease;
  }

  .suggestion-card:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-accent);
    transform: translateY(-2px);
  }

  .suggestion-card:active {
    transform: scale(0.98);
  }

  .suggestion-card:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px
      color-mix(in srgb, var(--theme-accent) 50%, transparent);
  }

  .suggestion-name {
    font-size: var(--font-size-compact);
    font-weight: 500;
    color: var(--theme-text);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .suggestion-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .suggestion-row {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 12px 16px;
    background: transparent;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: background var(--duration-normal) ease;
  }

  .suggestion-row:hover {
    background: var(--theme-card-bg);
  }

  .suggestion-row:active {
    background: var(--theme-card-hover-bg);
  }

  .suggestion-row:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px
      color-mix(in srgb, var(--theme-accent) 50%, transparent);
  }

  .suggestion-row-name {
    flex: 1;
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--theme-text);
    text-align: left;
  }

  .suggestion-add {
    font-size: var(--font-size-compact);
    color: var(--theme-accent);
    opacity: 0;
    transition: opacity var(--duration-normal) ease;
  }

  .suggestion-row:hover .suggestion-add {
    opacity: 1;
  }

  .no-suggestions {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 48px 24px;
    text-align: center;
    color: var(--theme-text-dim);
  }

  .no-suggestions i {
    font-size: var(--font-size-3xl);
    opacity: 0.5;
  }

  .no-suggestions p {
    margin: 0;
    font-size: var(--font-size-sm);
  }

  .actions {
    flex-shrink: 0;
    display: flex;
    gap: 12px;
    padding: 16px;
    border-top: 1px solid var(--theme-stroke);
    background: var(--theme-panel-bg);
  }

  .btn-cancel,
  .btn-start {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 20px;
    border: none;
    border-radius: 10px;
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition:
      background 0.2s ease,
      transform 0.15s ease;
  }

  .btn-cancel {
    background: var(--theme-card-bg);
    color: var(--theme-text);
  }

  .btn-cancel:hover {
    background: var(--theme-card-hover-bg);
  }

  .btn-start {
    background: var(--theme-accent);
    color: white;
  }

  .btn-start:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .btn-start:active:not(:disabled) {
    transform: scale(0.98);
  }

  .btn-start:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Responsive */
  @media (min-width: 600px) {
    .suggestion-grid {
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .user-chip,
    .suggestion-card,
    .suggestion-row,
    .btn-cancel,
    .btn-start {
      transition: none !important;
      animation: none !important;
    }
  }
</style>
