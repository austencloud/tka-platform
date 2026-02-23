# TIKA Compare Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a side-by-side comparison view to the TIKA module that sends the same message to two independently configurable models and displays both responses simultaneously.

**Architecture:** Toggle in TikaHeader switches between normal mode (single TikaConversation) and compare mode (TikaCompareView with two panels). Each panel has its own Chat instance, model selector, and conversation history. Shared input area sends messages to both.

**Tech Stack:** Svelte 5, AI SDK (`@ai-sdk/svelte` Chat class, `DefaultChatTransport`), existing TIKA component library

**Design doc:** `docs/plans/2026-02-22-tika-compare-mode-design.md`

---

### Task 1: Add Legacy Sonnet Model to Provider

Without this, there's no "old" model to compare against.

**Files:**
- Modify: `src/lib/features/tika/services/implementations/TikaModelProvider.ts:12-16`
- Modify: `src/routes/api/tika/models/+server.ts:30-56`

**Step 1: Add sonnet-4-legacy to MODELS record**

In `TikaModelProvider.ts`, add a legacy entry:

```typescript
const MODELS: Record<string, ModelConfig> = {
  "sonnet-4": { provider: "anthropic", modelId: "claude-sonnet-4-6" },
  "sonnet-4-legacy": { provider: "anthropic", modelId: "claude-sonnet-4-20250514" },
  haiku: { provider: "anthropic", modelId: "claude-haiku-4-5-20251001" },
  deepseek: { provider: "deepseek", modelId: "deepseek-chat" },
};
```

**Step 2: Add legacy model to /api/tika/models response**

In `+server.ts`, add an entry after the existing Sonnet 4 block (around line 41):

```typescript
{
  id: "sonnet-4-legacy",
  name: "Claude Sonnet 4 (Legacy)",
  shortName: "Sonnet 4",
  icon: "fa-brain",
  color: "#94a3b8",
  description: "Previous generation (comparison baseline)"
}
```

**Step 3: Verify**

Run: `npm run check`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/lib/features/tika/services/implementations/TikaModelProvider.ts src/routes/api/tika/models/+server.ts
git commit -m "feat(tika): add sonnet-4-legacy model for A/B comparison"
```

---

### Task 2: Create TikaComparePanel Component

A single panel that displays one model's conversation. Reuses TikaAssistantMessage for message rendering.

**Files:**
- Create: `src/lib/features/tika/components/TikaComparePanel.svelte`

**Step 1: Create the panel component**

This component receives messages and status from its parent and renders them. It's essentially a stripped-down version of TikaConversation's message area without the header or input.

```svelte
<!--
  TikaComparePanel - One side of the A/B comparison view.
  Renders a model label and scrollable message list.
-->
<script lang="ts">
  import type { UIMessage } from "@ai-sdk/svelte";
  import TikaAssistantMessage from "./TikaAssistantMessage.svelte";
  import { tikaMessageExtractor } from "../services/implementations/TikaMessageExtractor";

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
    status === "streaming" && messages.length > 0 && messages[messages.length - 1]?.role === "assistant"
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
            {tikaMessageExtractor.getTextFromParts(message)}
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
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
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
    .streaming-indicator { animation: none; opacity: 1; }
  }
</style>
```

**Step 2: Verify**

Run: `npm run check`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/lib/features/tika/components/TikaComparePanel.svelte
git commit -m "feat(tika): add TikaComparePanel component for A/B view"
```

---

### Task 3: Create TikaCompareView Component

The main compare layout that houses two panels and a shared input area.

**Files:**
- Create: `src/lib/features/tika/components/TikaCompareView.svelte`

**Step 1: Create the compare view**

This component receives two sets of messages/status and two model configs. It orchestrates the side-by-side layout.

```svelte
<!--
  TikaCompareView - Side-by-side A/B model comparison.
  Two independent conversation panels with a shared input area.
-->
<script lang="ts">
  import type { UIMessage } from "@ai-sdk/svelte";
  import type { ModelOption } from "../types";
  import TikaComparePanel from "./TikaComparePanel.svelte";
  import TikaModelSwitcher from "./TikaModelSwitcher.svelte";
  import TikaInputArea from "./TikaInputArea.svelte";

  interface Props {
    messagesA: UIMessage[];
    messagesB: UIMessage[];
    statusA: "submitted" | "streaming" | "ready" | "error";
    statusB: "submitted" | "streaming" | "ready" | "error";
    modelA: string;
    modelB: string;
    availableModels: ModelOption[];
    onModelAChange: (modelId: string) => void;
    onModelBChange: (modelId: string) => void;
    onSubmit: (question: string) => void;
    onStop: () => void;
    onExitCompare: () => void;
  }

  let {
    messagesA,
    messagesB,
    statusA,
    statusB,
    modelA,
    modelB,
    availableModels,
    onModelAChange,
    onModelBChange,
    onSubmit,
    onStop,
    onExitCompare,
  }: Props = $props();

  const modelAOption = $derived(availableModels.find((m) => m.id === modelA));
  const modelBOption = $derived(availableModels.find((m) => m.id === modelB));

  const combinedStatus = $derived<"submitted" | "streaming" | "ready" | "error">(
    statusA === "streaming" || statusB === "streaming"
      ? "streaming"
      : statusA === "submitted" || statusB === "submitted"
        ? "submitted"
        : statusA === "error" || statusB === "error"
          ? "error"
          : "ready"
  );
</script>

<div class="compare-view">
  <div class="compare-header">
    <div class="header-side">
      <TikaModelSwitcher
        currentModel={modelA}
        {availableModels}
        onModelChange={onModelAChange}
      />
    </div>
    <button class="exit-compare" onclick={onExitCompare}>
      <i class="fas fa-times" aria-hidden="true"></i>
      Exit Compare
    </button>
    <div class="header-side">
      <TikaModelSwitcher
        currentModel={modelB}
        {availableModels}
        onModelChange={onModelBChange}
      />
    </div>
  </div>

  <div class="compare-panels">
    <TikaComparePanel
      modelLabel={modelAOption?.shortName ?? modelA}
      modelColor={modelAOption?.color ?? "#6366f1"}
      messages={messagesA}
      status={statusA}
    />
    <div class="panel-divider"></div>
    <TikaComparePanel
      modelLabel={modelBOption?.shortName ?? modelB}
      modelColor={modelBOption?.color ?? "#22c55e"}
      messages={messagesB}
      status={statusB}
    />
  </div>

  <div class="compare-input">
    <TikaInputArea
      status={combinedStatus}
      {onSubmit}
      {onStop}
    />
  </div>
</div>

<style>
  .compare-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  .compare-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    gap: 12px;
  }

  .header-side {
    flex: 1;
    display: flex;
    justify-content: center;
  }

  .exit-compare {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
    white-space: nowrap;
  }

  .exit-compare:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #ffffff);
  }

  .compare-panels {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
  }

  .panel-divider {
    width: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .compare-input {
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    padding: 8px 12px;
  }

  @media (prefers-reduced-motion: reduce) {
    .exit-compare { transition: none; }
  }
</style>
```

**Step 2: Verify**

Run: `npm run check`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/lib/features/tika/components/TikaCompareView.svelte
git commit -m "feat(tika): add TikaCompareView side-by-side layout"
```

---

### Task 4: Add Compare Toggle to TikaHeader

**Files:**
- Modify: `src/lib/features/tika/components/TikaHeader.svelte:13-47` (props), `~154` (button placement)

**Step 1: Add compare props to TikaHeader**

Add these to the props destructuring (around line 47):

```typescript
compareMode?: boolean;
onToggleCompare?: () => void;
```

**Step 2: Add compare toggle button**

After the flag-for-review button (around line 154), before the copy-as-image button, add:

```svelte
{#if onToggleCompare}
  <button
    class="header-btn"
    class:active={compareMode}
    onclick={onToggleCompare}
    title={compareMode ? "Exit compare mode" : "Compare models side by side"}
  >
    <i class="fas fa-columns" aria-hidden="true"></i>
  </button>
{/if}
```

Hide the compare button on mobile by wrapping it:

```svelte
{#if onToggleCompare}
  <button
    class="header-btn compare-btn"
    class:active={compareMode}
    onclick={onToggleCompare}
    title={compareMode ? "Exit compare mode" : "Compare models side by side"}
  >
    <i class="fas fa-columns" aria-hidden="true"></i>
  </button>
{/if}
```

Add CSS:

```css
.compare-btn {
  display: none;
}

@media (min-width: 768px) {
  .compare-btn {
    display: flex;
  }
}

.compare-btn.active {
  color: var(--theme-accent, #6366f1);
  background: rgba(99, 102, 241, 0.15);
}
```

**Step 3: Verify**

Run: `npm run check`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/lib/features/tika/components/TikaHeader.svelte
git commit -m "feat(tika): add compare toggle button to header"
```

---

### Task 5: Wire Compare Mode into TikaModule

This is the integration task. Add compare state, second Chat instance, and conditional rendering.

**Files:**
- Modify: `src/lib/features/tika/TikaModule.svelte`

**Step 1: Add compare state declarations**

After the existing state declarations (around line 75), add:

```typescript
// Compare mode state
let compareMode = $state(false);
const COMPARE_MODEL_A_KEY = "tika-compare-model-a";
const COMPARE_MODEL_B_KEY = "tika-compare-model-b";
let compareModelA = $state(
  browser ? localStorage.getItem(COMPARE_MODEL_A_KEY) || "sonnet-4-legacy" : "sonnet-4-legacy"
);
let compareModelB = $state(
  browser ? localStorage.getItem(COMPARE_MODEL_B_KEY) || "sonnet-4" : "sonnet-4"
);
```

**Step 2: Add compare Chat instances**

After the existing `chat` initialization (after line 233), add:

```typescript
// Compare mode Chat instances (lazy - created when compare mode activates)
let chatA: Chat | null = $state(null);
let chatB: Chat | null = $state(null);

function createCompareChat(id: string, model: string): Chat {
  return new Chat({
    id,
    transport: new DefaultChatTransport({
      api: "/api/tika/ask",
      headers: () => getAuthHeaders(),
      body: () => ({
        userId,
        completedConcepts,
        masteryContext,
        conversationMemory,
        language: "en",
        model,
      }),
    }),
    onError: (error: Error) => {
      console.error(`[TIKA Compare ${id}] Chat error:`, error);
    },
  });
}
```

**Step 3: Add compare mode handlers**

```typescript
function toggleCompare() {
  compareMode = !compareMode;
  if (compareMode && browser) {
    // Create fresh chat instances for comparison
    chatA = createCompareChat("tika-compare-a", compareModelA);
    chatB = createCompareChat("tika-compare-b", compareModelB);
  }
}

function handleCompareModelAChange(modelId: string) {
  compareModelA = modelId;
  if (browser) localStorage.setItem(COMPARE_MODEL_A_KEY, modelId);
  // Recreate chat A with new model
  chatA = createCompareChat("tika-compare-a", modelId);
}

function handleCompareModelBChange(modelId: string) {
  compareModelB = modelId;
  if (browser) localStorage.setItem(COMPARE_MODEL_B_KEY, modelId);
  // Recreate chat B with new model
  chatB = createCompareChat("tika-compare-b", modelId);
}

async function handleCompareSubmit(question: string) {
  if (!conversationMemory) {
    conversationMemory = await loadConversationMemory();
  }
  chatA?.sendMessage({ text: question });
  chatB?.sendMessage({ text: question });
}

function handleCompareStop() {
  chatA?.stop();
  chatB?.stop();
}
```

**Step 4: Add compare derived state**

```typescript
const compareMessagesA = $derived(chatA?.messages ?? []);
const compareMessagesB = $derived(chatB?.messages ?? []);
const compareStatusA = $derived(chatA?.status ?? "ready");
const compareStatusB = $derived(chatB?.status ?? "ready");
```

**Step 5: Add TikaCompareView import**

At the top of the script, add:

```typescript
import TikaCompareView from "./components/TikaCompareView.svelte";
```

**Step 6: Update template**

In the template section, wrap the existing `TikaConversation` in a conditional and add `TikaCompareView`:

Find the `TikaConversation` component (around line 563). Wrap it:

```svelte
{#if compareMode}
  <TikaCompareView
    messagesA={compareMessagesA}
    messagesB={compareMessagesB}
    statusA={compareStatusA}
    statusB={compareStatusB}
    modelA={compareModelA}
    modelB={compareModelB}
    {availableModels}
    onModelAChange={handleCompareModelAChange}
    onModelBChange={handleCompareModelBChange}
    onSubmit={handleCompareSubmit}
    onStop={handleCompareStop}
    onExitCompare={toggleCompare}
  />
{:else}
  <TikaConversation
    ... (existing props unchanged)
    compareMode={compareMode}
    onToggleCompare={toggleCompare}
  />
{/if}
```

**Step 7: Pass compare props through TikaConversation to TikaHeader**

`TikaConversation` needs to accept `compareMode` and `onToggleCompare` and forward them to `TikaHeader`. Add to TikaConversation's props (around line 20-58):

```typescript
compareMode?: boolean;
onToggleCompare?: () => void;
```

And pass them to `TikaHeader` in TikaConversation's template:

```svelte
<TikaHeader
  ... (existing props)
  {compareMode}
  {onToggleCompare}
/>
```

**Step 8: Verify**

Run: `npm run check`
Expected: No type errors

**Step 9: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 10: Commit**

```bash
git add src/lib/features/tika/TikaModule.svelte src/lib/features/tika/components/TikaConversation.svelte src/lib/features/tika/components/TikaCompareView.svelte
git commit -m "feat(tika): wire compare mode into TikaModule with dual Chat instances"
```

---

### Task 6: Visual Polish and Edge Cases

**Files:**
- Modify: `src/lib/features/tika/components/TikaCompareView.svelte`
- Modify: `src/lib/features/tika/components/TikaComparePanel.svelte`

**Step 1: Handle model switching mid-conversation**

When the user changes a model mid-conversation, the existing messages become stale (they were generated by the old model). Add a visual indicator in TikaComparePanel:

After the `panel-label` div, check if messages exist from before a model switch and show a subtle divider:

```svelte
<!-- Already handled by recreating the Chat instance on model change -->
<!-- Chat recreation clears messages, giving a fresh start -->
```

Actually, since `createCompareChat` creates a fresh Chat (no persisted messages), switching models already clears the conversation. This is the correct behavior for a comparison tool.

**Step 2: Add a "both empty" welcome state to TikaCompareView**

Before the panels, if both message arrays are empty, show a centered hint:

In TikaCompareView, after the `compare-header`:

```svelte
{#if messagesA.length === 0 && messagesB.length === 0}
  <div class="compare-welcome">
    <p>Type a message below to send it to both models simultaneously.</p>
  </div>
{/if}
```

With CSS:

```css
.compare-welcome {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--theme-text-secondary, rgba(255, 255, 255, 0.4));
  font-size: var(--font-size-min, 14px);
  text-align: center;
  pointer-events: none;
  z-index: 1;
}
```

And make `.compare-panels` `position: relative;`.

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/lib/features/tika/components/TikaCompareView.svelte src/lib/features/tika/components/TikaComparePanel.svelte
git commit -m "feat(tika): polish compare mode welcome state and edge cases"
```

---

## Summary

| Task | What | New Files | Modified Files |
|------|------|-----------|----------------|
| 1 | Legacy model entry | — | TikaModelProvider.ts, models/+server.ts |
| 2 | Compare panel component | TikaComparePanel.svelte | — |
| 3 | Compare view layout | TikaCompareView.svelte | — |
| 4 | Header toggle button | — | TikaHeader.svelte |
| 5 | Module integration | — | TikaModule.svelte, TikaConversation.svelte |
| 6 | Polish + edge cases | — | TikaCompareView.svelte, TikaComparePanel.svelte |
