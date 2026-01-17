<!--
  TIKA Tab - AI-Powered TKA Learning Assistant

  Two modes:
  - Conversation: Split-pane layout for learning with TIKA
  - Review: Human review of flagged evaluation results

  Uses AI SDK for streaming chat with tool-use architecture.
-->
<script lang="ts">
  import { useChat } from "@ai-sdk/svelte";
  import TIKAConversation from "./TIKAConversation.svelte";
  import TIKAContextPanel from "./TIKAContextPanel.svelte";
  import TIKAQuickReference from "./TIKAQuickReference.svelte";
  import TIKAReviewPanel from "./TIKAReviewPanel.svelte";
  import { getEffectiveUserId } from "$lib/shared/auth/state/authState.svelte";
  import type { ContextData } from "../types";

  // Mode toggle - conversation vs review
  type TabMode = "conversation" | "review";
  let mode = $state<TabMode>("conversation");

  // Context panel state
  let currentContext = $state<ContextData | null>(null);
  let pictographBase64 = $state<string | null>(null);

  // User identity
  const userId = $derived(getEffectiveUserId() || "anonymous");

  // Initialize useChat hook from AI SDK
  // Returns Svelte stores for messages and status
  const {
    messages,
    status,
    append,
    stop,
    input,
  } = useChat({
    api: "/api/tika/ask",
    body: {
      userId,
      completedConcepts: [],
      language: "en",
    },
    onError: (error: Error) => {
      console.error("[TIKA] Chat error:", error);
    },
  });

  // Derived - has context to show?
  let hasContext = $derived(currentContext !== null);

  // Handle suggestion click from Quick Reference - submit directly
  function handleSuggestionClick(question: string) {
    // Check store value for status
    let currentStatus: string = "ready";
    status.subscribe((s) => (currentStatus = s))();
    if (currentStatus === "ready") {
      append({ role: "user", content: question });
    }
  }

  // Handle new message submission from conversation component
  function handleSubmit(question: string) {
    append({ role: "user", content: question });
  }

  // Handle stop/abort streaming
  function handleStop() {
    stop();
  }

  // Fetch pictograph image
  async function fetchPictograph(letter: string, variation: number = 0) {
    try {
      const response = await fetch("/api/tika/pictograph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          letter,
          variation,
          options: {
            darkMode: true,
            size: 300,
            showTKA: true,
            showGrid: true,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        pictographBase64 = data.imageBase64;
      }
    } catch (error) {
      console.error("[TIKA] Pictograph fetch error:", error);
    }
  }

  // Close context panel
  function handleCloseContext() {
    currentContext = null;
    pictographBase64 = null;
  }

  // Watch for tool results that might update context
  // The AI SDK handles tool calls internally, but we can observe messages for context
  $effect(() => {
    // Subscribe to messages store
    const currentMessages = $messages;
    if (currentMessages.length === 0) return;

    // Check the latest assistant message for tool results
    const lastMessage = currentMessages[currentMessages.length - 1];
    if (lastMessage?.role === "assistant" && lastMessage.parts) {
      for (const part of lastMessage.parts) {
        if (part.type === "tool-invocation") {
          // Access the toolInvocation object - state is on the invocation, not the part
          const invocation = part.toolInvocation;
          if (invocation?.state === "result") {
            const toolName = invocation.toolName;

            if (toolName === "get_letter_explanation") {
              // Could parse result for context data if needed
              const letter = invocation.args?.letter as string | undefined;
              if (letter) {
                fetchPictograph(letter, 0);
              }
            }
          }
        }
      }
    }
  });
</script>

<div class="tika-tab">
  <!-- Mode Toggle -->
  <div class="mode-toggle">
    <button
      class="mode-btn"
      class:active={mode === "conversation"}
      onclick={() => (mode = "conversation")}
    >
      <i class="fas fa-comments" aria-hidden="true"></i>
      <span>Conversation</span>
    </button>
    <button
      class="mode-btn"
      class:active={mode === "review"}
      onclick={() => (mode = "review")}
    >
      <i class="fas fa-clipboard-check" aria-hidden="true"></i>
      <span>Review</span>
    </button>
  </div>

  {#if mode === "conversation"}
    <div class="panel-container" class:has-context={hasContext}>
      <!-- Conversation Panel (Left) -->
      <div class="conversation-panel">
        <TIKAConversation
          messages={$messages}
          status={$status}
          onSubmit={handleSubmit}
          onStop={handleStop}
        />
      </div>

      <!-- Context Panel (Right) - always visible -->
      <div class="context-panel">
        {#if hasContext}
          <TIKAContextPanel
            context={currentContext}
            {pictographBase64}
            onClose={handleCloseContext}
          />
        {:else}
          <TIKAQuickReference onSuggestionClick={handleSuggestionClick} />
        {/if}
      </div>
    </div>
  {:else}
    <TIKAReviewPanel />
  {/if}
</div>

<style>
  .tika-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
    background: transparent;
  }

  .panel-container {
    display: flex;
    flex: 1;
    gap: 0;
    overflow: hidden;
    transition: all var(--duration-emphasis) ease;
  }

  /* Default: 60% conversation, 40% reference */
  .conversation-panel {
    flex: 0.6;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: flex var(--duration-emphasis) ease;
  }

  /* With context: 55% conversation, 45% context */
  .panel-container.has-context .conversation-panel {
    flex: 0.55;
  }

  .context-panel {
    flex: 0.4;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .panel-container.has-context .context-panel {
    flex: 0.45;
  }

  /* Mobile: Stack vertically */
  @media (max-width: 768px) {
    .panel-container {
      flex-direction: column;
    }

    .conversation-panel {
      flex: 0.55;
    }

    .panel-container.has-context .conversation-panel {
      flex: 0.5;
    }

    .context-panel {
      flex: 0.45;
      border-left: none;
      border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    }

    .panel-container.has-context .context-panel {
      flex: 0.5;
    }
  }

  /* Mode Toggle */
  .mode-toggle {
    display: flex;
    gap: 0.25rem;
    padding: 0.5rem 1rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .mode-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: none;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    border-radius: 6px;
    transition: all var(--duration-fast) ease;
  }

  .mode-btn:hover {
    color: var(--theme-text, #fff);
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .mode-btn.active {
    color: var(--theme-accent, #6366f1);
    background: rgba(99, 102, 241, 0.15);
  }

  .mode-btn i {
    font-size: 1rem;
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .panel-container,
    .conversation-panel,
    .context-panel,
    .mode-btn {
      transition: none;
    }
  }
</style>
