<!--
  TIKA Tab - AI-Powered TKA Learning Assistant

  Two modes:
  - Conversation: Split-pane layout for learning with TIKA
  - Review: Human review of flagged evaluation results

  Uses AI SDK for streaming chat with tool-use architecture.
-->
<script lang="ts">
  import { useChat, type Message } from "@ai-sdk/svelte";
  import { browser } from "$app/environment";
  import TIKAConversation from "./TIKAConversation.svelte";
  import TIKAContextPanel from "./TIKAContextPanel.svelte";
  import TIKAQuickReference from "./TIKAQuickReference.svelte";
  import TIKAReviewPanel from "./TIKAReviewPanel.svelte";
  import { getEffectiveUserId } from "$lib/shared/auth/state/authState.svelte";
  import type { ContextData } from "../types";

  // Persistence key for sessionStorage
  const STORAGE_KEY = "tika-conversation";

  // Load persisted messages from sessionStorage
  function loadPersistedMessages(): Message[] {
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

  // Context panel state
  let currentContext = $state<ContextData | null>(null);
  let pictographBase64 = $state<string | null>(null);
  let pictographGallery = $state<Map<string, string>>(new Map()); // letter -> base64

  // User identity
  const userId = $derived(getEffectiveUserId() || "anonymous");

  // Initialize useChat hook from AI SDK with persistence
  const {
    messages,
    status,
    append,
    stop,
    input,
    setMessages,
  } = useChat({
    id: "tika-main",
    api: "/api/tika/ask",
    body: {
      userId,
      completedConcepts: [],
      language: "en",
    },
    initialMessages: loadPersistedMessages(),
    onError: (error: Error) => {
      console.error("[TIKA] Chat error:", error);
    },
  });

  // Persist messages to sessionStorage when they change
  $effect(() => {
    const currentMessages = $messages;
    if (browser && currentMessages.length > 0) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(currentMessages));
      } catch (e) {
        console.warn("[TIKA] Failed to persist messages:", e);
      }
    }
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

  // Fetch single pictograph image
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

  // Fetch multiple pictographs for a gallery
  async function fetchPictographGallery(letters: string[]) {
    pictographGallery = new Map();

    const fetchPromises = letters.map(async (letter) => {
      try {
        const response = await fetch("/api/tika/pictograph", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            letter,
            variation: 0,
            options: {
              darkMode: true,
              size: 200,
              showTKA: true,
              showGrid: false,
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return { letter, base64: data.imageBase64 as string };
        }
      } catch (error) {
        console.error(`[TIKA] Pictograph fetch error for ${letter}:`, error);
      }
      return null;
    });

    const results = await Promise.all(fetchPromises);
    const newGallery = new Map<string, string>();
    results.forEach((r) => {
      if (r) newGallery.set(r.letter, r.base64);
    });
    pictographGallery = newGallery;
  }

  // Close context panel
  function handleCloseContext() {
    currentContext = null;
    pictographBase64 = null;
  }

  // Copy conversation for AI review
  function handleCopyForAI() {
    const currentMessages = $messages;
    if (currentMessages.length === 0) return;

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
        lines.push(message.content);
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
        } else if (message.content) {
          lines.push(message.content);
          lines.push("");
        }
      }
      lines.push("---");
      lines.push("");
    }

    // Copy to clipboard
    const text = lines.join("\n");
    navigator.clipboard.writeText(text).catch((err) => {
      console.error("[TIKA] Failed to copy:", err);
    });
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
          messages={$messages}
          status={$status}
          onSubmit={handleSubmit}
          onStop={handleStop}
          onCopyForAI={handleCopyForAI}
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
