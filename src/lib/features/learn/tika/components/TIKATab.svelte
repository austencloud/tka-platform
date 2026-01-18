<!--
  TIKA Tab - AI-Powered TKA Learning Assistant

  Two modes:
  - Conversation: Split-pane layout for learning with TIKA
  - Review: Human review of flagged evaluation results

  Uses AI SDK for streaming chat with tool-use architecture.
-->
<script lang="ts">
  import { Chat, type UIMessage } from "@ai-sdk/svelte";
  import { DefaultChatTransport } from "ai";
  import { browser } from "$app/environment";
  import TIKAConversation from "./TIKAConversation.svelte";
  import TIKAContextPanel from "./TIKAContextPanel.svelte";
  import TIKAQuickReference from "./TIKAQuickReference.svelte";
  import TIKAReviewPanel from "./TIKAReviewPanel.svelte";
  import TIKAHistoryDrawer from "./TIKAHistoryDrawer.svelte";
  import { getEffectiveUserId, authState } from "$lib/shared/auth/state/authState.svelte";
  import { ConceptProgressTracker } from "$lib/features/learn/services/implementations/ConceptProgressTracker";
  import { TIKASessionRepository } from "$lib/features/learn/tika/services/implementations/TIKASessionRepository";
  import { tikaPictographCache } from "$lib/features/learn/tika/services/implementations/TikaPictographCache";
  import { TIKA_LIMITS } from "$lib/features/learn/tika/data/firestore-paths";
  import type { ContextData } from "../types";

  // Persistence key for sessionStorage
  const STORAGE_KEY = "tika-conversation";

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

  // Context panel state
  let currentContext = $state<ContextData | null>(null);
  let pictographBase64 = $state<string | null>(null);
  let pictographGallery = $state<Map<string, string>>(new Map()); // letter -> base64

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
          }),
        }),
        messages: loadPersistedMessages(),
        onError: (error: Error) => {
          console.error("[TIKA] Chat error:", error);
        },
      })
    : null;

  // Persist messages to sessionStorage when they change
  $effect(() => {
    const currentMessages = chat?.messages ?? [];
    if (browser && currentMessages.length > 0) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(currentMessages));
      } catch (e) {
        console.warn("[TIKA] Failed to persist messages:", e);
      }
    }
  });

  // Auto-save to Firebase (debounced) when messages change
  $effect(() => {
    const currentMessages = chat?.messages ?? [];

    // Skip if not authenticated or no repository
    if (!isAuthenticated || !sessionRepository) return;

    // Skip if below minimum message threshold
    if (currentMessages.length < TIKA_LIMITS.MIN_MESSAGES_FOR_SAVE) return;

    // Clear existing timeout
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }

    // Debounce the save
    autoSaveTimeout = setTimeout(async () => {
      try {
        const session = await sessionRepository.saveSession(
          currentSessionId ?? undefined,
          currentMessages
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

  // Derived - has context to show?
  let hasContext = $derived(currentContext !== null);

  // Handle suggestion click from Quick Reference - submit directly
  function handleSuggestionClick(question: string) {
    if (chat?.status === "ready") {
      chat.sendMessage({ text: question });
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

  // Generate cache key for pictograph
  function getCacheKey(letter: string, variation: number, size: number): string {
    return `${letter}-${variation}-${size}`;
  }

  // Fetch single pictograph image (with cache)
  async function fetchPictograph(letter: string, variation: number = 0) {
    const cacheKey = getCacheKey(letter, variation, 300);

    // Check cache first
    const cached = await tikaPictographCache.get(cacheKey);
    if (cached) {
      pictographBase64 = cached;
      return;
    }

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
        const base64 = data.imageBase64 as string;
        pictographBase64 = base64;

        // Cache for future use
        await tikaPictographCache.set(cacheKey, base64);
      }
    } catch (error) {
      console.error("[TIKA] Pictograph fetch error:", error);
    }
  }

  // Fetch multiple pictographs for a gallery (with cache and batching)
  async function fetchPictographGallery(letters: string[]) {
    const BATCH_SIZE = 4; // Fetch 4 at a time to avoid overwhelming the server
    const GALLERY_SIZE = 200;

    const newGallery = new Map<string, string>();
    const lettersToFetch: string[] = [];

    // Step 1: Check cache for all letters
    for (const letter of letters) {
      const cacheKey = getCacheKey(letter, 0, GALLERY_SIZE);
      const cached = await tikaPictographCache.get(cacheKey);
      if (cached) {
        newGallery.set(letter, cached);
      } else {
        lettersToFetch.push(letter);
      }
    }

    // Show cached results immediately
    pictographGallery = new Map(newGallery);

    // Step 2: Fetch missing letters in batches
    if (lettersToFetch.length > 0) {
      console.log(
        `[TIKA] Cache hit: ${newGallery.size}/${letters.length}, fetching ${lettersToFetch.length} pictographs`
      );

      for (let i = 0; i < lettersToFetch.length; i += BATCH_SIZE) {
        const batch = lettersToFetch.slice(i, i + BATCH_SIZE);

        const batchPromises = batch.map(async (letter) => {
          try {
            const response = await fetch("/api/tika/pictograph", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                letter,
                variation: 0,
                options: {
                  darkMode: true,
                  size: GALLERY_SIZE,
                  showTKA: true,
                  showGrid: true,
                },
              }),
            });

            if (response.ok) {
              const data = await response.json();
              const base64 = data.imageBase64 as string;

              // Cache for future use
              const cacheKey = getCacheKey(letter, 0, GALLERY_SIZE);
              await tikaPictographCache.set(cacheKey, base64);

              return { letter, base64 };
            }
          } catch (error) {
            console.error(`[TIKA] Pictograph fetch error for ${letter}:`, error);
          }
          return null;
        });

        // Wait for this batch to complete before starting the next
        const batchResults = await Promise.all(batchPromises);

        // Update gallery with new results
        batchResults.forEach((r) => {
          if (r) newGallery.set(r.letter, r.base64);
        });

        // Update UI after each batch
        pictographGallery = new Map(newGallery);
      }
    }
  }

  // Close context panel
  function handleCloseContext() {
    currentContext = null;
    pictographBase64 = null;
  }

  // Start a new conversation
  async function handleNewChat() {
    const currentMessages = chat?.messages ?? [];
    // Save current session if it has messages
    if (isAuthenticated && sessionRepository && currentMessages.length >= TIKA_LIMITS.MIN_MESSAGES_FOR_SAVE) {
      try {
        await sessionRepository.saveSession(
          currentSessionId ?? undefined,
          currentMessages
        );
      } catch (error) {
        console.error("[TIKA] Failed to save session before new chat:", error);
      }
    }

    // Clear current conversation
    if (chat) chat.messages = [];
    currentSessionId = null;
    currentContext = null;
    pictographBase64 = null;
    pictographGallery = new Map();

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
        currentContext = null;
        pictographBase64 = null;
        pictographGallery = new Map();

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

  // Generate conversation data for AI review (returns string for CopyForAIButton)
  function generateCopyForAI(): string {
    const currentMessages = chat?.messages ?? [];
    if (currentMessages.length === 0) return "";

    // Format conversation for AI review
    const lines: string[] = [
      "# TIKA Conversation for Review",
      "",
      `**Date:** ${new Date().toLocaleString()}`,
      `**Messages:** ${currentMessages.length}`,
      "",
      "---",
      "",
    ];

    for (const message of currentMessages) {
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

          // Extract tool calls
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
                  };
                }
              ).toolInvocation;
              lines.push(`- **${inv.toolName}**: \`${JSON.stringify(inv.args)}\``);
            }
            lines.push("");
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

    // Add context panel data if present
    if (currentContext) {
      lines.push("## Context Panel Data");
      lines.push("");

      if (currentContext.type === "letter" && currentContext.letter) {
        const l = currentContext.letter;
        lines.push(`**Letter:** ${l.letter}`);
        lines.push(`**Type:** ${l.type} (${l.typeName})`);
        lines.push(`**Position:** ${l.startPosition} → ${l.endPosition}`);
        lines.push("");
        lines.push("**Blue Motion:**");
        lines.push(`- Type: ${l.blueMotion.motionType}`);
        lines.push(`- Path: ${l.blueMotion.startLocation} → ${l.blueMotion.endLocation}`);
        if (l.blueMotion.rotationDirection !== "noRotation") {
          lines.push(`- Rotation: ${l.blueMotion.rotationDirection}`);
        }
        lines.push("");
        lines.push("**Red Motion:**");
        lines.push(`- Type: ${l.redMotion.motionType}`);
        lines.push(`- Path: ${l.redMotion.startLocation} → ${l.redMotion.endLocation}`);
        if (l.redMotion.rotationDirection !== "noRotation") {
          lines.push(`- Rotation: ${l.redMotion.rotationDirection}`);
        }
      } else if (currentContext.type === "term" && currentContext.term) {
        const t = currentContext.term;
        lines.push(`**Term:** ${t.term}`);
        lines.push(`**Definition:** ${t.definition}`);
        if (t.examples.length > 0) {
          lines.push(`**Examples:** ${t.examples.join(", ")}`);
        }
        if (t.relatedTerms.length > 0) {
          lines.push(`**Related Terms:** ${t.relatedTerms.join(", ")}`);
        }
      } else if (currentContext.type === "typeList" && currentContext.typeList) {
        const tl = currentContext.typeList;
        lines.push(`**Type ${tl.typeNumber}:** ${tl.typeName}`);
        lines.push(`**Description:** ${tl.description}`);
        lines.push(`**Motion Pattern:** Blue=${tl.motionPattern.blueMotion}, Red=${tl.motionPattern.redMotion}`);
        lines.push(`**Example Letters:** ${tl.exampleLetters.join(", ")}`);
        lines.push(`**All Letters:** ${tl.allLetters.join(", ")}`);
      } else if (currentContext.type === "comparison" && currentContext.comparison) {
        const c = currentContext.comparison;
        lines.push(`**Comparing:** ${c.letter1} (${c.type1}) vs ${c.letter2} (${c.type2})`);
      } else if (currentContext.type === "position" && currentContext.position) {
        const p = currentContext.position;
        lines.push(`**Position:** ${p.name}`);
        lines.push(`**Angle:** ${p.angleDegrees}`);
        lines.push(`**Description:** ${p.description}`);
      }

      // Note about visual context
      if (pictographBase64 || pictographGallery.size > 0) {
        lines.push("");
        lines.push("*(Pictographs visible in context panel - screenshot if needed)*");
      }

      lines.push("");
      lines.push("---");
      lines.push("");
    }

    return lines.join("\n");
  }

  // Watch for tool results that might update context
  // The AI SDK handles tool calls internally, but we can observe messages for context
  $effect(() => {
    const currentMessages = chat?.messages ?? [];
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
            const result = invocation.result as Record<string, unknown> | undefined;

            if (toolName === "get_letter_explanation" && result) {
              // Result is now { explanation, contextData } or a string (error case)
              const contextData = (result as { contextData?: Record<string, unknown> })?.contextData;
              const letter = invocation.args?.letter as string | undefined;

              if (contextData && letter) {
                // Use structured data from tool result
                const blue = contextData.blueMotion as Record<string, string> | undefined;
                const red = contextData.redMotion as Record<string, string> | undefined;

                currentContext = {
                  type: "letter",
                  letter: {
                    letter: letter,
                    type: (contextData.letterType as number) || 1,
                    typeName: (contextData.typeName as string) || "Unknown",
                    startPosition: (contextData.startPosition as string) || "",
                    endPosition: (contextData.endPosition as string) || "",
                    blueMotion: {
                      motionType: blue?.motionType || "",
                      startLocation: blue?.startLoc || "",
                      endLocation: blue?.endLoc || "",
                      rotationDirection: blue?.propRotDir || "noRotation",
                    },
                    redMotion: {
                      motionType: red?.motionType || "",
                      startLocation: red?.startLoc || "",
                      endLocation: red?.endLoc || "",
                      rotationDirection: red?.propRotDir || "noRotation",
                    },
                  },
                };
                fetchPictograph(letter, 0);
              }
            } else if (toolName === "get_term_definition" && result) {
              const term = invocation.args?.term as string | undefined;
              if (term) {
                currentContext = {
                  type: "term",
                  term: {
                    term: term,
                    definition: (result.definition as string) || "",
                    examples: (result.examples as string[]) || [],
                    relatedTerms: (result.relatedTerms as string[]) || [],
                  },
                };
              }
            } else if (toolName === "compare_letters" && result) {
              const letter1 = invocation.args?.letter1 as string | undefined;
              const letter2 = invocation.args?.letter2 as string | undefined;
              if (letter1 && letter2) {
                currentContext = {
                  type: "comparison",
                  comparison: {
                    letter1,
                    letter2,
                    type1: (result.letter1Type as string) || "",
                    type2: (result.letter2Type as string) || "",
                  },
                };
                fetchPictograph(letter1, 0);
              }
            } else if (toolName === "get_position_info" && result) {
              const position = invocation.args?.position as string | undefined;
              if (position) {
                currentContext = {
                  type: "position",
                  position: {
                    name: position,
                    angleDegrees: (result.angleDegrees as string) || "",
                    description: (result.description as string) || "",
                  },
                };
              }
            } else if (toolName === "list_letters_by_type" && result) {
              // Result is { explanation, contextData } for type list
              const contextData = (result as { contextData?: Record<string, unknown> })?.contextData;

              if (contextData && contextData.type === "typeList") {
                const exampleLetters = (contextData.exampleLetters as string[]) || [];
                const motionPattern = contextData.motionPattern as { blueMotion: string; redMotion: string } | undefined;

                currentContext = {
                  type: "typeList",
                  typeList: {
                    typeNumber: (contextData.typeNumber as number) || 1,
                    typeName: (contextData.typeName as string) || "",
                    description: (contextData.description as string) || "",
                    exampleLetters,
                    allLetters: (contextData.allLetters as string[]) || [],
                    motionPattern: {
                      blueMotion: motionPattern?.blueMotion || "",
                      redMotion: motionPattern?.redMotion || "",
                    },
                  },
                };

                // Fetch pictographs for example letters
                if (exampleLetters.length > 0) {
                  fetchPictographGallery(exampleLetters);
                }
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
          messages={chat?.messages ?? []}
          status={chat?.status ?? "ready"}
          onSubmit={handleSubmit}
          onStop={handleStop}
          onNewChat={isAuthenticated ? handleNewChat : undefined}
          onOpenHistory={isAuthenticated ? handleOpenHistory : undefined}
          {generateCopyForAI}
        />
      </div>

      <!-- Context Panel (Right) - always visible -->
      <div class="context-panel">
        {#if hasContext}
          <TIKAContextPanel
            context={currentContext}
            {pictographBase64}
            {pictographGallery}
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
  .tika-tab {
    position: relative;
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
    .panel-container,
    .conversation-panel,
    .context-panel,
    .mode-btn {
      transition: none;
    }

    .history-drawer-container {
      animation: none;
    }
  }
</style>
