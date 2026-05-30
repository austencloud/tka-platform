# Element-Grouped Print Copies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the deck print export produce N copies of an element-colored deck where every printed sheet holds exactly one element's cards, so cuts never cross a color boundary.

**Architecture:** A new pure planner (`print-slot-planner.ts`) turns `(pairs, elements, copies, cardsPerPage)` into an ordered `PrintSlot[]` — grouped by fixed `TND_ELEMENTS` order, each color's cards whole-block-repeated N times and padded with blank slots to fill whole sheets. `exportHomePrintPDF` consumes that slot list (embedding each unique PNG once and reusing the handle), and `PrintDialog`/`ReviewStep` add a "Copies per card" control wired through to the exporter.

**Tech Stack:** TypeScript, Svelte 5, pdf-lib, vitest.

> **Branching note:** This project works on `main` only (global rule bans worktrees/branches). Ignore the writing-plans worktree assumption. Commit each task with an explicit pathspec (`git commit -m "..." -- <files>`) — the index is shared with other agents.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/features/choreo-card/services/print-slot-planner.ts` | **Create.** Pure `planPrintSlots` + `PrintSlot` type. No DOM/canvas logic. |
| `src/lib/features/choreo-card/services/__tests__/print-slot-planner.test.ts` | **Create.** Unit tests for the planner. |
| `src/lib/features/choreo-card/services/print-pdf-exporter.ts` | **Modify.** `exportHomePrintPDF` consumes slots; new `HomePrintOptions`; embed-once cache; element-named sheet labels. |
| `src/lib/features/choreo-card/components/print-preview/PrintDialog.svelte` | **Modify.** "Copies per card" input (PDF formats only); copies-aware sheet estimate; per-element sheet annotation; `onExportPDF(mode, copies)`. |
| `src/lib/features/choreo-card/components/deck-releaser/ReviewStep.svelte` | **Modify.** Forward `copies` + sorted `tndElements` into `exportHomePrintPDF`. |

---

## Task 1: Pure slot planner

**Files:**
- Create: `src/lib/features/choreo-card/services/print-slot-planner.ts`
- Test: `src/lib/features/choreo-card/services/__tests__/print-slot-planner.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/features/choreo-card/services/__tests__/print-slot-planner.test.ts
import { describe, it, expect } from "vitest";
import { planPrintSlots } from "../print-slot-planner";
import type { CardPair } from "../types";
import { TND_ELEMENTS, type TnDElement } from "../../domain/tnd-element";

// Sentinel pairs — the planner never touches canvas internals, so fakes suffice.
function pair(label: string): CardPair {
  return { front: { label } as unknown as HTMLCanvasElement, back: {} as HTMLCanvasElement, label };
}
const EL = (element: string) => TND_ELEMENTS.find((e) => e.element === element)! as TnDElement;

describe("planPrintSlots", () => {
  it("groups by fixed TND_ELEMENTS order and pads each color to whole sheets", () => {
    // 1 fire card, 1 water card; cardsPerPage 9; copies 1.
    const pairs = [pair("fire1"), pair("water1")];
    const elements = [EL("fire"), EL("water")];
    const slots = planPrintSlots(pairs, elements, 1, 9);

    // water precedes fire in TND_ELEMENTS order → water bucket first.
    expect(slots.length).toBe(18); // two buckets, each padded to 9
    expect(slots[0]!.pair?.label).toBe("water1");
    expect(slots[0]!.elementName).toBe("water");
    // rest of water sheet is blank but tagged water
    expect(slots[1]!.pair).toBeNull();
    expect(slots[1]!.elementName).toBe("water");
    // second sheet is fire
    expect(slots[9]!.pair?.label).toBe("fire1");
    expect(slots[9]!.elementName).toBe("fire");
  });

  it("whole-block repeats each color N times (not per-card runs)", () => {
    const pairs = [pair("a"), pair("b")]; // both fire
    const elements = [EL("fire"), EL("fire")];
    const slots = planPrintSlots(pairs, elements, 3, 9); // 2 cards * 3 = 6, pad to 9

    const labels = slots.slice(0, 6).map((s) => s.pair?.label);
    expect(labels).toEqual(["a", "b", "a", "b", "a", "b"]); // whole-block, not a a a b b b
    expect(slots.length).toBe(9);
    expect(slots[6]!.pair).toBeNull();
  });

  it("puts untagged cards in a trailing bucket with null elementName", () => {
    const pairs = [pair("u1"), pair("fire1")];
    const elements = [undefined, EL("fire")];
    const slots = planPrintSlots(pairs, elements, 1, 9);

    expect(slots[0]!.pair?.label).toBe("fire1"); // fire bucket first
    expect(slots[9]!.pair?.label).toBe("u1");    // untagged trails
    expect(slots[9]!.elementName).toBeNull();
  });

  it("copies < 1 is clamped to 1", () => {
    const slots = planPrintSlots([pair("a")], [EL("fire")], 0, 9);
    expect(slots.filter((s) => s.pair).length).toBe(1);
  });

  it("passes through with no element data (single padded bucket)", () => {
    const pairs = [pair("a"), pair("b")];
    const slots = planPrintSlots(pairs, [], 1, 9);
    expect(slots.length).toBe(9);
    expect(slots.slice(0, 2).map((s) => s.pair?.label)).toEqual(["a", "b"]);
    expect(slots[0]!.elementName).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/features/choreo-card/services/__tests__/print-slot-planner.test.ts`
Expected: FAIL — `Cannot find module "../print-slot-planner"`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/features/choreo-card/services/print-slot-planner.ts
import type { CardPair } from "./types";
import { TND_ELEMENTS, type TnDElement } from "../domain/tnd-element";

/** One grid cell on a print sheet. `pair` null = blank padding cell. `elementName`
 *  is the color of the sheet this slot sits on ("fire", "water", …) or null for
 *  untagged cards — used for sheet labels and per-element grouping. */
export interface PrintSlot {
  pair: CardPair | null;
  elementName: string | null;
}

const UNTAGGED = "__untagged__";

/** Group pairs by element (fixed TND_ELEMENTS order, untagged trailing),
 *  whole-block-repeat each color `copies` times, and pad each color block with
 *  blank slots so its length is a multiple of `cardsPerPage`. The result is an
 *  ordered slot list in which every page holds exactly one element. */
export function planPrintSlots(
  pairs: CardPair[],
  elements: (TnDElement | undefined)[],
  copies: number,
  cardsPerPage: number,
): PrintSlot[] {
  const n = Math.max(1, Math.floor(copies));

  // Bucket pairs by element key, preserving input order within a bucket.
  const buckets = new Map<string, CardPair[]>();
  for (let i = 0; i < pairs.length; i++) {
    const key = elements[i]?.element ?? UNTAGGED;
    const bucket = buckets.get(key) ?? [];
    bucket.push(pairs[i]!);
    buckets.set(key, bucket);
  }

  // Emit buckets in TND_ELEMENTS order, then the untagged bucket last.
  const order = [...TND_ELEMENTS.map((e) => e.element), UNTAGGED];
  const out: PrintSlot[] = [];

  for (const key of order) {
    const bucket = buckets.get(key);
    if (!bucket || bucket.length === 0) continue;
    const elementName = key === UNTAGGED ? null : key;

    // Whole-block repeat N times.
    const repeated: PrintSlot[] = [];
    for (let c = 0; c < n; c++) {
      for (const p of bucket) repeated.push({ pair: p, elementName });
    }
    // Pad to a whole number of sheets.
    while (repeated.length % cardsPerPage !== 0) {
      repeated.push({ pair: null, elementName });
    }
    out.push(...repeated);
  }

  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/features/choreo-card/services/__tests__/print-slot-planner.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/services/print-slot-planner.ts src/lib/features/choreo-card/services/__tests__/print-slot-planner.test.ts
git commit -m "feat(print): pure element-grouped slot planner with copies + sheet padding" -- src/lib/features/choreo-card/services/print-slot-planner.ts src/lib/features/choreo-card/services/__tests__/print-slot-planner.test.ts
```

---

## Task 2: Consume slots in exportHomePrintPDF

**Files:**
- Modify: `src/lib/features/choreo-card/services/print-pdf-exporter.ts`

- [ ] **Step 1: Update the pdf-lib import to include `PDFImage`**

Find line 1:

```ts
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';
```

Replace with:

```ts
import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { planPrintSlots, type PrintSlot } from './print-slot-planner';
import type { TnDElement } from '../domain/tnd-element';
```

- [ ] **Step 2: Replace the `exportHomePrintPDF` function body**

Replace the entire existing `exportHomePrintPDF` function (lines 61-133, from the doc comment through its closing brace) with:

```ts
export interface HomePrintOptions {
	/** Whole-deck copies. Each element block repeats N times. Default 1, min 1. */
	copies?: number;
	/** Element tag per pair, parallel to `pairs`. Absent → no grouping (single
	 *  trailing bucket, tail-padded). */
	elements?: (TnDElement | undefined)[];
}

/** Capitalize an element key for sheet labels: "fire" → "Fire". */
function capitalize(s: string): string {
	return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}

/** Grid layout on Letter pages for double-sided home printing.
 *
 *  Cards are grouped by element (fixed TND_ELEMENTS order), each color
 *  whole-block-repeated `copies` times and padded to whole sheets, so every
 *  printed sheet holds exactly one element — a cut never crosses two colors.
 *
 *  Combined mode: all fronts → flip instruction → all backs → finishing tips
 *  Fronts mode: all fronts → finishing tips
 *  Backs mode: all backs (columns mirrored for long-edge duplex) → finishing tips
 *
 *  Every page gets: crop marks, sheet labels (with element name), flip hints.
 */
export async function exportHomePrintPDF(
	pairs: CardPair[],
	deckName: string,
	cardSize: CardSizeId = 'poker',
	onProgress?: (current: number, total: number) => void,
	mode: PrintPDFMode = 'combined',
	options: HomePrintOptions = {},
): Promise<Blob> {
	const layout = getPageLayout(cardSize);
	const { cols, cardsPerPage, cardWidthPt, cardHeightPt, gutterPt, marginXPt, marginYPt } = layout;

	const copies = Math.max(1, Math.floor(options.copies ?? 1));
	const elements = options.elements ?? [];
	const slots = planPrintSlots(pairs, elements, copies, cardsPerPage);
	const totalSheets = slots.length / cardsPerPage; // integer by construction

	const pdfDoc = await PDFDocument.create();
	const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
	const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
	const includeFronts = mode === 'combined' || mode === 'fronts';
	const includeBacks = mode === 'combined' || mode === 'backs';
	const progressTotal = (includeFronts ? totalSheets : 0) + (includeBacks ? totalSheets : 0);
	let progressCount = 0;

	// Embed each unique card PNG once; reuse the handle across all N copies.
	const frontImages = new Map<HTMLCanvasElement, PDFImage>();
	const backImages = new Map<HTMLCanvasElement, PDFImage>();
	const embedFront = async (c: HTMLCanvasElement): Promise<PDFImage> => {
		let img = frontImages.get(c);
		if (!img) { img = await pdfDoc.embedPng(canvasToPngBytes(c)); frontImages.set(c, img); }
		return img;
	};
	const embedBack = async (c: HTMLCanvasElement): Promise<PDFImage> => {
		let img = backImages.get(c);
		if (!img) { img = await pdfDoc.embedPng(canvasToPngBytes(c)); backImages.set(c, img); }
		return img;
	};

	const sheetSide = (base: string, sheetSlots: PrintSlot[]): string => {
		const el = sheetSlots[0]?.elementName ?? null;
		return el ? `${base}  ·  ${capitalize(el)}` : base;
	};

	if (includeFronts) {
		for (let sheet = 0; sheet < totalSheets; sheet++) {
			const start = sheet * cardsPerPage;
			const sheetSlots = slots.slice(start, start + cardsPerPage);
			const frontsPage = pdfDoc.addPage([LETTER_W, LETTER_H]);

			for (let i = 0; i < sheetSlots.length; i++) {
				const slot = sheetSlots[i]!;
				if (!slot.pair) continue;
				const col = i % cols;
				const row = Math.floor(i / cols);
				const x = marginXPt + col * (cardWidthPt + gutterPt);
				const y = LETTER_H - marginYPt - (row + 1) * cardHeightPt - row * gutterPt;
				const img = await embedFront(slot.pair.front);
				frontsPage.drawImage(img, { x, y, width: cardWidthPt, height: cardHeightPt });
			}

			drawCropMarks(frontsPage, layout);
			drawSheetLabel(frontsPage, font, fontBold, sheetSide('FRONTS', sheetSlots), sheet + 1, totalSheets, deckName);
			drawFlipHint(frontsPage, font, "FRONT SIDE");
			onProgress?.(++progressCount, progressTotal);
		}
	}

	if (mode === 'combined') {
		addFlipInstructionPage(pdfDoc, font, fontBold);
	}

	if (includeBacks) {
		for (let sheet = 0; sheet < totalSheets; sheet++) {
			const start = sheet * cardsPerPage;
			const sheetSlots = slots.slice(start, start + cardsPerPage);
			const backsPage = pdfDoc.addPage([LETTER_W, LETTER_H]);

			for (let i = 0; i < sheetSlots.length; i++) {
				const slot = sheetSlots[i]!;
				if (!slot.pair) continue;
				const col = i % cols;
				const row = Math.floor(i / cols);
				const mirroredCol = cols - 1 - col;
				const x = marginXPt + mirroredCol * (cardWidthPt + gutterPt);
				const y = LETTER_H - marginYPt - (row + 1) * cardHeightPt - row * gutterPt;
				const img = await embedBack(slot.pair.back);
				backsPage.drawImage(img, { x, y, width: cardWidthPt, height: cardHeightPt });
			}

			drawCropMarks(backsPage, layout);
			drawSheetLabel(backsPage, font, fontBold, sheetSide('BACKS', sheetSlots), sheet + 1, totalSheets, deckName);
			drawFlipHint(backsPage, font, "BACK SIDE — columns mirrored for long-edge flip");
			onProgress?.(++progressCount, progressTotal);
		}
	}

	addFinishingTipsPage(pdfDoc, font, fontBold);

	const pdfBytes = await pdfDoc.save();
	return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}
```

- [ ] **Step 3: Typecheck the changed file via the watch checker or one-shot**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep -i print-pdf-exporter`
Expected: no errors referencing `print-pdf-exporter.ts`. (Full `npm run check` is deferred to Task 5.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/choreo-card/services/print-pdf-exporter.ts
git commit -m "feat(print): exportHomePrintPDF lays out element-grouped padded sheets with copies" -- src/lib/features/choreo-card/services/print-pdf-exporter.ts
```

---

## Task 3: Copies control + copies-aware estimate in PrintDialog

**Files:**
- Modify: `src/lib/features/choreo-card/components/print-preview/PrintDialog.svelte`

- [ ] **Step 1: Change the `onExportPDF` prop signature to carry copies**

In the `interface Props` block, find:

```ts
    onExportPDF: (mode: PrintPDFMode) => void;
```

Replace with:

```ts
    onExportPDF: (mode: PrintPDFMode, copies: number) => void;
```

- [ ] **Step 2: Add a `copies` state and make the sheet estimate copies + element aware**

Find:

```ts
  let selectedFormat = $state<ExportFormat>("fronts");

  const sizeSpec = $derived(CARD_SIZES[cardSize]);
  const layout = $derived(getPageLayout(cardSize));
  const sheetCount = $derived(Math.ceil(cardCount / layout.cardsPerPage));
```

Replace with:

```ts
  let selectedFormat = $state<ExportFormat>("fronts");
  let copies = $state(1);

  const sizeSpec = $derived(CARD_SIZES[cardSize]);
  const layout = $derived(getPageLayout(cardSize));

  // Sheets = Σ over colors of ceil(colorCount * copies / cardsPerPage), because
  // each color is padded to whole sheets. Falls back to a flat estimate when the
  // deck carries no element tags.
  const sheetCount = $derived.by(() => {
    const perPage = layout.cardsPerPage;
    const tagged = tndElements.filter((e): e is TnDElement => !!e);
    if (tagged.length === 0) {
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
```

- [ ] **Step 3: Annotate the element breakdown pills with per-color sheet counts**

Find the `elementCounts` derived block:

```ts
  const elementCounts = $derived.by(() => {
    const counts = new Map<string, { element: TnDElement; count: number }>();
    for (const el of tndElements) {
      if (!el) continue;
      const entry = counts.get(el.element);
      if (entry) entry.count++;
      else counts.set(el.element, { element: el, count: 1 });
    }
    return TND_ELEMENTS
      .filter((e) => counts.has(e.element))
      .map((e) => counts.get(e.element)!);
  });
```

Replace with:

```ts
  const elementCounts = $derived.by(() => {
    const counts = new Map<string, { element: TnDElement; count: number }>();
    for (const el of tndElements) {
      if (!el) continue;
      const entry = counts.get(el.element);
      if (entry) entry.count++;
      else counts.set(el.element, { element: el, count: 1 });
    }
    const perPage = layout.cardsPerPage;
    return TND_ELEMENTS
      .filter((e) => counts.has(e.element))
      .map((e) => {
        const { element, count } = counts.get(e.element)!;
        return { element, count, sheets: Math.ceil((count * copies) / perPage) };
      });
  });
```

Then find the element-pill markup:

```svelte
        {#each elementCounts as { element, count }}
          <div class="element-pill" style="--el-color: {element.accentColor}">
            <img
              src={element.iconPath}
              alt={element.element}
              class="element-icon"
              width="16"
              height="16"
            />
            <span class="element-count">{count}</span>
          </div>
        {/each}
```

Replace with:

```svelte
        {#each elementCounts as { element, count, sheets }}
          <div
            class="element-pill"
            style="--el-color: {element.accentColor}"
            title="{count} card{count === 1 ? '' : 's'} × {copies} = {sheets} sheet{sheets === 1 ? '' : 's'}"
          >
            <img
              src={element.iconPath}
              alt={element.element}
              class="element-icon"
              width="16"
              height="16"
            />
            <span class="element-count">{count} · {sheets}sh</span>
          </div>
        {/each}
```

- [ ] **Step 4: Add the "Copies per card" input, visible for PDF formats only**

Find the format-section closing — the `format-hint` paragraph and its closing `</div>`:

```svelte
      <p class="format-hint">
        {FORMAT_OPTIONS.find((f) => f.id === selectedFormat)?.getHint()}
      </p>
    </div>
```

Replace with:

```svelte
      <p class="format-hint">
        {FORMAT_OPTIONS.find((f) => f.id === selectedFormat)?.getHint()}
      </p>

      {#if selectedFormat !== "zip"}
        <div class="copies-row">
          <label class="copies-label" for="print-copies">Copies per card</label>
          <input
            id="print-copies"
            class="copies-input"
            type="number"
            min="1"
            step="1"
            bind:value={copies}
            onblur={() => { copies = Math.max(1, Math.floor(copies || 1)); }}
          />
        </div>
      {/if}
    </div>
```

- [ ] **Step 5: Pass copies through on export**

Find:

```ts
  function handleExport() {
    if (isExporting) return;
    if (selectedFormat === "zip") onExportZIP();
    else onExportPDF(selectedFormat);
  }
```

Replace with:

```ts
  function handleExport() {
    if (isExporting) return;
    const safeCopies = Math.max(1, Math.floor(copies || 1));
    if (selectedFormat === "zip") onExportZIP();
    else onExportPDF(selectedFormat, safeCopies);
  }
```

- [ ] **Step 6: Add styles for the copies row**

In the `<style>` block, immediately after the `.format-hint { ... }` rule, add:

```css
  .copies-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
  }

  .copies-label {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.6);
  }

  .copies-input {
    width: 80px;
    padding: 6px 10px;
    min-height: 36px;
    font-size: 14px;
    font-variant-numeric: tabular-nums;
    text-align: center;
    color: #fff;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
  }

  .copies-input:focus {
    outline: none;
    border-color: rgba(139, 92, 246, 0.5);
  }
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/choreo-card/components/print-preview/PrintDialog.svelte
git commit -m "feat(print): copies-per-card input + copies-aware per-element sheet estimate" -- src/lib/features/choreo-card/components/print-preview/PrintDialog.svelte
```

---

## Task 4: Thread copies + elements through ReviewStep

**Files:**
- Modify: `src/lib/features/choreo-card/components/deck-releaser/ReviewStep.svelte`

- [ ] **Step 1: Accept copies in `handleExportPDF` and pass options to the exporter**

Find:

```ts
  async function handleExportPDF(mode: PrintPDFMode = 'combined') {
    if (renderedPairs.length === 0) return;
    isExporting = true;
    exportError = "";
    exportProgress = 0;
    exportTotal = 0;
    try {
      const { exportHomePrintPDF } = await import("$lib/features/choreo-card/services/print-pdf-exporter");
      const deckName = `Deck_${String(nextDeckNumber).padStart(3, "0")}`;
      const suffix = mode === "fronts" ? "_fronts" : mode === "backs" ? "_backs" : "_print";
      const blob = await exportHomePrintPDF(renderedPairs, deckName, cardSize, (current, total) => {
        exportProgress = current;
        exportTotal = total;
      }, mode);
      triggerDownload(blob, `${deckName}${suffix}.pdf`);
    } catch (e) {
      exportError = `PDF export failed: ${e instanceof Error ? e.message : e}`;
    } finally {
      isExporting = false;
      exportProgress = 0;
      exportTotal = 0;
    }
  }
```

Replace with:

```ts
  async function handleExportPDF(mode: PrintPDFMode = 'combined', copies = 1) {
    if (renderedPairs.length === 0) return;
    isExporting = true;
    exportError = "";
    exportProgress = 0;
    exportTotal = 0;
    try {
      const { exportHomePrintPDF } = await import("$lib/features/choreo-card/services/print-pdf-exporter");
      const deckName = `Deck_${String(nextDeckNumber).padStart(3, "0")}`;
      const copiesSuffix = copies > 1 ? `_x${copies}` : "";
      const suffix = (mode === "fronts" ? "_fronts" : mode === "backs" ? "_backs" : "_print") + copiesSuffix;
      const blob = await exportHomePrintPDF(renderedPairs, deckName, cardSize, (current, total) => {
        exportProgress = current;
        exportTotal = total;
      }, mode, { copies, elements: tndElements });
      triggerDownload(blob, `${deckName}${suffix}.pdf`);
    } catch (e) {
      exportError = `PDF export failed: ${e instanceof Error ? e.message : e}`;
    } finally {
      isExporting = false;
      exportProgress = 0;
      exportTotal = 0;
    }
  }
```

Note: `tndElements` (line ~100, `const tndElements = $derived(elementSorted.tndElements)`) is parallel to `renderedPairs` because both derive from `sortedSequences`. The `PrintDialog`'s `onExportPDF` prop already passes `(mode, copies)` after Task 3, which matches the new `handleExportPDF` signature — no change needed at the `<PrintDialog onExportPDF={handleExportPDF} />` call site.

- [ ] **Step 2: Verify the render order assumption**

Confirm `renderedPairs` arrives in the same order as `sortedSequences` (so `tndElements` aligns). Read `PrintPreviewPages.svelte` and confirm `onPairsReady` emits pairs in the order of the `sequences` prop it was given.

Run: `grep -n "onPairsReady\|sequences\[" src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte`
Expected: pairs are built by iterating `sequences` in order (index-aligned). If the component reorders pairs, instead pass an element array reordered to match `renderedPairs`; document the fix in the commit. If it is index-aligned (expected), no code change — this step is verification only.

- [ ] **Step 3: Commit (only if Step 2 required a code change; otherwise fold into Task 3's verification)**

```bash
git add src/lib/features/choreo-card/components/deck-releaser/ReviewStep.svelte
git commit -m "feat(print): forward copies + element tags from ReviewStep to PDF exporter" -- src/lib/features/choreo-card/components/deck-releaser/ReviewStep.svelte
```

---

## Task 5: Full verification

**Files:** none (gates).

- [ ] **Step 1: Run the planner tests**

Run: `npx vitest run src/lib/features/choreo-card/services/__tests__/print-slot-planner.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 2: Full typecheck (one cold run, capture to log)**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "error" /tmp/check.log | grep -iE "print-pdf-exporter|print-slot-planner|PrintDialog|ReviewStep"`
Expected: no matching errors. If unrelated pre-existing errors appear elsewhere in the log, they are out of scope — confirm none touch the four changed files.

- [ ] **Step 3: Runtime verification (browser, with user permission)**

Open the app, go to **Choreo Cards → Deck Releaser**, select the "TKA One Learning Letters" release, open the print dialog, set Copies = 3, export **Combined PDF**. Open the PDF and confirm:
- Every front sheet contains exactly one element color.
- Sheet labels read e.g. `FRONTS · Fire · Sheet 4 of N`.
- Backs mirror correctly (column order reversed) and blank cells align front/back.
- Per-element pills in the dialog show `count · Nsh` and totals update live as Copies changes.

Per the project's browser-verification rule, ask the user before driving the browser. If not driving it yourself, state: "I cannot verify the PDF visually — please export Combined at Copies = 3 and confirm each sheet is a single color."

---

## Self-Review

**Spec coverage:**
- Copies (×N whole deck) → Task 1 (whole-block repeat), Task 3 (input), Task 4 (wiring). ✓
- One element per sheet / padding → Task 1 (pad to `cardsPerPage`), Task 2 (homogeneous pages). ✓
- Blank-slot handling, front/back alignment → Task 2 (`slot.pair` null skip, same grid index both sides). ✓
- Element-named sheet labels → Task 2 (`sheetSide`). ✓
- Embed-once performance → Task 2 (`frontImages`/`backImages` caches). ✓
- MPC ZIP untouched → copies input hidden for `zip`, `onExportZIP` unchanged. ✓
- Copies-aware sheet estimate + per-element annotation → Task 3. ✓
- Data plumbing (`{ copies, elements }`, sorted `tndElements`) → Task 2 (type), Task 4 (call). ✓
- Unit tests on the planner seam → Task 1. ✓

**Placeholder scan:** No TBD/TODO; all steps show concrete code or exact commands. ✓

**Type consistency:** `PrintSlot` { pair, elementName } defined in Task 1, consumed in Task 2. `planPrintSlots(pairs, elements, copies, cardsPerPage)` signature consistent across Task 1 and Task 2. `HomePrintOptions` { copies, elements } defined in Task 2, supplied in Task 4. `onExportPDF(mode, copies)` updated in Task 3 prop + Task 4 handler. ✓
