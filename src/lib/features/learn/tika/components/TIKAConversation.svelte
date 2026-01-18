<!--
  TIKA Conversation Panel

  Chat interface for interacting with the TIKA AI assistant.
  Shows conversation history with streaming support via AI SDK.
-->
<script lang="ts">
  import { tick } from "svelte";
  import type { UIMessage } from "ai";
  import CopyForAIButton from "$lib/shared/foundation/ui/CopyForAIButton.svelte";

  // Props - using AI SDK types
  let {
    messages = [],
    status = "ready",
    onSubmit,
    onStop,
    onNewChat,
    onOpenHistory,
    generateCopyForAI,
  }: {
    messages: UIMessage[];
    status: "submitted" | "streaming" | "ready" | "error";
    onSubmit: (question: string) => void;
    onStop: () => void;
    onNewChat?: () => void;
    onOpenHistory?: () => void;
    generateCopyForAI?: () => string;
  } = $props();

  // Local state
  let inputValue = $state("");
  let chatContainer: HTMLElement | null = $state(null);
  let showToolDetails = $state(false);

  // Derived state
  const isLoading = $derived(status === "submitted" || status === "streaming");
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

  // Handle form submission
  function handleSubmit(e: Event) {
    e.preventDefault();
    const question = inputValue.trim();
    if (!question || isLoading) return;

    inputValue = "";
    onSubmit(question);
  }

  // Handle keyboard shortcut
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  // Format tool name for display
  function formatToolName(name: string): string {
    return name
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // Get text content from message parts
  function getTextFromParts(parts: UIMessage["parts"]): string {
    if (!parts) return "";
    return parts
      .filter((part) => part.type === "text")
      .map((part) => (part as { type: "text"; text: string }).text)
      .join("");
  }

  // Get tool invocations from message parts
  function getToolsFromParts(parts: UIMessage["parts"]) {
    if (!parts) return [];
    return parts.filter(
      (part) => part.type === "tool-invocation"
    ) as Array<{
      type: "tool-invocation";
      toolInvocation: {
        toolName: string;
        args: Record<string, unknown>;
        state: "partial-call" | "call" | "result";
        result?: unknown;
      };
    }>;
  }

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
  <!-- Header -->
  <header class="panel-header">
    <div class="header-title">
      <i class="fas fa-robot" aria-hidden="true"></i>
      <span>TIKA</span>
    </div>
    <div class="header-subtitle">TKA Intelligent Knowledge Assistant</div>
    <div class="header-actions">
      {#if onNewChat}
        <button
          class="header-btn"
          onclick={onNewChat}
          title="New conversation"
          aria-label="Start new conversation"
        >
          <i class="fas fa-plus" aria-hidden="true"></i>
        </button>
      {/if}
      {#if onOpenHistory}
        <button
          class="header-btn"
          onclick={onOpenHistory}
          title="Chat history"
          aria-label="Open chat history"
        >
          <i class="fas fa-history" aria-hidden="true"></i>
        </button>
      {/if}
      {#if messages.length > 0}
        <button
          class="header-btn"
          onclick={() => (showToolDetails = !showToolDetails)}
          title="Toggle tool details"
          aria-label={showToolDetails ? "Hide tool details" : "Show tool details"}
          aria-expanded={showToolDetails}
        >
          <i class="fas fa-wrench" aria-hidden="true"></i>
        </button>
        {#if generateCopyForAI}
          <CopyForAIButton
            getData={generateCopyForAI}
            variant="icon-text"
            size="sm"
            idleIcon="fa-copy"
            ariaLabel="Copy conversation for AI review"
          />
        {/if}
      {/if}
    </div>
  </header>

  <!-- Chat Messages -->
  <div class="chat-container themed-scrollbar" bind:this={chatContainer}>
    {#if messages.length === 0}
      <!-- Welcome State -->
      <div class="welcome-state">
        <div class="welcome-icon">
          <i class="fas fa-graduation-cap" aria-hidden="true"></i>
        </div>
        <h2>Welcome to TIKA</h2>
        <p>
          I'm your AI tutor for The Kinetic Alphabet. Ask me anything about:
        </p>
        <ul class="suggestion-list">
          <li>
            <button onclick={() => onSubmit("What is letter A?")} disabled={isLoading}>
              <i class="fas fa-font" aria-hidden="true"></i> Letters (A-Z, Greek)
            </button>
          </li>
          <li>
            <button onclick={() => onSubmit("What does alpha mean?")} disabled={isLoading}>
              <i class="fas fa-book" aria-hidden="true"></i> Terms (alpha, pro, shift)
            </button>
          </li>
          <li>
            <button onclick={() => onSubmit("Compare A and B")} disabled={isLoading}>
              <i class="fas fa-balance-scale" aria-hidden="true"></i> Letter comparisons
            </button>
          </li>
          <li>
            <button onclick={() => onSubmit("What are Type 1 letters?")} disabled={isLoading}>
              <i class="fas fa-layer-group" aria-hidden="true"></i> Letter types
            </button>
          </li>
        </ul>
      </div>
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
          <!-- Assistant Response -->
          <div class="message assistant-message">
            <div class="message-avatar">
              <i class="fas fa-robot" aria-hidden="true"></i>
            </div>
            <div class="message-content">
              <!-- Text content -->
              {#if getTextFromParts(message.parts)}
                <p>
                  {getTextFromParts(message.parts)}
                  {#if isMessageStreaming(message, index)}
                    <span class="streaming-cursor"></span>
                  {/if}
                </p>
              {:else if isMessageStreaming(message, index)}
                <!-- Still waiting for text to stream -->
                <div class="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              {/if}

              <!-- Tool Details (if enabled) -->
              {#if showToolDetails}
                {@const tools = getToolsFromParts(message.parts)}
                {#if tools.length > 0}
                  <div class="tool-details">
                    <div class="tool-header">
                      <i class="fas fa-wrench" aria-hidden="true"></i>
                      Tools called ({tools.length})
                    </div>
                    {#each tools as toolPart}
                      <div class="tool-item" class:pending={toolPart.toolInvocation.state !== "result"}>
                        <span class="tool-name">
                          {formatToolName(toolPart.toolInvocation.toolName)}
                          {#if toolPart.toolInvocation.state !== "result"}
                            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
                          {/if}
                        </span>
                        <span class="tool-input">
                          {JSON.stringify(toolPart.toolInvocation.args)}
                        </span>
                      </div>
                    {/each}
                  </div>
                {/if}
              {/if}
            </div>
          </div>
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

  <!-- Input Area -->
  <form class="input-area" onsubmit={handleSubmit}>
    <div class="input-wrapper">
      <textarea
        bind:value={inputValue}
        onkeydown={handleKeydown}
        placeholder="Ask TIKA about TKA..."
        disabled={isLoading}
        rows="1"
      ></textarea>
      {#if isStreaming}
        <!-- Stop button when streaming -->
        <button
          type="button"
          class="stop-button"
          onclick={onStop}
          title="Stop generating"
          aria-label="Stop generating"
        >
          <i class="fas fa-stop" aria-hidden="true"></i>
        </button>
      {:else}
        <!-- Send button -->
        <button
          type="submit"
          class="send-button"
          disabled={!inputValue.trim() || isLoading}
          title="Send message"
          aria-label={isLoading ? "Sending message" : "Send message"}
        >
          {#if status === "submitted"}
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          {:else}
            <i class="fas fa-paper-plane" aria-hidden="true"></i>
          {/if}
        </button>
      {/if}
    </div>
  </form>
</div>

<style>
  .conversation-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  /* Header */
  .panel-header {
    padding: 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 18px;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .header-title i {
    color: var(--theme-accent, #6366f1);
  }

  .header-subtitle {
    font-size: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    flex: 1;
  }

  .header-actions {
    display: flex;
    gap: 6px;
  }

  .header-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: 12px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .header-btn:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #ffffff);
  }

  .header-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
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

  /* Welcome State */
  .welcome-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 32px 16px;
    flex: 1;
  }

  .welcome-icon {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    background: linear-gradient(135deg, #818cf8 0%, #6366f1 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
  }

  .welcome-icon i {
    font-size: 28px;
    color: white;
  }

  .welcome-state h2 {
    font-size: 20px;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    margin: 0 0 8px 0;
  }

  .welcome-state p {
    font-size: 14px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    margin: 0 0 16px 0;
  }

  .suggestion-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    max-width: 280px;
  }

  .suggestion-list button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text, #ffffff);
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .suggestion-list button:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-accent, #6366f1);
  }

  .suggestion-list button:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .suggestion-list button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .suggestion-list button i {
    color: var(--theme-accent, #6366f1);
    width: 16px;
  }

  /* Messages */
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

  .assistant-message {
    justify-content: flex-start;
  }

  .message-avatar {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: linear-gradient(135deg, #818cf8 0%, #6366f1 100%);
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

  .message-content p {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--theme-text, #ffffff);
    white-space: pre-wrap;
  }

  /* Streaming cursor */
  .streaming-cursor {
    display: inline-block;
    width: 2px;
    height: 1em;
    background: var(--theme-accent, #6366f1);
    margin-left: 2px;
    animation: blink 1s step-end infinite;
    vertical-align: text-bottom;
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
  }

  /* Tool Details */
  .tool-details {
    margin-top: 12px;
    padding: 10px;
    background: rgba(99, 102, 241, 0.1);
    border-radius: 8px;
    font-size: 12px;
  }

  .tool-header {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--theme-accent, #6366f1);
    font-weight: 500;
    margin-bottom: 8px;
  }

  .tool-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    margin-bottom: 4px;
  }

  .tool-item.pending {
    opacity: 0.7;
  }

  .tool-name {
    color: var(--theme-text, #ffffff);
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .tool-input {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-family: monospace;
    font-size: 12px;
    word-break: break-all;
  }

  /* Loading Indicator */
  .loading .typing-indicator {
    display: flex;
    gap: 4px;
    padding: 4px 0;
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

  /* Input Area */
  .input-area {
    padding: 16px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .input-wrapper {
    display: flex;
    gap: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    padding: 8px 12px;
    transition: border-color var(--duration-normal) ease;
  }

  .input-wrapper:focus-within {
    border-color: var(--theme-accent, #6366f1);
  }

  .input-wrapper textarea {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--theme-text, #ffffff);
    font-size: 14px;
    resize: none;
    line-height: 1.5;
    min-height: 24px;
    max-height: 120px;
  }

  .input-wrapper textarea::placeholder {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }

  .send-button,
  .stop-button {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    border: none;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    flex-shrink: 0;
  }

  .send-button {
    background: var(--theme-accent, #6366f1);
  }

  .stop-button {
    background: var(--semantic-error, #ef4444);
  }

  .send-button:hover:not(:disabled),
  .stop-button:hover {
    transform: scale(1.05);
    filter: brightness(1.1);
  }

  .send-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .send-button:focus-visible,
  .stop-button:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .header-btn,
    .suggestion-list button,
    .send-button,
    .stop-button,
    .input-wrapper,
    .streaming-cursor {
      transition: none;
      animation: none;
    }

    .send-button:hover:not(:disabled),
    .stop-button:hover {
      transform: none;
    }

    .typing-indicator span {
      animation: none;
      opacity: 0.5;
    }
  }
</style>
