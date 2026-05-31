# Inline Print Panel + Deck Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Deck Releaser print modal with a two-mode (Browse/Print) right sidebar that keeps the live preview visible and scopes it to the selected side; add deck deletion.

**Architecture:** The 320px right sidebar (`ReleaseHistoryPanel`) becomes a two-mode panel switched by `SegmentedControl`. Browse = released-decks list + Release button; Print = the relocated `PrintDialog` body. Print state, the element-sort, and print handlers lift from `ReviewStep` to `DeckReleaserTab` (one owner) so both the preview pane and the sidebar panel read one source of truth. Sidebar width becomes fluid. Deletion uses an inline two-step confirm on each release row, backed by a new `deleteDeck` store function.

**Tech Stack:** Svelte 5 runes, SvelteKit, Firestore (`firebase/firestore`), Vitest, pdf-lib (existing pipeline, untouched).

**Spec:** `docs/superpowers/specs/2026-05-30-inline-print-panel-design.md`

---

## Conventions for every component task

- Verification gate per task: `npm run check` must report **no new errors in files this task touched** (capture once to a log, grep it — never re-run to re-filter). Pre-existing errors in untouched files (`DeckReleaserTab` `hashDeckContent` typing, `Viewer3DScene`, missing-module stubs) are NOT yours; leave them.
- Commit with an explicit pathspec listing ONLY the files the task changed: `git commit -m "…" -- <files>`. Never a bare `git commit`.
- No `<input type="checkbox">`. Toggle/segment primitives only.

---

## Task 1: `deleteDeck` store function

**Files:**
- Modify: `src/lib/features/choreo-card/services/deck-release-store.ts`
- Test: `src/lib/features/choreo-card/services/__tests__/deck-release-store.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/lib/features/choreo-card/services/__tests__/deck-release-store.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const deleteDocMock = vi.fn();
const docMock = vi.fn((_db: unknown, path: string) => ({ __path: path }));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: docMock,
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: deleteDocMock,
  runTransaction: vi.fn(),
}));

vi.mock("$lib/shared/auth/firebase", () => ({
  getFirestoreInstance: vi.fn(async () => ({ __db: true })),
}));

vi.mock("$lib/shared/library/data/firestore-paths", () => ({
  getDeckReleaseCounterPath: () => "deckReleases/counter",
  getDeckReleaseManifestPath: (n: number) => `deckReleases/counter/manifests/${n}`,
  getDeckReleaseManifestsPath: () => "deckReleases/counter/manifests",
}));

import { deleteDeck } from "../deck-release-store";

describe("deleteDeck", () => {
  beforeEach(() => {
    deleteDocMock.mockReset();
    docMock.mockClear();
  });

  it("deletes the manifest doc for the given deck number", async () => {
    await deleteDeck(7);
    expect(docMock).toHaveBeenCalledWith(
      expect.anything(),
      "deckReleases/counter/manifests/7",
    );
    expect(deleteDocMock).toHaveBeenCalledTimes(1);
    expect(deleteDocMock).toHaveBeenCalledWith({
      __path: "deckReleases/counter/manifests/7",
    });
  });

  it("does not touch the counter (numbers are permanent)", async () => {
    await deleteDeck(7);
    const touchedCounter = docMock.mock.calls.some(
      ([, path]) => path === "deckReleases/counter",
    );
    expect(touchedCounter).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/features/choreo-card/services/__tests__/deck-release-store.test.ts`
Expected: FAIL — `deleteDeck` is not exported.

- [ ] **Step 3: Add the import and function**

In `src/lib/features/choreo-card/services/deck-release-store.ts`, add `deleteDoc` to the existing `firebase/firestore` import (line 1–8):

```ts
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  runTransaction,
} from "firebase/firestore";
```

Then append, after `updateDeckMeta` (around line 83):

```ts
/**
 * Permanently delete a released deck's manifest. The release counter is left
 * untouched — deck numbers are permanent identifiers (content hashes, scan /
 * short codes, and released-id pruning all key off them), so a freed number is
 * never reused.
 */
export async function deleteDeck(deckNumber: number): Promise<void> {
  const db = await getFirestoreInstance();
  await deleteDoc(doc(db, getDeckReleaseManifestPath(deckNumber)));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/features/choreo-card/services/__tests__/deck-release-store.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/services/deck-release-store.ts src/lib/features/choreo-card/services/__tests__/deck-release-store.test.ts
git commit -m "feat(deck-releaser): add deleteDeck store function" -- src/lib/features/choreo-card/services/deck-release-store.ts src/lib/features/choreo-card/services/__tests__/deck-release-store.test.ts
```

---

## Task 2: `PrintPreviewPages` side-scoped preview

**Files:**
- Modify: `src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte`

- [ ] **Step 1: Add the `sideFilter` prop**

In the `Props` interface (after `redPropType?: PropType;`, around line 69), add:

```ts
    /**
     * Scope the sheet preview to one printed side. 'fronts' renders only the
     * fronts phase, 'backs' only the backs phase, null (default) renders both.
     * Lets the print panel show exactly what the selected Print button sends.
     */
    sideFilter?: "fronts" | "backs" | null;
```

In the destructured props (after `redPropType,`, around line 94), add:

```ts
    sideFilter = null,
```

- [ ] **Step 2: Guard the FRONTS phase**

Wrap the PHASE 1 block. Change (around line 593–595):

```svelte
      <div class="pages-scroll">
        <!-- ═══ PHASE 1: ALL FRONTS ═══ -->
        {#each sheets as sheet, sheetIndex (sheetIndex)}
```

to:

```svelte
      <div class="pages-scroll">
        <!-- ═══ PHASE 1: ALL FRONTS ═══ -->
        {#if sideFilter !== "backs"}
        {#each sheets as sheet, sheetIndex (sheetIndex)}
```

Close the `{#if}` immediately after the fronts `{#each}` ends. The fronts `{#each}` closes at line 649 (`{/each}` right before the PHASE 2 comment). Change (around line 649–651):

```svelte
        {/each}

        <!-- ═══ PHASE 2: ALL BACKS ═══ -->
        {#each sheets as sheet, sheetIndex (sheetIndex)}
```

to:

```svelte
        {/each}
        {/if}

        <!-- ═══ PHASE 2: ALL BACKS ═══ -->
        {#if sideFilter !== "fronts"}
        {#each sheets as sheet, sheetIndex (sheetIndex)}
```

- [ ] **Step 3: Close the BACKS guard**

The backs `{#each}` closes at line 713 (`{/each}` right before `</div>` that closes `.pages-scroll`). Change (around line 713–714):

```svelte
        {/each}
      </div>
    {/if}
```

to:

```svelte
        {/each}
        {/if}
      </div>
    {/if}
```

(The outer `{/if}` is the existing `displayMode === "grid"` else-branch close — leave it.)

- [ ] **Step 4: Typecheck**

Run: `npm run check > /tmp/check.log 2>&1; grep -n "PrintPreviewPages" /tmp/check.log`
Expected: no new errors referencing `PrintPreviewPages.svelte`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte
git commit -m "feat(deck-releaser): side-scope the print preview (sideFilter prop)" -- src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte
```

---

## Task 3: `PrintPanel.svelte` (extract the dialog body)

**Files:**
- Create: `src/lib/features/choreo-card/components/print-preview/PrintPanel.svelte`

This is the `.dialog-body` content from `PrintDialog.svelte` (the summary + element pills + side picker + Print/Download actions) with NO backdrop, close button, or `role="dialog"` chrome — a single-column panel that lives in the sidebar. The side selection is now controlled from the parent (`selectedSide`), not internal state, so the preview can read it.

- [ ] **Step 1: Create the component**

Create `src/lib/features/choreo-card/components/print-preview/PrintPanel.svelte`:

```svelte
<script lang="ts">
  import { getPageLayout, type CardSizeId } from "../../domain/card-sizes";
  import { TND_ELEMENTS, type TnDElement } from "../../domain/tnd-element";
  import type { PrintPDFMode } from "../../services/print-pdf-exporter";

  /** The side picker's four choices. 'zip' = card images (download only). */
  export type PrintSide = "fronts" | "backs" | "combined" | "zip";

  interface Props {
    cardCount: number;
    tndElements?: (TnDElement | undefined)[];
    cardSize: CardSizeId;
    copies?: number;
    groupByElement?: boolean;
    theme: string;
    /** Controlled side selection (lifted to the tab so the preview can scope). */
    selectedSide: PrintSide;
    onSideChange: (side: PrintSide) => void;
    isExporting: boolean;
    isPrinting?: boolean;
    exportProgress: number;
    exportTotal: number;
    exportError: string;
    onPrint: (mode: PrintPDFMode) => void;
    onExportPDF: (mode: PrintPDFMode, copies: number) => void;
    onExportZIP: () => void;
  }

  let {
    cardCount,
    tndElements = [],
    cardSize,
    copies = 1,
    groupByElement = true,
    theme,
    selectedSide,
    onSideChange,
    isExporting,
    isPrinting = false,
    exportProgress,
    exportTotal,
    exportError,
    onPrint,
    onExportPDF,
    onExportZIP,
  }: Props = $props();

  const busy = $derived(isExporting || isPrinting);
  const printable = $derived(selectedSide !== "zip");
  const layout = $derived(getPageLayout(cardSize));

  // Sheets = Σ over colors of ceil(colorCount * copies / cardsPerPage); each
  // color pads to whole sheets. Normal-fill (or untagged) → flat count.
  const sheetCount = $derived.by(() => {
    const perPage = layout.cardsPerPage;
    const tagged = tndElements.filter((e): e is TnDElement => !!e);
    if (!groupByElement || tagged.length === 0) {
      return Math.ceil((cardCount * copies) / perPage);
    }
    const counts = new Map<string, number>();
    let untagged = 0;
    for (const el of tndElements) {
      if (el) counts.set(el.element, (counts.get(el.element) ?? 0) + 1);
      else untagged++;
    }
    let sheets = 0;
    for (const c of counts.values()) sheets += Math.ceil((c * copies) / perPage);
    if (untagged) sheets += Math.ceil((untagged * copies) / perPage);
    return sheets;
  });

  const elementCounts = $derived.by(() => {
    const counts = new Map<string, { element: TnDElement; count: number }>();
    for (const el of tndElements) {
      if (!el) continue;
      const entry = counts.get(el.element);
      if (entry) entry.count++;
      else counts.set(el.element, { element: el, count: 1 });
    }
    const perPage = layout.cardsPerPage;
    return TND_ELEMENTS.filter((e) => counts.has(e.element)).map((e) => {
      const { element, count } = counts.get(e.element)!;
      return { element, count, sheets: Math.ceil((count * copies) / perPage) };
    });
  });

  const SIDE_OPTIONS: {
    id: PrintSide;
    icon: string;
    label: string;
    getDetail: () => string;
    getHint: () => string;
  }[] = [
    { id: "fronts", icon: "fa-layer-group", label: "Fronts",
      getDetail: () => `${sheetCount} sheets`,
      getHint: () => "Print these first, then flip the stack for the backs." },
    { id: "backs", icon: "fa-rotate", label: "Backs",
      getDetail: () => `${sheetCount} sheets`,
      getHint: () => "Print after the fronts. Columns mirrored for the long-edge flip." },
    { id: "combined", icon: "fa-book-open", label: "Combined",
      getDetail: () => `${sheetCount * 2 + 2} pages`,
      getHint: () => "Fronts + flip instructions + backs + finishing tips, in one file." },
    { id: "zip", icon: "fa-images", label: "Images",
      getDetail: () => `${cardCount * 2} PNGs`,
      getHint: () => "Individual files for MPC or custom layouts. Download only." },
  ];

  const selectedOption = $derived(SIDE_OPTIONS.find((f) => f.id === selectedSide)!);

  const printLabel = $derived.by(() => {
    if (isPrinting) return "Preparing…";
    switch (selectedSide) {
      case "fronts": return "Print Fronts";
      case "backs": return "Print Backs";
      case "combined": return "Print Combined";
      default: return "Print";
    }
  });

  const downloadLabel = $derived.by(() => {
    if (isExporting) {
      return exportTotal > 0 ? `Exporting ${exportProgress} / ${exportTotal}…` : "Preparing…";
    }
    return `Download ${selectedOption.label}`;
  });

  function handlePrint() {
    if (busy || !printable) return;
    onPrint(selectedSide as PrintPDFMode);
  }

  function handleExport() {
    if (busy) return;
    if (selectedSide === "zip") onExportZIP();
    else onExportPDF(selectedSide, Math.max(1, Math.floor(copies || 1)));
  }
</script>

<div class="print-panel">
  <section class="summary" aria-label="Deck summary">
    <div class="summary-row">
      <span class="summary-label">Cards</span>
      <span class="summary-value">{cardCount}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Sheets</span>
      <span class="summary-value">{sheetCount} ({layout.cols}&times;{layout.rows} per sheet)</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Copies / card</span>
      <span class="summary-value">{copies}<span class="inline-hint">toolbar</span></span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Theme</span>
      <span class="summary-value theme-badge">{theme}</span>
    </div>
  </section>

  {#if elementCounts.length > 0 && groupByElement}
    <div class="elements" aria-label="Element breakdown">
      {#each elementCounts as { element, count, sheets }}
        <div class="element-pill" style="--el-color: {element.accentColor}"
          title="{count} card{count === 1 ? '' : 's'} × {copies} = {sheets} sheet{sheets === 1 ? '' : 's'}">
          <img src={element.iconPath} alt={element.element} class="element-icon" width="16" height="16" />
          <span class="element-count">{count} · {sheets}sh</span>
        </div>
      {/each}
    </div>
  {/if}

  <h3 class="section-label">Choose a side</h3>
  <div class="side-grid" role="radiogroup" aria-label="Print side">
    {#each SIDE_OPTIONS as opt (opt.id)}
      <button class="side-card" class:selected={selectedSide === opt.id}
        role="radio" aria-checked={selectedSide === opt.id}
        onclick={() => onSideChange(opt.id)}>
        <i class="fas {opt.icon} side-icon" aria-hidden="true"></i>
        <span class="side-label">{opt.label}</span>
        <span class="side-detail">{opt.getDetail()}</span>
      </button>
    {/each}
  </div>
  <p class="side-hint">{selectedOption.getHint()}</p>

  {#if exportError}
    <div class="error" role="alert">
      <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
      {exportError}
    </div>
  {/if}

  <div class="actions">
    <button class="action print-action"
      disabled={busy || !printable || cardCount === 0}
      title={!printable ? "Card images can't be sent to a printer — download instead." : undefined}
      onclick={handlePrint}>
      {#if isPrinting}<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      {:else}<i class="fas fa-print" aria-hidden="true"></i>{/if}
      <span>{printLabel}</span>
    </button>
    <button class="action download-action" disabled={busy} onclick={handleExport}>
      {#if isExporting}<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      {:else}<i class="fas fa-download" aria-hidden="true"></i>{/if}
      <span>{downloadLabel}</span>
    </button>
  </div>

  <p class="workflow-tip">
    Print the fronts, flip your paper stack on the <strong>long edge</strong>, then print the backs.
  </p>
</div>

<style>
  .print-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    overflow-y: auto;
    min-height: 0;
  }

  .summary {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
  }

  .summary-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 28px;
  }

  .summary-label { font-size: 13px; color: rgba(255, 255, 255, 0.4); }

  .summary-value {
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.8);
    font-variant-numeric: tabular-nums;
  }

  .inline-hint { font-size: 11px; font-weight: 400; color: rgba(255, 255, 255, 0.3); }

  .theme-badge {
    text-transform: capitalize;
    padding: 2px 10px;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 6px;
    font-size: 12px;
    color: #a78bfa;
  }

  .elements { display: flex; gap: 6px; flex-wrap: wrap; }

  .element-pill {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    background: color-mix(in srgb, var(--el-color) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--el-color) 25%, transparent);
    border-radius: 20px;
  }

  .element-icon { width: 16px; height: 16px; object-fit: contain; }

  .element-count {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-color);
    font-variant-numeric: tabular-nums;
  }

  .section-label {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.3);
  }

  .side-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

  .side-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 14px 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1.5px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.5);
    font: inherit;
    cursor: pointer;
    transition: all 0.15s;
  }

  .side-card:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.7);
  }

  .side-card.selected {
    background: rgba(139, 92, 246, 0.1);
    border-color: rgba(139, 92, 246, 0.5);
    color: #fff;
  }

  .side-icon { font-size: 20px; }
  .side-card.selected .side-icon { color: #a78bfa; }
  .side-label { font-size: 13px; font-weight: 600; }
  .side-detail { font-size: 11px; font-weight: 400; opacity: 0.6; font-variant-numeric: tabular-nums; }

  .side-hint { margin: 0; font-size: 12px; color: rgba(255, 255, 255, 0.4); min-height: 32px; }

  .error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: rgba(248, 113, 113, 0.08);
    border: 1px solid rgba(248, 113, 113, 0.2);
    border-radius: 8px;
    font-size: 13px;
    color: #f87171;
  }

  .actions { display: flex; flex-direction: column; gap: 10px; }

  .action {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 14px 20px;
    min-height: 52px;
    font-size: 15px;
    font-weight: 700;
    font-family: inherit;
    color: #fff;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .action:disabled { opacity: 0.5; cursor: not-allowed; }

  .print-action { background: linear-gradient(135deg, #10b981, #059669); }

  .print-action:hover:not(:disabled) {
    background: linear-gradient(135deg, #34d399, #10b981);
    box-shadow: 0 4px 20px rgba(16, 185, 129, 0.3);
  }

  .download-action {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
  }

  .download-action:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .workflow-tip { margin: 0; font-size: 12px; color: rgba(255, 255, 255, 0.3); line-height: 1.5; }
  .workflow-tip strong { color: rgba(255, 255, 255, 0.6); }
</style>
```

- [ ] **Step 2: Typecheck**

Run: `npm run check > /tmp/check.log 2>&1; grep -n "PrintPanel" /tmp/check.log`
Expected: no errors referencing `PrintPanel.svelte`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/print-preview/PrintPanel.svelte
git commit -m "feat(deck-releaser): add PrintPanel (inline print controls)" -- src/lib/features/choreo-card/components/print-preview/PrintPanel.svelte
```

---

## Task 4: `ReleaseHistoryPanel` inline-delete affordance

**Files:**
- Modify: `src/lib/features/choreo-card/components/deck-releaser/ReleaseHistoryPanel.svelte`

The current row is a single `<button class="release-item">`. Delete controls must not nest inside it (no button-in-button). Restructure: an outer `<div class="release-row">` containing the select `<button class="release-item">` and a sibling `<div class="row-actions">` holding the trash / confirm controls.

- [ ] **Step 1: Add the prop, delete state, and handlers**

In the `Props` interface add `onDeleteRelease`, and add `confirmingDelete` state + handlers. Replace the `<script>` block (lines 1–28) with:

```svelte
<script lang="ts">
  import type { DeckRelease } from "../../domain/models/DeckRelease";

  interface Props {
    releases: DeckRelease[];
    isLoading: boolean;
    activeDeckNumber: number | null;
    onSelectRelease: (release: DeckRelease) => void;
    /** Permanently delete a deck. Omit to hide delete affordances. */
    onDeleteRelease?: (deckNumber: number) => void;
  }

  const { releases, isLoading, activeDeckNumber, onSelectRelease, onDeleteRelease }: Props = $props();

  // Deck number currently in the two-step confirm state (trash → ✓/✗). Only one
  // row confirms at a time; selecting/confirming/cancelling clears it.
  let confirmingDelete = $state<number | null>(null);

  function startConfirm(e: MouseEvent, deckNumber: number) {
    e.stopPropagation();
    confirmingDelete = deckNumber;
  }

  function cancelConfirm(e: MouseEvent) {
    e.stopPropagation();
    confirmingDelete = null;
  }

  function confirmDelete(e: MouseEvent, deckNumber: number) {
    e.stopPropagation();
    confirmingDelete = null;
    onDeleteRelease?.(deckNumber);
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function distributionSummary(dist: Record<number, number>): string {
    return Object.entries(dist)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([step, count]) => `${step}s:${count}`)
      .join("  ");
  }

  function displayName(r: DeckRelease): string {
    return r.name?.trim() || r.notes?.trim() || `Deck #${String(r.deckNumber).padStart(3, "0")}`;
  }
</script>
```

- [ ] **Step 2: Restructure the row markup**

Replace the `{#each releases …}` block (the `<button class="release-item">…</button>` per row, lines 51–69) with:

```svelte
      {#each releases as release (release.deckNumber)}
        <div class="release-row" class:active={activeDeckNumber === release.deckNumber}>
          <button
            type="button"
            class="release-item"
            onclick={() => onSelectRelease(release)}
            aria-label="View Deck {release.deckNumber}: {displayName(release)}"
            aria-pressed={activeDeckNumber === release.deckNumber}
          >
            <div class="release-header">
              <span class="deck-badge">#{String(release.deckNumber).padStart(3, "0")}</span>
              <span class="release-date">{formatDate(release.createdAt)}</span>
            </div>
            <div class="release-notes">{displayName(release)}</div>
            <div class="release-meta">
              <span class="card-count">{release.cardCount} cards</span>
              <span class="distribution">{distributionSummary(release.stepCountDistribution)}</span>
            </div>
          </button>

          {#if onDeleteRelease}
            <div class="row-actions">
              {#if confirmingDelete === release.deckNumber}
                <button
                  type="button"
                  class="confirm-btn confirm-yes"
                  onclick={(e) => confirmDelete(e, release.deckNumber)}
                  aria-label="Confirm delete Deck {release.deckNumber}"
                >
                  <i class="fas fa-check" aria-hidden="true"></i> Delete
                </button>
                <button
                  type="button"
                  class="confirm-btn confirm-no"
                  onclick={cancelConfirm}
                  aria-label="Cancel delete"
                >
                  <i class="fas fa-times" aria-hidden="true"></i>
                </button>
              {:else}
                <button
                  type="button"
                  class="trash-btn"
                  onclick={(e) => startConfirm(e, release.deckNumber)}
                  aria-label="Delete Deck {release.deckNumber}"
                  title="Delete deck"
                >
                  <i class="fas fa-trash" aria-hidden="true"></i>
                </button>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
```

- [ ] **Step 3: Update styles**

In the `<style>` block, change the `.release-item` active/hover rules to live on `.release-row`, and add the row + action styles. Replace the `.release-item`, `.release-item:hover`, `.release-item.active`, `.release-item:focus-visible` rules (lines 135–163) with:

```css
  .release-row {
    position: relative;
    display: flex;
    align-items: stretch;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    transition: border-color 0.15s ease;
  }

  .release-row:hover { border-color: rgba(255, 255, 255, 0.15); }

  .release-row.active {
    border-color: var(--theme-accent, rgba(139, 92, 246, 0.5));
    background: rgba(139, 92, 246, 0.08);
  }

  .release-item {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    color: inherit;
    font: inherit;
  }

  .release-item:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .row-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    padding-right: 8px;
    flex-shrink: 0;
  }

  /* Trash hidden until row hover/focus on pointer devices; always shown on touch. */
  .trash-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s, color 0.15s, background 0.15s;
  }

  .release-row:hover .trash-btn,
  .release-row:focus-within .trash-btn { opacity: 1; }

  .trash-btn:hover {
    color: #f87171;
    background: rgba(248, 113, 113, 0.12);
  }

  .confirm-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 32px;
    padding: 4px 10px;
    border-radius: 8px;
    border: none;
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  .confirm-yes { background: #ef4444; color: #fff; }
  .confirm-yes:hover { background: #dc2626; }

  .confirm-no {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.7);
    padding: 4px 8px;
  }

  .confirm-no:hover { background: rgba(255, 255, 255, 0.15); color: #fff; }

  @media (hover: none) {
    .trash-btn { opacity: 1; }
  }
```

- [ ] **Step 4: Typecheck**

Run: `npm run check > /tmp/check.log 2>&1; grep -n "ReleaseHistoryPanel" /tmp/check.log`
Expected: no new errors referencing `ReleaseHistoryPanel.svelte`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/components/deck-releaser/ReleaseHistoryPanel.svelte
git commit -m "feat(deck-releaser): inline two-step delete on release rows" -- src/lib/features/choreo-card/components/deck-releaser/ReleaseHistoryPanel.svelte
```

---

## Task 5: Lift print state, element-sort, and handlers to `DeckReleaserTab`

**Files:**
- Modify: `src/lib/features/choreo-card/components/deck-releaser/ReviewStep.svelte`
- Modify: `src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte`

Goal: move the print dials (`cardSize`/`copies`/`groupByElement` + localStorage), the `elementSorted` derivation, `renderedPairs`, the export/print state, and the handlers (`handlePrint`/`handleExportPDF`/`handleExportZIP`/`triggerDownload`) OUT of `ReviewStep` and INTO `DeckReleaserTab`. `ReviewStep` receives them as props/callbacks. **The modal still renders this step** (driven by tab state) so the tree stays green and behavior is unchanged; Task 6 removes it.

- [ ] **Step 1: Add lifted state + handlers to `DeckReleaserTab`**

In `DeckReleaserTab.svelte` `<script>`, after the existing imports add:

```ts
  import { getPageLayout, type CardSizeId } from "../../domain/card-sizes";
  import { getTnDElementByIconPath, TND_ELEMENTS, type TnDElement } from "../../domain/tnd-element";
  import { suggestCopyCounts, copyWaste } from "../../services/print-copy-suggester";
  import type { CardPair } from "../../services/types";
  import type { PrintPDFMode } from "../../services/print-pdf-exporter";
  import type { PrintSide } from "../print-preview/PrintPanel.svelte";
```

After the existing `$state` declarations (around line 44), add the lifted print state. (This block is moved verbatim from `ReviewStep` — the localStorage settings, dials, element-sort, copy-suggester, render/export state, and handlers.):

```ts
  // ── Print state (lifted from ReviewStep so the sidebar PrintPanel and the
  //    preview pane share one owner) ──────────────────────────────────────────
  const PRINT_SETTINGS_KEY = "deckReleaser.printSettings";
  interface PersistedPrintSettings { cardSize: CardSizeId; copies: number; groupByElement: boolean; }
  function loadPrintSettings(): Partial<PersistedPrintSettings> {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem(PRINT_SETTINGS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }
  const savedPrint = loadPrintSettings();

  let cardSize = $state<CardSizeId>(savedPrint.cardSize ?? "poker");
  let copies = $state(savedPrint.copies ?? 1);
  let groupByElement = $state(savedPrint.groupByElement ?? true);
  let selectedSide = $state<PrintSide>("fronts");

  $effect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(PRINT_SETTINGS_KEY,
        JSON.stringify({ cardSize, copies, groupByElement } satisfies PersistedPrintSettings));
    } catch { /* quota / private mode — non-fatal */ }
  });

  let renderedPairs = $state<CardPair[]>([]);
  let isRendering = $state(false);
  let renderProgress = $state(0);
  let renderTotal = $state(0);
  let isExporting = $state(false);
  let isPrinting = $state(false);
  let exportProgress = $state(0);
  let exportTotal = $state(0);
  let exportError = $state("");
  let rerenderKey = $state(0);

  // Element-sort: order cards by TnD element so the preview + PDF group cleanly.
  // Reads `footers` (computed below) + rs.sequences — both tab-level.
  const elementSorted = $derived.by(() => {
    const rawElements = (footers ?? []).map((f) => getTnDElementByIconPath(f.iconPath ?? "") ?? undefined);
    const elementOrder = TND_ELEMENTS.map((e) => e.element);
    const indexed = rs.sequences.map((seq, i) => ({ seq, footer: footers?.[i], el: rawElements[i], origIndex: i }));
    indexed.sort((a, b) => {
      const ai = a.el ? elementOrder.indexOf(a.el.element) : 999;
      const bi = b.el ? elementOrder.indexOf(b.el.element) : 999;
      return ai !== bi ? ai - bi : a.origIndex - b.origIndex;
    });
    return {
      sequences: indexed.map((r) => r.seq),
      footers: indexed.map((r) => r.footer!).filter(Boolean),
      tndElements: indexed.map((r) => r.el),
    };
  });
  const sortedSequences = $derived(elementSorted.sequences);
  const sortedFooters = $derived(elementSorted.footers);
  const tndElements = $derived(elementSorted.tndElements);

  const groupSizes = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const el of tndElements) {
      const key = el?.element ?? "__untagged__";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.values()];
  });
  const cardsPerPage = $derived(getPageLayout(cardSize).cardsPerPage);
  const copiesPresets = $derived(suggestCopyCounts(groupSizes, cardsPerPage).map((s) => s.copies));
  function copiesAnnotate(n: number) {
    const w = copyWaste(groupSizes, cardsPerPage, n);
    return { blanks: w.blanks, perfect: w.blanks === 0 };
  }

  // 'fronts'/'backs' scope the preview to that side; combined/zip show all.
  const previewSideFilter = $derived(
    selectedSide === "fronts" ? "fronts" : selectedSide === "backs" ? "backs" : null,
  );

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleExportPDF(mode: PrintPDFMode = "combined") {
    if (renderedPairs.length === 0) return;
    isExporting = true; exportError = ""; exportProgress = 0; exportTotal = 0;
    try {
      const { exportHomePrintPDF } = await import("$lib/features/choreo-card/services/print-pdf-exporter");
      const deckName = `Deck_${String(rs.nextDeckNumber).padStart(3, "0")}`;
      const copiesSuffix = copies > 1 ? `_x${copies}` : "";
      const suffix = (mode === "fronts" ? "_fronts" : mode === "backs" ? "_backs" : "_print") + copiesSuffix;
      const blob = await exportHomePrintPDF(renderedPairs, deckName, cardSize, (current, total) => {
        exportProgress = current; exportTotal = total;
      }, mode, { copies, elements: tndElements, groupByElement });
      triggerDownload(blob, `${deckName}${suffix}.pdf`);
    } catch (e) {
      exportError = `PDF export failed: ${e instanceof Error ? e.message : e}`;
    } finally {
      isExporting = false; exportProgress = 0; exportTotal = 0;
    }
  }

  async function handlePrint(mode: PrintPDFMode) {
    if (renderedPairs.length === 0 || isPrinting) return;
    isPrinting = true; exportError = "";
    try {
      const { exportHomePrintPDF } = await import("$lib/features/choreo-card/services/print-pdf-exporter");
      const { printPdfBlob } = await import("$lib/features/choreo-card/services/print-blob");
      const deckLabel = `Deck_${String(rs.nextDeckNumber).padStart(3, "0")}`;
      const blob = await exportHomePrintPDF(renderedPairs, deckLabel, cardSize, undefined, mode, {
        copies, elements: tndElements, groupByElement,
      });
      printPdfBlob(blob);
    } catch (e) {
      exportError = `Print failed: ${e instanceof Error ? e.message : e}`;
    } finally {
      isPrinting = false;
    }
  }

  async function handleExportZIP() {
    if (renderedPairs.length === 0) return;
    isExporting = true; exportError = ""; exportProgress = 0; exportTotal = 0;
    try {
      const { exportDeckZIP } = await import("$lib/features/choreo-card/services/print-zip-exporter");
      const deckName = `Deck_${String(rs.nextDeckNumber).padStart(3, "0")}`;
      const blob = await exportDeckZIP(renderedPairs, deckName, (current, total) => {
        exportProgress = current; exportTotal = total;
      });
      triggerDownload(blob, `${deckName}_cards.zip`);
    } catch (e) {
      exportError = `ZIP export failed: ${e instanceof Error ? e.message : e}`;
    } finally {
      isExporting = false; exportProgress = 0; exportTotal = 0;
    }
  }
```

Note: `footers` is referenced by `elementSorted` but is defined later in the file (the existing `const footers = $derived(...)`). Move the existing `footers` derivation up so it precedes `elementSorted`, or rely on `$derived` laziness (Svelte 5 `$derived` is evaluated on read, so declaration order doesn't break it — but for readability move `footers` above this block).

- [ ] **Step 2: Slim `ReviewStep` to receive lifted state via props**

In `ReviewStep.svelte`, DELETE these now-lifted pieces: the `PRINT_SETTINGS_KEY`/`loadPrintSettings`/`savedPrint` block (lines 77–92), the `cardSize`/`copies`/`groupByElement` `$state` + persist `$effect` (lines 94–109), `renderedPairs`/`isRendering`/`renderProgress`/`renderTotal`/`isExporting`/`isPrinting`/`exportProgress`/`exportTotal`/`exportError`/`rerenderKey` `$state` (lines 110–161 — keep `inspectedSequence`/`inspectedFrontImageUrl`/`inspectedRerender`), the `elementSorted`/`sortedSequences`/`sortedFooters`/`tndElements`/`groupSizes`/`cardsPerPage`/`copiesPresets`/`copiesAnnotate` block (lines 114–153), the `handlePairsReady`/`handleRenderState`/`triggerDownload`/`handleExportPDF`/`handlePrint`/`handleExportZIP` functions (lines 201–290), and the `showPrintDialog` state + the `{#if showPrintDialog}<PrintDialog/>` block (lines 155, 421–442), AND the now-unused `PrintDialog` import (line 9) — leaving it triggers an unused-import error.

Add to the `Props` interface:

```ts
    cardSize: CardSizeId;
    copies: number;
    groupByElement: boolean;
    sortedSequences: SequenceData[];
    sortedFooters: CardFooter[];
    tndElements: (TnDElement | undefined)[];
    copiesPresets: number[];
    copiesAnnotate: (n: number) => { blanks: number; perfect: boolean } | null;
    isRendering: boolean;
    renderProgress: number;
    renderTotal: number;
    rerenderKey: number;
    sideFilter: "fronts" | "backs" | null;
    onCardSizeChange: (s: CardSizeId) => void;
    onCopiesChange: (n: number) => void;
    onGroupByElementChange: (on: boolean) => void;
    onRerender: () => void;
    onPairsReady: (pairs: CardPair[]) => void;
    onRenderStateChange: (s: { isRendering: boolean; progress: number; total: number }) => void;
```

Add the matching destructured props, and the needed imports (`CardSizeId`, `CardPair`, `TnDElement`). Remove `PrintDialog`-only state. The `<PrintPreviewToolbar>` and `<PrintPreviewPages>` usages change to consume props instead of local state:

```svelte
  <PrintPreviewToolbar
    {cardSize}
    totalCards={cards.length}
    {isRendering}
    {renderProgress}
    {renderTotal}
    onCardSizeChange={onCardSizeChange}
    onRerender={onRerender}
    onPrint={() => {}}
    {copies}
    onCopiesChange={onCopiesChange}
    {copiesPresets}
    {copiesAnnotate}
    {groupByElement}
    onGroupByElementChange={onGroupByElementChange}
  />

(The `onPrint={() => {}}` no-op satisfies the toolbar's still-required `onPrint`
prop until Task 7 removes it.)

  <div class="preview-area">
    <PrintPreviewPages
      sequences={sortedSequences}
      {cardSize}
      {theme}
      {bluePropType}
      {redPropType}
      {rerenderKey}
      {copies}
      {groupByElement}
      {sideFilter}
      footers={sortedFooters}
      {tndElements}
      isLoading={false}
      includeStartPosition={true}
      deckMode={true}
      displayMode="sheets"
      deckId={String(nextDeckNumber).padStart(3, "0")}
      deckName={`LOOP Deck #${nextDeckNumber}`}
      onCardClick={handleCardClick}
      onCardContextMenu={onContextMenu ? (x, y, rerender) => onContextMenu(x, y, rerender) : undefined}
      onPairsReady={onPairsReady}
      onRenderStateChange={onRenderStateChange}
    />
  </div>
```

Note: `PrintPreviewToolbar`'s `onPrint` prop is removed in Task 7; for THIS task keep passing a no-op (`onPrint={() => {}}`) so the toolbar still compiles. Task 7 removes the prop entirely.

- [ ] **Step 3: Update `<ReviewStep>` call site in `DeckReleaserTab`**

In the `{:else if rs.step === "review"}` branch, pass the lifted state down:

```svelte
      <ReviewStep
        cards={rs.cards}
        sequences={rs.sequences}
        theme={rs.theme}
        bluePropType={rs.bluePropType}
        redPropType={rs.redPropType}
        nextDeckNumber={rs.nextDeckNumber}
        deckName={rs.name}
        isReleasing={rs.isReleasing}
        readOnly={rs.viewingRelease !== null}
        brokenLoopCount={rs.brokenLoopCount}
        showRedraw={rs.deckMode === "loop"}
        {footers}
        {onContextMenu}
        {cardSize}
        {copies}
        {groupByElement}
        {sortedSequences}
        {sortedFooters}
        {tndElements}
        {copiesPresets}
        copiesAnnotate={copiesAnnotate}
        {isRendering}
        {renderProgress}
        {renderTotal}
        {rerenderKey}
        sideFilter={previewSideFilter}
        onCardSizeChange={(s) => { cardSize = s; }}
        onCopiesChange={(n) => { copies = n; }}
        onGroupByElementChange={(on) => { groupByElement = on; }}
        onRerender={() => { rerenderKey++; }}
        onPairsReady={(pairs) => { renderedPairs = pairs; }}
        onRenderStateChange={(s) => { isRendering = s.isRendering; renderProgress = s.progress; renderTotal = s.total; }}
        onSwapCard={handleSwapCard}
        onRedraw={handleRedraw}
        onRelease={openReleaseModal}
        onRename={rs.viewingRelease !== null ? handleRenameDeck : undefined}
        onBack={() => {
          rs.viewingRelease = null;
          rs.themeOverride = null;
          rs.bluePropOverride = null;
          rs.redPropOverride = null;
          rs.step = "configure";
          rs.persist();
        }}
      />
```

- [ ] **Step 4: Typecheck**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "ReviewStep|DeckReleaserTab" /tmp/check.log`
Expected: no NEW errors in `ReviewStep.svelte`. (The pre-existing `DeckReleaserTab` `hashDeckContent`/`DeckCardIdentity` error is not yours — confirm it's the same one already present on `main` and leave it.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/components/deck-releaser/ReviewStep.svelte src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte
git commit -m "refactor(deck-releaser): lift print state + handlers to DeckReleaserTab" -- src/lib/features/choreo-card/components/deck-releaser/ReviewStep.svelte src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte
```

---

## Task 6: Two-mode sidebar (Browse/Print) + delete wiring + fluid width

**Files:**
- Modify: `src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte`
- Modify: `src/lib/features/choreo-card/components/deck-releaser/ReviewStep.svelte`

- [ ] **Step 1: Imports + sidebar state + delete handler in `DeckReleaserTab`**

Add imports:

```ts
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import PrintPanel from "../print-preview/PrintPanel.svelte";
  import { releaseDeck, getAllReleases, updateDeckMeta, getNextDeckNumber, deleteDeck } from "../../services/deck-release-store";
```

(merge `deleteDeck` into the existing `deck-release-store` import rather than duplicating).

Add state + handler:

```ts
  type SidebarMode = "browse" | "print";
  let sidebarMode = $state<SidebarMode>("browse");

  async function handleDeleteRelease(deckNumber: number) {
    try {
      await deleteDeck(deckNumber);
      releases = releases.filter((r) => r.deckNumber !== deckNumber);
      releasedIds = extractReleasedIds(releases);
      if (rs.viewingRelease?.deckNumber === deckNumber) {
        rs.viewingRelease = null;
        rs.themeOverride = null;
        rs.bluePropOverride = null;
        rs.redPropOverride = null;
        rs.step = "configure";
        rs.persist();
      }
      toast.success(`Deck #${String(deckNumber).padStart(3, "0")} deleted`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      const isPermission = msg.includes("permission") || msg.includes("PERMISSION_DENIED");
      toast.error(isPermission ? "Admin access required to delete decks." : `Delete failed: ${msg}`);
    }
  }
```

- [ ] **Step 2: Replace the `.releaser-history` markup**

Replace the `<div class="releaser-history">…</div>` block (lines 564–571) with the two-mode panel. The Print segment is only meaningful while reviewing a deck; disable it otherwise. Release Deck moves into Browse (only when composing — `!rs.viewingRelease` and on the review step):

```svelte
  <div class="releaser-sidebar">
    <div class="sidebar-switch">
      <SegmentedControl
        options={[
          { value: "browse", label: "Browse" },
          { value: "print", label: "Print" },
        ]}
        value={sidebarMode}
        onchange={(v) => { sidebarMode = v; }}
        color="accent"
        size="sm"
      />
    </div>

    {#if sidebarMode === "browse"}
      <div class="sidebar-body">
        <ReleaseHistoryPanel
          {releases}
          isLoading={isLoadingReleases}
          activeDeckNumber={rs.viewingRelease?.deckNumber ?? null}
          onSelectRelease={handleSelectRelease}
          onDeleteRelease={handleDeleteRelease}
        />
      </div>
      {#if rs.step === "review" && rs.viewingRelease === null}
        <div class="sidebar-footer">
          <button type="button" class="release-btn" onclick={openReleaseModal} disabled={rs.isReleasing || isRendering}>
            {#if rs.isReleasing}
              <i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Releasing…
            {:else}
              <i class="fas fa-stamp" aria-hidden="true"></i>
              Release Deck #{String(rs.nextDeckNumber).padStart(3, "0")}
            {/if}
          </button>
        </div>
      {/if}
    {:else}
      <div class="sidebar-body">
        {#if rs.step === "review" && rs.cards.length > 0}
          <PrintPanel
            cardCount={rs.cards.length}
            {tndElements}
            {cardSize}
            {copies}
            {groupByElement}
            theme={rs.theme}
            {selectedSide}
            onSideChange={(s) => { selectedSide = s; }}
            {isExporting}
            {isPrinting}
            {exportProgress}
            {exportTotal}
            {exportError}
            onPrint={handlePrint}
            onExportPDF={handleExportPDF}
            onExportZIP={handleExportZIP}
          />
        {:else}
          <div class="sidebar-empty">
            <i class="fas fa-print" aria-hidden="true"></i>
            <span>Compose or open a deck to print.</span>
          </div>
        {/if}
      </div>
    {/if}
  </div>
```

- [ ] **Step 3: Replace sidebar styles + fluid width**

Replace the `.releaser-history` rule (lines 597–601) and its mobile override (lines 687–691) with:

```css
  .releaser-sidebar {
    width: clamp(300px, 22vw, 440px);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .sidebar-switch {
    padding: 12px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    flex-shrink: 0;
  }

  .sidebar-body { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }

  .sidebar-footer {
    padding: 12px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    flex-shrink: 0;
  }

  .sidebar-footer .release-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: 44px;
    padding: 10px 16px;
    background: #10b981;
    border: none;
    border-radius: 10px;
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: filter 0.15s;
  }

  .sidebar-footer .release-btn:hover:not(:disabled) { filter: brightness(1.1); }
  .sidebar-footer .release-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .sidebar-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 48px 20px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
    font-size: 13px;
    text-align: center;
  }

  .sidebar-empty i { font-size: 24px; }

  @media (max-width: 900px) {
    .releaser-sidebar {
      width: 100%;
      border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
      border-left: none;
    }
    /* Browse caps height (scrollable list); Print gets full height for controls. */
    .releaser-sidebar:has(.sidebar-body) { max-height: 320px; }
  }
```

Note: the `:has()` cap applies to both modes; to give Print full height, gate it on mode by binding a class. Add `class:print-mode={sidebarMode === "print"}` to `.releaser-sidebar` and use:

```css
  @media (max-width: 900px) {
    .releaser-sidebar { width: 100%; border-top: 1px solid var(--theme-stroke, rgba(255,255,255,0.08)); border-left: none; max-height: 320px; }
    .releaser-sidebar.print-mode { max-height: none; }
  }
```

- [ ] **Step 4: Remove the header Release button from `ReviewStep`**

In `ReviewStep.svelte`, the `{#if !readOnly}<div class="action-buttons">…</div>` block (lines 331–349) currently holds Redraw + Release. Remove the Release `<button class="release-btn">` (it moved to the sidebar). Keep Redraw. If `showRedraw` is false the `action-buttons` div may be empty — guard it:

```svelte
    {#if !readOnly && showRedraw}
      <div class="action-buttons">
        <button type="button" class="redraw-btn" onclick={onRedraw} disabled={isReleasing}>
          <i class="fas fa-dice" aria-hidden="true"></i>
          Redraw
        </button>
      </div>
    {/if}
```

The `release-btn` CSS in `ReviewStep` is now unused — delete the `.release-btn`, `.release-btn:hover`, `.release-btn:disabled` rules (lines 598–621).

- [ ] **Step 5: Typecheck**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "ReviewStep|DeckReleaserTab|SegmentedControl|PrintPanel" /tmp/check.log`
Expected: no new errors in these files.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte src/lib/features/choreo-card/components/deck-releaser/ReviewStep.svelte
git commit -m "feat(deck-releaser): two-mode Browse/Print sidebar, fluid width, delete wiring" -- src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte src/lib/features/choreo-card/components/deck-releaser/ReviewStep.svelte
```

---

## Task 7: Declutter `PrintPreviewToolbar` (remove Print button, regroup controls)

**Files:**
- Modify: `src/lib/features/choreo-card/components/print-preview/PrintPreviewToolbar.svelte`
- Modify: `src/lib/features/choreo-card/components/deck-releaser/ReviewStep.svelte`

The Print entry is now the sidebar's `[Browse|Print]` switch, so the toolbar's `Print This Deck` button is removed. Card size stays on the left; copies / group-by-color / refresh move to the toolbar's right section (freed space).

- [ ] **Step 1: Remove `onPrint` from the toolbar**

In `PrintPreviewToolbar.svelte`, delete the `onPrint: () => void;` line from `Props` (line 15) and `onPrint,` from the destructure (line 37).

- [ ] **Step 2: Regroup the markup**

Replace the template (lines 53–108) with two groups — card size left, the rest right:

```svelte
<div class="toolbar" role="toolbar" aria-label="Print preview controls">
  <div class="toolbar-left">
    <CardSizeToggle selected={cardSize} onchange={onCardSizeChange} />
  </div>

  <div class="toolbar-right">
    {#if copies != null && onCopiesChange}
      <span class="copies-label">Copies</span>
      <CopiesSelect
        value={copies}
        onchange={onCopiesChange}
        presets={copiesPresets}
        annotate={copiesAnnotate}
      />
    {/if}

    {#if groupByElement != null && onGroupByElementChange}
      <FilterChipBase
        mode="toggle"
        size="sm"
        icon="fas fa-palette"
        label="Group by color"
        active={groupByElement}
        chipColor="#10b981"
        onclick={() => onGroupByElementChange(!groupByElement)}
      />
    {/if}

    {#if onRerender}
      <button
        class="icon-btn"
        class:spinning={isRendering}
        onclick={onRerender}
        aria-label={isRendering ? "Restart render" : "Re-render all cards"}
        title={isRendering ? "Restart render (cancels current)" : "Re-render all cards"}
      >
        <i class="fas fa-sync-alt" aria-hidden="true"></i>
      </button>
    {/if}

    {#if isRendering}
      <span class="progress-text" aria-live="polite" aria-atomic="true">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        {progressText}
      </span>
    {/if}
  </div>
</div>
```

- [ ] **Step 3: Update styles**

Replace `.toolbar-left` (lines 120–125) and the `.print-btn` rules (lines 176–206) + the mobile `.print-btn` rule (lines 213–217). Add `.toolbar-right`:

```css
  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
```

Delete the `.print-btn`, `.print-btn:hover`, `.print-btn:active`, `.print-btn:disabled`, and mobile `.print-btn` rules entirely.

- [ ] **Step 4: Remove the no-op `onPrint` from `ReviewStep`**

In `ReviewStep.svelte`, remove the temporary `onPrint={() => {}}` line added in Task 5 from the `<PrintPreviewToolbar>` usage.

- [ ] **Step 5: Typecheck**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "PrintPreviewToolbar|ReviewStep" /tmp/check.log`
Expected: no new errors in these files.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/choreo-card/components/print-preview/PrintPreviewToolbar.svelte src/lib/features/choreo-card/components/deck-releaser/ReviewStep.svelte
git commit -m "feat(deck-releaser): declutter toolbar — remove Print button, regroup controls" -- src/lib/features/choreo-card/components/print-preview/PrintPreviewToolbar.svelte src/lib/features/choreo-card/components/deck-releaser/ReviewStep.svelte
```

---

## Final verification (after all tasks)

- [ ] **Full typecheck:** `npm run check > /tmp/check.log 2>&1; grep -ciE "error" /tmp/check.log` — confirm the only remaining errors are the pre-existing ones in untouched files (`DeckReleaserTab` `hashDeckContent`, `Viewer3DScene`, missing-module stubs). No new errors in any file this plan touched.
- [ ] **Unit tests:** `npx vitest run src/lib/features/choreo-card/services/__tests__/` — `deleteDeck` + `print-slot-planner` green.
- [ ] **Runtime/visual (ask user, per verification-protocol):** in Choreo Cards → Deck Releaser, compose or open a deck and confirm:
  1. Sidebar shows `[Browse | Print]`; preview stays fully visible/unblurred in both modes.
  2. Print → Fronts scopes the preview to front sheets; Backs → back sheets; Combined/Images → all.
  3. Print Fronts / Print Backs open the OS print dialog with that side's PDF.
  4. Release Deck lives at the bottom of Browse (composing only); no Release/Print buttons stranded in the header.
  5. Browse → hover a deck → trash → ✓ Delete / ✗; confirm removes the row; if it was open, returns to composer.
  6. Sidebar width is fluid from 1280px to 4K; mobile Print mode gets full height.
```
