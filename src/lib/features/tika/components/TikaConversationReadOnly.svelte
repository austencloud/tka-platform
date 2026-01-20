<!--
  TIKA Conversation Read-Only View

  Renders a Tika conversation with full fidelity (markdown, inline pictographs,
  galleries, etc.) but without input controls. Used in review panel.
-->
<script lang="ts">
  import type { UIMessage } from "ai";
  import InlinePictograph from "./InlinePictograph.svelte";
  import InlineGallery from "./InlineGallery.svelte";
  import InlineSequencePlayer from "./InlineSequencePlayer.svelte";
  import InlineStepGrid from "./InlineStepGrid.svelte";
  import InlineQuiz from "./InlineQuiz.svelte";
  import type {
    InlinePictograph as InlinePictographType,
    InlineGallery as InlineGalleryType,
    InlineSequencePlayer as InlineSequencePlayerType,
    InlineStepGrid as InlineStepGridType,
    InlineQuiz as InlineQuizType,
  } from "../types";

  // Props
  let {
    messages = [],
  }: {
    messages: UIMessage[];
  } = $props();

  // Element reference for image capture
  let containerEl: HTMLElement | null = $state(null);

  // Export element for parent to capture
  export function getContainerElement(): HTMLElement | null {
    return containerEl;
  }

  // Simple markdown to HTML converter
  type ParsedMarkdown = { html: string; links: Array<{ text: string; url: string }> };
  function parseMarkdown(md: string): ParsedMarkdown {
    if (!md) return { html: "", links: [] };

    // First, extract and process tables BEFORE any other transformation
    const tableBlocks: string[] = [];
    let processed = md.replace(
      /\|[^\n]+\|\n\|[-:\s|]+\|\n(\|[^\n]+\|\n?)*/g,
      (tableMatch) => {
        const lines = tableMatch.trim().split('\n');
        if (lines.length < 2) return tableMatch;

        const headerCells = lines[0].split('|').slice(1, -1).map(c => c.trim());
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
    const linkIndex: Array<{ text: string; url: string }> = [];
    processed = processed.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_, text, url) => {
        const existingIndex = linkIndex.findIndex(l => l.url === url);
        if (existingIndex >= 0) {
          return `${text}__FOOTNOTE_${existingIndex + 1}__`;
        }
        linkIndex.push({ text, url });
        return `${text}__FOOTNOTE_${linkIndex.length}__`;
      }
    );

    // Now escape HTML and process markdown
    processed = escapeHtml(processed)
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^# (.+)$/gm, '<h2>$1</h2>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/\n\n+/g, '</p><p>')
      .replace(/\n/g, '<br>');

    // Convert footnote placeholders
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

    // Clean up
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

  // Get text content from message parts
  function getTextFromParts(parts: UIMessage["parts"]): string {
    if (!parts) return "";
    return parts
      .filter((part) => part.type === "text")
      .map((part) => (part as { type: "text"; text: string }).text)
      .join("");
  }

  // Get the first tool output from parts
  function getToolOutputFromParts(parts: UIMessage["parts"]): string | null {
    if (!parts) return null;
    for (const part of parts) {
      if (part.type.startsWith("tool-") && part.type !== "tool-invocation") {
        const toolPart = part as { output?: unknown; state?: string };
        if (toolPart.state === "output-available" && toolPart.output) {
          return extractExplanation(toolPart.output);
        }
      }
      if (part.type === "tool-invocation") {
        const inv = (part as { toolInvocation?: { state: string; result?: unknown } }).toolInvocation;
        if (inv?.state === "result" && inv.result) {
          return extractExplanation(inv.result);
        }
      }
    }
    return null;
  }

  function extractExplanation(output: unknown): string {
    if (typeof output === "string") return output;
    if (output && typeof output === "object") {
      const obj = output as Record<string, unknown>;
      if (typeof obj.explanation === "string") {
        return obj.explanation;
      }
      return JSON.stringify(output, null, 2);
    }
    return String(output);
  }

  // Get parsed content for a message
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

  // Extract inline content from tool output
  interface InlineContent {
    pictograph?: InlinePictographType;
    gallery?: InlineGalleryType;
    galleries?: InlineGalleryType[];
    sequencePlayer?: InlineSequencePlayerType;
    stepGrid?: InlineStepGridType;
    quiz?: InlineQuizType;
  }

  function extractInlineContent(output: unknown): InlineContent {
    const content: InlineContent = {};
    if (!output || typeof output !== "object") return content;

    const obj = output as Record<string, unknown>;

    if (obj.inlinePictograph && typeof obj.inlinePictograph === "object") {
      const pic = obj.inlinePictograph as Record<string, unknown>;
      if (pic.type === "inline-pictograph" && typeof pic.letter === "string") {
        content.pictograph = pic as unknown as InlinePictographType;
      }
    }

    if (obj.inlineGallery && typeof obj.inlineGallery === "object") {
      const gal = obj.inlineGallery as Record<string, unknown>;
      if (gal.type === "inline-gallery" && Array.isArray(gal.items)) {
        content.gallery = gal as unknown as InlineGalleryType;
      }
    }

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

    if (obj.inlineSequencePlayer && typeof obj.inlineSequencePlayer === "object") {
      const seq = obj.inlineSequencePlayer as Record<string, unknown>;
      if (seq.type === "inline-sequence-player" && typeof seq.word === "string") {
        content.sequencePlayer = seq as unknown as InlineSequencePlayerType;
      }
    }

    if (obj.inlineStepGrid && typeof obj.inlineStepGrid === "object") {
      const grid = obj.inlineStepGrid as Record<string, unknown>;
      if (grid.type === "inline-step-grid" && Array.isArray(grid.steps)) {
        content.stepGrid = grid as unknown as InlineStepGridType;
      }
    }

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
      if (part.type.startsWith("tool-") && part.type !== "tool-invocation") {
        const toolPart = part as { output?: unknown; state?: string };
        if (toolPart.state === "output-available" && toolPart.output) {
          const content = extractInlineContent(toolPart.output);
          if (content.pictograph || content.gallery || content.galleries?.length || content.sequencePlayer || content.stepGrid || content.quiz) {
            allContent.push(content);
          }
        }
      }
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
</script>

<div class="conversation-readonly" bind:this={containerEl}>
  {#each messages as message (message.id)}
    {#if message.role === "user"}
      <!-- User Message -->
      <div class="message user-message">
        <div class="message-content">
          <p>{getTextFromParts(message.parts)}</p>
        </div>
      </div>
    {:else if message.role === "assistant"}
      <!-- Assistant Response -->
      {@const parsed = getMessageParsedContent(message.parts)}
      {@const inlineContent = getInlineContentFromParts(message.parts)}
      <div class="message assistant-message">
        <div class="message-avatar">
          <i class="fas fa-robot" aria-hidden="true"></i>
        </div>
        <div class="message-content">
          {#if parsed.textHtml}
            <div class="text-response markdown-content">
              {@html parsed.textHtml}
            </div>
          {:else if parsed.toolHtml}
            <div class="tool-response markdown-content">
              {@html parsed.toolHtml}
            </div>
          {/if}

          <!-- Inline Pictographs/Galleries/Sequence Players from tool outputs -->
          {#if inlineContent.length > 0}
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

          <!-- Link index at bottom of message -->
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
        </div>
      </div>
    {/if}
  {/each}
</div>

<style>
  .conversation-readonly {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-radius: 12px;
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

  /* Inline content container */
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

  /* Footnote references */
  .markdown-content :global(.footnote-ref) {
    font-size: 0.7em;
    color: var(--theme-accent, #6366f1);
    font-weight: 600;
    vertical-align: super;
    margin-left: 1px;
    cursor: default;
  }

  /* Link index */
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

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .link-chip {
      transition: none;
    }
  }
</style>
