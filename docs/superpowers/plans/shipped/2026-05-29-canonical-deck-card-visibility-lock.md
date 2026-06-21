# Canonical Deck-Card Visibility Lock — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock the released-deck / print-preview / Choreo-cards-tab render path to a single canonical playing-card visibility profile, sealed from the global `VisibilityStateManager`, so sequence-viewer toggles never leak onto printed cards.

**Architecture:** One frozen `CANONICAL_DECK_CARD_PROFILE` constant + a `buildCanonicalCardVisibility` builder is the only visibility source for the locked path (`PrintCardRenderer`). The user-facing pictograph-visibility toggles (Grid / HandPts / TKA / Word / QR) are removed from the Choreo-cards tab. The flexible sequence-viewer path (`ExportImagePanel`, `sequence-modal-exporter`) is untouched and keeps reading/writing the global vm.

**Tech Stack:** SvelteKit 5 (runes), TypeScript, Vitest, canvas/OffscreenCanvas render pipeline.

**Spec:** `docs/superpowers/specs/2026-05-29-canonical-deck-card-visibility-lock-design.md`

**⚠ Collision note:** `PrintCardRenderer.ts`, `PrintPreviewPages.svelte`, `CatalogBrowser.svelte` are being edited by a concurrent session (worker-pool refactor; it already reverted two interim edits). Confirm that session is idle before executing Tasks 2–5, or expect merge conflicts.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/lib/features/choreo-card/domain/canonical-card-visibility.ts` | The frozen profile + builder. Single source of the locked look. | Create |
| `src/lib/features/choreo-card/domain/__tests__/canonical-card-visibility.test.ts` | Unit test for the builder. | Create |
| `src/lib/features/choreo-card/services/PrintCardRenderer.ts` | Locked front render. Consumes the builder. | Modify |
| `src/lib/features/choreo-card/services/types.ts` | `PrintRenderOptions` — drop locked fields. | Modify |
| `src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte` | Stop passing locked fields; re-add `CARD_RENDER_SCHEMA`. | Modify |
| `src/lib/features/choreo-card/components/CatalogBrowser.svelte` | Stop threading locked props. | Modify |
| `src/routes/test/print-deck/+page.svelte` | Stop passing locked props. | Modify |
| `src/lib/features/choreo-card/components/ChoreoCardTab.svelte` | Remove locked visibility state + localStorage keys + prop wiring. | Modify |
| `src/lib/features/choreo-card/components/designer/DesignerSettingsSidebar.svelte` | Remove Grid/HandPts/TKA toggle UI + handlers. | Modify |
| `src/lib/features/choreo-card/components/ChoreoCardVisibility.svelte` | Remove Grid/HandPts/TKA chips (or delete if unused after). | Modify |
| `src/lib/features/choreo-card/components/CardDesigner.svelte` | Remove the locked `$derived` + props passed to preview. | Modify |
| `src/lib/features/choreo-card/components/ChoreoCardExport.svelte` | Route download visibility through the canonical builder. | Modify |
| `src/lib/shared/render/services/image-composer.ts` | Dev-warn tripwire for partial `deckCard` overrides. | Modify |

---

### Task 1: Canonical profile constant + builder

**Files:**
- Create: `src/lib/features/choreo-card/domain/canonical-card-visibility.ts`
- Test: `src/lib/features/choreo-card/domain/__tests__/canonical-card-visibility.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/features/choreo-card/domain/__tests__/canonical-card-visibility.test.ts
import { describe, it, expect } from "vitest";
import {
  CANONICAL_DECK_CARD_PROFILE,
  buildCanonicalCardVisibility,
} from "../canonical-card-visibility";

describe("canonical deck-card visibility", () => {
  it("freezes the profile so callers cannot mutate the locked look", () => {
    expect(Object.isFrozen(CANONICAL_DECK_CARD_PROFILE)).toBe(true);
  });

  it("locks the Choreo parts to the fixed playing-card values", () => {
    const { visibilityOverrides: v } = buildCanonicalCardVisibility({});
    expect(v.showGrid).toBe(true);
    expect(v.showTKA).toBe(true);
    expect(v.handPointVisibility).toBe("all");
    expect(v.showReversals).toBe(true);
    expect(v.showQRCode).toBe(true);
    expect(v.showNonRadialPoints).toBe(false);
    expect(v.showPositions).toBe(false);
    expect(v.showTnD).toBe(false);
    expect(v.printMode).toBe(true);
    expect(v.darkMode).toBe(false);
  });

  it("always shows the word", () => {
    expect(buildCanonicalCardVisibility({}).addWord).toBe(true);
  });

  it("enables the in-cell element glyph only for TnD-deck cards", () => {
    expect(buildCanonicalCardVisibility({}).visibilityOverrides.showElemental).toBe(false);
    expect(
      buildCanonicalCardVisibility({ tndElement: { familyId: "water" } as never })
        .visibilityOverrides.showElemental,
    ).toBe(true);
  });

  it("passes prop-type overrides through when provided", () => {
    const { visibilityOverrides: v } = buildCanonicalCardVisibility({
      bluePropType: "fan" as never,
      redPropType: "staff" as never,
    });
    expect(v.bluePropType).toBe("fan");
    expect(v.redPropType).toBe("staff");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/features/choreo-card/domain/__tests__/canonical-card-visibility.test.ts`
Expected: FAIL — cannot resolve `../canonical-card-visibility`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/features/choreo-card/domain/canonical-card-visibility.ts
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { TnDElement } from "./tnd-element";

/**
 * The fixed playing-card look for every LOCKED choreo-card render: released
 * decks, print preview, deck releaser, the whole Choreo-cards tab. This is the
 * single source of truth — change the card look by editing this one object.
 *
 * NOT used by the flexible sequence-viewer download (that reads the global
 * VisibilityStateManager). Keep the two domains separate on purpose.
 */
export const CANONICAL_DECK_CARD_PROFILE = Object.freeze({
  // Pictograph "Choreo parts"
  showGrid: true,
  showTKA: true,
  handPointVisibility: "all" as const,
  showNonRadialPoints: false,
  showReversals: true,
  showPositions: false,
  showTnD: false,
  // Composition flags that are always-on for deck cards
  addWord: true,
  showQRCode: true,
});

export interface CanonicalCardVisibility {
  /** Top-level compose option (NOT a visibilityOverrides member). */
  addWord: boolean;
  /** Spread into composeOptions.visibilityOverrides. */
  visibilityOverrides: {
    showGrid: boolean;
    showTKA: boolean;
    handPointVisibility: "all" | "active" | "none";
    showNonRadialPoints: boolean;
    showReversals: boolean;
    showPositions: boolean;
    showTnD: boolean;
    showElemental: boolean;
    showQRCode: boolean;
    printMode: boolean;
    darkMode: boolean;
    bluePropType?: PropType;
    redPropType?: PropType;
  };
}

/**
 * Build the complete locked visibility set for one card. `showElemental` is the
 * only per-card value: TnD-deck cards show each pictograph's element glyph.
 */
export function buildCanonicalCardVisibility(args: {
  tndElement?: TnDElement | null;
  bluePropType?: PropType;
  redPropType?: PropType;
}): CanonicalCardVisibility {
  return {
    addWord: CANONICAL_DECK_CARD_PROFILE.addWord,
    visibilityOverrides: {
      showGrid: CANONICAL_DECK_CARD_PROFILE.showGrid,
      showTKA: CANONICAL_DECK_CARD_PROFILE.showTKA,
      handPointVisibility: CANONICAL_DECK_CARD_PROFILE.handPointVisibility,
      showNonRadialPoints: CANONICAL_DECK_CARD_PROFILE.showNonRadialPoints,
      showReversals: CANONICAL_DECK_CARD_PROFILE.showReversals,
      showPositions: CANONICAL_DECK_CARD_PROFILE.showPositions,
      showTnD: CANONICAL_DECK_CARD_PROFILE.showTnD,
      showElemental: args.tndElement != null,
      showQRCode: CANONICAL_DECK_CARD_PROFILE.showQRCode,
      printMode: true,
      darkMode: false,
      ...(args.bluePropType && { bluePropType: args.bluePropType }),
      ...(args.redPropType && { redPropType: args.redPropType }),
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/features/choreo-card/domain/__tests__/canonical-card-visibility.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/domain/canonical-card-visibility.ts src/lib/features/choreo-card/domain/__tests__/canonical-card-visibility.test.ts
git commit -m "feat(choreo-card): canonical deck-card visibility profile + builder" -- src/lib/features/choreo-card/domain/canonical-card-visibility.ts src/lib/features/choreo-card/domain/__tests__/canonical-card-visibility.test.ts
```

---

### Task 2: PrintCardRenderer consumes the canonical builder

**Files:**
- Modify: `src/lib/features/choreo-card/services/PrintCardRenderer.ts:111-162`

- [ ] **Step 1: Add the import**

At the top of `PrintCardRenderer.ts`, after the existing imports, add:

```ts
import { buildCanonicalCardVisibility } from "../domain/canonical-card-visibility";
```

- [ ] **Step 2: Replace the compose options' visibility + word with the canonical set**

In `renderFront`, replace the `composeOptions` fields `addWord` (line 117) and the entire `visibilityOverrides` object (lines 146-161) so they come from the builder. The resulting `composeOptions` block becomes:

```ts
    const canonical = buildCanonicalCardVisibility({
      tndElement: options.tndElement,
      bluePropType: options.bluePropType,
      redPropType: options.redPropType,
    });

    const composeOptions: Partial<SequenceExportOptions> = {
      deckCard: { contentWidth: contentW, contentHeight: contentH },
      includeStartPosition: options.includeStartPosition,
      startPositionLayout: options.startPositionLayout ?? "row",
      addStepNumbers: true,
      addWord: canonical.addWord,
      addDifficultyLevel: false,
      stepSize: 300,
      stepScale: 1,
      margin: 0,
      format: "PNG",
      quality: 1,
      scale: 1,
      redVisible: true,
      blueVisible: true,
      addReversalSymbols: true,
      combinedGrids: false,
      userName: sequence.author ?? "",
      exportDate: new Date().toISOString(),
      notes: options.notes ?? "",
      showCreatorName: !!options.leftLabel,
      showNotes: !!(options.notes || options.leftLabel || options.rightLabel || options.iconPath),
      showBirthday: false,
      leftLabel: options.leftLabel,
      rightLabel: options.rightLabel,
      iconPath: options.iconPath,
      accentColor: options.tndElement?.accentColor,
      accentTintOpacity: options.tndElement?.cardTintOpacity,
      loopType: sequence.loopType ?? undefined,
      showLoopGlyph: false,
      ...(options.bluePropType && { bluePropTypeOverride: options.bluePropType }),
      ...(options.redPropType && { redPropTypeOverride: options.redPropType }),
      ...(options.deckId && { deckId: options.deckId }),
      ...(options.deckName && { deckName: options.deckName }),
      visibilityOverrides: {
        ...canonical.visibilityOverrides,
        // showMandala stays deck-config (mandala fills in empty cells).
        showMandala: options.showMandala ?? false,
      },
    };
```

This deletes all reads of `options.showTKA / showGrid / showQRCode / showWord / handPointsVisible`. `showElemental` is now `tndElement != null` again (re-establishing the reverted edit), undistorted via the existing aspect fix in `canvas-2d-glyph-renderer`.

- [ ] **Step 3: Typecheck the file's package**

Run: `npm run check:fast`
Expected: no new errors in `PrintCardRenderer.ts`. (`options.showTKA` etc. are removed from `PrintRenderOptions` in Task 3 — until then they remain valid optional fields, so no error now.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/choreo-card/services/PrintCardRenderer.ts
git commit -m "feat(choreo-card): PrintCardRenderer renders from canonical profile" -- src/lib/features/choreo-card/services/PrintCardRenderer.ts
```

---

### Task 3: Drop locked fields from PrintRenderOptions + re-add cache schema

**Files:**
- Modify: `src/lib/features/choreo-card/services/types.ts:83-116`
- Modify: `src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte` (imports area, `buildRenderOptions`, `buildCacheKey`, Props)

- [ ] **Step 1: Remove the locked fields from `PrintRenderOptions`**

In `types.ts`, change the `PrintRenderOptions` interface — delete `showGrid`, `showTKA`, `showWord`, `handPointsVisible`, `showQRCode`. The interface becomes:

```ts
export interface PrintRenderOptions {
  canvasWidth?: number;
  canvasHeight?: number;
  bleedPx?: number;
  includeStartPosition: boolean;
  startPositionLayout?: "row" | "column";
  /** Override the default card back theme (e.g. "cosmic", "ocean") */
  theme?: string;
  /** Override prop types (reads from settings when not provided) */
  bluePropType?: PropType;
  redPropType?: PropType;
  /** TnD elemental theme for front frame coloring. Omit for neutral gray. */
  tndElement?: TnDElement;
  /** Show mandala fills in empty grid cells */
  showMandala?: boolean;
  /** Left-side footer label */
  leftLabel?: string;
  /** Right-side footer label */
  rightLabel?: string;
  /** Center footer text (overrides hardcoded notes) */
  notes?: string;
  /** Icon image path drawn on both sides of center text */
  iconPath?: string;
  /** Deck ID for QR attribution tracking */
  deckId?: string;
  /** Deck name for QR attribution tracking */
  deckName?: string;
}
```

- [ ] **Step 2: Stop `buildRenderOptions` setting the removed fields**

In `PrintPreviewPages.svelte`, in `buildRenderOptions` (around line 183), remove the `showGrid`, `showTKA`, `showWord`, `showQRCode`, `handPointsVisible` properties from the returned object. The return becomes:

```ts
    return {
      includeStartPosition,
      startPositionLayout:
        deckMode && stepCount != null
          ? getCatalogLayoutPolicy(stepCount)
          : stepCount != null
            ? imageComposition.getStartPositionLayoutForStepCount(stepCount)
            : imageComposition.startPositionLayout,
      showMandala: true,
      theme,
      tndElement: element,
      bluePropType: resolvedBlueProp,
      redPropType: resolvedRedProp,
      leftLabel: footer?.left,
      rightLabel: footer?.right,
      notes: footer?.center,
      iconPath: footer?.iconPath,
      bleedPx: 36,
      deckId,
      deckName,
    };
```

- [ ] **Step 3: Remove the locked Props + re-add the render-schema token to the cache key**

In `PrintPreviewPages.svelte`:

(a) Add the schema constant after the imports (it was reverted by the concurrent refactor):

```ts
  // Render-schema version baked into every card cache key (memory + IndexedDB).
  // Bump when rendered pixels change for reasons NOT captured by the keyed
  // options below — e.g. the canonical profile changes. Rotates all keys so
  // stale persisted renders self-invalidate.
  const CARD_RENDER_SCHEMA = "v2";
```

(b) In the `Props` interface delete `showGrid?`, `showTKA?`, `showWord?`, `handPointsVisible?`; in the destructured `$props()` defaults delete the same four (`showGrid = true,` etc.).

(c) In `buildCacheKey`, replace the head of `optsPart` (line 221-223) — drop the removed values, prepend the schema token:

```ts
    const optsPart = [
      CARD_RENDER_SCHEMA,
      cardSize, theme,
      (tndElements?.[index]?.familyId ?? tndElement?.familyId ?? "none"),
      resolvedBlueProp,
      resolvedRedProp,
      resolvedBackground,
      stepCount,
      footer?.left ?? "",
      footer?.center ?? "",
      footer?.right ?? "",
      layout,
      rerenderKey,
      hashSequenceContent(seq),
    ].join("|");
```

- [ ] **Step 4: Typecheck**

Run: `npm run check:fast`
Expected: errors ONLY at `PrintPreviewPages` call sites still passing the removed props (`CatalogBrowser`, `print-deck` route) — fixed in Tasks 4-5. No errors inside `types.ts` / `PrintCardRenderer.ts` / `PrintPreviewPages.svelte` themselves.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/services/types.ts src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte
git commit -m "refactor(choreo-card): drop locked visibility fields from print path; restore cache schema" -- src/lib/features/choreo-card/services/types.ts src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte
```

---

### Task 4: Stop call sites passing the removed PrintPreviewPages props

**Files:**
- Modify: `src/lib/features/choreo-card/components/CatalogBrowser.svelte` (both `<PrintPreviewPages>` sites + `<CardInspectModal>`)
- Modify: `src/routes/test/print-deck/+page.svelte` (the `<PrintPreviewPages>` site)

- [ ] **Step 1: Remove the props from both PrintPreviewPages instances in CatalogBrowser**

In `CatalogBrowser.svelte`, in each `<PrintPreviewPages … />` (the `print` and `grid` `displayMode` blocks), delete the lines `{handPointsVisible}`, `{showGrid}`, `{showTKA}`, `{showWord}`. Keep `{includeStartPosition}`.

- [ ] **Step 2: Remove the same props from print-deck route**

In `src/routes/test/print-deck/+page.svelte`, in the `<PrintPreviewPages … />`, delete `showGrid={true}`, `showTKA={true}`, `showWord={true}`, `handPointsVisible={true}`. Keep `includeStartPosition={true}`.

- [ ] **Step 3: Decide CatalogBrowser's own props**

`CatalogBrowser` still receives `handPointsVisible` / `showGrid` / `showTKA` / `showWord` from `ChoreoCardTab` (removed in Task 5). For now leave `CatalogBrowser`'s `Props` declarations; Task 5 removes the parent wiring and then these become unused. To avoid an unused-prop warning churn, delete the now-unused props from `CatalogBrowser`'s `interface Props` and `$props()` destructure (`handPointsVisible`, `showGrid`, `showTKA`, `showWord`) and any remaining `{handPointsVisible}` etc. forwarded to `CardInspectModal` / `TnDFamilyDrillDown` / `deckInterior` snippet. Keep `includeStartPosition`.

- [ ] **Step 4: Typecheck**

Run: `npm run check:fast`
Expected: errors now only at `ChoreoCardTab` (still passing removed props to `CatalogBrowser`) — fixed in Task 5.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/components/CatalogBrowser.svelte src/routes/test/print-deck/+page.svelte
git commit -m "refactor(choreo-card): stop threading locked visibility props to print preview" -- src/lib/features/choreo-card/components/CatalogBrowser.svelte src/routes/test/print-deck/+page.svelte
```

---

### Task 5: Remove locked visibility state from ChoreoCardTab

**Files:**
- Modify: `src/lib/features/choreo-card/components/ChoreoCardTab.svelte`

- [ ] **Step 1: Delete the state + storage keys + migration entries**

Remove these `STORAGE_KEY_*` consts and their `LEGACY_KEYS` map entries: `STORAGE_KEY_HAND_POINTS`, `STORAGE_KEY_SHOW_GRID`, `STORAGE_KEY_SHOW_TKA`, `STORAGE_KEY_SHOW_WORD`, `STORAGE_KEY_SHOW_QR`. Delete the `$state` declarations `handPointsVisible`, `showGrid`, `showTKA`, `showWord`, `showQRCodes` (lines ~130-136). Keep `includeStartPosition` (deck-config-adjacent, out of scope).

- [ ] **Step 2: Remove the props passed to CatalogBrowser**

In the `mode === "catalogs"` block, delete `{handPointsVisible}`, `{showGrid}`, `{showTKA}`, `{showWord}` from `<CatalogBrowser … />`. Keep `{includeStartPosition}`.

- [ ] **Step 3: Remove the now-dead ChoreoCardExport import if unused**

`ChoreoCardExport` is imported (line 20) but is not rendered in the current template. Confirm with: `grep -n "ChoreoCardExport" src/lib/features/choreo-card/components/ChoreoCardTab.svelte`. If only the import line matches, delete the import. (Task 7 still updates `ChoreoCardExport.svelte` itself for any other caller.)

- [ ] **Step 4: Typecheck**

Run: `npm run check:fast`
Expected: no errors related to these files.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/components/ChoreoCardTab.svelte
git commit -m "refactor(choreo-card): remove locked visibility state from Choreo-cards tab" -- src/lib/features/choreo-card/components/ChoreoCardTab.svelte
```

---

### Task 6: Remove Grid/HandPts/TKA toggle UI (designer surfaces)

**Files:**
- Modify: `src/lib/features/choreo-card/components/designer/DesignerSettingsSidebar.svelte`
- Modify: `src/lib/features/choreo-card/components/ChoreoCardVisibility.svelte`
- Modify: `src/lib/features/choreo-card/components/CardDesigner.svelte`

- [ ] **Step 1: DesignerSettingsSidebar — delete the three toggles + handlers**

Remove the `handPointsOn` / `gridOn` / `tkaOn` derived values, the `toggleHandPoints` / `toggleGrid` / `toggleTka` functions (lines ~98-108), and their `<button>` rows in the Display section. Leave Word / StartPos / QR / Birthday / Theme intact (those are deck-config / composition, not pictograph "Choreo parts" — out of scope).

- [ ] **Step 2: ChoreoCardVisibility — remove the Grid / Hand Pts / TKA chips**

Delete the `ChipToggle` entries for `Hand Pts`, `Grid`, `TKA` and their click handlers (`handleHandPointsClick`, `handleShowGridClick`, `handleShowTKAClick`) plus the corresponding `Props` fields (`handPointsVisible`, `showGrid`, `showTKA`, `onHandPointsChange`, `onShowGridChange`, `onShowTKAChange`). Keep `Word` and `Start Pos`. If no chips remain that consumers use, leave the file (Word/StartPos remain).

- [ ] **Step 3: CardDesigner — drop the locked deriveds + preview props**

Remove the `handPointsVisible` and `showGrid` and `showTKA` `$derived` (lines ~143-145) and stop passing `{handPointsVisible} {showGrid} {showTKA}` into `<CardPreviewStack … />` (lines ~294-296) and into the `handleExport` `visibilityOverrides`. `CardPreviewStack` → `ChoreoCard` (features) defaults these to `true` in its own `Props`, so the locked preview renders the canonical look. For `handleExport`, route through the canonical builder (see Task 7 pattern) so the designer's own export matches.

- [ ] **Step 4: Typecheck**

Run: `npm run check:fast`
Expected: no errors. `CardPreviewStack`/`ChoreoCard` keep their optional props with `true` defaults.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/components/designer/DesignerSettingsSidebar.svelte src/lib/features/choreo-card/components/ChoreoCardVisibility.svelte src/lib/features/choreo-card/components/CardDesigner.svelte
git commit -m "refactor(choreo-card): remove pictograph-visibility toggles from designer surfaces" -- src/lib/features/choreo-card/components/designer/DesignerSettingsSidebar.svelte src/lib/features/choreo-card/components/ChoreoCardVisibility.svelte src/lib/features/choreo-card/components/CardDesigner.svelte
```

---

### Task 7: Route ChoreoCardExport download through the canonical builder

**Files:**
- Modify: `src/lib/features/choreo-card/components/ChoreoCardExport.svelte`

> Only needed if `ChoreoCardExport` is still rendered somewhere after Task 5. If `grep -rn "<ChoreoCardExport" src/` returns no usage, skip this task and note it.

- [ ] **Step 1: Import the builder**

```ts
import { buildCanonicalCardVisibility } from "../domain/canonical-card-visibility";
```

- [ ] **Step 2: Replace the renderOptions visibility with the canonical set**

The current `renderOptions.visibilityOverrides` (the `{ darkMode, printMode, showGrid, showTKA, ... }` block) becomes:

```ts
      const canonical = buildCanonicalCardVisibility({});
      const renderOptions = {
        stepSize: 300,
        format: "PNG" as const,
        quality: 1.0,
        includeStartPosition,
        addStepNumbers: true,
        addWord: canonical.addWord,
        addDifficultyLevel: false,
        addUserInfo: false,
        addReversalSymbols: true,
        visibilityOverrides: canonical.visibilityOverrides,
      };
```

Remove the now-unused `showGrid` / `showTKA` / `showWord` props from `ChoreoCardExport`'s `Props` and `$props()` (and from any parent that passed them).

- [ ] **Step 3: Typecheck**

Run: `npm run check:fast`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/choreo-card/components/ChoreoCardExport.svelte
git commit -m "refactor(choreo-card): ChoreoCardExport download uses canonical profile" -- src/lib/features/choreo-card/components/ChoreoCardExport.svelte
```

---

### Task 8: Dev-warn tripwire for partial deckCard overrides

**Files:**
- Modify: `src/lib/shared/render/services/image-composer.ts` (`getVisibilitySettings`, around line 113-153)

- [ ] **Step 1: Add the guard at the top of `getVisibilitySettings`**

Immediately inside `getVisibilitySettings(overrides)`, before the existing branch logic, add:

```ts
    // Tripwire: the LOCKED card path (deckCard / printMode) must pass a full,
    // explicit visibility set so it never inherits the global vm. If a deckCard
    // render arrives with partial overrides it would silently leak app-wide
    // toggles onto printed cards — warn loudly in dev.
    if (
      import.meta.env.DEV &&
      overrides?.printMode === true &&
      overrides.showNonRadialPoints === undefined
    ) {
      console.warn(
        "[ImageComposer] Locked card render passed partial visibilityOverrides " +
          "(showNonRadialPoints undefined) — it will inherit the global vm. " +
          "Use buildCanonicalCardVisibility() for deck/print renders.",
      );
    }
```

(Uses `printMode === true` + a missing canonical field as the "locked-intent but partial" signal. Behavior is unchanged — warn only.)

- [ ] **Step 2: Typecheck**

Run: `npm run check:fast`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/render/services/image-composer.ts
git commit -m "chore(render): dev-warn when a locked card render passes partial overrides" -- src/lib/shared/render/services/image-composer.ts
```

---

### Task 9: Full verification

- [ ] **Step 1: Full typecheck (capture once)**

Run: `npm run check > /tmp/check-canonical.log 2>&1; echo EXIT=$?`
Expected: EXIT=0, or only the pre-existing unrelated errors in `Viewer3DScene.svelte` / `columns-stepper.ts`. Confirm none of the touched files appear: `grep -iE "canonical|PrintCardRenderer|PrintPreviewPages|CatalogBrowser|ChoreoCardTab|DesignerSettingsSidebar|ChoreoCardVisibility|CardDesigner|ChoreoCardExport|image-composer" /tmp/check-canonical.log`.

- [ ] **Step 2: Unit tests**

Run: `npx vitest run src/lib/features/choreo-card/domain/__tests__/canonical-card-visibility.test.ts`
Expected: PASS.

- [ ] **Step 3: Runtime wall check (Chrome DevTools MCP — ask Austen first)**

With dev server on :5173: open the Choreo-cards tab catalogs view, note a card. In the sequence viewer, toggle non-radial ON. Return to the Choreo-cards tab — the card is unchanged (no non-radial dots). Toggle elemental in the viewer — deck cards unaffected; TnD-deck cards still show their element glyph fit to aspect. Capture a screenshot as evidence.

- [ ] **Step 4: Final commit (docs/state if any)**

No code commit here unless Step 1-3 surfaced fixes; those get their own commits.

---

## Self-Review

**Spec coverage:**
- Constant + builder → Task 1. ✅
- Locked path consumes only the builder → Task 2 (PrintCardRenderer) + Task 7 (ChoreoCardExport) + Task 6 (CardDesigner export). ✅
- Remove dead toggles (Grid/HandPts/TKA/Word/QR) → Tasks 3-6. ✅
- Dev-warn tripwire → Task 8. ✅
- Cache schema bump → Task 3 Step 3. ✅
- Sequence-viewer flexible path untouched → no task touches `ExportImagePanel` / `sequence-modal-exporter`. ✅
- start-position / theme stay deck-config → preserved in Task 2/3 (`includeStartPosition`, `startPositionLayout`, `theme` retained). ✅

**Placeholder scan:** No TBD/TODO; every code step shows the code. Task 7 is conditional with an explicit skip check.

**Type consistency:** `buildCanonicalCardVisibility` returns `{ addWord, visibilityOverrides }` in Task 1; consumed with that shape in Tasks 2 and 7. `CANONICAL_DECK_CARD_PROFILE` field names match the builder. `PrintRenderOptions` field removals (Task 3) align with the call-site removals (Tasks 4-6).

**Known scope note:** `includeStartPosition` user toggle is intentionally retained (spec leaves start-position to deck config; its boolean is low-risk and out of the named removal set). Flag to Austen if he wants it locked too.
