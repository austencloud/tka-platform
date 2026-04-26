# MPC Print Prep Tab — Implementation Plan

Spec: `docs/superpowers/specs/2026-03-20-mpc-print-prep-tab-design.md`

## Steps

### Step 1: Add pdf-lib dependency

Install `pdf-lib` and verify build still passes.

```bash
npm install pdf-lib
npm run check
```

**Files:** `package.json`, `package-lock.json`

---

### Step 2: Tab registration and routing

Add the Print Prep tab to navigation and route it in the host component.

**Files:**
- `src/lib/shared/navigation/config/tab-definitions.ts` — add entry to `CHOREO_CARD_TABS`
- `src/lib/features/choreo-card/components/ChoreoCardTab.svelte` — add `"print-prep"` to `ChoreoCardMode` union, add routing in the template, pass `selectedDeckId` + `deckSequences` + deck metadata

**Stub:** Create `PrintPrepView.svelte` with a placeholder that shows "Print Prep — deck: {deckName}" or "No deck loaded" message. Verify the tab appears and switches correctly.

**Checkpoint:** Tab shows in nav, switches work, stub renders.

---

### Step 3: Service interfaces

Create all 4 service interfaces (no implementations yet).

**Files:**
- `src/lib/features/choreo-card/services/contracts/IPrintCardRenderer.ts`
- `src/lib/features/choreo-card/services/contracts/ICardBackCanvasRenderer.ts`
- `src/lib/features/choreo-card/services/contracts/IInfoCardCanvasRenderer.ts`
- `src/lib/features/choreo-card/services/contracts/IPrintPDFExporter.ts`

---

### Step 4: CardBackCanvasRenderer

The core new renderer. Draws CardBackV5 layout on canvas at 822x1122.

**Input:** `CardBackData` (from existing `deriveCardBackData()`), theme name, dimensions.

**What to draw (matching CardBackV5.svelte):**
1. Gradient border frame (4px, from `card-back-theme-visuals.ts`)
2. Themed background fill (inner area)
3. Corner badges:
   - Top-left: level circle with gradient fill + number
   - Top-right: LOOP icon strip (load SVG icons, draw on canvas)
   - Bottom-left: step count number + "steps" label
   - Bottom-right: start position glyph (load SVG from `/images/letters_trimmed/Type6/`)
4. Top center: "Choreo Card · TKA" branding
5. Center: word text (Georgia serif, large), pronunciation guide (if Greek letters)
6. Center lower: LOOP explanation text
7. Bottom center: "tkaflowarts.com"

**Key challenges:**
- Loading SVG files (position glyphs, LOOP icons) into canvas — use `Image()` with SVG src
- Gradient fills — canvas `createLinearGradient()` works natively
- Font rendering — use same font families as CardBackV5 (Georgia, Segoe UI, Cambria)

**File:** `src/lib/features/choreo-card/services/implementations/CardBackCanvasRenderer.ts`

**Checkpoint:** Unit-testable. Call it with sample CardBackData, verify canvas dimensions = 822x1122, spot-check key elements are drawn.

---

### Step 5: InfoCardCanvasRenderer

Static card pair for the "How to Read" / "Your Deck" reference cards.

**Files:** `src/lib/features/choreo-card/services/implementations/InfoCardCanvasRenderer.ts`

Similar approach to Step 4 but with fixed content from `InfoCardFront.svelte` and `InfoCardBack.svelte`. Since content is static, render once and cache the canvases.

**Checkpoint:** Both info cards render at 822x1122 with readable text.

---

### Step 6: PrintCardRenderer (orchestrator)

Ties together front rendering (via ImageComposer) and back rendering (via CardBackCanvasRenderer).

**Front rendering flow:**
1. Call `ImageComposer.composeSequenceImage()` with options configured for 750x1050 content area
2. Create 822x1122 canvas
3. Fill with edge-extended background color (sample corners of rendered image)
4. Draw the 750x1050 image centered (offset by 36px bleed on each side)

**Back rendering flow:**
1. Call `CardBackCanvasRenderer.render()` — already outputs 822x1122

**File:** `src/lib/features/choreo-card/services/implementations/PrintCardRenderer.ts`

**Checkpoint:** Given a SequenceData, produces two 822x1122 canvases (front + back).

---

### Step 7: PrintPDFExporter

Assembles card pair canvases into a single PDF.

**Flow:**
1. Create PDF via `pdf-lib`
2. For each CardPair: convert front canvas to PNG bytes, embed as page; same for back
3. Page size: 2.74" x 3.74" (822/300 x 1122/300 inches) = 197.28 x 269.28 points
4. Return PDF blob

**File:** `src/lib/features/choreo-card/services/implementations/PrintPDFExporter.ts`

**Checkpoint:** Generate a PDF with a few test cards, open in PDF viewer, verify dimensions.

---

### Step 8: DI registration

Register all 4 new services in the DI container.

**Files:**
- `src/lib/shared/di/containers/build-container.ts` — add service registrations near existing choreo card services (deckLoader, sequenceToEntryConverter, etc.)
- `src/lib/shared/di/container-types.ts` — add types to the items intersection

**Checkpoint:** `npm run check` passes, services resolve from `container.items.*`.

---

### Step 9: PrintPrepView.svelte (full UI)

Replace the stub with the real component.

**Layout:**
- Header: deck name, card count badge, info cards toggle, export PDF button
- Body: scrollable grid of front/back pairs, grouped by family with section headers
- Each pair: two canvases side-by-side (preview scaled to ~300px wide)

**Rendering flow on mount:**
1. If no deck: show empty state
2. If deck loaded: start rendering all pairs via `PrintCardRenderer`
3. Show progress: "Rendering card X of Y..."
4. As each pair completes, add it to the preview grid (progressive display)
5. When all done: enable export button

**Export flow:**
1. Disable button, show "Building PDF..."
2. Optionally prepend info card pair
3. Call `PrintPDFExporter.exportDeckPDF()`
4. Trigger browser download of the blob
5. Re-enable button

**File:** `src/lib/features/choreo-card/components/PrintPrepView.svelte`

**Checkpoint:** Load a deck, see all front/back pairs in preview, export PDF, verify in PDF viewer.

---

### Step 10: Verification & polish

- Verify PDF opens correctly in Adobe Reader / browser PDF viewer
- Verify card dimensions are exactly 822x1122 at 300 DPI
- Verify bleed zone has extended background (no white edges)
- Verify text stays within safe area
- Verify info cards appear first when toggle is on
- Verify family ordering is preserved
- Test with the L1 Quartered LOOP deck (192 sequences — stress test)
- Run `npm run check` and `npm run build`

---

## Parallel Execution Map

Steps 1-3 are sequential (foundation).
Steps 4 and 5 are independent (can parallel via subagents).
Step 6 depends on 4+5.
Step 7 is independent of 4-6 (just needs pdf-lib from step 1).
Step 8 depends on 3 (interfaces).
Step 9 depends on 6+7+8 (all services ready).
Step 10 depends on 9.

```
1 → 2 → 3 → 4 ─┐
                 ├→ 6 ─┐
            3 → 5 ─┘    ├→ 9 → 10
            1 → 7 ──────┘
            3 → 8 ──────┘
```
