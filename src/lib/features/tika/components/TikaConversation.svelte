<!--
  TIKA Conversation Panel

  Chat interface for interacting with the TIKA AI assistant.
  Shows conversation history with streaming support via AI SDK.
-->
<script lang="ts">
  import { tick } from "svelte";
  import type { UIMessage } from "ai";
  import CopyForAIButton from "$lib/shared/foundation/ui/CopyForAIButton.svelte";
  import CopyAsImageButton from "$lib/shared/foundation/ui/CopyAsImageButton.svelte";
  import InlinePictograph from "./InlinePictograph.svelte";
  import InlineGallery from "./InlineGallery.svelte";
  import InlineSequencePlayer from "./InlineSequencePlayer.svelte";
  import InlineStepGrid from "./InlineStepGrid.svelte";
  import InlineQuiz from "./InlineQuiz.svelte";
  import TikaModelSwitcher from "./TikaModelSwitcher.svelte";
  import TikaActionMenu from "./TikaActionMenu.svelte";
  import { tikaPictographCache } from "../services/implementations/TikaPictographCache";
  import type {
    InlinePictograph as InlinePictographType,
    InlineGallery as InlineGalleryType,
    InlineSequencePlayer as InlineSequencePlayerType,
    InlineStepGrid as InlineStepGridType,
    InlineQuiz as InlineQuizType,
    ModelOption
  } from "../types";
  import type { ReviewStatus, ReviewMetadata } from "../domain/models/tika-conversation-models";

  // Simple markdown to HTML converter for TIKA responses
  // Returns both HTML and extracted link references for footnote-style display
  type ParsedMarkdown = { html: string; links: Array<{ text: string; url: string }> };
  function parseMarkdown(md: string): ParsedMarkdown {
    if (!md) return { html: "", links: [] };

    // First, extract and process tables BEFORE any other transformation
    // Tables need their structure preserved
    const tableBlocks: string[] = [];
    let processed = md.replace(
      /\|[^\n]+\|\n\|[-:\s|]+\|\n(\|[^\n]+\|\n?)*/g,
      (tableMatch) => {
        const lines = tableMatch.trim().split('\n');
        if (lines.length < 2) return tableMatch;

        // Parse header row
        const headerCells = lines[0].split('|').slice(1, -1).map(c => c.trim());
        // Skip separator row (line[1])
        // Parse data rows
        const dataRows = lines.slice(2).map(row =>
          row.split('|').slice(1, -1).map(c => c.trim())
        );

        let tableHtml = '<table><thead><tr>';
        tableHtml += headerCells.map(h => `<th>${escapeHtml(h)}</th>`).join('');
        tableHtml += '</tr></thead><tbody>';
        for (const row of dataRows) {
          tableHtml += '<tr>' + row.map(c => `<td>${escapeHtml(c)}</td>`).join('') + '</tr>';
        }
        tableHtml += '</tbody></table>';

        const placeholder = `__TABLE_${tableBlocks.length}__`;
        tableBlocks.push(tableHtml);
        return placeholder;
      }
    );

    // Extract links and convert to footnote references
    // Links become superscript numbers, actual links go in footer index
    const linkIndex: Array<{ text: string; url: string }> = [];
    processed = processed.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_, text, url) => {
        // Check if this URL already exists in the index
        const existingIndex = linkIndex.findIndex(l => l.url === url);
        if (existingIndex >= 0) {
          // Reuse existing footnote number
          return `${text}__FOOTNOTE_${existingIndex + 1}__`;
        }
        // Add new link to index
        linkIndex.push({ text, url });
        return `${text}__FOOTNOTE_${linkIndex.length}__`;
      }
    );

    // Now escape HTML and process markdown
    processed = escapeHtml(processed)
      // Headers (## before # to prevent double-matching)
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^# (.+)$/gm, '<h2>$1</h2>')
      // Bold (must come before italic to handle ** before *)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic (single * only - underscore conflicts with __FOOTNOTE__ placeholders)
      .replace(/\*([^*]+?)\*/g, '<em>$1</em>')
      // Lists - wrap consecutive li items in ul
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      // Paragraphs
      .replace(/\n\n+/g, '</p><p>')
      .replace(/\n/g, '<br>');

    // Convert footnote placeholders to superscript numbers
    processed = processed.replace(/__FOOTNOTE_(\d+)__/g, (_, num) => {
      return `<sup class="footnote-ref">${num}</sup>`;
    });

    // Restore tables
    for (let i = 0; i < tableBlocks.length; i++) {
      processed = processed.replace(`__TABLE_${i}__`, tableBlocks[i]);
    }

    // Wrap consecutive <li> in <ul>
    processed = processed.replace(/(<li>.*?<\/li>(?:<br>)?)+/g, (match) => {
      const items = match.replace(/<br>/g, '');
      return '<ul>' + items + '</ul>';
    });

    // Wrap in paragraph if not already structured
    if (processed && !processed.startsWith('<')) {
      processed = '<p>' + processed + '</p>';
    }

    // Clean up empty paragraphs and stray br
    processed = processed
      .replace(/<p><\/p>/g, '')
      .replace(/<p><br>/g, '<p>')
      .replace(/<br><\/p>/g, '</p>')
      .replace(/<p>(\s*<(?:h[1-4]|ul|table))/g, '$1')
      .replace(/(<\/(?:h[1-4]|ul|table)>)\s*<\/p>/g, '$1');

    return { html: processed, links: linkIndex };
  }

  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // Get parsed content for a message (text or tool output) with link extraction
  function getMessageParsedContent(parts: UIMessage["parts"]): {
    textHtml: string | null;
    toolHtml: string | null;
    links: Array<{ text: string; url: string }>
  } {
    const textContent = getTextFromParts(parts);
    if (textContent) {
      const parsed = parseMarkdown(textContent);
      return { textHtml: parsed.html, toolHtml: null, links: parsed.links };
    }
    const toolOutput = getToolOutputFromParts(parts);
    if (toolOutput) {
      const parsed = parseMarkdown(toolOutput);
      return { textHtml: null, toolHtml: parsed.html, links: parsed.links };
    }
    return { textHtml: null, toolHtml: null, links: [] };
  }

  // Props - using AI SDK types
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
  } = $props();

  // Derived: review badge display
  const reviewBadge = $derived(() => {
    if (!reviewStatus || reviewStatus === "pending") return null;

    switch (reviewStatus) {
      case "approved":
        return {
          label: reviewMetadata?.grade ? `Reviewed: ${reviewMetadata.grade}` : "Approved",
          icon: "fa-check-circle",
          color: "green",
        };
      case "needs-correction":
        return {
          label: "Needs Correction",
          icon: "fa-exclamation-circle",
          color: "red",
        };
      case "claimed":
        return {
          label: "Being Reviewed",
          icon: "fa-spinner fa-spin",
          color: "blue",
        };
      case "in-review":
        return {
          label: "In Review",
          icon: "fa-eye",
          color: "purple",
        };
      case "archived":
        return {
          label: reviewMetadata?.grade ? `Archived: ${reviewMetadata.grade}` : "Archived",
          icon: "fa-archive",
          color: "gray",
        };
      default:
        return null;
    }
  });

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

  // Normalized tool info for display
  interface ToolInfo {
    name: string;
    args: Record<string, unknown>;
    isPending: boolean;
  }

  // Get tool invocations from message parts, normalizing both formats
  function getToolsFromParts(parts: UIMessage["parts"]): ToolInfo[] {
    if (!parts) return [];
    const tools: ToolInfo[] = [];

    for (const part of parts) {
      // Old format: tool-invocation
      if (part.type === "tool-invocation") {
        const inv = (part as { toolInvocation?: { toolName: string; args: Record<string, unknown>; state: string } }).toolInvocation;
        if (inv) {
          tools.push({
            name: inv.toolName,
            args: inv.args,
            isPending: inv.state !== "result"
          });
        }
      }
      // New format: type is "tool-{toolName}"
      else if (part.type.startsWith("tool-")) {
        const toolName = part.type.replace("tool-", "");
        const toolPart = part as { input?: Record<string, unknown>; state?: string };
        tools.push({
          name: toolName,
          args: toolPart.input || {},
          isPending: toolPart.state !== "output-available"
        });
      }
    }

    return tools;
  }

  // Get the first tool output from parts (for rendering when no text response)
  function getToolOutputFromParts(parts: UIMessage["parts"]): string | null {
    if (!parts) return null;
    for (const part of parts) {
      // Check for new AI SDK format: type is "tool-{toolName}"
      if (part.type.startsWith("tool-") && part.type !== "tool-invocation") {
        const toolPart = part as { output?: unknown; state?: string };
        if (toolPart.state === "output-available" && toolPart.output) {
          return extractExplanation(toolPart.output);
        }
      }
      // Check for old format
      if (part.type === "tool-invocation") {
        const inv = (part as { toolInvocation?: { state: string; result?: unknown } }).toolInvocation;
        if (inv?.state === "result" && inv.result) {
          return extractExplanation(inv.result);
        }
      }
    }
    return null;
  }

  // Extract explanation from tool output, handling various structures
  function extractExplanation(output: unknown): string {
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

  // Extract inline content (pictograph, gallery, sequence player, step grid, or quiz) from tool output
  interface InlineContent {
    pictograph?: InlinePictographType;
    gallery?: InlineGalleryType;
    galleries?: InlineGalleryType[]; // For multiple galleries (e.g., diamond + box mode)
    sequencePlayer?: InlineSequencePlayerType;
    stepGrid?: InlineStepGridType;
    quiz?: InlineQuizType;
  }

  function extractInlineContent(output: unknown): InlineContent {
    const content: InlineContent = {};
    if (!output || typeof output !== "object") return content;

    const obj = output as Record<string, unknown>;

    // Check for inline pictograph
    if (obj.inlinePictograph && typeof obj.inlinePictograph === "object") {
      const pic = obj.inlinePictograph as Record<string, unknown>;
      if (pic.type === "inline-pictograph" && typeof pic.letter === "string") {
        content.pictograph = pic as unknown as InlinePictographType;
      }
    }

    // Check for inline gallery (single)
    if (obj.inlineGallery && typeof obj.inlineGallery === "object") {
      const gal = obj.inlineGallery as Record<string, unknown>;
      if (gal.type === "inline-gallery" && Array.isArray(gal.items)) {
        content.gallery = gal as unknown as InlineGalleryType;
      }
    }

    // Check for inline galleries (multiple, e.g., diamond + box mode)
    if (obj.inlineGalleries && Array.isArray(obj.inlineGalleries)) {
      content.galleries = [];
      for (const gal of obj.inlineGalleries) {
        if (gal && typeof gal === "object") {
          const galObj = gal as Record<string, unknown>;
          if (galObj.type === "inline-gallery" && Array.isArray(galObj.items)) {
            content.galleries.push(galObj as unknown as InlineGalleryType);
          }
        }
      }
    }

    // Check for inline sequence player
    if (obj.inlineSequencePlayer && typeof obj.inlineSequencePlayer === "object") {
      const seq = obj.inlineSequencePlayer as Record<string, unknown>;
      if (seq.type === "inline-sequence-player" && typeof seq.word === "string") {
        content.sequencePlayer = seq as unknown as InlineSequencePlayerType;
      }
    }

    // Check for inline step grid
    if (obj.inlineStepGrid && typeof obj.inlineStepGrid === "object") {
      const grid = obj.inlineStepGrid as Record<string, unknown>;
      if (grid.type === "inline-step-grid" && Array.isArray(grid.steps)) {
        content.stepGrid = grid as unknown as InlineStepGridType;
      }
    }

    // Check for inline quiz
    if (obj.inlineQuiz && typeof obj.inlineQuiz === "object") {
      const quiz = obj.inlineQuiz as Record<string, unknown>;
      if (quiz.type === "inline-quiz" && typeof quiz.question === "string") {
        content.quiz = quiz as unknown as InlineQuizType;
      }
    }

    return content;
  }

  // Get all inline content from message parts
  function getInlineContentFromParts(parts: UIMessage["parts"]): InlineContent[] {
    if (!parts) return [];
    const allContent: InlineContent[] = [];

    for (const part of parts) {
      // Check for new AI SDK format: type is "tool-{toolName}"
      if (part.type.startsWith("tool-") && part.type !== "tool-invocation") {
        const toolPart = part as { output?: unknown; state?: string };
        if (toolPart.state === "output-available" && toolPart.output) {
          const content = extractInlineContent(toolPart.output);
          if (content.pictograph || content.gallery || content.galleries?.length || content.sequencePlayer || content.stepGrid || content.quiz) {
            allContent.push(content);
          }
        }
      }
      // Check for old format
      if (part.type === "tool-invocation") {
        const inv = (part as { toolInvocation?: { state: string; result?: unknown } }).toolInvocation;
        if (inv?.state === "result" && inv.result) {
          const content = extractInlineContent(inv.result);
          if (content.pictograph || content.gallery || content.galleries?.length || content.sequencePlayer || content.stepGrid || content.quiz) {
            allContent.push(content);
          }
        }
      }
    }

    return allContent;
  }

  // Check if a message is still streaming (last assistant message with streaming status)
  function isMessageStreaming(message: UIMessage, index: number): boolean {
    return (
      isStreaming &&
      message.role === "assistant" &&
      index === messages.length - 1
    );
  }

  // Clear pictograph cache and refresh - useful when renderer has been updated
  async function clearPictographCache(): Promise<void> {
    await tikaPictographCache.clear();
    // Force page refresh to reload images with new rendering
    window.location.reload();
  }
</script>

<div class="conversation-panel">
  <!-- Header -->
  <header class="panel-header">
    <div class="header-left">
      <div class="header-title">
        <div class="title-icon">
          <i class="fas fa-robot" aria-hidden="true"></i>
        </div>
        <div class="title-text">
          <span class="title-main">Tika</span>
          <span class="title-subtitle">TKA Intelligent Knowledge Assistant</span>
        </div>
      </div>
      <!-- Review Status Badge -->
      {#if reviewBadge()}
        {@const badge = reviewBadge()}
        <button
          class="review-badge review-badge-{badge.color}"
          title={reviewMetadata?.aiNotes || `Status: ${reviewStatus}`}
          aria-label={`Review status: ${badge.label}`}
        >
          <i class="fas {badge.icon}" aria-hidden="true"></i>
          <span>{badge.label}</span>
        </button>
      {/if}
    </div>
    <div class="header-actions">
      <!-- Primary Actions: Always visible -->
      {#if availableModels.length > 1 && onModelChange}
        <TikaModelSwitcher
          currentModel={selectedModel}
          {availableModels}
          {onModelChange}
        />
      {/if}
      {#if onNewChat}
        <button
          class="action-btn new-chat-btn"
          onclick={onNewChat}
          title="New conversation"
          aria-label="Start new conversation"
        >
          <i class="fas fa-plus" aria-hidden="true"></i>
        </button>
      {/if}
      {#if onOpenHistory}
        <button
          class="action-btn history-btn"
          onclick={onOpenHistory}
          title="Chat history"
          aria-label="Open chat history"
        >
          <i class="fas fa-history" aria-hidden="true"></i>
        </button>
      {/if}

      <!-- Flag for Review: Shows when there's a saved session -->
      {#if sessionId && onFlagForReview}
        <button
          class="action-btn flag-btn"
          class:flagged={isFlagged}
          onclick={() => onFlagForReview(!isFlagged)}
          title={isFlagged ? "Remove from review queue" : "Flag for review"}
          aria-label={isFlagged ? "Remove from review queue" : "Flag conversation for review"}
          aria-pressed={isFlagged}
        >
          <i class="fas fa-flag" aria-hidden="true"></i>
        </button>
      {/if}

      <!-- Copy as image - always visible when there are messages -->
      {#if messages.length > 0}
        <button
          class="action-btn copy-image-btn"
          onclick={async () => {
            if (!chatContainer) return;
            const domtoimage = await import("dom-to-image-more");
            const blob = await domtoimage.default.toBlob(chatContainer, {
              bgcolor: "#12121c",
              quality: 1.0,
            });
            await navigator.clipboard.write([
              new ClipboardItem({ "image/png": blob }),
            ]);
          }}
          title="Copy as image"
          aria-label="Copy conversation as image"
        >
          <i class="fas fa-camera" aria-hidden="true"></i>
        </button>
      {/if}

      <!-- Secondary Actions: In overflow menu -->
      <TikaActionMenu
        actions={[
          {
            id: "refresh",
            label: "Clear cache & refresh",
            icon: "fa-sync-alt",
            onClick: clearPictographCache,
          },
          ...(messages.length > 0
            ? [
                {
                  id: "tools",
                  label: showToolDetails ? "Hide tool details" : "Show tool details",
                  icon: "fa-wrench",
                  onClick: () => (showToolDetails = !showToolDetails),
                  active: showToolDetails,
                },
              ]
            : []),
          ...(messages.length > 0 && generateCopyForAI
            ? [
                {
                  id: "copy-ai",
                  label: "Copy for AI review",
                  icon: "fa-copy",
                  onClick: () => {
                    const data = generateCopyForAI();
                    navigator.clipboard.writeText(data);
                  },
                },
              ]
            : []),
          ...(onOpenReview
            ? [
                {
                  id: "review-panel",
                  label: "Review panel",
                  icon: "fa-clipboard-check",
                  onClick: onOpenReview,
                },
              ]
            : []),
        ]}
      />
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
        <h2>Welcome to Tika</h2>
        <p>
          I'm your AI tutor for The Kinetic Alphabet. Ask me anything about:
        </p>
        <ul class="suggestion-list">
          <li>
            <button onclick={() => onSubmit("What does alpha mean?")} disabled={isLoading}>
              <i class="fas fa-crosshairs" aria-hidden="true"></i> What is alpha?
            </button>
          </li>
          <li>
            <button onclick={() => onSubmit("What does beta mean?")} disabled={isLoading}>
              <i class="fas fa-crosshairs" aria-hidden="true"></i> What is beta?
            </button>
          </li>
          <li>
            <button onclick={() => onSubmit("What does gamma mean?")} disabled={isLoading}>
              <i class="fas fa-crosshairs" aria-hidden="true"></i> What is gamma?
            </button>
          </li>
          <li>
            <button onclick={() => onSubmit("What is letter A?")} disabled={isLoading}>
              <i class="fas fa-font" aria-hidden="true"></i> What is letter A?
            </button>
          </li>
          <li>
            <button onclick={() => onSubmit("What is shift?")} disabled={isLoading}>
              <i class="fas fa-arrows-alt" aria-hidden="true"></i> What is shift?
            </button>
          </li>
          <li>
            <button onclick={() => onSubmit("What are Type 1 letters?")} disabled={isLoading}>
              <i class="fas fa-layer-group" aria-hidden="true"></i> Type 1 letters
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
              <!-- Text content - parse once and store links for rendering at end -->
              {#if true}
                {@const parsed = getMessageParsedContent(message.parts)}
                {#if parsed.textHtml}
                  <div class="text-response markdown-content">
                    {@html parsed.textHtml}
                    {#if isMessageStreaming(message, index)}
                      <span class="streaming-cursor"></span>
                    {/if}
                  </div>
                {:else if parsed.toolHtml}
                  <!-- Tool output as response (when model doesn't generate text) -->
                  <div class="tool-response markdown-content">
                    {@html parsed.toolHtml}
                  </div>
                {:else if isMessageStreaming(message, index)}
                  <!-- Still waiting for text to stream -->
                  <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                {/if}

                <!-- Inline Pictographs/Galleries/Sequence Players from tool outputs -->
                {#if getInlineContentFromParts(message.parts).length > 0}
                  {@const inlineContent = getInlineContentFromParts(message.parts)}
                  <div class="inline-content-container">
                    {#each inlineContent as content}
                      {#if content.pictograph}
                        <InlinePictograph pictograph={content.pictograph} />
                      {/if}
                      {#if content.gallery}
                        <InlineGallery gallery={content.gallery} />
                      {/if}
                      {#if content.galleries?.length}
                        {#each content.galleries as gal}
                          <InlineGallery gallery={gal} />
                        {/each}
                      {/if}
                      {#if content.sequencePlayer}
                        <InlineSequencePlayer sequence={content.sequencePlayer} />
                      {/if}
                      {#if content.stepGrid}
                        <InlineStepGrid stepGrid={content.stepGrid} />
                      {/if}
                      {#if content.quiz}
                        <InlineQuiz quiz={content.quiz} />
                      {/if}
                    {/each}
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
                      {#each tools as tool}
                        <div class="tool-item" class:pending={tool.isPending}>
                          <span class="tool-name">
                            {formatToolName(tool.name)}
                            {#if tool.isPending}
                              <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
                            {/if}
                          </span>
                          <span class="tool-input">
                            {JSON.stringify(tool.args)}
                          </span>
                        </div>
                      {/each}
                    </div>
                  {/if}
                {/if}

                <!-- Link index at very bottom of message (after all content) -->
                {#if parsed.links.length > 0}
                  <div class="link-index">
                    <span class="link-index-label">References</span>
                    {#each parsed.links as link, i}
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="link-chip"
                      >
                        <span class="link-number">{i + 1}</span>
                        <span class="link-text">{link.text}</span>
                        <i class="fas fa-external-link-alt" aria-hidden="true"></i>
                      </a>
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
        placeholder="Ask Tika about TKA..."
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
    padding: 12px 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: rgba(15, 20, 30, 0.95);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  /* Review Status Badge */
  .review-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 16px;
    font-size: 12px;
    font-weight: 600;
    border: 1px solid;
    cursor: help;
    transition: all var(--duration-normal, 0.3s) ease;
  }

  .review-badge i {
    font-size: 12px;
  }

  .review-badge-green {
    background: rgba(34, 197, 94, 0.15);
    border-color: rgba(34, 197, 94, 0.4);
    color: #22c55e;
  }

  .review-badge-green:hover {
    background: rgba(34, 197, 94, 0.25);
  }

  .review-badge-red {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.4);
    color: #ef4444;
  }

  .review-badge-red:hover {
    background: rgba(239, 68, 68, 0.25);
  }

  .review-badge-blue {
    background: rgba(59, 130, 246, 0.15);
    border-color: rgba(59, 130, 246, 0.4);
    color: #3b82f6;
  }

  .review-badge-blue:hover {
    background: rgba(59, 130, 246, 0.25);
  }

  .review-badge-purple {
    background: rgba(168, 85, 247, 0.15);
    border-color: rgba(168, 85, 247, 0.4);
    color: #a855f7;
  }

  .review-badge-purple:hover {
    background: rgba(168, 85, 247, 0.25);
  }

  .review-badge-gray {
    background: rgba(156, 163, 175, 0.15);
    border-color: rgba(156, 163, 175, 0.4);
    color: #9ca3af;
  }

  .review-badge-gray:hover {
    background: rgba(156, 163, 175, 0.25);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .title-icon {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: linear-gradient(135deg, #818cf8 0%, #6366f1 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
  }

  .title-icon i {
    font-size: 18px;
    color: white;
  }

  .title-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .title-main {
    font-size: 18px;
    font-weight: 700;
    color: var(--theme-text, #ffffff);
    letter-spacing: -0.01em;
  }

  .title-subtitle {
    font-size: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* Action buttons - circular with proper touch targets */
  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target, 48px);
    height: var(--min-touch-target, 48px);
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 50%;
    color: #ffffff;
    font-size: 16px;
    cursor: pointer;
    transition: all var(--duration-normal, 0.3s) ease;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .action-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .action-btn:active {
    transform: scale(0.95);
    transition: transform 0.1s ease;
  }

  .action-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* New chat button - green gradient for "create new" action */
  .new-chat-btn {
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.9), rgba(22, 163, 74, 0.9));
    border-color: rgba(34, 197, 94, 0.3);
    box-shadow: 0 2px 8px rgba(34, 197, 94, 0.25);
  }

  .new-chat-btn:hover {
    background: linear-gradient(135deg, rgba(34, 197, 94, 1), rgba(22, 163, 74, 1));
    box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4);
  }

  /* History button - indigo gradient for navigation */
  .history-btn {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(79, 70, 229, 0.9));
    border-color: rgba(99, 102, 241, 0.3);
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
  }

  .history-btn:hover {
    background: linear-gradient(135deg, rgba(99, 102, 241, 1), rgba(79, 70, 229, 1));
    box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
  }

  /* Tools button - neutral gray, accent when active */
  .tools-btn {
    background: linear-gradient(135deg, rgba(100, 100, 120, 0.85), rgba(70, 70, 90, 0.85));
    border-color: rgba(255, 255, 255, 0.1);
  }

  .tools-btn:hover {
    background: linear-gradient(135deg, rgba(120, 120, 140, 0.95), rgba(90, 90, 110, 0.95));
  }

  .tools-btn.active {
    background: linear-gradient(135deg, rgba(251, 146, 60, 0.9), rgba(234, 88, 12, 0.9));
    border-color: rgba(251, 146, 60, 0.3);
    box-shadow: 0 2px 8px rgba(251, 146, 60, 0.25);
  }

  .tools-btn.active:hover {
    background: linear-gradient(135deg, rgba(251, 146, 60, 1), rgba(234, 88, 12, 1));
    box-shadow: 0 4px 14px rgba(251, 146, 60, 0.4);
  }

  /* Review button - cyan/teal for QA/review action */
  .review-btn {
    background: linear-gradient(135deg, rgba(20, 184, 166, 0.9), rgba(13, 148, 136, 0.9));
    border-color: rgba(20, 184, 166, 0.3);
    box-shadow: 0 2px 8px rgba(20, 184, 166, 0.25);
  }

  .review-btn:hover {
    background: linear-gradient(135deg, rgba(20, 184, 166, 1), rgba(13, 148, 136, 1));
    box-shadow: 0 4px 14px rgba(20, 184, 166, 0.4);
  }

  /* Flag button - amber/yellow when not flagged, red when flagged */
  .flag-btn {
    background: linear-gradient(135deg, rgba(100, 100, 120, 0.85), rgba(70, 70, 90, 0.85));
    border-color: rgba(255, 255, 255, 0.1);
  }

  .flag-btn:hover {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.9), rgba(217, 119, 6, 0.9));
    border-color: rgba(245, 158, 11, 0.3);
    box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);
  }

  .flag-btn.flagged {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.95), rgba(217, 119, 6, 0.95));
    border-color: rgba(245, 158, 11, 0.4);
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.35);
  }

  .flag-btn.flagged:hover {
    background: linear-gradient(135deg, rgba(245, 158, 11, 1), rgba(217, 119, 6, 1));
    box-shadow: 0 4px 14px rgba(245, 158, 11, 0.5);
  }

  /* Copy as image button - purple/violet for media actions */
  .copy-image-btn {
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.9), rgba(139, 92, 246, 0.9));
    border-color: rgba(168, 85, 247, 0.3);
    box-shadow: 0 2px 8px rgba(168, 85, 247, 0.25);
  }

  .copy-image-btn:hover {
    background: linear-gradient(135deg, rgba(168, 85, 247, 1), rgba(139, 92, 246, 1));
    box-shadow: 0 4px 14px rgba(168, 85, 247, 0.4);
  }

  /* Responsive: hide subtitle on very narrow screens */
  @media (max-width: 480px) {
    .title-subtitle {
      display: none;
    }
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

  /* Inline content container for pictographs/galleries */
  .inline-content-container {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .text-response {
    display: inline;
  }

  /* Markdown content styling */
  .markdown-content {
    font-size: 14px;
    line-height: 1.6;
    color: var(--theme-text, #ffffff);
  }

  .markdown-content :global(h1),
  .markdown-content :global(h2) {
    font-size: 16px;
    font-weight: 600;
    margin: 12px 0 8px 0;
    color: var(--theme-accent, #6366f1);
  }

  .markdown-content :global(h1:first-child),
  .markdown-content :global(h2:first-child) {
    margin-top: 0;
  }

  .markdown-content :global(h3),
  .markdown-content :global(h4) {
    font-size: 14px;
    font-weight: 600;
    margin: 10px 0 6px 0;
    color: var(--theme-text, #ffffff);
  }

  .markdown-content :global(p) {
    margin: 0 0 8px 0;
  }

  .markdown-content :global(p:last-child) {
    margin-bottom: 0;
  }

  .markdown-content :global(strong) {
    color: var(--theme-text, #ffffff);
    font-weight: 600;
  }

  .markdown-content :global(ul),
  .markdown-content :global(ol) {
    margin: 4px 0 8px 0;
    padding-left: 20px;
  }

  .markdown-content :global(li) {
    margin: 2px 0;
  }

  /* Table styling */
  .markdown-content :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0;
    font-size: 13px;
  }

  .markdown-content :global(th),
  .markdown-content :global(td) {
    padding: 6px 10px;
    text-align: left;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
  }

  .markdown-content :global(th) {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    font-weight: 600;
    color: var(--theme-accent, #6366f1);
  }

  .markdown-content :global(tr:nth-child(even)) {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.02));
  }

  .markdown-content :global(code) {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    padding: 1px 4px;
    border-radius: 3px;
    font-family: monospace;
    font-size: 13px;
  }

  /* Footnote references (superscript numbers in text) */
  .markdown-content :global(.footnote-ref) {
    font-size: 0.7em;
    color: var(--theme-accent, #6366f1);
    font-weight: 600;
    vertical-align: super;
    margin-left: 1px;
    cursor: default;
  }

  /* Link index container (pill chips at bottom of message) */
  .link-index {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
  }

  .link-index-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  .link-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    /* 48px minimum touch target */
    min-height: 48px;
    padding: 10px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1.5px solid var(--theme-accent, #6366f1);
    border-radius: 24px;
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
    text-decoration: none;
    font-size: var(--font-size-min, 14px);
    transition: all 0.15s ease;
  }

  .link-chip:hover {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
    color: white;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
  }

  .link-chip .link-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    background: var(--theme-accent, #6366f1);
    color: white;
    border-radius: 50%;
    font-size: 12px;
    font-weight: 700;
  }

  .link-chip:hover .link-number {
    background: white;
    color: var(--theme-accent, #6366f1);
  }

  .link-chip .link-text {
    font-weight: 500;
  }

  .link-chip i {
    font-size: 12px;
    opacity: 0.7;
    transition: opacity 0.15s ease;
  }

  .link-chip:hover i {
    opacity: 1;
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
    .action-btn,
    .suggestion-list button,
    .send-button,
    .stop-button,
    .input-wrapper,
    .streaming-cursor {
      transition: none;
      animation: none;
    }

    .action-btn:hover,
    .action-btn:active,
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
