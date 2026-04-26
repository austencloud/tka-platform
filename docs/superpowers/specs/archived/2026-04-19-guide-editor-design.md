---
title: TKA Guide In-Browser Editor
date: 2026-04-19
status: design approved (brainstorming complete), implementation plan pending
audience: implementer
related:
  - PDF→HTML conversion of Level 1 Guide (47 pages, in flight)
  - Existing PictographRenderer, Step Editor, Sequence Actions panel, Save-to-Library dialog
---

# TKA Guide In-Browser Editor — Design

## 1. Context & Goals

We are converting the 47-page Level 1 PDF guide (authored in Adobe Illustrator) to editable HTML. The goal: ship an HTML version of Level 1 within ~1 month, with iterative improvements after.

The naive path (artboard PNGs embedded in Svelte pages) failed: pages did not match the original style, decorative artwork was missing, text was duplicated, layouts drifted. We are now rebuilding every page from scratch as positioned HTML with baked pictograph assets.

**Hand-rebuilding 47 pages by editing `.svelte` source files is the bottleneck.** Each text frame, each pictograph placement, each per-instance visibility tweak requires a code edit. This document specifies the in-browser WYSIWYG editor that removes that bottleneck, modeled loosely after Adobe InDesign but specialized for TKA pictographs and sequences.

### Success criteria

- Austen can rebuild any page of the guide without editing `.svelte` files for content changes (text, image placement, image settings).
- Layout decisions (page-specific structural quirks like the TOC's two-column rule, the Grid page's diagram sidebar, the Type 2 Shifts page's pictograph rows) remain in code where they belong.
- Inline text edits hot-reload in <1s.
- Asset placement is intuitive (drag from library, drop on page, drag to reposition, resize from corners).
- Per-instance visibility toggles, prop swaps, and motion edits work without leaving the editor.
- All edits autosave; nothing is lost on crash.
- Output is committed `.svelte` files + JSON sidecars in the repo — no separate CMS database.

### Non-goals

- Mobile editing (desktop only).
- Multi-user real-time collaboration.
- Editing the Svelte template structure itself (you still drop into VS Code for layout/CSS changes).
- Public-facing reader features (the read-only render at `/guide/level-1` already exists and stays).
- Generic "any HTML page" editing — this is purpose-built for TKA guide pages.

## 2. Architecture

### 2.1 Three-route surface

| Route | Purpose | State |
|---|---|---|
| `/guide/level-1` | Public read-only render | Exists |
| `/guide/level-1/compare` | Side-by-side parity check vs original PDF | Exists |
| `/guide/level-1/edit` | **In-browser editor** | New, this spec |

`/edit` is admin-only (gated by Firebase auth check for Austen's UID).

### 2.2 Per-page data model — hybrid template + JSON sidecar

Each page is the pair:

- **`src/routes/(public)/guide/level-1/_pages/Page<NN><Slug>.svelte`** — Svelte template. Defines layout, decorative elements, color rules, page-specific structure. Imports its sidecar JSON. Read-only at editor runtime; only changed via VS Code.
- **`src/routes/(public)/guide/level-1/_data/page-<NN>.json`** — sidecar. Holds editable text strings (TipTap JSON for rich text), `placedAssets[]` array, per-asset overrides. Mutated by the editor; written to disk by the autosave endpoint.

Templates wrap each text region with `<EditableText>` and add a single `<PlacedAssetsLayer>` overlay for positioned assets:

```svelte
<!-- Example: Page05TableOfContents.svelte -->
<script lang="ts">
  import data from '../_data/page-05.json';
  import PageFrame from '../_lib/PageFrame.svelte';
  import EditableText from '../_lib/EditableText.svelte';
  import PlacedAssetsLayer from '../_lib/PlacedAssetsLayer.svelte';
</script>

<PageFrame pageNumber={5}>
  <EditableText value={data.text.header} field="text.header" class="page-title" />
  <div class="toc-grid">
    <div class="col">
      <EditableText value={data.text.col1Chapter} field="text.col1Chapter" class="chapter" />
      <EditableText value={data.text.col1Entries} field="text.col1Entries" class="entries" />
    </div>
    <div class="rule"></div>
    <div class="col">...</div>
  </div>
  <PlacedAssetsLayer assets={data.placedAssets} pageNumber={5} />
</PageFrame>
```

Layout decisions (the two-column grid, the vertical rule, the column gap, the typography) stay in the `.svelte` file. Content (text strings, image placements, per-instance overrides) lives in JSON.

`<EditableText>` is a component, not a slot. In editor mode it mounts a TipTap instance bound to the `field` path; in read mode it renders the TipTap JSON to static HTML. `<PlacedAssetsLayer>` is a single absolutely-positioned overlay that fills the page; in editor mode each asset is a draggable wrapper, in read mode each is a positioned `<img>`.

### 2.3 JSON sidecar shape

```typescript
type PageSidecar = {
  pageNumber: number;
  text: Record<string, TipTapJSONDoc>; // keyed by `field` paths
  placedAssets: PlacedAsset[];
};

type PlacedAsset = {
  id: string;             // stable UUID
  type: 'pictograph' | 'sequence';
  libraryId?: string;     // ref into Guide Library (sequences) or null (in-editor pictographs)
  sourceData: any;        // beat-data for the pictograph or sequence (canonical)
  position: { x: number; y: number; unit: 'px' | 'pct' }; // relative to container
  size: { width: number; height: number; unit: 'px' | 'pct' };
  rotation?: number;      // degrees, default 0
  zIndex?: number;        // default insertion order
  overrides: {
    visibility?: Partial<PictographVisibilityOptions>; // per-instance toggle overrides
    columnsOverride?: number; // sequences only
    propOverride?: PropType; // override the prop on this instance
    cardOptions?: Partial<ChoreoCardOptions>; // per-instance card overrides
  };
  bake: {
    path: string;         // /guide/level-1/baked/<id>.svg
    stale: boolean;       // true when sourceData/overrides have changed since last bake
    lastBakedAt: number;  // unix ms
  };
};
```

### 2.4 Persistence

- **Autosave endpoint:** `POST /api/guide/level-1/page/[n]` accepts the full sidecar JSON, validates against schema, writes to disk via Node `fs.promises.writeFile`. Atomic write (write to `.tmp` then rename).
- **Trigger:** every edit pushes a snapshot to the in-memory undo stack and schedules a debounced save (800ms after last edit).
- **Save indicator:** bottom-right of the editor shows `Saved 2s ago` (green) / `Saving…` (yellow) / `Save failed — retry` (red, with click-to-retry).
- **Hot-reload:** Vite watches the JSON files; the editor route reloads the rendered page on JSON change. Sub-second feedback loop.
- **Undo stack:** in-memory array of `PageSidecar` snapshots, capped at 50. Ctrl+Z pops, replaces sidecar, fires save. Text edits inside a focused TipTap field use TipTap's own undo (Ctrl+Z) until the field blurs; on blur, the resulting text is the next snapshot.
- **Repo writes:** the autosave endpoint only writes to `_data/page-*.json` and `static/guide/level-1/baked/*`. Never touches `.svelte` files. Never touches git directly.

### 2.5 Bake pipeline

When an asset is placed, dropped, or has its overrides changed:

1. Editor marks `bake.stale = true` in the sidecar.
2. UI shows a `↻ stale` badge on the asset.
3. User clicks "Bake" (per-asset button in the inspector) OR "Bake all stale" (page-level button).
4. Server endpoint `POST /api/guide/level-1/bake` accepts `{assetId, sourceData, overrides}`, calls the existing `generate_pictograph` / `generate_sequence` MCP tooling server-side, writes the resulting SVG to `static/guide/level-1/baked/<id>.svg`, updates `bake.path` + `bake.lastBakedAt` + `bake.stale = false`.
5. The page re-renders with the fresh image (Vite picks up the new file).

Baking is explicit, not automatic, because:
- It's slow (~500ms per pictograph, longer for sequences).
- During a editing session the user often makes many overrides in succession; baking after each one wastes work.
- "Bake all stale" gives explicit control over when the visual state catches up to the data state.

For first placement (no bake yet), the placeholder shows a loading spinner until the first bake completes.

## 3. Editor Surface (`/edit` route)

### 3.1 Three-region layout

```
┌──────────┬──────────────────────────┬──────────┐
│ LEFT     │ CENTER                   │ RIGHT    │
│          │                          │          │
│ Page nav │ Editable page canvas     │ Library  │
│ (47      │ (one page at a time,     │ (top)    │
│ entries) │ scrolls vertically)      │          │
│          │                          │          │
│ Collap-  │                          ├──────────┤
│ sible    │                          │          │
│          │                          │ Inspector│
│ PDF ref  │                          │ (bottom) │
│ slide-   │                          │          │
│ over     │                          │          │
│          │                          │          │
└──────────┴──────────────────────────┴──────────┘
  240px       1fr (≥600px page width)    320px
```

- **Left region (240px):** vertical list of all 47 pages. Click to jump. Active page highlighted. Bottom of left region: collapsible PDF reference slide-over (button toggles a 600px-wide overlay showing the original PDF page side-by-side with the editor canvas).
- **Center region (1fr):** the page being edited, rendered at actual size (8.5in × 11in). Pan/zoom via Cmd+scroll. Background is dark gray to make the white page pop.
- **Right region (320px):** vertical split between Library (top, ~60%) and Inspector (bottom, ~40%). Draggable horizontal divider between them.

### 3.2 Top bar

- Page number + label
- Bake all stale (button, count badge)
- Save status (text indicator)
- Undo / Redo buttons
- Toggle PDF reference slide-over
- Exit editor → returns to `/compare`

## 4. Text Editing — TipTap

Each editable text region is a Svelte component (`<EditableText>`) that mounts a TipTap instance bound to a sidecar field path.

### 4.1 TipTap configuration

- **Document type:** single-paragraph or multi-paragraph depending on field schema.
- **Extensions enabled:**
  - `Document`, `Paragraph`, `Text`, `History` (undo/redo)
  - `Bold`, `Italic`, `Underline`
  - `TextStyle` + `Color` (for the type-color marks: Dual-Shift blue, Shift purple, Cross-Shift green, Dash green, Dual-Dash teal, Static orange, plus arbitrary user-picked colors)
  - `Link` (for URLs like the TheKineticAlphabet.com footer)
  - `Highlight` (for editor's-eye-only highlights, optional)
  - **No** Heading, BulletList, OrderedList, Table — those are page-template structural concerns
- **Inline toolbar:** appears on text selection (Medium-style floating toolbar) with: B / I / U / Color picker / Link / Clear formatting.
- **Type Color picker:** swatch grid showing the 6 TKA type colors as named presets, plus a custom hex input. Applies as a `<span style="color: ...">` mark.
- **Paste handling:** TipTap's default paste sanitization. Strip Adobe/Word styles. Preserve only allowed marks.

### 4.2 Field paths

Each `<EditableText field="text.header">` reads/writes `sidecar.text.header`. The sidecar `text` object is freeform — fields exist as the templates reference them.

For consistency, naming convention: `text.<region>` where `<region>` matches a slot name in the template. Example: `text.col1Chapter`, `text.col1Entries`, `text.footerUrl`.

## 5. Asset Pipeline

### 5.1 Two ingestion paths

**Sequences** enter the Guide Library via the existing app's Save-to-Library dialog:
- Add a **third button**: "Save to Guide" (admin-only, conditionally rendered based on Firebase UID).
- Clicking saves the sequence to a separate Guide Library collection.
- Default `instancesAvailable: 1`. Each placement decrements `instancesAvailable` and increments `instancesPlaced`.
- When `instancesAvailable === 0`, the sequence is hidden from the editor's Library browse view (still placeable via right-click → "Add copy to pool" on the entry).

**Pictographs** are created in the editor's right sidebar via the Pictograph Picker mode:
- No app-side export. Picker is the only path.
- Workflow: select Pictograph mode → letter selector grid (all 47 letters) → variation grid (all variations of that letter) → settings panel (turn count, prop, orientation, etc.) → "Place" button drops onto canvas centered.
- Picker reuses the existing `PictographPicker` component from the platform (already exists; just mount it in the sidebar).

### 5.2 Guide Library storage

Initial implementation: `static/guide/level-1/library.json` (a flat array of `LibraryEntry` records). Simple, version-controlled, no Firestore dependency.

```typescript
type LibraryEntry = {
  id: string;
  type: 'sequence';
  sourceData: SequenceData; // full beat data
  thumbnail: string;        // /guide/level-1/library-thumbs/<id>.png
  tags: string[];           // 'short', 'long', 'loop-rotated', etc. — auto-derived
  createdAt: number;
  instancesAvailable: number;
  instancesPlaced: number;
  placedOn: { pageNumber: number; assetId: string }[]; // back-references
};
```

Pictographs are NOT in the library — they're generated on-demand in the editor and live only in the page sidecars.

### 5.3 Library browse UI

Top region of right sidebar.

- **Mode toggle (top of region):** `[Sequences]` `[Pictograph Picker]`
- **Sequences mode:**
  - Filter chips: All / Short (≤4 beats) / Long (5+ beats) / Loop / By Letter
  - Grid of thumbnails, 2 columns. Each tile shows: thumbnail, length, instance count badge (e.g., "1 left").
  - Hover tile: tooltip with full sequence preview.
  - Drag a tile onto the canvas to place. Drop position becomes the asset's initial `position`.
  - Right-click a tile: context menu with "Add copy to pool", "Open in main app", "Remove from Guide Library".
- **Pictograph Picker mode:**
  - Mounts existing `<PictographPicker>` component.
  - Place button drops a fresh pictograph asset onto the canvas at the page center.

### 5.4 Inspector behavior

Bottom region of right sidebar. Reactive to canvas selection.

- **Nothing selected:** empty state with "Select an asset to inspect" text + small page-level controls (page background color, zoom, etc.).
- **Pictograph selected:** mounts existing `<StepEditor>` component (from main app), bound to the asset's `sourceData` + `overrides`. All the platform's pictograph editing capabilities work in place. Edit → asset's bake.stale becomes true.
- **Sequence selected:** mounts existing `<SequenceActionsPanel>` component, bound similarly. Plus extra inputs unique to placement: `columnsOverride`, `position` numeric inputs, `size` numeric inputs.
- **Multiple selected (future):** alignment tools. Out of scope for v1.

The Inspector embeds existing components — they are not rebuilt. Glue code wires the components' callbacks to update the sidecar JSON.

### 5.5 Per-instance overrides

Every visibility option, prop, card option that the platform supports as a global setting can be overridden per-instance in the inspector.

The `overrides` object on each placed asset shadows the global default. When baking, the bake endpoint computes the effective settings as `{ ...globalDefaults, ...overrides }` and renders accordingly. Empty `overrides` means "use global defaults for this asset."

## 6. Drag, Place, Resize — interact.js

### 6.1 Library → canvas placement

Library tiles are draggable via interact.js (`draggable({ inertia: false, modifiers: [...] })`). On drop:

1. `dragend` event fires, library reads drop coordinates.
2. Coordinates are translated to canvas-relative position.
3. New `PlacedAsset` is appended to `sidecar.placedAssets[]` with default size and the drop position.
4. Decrement `instancesAvailable` on the library entry.
5. Mark `bake.stale = true`, fire bake (or queue if multiple drops happening).

Drag preview = thumbnail at 50% opacity following the cursor (interact.js cloneable preview).

### 6.2 Canvas asset reposition + resize

Each placed asset on the canvas is wrapped in a `<DraggableAsset>` component. interact.js doesn't have a Svelte directive natively, so we expose it via a small `use:interact` action wrapper that runs `interact(node).draggable(...).resizable(...)` on mount and tears down on unmount:

```svelte
<div
  use:interact={{
    draggable: { listeners: { move: onDragMove, end: onDragEnd } },
    resizable: { edges: { left: true, right: true, top: true, bottom: true }, listeners: { /* ... */ } }
  }}
  style:position="absolute"
  style:left={asset.position.x + 'px'}
  style:top={asset.position.y + 'px'}
  style:width={asset.size.width + 'px'}
  style:height={asset.size.height + 'px'}
>
  <img src={asset.bake.path} alt="" />
  {#if selected}
    <SelectionHandles />
  {/if}
</div>
```

- **Drag:** moves asset; `dragend` updates `position` in sidecar.
- **Resize:** corner + edge handles; `resizeend` updates `size`. Aspect ratio locked when Shift held.
- **Snap:** snap to grid (default 8px grid, configurable per page). Snap to other placed assets' edges (alignment guides). Snap to page margins.
- **Selection:** click selects single, Shift+click adds to selection (future), click empty canvas deselects.

### 6.3 Right-click context menus

Implemented via a single `<ContextMenu>` component that listens to `contextmenu` events on registered targets.

| Target | Menu items |
|---|---|
| Placed asset | Edit (focuses Inspector), Duplicate, Delete, Bring Forward, Send Back, Reset Position, Toggle Visibility ▸ submenu |
| Empty canvas | Paste, Page Settings, Bake All Stale |
| Library tile | Add Copy to Pool, Open in Main App, Remove from Library |
| Text region (focused) | Cut, Copy, Paste, Apply Type Color ▸ submenu (with the 6 TKA color presets) |

## 7. Save & Undo Mechanics

### 7.1 Autosave

- **Debounce:** 800ms after last edit.
- **Atomic write:** write to `<file>.tmp`, then `fs.rename` to final path.
- **Conflict handling:** if write fails (file in use, disk error), surface "Save failed" with retry button. Don't silently swallow.
- **Endpoint:** `POST /api/guide/level-1/page/[n]` with body = full sidecar JSON. Schema-validated server-side.

### 7.2 Undo stack

- In-memory `Array<PageSidecar>`, capped at 50.
- Each "edit operation" pushes the resulting sidecar onto the stack. Operations are coalesced if same field within 1s (TipTap-style).
- `Ctrl+Z` pops top, replaces current sidecar, fires save.
- `Ctrl+Shift+Z` redoes (separate redo stack).
- Stack clears on page navigation (each page has its own undo history).

### 7.3 Hot-reload coordination

Editor maintains an in-memory copy of the sidecar (the "live" state). Vite reloading the JSON does NOT clobber in-flight edits — the live state is what the editor uses; Vite's reload only matters for OTHER tabs / processes viewing the same page.

For first load: editor fetches the sidecar via dynamic import. After mounting, Vite HMR is ignored (the live state is canonical until next save).

## 8. Migration Path — existing 47 pages

Each existing `Page<NN><Slug>.svelte` needs to be split into template + sidecar.

### 8.1 One-time migration script

A Node script (`scripts/migrate-guide-pages.cjs`) iterates over the 47 page files, extracts:
- Hardcoded text strings → `text.<auto-named-key>` in sidecar JSON
- `<HybridPage figureSrc="...">` references → `placedAssets` entries with the existing PNG path
- Static structural HTML → unchanged in template

Migrated templates wrap text strings with `<EditableText field="text.<key>">` and replace static asset markup with `<PlacedAssets>`.

The migration is one-shot, reviewed visually, then committed.

### 8.2 Page 5 (TOC) is a special case

Page 5 was rebuilt from scratch with hand-crafted layout. The migration script either:
- (a) Parses the static text in Page 5 into sidecar fields automatically.
- (b) We hand-migrate Page 5 first, use it as the canonical example for the script.

Pick (b) — Page 5 is the prototype.

## 9. Out of Scope (v1)

- Multi-page operations (copy element to another page, batch edits across pages).
- Asset alignment guides (just snap to grid for now).
- Multiple selection.
- Spell check inside TipTap.
- Page reordering / insertion / deletion (still a code edit).
- Print stylesheet (Paged.js) — separate spec.
- Real-time collaboration.
- Mobile editing.
- Undo for bake operations (bakes are explicit; if you bake the wrong thing, manually re-bake).

## 10. Tech Dependencies

| Dependency | Purpose | Size (gzipped) |
|---|---|---|
| `@tiptap/core` + `@tiptap/starter-kit` + `@tiptap/extension-color` + `@tiptap/extension-text-style` + `@tiptap/extension-link` | Inline rich text editing | ~80kb |
| `interactjs` | Drag, resize, snap | ~30kb |
| (existing) `PictographPicker`, `StepEditor`, `SequenceActionsPanel`, `PictographRenderer`, `generate_pictograph` MCP, `generate_sequence` MCP | Asset creation + editing | n/a |

Total new dependencies: ~110kb gzipped, loaded only on `/edit` route (not bundled into the public reader).

## 11. Phased Implementation

The implementation plan (separate document) will phase as:

- **Phase 1 — Foundation:** sidecar JSON schema, `<EditableText>` + `<PlacedAssets>` primitives, `/edit` route shell, autosave endpoint, undo stack. Page 5 manually migrated as the canonical example. No drag yet; positions are numeric inputs in the inspector.
- **Phase 2 — Drag & Resize:** interact.js wired up, drop-from-library, reposition, resize, snap. Library browse mode (sequences). Save-to-Guide button in main app.
- **Phase 3 — Inspector & Picker:** Mount existing StepEditor and SequenceActionsPanel. Pictograph Picker mode in library region. Per-instance overrides bound to inspector controls.
- **Phase 4 — Bake pipeline:** server endpoint to invoke MCP tooling, stale flags, bake-all button, regeneration on override changes.
- **Phase 5 — Migration:** migration script, run against remaining 46 pages, visual review.
- **Phase 6 — Polish:** right-click context menus, alignment guides, keyboard shortcuts, save indicator UX.

Each phase is independently shippable. Phase 1+2+3 alone unlocks editing for hand-migrated pages. Phase 5 scales it to all 47.

## 12. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| TipTap + Svelte 5 runes integration is fiddly | Wrap TipTap in a Svelte 5 component with `$effect` for binding; existing community wrappers exist. |
| interact.js sometimes fights reactive frameworks | Use `$effect.root()` to scope interact.js lifecycle; clean up handlers on unmount. |
| Existing StepEditor/SequenceActionsPanel may have implicit dependencies on a sequence context that's hard to isolate | Audit dependencies in Phase 3; may need a thin "guide-mode" wrapper component for each. |
| Bake performance for sequences with many beats | Bake on explicit user action only (not auto). Show progress indicator for bakes >2s. |
| Migration script may garble page 5's hand-crafted styling | Use page 5 as the test case; iterate the script until it round-trips correctly. |
| JSON sidecars create merge conflicts with parallel edits | Single-author tool; conflicts unlikely in practice. If they occur, it's a manual `git diff` resolution. |

## 13. Decision Log (from brainstorming)

1. **Data model: hybrid** (Svelte template + JSON sidecar). Locked.
2. **Asset pipeline: hybrid Z** (sourceData + cached baked image, regenerate on override change). Locked.
3. **Editor surface: new `/edit` route with collapsible PDF reference**. Locked.
4. **Inline text editor: TipTap**. Locked.
5. **Drag/resize: interact.js**. Locked.
6. **Save: debounced autosave + in-memory undo snapshot stack**. Locked.
7. **Right sidebar: Library (top) + Inspector (bottom), draggable divider**. Locked.
8. **Sequence ingestion: Save-to-Guide button in main app's Save dialog (admin-only)**. Locked.
9. **Pictograph ingestion: in-editor Pictograph Picker mode, no app export**. Locked.
10. **Instance pool tracking: sequences default to 1 instance, decrement on placement, right-click to add copies**. Locked.
11. **Inspector for placed pictograph: existing StepEditor component**. Locked.
12. **Inspector for placed sequence: existing SequenceActionsPanel + extra placement controls**. Locked.
13. **Per-instance column count override for sequences**. Locked.
14. **Right-click context menus throughout**. Locked.
