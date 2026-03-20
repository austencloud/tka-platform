# Choreo Card Context Menu Redesign

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the 17-item flat context menu into 5 top-level items and move the dark/light toggle to a lightbulb button in both viewer headers.

**Architecture:** The context menu builder (`ChoreoCardContextMenuBuilder.ts`) restructures its output to nest Include + Footer toggles under a single "Display" submenu. The dark/light toggle is removed from the menu entirely and replaced by a lightbulb button added to both `SequenceViewerDrawerHost.svelte` (drawer header) and `RouteViewerHeader.svelte` (route header). The orchestrator already exposes `handleUnifiedDarkModeToggle` and `imgDarkMode`.

**Tech Stack:** Svelte 5, TypeScript, existing ContextMenu component (already supports `children` for submenus)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/shared/sequence-viewer/components/choreo-card-context-menu/ChoreoCardContextMenuBuilder.ts` | Modify | Nest Include + Footer toggles under "Display" submenu, remove theme toggle |
| `src/lib/shared/sequence-viewer/components/choreo-card-context-menu/ChoreoCardContextMenuHost.svelte` | Modify | Remove darkMode/setDarkMode from deps passed to builder |
| `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte` | Modify | Add lightbulb button to drawer header actions |
| `src/routes/sequence/[id]/RouteViewerHeader.svelte` | Modify | Add lightbulb button to route header actions |

No new files. No test files (visual UI change — "you'll see if it's broken").

---

## Chunk 1: Restructure the Context Menu

### Task 1: Collapse Include + Footer into Display submenu and remove theme toggle

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/choreo-card-context-menu/ChoreoCardContextMenuBuilder.ts`

- [ ] **Step 1: Restructure `buildChoreoCardContextMenuItems` to use a Display submenu**

Replace the flat Include header + 4 toggles + Footer header + 3 toggles + theme toggle with a single "Display" submenu item whose `children` contains all 7 toggles. Remove the theme toggle entirely.

```typescript
export function buildChoreoCardContextMenuItems(
  deps: ChoreoCardContextMenuDeps
): ContextMenuEntry[] {
  const displayChildren: ContextMenuItem[] = [
    {
      id: "toggle-word",
      label: "Word",
      icon: "fa-font",
      checked: deps.showWord,
      keepOpen: true,
      action: () => deps.setShowWord(!deps.showWord),
    },
    {
      id: "toggle-start",
      label: "Start Position",
      icon: "fa-play",
      checked: deps.includeStartPosition,
      keepOpen: true,
      action: () => deps.setIncludeStartPosition(!deps.includeStartPosition),
    },
    {
      id: "toggle-difficulty",
      label: "Difficulty",
      icon: "fa-signal",
      checked: deps.showDifficulty,
      keepOpen: true,
      action: () => deps.setShowDifficulty(!deps.showDifficulty),
    },
    {
      id: "toggle-step-numbers",
      label: "Step Numbers",
      icon: "fa-list-ol",
      checked: deps.showStepNumbers,
      keepOpen: true,
      action: () => deps.setShowStepNumbers(!deps.showStepNumbers),
    },
    {
      id: "toggle-creator-name",
      label: "Creator Name",
      icon: "fa-user",
      checked: deps.showCreatorName,
      keepOpen: true,
      action: () => deps.setShowCreatorName(!deps.showCreatorName),
    },
    {
      id: "toggle-notes",
      label: "Notes",
      icon: "fa-sticky-note",
      checked: deps.showNotes,
      keepOpen: true,
      action: () => deps.setShowNotes(!deps.showNotes),
    },
    {
      id: "toggle-birthday",
      label: "Birthday",
      icon: "fa-cake-candles",
      checked: deps.showBirthday,
      keepOpen: true,
      action: () => deps.setShowBirthday(!deps.showBirthday),
    },
  ];

  const items: ContextMenuEntry[] = [
    // ── Display submenu (all visibility toggles) ──
    {
      id: "display-submenu",
      label: "Display",
      icon: "fa-eye",
      children: displayChildren,
    },

    // ── Columns submenu ──
    {
      id: "columns-submenu",
      label: "Columns",
      icon: "fa-table-columns",
      children: buildColumnChildren(deps.columnCount, deps.setColumnCount),
    },
  ];

  // ── Actions ──
  if (deps.onEditNotes || deps.onExportImage || deps.onSendTo) {
    items.push({ type: "separator" as const });

    if (deps.onEditNotes) {
      items.push({
        id: "edit-notes",
        label: "Edit Notes Text\u2026",
        icon: "fa-pen",
        action: deps.onEditNotes,
      });
    }

    if (deps.onExportImage) {
      items.push({
        id: "export-image",
        label: "Download Image",
        icon: "fa-download",
        action: deps.onExportImage,
      });
    }

    if (deps.onSendTo) {
      items.push({
        id: "send-to",
        label: "Send to\u2026",
        icon: "fa-paper-plane",
        action: deps.onSendTo,
      });
    }
  }

  return items;
}
```

- [ ] **Step 2: Remove `darkMode` and `setDarkMode` from `ChoreoCardContextMenuDeps`**

Remove these two fields from the interface:
```typescript
// REMOVE from ChoreoCardContextMenuDeps:
// darkMode: boolean;
// setDarkMode: (v: boolean) => void;
```

- [ ] **Step 3: Verify build compiles**

Run: `npm run check`
Expected: Type errors in `ChoreoCardContextMenuHost.svelte` (still passing removed fields). That's expected — we fix it in Task 2.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/choreo-card-context-menu/ChoreoCardContextMenuBuilder.ts
git commit -m "refactor(context-menu): collapse display toggles into submenu, remove theme toggle"
```

---

### Task 2: Update ChoreoCardContextMenuHost to stop passing dark mode deps

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/choreo-card-context-menu/ChoreoCardContextMenuHost.svelte`

- [ ] **Step 1: Remove `darkMode` and `setDarkMode` from both builder call sites**

In the export mode branch (~line 59), remove:
```typescript
// REMOVE: darkMode: exportOptions.imageDarkMode,
// REMOVE: setDarkMode: (v) => exportOptions.setImageDarkMode(v),
```

In the normal mode branch (~line 89), remove:
```typescript
// REMOVE: darkMode: comp.darkMode,
// REMOVE: setDarkMode: (v) => comp.setDarkMode(v),
```

- [ ] **Step 2: Verify build compiles cleanly**

Run: `npm run check`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/choreo-card-context-menu/ChoreoCardContextMenuHost.svelte
git commit -m "refactor(context-menu): remove dark mode deps from host"
```

---

## Chunk 2: Add Lightbulb Button to Both Headers

### Task 3: Add lightbulb button to drawer viewer header

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte`

The drawer header is rendered inline in `SequenceViewerDrawerHost.svelte` around line 257. In the normal viewer mode (non-export) branch, there's a `.drawer-header-actions` div containing the link copy button and settings gear button. Add the lightbulb button before those two.

- [ ] **Step 1: Add lightbulb button to drawer header actions**

In the normal viewer header branch (the `{:else}` block starting around line 241), inside the `.drawer-header-actions` div (around line 257), add the lightbulb button BEFORE the existing copy-link and gear buttons:

```svelte
<div class="drawer-header-actions">
  <!-- Dark/Light mode toggle - lightbulb -->
  <button
    type="button"
    class="header-action-btn lamp-btn"
    class:lit={!ctx.imgDarkMode}
    onclick={ctx.handleUnifiedDarkModeToggle}
    aria-label={ctx.imgDarkMode ? "Switch to light mode" : "Switch to dark mode"}
    title={ctx.imgDarkMode ? "Light mode" : "Dark mode"}
  >
    <i class="fas fa-lightbulb" aria-hidden="true"></i>
  </button>
  <button ...existing copy link button... />
  <button ...existing gear button... />
</div>
```

- [ ] **Step 2: Add lamp button styles**

Add these styles to the `<style>` block in `SequenceViewerDrawerHost.svelte`. The `.lamp-btn` class extends `.header-action-btn` (which is already styled in this file) with glow effects when lit:

```css
/* Lightbulb toggle — unlit (dark mode active) */
.lamp-btn {
  transition: background 150ms ease, color 150ms ease, box-shadow 150ms ease;
}

/* Lit state — light mode active, bulb glows */
.lamp-btn.lit {
  color: #ffd966;
  background: linear-gradient(145deg, rgba(255, 220, 100, 0.2), rgba(255, 180, 50, 0.1));
  box-shadow: 0 0 12px rgba(255, 200, 80, 0.25);
}

.lamp-btn.lit i {
  filter: drop-shadow(0 0 4px rgba(255, 200, 80, 0.7));
}

.lamp-btn.lit:hover {
  background: linear-gradient(145deg, rgba(255, 220, 100, 0.3), rgba(255, 180, 50, 0.2));
  box-shadow: 0 0 16px rgba(255, 200, 80, 0.35);
}
```

Also add reduced-motion override — find the existing `@media (prefers-reduced-motion: reduce)` block and add `.lamp-btn` to it:

```css
@media (prefers-reduced-motion: reduce) {
  /* ...existing rules... */
  .lamp-btn {
    transition: none;
  }
}
```

- [ ] **Step 3: Verify build compiles**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte
git commit -m "feat(viewer): add lightbulb dark/light toggle to drawer header"
```

---

### Task 4: Add lightbulb button to route viewer header

**Files:**
- Modify: `src/routes/sequence/[id]/RouteViewerHeader.svelte`

The route header already receives `darkMode` and `onDarkModeToggle` as props (lines 12-13, 17) but doesn't render a lightbulb button. Add one to the `.header-right` div in the normal viewer branch.

- [ ] **Step 1: Add lightbulb button to route header actions**

In the normal viewer header branch (the `{:else}` block starting at line 82), inside the `.header-right` div (around line 117), add the lightbulb button BEFORE the existing copy-link and gear buttons:

```svelte
<div class="header-right">
  <!-- Dark/Light mode toggle - lightbulb -->
  <button
    type="button"
    class="header-action-btn lamp-btn"
    class:lit={!darkMode}
    onclick={onDarkModeToggle}
    aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
    title={darkMode ? "Light mode" : "Dark mode"}
  >
    <i class="fas fa-lightbulb" aria-hidden="true"></i>
  </button>
  <button ...existing copy link button... />
  <button ...existing gear button... />
</div>
```

- [ ] **Step 2: Add lamp button styles**

Add the same lamp styles to this component's `<style>` block (scoped styles — each component needs its own copy per Svelte convention):

```css
/* Lightbulb toggle — unlit (dark mode active) */
.lamp-btn {
  transition: background 150ms ease, color 150ms ease, box-shadow 150ms ease;
}

/* Lit state — light mode active, bulb glows */
.lamp-btn.lit {
  color: #ffd966;
  background: linear-gradient(145deg, rgba(255, 220, 100, 0.2), rgba(255, 180, 50, 0.1));
  box-shadow: 0 0 12px rgba(255, 200, 80, 0.25);
}

.lamp-btn.lit i {
  filter: drop-shadow(0 0 4px rgba(255, 200, 80, 0.7));
}

.lamp-btn.lit:hover {
  background: linear-gradient(145deg, rgba(255, 220, 100, 0.3), rgba(255, 180, 50, 0.2));
  box-shadow: 0 0 16px rgba(255, 200, 80, 0.35);
}
```

Also add reduced-motion override:

```css
@media (prefers-reduced-motion: reduce) {
  /* ...existing rules... */
  .lamp-btn {
    transition: none;
  }
}
```

- [ ] **Step 3: Verify full build**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/routes/sequence/[id]/RouteViewerHeader.svelte
git commit -m "feat(viewer): add lightbulb dark/light toggle to route header"
```

---

## Verification

After all tasks are complete, the user should verify:

1. **Right-click the choreo card** — menu should show: Display (submenu), Columns (submenu), separator, Edit Notes, Download Image, Send to. No theme toggle.
2. **Hover "Display"** — submenu should show 7 toggles: Word, Start Position, Difficulty, Step Numbers, Creator Name, Notes, Birthday. All with checkmarks.
3. **Lightbulb button** should appear in the header (both drawer and route views), before the copy-link and gear buttons.
4. **Click lightbulb** — card and animation should toggle between light and dark mode. Button should glow warm yellow when lit (light mode).
5. **Export mode** — entering export mode should still have its own dark mode toggle in the export panel. The lightbulb controls the viewer/composition dark mode, not the export-specific one.
