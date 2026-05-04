<!--
  TikaComparePanel - One side of the A/B comparison view.
  Renders a model label and scrollable message list.
-->
<script lang="ts">
  import type { UIMessage } from "@ai-sdk/svelte";
  import TikaAssistantMessage from "./TikaAssistantMessage.svelte";
  import { getTextFromParts } from "../services/tika-message-extractor";

  interface Props {
    modelLabel: string;
    modelColor: string;
    messages: UIMessage[];
    status: "submitted" | "streaming" | "ready" | "error";
  }

  let { modelLabel, modelColor, messages, status }: Props = $props();

  let scrollContainer: HTMLDivElement | undefined = $state();

  // Auto-scroll on new messages
  $effect(() => {
    if (messages.length && scrollContainer) {
      requestAnimationFrame(() => {
        scrollContainer?.scrollTo({ top: scrollContainer.scrollHeight, behavior: "smooth" });
      });
    }
  });

  const isLastMessageStreaming = $derived(
    status === "streaming" &&
      messages.length > 0 &&
      messages[messages.length - 1]?.role === "assistant"
  );
</script>

<div class="compare-panel">
  <div class="panel-label" style:--label-color={modelColor}>
    <span class="label-dot"></span>
    <span class="label-text">{modelLabel}</span>
    {#if status === "streaming" || status === "submitted"}
      <span class="streaming-indicator"></span>
    {/if}
  </div>

  <div class="panel-messages themed-scrollbar" bind:this={scrollContainer}>
    {#if messages.length === 0}
      <div class="empty-state">Waiting for a message...</div>
    {:else}
      {#each messages as message, index (message.id)}
        {#if message.role === "user"}
          <div class="user-message">
            {getTextFromParts(message.parts)}
          </div>
        {:else if message.role === "assistant"}
          <TikaAssistantMessage
            {message}
            isStreaming={isLastMessageStreaming && index === messages.length - 1}
          />
        {/if}
      {/each}
    {/if}
  </div>
</div>

<style>
  .compare-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .panel-label {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
  }

  .label-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--label-color, #6366f1);
  }

  .streaming-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--semantic-success, #22c55e);
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.4;
    }
    50% {
      opacity: 1;
    }
  }

  .panel-messages {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.4));
    font-size: var(--font-size-min, 14px);
    font-style: italic;
  }

  .user-message {
    align-self: flex-end;
    max-width: 85%;
    padding: 8px 12px;
    background: var(--theme-accent, #6366f1);
    color: white;
    border-radius: 12px 12px 2px 12px;
    font-size: var(--font-size-min, 14px);
    line-height: 1.4;
  }

  @media (prefers-reduced-motion: reduce) {
    .streaming-indicator {
      animation: none;
      opacity: 1;
    }
  }
</style>
