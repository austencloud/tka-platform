<script lang="ts">
  /**
   * SendSequenceSheet
   *
   * User picker sheet for sending a sequence via message.
   * Shows sequence preview, user search, and suggestions.
   */

  import { onMount } from "svelte";
  import { conversationService } from "$lib/shared/messaging/services/implementations/ConversationManager";
  import { messagingService } from "$lib/shared/messaging/services/implementations/Messenger";
  import UserSearchInput from "$lib/shared/user-search/UserSearchInput.svelte";
  import RobustAvatar from "$lib/shared/components/avatar/RobustAvatar.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { inboxState } from "../../state/inbox-state.svelte";
  import { container } from "$lib/shared/di";
  import type { IUserRepository } from "$lib/shared/community/services/contracts/IUserRepository";
  import type { UserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { MessageAttachment } from "$lib/shared/messaging/domain/models/message-models";

  interface Props {
    sequence: SequenceData;
    onClose: () => void;
    onSent?: () => void;
  }

  let { sequence, onClose, onSent }: Props = $props();

  let isSending = $state(false);
  let selectedUserId = $state("");
  let selectedUserDisplay = $state("");
  let customMessage = $state("");
  let showSuccess = $state(false);

  // Suggestions state
  let followedUsers = $state<UserProfile[]>([]);
  let followers = $state<UserProfile[]>([]);
  let recentUsers = $state<
    Array<{ id: string; displayName: string; avatar?: string }>
  >([]);
  let isLoadingSuggestions = $state(true);

  // Services
  let userService: IUserRepository | undefined;
  let hapticService: IHapticFeedback | undefined;

  // Exclude current user from search results
  let currentUserId = $derived(authState.user?.uid ?? "");
  let excludeUserIds = $derived(currentUserId ? [currentUserId] : []);

  // Sequence preview data
  const thumbnailUrl = $derived(sequence.thumbnails?.[0] ?? "");
  const sequenceWord = $derived(sequence.word);
  const sequenceName = $derived(sequence.displayName || sequence.name);
  const authorName = $derived(sequence.ownerDisplayName || sequence.author);
  const stepCount = $derived(sequence.steps?.length ?? sequence.sequenceLength ?? 0);

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
      // Load followed users and followers in parallel
      const [followingResult, followersResult] = await Promise.all([
        userService.getFollowing(currentUserId, 10),
        userService.getFollowers(currentUserId, 10),
      ]);

      followedUsers = followingResult;
      followers = followersResult;

      // Get recent conversation participants (direct conversations only)
      const conversations = inboxState.conversations
        .filter((c) => c.type === "direct" && c.otherParticipant)
        .slice(0, 5);
      recentUsers = conversations
        .map((conv) => ({
          id: conv.otherParticipant!.userId,
          displayName: conv.otherParticipant!.displayName,
          avatar: conv.otherParticipant!.avatar,
        }))
        .filter((user) => user.id !== currentUserId);
    } catch (error) {
      console.error("[SendSequenceSheet] Failed to load suggestions:", error);
    } finally {
      isLoadingSuggestions = false;
    }
  }

  function buildSequenceAttachment(): MessageAttachment {
    // Build metadata without undefined values (Firestore rejects undefined)
    const metadata: MessageAttachment["metadata"] = {
      sequenceId: sequence.id,
      sequenceWord: sequenceWord,
      title: sequenceWord,
      description: `${stepCount || 0} steps${authorName ? ` by ${authorName}` : ""}`,
    };

    // Only add optional fields if they have values
    if (sequenceName) metadata.sequenceName = sequenceName;
    if (thumbnailUrl) metadata.sequenceThumbnail = thumbnailUrl;
    if (authorName) metadata.sequenceAuthor = authorName;
    if (stepCount) metadata.sequenceStepCount = stepCount;

    return {
      type: "sequence",
      url: `/browse?sequence=${sequence.id}`,
      thumbnailUrl: thumbnailUrl || "",
      metadata,
    };
  }

  async function sendToUser(userId: string, userName: string) {
    if (isSending) return;

    isSending = true;
    selectedUserId = userId;
    selectedUserDisplay = userName;

    try {
      // Get or create conversation
      const result = await conversationService.getOrCreateConversation(userId);
      const conversationId = result.conversation.id;

      // Build attachment
      const attachment = buildSequenceAttachment();

      // Build message content
      const content = customMessage.trim() || `Check out this sequence: ${sequenceWord}`;

      // Send message with attachment
      await messagingService.sendMessage({
        conversationId,
        content,
        attachments: [attachment],
      });

      hapticService?.trigger("success");
      showSuccess = true;

      // Close after brief success display
      setTimeout(() => {
        onSent?.();
        onClose();
      }, 1200);
    } catch (error) {
      console.error("[SendSequenceSheet] Failed to send sequence:", error);
      hapticService?.trigger("error");
      isSending = false;
    }
  }

  function handleUserSelect(user: {
    uid: string;
    displayName: string;
    email: string;
  }) {
    hapticService?.trigger("selection");
    sendToUser(user.uid, user.displayName || user.email);
  }

  function handleSuggestionClick(userId: string, displayName: string) {
    hapticService?.trigger("selection");
    sendToUser(userId, displayName);
  }

  // Check if we have any suggestions to show
  const hasSuggestions = $derived(
    followedUsers.length > 0 || followers.length > 0 || recentUsers.length > 0
  );
</script>

<div class="send-sequence-sheet">
  {#if showSuccess}
    <!-- Success state -->
    <div class="success-state">
      <div class="success-icon">
        <i class="fas fa-check" aria-hidden="true"></i>
      </div>
      <h3>Sent!</h3>
      <p>Sequence sent to {selectedUserDisplay}</p>
    </div>
  {:else if isSending}
    <!-- Sending state -->
    <div class="loading-state">
      <div class="spinner-container">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      </div>
      <span>Sending to {selectedUserDisplay}...</span>
    </div>
  {:else}
    <!-- Sequence preview -->
    <div class="sequence-preview">
      {#if thumbnailUrl}
        <img
          src={thumbnailUrl}
          alt={sequenceWord}
          class="preview-thumbnail"
          loading="lazy"
        />
      {:else}
        <div class="preview-placeholder">
          <i class="fas fa-layer-group" aria-hidden="true"></i>
        </div>
      {/if}
      <div class="preview-info">
        <h3 class="preview-word">{sequenceWord}</h3>
        <div class="preview-meta">
          {#if authorName}
            <span class="meta-item">
              <i class="fas fa-user" aria-hidden="true"></i>
              {authorName}
            </span>
          {/if}
          {#if stepCount}
            <span class="meta-item">
              <i class="fas fa-music" aria-hidden="true"></i>
              {stepCount} steps
            </span>
          {/if}
        </div>
      </div>
    </div>

    <!-- Optional message input -->
    <div class="message-input-section">
      <label for="custom-message" class="input-label">Add a message (optional)</label>
      <textarea
        id="custom-message"
        bind:value={customMessage}
        placeholder="Say something about this sequence..."
        rows="2"
        class="message-input"
      ></textarea>
    </div>

    <!-- User search -->
    <div class="search-section">
      <p class="search-label">Send to:</p>
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
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Your Followers -->
        {#if followers.length > 0}
          <div class="suggestion-group">
            <h3 class="suggestion-heading">
              <i class="fas fa-users" aria-hidden="true"></i>
              Your Followers
            </h3>
            <div class="suggestion-grid">
              {#each followers as user (user.id)}
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
                    class="fas fa-paper-plane suggestion-arrow"
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
  .send-sequence-sheet {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    padding: 16px;
    overflow-y: auto;
  }

  /* Success state */
  .success-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 100%;
    min-height: 300px;
    text-align: center;
  }

  .success-icon {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--semantic-success) 20%, transparent);
    border-radius: 50%;
    animation: scaleIn var(--duration-emphasis) ease-out;
  }

  .success-icon i {
    font-size: 32px;
    color: var(--semantic-success);
  }

  .success-state h3 {
    margin: 0;
    font-size: var(--font-size-xl);
    color: var(--theme-text);
  }

  .success-state p {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
  }

  @keyframes scaleIn {
    from {
      transform: scale(0);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  /* Loading state */
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

  /* Sequence preview */
  .sequence-preview {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    margin-bottom: 16px;
  }

  .preview-thumbnail {
    width: 64px;
    height: 64px;
    object-fit: contain;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.2);
  }

  .preview-placeholder {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg);
    border-radius: 8px;
    color: var(--theme-text-dim);
  }

  .preview-placeholder i {
    font-size: 24px;
  }

  .preview-info {
    flex: 1;
    min-width: 0;
  }

  .preview-word {
    margin: 0 0 4px;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--theme-text);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .preview-meta {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .meta-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  .meta-item i {
    font-size: 10px;
  }

  /* Message input */
  .message-input-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .input-label {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  .message-input {
    width: 100%;
    padding: 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    color: var(--theme-text);
    font-size: var(--font-size-sm);
    font-family: inherit;
    resize: none;
    transition: border-color var(--duration-normal) ease;
  }

  .message-input::placeholder {
    color: var(--theme-text-dim);
  }

  .message-input:focus {
    outline: none;
    border-color: var(--theme-accent);
  }

  /* Search section */
  .search-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 24px;
  }

  .search-label {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--theme-text);
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
    color: var(--theme-text-dim);
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
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .suggestion-heading i {
    font-size: var(--font-size-compact);
  }

  /* Grid layout for users */
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

  .suggestion-arrow {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    transition: transform var(--duration-normal) ease, color var(--duration-normal) ease;
  }

  .suggestion-row:hover .suggestion-arrow {
    transform: translateX(2px);
    color: var(--theme-accent);
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
    .success-icon,
    .suggestion-card,
    .suggestion-row,
    .suggestion-arrow {
      animation: none !important;
      transition: none !important;
    }
  }
</style>
