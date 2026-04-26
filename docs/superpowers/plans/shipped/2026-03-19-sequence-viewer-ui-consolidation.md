# Sequence Viewer UI Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate three overlapping settings surfaces into context-menu-only, clean up the header, and redesign the bottom toolbar with Copy Link and Props buttons.

**Architecture:** Remove ViewerSettingsModal and VisibilityTab from Settings module. Canvas/card display toggles stay in their respective right-click context menus. Header becomes minimal (title + admin-only Copy for Claude). Bottom toolbar gets two rows: actions (with new Copy Link and Props) and BPM chip.

**Tech Stack:** Svelte 5, TypeScript, Firebase Auth (admin claims)

**Spec:** `docs/superpowers/specs/2026-03-19-sequence-viewer-ui-consolidation-design.md`

---

## Task 1: Admin-Gate Copy for Claude Button

**Files:**
- Modify: `src/routes/sequence/[id]/RouteViewerHeader.svelte` (lines 148-156)
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte` (lines 361-369)

- [ ] **Step 1: Add admin import to RouteViewerHeader**

In `RouteViewerHeader.svelte`, add import:
```ts
import { authState } from "$lib/shared/auth/state/authState.svelte";
```

Wrap the Copy for Claude button (lines 148-156) in `{#if authState.isAdmin}...{/if}`.

- [ ] **Step 2: Add admin import to SequenceViewerDrawerHost**

In `SequenceViewerDrawerHost.svelte`, add same import and wrap the Copy for Claude button (lines 361-369) in `{#if authState.isAdmin}...{/if}`.

- [ ] **Step 3: Verify build**

Run: `npm run check`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add src/routes/sequence/[id]/RouteViewerHeader.svelte src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte
git commit -m "feat: admin-gate Copy for Claude button in sequence viewer"
```

---

## Task 2: Add Copy Link and Props Buttons to Bottom Toolbar

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ViewerMorphToolbar.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/ViewerFooter.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte`

- [ ] **Step 1: Add new props to ViewerMorphToolbar**

Add to Props interface:
```ts
onCopyLink?: () => void;
onPropsOpen?: () => void;
linkCopied?: boolean;
```

Destructure them in the `let { ... }` block with defaults:
```ts
onCopyLink,
onPropsOpen,
linkCopied = false,
```

- [ ] **Step 2: Add Copy Link button to playback-row**

Add after the Favorite button (before Save):
```svelte
{#if onCopyLink}
  <button
    type="button"
    class="action-btn"
    class:copied={linkCopied}
    onclick={onCopyLink}
    aria-label={linkCopied ? "Link copied" : "Copy shareable link"}
  >
    <i class="fas {linkCopied ? 'fa-check' : 'fa-link'}" aria-hidden="true"></i>
    <span>{linkCopied ? "Copied" : "Copy Link"}</span>
  </button>
{/if}
```

- [ ] **Step 3: Add Props button to playback-row**

Add after Save/Remix:
```svelte
{#if onPropsOpen}
  <button
    type="button"
    class="action-btn"
    onclick={onPropsOpen}
    aria-label="Change props"
  >
    <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
    <span>Props</span>
  </button>
{/if}
```

- [ ] **Step 4: Add copied style**

Add CSS for `.action-btn.copied`:
```css
.action-btn.copied {
  color: var(--semantic-success, #22c55e);
  border-color: rgba(34, 197, 94, 0.25);
}
```

- [ ] **Step 5: Make playback-row two rows**

Restructure the collapsed state markup. Wrap existing action buttons in a `.actions-row` div, and keep the chip-trigger in its own `.bpm-row` div:

```svelte
<div class="toolbar-collapsed" class:hidden={controlsExpanded}>
  <div class="actions-row">
    <!-- Play, Favorite, Copy Link, Save, Props, Video, etc. -->
  </div>
  <div class="bpm-row">
    <!-- chip-trigger button -->
  </div>
</div>
```

Update CSS:
```css
.toolbar-collapsed {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.actions-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.bpm-row {
  display: flex;
  width: 100%;
}
```

Remove the old `.playback-row` class and its `.hidden` variant. Apply hidden to `.toolbar-collapsed` instead.

- [ ] **Step 6: Thread new props through ViewerFooter**

In `ViewerFooter.svelte`, add `onCopyLink`, `onPropsOpen`, and `linkCopied` to the Props interface and pass them through to ViewerMorphToolbar.

- [ ] **Step 7: Thread new props through SequenceViewerOrchestrator**

Wire the copy link handler (reuse existing `handleCopyLink` logic from RouteViewerHeader — copy the share URL to clipboard and set a `linkCopied` timeout state). Wire the props open handler to open PropSelectionSheet.

- [ ] **Step 8: Verify build**

Run: `npm run check`
Expected: No new errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ViewerMorphToolbar.svelte src/lib/shared/sequence-viewer/components/ViewerFooter.svelte src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte
git commit -m "feat: add Copy Link and Props buttons to bottom toolbar, two-row layout"
```

---

## Task 3: Clean Up Header

**Files:**
- Modify: `src/routes/sequence/[id]/RouteViewerHeader.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/ViewerHeader.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte`

- [ ] **Step 1: Strip RouteViewerHeader**

Remove from `RouteViewerHeader.svelte`:
- Dark/light toggle button (lines 138-147) and all related state (`isDark`, toggle handler)
- Copy link button (lines 157-165) and `linkCopied` state/handler (now in bottom toolbar)
- Settings gear button (lines 166-174) and `onSettingsOpen` prop

Keep: Title, Generate dropdown (if present), Copy for Claude (admin-gated from Task 1).

- [ ] **Step 2: Strip ViewerHeader**

Remove from `ViewerHeader.svelte`:
- Settings gear button and `onSettingsOpen` prop from the Props interface
- Any remaining settings-related props

- [ ] **Step 3: Strip SequenceViewerDrawerHost inline header**

Remove from the inline header in `SequenceViewerDrawerHost.svelte`:
- Settings gear button (lines 379-387)
- Copy link button (lines 370-378) — now in bottom toolbar
- Dark toggle if present

Keep: Title, Copy for Claude (admin-gated from Task 1).

- [ ] **Step 4: Verify build**

Run: `npm run check`
Expected: No new errors. Some unused prop warnings may appear from callers still passing removed props — fix those.

- [ ] **Step 5: Commit**

```bash
git add src/routes/sequence/[id]/RouteViewerHeader.svelte src/lib/shared/sequence-viewer/components/ViewerHeader.svelte src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte
git commit -m "feat: clean up sequence viewer header, remove redundant buttons"
```

---

## Task 4: Remove ViewerSettingsModal from All Consumers

**Files:**
- Modify: `src/routes/sequence/[id]/+page.svelte` (remove import line 51, state line 113, render lines 734-737, callback line 542)
- Modify: `src/routes/p/[code]/+page.svelte` (remove import line 54, state line 97, render lines 681-684, callback line 489)
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte` (remove import line 33, state line 100, render lines 581-584)

- [ ] **Step 1: Clean up sequence/[id]/+page.svelte**

Remove:
- `import ViewerSettingsModal` line
- `let settingsModalOpen` state
- `onSettingsOpen` callback passed to header
- `<ViewerSettingsModal>` render block

- [ ] **Step 2: Clean up p/[code]/+page.svelte**

Same removals as Step 1.

- [ ] **Step 3: Clean up SequenceViewerDrawerHost.svelte**

Remove:
- `import ViewerSettingsModal` line
- `let settingsModalOpen` state
- `<ViewerSettingsModal>` render block

- [ ] **Step 4: Verify build**

Run: `npm run check`
Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add src/routes/sequence/[id]/+page.svelte src/routes/p/[code]/+page.svelte src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte
git commit -m "feat: remove ViewerSettingsModal from all consumers"
```

---

## Task 5: Delete ViewerSettingsModal

**Files:**
- Delete: `src/lib/shared/sequence-viewer/components/ViewerSettingsModal.svelte`

- [ ] **Step 1: Delete the file**

```bash
rm src/lib/shared/sequence-viewer/components/ViewerSettingsModal.svelte
```

- [ ] **Step 2: Search for any remaining imports**

Search codebase for `ViewerSettingsModal` to confirm no remaining references.

- [ ] **Step 3: Verify build**

Run: `npm run check`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "chore: delete ViewerSettingsModal component"
```

---

## Task 6: Remove Visibility Tab from Settings Module

**Files:**
- Modify: `src/lib/features/settings/SettingsModule.svelte` (import line 41, render line 260)
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts` (lines 402-408)

- [ ] **Step 1: Remove from tab definitions**

In `tab-definitions.ts`, remove the Visibility tab entry from SETTINGS_TABS (lines 402-408).

- [ ] **Step 2: Remove from SettingsModule**

In `SettingsModule.svelte`:
- Remove `import VisibilityTab` (line 41)
- Remove the `{:else if activeTab === "visibility"}` render block (line 260)

- [ ] **Step 3: Verify build**

Run: `npm run check`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/settings/SettingsModule.svelte src/lib/shared/navigation/config/tab-definitions.ts
git commit -m "feat: remove Visibility tab from Settings module"
```

---

## Task 7: Add Display Submenu to Canvas Context Menu

**Files:**
- Modify: `src/lib/shared/animation-engine/components/canvas-context-menu/CanvasContextMenuBuilder.ts`
- Modify: `src/lib/shared/animation-engine/components/canvas-context-menu/CanvasContextMenuHost.svelte`

- [ ] **Step 1: Read current context menu builder**

Read `CanvasContextMenuBuilder.ts` fully to understand the menu item interface and how submenus (Effects, Efforts) are built with toggle/radio behavior.

- [ ] **Step 2: Add Display submenu**

Add a "Display" submenu to the context menu with checkbox-style toggles for the visibility items from `DisplayCategory.svelte`:
- Grid
- TKA Glyph
- Step Numbers
- Beat Position
- Props
- Word Header
- Progress Bar

Each item should read current state from `AnimationVisibilityStateManager` and toggle it on click. Use the same `keepOpen: true` pattern as the choreo card context menu.

- [ ] **Step 3: Rename "Canvas Settings..." to "Effect Settings..."**

Change the label of the existing "Canvas Settings..." menu item to "Effect Settings..." since it now only handles effect-specific configuration (Fire, LED, Trails, etc.).

- [ ] **Step 4: Verify build**

Run: `npm run check`
Expected: No new errors.

- [ ] **Step 5: Test context menu**

Verify by right-clicking the animation canvas that:
- "Display" submenu appears with toggle items
- "Effect Settings..." opens the existing modal
- Toggles correctly show/hide canvas elements

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/animation-engine/components/canvas-context-menu/
git commit -m "feat: add Display submenu to canvas context menu, rename Canvas Settings to Effect Settings"
```

---

## Task 8: Delete Dead Code

**Files:**
- Delete: `src/lib/shared/settings/components/tabs/VisibilityTab.svelte`
- Evaluate and delete if orphaned: `src/lib/shared/settings/components/tabs/visibility/PictographPanel.svelte`
- Evaluate and delete if orphaned: `src/lib/shared/settings/components/tabs/visibility/AnimationPanel.svelte`
- Evaluate and delete if orphaned: `src/lib/shared/settings/components/tabs/visibility/ImagePanel.svelte`

- [ ] **Step 1: Check for remaining imports of VisibilityTab**

Search codebase for `VisibilityTab`. After Tasks 5-6, it should have zero importers.

- [ ] **Step 2: Delete VisibilityTab**

```bash
rm src/lib/shared/settings/components/tabs/VisibilityTab.svelte
```

- [ ] **Step 3: Check panel imports**

Search for `PictographPanel`, `AnimationPanel`, `ImagePanel` imports. If only imported by VisibilityTab (now deleted), they're dead code.

- [ ] **Step 4: Delete orphaned panels**

Delete any panels that have zero remaining importers.

- [ ] **Step 5: Verify build**

Run: `npm run check`
Expected: No new errors.

- [ ] **Step 6: Commit**

```bash
git add -u
git commit -m "chore: delete VisibilityTab and orphaned panel components"
```

---

## Task 9: Final Verification

- [ ] **Step 1: Full build check**

Run: `npm run check`
Expected: No new errors beyond pre-existing ones.

- [ ] **Step 2: Search for dead references**

Search for: `ViewerSettingsModal`, `VisibilityTab`, `onSettingsOpen`, `settingsModalOpen` — ensure zero hits in source files.

- [ ] **Step 3: Verify on mobile viewport**

Check that:
- Header is clean (title only + admin-only Copy for Claude)
- Bottom toolbar has two rows: actions + BPM chip
- Copy Link and Props buttons work
- Canvas right-click menu has Display submenu
- Card right-click menu still works
- Settings module no longer has Visibility tab
