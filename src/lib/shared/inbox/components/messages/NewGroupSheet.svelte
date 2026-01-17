<script lang="ts">
  /**
   * NewGroupSheet
   *
   * Multi-select user interface for creating a new group conversation.
   * Requires at least 2 participants (plus current user) and a group name.
   */

  import { onMount } from "svelte";
  import { conversationService } from "$lib/shared/messaging/services/implementations/ConversationManager";
  import UserSearchInput from "$lib/shared/user-search/UserSearchInput.svelte";
  import RobustAvatar from "$lib/shared/components/avatar/RobustAvatar.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { container } from "$lib/shared/di";
  import type { IUserRepository } from "$lib/shared/community/services/contracts/IUserRepository";
  import type { UserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";

  interface Props {
    onGroupCreated: (conversationId: string) => void;
    onCancel: () => void;
  }

  let { onGroupCreated, onCancel }: Props = $props();

  // Form state
  let groupName = $state("");
  let selectedUsers = $state<
    Array<{ id: string; displayName: string; avatar?: string }>
  >([]);
  let isCreating = $state(false);
  let error = $state<string | null>(null);

  // Search state
  let searchUserId = $state("");
  let searchUserDisplay = $state("");

  // Suggestions state
  let followedUsers = $state<UserProfile[]>([]);
  let isLoadingSuggestions = $state(true);

  // Services
  let userService: IUserRepository | undefined;
  let hapticService: IHapticFeedback | undefined;

  // Current user
  let currentUserId = $derived(authState.user?.uid ?? "");

  // Exclude current user and already selected users from search
  let excludeUserIds = $derived([
    currentUserId,
    ...selectedUsers.map((u) => u.id),
  ]);

  // Validation
  const MIN_PARTICIPANTS = 2; // Plus current user = 3 total minimum
  const MAX_PARTICIPANTS = 49; // Plus current user = 50 total maximum

  // Group name is optional - if not provided, we'll generate one from participant names
  const canCreate = $derived(
    selectedUsers.length >= MIN_PARTICIPANTS &&
      selectedUsers.length <= MAX_PARTICIPANTS &&
      !isCreating
  );

  const participantCountText = $derived(() => {
    const count = selectedUsers.length + 1; // +1 for current user
    if (selectedUsers.length < MIN_PARTICIPANTS) {
      return `Add at least ${MIN_PARTICIPANTS - selectedUsers.length} more`;
    }
    return `${count} participants`;
  });

  onMount(async () => {
    hapticService = container.items.hapticFeedback;
    userService = container.items.userRepository;
    await loadSuggestions();
  });

  async function loadSuggestions() {
    if (!currentUserId || !userService) {
      isLoadingSuggestions = false;
      return;
    }

    isLoadingSuggestions = true;
    try {
      const following = await userService.getFollowing(currentUserId, 20);
      followedUsers = following;
    } catch (err) {
      console.error("[NewGroupSheet] Failed to load suggestions:", err);
    } finally {
      isLoadingSuggestions = false;
    }
  }

  function handleUserSelect(user: {
    uid: string;
    displayName: string;
    email: string;
    photoUrl?: string;
  }) {
    if (selectedUsers.length >= MAX_PARTICIPANTS) {
      error = `Maximum ${MAX_PARTICIPANTS + 1} participants allowed`;
      return;
    }

    hapticService?.trigger("selection");
    selectedUsers = [
      ...selectedUsers,
      {
        id: user.uid,
        displayName: user.displayName || user.email,
        avatar: user.photoUrl,
      },
    ];
    // Clear search
    searchUserId = "";
    searchUserDisplay = "";
    error = null;
  }

  function handleSuggestionClick(user: UserProfile) {
    if (selectedUsers.some((u) => u.id === user.id)) {
      return; // Already selected
    }

    if (selectedUsers.length >= MAX_PARTICIPANTS) {
      error = `Maximum ${MAX_PARTICIPANTS + 1} participants allowed`;
      return;
    }

    hapticService?.trigger("selection");
    selectedUsers = [
      ...selectedUsers,
      {
        id: user.id,
        displayName: user.displayName,
        avatar: user.avatar,
      },
    ];
    error = null;
  }

  function removeUser(userId: string) {
    hapticService?.trigger("selection");
    selectedUsers = selectedUsers.filter((u) => u.id !== userId);
    error = null;
  }

  async function createGroup() {
    if (!canCreate) return;

    isCreating = true;
    error = null;

    try {
      // Generate default name from participant names if none provided
      const finalGroupName =
        groupName.trim() ||
        selectedUsers.map((u) => u.displayName.split(" ")[0]).join(", ");

      const result = await conversationService.createGroup({
        name: finalGroupName,
        participantIds: selectedUsers.map((u) => u.id),
      });

      hapticService?.trigger("success");
      onGroupCreated(result.conversation.id);
    } catch (err) {
      console.error("[NewGroupSheet] Failed to create group:", err);
      error = err instanceof Error ? err.message : "Failed to create group";
      hapticService?.trigger("error");
      isCreating = false;
    }
  }

  // Filter suggestions to exclude already selected users
  const availableSuggestions = $derived(
    followedUsers.filter(
      (u) => u.id !== currentUserId && !selectedUsers.some((s) => s.id === u.id)
    )
  );
</script>

<div class="new-group-sheet">
  <!-- Fixed header section -->
  <div class="fixed-top">
    <div class="header-section">
      <h2>Create Group</h2>
      <p class="subtitle">Add at least 2 people to start a group conversation</p>
    </div>

    {#if error}
      <div class="error-banner" role="alert">
        <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
        <span>{error}</span>
      </div>
    {/if}

    <!-- Group Name Input -->
    <div class="form-section">
      <label for="group-name" class="form-label">Group Name <span class="optional">(optional)</span></label>
      <input
        id="group-name"
        type="text"
        bind:value={groupName}
        placeholder="Enter group name..."
        maxlength={100}
        class="name-input"
        disabled={isCreating}
      />
    </div>

    <!-- Selected Users -->
    {#if selectedUsers.length > 0}
      <div class="selected-section">
        <div class="selected-header">
          <span class="selected-label">Selected</span>
          <span class="selected-count">{participantCountText()}</span>
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
                disabled={isCreating}
              >
                <i class="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- User Search -->
    <div class="search-section">
      <label class="form-label">Add People</label>
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

  <!-- Scrollable suggestions area -->
  <div class="scrollable-content">
    {#if isLoadingSuggestions}
      <div class="suggestions-loading">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        <span>Loading suggestions...</span>
      </div>
    {:else if availableSuggestions.length > 0}
      <div class="suggestions-section">
        <span class="suggestions-label">
          <i class="fas fa-user-friends" aria-hidden="true"></i>
          People You Follow
        </span>
        <div class="suggestions-grid">
          {#each availableSuggestions as user (user.id)}
            <button
              type="button"
              class="suggestion-item"
              onclick={() => handleSuggestionClick(user)}
              disabled={isCreating}
            >
              <RobustAvatar
                src={user.avatar}
                name={user.displayName}
                alt=""
                customSize={36}
              />
              <span class="suggestion-name">{user.displayName}</span>
              <i class="fas fa-plus suggestion-add" aria-hidden="true"></i>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <!-- Fixed action buttons at bottom -->
  <div class="actions">
    <button type="button" class="btn-cancel" onclick={onCancel}>Cancel</button>
    <button
      type="button"
      class="btn-create"
      onclick={createGroup}
      disabled={!canCreate}
    >
      {#if isCreating}
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        Creating...
      {:else}
        <i class="fas fa-users" aria-hidden="true"></i>
        Create Group
      {/if}
    </button>
  </div>
</div>

<style>
  .new-group-sheet {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden; /* Don't scroll the whole sheet */
    isolation: isolate; /* Create new stacking context */
  }

  .fixed-top {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 16px 16px 0;
  }

  .scrollable-content {
    flex: 1;
    min-height: 0; /* Allow shrinking below content size */
    overflow-y: auto;
    overflow-x: hidden;
    padding: 16px;
    position: relative;
    z-index: 0;
  }

  .header-section {
    text-align: center;
  }

  .header-section h2 {
    margin: 0 0 4px;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--theme-text);
  }

  .subtitle {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
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

  .form-section {
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
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .selected-count {
    font-size: var(--font-size-compact);
    color: var(--theme-accent);
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
    animation: chipIn 0.2s ease-out;
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

  .chip-remove:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .search-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .suggestions-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
  }

  .suggestions-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .suggestions-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .suggestions-grid {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .suggestion-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .suggestion-item:hover {
    background: var(--theme-card-bg);
  }

  .suggestion-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .suggestion-name {
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
    transition: opacity 0.2s ease;
  }

  .suggestion-item:hover .suggestion-add {
    opacity: 1;
  }

  .actions {
    flex-shrink: 0;
    display: flex;
    gap: 12px;
    padding: 16px;
    border-top: 1px solid var(--theme-stroke);
    background: var(--theme-panel-bg); /* Ensure button area has solid background */
    position: relative;
    z-index: 10; /* Ensure actions are above scrollable content */
    pointer-events: auto; /* Ensure clicks are registered */
  }

  .btn-cancel,
  .btn-create {
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

  .btn-create {
    background: var(--theme-accent);
    color: white;
  }

  .btn-create:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .btn-create:active:not(:disabled) {
    transform: scale(0.98);
  }

  .btn-create:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .user-chip,
    .suggestion-item,
    .btn-cancel,
    .btn-create {
      transition: none !important;
      animation: none !important;
    }
  }
</style>
