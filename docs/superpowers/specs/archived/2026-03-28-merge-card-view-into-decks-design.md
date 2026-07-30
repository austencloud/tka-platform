---
status: archived
value: 2
effort: M
remaining: ""
depends_on: ""
plan_path: ""
tags: []
superseded_by: "Choreo-card module retirement (dd8420258d)"
last_triaged: 2026-07-29
---
# Merge Card View into Decks Tab

**Date:** 2026-03-28
**Status:** Archived as obsolete (verified 2026-07-29)
**Supersedes:** `2026-03-28-card-preview-tab-design.md` (Card Preview as separate tab)

> **Queue closeout:** The proposed Decks and Designer tab structure no longer exists. Commit `dd8420258d` retired Catalogs, Card Designer, and Theme Lab, removing the product surface this draft intended to reorganize.

## Problem

The Card Preview tab duplicates the Decks tab's browsing flow with worse styling. Both tabs show the same collection cards, same deck navigation, same VTG families — but Card Preview has a bare-bones SourcePicker while Decks has polished hero cards with icons, descriptions, and proper loading states. Having two tabs that browse decks differently is confusing.

## Solution

Remove the Card Preview tab. Add a view mode toggle to the Decks tab's deck interior (Level 2). When viewing a deck's sequences, users can switch between "Grid" (current thumbnail grid) and "Cards" (sequences rendered on simulated letter pages at poker/tarot size). Export controls appear when in Cards mode.

**Tab structure after:** Decks, Designer (2 tabs, down from 3).

## Changes

### 1. Remove Card Preview tab

**Delete files:**
- `src/lib/features/choreo-card/components/card-preview/CardPreviewTab.svelte`
- `src/lib/features/choreo-card/components/card-preview/SourcePicker.svelte`
- `src/lib/features/choreo-card/components/card-preview/BreadcrumbBar.svelte`
- `src/lib/features/choreo-card/context/card-preview-context.ts`

**Keep files** (reused in Decks tab):
- `CardPageLayout.svelte` — card-on-pages rendering
- `CardSizeToggle.svelte` — poker/tarot segmented control
- `CardPreviewSettings.svelte` — theme, visibility, export panel
- `SubsetFilterBar.svelte` — may merge with DeckInteriorFilterPanel later
- `card-sizes.ts` + tests — foundation
- `card-preview-state.svelte.ts` — trim to card rendering state only (remove navigation/browsing)

**Modify:**
- `tab-definitions.ts`: Remove "card-preview" entry. Tabs = decks, designer.
- `ChoreoCardTab.svelte`: Remove "card-preview" mode. Default to "decks". Remove CardPreviewTab import.

### 2. Add view mode toggle to DeckBrowser deck interior

**New state in DeckBrowser:**
```typescript
let viewMode = $state<'grid' | 'cards'>('grid');
```
Persisted to `localStorage` as `choreoCard.deckViewMode`.

**Toggle button** in deck interior top bar (alongside existing filter button):
- Two-segment toggle: `[ Grid | Cards ]`
- Uses same visual pattern as CardSizeToggle

**When viewMode === 'cards':**
- Replace the sequence grid with `CardPageLayout`
- Show `CardSizeToggle` in the top bar
- Show a gear button for `CardPreviewSettings` panel (theme, visibility, export)
- The existing `DeckInteriorFilterPanel` (family chips, start position) continues to filter which sequences appear

**When viewMode === 'grid':**
- Current behavior unchanged — sequence thumbnails in CSS grid grouped by family

### 3. Card rendering state

Trim `card-preview-state.svelte.ts` to only handle card rendering concerns:
- `cardSize` (poker/tarot)
- `renderProgress` / `renderTotal`
- `buildRenderOptions(visibility)`
- Remove all navigation state (level, source, deck selection, breadcrumbs)

DeckBrowser already owns browsing state. Card rendering state supplements it.

### 4. Wire CardPageLayout into DeckBrowser

DeckBrowser's deck interior (lines ~388-411) currently renders `ChoreoCard` components in a grid. When `viewMode === 'cards'`, render `CardPageLayout` instead, passing:
- `sequences` = the existing `filteredSequences` derived state
- `families` = the selected deck's families
- `selectedFamilyIds` = from DeckInteriorFilterPanel
- `cardSize` = from card rendering state
- `renderOptions` = built from visibility settings + card size
- `isLoading` / `isLargeDeck` = existing state

### 5. Export from deck interior

When in Cards mode, the gear icon opens `CardPreviewSettings` as a side panel within DeckBrowser. Export uses the same `PrintPDFExporter` (with dynamic card sizes from Task 2) and `PrintZipExporter`.

## What stays the same

- All deck browsing (collections, LoopCollectionView, VtgCollectionView, DeckBrowser navigation)
- DeckInteriorFilterPanel (family chips, start position)
- Card rendering pipeline (PrintCardRenderer, card back themes)
- Card size constants and page layout calculator
- Dynamic PrintPDFExporter
- Visibility settings and localStorage persistence
