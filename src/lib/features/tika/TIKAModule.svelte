<!--
  TIKA Module - AI-Powered TKA Learning Assistant

  Two modes:
  - Conversation: Single-column chat with inline pictographs
  - Review: Human review of flagged evaluation results

  Uses AI SDK for streaming chat with tool-use architecture.
  Pictographs render inline in message bubbles (no side panel).
-->
<script lang="ts">
  import { Chat, type UIMessage } from "@ai-sdk/svelte";
  import { DefaultChatTransport } from "ai";
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import TIKAConversation from "./components/TIKAConversation.svelte";
  import TIKAReviewPanel from "./components/TIKAReviewPanel.svelte";
  import TIKAHistoryDrawer from "./components/TIKAHistoryDrawer.svelte";
  import { getEffectiveUserId, authState } from "$lib/shared/auth/state/authState.svelte";
  import { ConceptProgressTracker } from "$lib/features/learn/services/implementations/ConceptProgressTracker";
  import { TIKASessionRepository } from "./services/implementations/TIKASessionRepository";
  import { TIKA_LIMITS } from "./data/firestore-paths";
  import type { ModelOption } from "./types";

  // Persistence keys
  const STORAGE_KEY = "tika-conversation";
  const MODEL_STORAGE_KEY = "tika_model_preference";

  // Load persisted messages from sessionStorage
  function loadPersistedMessages(): UIMessage[] {
    if (!browser) return [];
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn("[TIKA] Failed to load persisted messages:", e);
    }
    return [];
  }

  // Load model preference from localStorage
  function loadModelPreference(): string {
    if (!browser) return "sonnet-4";
    try {
      const stored = localStorage.getItem(MODEL_STORAGE_KEY);
      return stored || "sonnet-4";
    } catch {
      return "sonnet-4";
    }
  }

  // Model selection state
  let selectedModel = $state(loadModelPreference());
  let availableModels = $state<ModelOption[]>([]);

  // Mode toggle - conversation vs review
  type TabMode = "conversation" | "review";
  let mode = $state<TabMode>("conversation");

  // Session management state
  let currentSessionId = $state<string | null>(null);
  let showHistory = $state(false);
  let autoSaveTimeout: ReturnType<typeof setTimeout> | null = null;

  // Repository instance (initialized lazily when user is authenticated)
  const sessionRepository = browser ? new TIKASessionRepository() : null;

  // Check if user is authenticated
  const isAuthenticated = $derived(authState.isAuthenticated);

  // User identity
  const userId = $derived(getEffectiveUserId() || "anonymous");

  // Progress tracker for user level detection
  const progressTracker = browser ? new ConceptProgressTracker() : null;
  const completedConcepts = $derived.by(() => {
    if (!progressTracker) return [];
    const progress = progressTracker.getProgress();
    return Array.from(progress.completedConcepts);
  });

  // Initialize Chat class from AI SDK with persistence
  const chat = browser
    ? new Chat({
        id: "tika-main",
        transport: new DefaultChatTransport({
          api: "/api/tika/ask",
          body: () => ({
            userId,
            completedConcepts,
            language: "en",
            model: selectedModel,
          }),
        }),
        messages: loadPersistedMessages(),
        onError: (error: Error) => {
          console.error("[TIKA] Chat error:", error);
        },
      })
    : null;

  // Derived reactive bindings for chat state
  // These ensure Svelte 5 properly tracks reactivity from the Chat class
  // IMPORTANT: Must be defined AFTER chat initialization
  const chatMessages = $derived(chat?.messages ?? []);
  const chatStatus = $derived(chat?.status ?? "ready");

  // Persist messages to sessionStorage when they change
  $effect(() => {
    if (browser && chatMessages.length > 0) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(chatMessages));
      } catch (e) {
        console.warn("[TIKA] Failed to persist messages:", e);
      }
    }
  });

  // Auto-save to Firebase (debounced) when messages change
  $effect(() => {
    // Skip if not authenticated or no repository
    if (!isAuthenticated || !sessionRepository) return;

    // Skip if below minimum message threshold
    if (chatMessages.length < TIKA_LIMITS.MIN_MESSAGES_FOR_SAVE) return;

    // Clear existing timeout
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }

    // Debounce the save
    autoSaveTimeout = setTimeout(async () => {
      try {
        const session = await sessionRepository.saveSession(
          currentSessionId ?? undefined,
          chatMessages
        );
        // Update session ID if this was a new session
        if (!currentSessionId) {
          currentSessionId = session.id;
        }
      } catch (error) {
        console.error("[TIKA] Auto-save failed:", error);
      }
    }, TIKA_LIMITS.AUTO_SAVE_DEBOUNCE_MS);
  });

  // Cleanup auto-save timeout on unmount
  $effect(() => {
    return () => {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }
    };
  });

  // Fetch available models on mount
  onMount(async () => {
    try {
      const res = await fetch("/api/tika/models");
      const data = await res.json();
      availableModels = data.models || [];

      // Validate saved preference still exists
      if (availableModels.length > 0 && !availableModels.find((m) => m.id === selectedModel)) {
        selectedModel = availableModels[0]?.id || "sonnet-4";
      }
    } catch (error) {
      console.error("[TIKA] Failed to fetch models:", error);
      // Fallback: show Sonnet only on network error
      availableModels = [{
        id: "sonnet-4",
        name: "Claude Sonnet 4",
        shortName: "Sonnet 4",
        icon: "fa-brain",
        color: "#6366f1",
        description: "Balanced intelligence",
      }];
    }
  });

  // Handle model change
  function handleModelChange(modelId: string) {
    selectedModel = modelId;
    // Persist to localStorage
    if (browser) {
      try {
        localStorage.setItem(MODEL_STORAGE_KEY, modelId);
      } catch {
        // Ignore storage errors
      }
    }
  }

  // Handle new message submission from conversation component
  function handleSubmit(question: string) {
    chat?.sendMessage({ text: question });
  }

  // Handle stop/abort streaming
  function handleStop() {
    chat?.stop();
  }

  // Start a new conversation
  async function handleNewChat() {
    // Save current session if it has messages
    if (isAuthenticated && sessionRepository && chatMessages.length >= TIKA_LIMITS.MIN_MESSAGES_FOR_SAVE) {
      try {
        await sessionRepository.saveSession(
          currentSessionId ?? undefined,
          chatMessages
        );
      } catch (error) {
        console.error("[TIKA] Failed to save session before new chat:", error);
      }
    }

    // Clear current conversation
    if (chat) chat.messages = [];
    currentSessionId = null;

    // Clear sessionStorage
    if (browser) {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }

  // Load a previous session
  async function handleLoadSession(sessionId: string) {
    if (!sessionRepository || !chat) return;

    try {
      const session = await sessionRepository.getSession(sessionId);
      if (session) {
        chat.messages = session.messages as UIMessage[];
        currentSessionId = session.id;

        // Update sessionStorage
        if (browser) {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session.messages));
        }
      }
    } catch (error) {
      console.error("[TIKA] Failed to load session:", error);
    }
  }

  // Open/close history drawer
  function handleOpenHistory() {
    showHistory = true;
  }

  function handleCloseHistory() {
    showHistory = false;
  }

  // Helper to extract text from message parts
  function getTextFromParts(parts: UIMessage["parts"]): string {
    return parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");
  }

  // Extract explanation from tool output, handling canonical response format
  function extractToolExplanation(output: unknown): string {
    if (typeof output === "string") return output;
    if (output && typeof output === "object") {
      const obj = output as Record<string, unknown>;
      // Check for explanation field (canonical response format)
      if (typeof obj.explanation === "string") {
        return obj.explanation;
      }
      // Fallback to JSON
      return JSON.stringify(output, null, 2);
    }
    return String(output);
  }

  // Generate conversation data for AI review (returns string for CopyForAIButton)
  function generateCopyForAI(): string {
    if (chatMessages.length === 0) return "";

    // Format conversation for AI review
    const lines: string[] = [
      "# TIKA Conversation for Review",
      "",
      `**Date:** ${new Date().toLocaleString()}`,
      `**Messages:** ${chatMessages.length}`,
      "",
      "---",
      "",
    ];

    for (const message of chatMessages) {
      if (message.role === "user") {
        lines.push(`## User Question`);
        lines.push("");
        lines.push(getTextFromParts(message.parts));
        lines.push("");
      } else if (message.role === "assistant") {
        lines.push(`## TIKA Response`);
        lines.push("");

        // Extract text content
        if (message.parts) {
          const textParts = message.parts.filter((p) => p.type === "text");
          const text = textParts
            .map((p) => (p as { type: "text"; text: string }).text)
            .join("");
          if (text) {
            lines.push(text);
            lines.push("");
          }

          // Extract tool output (new AI SDK format: type is "tool-{toolName}")
          let hasToolOutput = false;
          for (const part of message.parts) {
            if (part.type.startsWith("tool-") && part.type !== "tool-invocation") {
              const toolPart = part as { output?: unknown; state?: string; input?: Record<string, unknown> };
              if (toolPart.state === "output-available" && toolPart.output) {
                hasToolOutput = true;
                // Extract explanation field if present (canonical response format)
                const output = extractToolExplanation(toolPart.output);
                lines.push(output);
                lines.push("");
              }
            }
          }

          // Extract tool calls (old format)
          if (!hasToolOutput) {
            const toolParts = message.parts.filter(
              (p) => p.type === "tool-invocation"
            );
            if (toolParts.length > 0) {
              lines.push("### Tools Called");
              lines.push("");
              for (const part of toolParts) {
                const inv = (
                  part as {
                    type: "tool-invocation";
                    toolInvocation: {
                      toolName: string;
                      args: Record<string, unknown>;
                      state: string;
                      result?: unknown;
                    };
                  }
                ).toolInvocation;
                lines.push(`- **${inv.toolName}**: \`${JSON.stringify(inv.args)}\``);
                // Include result if available
                if (inv.state === "result" && inv.result) {
                  const result = inv.result as Record<string, unknown>;
                  if (typeof result.explanation === "string") {
                    lines.push("");
                    lines.push(result.explanation);
                  }
                }
              }
              lines.push("");
            }
          }
        } else {
          // Fallback: extract text from parts
          const text = getTextFromParts(message.parts);
          if (text) {
            lines.push(text);
            lines.push("");
          }
        }
      }
      lines.push("---");
      lines.push("");
    }

    return lines.join("\n");
  }

</script>

<div class="tika-module">
  {#if mode === "conversation"}
    <!-- Single-column conversation (inline images in messages) -->
    <div class="conversation-container">
      <TIKAConversation
        messages={chatMessages}
        status={chatStatus}
        onSubmit={handleSubmit}
        onStop={handleStop}
        onNewChat={isAuthenticated ? handleNewChat : undefined}
        onOpenHistory={isAuthenticated ? handleOpenHistory : undefined}
        onOpenReview={() => (mode = "review")}
        {generateCopyForAI}
        {selectedModel}
        {availableModels}
        onModelChange={handleModelChange}
      />
    </div>
  {:else}
    <TIKAReviewPanel onBack={() => (mode = "conversation")} />
  {/if}

  <!-- History Drawer -->
  {#if showHistory && isAuthenticated && sessionRepository}
    <div class="history-overlay" role="presentation">
      <button
        class="history-backdrop"
        onclick={handleCloseHistory}
        aria-label="Close history"
      ></button>
      <div class="history-drawer-container">
        <TIKAHistoryDrawer
          repository={sessionRepository}
          {currentSessionId}
          onNewChat={handleNewChat}
          onLoadSession={handleLoadSession}
          onClose={handleCloseHistory}
        />
      </div>
    </div>
  {/if}
</div>

<style>
  .tika-module {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
    background: transparent;
  }

  /* Single-column conversation layout */
  .conversation-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
  }

  /* History Overlay */
  .history-overlay {
    position: absolute;
    inset: 0;
    z-index: 100;
    display: flex;
    justify-content: flex-end;
  }

  .history-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    border: none;
    cursor: pointer;
    backdrop-filter: blur(2px);
  }

  .history-drawer-container {
    position: relative;
    width: 320px;
    max-width: 90vw;
    height: 100%;
    animation: slideIn var(--duration-normal) ease;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .history-backdrop {
      transition: none;
    }

    .history-drawer-container {
      animation: none;
    }
  }
</style>
