<script lang="ts">
  /**
   * SendSequenceSheet
   *
   * Lets a user send a sequence to another user via inbox messaging.
   * Shows a sequence preview, recipient picker with suggestions and search,
   * and a message field. Handles the full send flow with loading and success states.
   */

  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { onMount, onDestroy } from "svelte";
  import { conversationService } from "$lib/shared/messaging/services/conversation-manager";
  import { messagingService } from "$lib/shared/messaging/services/messenger";
  import { inboxState } from "../../state/inbox-state.svelte";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import UserSearchInput from "$lib/shared/user-search/UserSearchInput.svelte";
  import RobustAvatar from "$lib/shared/components/avatar/RobustAvatar.svelte";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import type { MessageAttachment } from "$lib/shared/messaging/domain/models/message-models";
  import type { SequenceSharePayload } from "../../domain/models/sequence-share-payload";

  interface Props {
    payload: SequenceSharePayload;
    onClose: () => void;
    onSent?: (conversationId: string) => void;
  }

  let { payload, onClose, onSent }: Props = $props();

  // Phase state: idle -> sending -> success
  type SheetPhase = "idle" | "sending" | "success";
  let phase = $state<SheetPhase>("idle");

  // Recipient selection (single-select)
  let selectedUser = $state<{
    id: string;
    displayName: string;
    avatar?: string;
  } | null>(null);

  // Message
  let message = $state("");
  const MESSAGE_MAX = 500;

  // Search state (for UserSearchInput)
  let searchUserId = $state("");
  let searchUserDisplay = $state("");

  // Error
  let error = $state<string | null>(null);

  // Suggestions
  let recentUsers = $state<
    Array<{ id: string; displayName: string; avatar?: string }>
  >([]);
  let isLoadingSuggestions = $state(true);

  // Services
  let hapticService: HapticFeedback | undefined;

  // Current user
  const currentUserId = $derived(authState.user?.uid ?? "");

  // Exclude current user and selected user from search
  const excludeUserIds = $derived(
    [currentUserId, selectedUser?.id].filter(Boolean) as string[]
  );

  // Can send?
  const canSend = $derived(selectedUser !== null && phase === "idle");

  // Sent-to name for the success screen
  let sentToName = $state("");

  // Auto-close timer (cleared on unmount so it can't fire after teardown)
  let closeTimer: ReturnType<typeof setTimeout> | null = null;

  onMount(async () => {
    hapticService = getHapticFeedback();
    await loadSuggestions();
  });

  onDestroy(() => {
    if (closeTimer) clearTimeout(closeTimer);
  });

  async function loadSuggestions() {
    if (!currentUserId) {
      isLoadingSuggestions = false;
      return;
    }

    isLoadingSuggestions = true;

    try {
      // Pull recent direct conversation partners from inbox state
      const conversations = inboxState.conversations
        .filter((c) => c.type === "direct" && c.otherParticipant)
        .slice(0, 8);

      recentUsers = conversations
        .map((conv) => ({
          id: conv.otherParticipant!.userId,
          displayName: conv.otherParticipant!.displayName,
          avatar: conv.otherParticipant!.avatar,
        }))
        .filter((user) => user.id !== currentUserId);
    } catch (err) {
      console.error("[SendSequenceSheet] Failed to load suggestions:", err);
    } finally {
      isLoadingSuggestions = false;
    }
  }

  function handleSuggestionClick(
    userId: string,
    displayName: string,
    avatar?: string
  ) {
    hapticService?.trigger("selection");
    selectedUser = { id: userId, displayName, avatar };
    error = null;
  }

  function handleSearchSelect(user: {
    uid: string;
    displayName: string;
    username?: string;
    photoURL?: string;
  }) {
    hapticService?.trigger("selection");
    selectedUser = {
      id: user.uid,
      displayName: user.displayName || user.username || "Unknown",
      avatar: user.photoURL,
    };
    // Clear search fields
    searchUserId = "";
    searchUserDisplay = "";
    error = null;
  }

  function deselectUser() {
    hapticService?.trigger("selection");
    selectedUser = null;
  }

  async function send() {
    if (!selectedUser || phase !== "idle") return;

    phase = "sending";
    error = null;

    try {
      // 1. Get or create conversation with the recipient
      const result = await conversationService.getOrCreateConversation(
        selectedUser.id
      );
      const conversationId = result.conversation.id;

      // 2. Build the sequence attachment (strip undefined values - Firestore rejects them)
      const metadata: Record<string, string | number> = {
        sequenceId: payload.sequenceId,
        sequenceWord: payload.sequenceWord,
      };
      if (payload.sequenceCloudWord) metadata.sequenceCloudWord = payload.sequenceCloudWord;
      if (payload.sequenceName) metadata.sequenceName = payload.sequenceName;
      if (payload.sequenceThumbnail) metadata.sequenceThumbnail = payload.sequenceThumbnail;
      if (payload.sequenceAuthor) metadata.sequenceAuthor = payload.sequenceAuthor;
      if (payload.sequenceStepCount) metadata.sequenceStepCount = payload.sequenceStepCount;

      const attachment: MessageAttachment = {
        type: "sequence",
        url: `/sequence/${payload.sequenceId}`,
        thumbnailUrl: payload.sequenceThumbnail || "",
        name: payload.sequenceWord,
        metadata,
      };

      // 3. Send the message
      const content =
        message.trim() || `Check out this sequence: ${payload.sequenceWord}`;

      await messagingService.sendMessage({
        conversationId,
        content,
        attachments: [attachment],
      });

      // 4. Success
      hapticService?.trigger("success");
      sentToName = selectedUser.displayName;
      phase = "success";

      // Auto-close after a moment so the user sees confirmation
      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        onSent?.(conversationId);
        onClose();
      }, 1200);
    } catch (err) {
      console.error("[SendSequenceSheet] Send failed:", err);
      error = err instanceof Error ? err.message : "Failed to send sequence";
      hapticService?.trigger("error");
      phase = "idle";
    }
  }

  // Suggestions that aren't the currently selected user
  const availableSuggestions = $derived(
    recentUsers.filter(
      (u) => u.id !== currentUserId && u.id !== selectedUser?.id
    )
  );
</script>

<div class="send-sequence-sheet">
  {#if phase === "success"}
    <!-- Success confirmation -->
    <div class="success-state">
      <div class="success-icon">
        <i class="fas fa-check" aria-hidden="true"></i>
      </div>
      <p class="success-text">Sent to {sentToName}</p>
    </div>
  {:else}
    <!-- Sequence preview card -->
    <div class="sequence-preview">
      <div class="preview-thumbnail">
        {#if payload.sequenceThumbnail}
          <img
            src={payload.sequenceThumbnail}
            alt="{payload.sequenceWord} sequence"
            class="thumbnail-img"
          />
        {:else}
          <div class="thumbnail-fallback">
            <i class="fas fa-layer-group" aria-hidden="true"></i>
          </div>
        {/if}
      </div>
      <div class="preview-info">
        <span class="preview-word">{payload.sequenceWord.toUpperCase()}</span>
        <div class="preview-meta">
          {#if payload.sequenceStepCount}
            <span class="step-badge">
              {payload.sequenceStepCount} beats
            </span>
          {/if}
          {#if payload.sequenceAuthor}
            <span class="preview-author">by {payload.sequenceAuthor}</span>
          {/if}
        </div>
      </div>
    </div>

    <!-- Error banner -->
    {#if error}
      <div class="error-banner" role="alert">
        <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
        <span>{error}</span>
      </div>
    {/if}

    <!-- Recipient picker -->
    <div class="recipient-section">
      <span class="section-label">Send to</span>

      {#if selectedUser}
        <!-- Selected recipient chip -->
        <div class="selected-recipient">
          <div class="recipient-chip selected">
            <RobustAvatar
              src={selectedUser.avatar}
              name={selectedUser.displayName}
              alt=""
              customSize={28}
            />
            <span class="chip-name">{selectedUser.displayName}</span>
            <button
              type="button"
              class="chip-deselect"
              onclick={deselectUser}
              disabled={phase === "sending"}
              aria-label="Remove {selectedUser.displayName}"
            >
              <i class="fas fa-times" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      {:else}
        <!-- Search input -->
        <div class="search-wrapper">
          <UserSearchInput
            selectedUserId={searchUserId}
            selectedUserDisplay={searchUserDisplay}
            onSelect={handleSearchSelect}
            placeholder="Search by name or email..."
            inlineResults={true}
            {excludeUserIds}
          />
        </div>

        <!-- Suggestions row -->
        {#if isLoadingSuggestions}
          <div class="suggestions-loading">
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
            <span>Loading suggestions...</span>
          </div>
        {:else if availableSuggestions.length > 0}
          <div class="suggestions-row-container">
            <span class="suggestions-label">
              <i class="fas fa-clock" aria-hidden="true"></i>
              Recent
            </span>
            <div class="suggestions-scroll">
              {#each availableSuggestions as user (user.id)}
                <button
                  type="button"
                  class="suggestion-chip"
                  onclick={() =>
                    handleSuggestionClick(
                      user.id,
                      user.displayName,
                      user.avatar
                    )}
                >
                  <RobustAvatar
                    src={user.avatar}
                    name={user.displayName}
                    alt=""
                    customSize={32}
                  />
                  <span class="suggestion-chip-name">{user.displayName}</span>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      {/if}
    </div>

    <!-- Message input -->
    <div class="message-section">
      <textarea
        class="message-input"
        bind:value={message}
        placeholder="Add a message..."
        maxlength={MESSAGE_MAX}
        rows={2}
        disabled={phase === "sending"}
      ></textarea>
      {#if message.length > MESSAGE_MAX * 0.8}
        <span class="char-count">{message.length}/{MESSAGE_MAX}</span>
      {/if}
    </div>

    <!-- Send button -->
    <button
      type="button"
      class="send-btn"
      onclick={send}
      disabled={!canSend || phase === "sending"}
    >
      {#if phase === "sending"}
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        <span>Sending...</span>
      {:else}
        <i class="fas fa-paper-plane" aria-hidden="true"></i>
        <span>Send Sequence</span>
      {/if}
    </button>
  {/if}
</div>

<style>
  .send-sequence-sheet {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    height: 100%;
  }

  /* ── Success state ────────────────────────────────────────────────── */

  .success-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 240px;
    animation: fadeIn 0.3s ease-out;
  }

  .success-icon {
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: color-mix(in srgb, var(--semantic-success) 20%, transparent);
    color: var(--semantic-success);
    font-size: var(--font-size-2xl, 24px);
    animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .success-text {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes popIn {
    0% {
      opacity: 0;
      transform: scale(0.5);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  /* ── Sequence preview ─────────────────────────────────────────────── */

  .sequence-preview {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .preview-thumbnail {
    flex-shrink: 0;
    width: 64px;
    height: 64px;
    border-radius: 8px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .thumbnail-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .thumbnail-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-size: 24px;
  }

  .preview-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .preview-word {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-text, #fff);
    letter-spacing: 0.5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .preview-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .step-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 20%, transparent);
    color: var(--theme-accent, #6366f1);
    border-radius: 10px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
  }

  .preview-author {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ── Error ────────────────────────────────────────────────────────── */

  .error-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: color-mix(in srgb, var(--semantic-error) 15%, transparent);
    border: 1px solid var(--semantic-error);
    border-radius: 8px;
    color: var(--semantic-error);
    font-size: var(--font-size-sm, 14px);
  }

  /* ── Recipient section ────────────────────────────────────────────── */

  .recipient-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .section-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .selected-recipient {
    display: flex;
    align-items: center;
  }

  .recipient-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px 6px 6px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-accent, #6366f1);
    border-radius: 24px;
    animation: chipIn 0.2s ease-out;
  }

  @keyframes chipIn {
    from {
      opacity: 0;
      transform: scale(0.92);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .chip-name {
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    color: var(--theme-text, #fff);
  }

  .chip-deselect {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease;
  }

  .chip-deselect:hover {
    background: color-mix(in srgb, var(--semantic-error) 20%, transparent);
    color: var(--semantic-error);
  }

  .chip-deselect:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .chip-deselect i {
    font-size: var(--font-size-compact, 12px);
  }


  /* ── Suggestions row ──────────────────────────────────────────────── */

  .suggestions-loading {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
  }

  .suggestions-row-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .suggestions-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .suggestions-label i {
    font-size: var(--font-size-compact, 12px);
  }

  .suggestions-scroll {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 4px;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2))
      transparent;
  }

  .suggestions-scroll::-webkit-scrollbar {
    height: 4px;
  }

  .suggestions-scroll::-webkit-scrollbar-track {
    background: transparent;
  }

  .suggestions-scroll::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2));
    border-radius: 2px;
  }

  .suggestion-chip {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px 6px 6px;
    min-height: var(--touch-target-min, 44px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 24px;
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      background 0.15s ease;
  }

  .suggestion-chip:hover {
    border-color: var(--theme-accent, #6366f1);
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 8%, transparent);
  }

  .suggestion-chip:active {
    transform: scale(0.97);
  }

  .suggestion-chip:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px
      color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
  }

  .suggestion-chip-name {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text, #fff);
    white-space: nowrap;
  }

  /* ── Message section ──────────────────────────────────────────────── */

  .message-section {
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .message-input {
    width: 100%;
    padding: 12px 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 14px);
    font-family: inherit;
    resize: none;
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .message-input:focus {
    outline: none;
    border-color: var(--theme-accent, #6366f1);
    box-shadow: 0 0 0 3px
      color-mix(in srgb, var(--theme-accent, #6366f1) 20%, transparent);
  }

  .message-input::placeholder {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .message-input:disabled {
    opacity: 0.5;
  }

  .char-count {
    position: absolute;
    bottom: 6px;
    right: 10px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    pointer-events: none;
  }

  /* ── Send button ──────────────────────────────────────────────────── */

  .send-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: var(--touch-target-min, 44px);
    padding: 14px 20px;
    border: none;
    border-radius: 12px;
    background: var(--theme-accent, #6366f1);
    color: #fff;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
    transition:
      filter 0.15s ease,
      transform 0.1s ease,
      opacity 0.15s ease;
  }

  .send-btn:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .send-btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .send-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  /* ── Reduced motion ───────────────────────────────────────────────── */

  @media (prefers-reduced-motion: reduce) {
    .success-state,
    .success-icon,
    .recipient-chip,
    .suggestion-chip,
    .send-btn,
    .chip-deselect,
    .message-input {
      transition: none !important;
      animation: none !important;
    }
  }
</style>
