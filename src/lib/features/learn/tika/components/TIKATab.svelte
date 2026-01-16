<!--
  TIKA Tab - AI-Powered TKA Learning Assistant

  Split-pane layout:
  - Left: Conversation panel with chat history
  - Right: Context panel showing relevant pictographs and data

  Uses tool-use architecture where Haiku calls educational tools
  to retrieve authoritative information before responding.
-->
<script lang="ts">
  import TIKAConversation from "./TIKAConversation.svelte";
  import TIKAContextPanel from "./TIKAContextPanel.svelte";
  import TIKAQuickReference from "./TIKAQuickReference.svelte";
  import { getEffectiveUserId } from "$lib/shared/auth/state/authState.svelte";

  // Types matching API response
  interface ToolCall {
    name: string;
    input: Record<string, unknown>;
    result: unknown;
  }

  interface ContextData {
    type: "letter" | "term" | "comparison" | "list" | "position" | null;
    letter?: {
      letter: string;
      type: number;
      typeName: string;
      startPosition: string;
      endPosition: string;
      blueMotion: {
        motionType: string;
        startLocation: string;
        endLocation: string;
        rotationDirection: string;
      };
      redMotion: {
        motionType: string;
        startLocation: string;
        endLocation: string;
        rotationDirection: string;
      };
    };
    term?: {
      term: string;
      definition: string;
      examples: string[];
      relatedTerms: string[];
    };
    comparison?: {
      letter1: string;
      letter2: string;
      type1: string;
      type2: string;
    };
    position?: {
      name: string;
      angleDegrees: string;
      description: string;
    };
  }

  interface ConversationItem {
    question: string;
    response: {
      explanation: string;
      showPictograph: boolean;
      pictographLetter?: string;
      pictographVariation?: number;
      latencyMs: number;
      toolsCalled: ToolCall[];
      contextData?: ContextData;
    };
    timestamp: Date;
  }

  // State
  let conversationHistory = $state<ConversationItem[]>([]);
  let currentContext = $state<ContextData | null>(null);
  let isLoading = $state(false);
  let pictographBase64 = $state<string | null>(null);

  // User identity
  const userId = $derived(getEffectiveUserId() || "anonymous");

  // Derived - has context to show?
  let hasContext = $derived(currentContext !== null);

  // Handle suggestion click from Quick Reference - submit directly
  function handleSuggestionClick(question: string) {
    if (!isLoading) {
      handleSubmit(question);
    }
  }

  // Handle new message submission
  async function handleSubmit(question: string) {
    isLoading = true;

    try {
      // Call the TIKA API
      const response = await fetch("/api/tika/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          userId,
          completedConcepts: [],
          language: "en",
        }),
      });

      const data = await response.json();

      // Add to conversation history
      conversationHistory = [
        ...conversationHistory,
        {
          question,
          response: {
            explanation: data.explanation,
            showPictograph: data.showPictograph,
            pictographLetter: data.pictographLetter,
            pictographVariation: data.pictographVariation || 0,
            latencyMs: data.latencyMs,
            toolsCalled: data.toolsCalled || [],
            contextData: data.contextData,
          },
          timestamp: new Date(),
        },
      ];

      // Update context panel
      if (data.contextData) {
        currentContext = data.contextData;

        // Fetch pictograph if we have a letter context
        if (
          data.showPictograph &&
          data.pictographLetter &&
          (data.contextData.type === "letter" ||
            data.contextData.type === "comparison")
        ) {
          await fetchPictograph(
            data.pictographLetter,
            data.pictographVariation || 0
          );
        }
      }
    } catch (error) {
      console.error("[TIKA] API error:", error);
      // Add error to conversation
      conversationHistory = [
        ...conversationHistory,
        {
          question,
          response: {
            explanation:
              "Sorry, I had trouble processing that question. Please try again.",
            showPictograph: false,
            latencyMs: 0,
            toolsCalled: [],
          },
          timestamp: new Date(),
        },
      ];
    } finally {
      isLoading = false;
    }
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
</script>

<div class="tika-tab">
  <div class="panel-container" class:has-context={hasContext}>
    <!-- Conversation Panel (Left) -->
    <div class="conversation-panel">
      <TIKAConversation
        {conversationHistory}
        {isLoading}
        onSubmit={handleSubmit}
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
    transition: all 0.3s ease;
  }

  /* Default: 60% conversation, 40% reference */
  .conversation-panel {
    flex: 0.6;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: flex 0.3s ease;
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
</style>
