<script lang="ts">
  /**
   * NewMessageSheet
   *
   * User search and selection for starting a new conversation.
   * Shows suggestions (people you follow, recent conversations) when not searching.
   */

  import { onMount } from "svelte";
  import { conversationService } from "$lib/shared/messaging/services/implementations/ConversationManager";
  import UserSearchInput from "$lib/shared/user-search/UserSearchInput.svelte";
  import RobustAvatar from "$lib/shared/components/avatar/RobustAvatar.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { inboxState } from "../../state/inbox-state.svelte";
  import { container } from "$lib/shared/di";
  import type { IUserRepository } from "$lib/shared/community/services/contracts/IUserRepository";
  import type { UserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";

  interface Props {
    recipientId?: string | null;
    recipientName?: string | null;
    onConversationCreated: (conversationId: string) => void;
    onCancel: () => void;
  }

  let { recipientId, recipientName, onConversationCreated, onCancel }: Props =
    $props();

  let isCreating = $state(false);
  let selectedUserId = $state("");
  let selectedUserDisplay = $state("");

  // Suggestions state
  let followedUsers = $state<UserProfile[]>([]);
  let recentUsers = $state<
    Array<{ id: string; displayName: string; avatar?: string }>
  >([]);
  let isLoadingSuggestions = $state(true);

  // Services
  let userService: IUserRepository | undefined;
  let hapticService: IHapticFeedback | undefined;

  // Exclude current user from search results (can't message yourself)
  let currentUserId = $derived(authState.user?.uid ?? "");
  let excludeUserIds = $derived(currentUserId ? [currentUserId] : []);

  // If recipient is pre-selected, create conversation immediately
  $effect(() => {
    if (recipientId) {
      createConversation(recipientId);
    }
  });

  onMount(async () => {
    hapticService = container.items.hapticFeedback;
    userService = container.items.userRepository;

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
      if (userService) {
        const following = await userService.getFollowing(currentUserId, 10);
        followedUsers = following;
      }

      // Get recent conversation participants
      const conversations = inboxState.conversations.slice(0, 5);
      recentUsers = conversations
        .map((conv) => ({
          id: conv.otherParticipant.userId,
          displayName: conv.otherParticipant.displayName,
          avatar: conv.otherParticipant.avatar,
        }))
        .filter((user) => user.id !== currentUserId);
    } catch (error) {
      console.error("[NewMessageSheet] Failed to load suggestions:", error);
    } finally {
      isLoadingSuggestions = false;
    }
  }

  async function createConversation(userId: string) {
    if (isCreating) return;

    isCreating = true;
    try {
      const result = await conversationService.getOrCreateConversation(userId);
      onConversationCreated(result.conversation.id);
    } catch (error) {
      console.error("Failed to create conversation:", error);
      isCreating = false;
    }
  }

  function handleUserSelect(user: {
    uid: string;
    displayName: string;
    email: string;
  }) {
    hapticService?.trigger("selection");
    selectedUserId = user.uid;
    selectedUserDisplay = user.displayName || user.email;
    createConversation(user.uid);
  }

  function handleSuggestionClick(userId: string, displayName: string) {
    hapticService?.trigger("selection");
    selectedUserId = userId;
    selectedUserDisplay = displayName;
    createConversation(userId);
  }

  // Check if we have any suggestions to show
  const hasSuggestions = $derived(
    followedUsers.length > 0 || recentUsers.length > 0
  );
</script>

<div class="new-message-sheet">
  {#if recipientId || isCreating}
    <!-- Pre-selected recipient or creating - show loading -->
    <div class="loading-state">
      <div class="spinner-container">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      </div>
      <span
        >Starting conversation with {recipientName ||
          selectedUserDisplay ||
          "user"}...</span
      >
    </div>
  {:else}
    <!-- User search and suggestions -->
    <div class="search-section">
      <p class="search-label">Search for a user to message:</p>
      <UserSearchInput
        {selectedUserId}
        {selectedUserDisplay}
        onSelect={handleUserSelect}
        placeholder="Search by name or email..."
        inlineResults={true}
        {excludeUserIds}
      />
    </div>

    <!-- Suggestions Section -->
    {#if isLoadingSuggestions}
      <div class="suggestions-loading">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        <span>Loading suggestions...</span>
      </div>
    {:else if hasSuggestions}
      <div class="suggestions-section">
        <!-- People You Follow -->
        {#if followedUsers.length > 0}
          <div class="suggestion-group">
            <h3 class="suggestion-heading">
              <i class="fas fa-user-friends" aria-hidden="true"></i>
              People You Follow
            </h3>
            <div class="suggestion-grid">
              {#each followedUsers as user (user.id)}
                <button
                  class="suggestion-card"
                  onclick={() =>
                    handleSuggestionClick(user.id, user.displayName)}
                  type="button"
                >
                  <RobustAvatar
                    src={user.avatar}
                    name={user.displayName}
                    alt=""
                    customSize={48}
                  />
                  <span class="suggestion-name">{user.displayName}</span>
                  {#if user.username}
                    <span class="suggestion-username">@{user.username}</span>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Recent Conversations -->
        {#if recentUsers.length > 0}
          <div class="suggestion-group">
            <h3 class="suggestion-heading">
              <i class="fas fa-clock" aria-hidden="true"></i>
              Recent Conversations
            </h3>
            <div class="suggestion-list">
              {#each recentUsers as user (user.id)}
                <button
                  class="suggestion-row"
                  onclick={() =>
                    handleSuggestionClick(user.id, user.displayName)}
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
                    class="fas fa-chevron-right suggestion-arrow"
                    aria-hidden="true"
                  ></i>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <!-- No suggestions available -->
      <div class="no-suggestions">
        <i class="fas fa-search" aria-hidden="true"></i>
        <p>Use the search bar above to find users</p>
      </div>
    {/if}
  {/if}
</div>

<style>
  .new-message-sheet {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 16px;
    overflow-y: auto;
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
    color: var(--theme-text-dim, var(--theme-text-dim));
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
    color: var(--theme-accent, var(--semantic-info));
  }

  .search-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 24px;
  }

  .search-label {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  /* Suggestions Section */
  .suggestions-section {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .suggestions-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 32px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: var(--font-size-sm);
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
    color: var(--theme-text-dim, var(--theme-text-dim));
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .suggestion-heading i {
    font-size: var(--font-size-compact);
  }

  /* Grid layout for followed users */
  .suggestion-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 12px;
  }

  .suggestion-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    min-height: 80px;
    padding: 16px 12px;
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
    border-color: var(--theme-accent, var(--semantic-info));
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

  .suggestion-username {
    font-size: var(--font-size-compact); /* Supplementary metadata */
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  /* List layout for recent conversations */
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
    transition: background 0.2s ease;
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

  .suggestion-arrow {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    transition: transform 0.2s ease;
  }

  .suggestion-row:hover .suggestion-arrow {
    transform: translateX(2px);
    color: var(--theme-accent, var(--semantic-info));
  }

  /* No suggestions state */
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

  /* Responsive adjustments */
  @media (min-width: 600px) {
    .suggestion-grid {
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .suggestion-card,
    .suggestion-row,
    .suggestion-arrow {
      transition: none !important;
    }
  }
</style>
