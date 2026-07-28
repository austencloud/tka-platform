<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { getErrorHandler } from "$lib/shared/application/get-error-handler";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { ensureGuestIdentity } from "$lib/shared/auth/services/guest-identity";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import RobustAvatar from "$lib/shared/components/avatar/RobustAvatar.svelte";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import type { ConversationPreview } from "$lib/shared/messaging/domain/models/conversation-models";
  import { conversationService } from "$lib/shared/messaging/services/conversation-manager";
  import { messagingService } from "$lib/shared/messaging/services/messenger";
  import { getShortCodeManager } from "$lib/shared/qr/get-short-code-manager";
  import { getShortCodeShareMessage } from "$lib/shared/qr/domain/short-code-error";
  import UserSearchInput from "$lib/shared/user-search/UserSearchInput.svelte";
  import { onMount } from "svelte";
  import { buildSequenceMessageAttachment } from "../../domain/message-attachment-builders";
  import type { SequenceSharePayload } from "../../domain/models/sequence-share-payload";
  import { inboxState } from "../../state/inbox-state.svelte";
  import ConversationItem from "./ConversationItem.svelte";
  import GroupAvatarStack from "./GroupAvatarStack.svelte";

  interface Props {
    payload: SequenceSharePayload;
    onSent: (conversationId: string) => void;
  }

  type SelectedUser = {
    id: string;
    displayName: string;
    avatar?: string;
  };

  let { payload, onSent }: Props = $props();

  const MESSAGE_MAX = 500;
  const MAX_RECENT_CONVERSATIONS = 8;

  let selectedConversation = $state<ConversationPreview | null>(null);
  let selectedUser = $state<SelectedUser | null>(null);
  let message = $state("");
  let phase = $state<"idle" | "sending">("idle");
  let thumbnailFailed = $state(false);
  let searchResetKey = $state(0);
  let searchUserId = $state("");
  let searchUserDisplay = $state("");
  let hapticService: HapticFeedback | undefined;

  const currentUserId = $derived(authState.user?.uid ?? "");
  const displayWord = $derived(
    simplifyRepeatedWord(
      payload.sequenceWord || payload.sequenceCloudWord || ""
    )
  );
  const recentConversations = $derived(
    inboxState.conversations
      .filter(
        (conversation) =>
          conversation.type === "group" || !!conversation.otherParticipant
      )
      .slice(0, MAX_RECENT_CONVERSATIONS)
  );
  const selectedConversationIsGroup = $derived(
    selectedConversation?.type === "group"
  );
  const destinationName = $derived(
    selectedConversation
      ? conversationName(selectedConversation)
      : selectedUser?.displayName || ""
  );
  const destinationDetail = $derived.by(() => {
    if (selectedConversation?.type === "group") {
      const count =
        selectedConversation.participantCount ??
        selectedConversation.participantPreviews?.length ??
        0;
      return count > 0
        ? `${count} ${count === 1 ? "member" : "members"}`
        : "Group conversation";
    }
    if (selectedConversation) return "Existing conversation";
    if (selectedUser) return "New conversation";
    return "";
  });
  const hasDestination = $derived(
    selectedConversation !== null || selectedUser !== null
  );
  const canSend = $derived(hasDestination && phase === "idle");
  const excludeUserIds = $derived(
    [currentUserId, selectedUser?.id].filter(Boolean) as string[]
  );

  onMount(() => {
    hapticService = getHapticFeedback();
  });

  function conversationName(conversation: ConversationPreview): string {
    return conversation.type === "group"
      ? conversation.groupName || "Unnamed group"
      : conversation.otherParticipant?.displayName || "Unknown";
  }

  function selectConversation(conversation: ConversationPreview): void {
    if (phase !== "idle") return;
    selectedConversation = conversation;
    selectedUser = null;
    searchUserId = "";
    searchUserDisplay = "";
    searchResetKey++;
  }

  function selectUser(user: {
    uid: string;
    displayName: string;
    username?: string;
    photoURL?: string;
  }): void {
    if (phase !== "idle") return;
    selectedConversation = null;
    selectedUser = {
      id: user.uid,
      displayName: user.displayName || user.username || "Unknown",
      avatar: user.photoURL,
    };
    searchUserId = user.uid;
    searchUserDisplay = user.displayName || user.username || "Unknown";
  }

  function clearDestination(): void {
    if (phase !== "idle") return;
    hapticService?.trigger("selection");
    selectedConversation = null;
    selectedUser = null;
    searchUserId = "";
    searchUserDisplay = "";
    searchResetKey++;
  }

  async function send(): Promise<void> {
    const conversation = selectedConversation;
    const user = selectedUser;
    if ((!conversation && !user) || phase !== "idle") return;

    phase = "sending";

    try {
      await ensureGuestIdentity();

      const { code } = await getShortCodeManager().createShortCode(
        payload.sequence,
        { embedSequenceData: true }
      );
      const attachment = buildSequenceMessageAttachment(payload.sequence, code);

      const conversationId = conversation
        ? conversation.id
        : (
            await conversationService.getOrCreateConversation(user!.id, {
              silent: true,
            })
          ).conversation.id;

      await messagingService.sendMessage({
        conversationId,
        content: message.trim(),
        attachments: [attachment],
      });

      hapticService?.trigger("success");
      onSent(conversationId);
    } catch (caught) {
      const failure =
        caught instanceof Error ? caught : new Error(String(caught));
      getErrorHandler().showUserError({
        message:
          getShortCodeShareMessage(caught) ??
          "The sequence wasn’t sent. Try again.",
        technicalDetails: failure.message,
        error: failure,
        severity: "warning",
        context: {
          module: "inbox",
          tab: "messages",
          action: "sendSequence",
        },
      });
      hapticService?.trigger("error");
      phase = "idle";
    }
  }
</script>

<div
  class="send-sequence-sheet"
  class:destination-selected={hasDestination}
  aria-busy={phase === "sending"}
>
  <article class="sequence-preview" aria-label="Sequence being shared">
    <div class="preview-thumbnail">
      {#if payload.sequenceThumbnail && !thumbnailFailed}
        <img
          src={payload.sequenceThumbnail}
          alt=""
          class="thumbnail-img"
          onerror={() => {
            thumbnailFailed = true;
          }}
        />
      {:else}
        <div class="thumbnail-fallback" aria-hidden="true">
          <i class="fas fa-layer-group"></i>
        </div>
      {/if}
    </div>

    <div class="preview-info">
      <span class="preview-kicker">Sharing</span>
      <strong class="preview-word">{displayWord || "Sequence"}</strong>
      <div class="preview-meta">
        {#if payload.sequenceStepCount}
          <span>{payload.sequenceStepCount} steps</span>
        {/if}
        {#if payload.sequenceAuthor}
          <span>by {payload.sequenceAuthor}</span>
        {/if}
      </div>
    </div>
  </article>

  <section
    class="destination-section"
    aria-labelledby="share-destination-title"
  >
    <div class="section-heading">
      <div>
        <span class="section-kicker">Destination</span>
        <h3 id="share-destination-title">Send to</h3>
      </div>
    </div>

    <div class="selected-slot" aria-live="polite">
      {#if hasDestination}
        <div class="selected-destination">
          <div class="selected-avatar">
            {#if selectedConversationIsGroup && selectedConversation}
              {#if selectedConversation.participantPreviews?.length}
                <GroupAvatarStack
                  participants={selectedConversation.participantPreviews}
                  customAvatar={selectedConversation.groupAvatar}
                  size={44}
                  maxVisible={3}
                />
              {:else}
                <span class="group-fallback" aria-hidden="true">
                  <i class="fas fa-user-group"></i>
                </span>
              {/if}
            {:else}
              <RobustAvatar
                src={selectedConversation?.otherParticipant?.avatar ??
                  selectedUser?.avatar}
                name={destinationName}
                alt=""
                customSize={44}
              />
            {/if}
          </div>
          <div class="selected-copy">
            <strong>{destinationName}</strong>
            <span>{destinationDetail}</span>
          </div>
          <button
            type="button"
            class="clear-destination"
            onclick={clearDestination}
            disabled={phase === "sending"}
          >
            Change
          </button>
        </div>
      {:else}
        <div class="destination-placeholder">
          <span class="placeholder-icon" aria-hidden="true">
            <i class="fas fa-paper-plane"></i>
          </span>
          <div>
            <strong>Choose a conversation</strong>
            <span>Pick a recent chat or find someone new.</span>
          </div>
        </div>
      {/if}
    </div>

    {#if !hasDestination}
      <div
        class="destination-browser"
        inert={phase === "sending"}
        aria-label="Share destinations"
      >
        {#if recentConversations.length > 0}
          <div class="destination-group">
            <h4>Recent conversations</h4>
            <div class="conversation-options">
              {#each recentConversations as conversation (conversation.id)}
                <ConversationItem
                  {conversation}
                  selectionMode
                  selected={selectedConversation?.id === conversation.id}
                  onclick={() => selectConversation(conversation)}
                />
              {/each}
            </div>
          </div>
        {/if}

        <div class="destination-group new-conversation">
          <h4>
            {recentConversations.length > 0
              ? "Start a new conversation"
              : "Find someone"}
          </h4>
          {#key searchResetKey}
            <UserSearchInput
              selectedUserId={searchUserId}
              selectedUserDisplay={searchUserDisplay}
              onSelect={selectUser}
              placeholder="Search by name or email"
              inlineResults
              {excludeUserIds}
              autofocus={recentConversations.length === 0}
            />
          {/key}
        </div>
      </div>
    {/if}
  </section>

  <div class="message-section">
    <label for="sequence-share-message">
      Note <span>Optional</span>
    </label>
    <textarea
      id="sequence-share-message"
      class="message-input"
      bind:value={message}
      placeholder="Add a note"
      maxlength={MESSAGE_MAX}
      rows={2}
      disabled={phase === "sending"}
    ></textarea>
    <span
      class="char-count"
      class:visible={message.length > MESSAGE_MAX * 0.8}
      aria-hidden={message.length <= MESSAGE_MAX * 0.8}
    >
      {message.length}/{MESSAGE_MAX}
    </span>
  </div>

  <button type="button" class="send-button" onclick={send} disabled={!canSend}>
    <i
      class="fas {phase === 'sending'
        ? 'fa-spinner fa-spin'
        : 'fa-paper-plane'}"
      aria-hidden="true"
    ></i>
    <span>{phase === "sending" ? "Sending…" : "Send sequence"}</span>
  </button>
</div>

<style>
  .send-sequence-sheet {
    container-type: inline-size;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto auto;
    gap: 0.875rem;
    height: 100%;
    min-height: 0;
    padding: 1rem;
    color: var(--theme-text);
  }

  .sequence-preview {
    display: grid;
    grid-template-columns: clamp(4.5rem, 18cqw, 6rem) minmax(0, 1fr);
    gap: 0.875rem;
    align-items: center;
    margin: 0;
    padding: 0.75rem;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 1rem;
  }

  .preview-thumbnail {
    display: grid;
    place-items: center;
    width: 100%;
    aspect-ratio: 1;
    overflow: hidden;
    background: color-mix(in srgb, var(--theme-panel-bg) 82%, transparent);
    border: 1px solid var(--theme-stroke);
    border-radius: 0.75rem;
  }

  .thumbnail-img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .thumbnail-fallback {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    color: var(--theme-text-dim);
    font-size: clamp(
      var(--font-size-xl, 1.25rem),
      6cqw,
      var(--font-size-3xl, 1.875rem)
    );
  }

  .preview-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .preview-kicker,
  .section-kicker {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .preview-word {
    overflow: hidden;
    margin-top: 0.2rem;
    color: var(--theme-text);
    font-size: clamp(
      var(--font-size-xl, 1.25rem),
      5cqw,
      var(--font-size-3xl, 1.875rem)
    );
    line-height: 1.15;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .preview-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
    margin-top: 0.4rem;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
  }

  .destination-section {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    gap: 0.625rem;
    min-height: 0;
  }

  .destination-selected .destination-section {
    grid-template-rows: auto auto;
  }

  .section-heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
  }

  .section-heading h3 {
    margin: 0.1rem 0 0;
    color: var(--theme-text);
    font-size: var(--font-size-base, 1rem);
    line-height: 1.2;
  }

  .clear-destination {
    min-width: 4.5rem;
    min-height: var(--min-touch-target, 44px);
    padding: 0.5rem 0.875rem;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 999px;
    color: var(--theme-accent, var(--semantic-info));
    font: inherit;
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 700;
    cursor: pointer;
  }

  .clear-destination:hover:not(:disabled) {
    border-color: var(--theme-accent, var(--semantic-info));
  }

  .clear-destination:focus-visible,
  .send-button:focus-visible {
    outline: 2px solid var(--theme-accent, var(--semantic-info));
    outline-offset: 2px;
  }

  .selected-slot {
    min-height: 4.5rem;
  }

  .selected-destination,
  .destination-placeholder {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 4.5rem;
    padding: 0.625rem 0.75rem;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 0.875rem;
  }

  .selected-destination {
    border-color: color-mix(
      in srgb,
      var(--theme-accent, var(--semantic-info)) 55%,
      var(--theme-stroke)
    );
  }

  .selected-avatar,
  .placeholder-icon {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    width: 44px;
    height: 44px;
  }

  .group-fallback,
  .placeholder-icon {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--semantic-info)) 14%,
      transparent
    );
    border-radius: 50%;
    color: var(--theme-accent, var(--semantic-info));
  }

  .selected-copy,
  .destination-placeholder > div:last-child {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  .selected-copy strong,
  .destination-placeholder strong {
    overflow: hidden;
    color: var(--theme-text);
    font-size: var(--font-size-base, 1rem);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .selected-copy span,
  .destination-placeholder span {
    margin-top: 0.15rem;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
  }

  .destination-browser {
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 0.875rem;
    scrollbar-width: thin;
    scrollbar-color: var(--theme-stroke) transparent;
  }

  .destination-browser[inert] {
    opacity: 0.65;
  }

  .destination-group {
    padding: 0.75rem;
  }

  .destination-group + .destination-group {
    border-top: 1px solid var(--theme-stroke);
  }

  .destination-group h4 {
    margin: 0 0 0.5rem;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 700;
  }

  .conversation-options {
    overflow: hidden;
    border: 1px solid var(--theme-stroke);
    border-radius: 0.75rem;
  }

  .conversation-options :global(.conversation-item:last-child) {
    border-bottom: 0;
  }

  .new-conversation {
    position: relative;
    z-index: 1;
  }

  .message-section {
    position: relative;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.35rem 0.75rem;
  }

  .message-section label {
    color: var(--theme-text);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 700;
  }

  .message-section label span {
    margin-left: 0.25rem;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 500;
  }

  .message-input {
    grid-column: 1 / -1;
    width: 100%;
    min-height: 3.25rem;
    max-height: 7.5rem;
    padding: 0.75rem;
    resize: vertical;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 0.75rem;
    color: var(--theme-text);
    font: inherit;
    font-size: var(--font-size-base, 1rem);
    line-height: 1.35;
  }

  .message-input::placeholder {
    color: var(--theme-text-dim);
  }

  .message-input:focus {
    border-color: var(--theme-accent, var(--semantic-info));
    outline: none;
    box-shadow: 0 0 0 2px
      color-mix(
        in srgb,
        var(--theme-accent, var(--semantic-info)) 22%,
        transparent
      );
  }

  .message-input:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }

  .char-count {
    justify-self: end;
    min-width: 4.75rem;
    visibility: hidden;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .char-count.visible {
    visibility: visible;
  }

  .send-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.625rem;
    width: 100%;
    min-height: 3rem;
    padding: 0.75rem 1rem;
    background: var(--theme-accent, var(--semantic-info));
    border: 1px solid transparent;
    border-radius: 0.875rem;
    color: white;
    font: inherit;
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 800;
    cursor: pointer;
    transition:
      filter var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease,
      opacity var(--duration-fast, 150ms) ease;
  }

  .send-button:hover:not(:disabled) {
    filter: brightness(1.08);
    transform: translateY(-1px);
  }

  .send-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .send-button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  @container (min-width: 34rem) {
    .sequence-preview {
      padding: 0.875rem;
    }

    .destination-group {
      padding: 0.875rem;
    }
  }

  @media (max-height: 31rem) {
    .send-sequence-sheet {
      gap: 0.375rem;
      padding: 0.375rem 0.5rem 0.5rem;
    }

    .sequence-preview {
      grid-template-columns: 2.5rem minmax(0, 1fr);
      gap: 0.5rem;
      padding: 0.25rem 0.5rem;
    }

    .preview-kicker,
    .preview-meta,
    .section-kicker {
      display: none;
    }

    .preview-word,
    .section-heading h3 {
      margin-top: 0;
    }

    .destination-section {
      gap: 0.35rem;
    }

    .selected-slot,
    .selected-destination,
    .destination-placeholder {
      min-height: 3rem;
    }

    .selected-destination,
    .destination-placeholder {
      padding: 0.25rem 0.5rem;
    }

    .selected-avatar,
    .placeholder-icon,
    .group-fallback {
      width: 36px;
      height: 36px;
    }

    .clear-destination {
      min-width: 4.25rem;
    }

    .destination-browser {
      min-height: 5rem;
    }

    .destination-group {
      padding: 0.5rem;
    }

    .message-input {
      min-height: 2.75rem;
      max-height: 3.5rem;
      padding-block: 0.5rem;
    }

    .send-button {
      min-height: var(--min-touch-target, 44px);
      padding-block: 0.5rem;
    }
  }

  @media (max-height: 31rem) and (min-width: 40rem) {
    .send-sequence-sheet {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-rows: auto minmax(0, 1fr) auto;
      column-gap: 0.5rem;
    }

    .sequence-preview,
    .destination-section {
      grid-column: 1 / -1;
    }

    .destination-section {
      grid-row: 2;
    }

    .destination-browser {
      min-height: 4.25rem;
    }

    .destination-group h4 {
      margin-bottom: 0.25rem;
    }

    .message-section {
      grid-column: 1;
      grid-row: 3;
    }

    .send-button {
      grid-column: 2;
      grid-row: 3;
      align-self: end;
      width: auto;
      min-width: 10rem;
    }
  }

  @media (max-height: 31rem) and (max-width: 39.999rem) {
    .send-sequence-sheet {
      grid-template-rows: auto auto auto auto;
      height: auto;
      min-height: 100%;
      overflow-y: auto;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .send-button {
      transition: none;
    }
  }
</style>
