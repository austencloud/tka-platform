# TIKA Compare Mode - Design

**Date:** 2026-02-22
**Purpose:** Side-by-side A/B comparison of TIKA responses across different models
**Scope:** Dev tool toggle within the existing TIKA module

---

## Problem

When tuning TIKA's system prompt or upgrading models, there's no way to see the difference in real time. You have to test one model, switch, test the other, and compare from memory. A side-by-side view sends the same message to two models simultaneously and shows both responses.

## Approach

A toggle button in the TIKA header switches between normal mode and compare mode. Compare mode splits the panel into two side-by-side conversations, each with its own configurable model selector and independent conversation history.

## Component Hierarchy

```
TikaModule.svelte (adds compareMode state + second Chat instance)
├── [normal mode] TikaConversation (existing, unchanged)
└── [compare mode] TikaCompareView.svelte (NEW)
    ├── compare-header
    │   ├── Panel A model selector (reuses TikaModelSwitcher)
    │   └── Panel B model selector (reuses TikaModelSwitcher)
    ├── compare-panels (CSS grid, 50/50 split)
    │   ├── TikaComparePanel.svelte (Panel A)
    │   │   ├── model label + streaming indicator
    │   │   └── scrollable message list (reuses TikaAssistantMessage)
    │   └── TikaComparePanel.svelte (Panel B)
    │       ├── model label + streaming indicator
    │       └── scrollable message list (reuses TikaAssistantMessage)
    └── shared TikaInputArea (one input, fires to both panels)
```

## Layout

```
┌─────────────────────────────────────────────┐
│  Tika                      [Exit Compare]   │
├──────────────────────┬──────────────────────┤
│  ▼ Sonnet 4          │  ▼ Sonnet 4.6        │
├──────────────────────┼──────────────────────┤
│                      │                      │
│  [messages A]        │  [messages B]        │
│                      │                      │
│                      │                      │
├──────────────────────┴──────────────────────┤
│  Ask something...                    [Send] │
└─────────────────────────────────────────────┘
```

## State Management

```
TikaModule additions:
  compareMode: boolean (default false)
  chatA: Chat instance (model A)
  chatB: Chat instance (model B)
  modelA: string (default "sonnet-4", persisted to localStorage)
  modelB: string (default "sonnet-4-6", persisted to localStorage)
```

On message submit in compare mode:
1. User types in shared input area
2. TikaModule calls chatA.append(message) AND chatB.append(message) simultaneously
3. Each panel streams its response independently
4. Each panel maintains its own full conversation history

## Key Decisions

1. **Two separate Chat instances** - Each model gets its own message history. Model A's response never leaks into Model B's context.

2. **Reuses existing components** - TikaAssistantMessage for rendering, TikaModelSwitcher for dropdowns, TikaInputArea for the shared input.

3. **Compare mode is stateless** - Toggling off discards the comparison. Normal mode conversation is untouched.

4. **Desktop-only** - The 50/50 split needs width. Hide the compare toggle on mobile (<768px).

5. **Independent scrolling** - Each panel scrolls independently. Both auto-scroll on new messages.

## New Files

- `src/lib/features/tika/components/TikaCompareView.svelte` - Main compare layout
- `src/lib/features/tika/components/TikaComparePanel.svelte` - Single panel (model label + messages)

## Modified Files

- `src/lib/features/tika/TikaModule.svelte` - Add compareMode state, second Chat, toggle handler
- `src/lib/features/tika/components/TikaHeader.svelte` - Add compare toggle button
- `src/lib/features/tika/services/implementations/TikaModelProvider.ts` - Already updated (Sonnet 4.6 model ID)

## Available Models

Models come from the existing `/api/tika/models` endpoint. Currently:
- `sonnet-4` → Claude Sonnet 4.6 (upgraded)
- `haiku` → Claude Haiku 4.5
- `deepseek` → DeepSeek V3

The model key "sonnet-4" now points to Sonnet 4.6. For the comparison to work with the old Sonnet 4, we need to add a "sonnet-4-legacy" entry pointing to the old model ID.

## Model Registry Update

```typescript
// TikaModelProvider.ts
const MODELS = {
  "sonnet-4": { provider: "anthropic", modelId: "claude-sonnet-4-6" },
  "sonnet-4-legacy": { provider: "anthropic", modelId: "claude-sonnet-4-20250514" },
  haiku: { provider: "anthropic", modelId: "claude-haiku-4-5-20251001" },
  deepseek: { provider: "deepseek", modelId: "deepseek-chat" },
};
```

The models endpoint also needs to return this new entry so the UI shows it as a selectable option.
