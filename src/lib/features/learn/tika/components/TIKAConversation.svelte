<!--
  TIKA Conversation Panel

  Chat interface for interacting with the TIKA AI assistant.
  Shows conversation history and input field.
-->
<script lang="ts">
  import { tick } from "svelte";
  import type { ConversationItem } from "../types";

  // Props
  let {
    conversationHistory = [],
    isLoading = false,
    onSubmit,
  }: {
    conversationHistory: ConversationItem[];
    isLoading: boolean;
    onSubmit: (question: string) => Promise<void>;
  } = $props();

  // Local state
  let inputValue = $state("");
  let chatContainer: HTMLElement | null = $state(null);
  let showToolDetails = $state(false);

  // Auto-scroll to bottom when new messages arrive
  $effect(() => {
    if (conversationHistory.length > 0 && chatContainer) {
      tick().then(() => {
        chatContainer?.scrollTo({
          top: chatContainer.scrollHeight,
          behavior: "smooth",
        });
      });
    }
  });

  // Handle form submission
  async function handleSubmit(e: Event) {
    e.preventDefault();
    const question = inputValue.trim();
    if (!question || isLoading) return;

    inputValue = "";
    await onSubmit(question);
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
</script>

<div class="conversation-panel">
  <!-- Header -->
  <header class="panel-header">
    <div class="header-title">
      <i class="fas fa-robot" aria-hidden="true"></i>
      <span>TIKA</span>
    </div>
    <div class="header-subtitle">TKA Intelligent Knowledge Assistant</div>
    {#if conversationHistory.length > 0}
      <button
        class="tool-toggle"
        onclick={() => (showToolDetails = !showToolDetails)}
        title="Toggle tool details"
        aria-label={showToolDetails ? "Hide tool details" : "Show tool details"}
        aria-expanded={showToolDetails}
      >
        <i class="fas fa-wrench" aria-hidden="true"></i>
        {showToolDetails ? "Hide Tools" : "Show Tools"}
      </button>
    {/if}
  </header>

  <!-- Chat Messages -->
  <div class="chat-container themed-scrollbar" bind:this={chatContainer}>
    {#if conversationHistory.length === 0}
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
      {#each conversationHistory as item, index}
        <!-- User Message -->
        <div class="message user-message">
          <div class="message-content">
            <p>{item.question}</p>
          </div>
        </div>

        <!-- Assistant Response -->
        <div class="message assistant-message">
          <div class="message-avatar">
            <i class="fas fa-robot" aria-hidden="true"></i>
          </div>
          <div class="message-content">
            <p>{item.response.explanation}</p>

            <!-- Tool Details (if enabled) -->
            {#if showToolDetails && item.response.toolsCalled.length > 0}
              <div class="tool-details">
                <div class="tool-header">
                  <i class="fas fa-wrench" aria-hidden="true"></i>
                  Tools called ({item.response.toolsCalled.length})
                </div>
                {#each item.response.toolsCalled as tool}
                  <div class="tool-item">
                    <span class="tool-name">{formatToolName(tool.name)}</span>
                    <span class="tool-input">
                      {JSON.stringify(tool.input)}
                    </span>
                  </div>
                {/each}
              </div>
            {/if}

            <!-- Metadata -->
            <div class="message-meta">
              <span class="latency">{item.response.latencyMs}ms</span>
              {#if item.response.toolsCalled.length > 0}
                <span class="tools-badge">
                  <i class="fas fa-wrench" aria-hidden="true"></i>
                  {item.response.toolsCalled.length}
                </span>
              {/if}
            </div>
          </div>
        </div>
      {/each}

      <!-- Loading Indicator -->
      {#if isLoading}
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
      <button
        type="submit"
        class="send-button"
        disabled={!inputValue.trim() || isLoading}
        title="Send message"
        aria-label={isLoading ? "Sending message" : "Send message"}
      >
        {#if isLoading}
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        {:else}
          <i class="fas fa-paper-plane" aria-hidden="true"></i>
        {/if}
      </button>
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

  .tool-toggle {
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
    transition: all 0.2s ease;
  }

  .tool-toggle:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #ffffff);
  }

  .tool-toggle:focus-visible {
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
    transition: all 0.2s ease;
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

  .message-meta {
    display: flex;
    gap: 8px;
    margin-top: 8px;
    font-size: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }

  .tools-badge {
    display: flex;
    align-items: center;
    gap: 4px;
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

  .tool-name {
    color: var(--theme-text, #ffffff);
    font-weight: 500;
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

  .typing-indicator span {
    width: 8px;
    height: 8px;
    background: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    border-radius: 50%;
    animation: typing 1.4s infinite;
  }

  .typing-indicator span:nth-child(2) {
    animation-delay: 0.2s;
  }

  .typing-indicator span:nth-child(3) {
    animation-delay: 0.4s;
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
    transition: border-color 0.2s ease;
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

  .send-button {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    background: var(--theme-accent, #6366f1);
    border: none;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .send-button:hover:not(:disabled) {
    transform: scale(1.05);
    filter: brightness(1.1);
  }

  .send-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .send-button:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .tool-toggle,
    .suggestion-list button,
    .send-button,
    .input-wrapper {
      transition: none;
    }

    .send-button:hover:not(:disabled) {
      transform: none;
    }

    .typing-indicator span {
      animation: none;
      opacity: 0.5;
    }
  }
</style>
