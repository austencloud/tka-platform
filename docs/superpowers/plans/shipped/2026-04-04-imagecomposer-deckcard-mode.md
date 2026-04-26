# ImageComposer Deck Card Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `deckCard` mode to the ImageComposer that renders sequence images at fixed playing card dimensions with consistent header/footer sizing and gray backgrounds, so all cards in a deck look uniform regardless of sequence length.

**Architecture:** The `deckCard` option on `SequenceExportOptions` provides fixed content dimensions (e.g. 750×1050 for poker). When set, the ImageComposer uses a fixed canvas size, proportional header/footer heights, backward-calculated `stepSize`, and gray header/footer backgrounds. The render-composition package gains `backgroundColor` and `borderColor` options. PrintCardRenderer passes the deckCard dimensions from CARD_SIZES.

**Tech Stack:** TypeScript, Canvas 2D API, @tka/render-composition package

**Spec:** `docs/superpowers/specs/2026-04-04-imagecomposer-deckcard-mode-design.md`

---

### Task 1: Add `backgroundColor` and `borderColor` to render-composition

**Files:**
- Modify: `packages/render-composition/src/header-renderer.ts`
- Modify: `packages/render-composition/src/footer-renderer.ts`

- [ ] **Step 1: Add `backgroundColor` and `borderColor` to `HeaderOptions`**

In `packages/render-composition/src/header-renderer.ts`, add two optional fields to the `HeaderOptions` interface:

```typescript
export interface HeaderOptions {
  canvasWidth: number;
  headerHeight: number;
  word: string;
  difficultyLevel?: number;
  showDifficultyBadge?: boolean;
  loopComponents?: Set<LOOPComponentId>;
  darkMode?: boolean;
  letterStyles?: LetterStyle[];
  /** Override header background color */
  backgroundColor?: string;
  /** Override header border color */
  borderColor?: string;
}
```

- [ ] **Step 2: Use `backgroundColor` and `borderColor` in `renderHeader()`**

Update the destructuring (line 22-26) to include new fields:

```typescript
const {
  canvasWidth, headerHeight, word,
  difficultyLevel = 1, showDifficultyBadge = true,
  loopComponents, darkMode = true, letterStyles,
  backgroundColor, borderColor,
} = options;
```

Update the background fill (line 29):

```typescript
ctx.fillStyle = backgroundColor ?? (darkMode ? "rgba(10, 10, 15, 0.98)" : "rgba(245, 245, 245, 0.98)");
```

Update the border stroke (line 33):

```typescript
ctx.strokeStyle = borderColor ?? (darkMode ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.1)");
```

- [ ] **Step 3: Add `backgroundColor` and `borderColor` to `FooterOptions`**

In `packages/render-composition/src/footer-renderer.ts`, add to the interface:

```typescript
export interface FooterOptions {
  canvasWidth: number;
  canvasHeight: number;
  footerHeight: number;
  userName?: string;
  notes?: string;
  birthday?: Date;
  darkMode?: boolean;
  showCreatorName?: boolean;
  showNotes?: boolean;
  showBirthday?: boolean;
  /** Override footer background color */
  backgroundColor?: string;
  /** Override footer border color */
  borderColor?: string;
}
```

- [ ] **Step 4: Use `backgroundColor` and `borderColor` in `renderFooter()`**

Add `backgroundColor, borderColor` to the destructuring. Update background fill (line 29):

```typescript
ctx.fillStyle = backgroundColor ?? (darkMode ? "rgba(10, 10, 15, 0.98)" : "rgba(245, 245, 245, 0.98)");
```

Update border stroke (line 33):

```typescript
ctx.strokeStyle = borderColor ?? (darkMode ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.1)");
```

- [ ] **Step 5: Run build check**

Run: `npm run check`
Expected: No new type errors

- [ ] **Step 6: Commit**

```bash
git add packages/render-composition/src/header-renderer.ts packages/render-composition/src/footer-renderer.ts
git commit -m "feat(render-composition): add backgroundColor and borderColor options to header/footer renderers

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Thread `backgroundColor` and `borderColor` through TextRenderer

**Files:**
- Modify: `src/lib/shared/render/services/implementations/TextRenderer.ts`

- [ ] **Step 1: Add parameters to `renderWordHeader()`**

Add `backgroundColor?: string` and `borderColor?: string` as the last parameters:

```typescript
renderWordHeader(
  canvas: HTMLCanvasElement,
  word: string,
  _options: TextRenderOptions,
  headerHeight: number,
  difficultyLevel: number = 1,
  showDifficultyBadge: boolean = true,
  darkMode: boolean = false,
  loopComponents?: Set<LOOPComponent>,
  backgroundColor?: string,
  borderColor?: string
): void {
```

Pass them through to `renderHeader()`:

```typescript
renderHeader(ctx, {
  canvasWidth: canvas.width,
  headerHeight,
  word: word ?? "",
  difficultyLevel,
  showDifficultyBadge,
  loopComponents: packageComponents,
  darkMode,
  backgroundColor,
  borderColor,
});
```

- [ ] **Step 2: Add parameters to `renderUserInfo()`**

Add `backgroundColor?: string` and `borderColor?: string` as the last parameters:

```typescript
renderUserInfo(
  canvas: HTMLCanvasElement,
  userInfo: UserExportInfo,
  _options: TextRenderOptions,
  footerHeight: number = 60,
  _beatCount: number = 3,
  darkMode: boolean = false,
  showFlags?: {
    showCreatorName?: boolean;
    showNotes?: boolean;
    showBirthday?: boolean;
  },
  customNotesText?: string,
  backgroundColor?: string,
  borderColor?: string
): void {
```

Pass them through to `renderFooter()`:

```typescript
renderFooter(ctx, {
  canvasWidth: canvas.width,
  canvasHeight: canvas.height,
  footerHeight,
  userName: userInfo.userName,
  notes,
  birthday,
  darkMode,
  showCreatorName,
  showNotes,
  showBirthday,
  backgroundColor,
  borderColor,
});
```

- [ ] **Step 3: Run build check**

Run: `npm run check`
Expected: No new type errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/render/services/implementations/TextRenderer.ts
git commit -m "feat(render): thread backgroundColor and borderColor through TextRenderer

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Add `deckCard` to SequenceExportOptions

**Files:**
- Modify: `src/lib/shared/render/domain/models/SequenceExportOptions.ts`

- [ ] **Step 1: Add the `deckCard` option**

Add after the `cardMode` field (line 107):

```typescript
/** Render at fixed playing card dimensions with consistent header/footer sizing.
 *  contentWidth/contentHeight = the content area inside the bleed (e.g. 750×1050 poker). */
deckCard?: {
  contentWidth: number;
  contentHeight: number;
};
```

- [ ] **Step 2: Run build check**

Run: `npm run check`
Expected: No new type errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/render/domain/models/SequenceExportOptions.ts
git commit -m "feat(render): add deckCard option to SequenceExportOptions

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Implement deckCard code path in ImageComposer

**Files:**
- Modify: `src/lib/shared/render/services/implementations/ImageComposer.ts`

This is the core task. When `options.deckCard` is set, the dimension pipeline changes completely.

- [ ] **Step 1: Add constants for deck card proportions**

Add near the top of the file, after the existing imports:

```typescript
// Deck card header/footer proportions (fraction of content width)
const DECK_HEADER_RATIO = 0.133;
const DECK_FOOTER_RATIO = 0.067;
const DECK_HEADER_BG = "#808080";
const DECK_BORDER_COLOR = "rgba(0, 0, 0, 0.25)";
```

- [ ] **Step 2: Add the deckCard branch in `composeSequenceImage()`**

In `composeSequenceImage()`, after the layout calculation (line 245 `}`) and before the dimension calculation (line 247 `// Step 2: Calculate canvas dimensions`), add the deckCard branch. The key is to replace the dimension calculation, canvas creation, and header/footer heights — then rejoin the existing rendering pipeline.

Find this block (lines 247-292):

```typescript
// Step 2: Calculate canvas dimensions including title space
const baseBeatSize = options.stepSize || 120;
const stepSize = Math.floor(baseBeatSize * (options.stepScale || 1));
const canvasWidth = columns * stepSize;
```

Replace the entire dimension calculation section (lines 247-292) with:

```typescript
// Step 2: Calculate canvas dimensions
let stepSize: number;
let canvasWidth: number;
let canvasHeight: number;
let headerHeight: number;
let footerHeight: number;

if (options.deckCard) {
  // ── Deck card mode: fixed canvas, proportional header/footer ──
  const { contentWidth, contentHeight } = options.deckCard;
  canvasWidth = contentWidth;

  // Fixed header/footer heights proportional to card width
  headerHeight = showHeaderForLayout
    ? Math.floor(contentWidth * DECK_HEADER_RATIO)
    : 0;
  footerHeight = hasAnyFooterContent
    ? Math.floor(contentWidth * DECK_FOOTER_RATIO)
    : 0;

  // Calculate stepSize backwards from available grid space
  const availableHeight = contentHeight - headerHeight - footerHeight;
  stepSize = Math.floor(Math.min(contentWidth / columns, availableHeight / rows));

  // Canvas height is the full card content height
  canvasHeight = contentHeight;
} else {
  // ── Standard mode: dimensions from stepSize ──
  const baseBeatSize = options.stepSize || 120;
  stepSize = Math.floor(baseBeatSize * (options.stepScale || 1));
  canvasWidth = columns * stepSize;

  headerHeight = showHeaderForLayout
    ? this.calculateHeaderHeight(stepCount, stepSize, columns)
    : 0;
  footerHeight = hasAnyFooterContent
    ? this.calculateFooterHeight(stepSize, columns)
    : 0;

  canvasHeight = rows * stepSize + headerHeight + footerHeight;
}
```

The rest of the method (canvas creation, background fill, pictograph rendering, header/footer rendering) stays the same since it all uses the `stepSize`, `headerHeight`, `footerHeight`, `canvasWidth`, and `canvasHeight` variables.

- [ ] **Step 3: Pass backgroundColor and borderColor to header rendering**

Find the header rendering call (line 470-482):

```typescript
this.TextRenderer.renderWordHeader(
  canvas,
  displayName,
  {
    margin: options.margin || 0,
    stepScale: options.stepScale || 1,
  },
  headerHeight,
  difficultyLevel,
  options.addDifficultyLevel,
  isDarkMode,
  showLoopGlyph ? loopComponents : undefined
);
```

Add the two new arguments at the end:

```typescript
this.TextRenderer.renderWordHeader(
  canvas,
  displayName,
  {
    margin: options.margin || 0,
    stepScale: options.stepScale || 1,
  },
  headerHeight,
  difficultyLevel,
  options.addDifficultyLevel,
  isDarkMode,
  showLoopGlyph ? loopComponents : undefined,
  options.deckCard ? DECK_HEADER_BG : undefined,
  options.deckCard ? DECK_BORDER_COLOR : undefined
);
```

- [ ] **Step 4: Pass backgroundColor and borderColor to footer rendering**

Find the footer rendering call (line 487-508):

```typescript
this.TextRenderer.renderUserInfo(
  canvas,
  { ... },
  { ... },
  footerHeight,
  stepCount,
  isDarkMode,
  { showCreatorName, showNotes, showBirthday },
  options.customNotesText
);
```

Add the two new arguments at the end:

```typescript
this.TextRenderer.renderUserInfo(
  canvas,
  {
    userName: options.userName || "",
    exportDate: options.exportDate || new Date().toISOString(),
    notes: options.notes || "",
    birthday: options.birthday,
  },
  {
    margin: options.margin || 10,
    stepScale: options.stepScale || 1,
  },
  footerHeight,
  stepCount,
  isDarkMode,
  { showCreatorName, showNotes, showBirthday },
  options.customNotesText,
  options.deckCard ? DECK_HEADER_BG : undefined,
  options.deckCard ? DECK_BORDER_COLOR : undefined
);
```

- [ ] **Step 5: Center the grid vertically in deck card mode**

In deck card mode, the grid (`rows * stepSize`) may be smaller than the available space. The grid background fill and pictograph rendering need a vertical offset.

Find the grid background fill (line 303-304):

```typescript
ctx.fillStyle = isDarkMode ? "#0a0a0f" : "white";
ctx.fillRect(0, headerHeight, canvasWidth, rows * stepSize);
```

Replace with:

```typescript
const gridHeight = rows * stepSize;
const gridOffsetY = options.deckCard
  ? headerHeight + Math.floor((canvasHeight - headerHeight - footerHeight - gridHeight) / 2)
  : headerHeight;

ctx.fillStyle = isDarkMode ? "#0a0a0f" : "white";
// In deck card mode, fill the entire area between header and footer white first
if (options.deckCard) {
  ctx.fillRect(0, headerHeight, canvasWidth, canvasHeight - headerHeight - footerHeight);
} else {
  ctx.fillRect(0, headerHeight, canvasWidth, gridHeight);
}
```

Then, everywhere `headerHeight` is used as the grid Y offset for rendering pictographs, it needs to use `gridOffsetY` instead. Search for all occurrences within `composeSequenceImage` where pictograph cells are positioned using `headerHeight` as a vertical offset. The key lines are:

- Line 353: `headerHeight, // Offset grid below header` → replace with `gridOffsetY,`
- Line 397: `headerHeight, // Offset grid below header` → replace with `gridOffsetY,`
- Line 407: `const y = row * stepSize + headerHeight;` → replace with `const y = row * stepSize + gridOffsetY;`
- Line 428: `headerHeight,` → replace with `gridOffsetY,`
- Line 444: `headerHeight, // Offset grid below header` → replace with `gridOffsetY,`

**Important:** Only replace the `headerHeight` references that offset the pictograph grid vertically. Do NOT replace the `headerHeight` used for the header rendering itself or for canvas height calculation.

- [ ] **Step 6: Run build check**

Run: `npm run check`
Expected: No new type errors

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/render/services/implementations/ImageComposer.ts
git commit -m "feat(render): implement deckCard mode in ImageComposer with fixed dimensions and gray header/footer

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Pass deckCard from PrintCardRenderer

**Files:**
- Modify: `src/lib/features/choreo-card/services/implementations/PrintCardRenderer.ts`

- [ ] **Step 1: Pass `deckCard` dimensions in the `composeSequenceImage` call**

In `renderFront()`, the content dimensions are already calculated:

```typescript
const contentW = canvasW - bleed * 2;
const contentH = canvasH - bleed * 2;
```

Add `deckCard` to the `composeSequenceImage` options object. Find the options object (starts around line 110) and add at the top level (NOT inside `visibilityOverrides`):

```typescript
const sequenceCanvas = await this.imageComposer.composeSequenceImage(sequence, {
  deckCard: { contentWidth: contentW, contentHeight: contentH },
  includeStartPosition: options.includeStartPosition,
  // ... rest of options unchanged
```

- [ ] **Step 2: Simplify the scaling since image is now at exact content dimensions**

Since the ImageComposer now produces an image at exactly `contentW × contentH`, the scaling math simplifies. Replace the current scaling block:

```typescript
const scaleX = contentW / sequenceCanvas.width;
const scaleY = contentH / sequenceCanvas.height;
const scale = Math.min(scaleX, scaleY);
const drawW = sequenceCanvas.width * scale;
const drawH = sequenceCanvas.height * scale;
const offsetX = bleed + (contentW - drawW) / 2;
const offsetY = bleed + (contentH - drawH) / 2;

ctx.drawImage(sequenceCanvas, offsetX, offsetY, drawW, drawH);
```

With:

```typescript
// deckCard mode produces an image at exact content dimensions — draw 1:1
ctx.drawImage(sequenceCanvas, bleed, bleed, contentW, contentH);
```

- [ ] **Step 3: Run build check**

Run: `npm run check`
Expected: No new type errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/choreo-card/services/implementations/PrintCardRenderer.ts
git commit -m "feat(choreo-card): pass deckCard dimensions from PrintCardRenderer for consistent card sizing

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Run All Tests and Final Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Run unit tests**

Run: `npx vitest run`
Expected: All tests pass (same pre-existing failures as before, no new failures)

- [ ] **Step 2: Run TypeScript check**

Run: `npm run check`
Expected: No new errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds
