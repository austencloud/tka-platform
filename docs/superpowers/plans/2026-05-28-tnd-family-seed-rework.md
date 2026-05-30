# TnD By-Family Seed Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make TnD By-Family seeding work end-to-end: fix broken family data on existing variants, drive seeding from a family-card click with live progress, and center the stage.

**Architecture:** A one-time Node migration rebuilds the `families` array on 10 broken variant catalogs from their base continuous catalogs. The Svelte UI keys "needs seed" on six-family sequence totals (not catalog presence), moves the seed trigger onto the family-card click, surfaces `SeedProgress` live while disabling cards, and centers `.family-stage`.

**Tech Stack:** Node + firebase-admin (migration), Svelte 5 runes, existing `reversal-seed-service.ts` / `catalog-browse-state.svelte.ts`.

---

## Context for the implementer

- Live Firestore audit: base continuous catalogs `l1-tnd-motions` (uniform-0t) and `vtg-2to1-motions` (uniform-0.5t) carry six families with ids `split-same, tog-same, quarter-same, split-opp, tog-opp, quarter-opp`. Their reversal variants `{base}-book`, `{base}-red-book`, `{base}-blue-book`, `{base}-long-book`, `{base}-alternating` each have `families: [{ id: "unknown", ... , sequenceIds: [all 19] }]`. That single "unknown" family is the bug — the By-Family grid matches `theme.familyId` (one of the six) against `family.id`, so it never matches.
- Reversal preserves hand-path family membership and sequence ids, so the base's `families` array is exactly correct for the variant. The fix is a metadata copy, not a re-transform.
- `scripts/seed-reversal-decks.cjs` is the reference for firebase-admin init (`serviceAccountKey.json` at repo root, `admin.firestore()`), CLI arg parsing, and `--dry-run` convention. Catalogs live in the `decks` collection.
- `seedReversalPattern(baseCatalogs, pattern, onProgress)` (in `src/lib/features/choreo-card/services/reversal-seed-service.ts`) writes all base-variant catalogs for a pattern with correct six families and calls `onProgress({ written, total })` per catalog. `SeedProgress = { written: number; total: number; catalogId?: string }`.
- `TND_FAMILY_KEYS` is exported from `src/lib/features/choreo-card/state/catalog-browse-types.ts` and equals the six family ids above.
- `tndCatalogs` and `tndMaterializedCatalogs` (`tndCatalogs.filter(c => c.asymmetric !== true)`) already exist in `CatalogBrowser.svelte`.

---

## Task 1: One-time migration — rebuild broken `families`

**Files:**
- Create: `scripts/reseed-tnd-family-variants.cjs`

- [ ] **Step 1: Write the migration script**

```js
/**
 * One-time migration: rebuild the `families` array on TnD reversal variant
 * catalogs that were seeded with a single collapsed { id: "unknown" } family.
 *
 * Reversal preserves hand-path family membership and sequence ids, so the
 * correct families array is exactly the base continuous catalog's. We copy it.
 *
 * Usage:
 *   node scripts/reseed-tnd-family-variants.cjs            # apply
 *   node scripts/reseed-tnd-family-variants.cjs --dry-run  # preview only
 */
const admin = require("firebase-admin");
const path = require("path");

const serviceAccountPath = path.join(__dirname, "..", "serviceAccountKey.json");
let db;
try {
  const serviceAccount = require(serviceAccountPath);
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  db = admin.firestore();
} catch (error) {
  console.error("Failed to initialize Firebase:", error.message);
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");
const SIX_FAMILY_IDS = ["split-same", "tog-same", "quarter-same", "split-opp", "tog-opp", "quarter-opp"];
const PATTERN_SUFFIXES = ["book", "red-book", "blue-book", "long-book", "alternating"];

function hasSixFamilies(families) {
  if (!Array.isArray(families)) return false;
  const ids = new Set(families.map((f) => f.id));
  return SIX_FAMILY_IDS.every((id) => ids.has(id));
}

function resolveBaseId(doc) {
  if (doc.sourceDeck && !doc.sourceDeck.includes("-book") && !doc.sourceDeck.includes("alternating")) {
    // sourceDeck on these points at the continuous base (e.g. "l1-tnd-motions")
    return doc.sourceDeck;
  }
  // Fallback: strip the trailing -{pattern} suffix from the doc id.
  for (const suffix of PATTERN_SUFFIXES) {
    if (doc.id.endsWith(`-${suffix}`)) return doc.id.slice(0, -(suffix.length + 1));
  }
  return null;
}

async function main() {
  const snap = await db.collection("decks").where("collection", "==", "TnD").get();
  const byId = new Map();
  snap.forEach((d) => byId.set(d.id, { id: d.id, ...d.data() }));

  const broken = [...byId.values()].filter(
    (c) => c.asymmetric !== true && !hasSixFamilies(c.families),
  );

  let rewritten = 0, skipped = 0;
  for (const doc of broken) {
    const baseId = resolveBaseId(doc);
    const base = baseId ? byId.get(baseId) : null;
    if (!base || !hasSixFamilies(base.families)) {
      console.warn(`SKIP ${doc.id}: no base with six families (baseId=${baseId})`);
      skipped++;
      continue;
    }
    console.log(`${doc.id}: ${(doc.families ?? []).map((f) => f.id).join(",")} -> 6 families (from ${baseId})`);
    if (!DRY_RUN) {
      await db.collection("decks").doc(doc.id).update({ families: base.families });
    }
    rewritten++;
  }
  console.log(`\n${DRY_RUN ? "[dry-run] would rewrite" : "rewrote"} ${rewritten}, skipped ${skipped}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Dry-run to confirm targeting**

Run: `node scripts/reseed-tnd-family-variants.cjs --dry-run`
Expected: 10 lines `l1-tnd-motions-{pattern}` / `vtg-2to1-motions-{pattern}` showing `unknown -> 6 families`, then `[dry-run] would rewrite 10, skipped 0`.

- [ ] **Step 3: Apply the migration**

Run: `node scripts/reseed-tnd-family-variants.cjs`
Expected: `rewrote 10, skipped 0`.

- [ ] **Step 4: Verify via Firestore**

Re-run the dry-run: `node scripts/reseed-tnd-family-variants.cjs --dry-run`
Expected: `[dry-run] would rewrite 0, skipped 0` (idempotent — all now have six families).

- [ ] **Step 5: Commit**

```bash
git add scripts/reseed-tnd-family-variants.cjs
git commit -m "fix(choreo-card): migration to rebuild families on broken TnD reversal variants"
```

---

## Task 2: TnDFamilyCard presentational seed props

**Files:**
- Modify: `src/lib/features/choreo-card/components/TnDFamilyCard.svelte`

- [ ] **Step 1: Add props + seeding/needs-seed UI**

Update the `Props` interface and destructure (keep existing `theme`, `ratioCount`, `sequenceCount`, `onSelect`):

```ts
  interface Props {
    theme: TnDElement;
    ratioCount: number;
    sequenceCount: number;
    onSelect: () => void;
    seeding?: boolean;
    seedProgress?: { written: number; total: number };
    disabled?: boolean;
    needsSeed?: boolean;
  }

  const {
    theme,
    ratioCount,
    sequenceCount,
    onSelect,
    seeding = false,
    seedProgress,
    disabled = false,
    needsSeed = false,
  }: Props = $props();
```

Add `disabled={disabled}` and `aria-busy={seeding}` to the `<button>`, and replace the footer `<span class="stat">` block with:

```svelte
  <div class="footer">
    {#if seeding}
      <span class="stat seeding">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        Seeding {seedProgress?.written ?? 0}/{seedProgress?.total ?? 0}
      </span>
    {:else if needsSeed}
      <span class="stat hint">Tap to seed</span>
    {:else}
      <span class="stat">{sequenceCount} sequences</span>
    {/if}
  </div>
```

Add to `<style>`:

```css
  .tnd-family-card:disabled { cursor: progress; opacity: 0.6; }
  .stat.hint { color: var(--accent); font-weight: 600; }
  .stat.seeding { color: var(--accent); display: inline-flex; align-items: center; gap: 6px; }
```

- [ ] **Step 2: Typecheck**

Run: `npx svelte-check --threshold error 2>&1 | grep TnDFamilyCard || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/TnDFamilyCard.svelte
git commit -m "feat(choreo-card): seeding/disabled/needs-seed states on TnDFamilyCard"
```

---

## Task 3: TnDFamilyGrid — forward seed flags + center stage + drop seedPanel

**Files:**
- Modify: `src/lib/features/choreo-card/components/TnDFamilyGrid.svelte`

- [ ] **Step 1: Replace Props + markup + stage CSS**

Replace the `Props` interface and destructure:

```ts
  interface Props {
    catalogs: Catalog[];
    onSelectFamily: (familyId: string) => void;
    activePatternId?: string | null;
    onPatternChange?: (resolved: import("../domain/reversal-transform").ResolvedReversalPattern) => void;
    needsSeed?: boolean;
    isSeeding?: boolean;
    seedingFamilyId?: string | null;
    seedProgress?: { written: number; total: number };
  }

  const {
    catalogs,
    onSelectFamily,
    activePatternId = null,
    onPatternChange,
    needsSeed = false,
    isSeeding = false,
    seedingFamilyId = null,
    seedProgress,
  }: Props = $props();
```

Replace the `.family-stage` block body (remove the `seedPanel` render):

```svelte
<div class="family-stage">
  <div class="family-grid">
    {#each familyStats as { theme, ratioCount, sequenceCount } (theme.familyId)}
      <TnDFamilyCard
        {theme}
        {ratioCount}
        {sequenceCount}
        onSelect={() => onSelectFamily(theme.familyId)}
        seeding={isSeeding && seedingFamilyId === theme.familyId}
        {seedProgress}
        disabled={isSeeding}
        needsSeed={needsSeed && !isSeeding}
      />
    {/each}
  </div>
  {#if onPatternChange}
    <TnDReversalStrip {activePatternId} {onPatternChange} />
  {/if}
</div>
```

Change `.family-stage` CSS to vertically center:

```css
  .family-stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 28px;
    min-height: calc(100vh - 160px);
    padding: 40px 24px;
    box-sizing: border-box;
  }
```

Keep the existing `@media (max-width: 768px)` rule that sets `.family-stage { min-height: 0; padding: 20px 16px; }`.

Remove the `seedPanel` from the `import("svelte").Snippet` prop and the `{#if seedPanel}{@render seedPanel()}{/if}` line (done above).

- [ ] **Step 2: Typecheck**

Run: `npx svelte-check --threshold error 2>&1 | grep TnDFamilyGrid || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/TnDFamilyGrid.svelte
git commit -m "feat(choreo-card): center family stage, forward seed flags, drop seed panel"
```

---

## Task 4: CatalogBrowseGrid — forward seed flags, drop seedPanel

**Files:**
- Modify: `src/lib/features/choreo-card/components/CatalogBrowseGrid.svelte`

- [ ] **Step 1: Update Props + destructure + family-grid branch**

In the `Props` interface, replace the `seedPanel?` line with the seed-flag props:

```ts
    activePatternId?: string | null;
    onPatternChange?: (resolved: import("../domain/reversal-transform").ResolvedReversalPattern) => void;
    needsSeed?: boolean;
    isSeeding?: boolean;
    seedingFamilyId?: string | null;
    seedProgress?: { written: number; total: number };
```

Update the destructure to drop `seedPanel` and add the new defaults:

```ts
  const {
    groupedCatalogs,
    collection,
    tndViewMode = 'turns',
    allTnDCatalogs = [],
    onSelectCatalog,
    onSelectFamily,
    activePatternId = null,
    onPatternChange,
    needsSeed = false,
    isSeeding = false,
    seedingFamilyId = null,
    seedProgress,
  }: Props = $props();
```

Replace the family-grid branch:

```svelte
{:else if collection === 'TnD' && tndViewMode === 'family'}
  <TnDFamilyGrid
    catalogs={allTnDCatalogs}
    onSelectFamily={(id) => onSelectFamily?.(id)}
    {activePatternId}
    onPatternChange={(r) => onPatternChange?.(r)}
    {needsSeed}
    {isSeeding}
    {seedingFamilyId}
    {seedProgress}
  />
```

- [ ] **Step 2: Typecheck**

Run: `npx svelte-check --threshold error 2>&1 | grep CatalogBrowseGrid || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/CatalogBrowseGrid.svelte
git commit -m "feat(choreo-card): forward seed flags through CatalogBrowseGrid, drop seed panel"
```

---

## Task 5: CatalogBrowser — six-family needsSeed + seed-on-click

**Files:**
- Modify: `src/lib/features/choreo-card/components/CatalogBrowser.svelte`

- [ ] **Step 1: Add import for `TND_FAMILY_KEYS`**

At the top with the other imports from the browse-state module, ensure `TND_FAMILY_KEYS` is imported from `../state/catalog-browse-types` (add it to the existing import from that file, or add a new import line):

```ts
  import { TND_FAMILY_KEYS } from "../state/catalog-browse-types";
```

- [ ] **Step 2: Replace `needsSeed` + add `seedingFamilyId` + seed-aware handler; remove `runSeed`**

Replace the existing `needsSeed` derivation (currently keyed on `filteredCatalogs.length === 0`) and the `runSeed` function with:

```ts
  let seedingFamilyId = $state<string | null>(null);

  const activeFamilySequenceTotal = $derived(
    browseState.filteredCatalogs
      .filter((c) => c.asymmetric !== true)
      .reduce(
        (sum, c) =>
          sum +
          TND_FAMILY_KEYS.reduce(
            (s, key) => s + ((c.families ?? []).find((f) => f.id === key)?.sequenceIds.length ?? 0),
            0,
          ),
        0,
      ),
  );

  const needsSeed = $derived(
    activeReversal?.isCleanLoop === true &&
      activeReversal.id !== "continuous" &&
      activeFamilySequenceTotal === 0,
  );

  async function handleSelectFamily(familyId: string) {
    if (needsSeed && activeReversal && !isSeeding) {
      isSeeding = true;
      seedingFamilyId = familyId;
      seedError = "";
      try {
        await seedReversalPattern(tndMaterializedCatalogs, activeReversal, (p) => { seedProgress = p; });
        const { loadCatalogs } = await import("../services/catalog-loader");
        await loadCatalogs();
        toast.success("Pattern seeded.");
      } catch (err) {
        seedError = `Seed failed: ${err instanceof Error ? err.message : err}`;
        toast.error("Seeding failed.");
        isSeeding = false;
        seedingFamilyId = null;
        seedProgress = { written: 0, total: 0 };
        return;
      }
      isSeeding = false;
      seedingFamilyId = null;
      seedProgress = { written: 0, total: 0 };
    }
    activeTnDFamilyId = familyId;
  }
```

Keep the existing `activeReversal`, `isSeeding`, `seedProgress`, `seedError`, `tndMaterializedCatalogs`, and `handlePatternChange` declarations as they are.

- [ ] **Step 3: Remove the `seedPanel` snippet block**

Grep for the snippet and delete the entire block:

Run: `grep -n "snippet seedPanel" src/lib/features/choreo-card/components/CatalogBrowser.svelte`
Delete from `{#snippet seedPanel()}` through its closing `{/snippet}` (and the `.seed-panel` / `.seed-text` / `.seed-progress` / `.seed-btn` / `.seed-error` CSS rules added for it).

- [ ] **Step 4: Rewire the `<CatalogBrowseGrid>` family props**

Replace the family-related props on the browse-branch `<CatalogBrowseGrid …>` (around line 599):

```svelte
      onSelectFamily={handleSelectFamily}
      activePatternId={activeReversal?.id ?? null}
      onPatternChange={handlePatternChange}
      {needsSeed}
      {isSeeding}
      {seedingFamilyId}
      {seedProgress}
```

(Remove the old `onSelectFamily={(familyId) => { activeTnDFamilyId = familyId; }}` and `{seedPanel}`.)

- [ ] **Step 5: Typecheck**

Run: `npx svelte-check --threshold error 2>&1 | grep CatalogBrowser.svelte || echo "clean"`
Expected: `clean`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/choreo-card/components/CatalogBrowser.svelte
git commit -m "feat(choreo-card): seed-on-family-click with six-family detection, remove seed panel"
```

---

## Task 6: Manual browser verification

- [ ] **Step 1: Verify (orchestrator asks the user)**

Load `localhost:5173/choreo_card/catalogs` → TnD → By Family:
1. Stage is vertically centered (cards + strip mid-viewport, not hugging the top).
2. Continuous selected → six cards show base counts.
3. Select **Book** (post-migration) → six cards show counts > 0 matching the base per-family counts; clicking a card opens that family's drilldown directly (no seed).
4. Toggle a custom even-count pattern with no data → cards show "Tap to seed". Click **Water** → that card shows `Seeding N/M` advancing, all cards disabled → on completion cards repopulate → Water drilldown opens.
5. Toggle an odd-count pattern → strip badge "Boundary discontinuity"; cards unchanged; no seed.

---

## Self-Review

**Spec coverage:**
- §Component 1 migration → Task 1.
- §Component 2 needsSeed → Task 5 Step 2.
- §Component 3 family-click seed → Task 5 Step 2/4.
- §Component 4 progress + disabled → Task 2 + Task 3 (forwarding) + Task 4 (forwarding) + Task 5 (state).
- §Component 5 centered layout → Task 3 Step 1.
- Remove seedPanel → Task 3, 4, 5.

**Placeholder scan:** none — all steps carry full code/commands.

**Type consistency:** `seedProgress: { written: number; total: number }` threaded identically through Tasks 2–5; `seedingFamilyId: string | null`, `isSeeding: boolean`, `needsSeed: boolean` consistent. `handleSelectFamily` defined in Task 5 and wired to `onSelectFamily` there. `TND_FAMILY_KEYS` import added in Task 5 Step 1. `tndMaterializedCatalogs` reused (already defined). `SIX_FAMILY_IDS` in the migration matches `TND_FAMILY_KEYS` values.
