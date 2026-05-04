<!--
  TIKA Conversation Panel

  Chat interface for interacting with the TIKA AI assistant.
  Orchestrates header, messages, and input components.
-->
<script lang="ts">
  import { tick } from "svelte";
  import type { UIMessage } from "ai";
  import TikaHeader from "./TikaHeader.svelte";
  import TikaWelcome from "./TikaWelcome.svelte";
  import TikaAssistantMessage from "./TikaAssistantMessage.svelte";
  import TikaInputArea from "./TikaInputArea.svelte";
  import { getTextFromParts } from "../services/tika-message-extractor";
  import type { ModelOption } from "../types";
  import type { ReviewStatus, ReviewMetadata } from "../domain/models/tika-conversation-models";
  import type { WelcomeContext } from "../services/contracts/types";

  // Props
  let {
    messages = [],
    status = "ready",
    onSubmit,
    onStop,
    onNewChat,
    onOpenHistory,
    onOpenReview,
    generateCopyForAI,
    selectedModel = "sonnet-4",
    availableModels = [],
    onModelChange,
    sessionId,
    isFlagged = false,
    onFlagForReview,
    reviewStatus,
    reviewMetadata,
    onQuizComplete,
    welcomeContext,
    compareMode = false,
    onToggleCompare,
  }: {
    messages: UIMessage[];
    status: "submitted" | "streaming" | "ready" | "error";
    onSubmit: (question: string) => void;
    onStop: () => void;
    onNewChat?: () => void;
    onOpenHistory?: () => void;
    onOpenReview?: () => void;
    generateCopyForAI?: () => string;
    selectedModel?: string;
    availableModels?: ModelOption[];
    onModelChange?: (modelId: string) => void;
    sessionId?: string | null;
    isFlagged?: boolean;
    onFlagForReview?: (flagged: boolean) => void;
    reviewStatus?: ReviewStatus;
    reviewMetadata?: ReviewMetadata;
    onQuizComplete?: (quizId: string, topic: string, correct: boolean) => void;
    welcomeContext?: WelcomeContext;
    compareMode?: boolean;
    onToggleCompare?: () => void;
  } = $props();

  // Local state
  let chatContainer: HTMLElement | null = $state(null);
  let showToolDetails = $state(false);

  // Derived state
  const isStreaming = $derived(status === "streaming");

  // Auto-scroll to bottom when new messages arrive or content streams
  $effect(() => {
    if (messages.length > 0 && chatContainer) {
      tick().then(() => {
        chatContainer?.scrollTo({
          top: chatContainer.scrollHeight,
          behavior: "smooth",
        });
      });
    }
  });

  // Check if a message is still streaming (last assistant message with streaming status)
  function isMessageStreaming(message: UIMessage, index: number): boolean {
    return (
      isStreaming &&
      message.role === "assistant" &&
      index === messages.length - 1
    );
  }

</script>

<div class="conversation-panel">
  <TikaHeader
    {reviewStatus}
    {reviewMetadata}
    {selectedModel}
    {availableModels}
    {onModelChange}
    {onNewChat}
    {onOpenHistory}
    {onOpenReview}
    {sessionId}
    {isFlagged}
    {onFlagForReview}
    hasMessages={messages.length > 0}
    {chatContainer}
    {showToolDetails}
    onToggleToolDetails={() => (showToolDetails = !showToolDetails)}
    {generateCopyForAI}
    {compareMode}
    {onToggleCompare}
  />

  <!-- Chat Messages -->
  <div class="chat-container themed-scrollbar" bind:this={chatContainer}>
    {#if messages.length === 0}
      <TikaWelcome {onSubmit} isLoading={status === "submitted" || status === "streaming"} {welcomeContext} />
    {:else}
      <!-- Conversation History -->
      {#each messages as message, index (message.id)}
        {#if message.role === "user"}
          <!-- User Message -->
          <div class="message user-message">
            <div class="message-content">
              <p>{getTextFromParts(message.parts)}</p>
            </div>
          </div>
        {:else if message.role === "assistant"}
          <TikaAssistantMessage
            {message}
            isStreaming={isMessageStreaming(message, index)}
            {showToolDetails}
            {onQuizComplete}
          />
        {/if}
      {/each}

      <!-- Loading indicator for submitted state (before streaming starts) -->
      {#if status === "submitted"}
        <div class="message assistant-message loading">
          <div class="message-avatar">
            <i class="fas fa-robot" aria-hidden="true"></i>
          </div>
          <div class="message-content">
            <div class="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </div>

  {#if status === "error"}
    <div class="error-banner" role="alert">
      <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
      <span>Tika couldn't respond. Check your connection and try again.</span>
    </div>
  {/if}

  <TikaInputArea {status} {onSubmit} {onStop} />
</div>

<style>
  .conversation-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  /* Chat Container */
  .chat-container {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* User Messages */
  .message {
    display: flex;
    gap: 12px;
    max-width: 100%;
  }

  .user-message {
    justify-content: flex-end;
  }

  .user-message .message-content {
    background: var(--theme-accent, #6366f1);
    color: white;
    border-radius: 16px 16px 4px 16px;
    padding: 12px 16px;
    max-width: 80%;
  }

  .message-content p {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--theme-text, #ffffff);
    white-space: pre-wrap;
  }

  /* Loading state (duplicated from TikaAssistantMessage for the initial loading bubble) */
  .assistant-message {
    justify-content: flex-start;
  }

  .message-avatar {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: linear-gradient(135deg, var(--theme-accent, #818cf8) 0%, color-mix(in srgb, var(--theme-accent, #6366f1) 85%, black) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .message-avatar i {
    font-size: 14px;
    color: white;
  }

  .assistant-message .message-content {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 4px 16px 16px 16px;
    padding: 12px 16px;
    max-width: 85%;
  }

  .typing-indicator {
    display: flex;
    gap: 4px;
    padding: 4px 0;
  }

  .typing-indicator span {
    width: 8px;
    height: 8px;
    background: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    border-radius: 50%;
    animation: typing 1.4s infinite;
  }

  .typing-indicator span:nth-child(2) {
    animation-delay: var(--duration-normal);
  }

  .typing-indicator span:nth-child(3) {
    animation-delay: var(--duration-dramatic);
  }

  @keyframes typing {
    0%,
    60%,
    100% {
      opacity: 0.3;
      transform: scale(0.8);
    }
    30% {
      opacity: 1;
      transform: scale(1);
    }
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 12%, transparent);
    border-top: 1px solid color-mix(in srgb, var(--semantic-error, #ef4444) 30%, transparent);
    color: var(--semantic-error, #ef4444);
    font-size: var(--font-size-min, 14px);
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .typing-indicator span {
      animation: none;
      opacity: 0.5;
    }
  }
</style>
