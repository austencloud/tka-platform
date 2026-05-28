# Level 1 Guide — Interactive HTML Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dead-PNG guide with a live-SVG interactive web textbook powered by the existing PictographRenderer pipeline.

**Architecture:** SvelteKit route group with 4 routes (landing + 3 chapter pages). Shared guide components wrap `PictographRenderer` + `PictographPreparer` for live SVG. Static JSON data generated once from CSV, committed to repo. Each chapter is a continuous-scroll page; chapters are discrete route transitions. Sidebar nav with scroll-spy highlighting.

**Tech Stack:** SvelteKit 2, Svelte 5, PictographRenderer pipeline, PictographPreparer (async), static JSON from DiamondPictographDataframe.csv, CSS grid, IntersectionObserver.

**Spec:** `docs/superpowers/specs/2026-04-24-level-1-guide-redesign.md`

---

## File Structure

### Deleted (4.7's work — 90+ files)

```
src/routes/(public)/guide/level-1/
  +page.svelte, +page.ts, +page.server.ts
  compare/+page.svelte, compare/+page.ts
  _pages/*.svelte                           (47 files)
  _lib/*.svelte, _lib/*.ts                  (21 files)
  _lib/editor/*.svelte, _lib/editor/*.ts    (9 files)
  _data/page-*.json                         (10 files)
src/routes/api/guide/level-1/
  page/[n]/+server.ts
  library/+server.ts
```

### Created

```
src/routes/(public)/guide/level-1/
├── +page.svelte                            (landing)
├── +page.ts                                (prerender)
├── +layout.svelte                          (guide layout: sidebar + content)
├── positions-motions/
│   ├── +page.svelte                        (Chapter 1.0 — imports sections)
│   └── +page.ts
├── letters/
│   ├── +page.svelte                        (Chapter 1.1)
│   └── +page.ts
├── words/
│   ├── +page.svelte                        (Chapter 1.2)
│   └── +page.ts
├── _components/
│   ├── GuidePictograph.svelte              (PictographRenderer wrapper)
│   ├── GuidePictographGrid.svelte          (labeled CSS grid of pictographs)
│   ├── GuideSequencePlayer.svelte          (horizontal strip + playback)
│   ├── GuideDiagram.svelte                 (static img with caption)
│   ├── GuideSection.svelte                 (section wrapper + IntersectionObserver)
│   └── GuideNav.svelte                     (sidebar navigation)
├── _data/
│   ├── guide-types.ts                      (GuideChapterData, nav config types)
│   ├── guide-data-context.ts               (Svelte context for data lookup)
│   ├── nav-config.ts                       (chapter/section nav structure)
│   ├── positions-motions.json              (generated — Ch 1.0 pictograph data)
│   ├── letters.json                        (generated — Ch 1.1)
│   └── words.json                          (generated — Ch 1.2)
├── _sections/
│   ├── ch10/                               (Chapter 1.0 sections)
│   │   ├── TheGrid.svelte
│   │   ├── HandPositions.svelte
│   │   ├── HandMotions.svelte
│   │   ├── Type1AlphaBeta.svelte
│   │   ├── Type1Gamma.svelte
│   │   ├── Type2Shifts.svelte
│   │   ├── Type3CrossShifts.svelte
│   │   ├── Type4Dash.svelte
│   │   ├── Type5DualDash.svelte
│   │   ├── Type6Static.svelte
│   │   ├── StaffPositions.svelte
│   │   ├── StaffMotions.svelte
│   │   └── NegativeSpace.svelte
│   ├── ch11/                               (Chapter 1.1 sections — Phase 2)
│   │   ├── CodexType12.svelte
│   │   ├── CodexType36.svelte
│   │   ├── Type1Letters.svelte
│   │   ├── AlphaBetaWords.svelte
│   │   ├── CompoundLetters.svelte
│   │   ├── CompoundWords.svelte
│   │   ├── GammaLetters.svelte
│   │   ├── GammaWords.svelte
│   │   ├── Type2ShiftLetters.svelte
│   │   ├── Type3CrossShiftLetters.svelte
│   │   └── Type456Letters.svelte
│   └── ch12/                               (Chapter 1.2 sections — Phase 3)
│       ├── WordsIntro.svelte
│       ├── Caps.svelte
│       ├── Reversals.svelte
│       ├── AABBExamples.svelte
│       ├── AABBBodyTurn.svelte
│       ├── ACACBCBC.svelte
│       ├── Type1Caps.svelte
│       ├── GammaCaps.svelte
│       ├── Type2Caps.svelte
│       ├── SixteenCount.svelte
│       ├── EightLetterWords.svelte
│       ├── PropReversalCaps.svelte
│       └── FullReversalCaps.svelte
└── _styles/
    └── guide.css                           (guide typography, colors, layout)

scripts/
└── generate-guide-data.cjs                 (CSV → JSON generator)
```

---

## Phase 1: Scaffold + Shared Components + Chapter 1.0

### Task 1: Delete old guide code

**Files:**
- Delete: `src/routes/(public)/guide/level-1/_pages/` (entire directory, 47 files)
- Delete: `src/routes/(public)/guide/level-1/_lib/` (entire directory, 21 files)
- Delete: `src/routes/(public)/guide/level-1/_data/page-*.json` (10 files)
- Delete: `src/routes/(public)/guide/level-1/+page.svelte`
- Delete: `src/routes/(public)/guide/level-1/+page.ts`
- Delete: `src/routes/(public)/guide/level-1/+page.server.ts`
- Delete: `src/routes/(public)/guide/level-1/compare/` (entire directory)
- Delete: `src/routes/api/guide/level-1/` (entire directory)

- [ ] **Step 1: Delete all 4.7 code**

```bash
rm -rf src/routes/\(public\)/guide/level-1/_pages
rm -rf src/routes/\(public\)/guide/level-1/_lib
rm -rf src/routes/\(public\)/guide/level-1/compare
rm -rf src/routes/api/guide/level-1
rm -f src/routes/\(public\)/guide/level-1/_data/page-*.json
rm -f src/routes/\(public\)/guide/level-1/+page.svelte
rm -f src/routes/\(public\)/guide/level-1/+page.ts
rm -f src/routes/\(public\)/guide/level-1/+page.server.ts
```

- [ ] **Step 2: Verify deletion**

```bash
find src/routes/\(public\)/guide/level-1 -type f 2>/dev/null | head -20
find src/routes/api/guide 2>/dev/null
```

Expected: empty or nonexistent directories. The `_data/` directory itself stays (we'll put new JSON there).

- [ ] **Step 3: Verify build still passes**

```bash
npm run check
```

Expected: PASS (deleted code was self-contained behind auth gate, no external imports).

- [ ] **Step 4: Commit**

```bash
git add -A src/routes/\(public\)/guide/level-1 src/routes/api/guide
git commit -m "chore(guide): delete 4.7's editor infrastructure (90+ files)

All Page*.svelte, editor components, sidecar JSON, API routes, and
compare view removed. Static assets (images/, artboards/) kept as
fallback and reference."
```

---

### Task 2: Guide types + data context

**Files:**
- Create: `src/routes/(public)/guide/level-1/_data/guide-types.ts`
- Create: `src/routes/(public)/guide/level-1/_data/guide-data-context.ts`

- [ ] **Step 1: Create guide types**

```typescript
// src/routes/(public)/guide/level-1/_data/guide-types.ts

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";

export interface GuideChapterData {
  pictographs: Record<string, PictographData>;
  sequences: Record<string, PictographData[]>;
}

export interface GuideNavSection {
  id: string;
  title: string;
}

export interface GuideNavChapter {
  slug: string;
  title: string;
  sections: GuideNavSection[];
}
```

- [ ] **Step 2: Create data context**

```typescript
// src/routes/(public)/guide/level-1/_data/guide-data-context.ts

import { getContext, setContext } from "svelte";
import type { GuideChapterData } from "./guide-types";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";

const GUIDE_DATA_KEY = Symbol("guide-data");

export function setGuideData(data: GuideChapterData): void {
  setContext(GUIDE_DATA_KEY, data);
}

export function getGuideData(): GuideChapterData {
  return getContext<GuideChapterData>(GUIDE_DATA_KEY);
}

export function lookupPictograph(
  data: GuideChapterData,
  id: string
): PictographData | null {
  return data.pictographs[id] ?? null;
}

export function lookupSequence(
  data: GuideChapterData,
  id: string
): PictographData[] | null {
  return data.sequences[id] ?? null;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/\(public\)/guide/level-1/_data/guide-types.ts \
       src/routes/\(public\)/guide/level-1/_data/guide-data-context.ts
git commit -m "feat(guide): add guide data types and context module"
```

---

### Task 3: Navigation config

**Files:**
- Create: `src/routes/(public)/guide/level-1/_data/nav-config.ts`

- [ ] **Step 1: Create nav config**

```typescript
// src/routes/(public)/guide/level-1/_data/nav-config.ts

import type { GuideNavChapter } from "./guide-types";

export const guideChapters: GuideNavChapter[] = [
  {
    slug: "positions-motions",
    title: "1.0 — Positions & Motions",
    sections: [
      { id: "the-grid", title: "The Grid" },
      { id: "hand-positions", title: "Hand Positions" },
      { id: "hand-motions", title: "Hand Motions" },
      { id: "type-1-alpha-beta", title: "Type 1 — Dual-Shifts" },
      { id: "type-1-gamma", title: "Gamma" },
      { id: "type-2-shifts", title: "Type 2 — Shifts" },
      { id: "type-3-cross-shifts", title: "Type 3 — Cross-Shifts" },
      { id: "type-4-dash", title: "Type 4 — Dash" },
      { id: "type-5-dual-dash", title: "Type 5 — Dual-Dash" },
      { id: "type-6-static", title: "Type 6 — Static" },
      { id: "staff-positions", title: "Staff Positions" },
      { id: "staff-motions", title: "Staff Motions" },
      { id: "negative-space", title: "Negative Space" },
    ],
  },
  {
    slug: "letters",
    title: "1.1 — Letters",
    sections: [
      { id: "codex-type-1-2", title: "Codex — Type 1/2" },
      { id: "codex-type-3-6", title: "Codex — Type 3–6" },
      { id: "type-1-letters", title: "Type 1 Letters" },
      { id: "alpha-beta-words", title: "Alpha/Beta Words" },
      { id: "compound-letters", title: "Compound Letters" },
      { id: "compound-words", title: "Compound Words" },
      { id: "gamma-letters", title: "Gamma Letters" },
      { id: "gamma-words", title: "Gamma Words" },
      { id: "type-2-shifts-letters", title: "Type 2 Letters" },
      { id: "type-3-cross-shift-letters", title: "Type 3 Letters" },
      { id: "type-4-5-6-letters", title: "Type 4/5/6 Letters" },
    ],
  },
  {
    slug: "words",
    title: "1.2 — Words & CAPs",
    sections: [
      { id: "words-intro", title: "Words" },
      { id: "caps", title: "CAPs" },
      { id: "reversals", title: "Reversals" },
      { id: "aabb-examples", title: "AABB Examples" },
      { id: "aabb-body-turn", title: "AABB Body Turn" },
      { id: "acac-bcbc", title: "ACAC / BCBC" },
      { id: "type-1-caps", title: "Type 1 CAPs" },
      { id: "gamma-caps", title: "Gamma CAPs" },
      { id: "type-2-caps", title: "Type 2 CAPs" },
      { id: "sixteen-count", title: "16-Count" },
      { id: "eight-letter-words", title: "8-Letter Words" },
      { id: "prop-reversal-caps", title: "Prop-Reversal CAPs" },
      { id: "full-reversal-caps", title: "Full-Reversal CAPs" },
    ],
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/\(public\)/guide/level-1/_data/nav-config.ts
git commit -m "feat(guide): add navigation config for all 3 chapters + 37 sections"
```

---

### Task 4: Guide CSS

**Files:**
- Create: `src/routes/(public)/guide/level-1/_styles/guide.css`

- [ ] **Step 1: Create guide stylesheet**

```css
/* src/routes/(public)/guide/level-1/_styles/guide.css */

/* === Layout === */
.guide-layout {
  display: flex;
  min-height: 100vh;
  background: #fafafa;
  color: #1a1a1a;
}

.guide-sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: 260px;
  height: 100vh;
  overflow-y: auto;
  background: #fff;
  border-right: 1px solid #e5e5e5;
  padding: 1.5rem 0;
  z-index: 10;
}

.guide-content {
  flex: 1;
  margin-left: 260px;
  max-width: 860px;
  padding: 3rem 2rem 6rem;
}

/* === Typography === */
.guide-content h1 {
  font-family: "Playfair Display", Georgia, "Times New Roman", serif;
  font-style: italic;
  font-size: 2.5rem;
  font-weight: 700;
  margin: 0 0 1rem;
  color: #1a1a1a;
}

.guide-content h2 {
  font-family: "Playfair Display", Georgia, "Times New Roman", serif;
  font-style: italic;
  font-size: 1.75rem;
  font-weight: 600;
  margin: 3rem 0 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e5e5e5;
  color: #1a1a1a;
}

.guide-content h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 2rem 0 0.75rem;
  color: #333;
}

.guide-content p {
  font-size: 1.05rem;
  line-height: 1.7;
  margin: 0 0 1rem;
  color: #333;
}

/* === Type Color Coding (matches PDF) === */
.type-dual-shift { color: #4ea7e8; }
.type-shift { color: #6c5ba8; }
.type-cross-shift { color: #2d8f5e; }
.type-dash { color: #d4832f; }
.type-dual-dash { color: #2a9d9d; }
.type-static { color: #808080; }

.hand-blue { color: #1d3a86; }
.hand-red { color: #c1272d; }

/* === Section spacing === */
.guide-section {
  margin-bottom: 4rem;
}

.guide-section + .guide-section {
  padding-top: 1rem;
}

/* === Diagram === */
.guide-diagram {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 1.5rem 0;
}

.guide-diagram img {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}

.guide-diagram figcaption {
  font-size: 0.9rem;
  color: #666;
  margin-top: 0.5rem;
  text-align: center;
  font-style: italic;
}

/* === Pictograph grid === */
.guide-pictograph-grid {
  display: grid;
  gap: 0.75rem;
  margin: 1.5rem 0;
}

.guide-pictograph-grid .column-headers {
  display: contents;
}

.guide-pictograph-grid .column-header {
  font-weight: 600;
  font-size: 0.9rem;
  text-align: center;
  color: #555;
  padding-bottom: 0.25rem;
}

.guide-pictograph-grid .row-label {
  display: flex;
  align-items: center;
  font-weight: 600;
  font-size: 0.9rem;
  color: #333;
  padding-right: 0.75rem;
}

.guide-pictograph-grid .row-sublabel {
  font-weight: 400;
  font-size: 0.8rem;
  color: #888;
  display: block;
}

/* === Pictograph cell === */
.guide-pictograph {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.guide-pictograph .pictograph-wrapper {
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}

.guide-pictograph.bordered .pictograph-wrapper {
  border: 1px solid #e0e0e0;
}

.guide-pictograph .pictograph-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #444;
  text-align: center;
}

/* Sizes */
.guide-pictograph.size-sm .pictograph-wrapper { width: 120px; height: 120px; }
.guide-pictograph.size-md .pictograph-wrapper { width: 180px; height: 180px; }
.guide-pictograph.size-lg .pictograph-wrapper { width: 280px; height: 280px; }

/* === Sequence player === */
.guide-sequence-player {
  margin: 1.5rem 0;
  padding: 1rem;
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
}

.guide-sequence-player .player-label {
  font-weight: 600;
  font-size: 0.95rem;
  margin-bottom: 0.75rem;
  color: #333;
}

.guide-sequence-player .beat-strip {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;
}

.guide-sequence-player .beat-cell {
  flex-shrink: 0;
  cursor: pointer;
  border-radius: 4px;
  transition: box-shadow 0.15s ease;
}

.guide-sequence-player .beat-cell.active {
  box-shadow: 0 0 0 3px #4ea7e8;
}

.guide-sequence-player .beat-cell.start-position {
  opacity: 0.7;
}

.guide-sequence-player .controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.guide-sequence-player .play-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid #333;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.guide-sequence-player .play-btn:hover {
  background: #f0f0f0;
}

.guide-sequence-player .beat-dots {
  display: flex;
  gap: 4px;
}

.guide-sequence-player .beat-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ddd;
  cursor: pointer;
}

.guide-sequence-player .beat-dot.active {
  background: #4ea7e8;
}

.guide-sequence-player .speed-toggle {
  font-size: 0.8rem;
  color: #888;
  cursor: pointer;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 2px 8px;
  background: none;
}

/* === Navigation sidebar === */
.guide-nav {
  padding: 0 1rem;
}

.guide-nav .nav-title {
  font-weight: 700;
  font-size: 1rem;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.5rem;
}

.guide-nav .nav-title a {
  color: #1a1a1a;
  text-decoration: none;
}

.guide-nav .chapter-group {
  margin-bottom: 1rem;
}

.guide-nav .chapter-title {
  font-weight: 600;
  font-size: 0.85rem;
  padding: 0.4rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  color: #333;
  text-decoration: none;
  display: block;
}

.guide-nav .chapter-title:hover {
  background: #f5f5f5;
}

.guide-nav .chapter-title.active {
  color: #4ea7e8;
  background: #eef6fd;
}

.guide-nav .section-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.guide-nav .section-link {
  display: block;
  font-size: 0.8rem;
  padding: 0.3rem 0.75rem 0.3rem 1.25rem;
  color: #666;
  text-decoration: none;
  border-radius: 4px;
  transition: color 0.1s, background 0.1s;
}

.guide-nav .section-link:hover {
  color: #333;
  background: #f9f9f9;
}

.guide-nav .section-link.active {
  color: #4ea7e8;
  font-weight: 600;
}

/* === Fallback indicator (dev only) === */
.guide-pictograph .fallback-badge {
  font-size: 0.65rem;
  color: #e07c00;
  background: #fff3e0;
  padding: 1px 6px;
  border-radius: 3px;
}

/* === PNG fallback img === */
.guide-pictograph .fallback-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* === Dark mode === */
@media (prefers-color-scheme: dark) {
  .guide-layout { background: #111; color: #e0e0e0; }
  .guide-sidebar { background: #1a1a1a; border-color: #333; }
  .guide-content h1, .guide-content h2 { color: #e0e0e0; }
  .guide-content h2 { border-color: #333; }
  .guide-content h3 { color: #ccc; }
  .guide-content p { color: #bbb; }
  .guide-pictograph .pictograph-wrapper { background: #1a1a1a; }
  .guide-pictograph.bordered .pictograph-wrapper { border-color: #333; }
  .guide-sequence-player { background: #1a1a1a; border-color: #333; }
  .guide-nav .chapter-title:hover { background: #222; }
  .guide-nav .chapter-title.active { background: #1a2a3a; }
  .guide-nav .section-link:hover { background: #222; }
}

/* === Mobile: collapse sidebar === */
@media (max-width: 768px) {
  .guide-sidebar {
    display: none;
  }

  .guide-sidebar.open {
    display: block;
    width: 100%;
    z-index: 50;
  }

  .guide-content {
    margin-left: 0;
    padding: 1.5rem 1rem 4rem;
  }

  .guide-pictograph.size-sm .pictograph-wrapper { width: 100px; height: 100px; }
  .guide-pictograph.size-md .pictograph-wrapper { width: 140px; height: 140px; }
  .guide-pictograph.size-lg .pictograph-wrapper { width: 220px; height: 220px; }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/\(public\)/guide/level-1/_styles/guide.css
git commit -m "feat(guide): add guide stylesheet — typography, layout, type colors, responsive"
```

---

### Task 5: GuideSection component

**Files:**
- Create: `src/routes/(public)/guide/level-1/_components/GuideSection.svelte`

- [ ] **Step 1: Create component**

```svelte
<!-- src/routes/(public)/guide/level-1/_components/GuideSection.svelte -->
<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    id,
    title,
    subtitle,
    children,
  }: {
    id: string;
    title: string;
    subtitle?: string;
    children: Snippet;
  } = $props();
</script>

<section {id} class="guide-section">
  <h2>{title}</h2>
  {#if subtitle}
    <h3>{subtitle}</h3>
  {/if}
  {@render children()}
</section>
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/\(public\)/guide/level-1/_components/GuideSection.svelte
git commit -m "feat(guide): add GuideSection component"
```

---

### Task 6: GuideDiagram component

**Files:**
- Create: `src/routes/(public)/guide/level-1/_components/GuideDiagram.svelte`

- [ ] **Step 1: Create component**

```svelte
<!-- src/routes/(public)/guide/level-1/_components/GuideDiagram.svelte -->
<script lang="ts">
  let {
    src,
    alt,
    caption,
    maxWidth = "500px",
  }: {
    src: string;
    alt: string;
    caption?: string;
    maxWidth?: string;
  } = $props();
</script>

<figure class="guide-diagram">
  <img {src} {alt} style:max-width={maxWidth} loading="lazy" />
  {#if caption}
    <figcaption>{caption}</figcaption>
  {/if}
</figure>
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/\(public\)/guide/level-1/_components/GuideDiagram.svelte
git commit -m "feat(guide): add GuideDiagram component"
```

---

### Task 7: GuidePictograph component

**Files:**
- Create: `src/routes/(public)/guide/level-1/_components/GuidePictograph.svelte`

This is the critical component. Wraps `PictographRenderer` + `PictographPreparer` for the guide context.

**Key references:**
- `PictographPreparer` at `src/lib/shared/pictograph/shared/services/implementations/PictographPreparer.ts` — call `pictographPreparer.prepareSingle(data, options)` to get `PreparedPictographData`
- `PictographRenderer` at `src/lib/shared/pictograph/shared/components/PictographRenderer.svelte` — takes `pictograph: PreparedPictographData`
- Usage example: `src/lib/features/choreo-card/components/card-back/StartPositionPictograph.svelte` — shows the prepare → render pattern

- [ ] **Step 1: Create component**

```svelte
<!-- src/routes/(public)/guide/level-1/_components/GuidePictograph.svelte -->
<script lang="ts">
  import PictographRenderer from "$lib/shared/pictograph/shared/components/PictographRenderer.svelte";
  import { pictographPreparer } from "$lib/shared/pictograph/shared/services/implementations/PictographPreparer";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import type { PreparedPictographData } from "$lib/shared/pictograph/shared/domain/models/PreparedPictographData";

  let {
    data,
    pngFallback,
    size = "md",
    label,
    bordered = false,
    showGrid = true,
  }: {
    data?: PictographData | null;
    pngFallback?: string;
    size?: "sm" | "md" | "lg";
    label?: string;
    bordered?: boolean;
    showGrid?: boolean;
  } = $props();

  let prepared: PreparedPictographData | null = $state(null);

  $effect(() => {
    if (!data) {
      prepared = null;
      return;
    }
    let cancelled = false;
    pictographPreparer
      .prepareSingle(data, { themeMode: "light" })
      .then((result) => {
        if (!cancelled) prepared = result;
      });
    return () => {
      cancelled = true;
    };
  });
</script>

<div class="guide-pictograph size-{size}" class:bordered>
  <div class="pictograph-wrapper">
    {#if prepared}
      <PictographRenderer
        pictograph={prepared}
        {showGrid}
        showTKA={true}
        showReversals={false}
        showTND={false}
        showElemental={false}
        showPositions={false}
        showNonRadialPoints={false}
        blueMotionVisible={true}
        redMotionVisible={true}
      />
    {:else if pngFallback}
      <img class="fallback-img" src={pngFallback} alt={label ?? "pictograph"} loading="lazy" />
      {#if import.meta.env.DEV}
        <span class="fallback-badge">PNG</span>
      {/if}
    {/if}
  </div>
  {#if label}
    <span class="pictograph-label">{label}</span>
  {/if}
</div>
```

- [ ] **Step 2: Verify build**

```bash
npm run check
```

Expected: PASS. Component compiles without type errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/\(public\)/guide/level-1/_components/GuidePictograph.svelte
git commit -m "feat(guide): add GuidePictograph — live SVG via PictographRenderer + PNG fallback"
```

---

### Task 8: GuidePictographGrid component

**Files:**
- Create: `src/routes/(public)/guide/level-1/_components/GuidePictographGrid.svelte`

- [ ] **Step 1: Create component**

```svelte
<!-- src/routes/(public)/guide/level-1/_components/GuidePictographGrid.svelte -->
<script lang="ts">
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import GuidePictograph from "./GuidePictograph.svelte";

  interface GridRow {
    label: string;
    sublabel?: string;
    cells: Array<{ data?: PictographData | null; label?: string; pngFallback?: string }>;
  }

  let {
    rows,
    columnHeaders,
    pictographSize = "sm",
  }: {
    rows: GridRow[];
    columnHeaders?: string[];
    pictographSize?: "sm" | "md" | "lg";
  } = $props();

  const columnCount = $derived(
    columnHeaders?.length ?? (rows[0]?.cells.length ?? 0)
  );

  const gridTemplateColumns = $derived(
    `160px repeat(${columnCount}, 1fr)`
  );
</script>

<div
  class="guide-pictograph-grid"
  style:grid-template-columns={gridTemplateColumns}
>
  {#if columnHeaders}
    <div class="column-header"></div>
    {#each columnHeaders as header}
      <div class="column-header">{header}</div>
    {/each}
  {/if}

  {#each rows as row}
    <div class="row-label">
      {row.label}
      {#if row.sublabel}
        <span class="row-sublabel">{row.sublabel}</span>
      {/if}
    </div>
    {#each row.cells as cell}
      <GuidePictograph
        data={cell.data}
        pngFallback={cell.pngFallback}
        label={cell.label}
        size={pictographSize}
        bordered
      />
    {/each}
  {/each}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/\(public\)/guide/level-1/_components/GuidePictographGrid.svelte
git commit -m "feat(guide): add GuidePictographGrid — labeled CSS grid of pictographs"
```

---

### Task 9: GuideSequencePlayer component

**Files:**
- Create: `src/routes/(public)/guide/level-1/_components/GuideSequencePlayer.svelte`

- [ ] **Step 1: Create component**

```svelte
<!-- src/routes/(public)/guide/level-1/_components/GuideSequencePlayer.svelte -->
<script lang="ts">
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import GuidePictograph from "./GuidePictograph.svelte";

  let {
    beats,
    label,
    startLabel,
    beatSize = "sm",
  }: {
    beats: PictographData[];
    label?: string;
    startLabel?: string;
    beatSize?: "sm" | "md" | "lg";
  } = $props();

  let activeBeat = $state(-1);
  let playing = $state(false);
  let speed = $state<1 | 0.5>(1);
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const bpm = $derived(60 * speed);
  const msPerBeat = $derived(60000 / bpm);

  function play() {
    if (playing) {
      pause();
      return;
    }
    playing = true;
    activeBeat = 0;
    intervalId = setInterval(() => {
      activeBeat++;
      if (activeBeat >= beats.length) {
        pause();
      }
    }, msPerBeat);
  }

  function pause() {
    playing = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function jumpTo(index: number) {
    pause();
    activeBeat = index;
  }

  function toggleSpeed() {
    speed = speed === 1 ? 0.5 : 1;
    if (playing) {
      pause();
      play();
    }
  }

  $effect(() => {
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  });
</script>

<div class="guide-sequence-player">
  {#if label}
    <div class="player-label">{label}</div>
  {/if}

  <div class="beat-strip">
    {#if startLabel && beats.length > 0}
      <div
        class="beat-cell start-position"
        class:active={activeBeat === 0}
        role="button"
        tabindex="0"
        onclick={() => jumpTo(0)}
        onkeydown={(e) => e.key === "Enter" && jumpTo(0)}
      >
        <GuidePictograph data={beats[0]} size={beatSize} label={startLabel} bordered />
      </div>
    {/if}
    {#each beats as beat, i}
      {#if !(i === 0 && startLabel)}
        <div
          class="beat-cell"
          class:active={activeBeat === i}
          role="button"
          tabindex="0"
          onclick={() => jumpTo(i)}
          onkeydown={(e) => e.key === "Enter" && jumpTo(i)}
        >
          <GuidePictograph data={beat} size={beatSize} label={"Beat {i + 1}"} bordered />
        </div>
      {/if}
    {/each}
  </div>

  <div class="controls">
    <button class="play-btn" onclick={play} aria-label={playing ? "Pause" : "Play"}>
      {#if playing}
        <svg width="14" height="14" viewBox="0 0 14 14">
          <rect x="1" y="1" width="4" height="12" fill="currentColor" />
          <rect x="9" y="1" width="4" height="12" fill="currentColor" />
        </svg>
      {:else}
        <svg width="14" height="14" viewBox="0 0 14 14">
          <polygon points="2,0 14,7 2,14" fill="currentColor" />
        </svg>
      {/if}
    </button>

    <div class="beat-dots">
      {#each beats as _, i}
        <button
          class="beat-dot"
          class:active={activeBeat === i}
          onclick={() => jumpTo(i)}
          aria-label="Beat {i + 1}"
        ></button>
      {/each}
    </div>

    <button class="speed-toggle" onclick={toggleSpeed}>
      {speed === 1 ? "1×" : "0.5×"}
    </button>
  </div>
</div>
```

- [ ] **Step 2: Verify build**

```bash
npm run check
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/\(public\)/guide/level-1/_components/GuideSequencePlayer.svelte
git commit -m "feat(guide): add GuideSequencePlayer — horizontal strip with play/pause/speed"
```

---

### Task 10: GuideNav sidebar component

**Files:**
- Create: `src/routes/(public)/guide/level-1/_components/GuideNav.svelte`

- [ ] **Step 1: Create component**

```svelte
<!-- src/routes/(public)/guide/level-1/_components/GuideNav.svelte -->
<script lang="ts">
  import { page } from "$app/stores";
  import { guideChapters } from "../_data/nav-config";

  let { activeSectionId = $bindable("") }: { activeSectionId?: string } = $props();

  const currentPath = $derived($page.url.pathname);

  function isChapterActive(slug: string): boolean {
    return currentPath.endsWith(`/${slug}`);
  }
</script>

<nav class="guide-nav" aria-label="Guide navigation">
  <div class="nav-title">
    <a href="/guide/level-1">Level 1 Guide</a>
  </div>

  {#each guideChapters as chapter}
    <div class="chapter-group">
      <a
        class="chapter-title"
        class:active={isChapterActive(chapter.slug)}
        href="/guide/level-1/{chapter.slug}"
      >
        {chapter.title}
      </a>

      {#if isChapterActive(chapter.slug)}
        <ul class="section-list">
          {#each chapter.sections as section}
            <li>
              <a
                class="section-link"
                class:active={activeSectionId === section.id}
                href="#{section.id}"
              >
                {section.title}
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/each}
</nav>
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/\(public\)/guide/level-1/_components/GuideNav.svelte
git commit -m "feat(guide): add GuideNav sidebar with scroll-spy section highlighting"
```

---

### Task 11: Guide layout + route scaffold

**Files:**
- Create: `src/routes/(public)/guide/level-1/+layout.svelte`
- Create: `src/routes/(public)/guide/level-1/+page.svelte`
- Create: `src/routes/(public)/guide/level-1/+page.ts`
- Create: `src/routes/(public)/guide/level-1/positions-motions/+page.ts`
- Create: `src/routes/(public)/guide/level-1/letters/+page.ts`
- Create: `src/routes/(public)/guide/level-1/words/+page.ts`

- [ ] **Step 1: Create guide layout**

```svelte
<!-- src/routes/(public)/guide/level-1/+layout.svelte -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import GuideNav from "./_components/GuideNav.svelte";
  import "./_styles/guide.css";

  let { children }: { children: Snippet } = $props();

  let activeSectionId = $state("");
  let sidebarOpen = $state(false);
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div class="guide-layout">
  <button
    class="mobile-menu-btn"
    onclick={() => (sidebarOpen = !sidebarOpen)}
    aria-label="Toggle navigation"
  >
    ☰
  </button>

  <aside class="guide-sidebar" class:open={sidebarOpen}>
    <GuideNav bind:activeSectionId />
  </aside>

  <main class="guide-content">
    {@render children()}
  </main>
</div>

<style>
  .mobile-menu-btn {
    display: none;
    position: fixed;
    top: 1rem;
    left: 1rem;
    z-index: 60;
    font-size: 1.5rem;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 0.25rem 0.5rem;
    cursor: pointer;
  }

  @media (max-width: 768px) {
    .mobile-menu-btn {
      display: block;
    }
  }
</style>
```

- [ ] **Step 2: Create landing page**

```svelte
<!-- src/routes/(public)/guide/level-1/+page.svelte -->
<script lang="ts">
</script>

<svelte:head>
  <title>Level 1 — The Kinetic Alphabet</title>
  <meta name="description" content="The Kinetic Alphabet Level 1 guide — positions, motions, letters, words, and CAPs for double staves." />
</svelte:head>

<div class="landing">
  <img
    class="cover-art"
    src="/guide/level-1/images/_shared/level-1-front-cover.png"
    alt="The Kinetic Alphabet Level 1 cover"
  />

  <h1>The Kinetic Alphabet</h1>
  <p class="subtitle">Level 1 — Positions, Motions, Letters & Words</p>

  <section class="read-me-first">
    <h2>Read Me First</h2>
    <p>
      The Kinetic Alphabet (TKA) is a writing system for object manipulation.
      Each letter represents a unique combination of hand motions performed
      with gripped props — staves, fans, clubs, or buugeng.
    </p>
    <p>
      This guide covers Level 1: the grid, hand and staff positions, six motion types,
      the complete Level 1 letter set, and how letters combine into words, CAPs, and reversals.
    </p>
  </section>

  <nav class="toc" aria-label="Table of contents">
    <h2>Chapters</h2>
    <ol>
      <li>
        <a href="/guide/level-1/positions-motions">
          <strong>1.0 — Positions & Motions</strong>
          <span>The grid, hand positions, hand motions, Types 1–6, staff positions, negative space</span>
        </a>
      </li>
      <li>
        <a href="/guide/level-1/letters">
          <strong>1.1 — Letters</strong>
          <span>Codex, Type 1 letters, compound letters, gamma letters, Types 2–6</span>
        </a>
      </li>
      <li>
        <a href="/guide/level-1/words">
          <strong>1.2 — Words & CAPs</strong>
          <span>Words, CAPs, reversals, 16-count sequences, 8-letter words</span>
        </a>
      </li>
    </ol>
  </nav>

  <section class="download">
    <h2>PDF Version</h2>
    <p>
      <a href="/guides/level-1.pdf" download>Download Level 1 PDF</a> (v0.5)
    </p>
  </section>
</div>

<style>
  .landing {
    max-width: 600px;
    margin: 0 auto;
    text-align: center;
  }

  .cover-art {
    width: 100%;
    max-width: 400px;
    border-radius: 8px;
    margin-bottom: 2rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  }

  .subtitle {
    font-size: 1.2rem;
    color: #666;
    margin-bottom: 2rem;
  }

  .read-me-first, .download {
    text-align: left;
    margin: 2rem 0;
  }

  .toc {
    text-align: left;
    margin: 2rem 0;
  }

  .toc ol {
    list-style: none;
    padding: 0;
  }

  .toc li {
    margin-bottom: 1rem;
  }

  .toc a {
    display: block;
    padding: 1rem;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .toc a:hover {
    border-color: #4ea7e8;
    box-shadow: 0 2px 8px rgba(78, 167, 232, 0.15);
  }

  .toc span {
    display: block;
    font-size: 0.9rem;
    color: #666;
    margin-top: 0.25rem;
  }

  .download a {
    color: #4ea7e8;
  }
</style>
```

- [ ] **Step 3: Create +page.ts files**

All chapter routes get prerender enabled:

```typescript
// src/routes/(public)/guide/level-1/+page.ts
export const prerender = true;
```

```typescript
// src/routes/(public)/guide/level-1/positions-motions/+page.ts
export const prerender = true;
```

```typescript
// src/routes/(public)/guide/level-1/letters/+page.ts
export const prerender = true;
```

```typescript
// src/routes/(public)/guide/level-1/words/+page.ts
export const prerender = true;
```

- [ ] **Step 4: Verify build**

```bash
npm run check
```

- [ ] **Step 5: Commit**

```bash
git add src/routes/\(public\)/guide/level-1/+layout.svelte \
       src/routes/\(public\)/guide/level-1/+page.svelte \
       src/routes/\(public\)/guide/level-1/+page.ts \
       src/routes/\(public\)/guide/level-1/positions-motions/+page.ts \
       src/routes/\(public\)/guide/level-1/letters/+page.ts \
       src/routes/\(public\)/guide/level-1/words/+page.ts
git commit -m "feat(guide): add layout, landing page, and route scaffold for 3 chapters"
```

---

### Task 12: Data generation script

**Files:**
- Create: `scripts/generate-guide-data.cjs`

This script reads `static/data/pictographs/DiamondPictographDataframe.csv` and produces JSON files with `PictographData` for each chapter. The app's `PictographPreparer` handles arrow/prop position calculation at render time — the JSON only needs the core motion fields.

**CSV columns:** `letter,startPosition,endPosition,timing,direction,blueMotionType,blueRotationDirection,blueStartLocation,blueEndLocation,redMotionType,redRotationDirection,redStartLocation,redEndLocation`

**Output PictographData format** (matches `src/lib/shared/pictograph/shared/domain/models/PictographData.ts`):
```json
{
  "id": "A-0",
  "letter": "A",
  "startPosition": "alpha3",
  "endPosition": "alpha5",
  "motions": {
    "blue": {
      "motionType": "pro",
      "rotationDirection": "cw",
      "startLocation": "w",
      "endLocation": "n",
      "color": "blue",
      "turns": 1,
      "startOrientation": "in",
      "endOrientation": "in",
      "isVisible": true,
      "propType": "staff",
      "arrowLocation": "n",
      "gridMode": "DIAMOND"
    },
    "red": { ... }
  }
}
```

- [ ] **Step 1: Create generation script**

```javascript
#!/usr/bin/env node
/**
 * Generate Guide Data
 *
 * Reads DiamondPictographDataframe.csv and outputs JSON files for each chapter
 * of the Level 1 guide. Run once, commit output. Re-run when guide content changes.
 *
 * Usage: node scripts/generate-guide-data.cjs
 * Output: src/routes/(public)/guide/level-1/_data/{positions-motions,letters,words}.json
 */

const fs = require("fs");
const path = require("path");

const CSV_PATH = path.join(
  __dirname,
  "../static/data/pictographs/DiamondPictographDataframe.csv"
);
const OUT_DIR = path.join(
  __dirname,
  "../src/routes/(public)/guide/level-1/_data"
);

// ---------------------------------------------------------------------------
// CSV Parsing
// ---------------------------------------------------------------------------

function parseCSV(csvPath) {
  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    if (values.length !== headers.length) continue;
    const row = {};
    headers.forEach((h, idx) => (row[h] = values[idx]));
    if (row.letter) rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// CSV Row → PictographData
// ---------------------------------------------------------------------------

function csvRowToPictographData(row, index) {
  const id = `${row.letter}-${index}`;

  function buildMotion(color) {
    const prefix = color === "blue" ? "blue" : "red";
    return {
      motionType: row[`${prefix}MotionType`],
      rotationDirection: row[`${prefix}RotationDirection`],
      startLocation: row[`${prefix}StartLocation`],
      endLocation: row[`${prefix}EndLocation`],
      color,
      turns: row[`${prefix}MotionType`] === "static" ? 0 : 1,
      startOrientation: "in",
      endOrientation: "in",
      isVisible: true,
      propType: "staff",
      arrowLocation: row[`${prefix}StartLocation`],
      gridMode: "DIAMOND",
    };
  }

  return {
    id,
    letter: row.letter,
    startPosition: row.startPosition,
    endPosition: row.endPosition,
    gridMode: "DIAMOND",
    motions: {
      blue: buildMotion("blue"),
      red: buildMotion("red"),
    },
  };
}

// ---------------------------------------------------------------------------
// Group by letter with variation index
// ---------------------------------------------------------------------------

function buildLetterIndex(rows) {
  const index = {};
  for (const row of rows) {
    if (!index[row.letter]) index[row.letter] = [];
    const varIndex = index[row.letter].length;
    index[row.letter].push(csvRowToPictographData(row, varIndex));
  }
  return index;
}

// ---------------------------------------------------------------------------
// Chapter data builders
// ---------------------------------------------------------------------------

/**
 * Select a specific variation of a letter.
 * Returns PictographData or null.
 */
function pick(letterIndex, letter, variation = 0) {
  const variations = letterIndex[letter];
  if (!variations || variation >= variations.length) {
    console.warn(`Missing: letter=${letter} variation=${variation}`);
    return null;
  }
  return variations[variation];
}

/**
 * Build a sequence from an array of [letter, variation] pairs.
 */
function buildSequence(letterIndex, steps) {
  return steps
    .map(([letter, variation]) => pick(letterIndex, letter, variation))
    .filter(Boolean);
}

function buildChapter10(letterIndex) {
  const pictographs = {};
  const sequences = {};

  // Hand Positions: alpha, beta, gamma variations
  const posLetters = ["A", "B", "C", "G", "H", "I"];
  for (const letter of posLetters) {
    const vars = letterIndex[letter] || [];
    for (let v = 0; v < Math.min(vars.length, 4); v++) {
      pictographs[`${letter}-${v}`] = vars[v];
    }
  }

  // Type 1-6 representative pictographs
  for (const letter of Object.keys(letterIndex)) {
    const vars = letterIndex[letter];
    if (vars && vars.length > 0) {
      pictographs[`${letter}-0`] = vars[0];
    }
  }

  // Type 5 (dual-dash): Φ, Ψ, Λ
  // Type 6 (static): α, β, γ
  for (const letter of ["Φ", "Ψ", "Λ", "α", "β", "γ"]) {
    const vars = letterIndex[letter] || [];
    for (let v = 0; v < Math.min(vars.length, 4); v++) {
      pictographs[`${letter}-${v}`] = vars[v];
    }
  }

  return { pictographs, sequences };
}

function buildChapter11(letterIndex) {
  const pictographs = {};
  const sequences = {};

  // Include ALL letters with first 4 variations for codex grids
  for (const letter of Object.keys(letterIndex)) {
    const vars = letterIndex[letter];
    for (let v = 0; v < Math.min(vars.length, 8); v++) {
      pictographs[`${letter}-${v}`] = vars[v];
    }
  }

  return { pictographs, sequences };
}

function buildChapter12(letterIndex) {
  const pictographs = {};
  const sequences = {};

  // Include all letters for sequence building
  for (const letter of Object.keys(letterIndex)) {
    const vars = letterIndex[letter];
    for (let v = 0; v < Math.min(vars.length, 4); v++) {
      pictographs[`${letter}-${v}`] = vars[v];
    }
  }

  return { pictographs, sequences };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log("Reading CSV...");
  const rows = parseCSV(CSV_PATH);
  console.log(`Loaded ${rows.length} pictograph rows`);

  const letterIndex = buildLetterIndex(rows);
  const letterCount = Object.keys(letterIndex).length;
  console.log(`Found ${letterCount} unique letters`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const chapters = {
    "positions-motions": buildChapter10(letterIndex),
    letters: buildChapter11(letterIndex),
    words: buildChapter12(letterIndex),
  };

  for (const [name, data] of Object.entries(chapters)) {
    const outPath = path.join(OUT_DIR, `${name}.json`);
    const pCount = Object.keys(data.pictographs).length;
    const sCount = Object.keys(data.sequences).length;
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
    console.log(`Wrote ${outPath} (${pCount} pictographs, ${sCount} sequences)`);
  }

  console.log("Done.");
}

main();
```

- [ ] **Step 2: Run the script**

```bash
node scripts/generate-guide-data.cjs
```

Expected: 3 JSON files created in `src/routes/(public)/guide/level-1/_data/`.

- [ ] **Step 3: Verify JSON output**

```bash
wc -c src/routes/\(public\)/guide/level-1/_data/positions-motions.json
wc -c src/routes/\(public\)/guide/level-1/_data/letters.json
wc -c src/routes/\(public\)/guide/level-1/_data/words.json
```

Expected: non-zero file sizes.

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-guide-data.cjs \
       src/routes/\(public\)/guide/level-1/_data/positions-motions.json \
       src/routes/\(public\)/guide/level-1/_data/letters.json \
       src/routes/\(public\)/guide/level-1/_data/words.json
git commit -m "feat(guide): add data generation script + initial JSON data for all chapters"
```

---

### Task 13: Chapter 1.0 — Positions & Motions content

**Files:**
- Create: `src/routes/(public)/guide/level-1/positions-motions/+page.svelte`
- Create: `src/routes/(public)/guide/level-1/_sections/ch10/TheGrid.svelte`
- Create: `src/routes/(public)/guide/level-1/_sections/ch10/HandPositions.svelte`
- Create: `src/routes/(public)/guide/level-1/_sections/ch10/HandMotions.svelte`
- Create: `src/routes/(public)/guide/level-1/_sections/ch10/Type1AlphaBeta.svelte`
- Create: `src/routes/(public)/guide/level-1/_sections/ch10/Type1Gamma.svelte`
- Create: `src/routes/(public)/guide/level-1/_sections/ch10/Type2Shifts.svelte`
- Create: `src/routes/(public)/guide/level-1/_sections/ch10/Type3CrossShifts.svelte`
- Create: `src/routes/(public)/guide/level-1/_sections/ch10/Type4Dash.svelte`
- Create: `src/routes/(public)/guide/level-1/_sections/ch10/Type5DualDash.svelte`
- Create: `src/routes/(public)/guide/level-1/_sections/ch10/Type6Static.svelte`
- Create: `src/routes/(public)/guide/level-1/_sections/ch10/StaffPositions.svelte`
- Create: `src/routes/(public)/guide/level-1/_sections/ch10/StaffMotions.svelte`
- Create: `src/routes/(public)/guide/level-1/_sections/ch10/NegativeSpace.svelte`

This is the largest task. The chapter page imports all 13 sections. Each section uses the shared components with data from the `positions-motions.json` manifest.

**Content reference:** PDF v0.5 pages 7–17. Transcribe instructional text from the PDF. Pictograph data IDs correspond to keys in the generated JSON: `"{letter}-{variationIndex}"`.

- [ ] **Step 1: Create chapter page**

```svelte
<!-- src/routes/(public)/guide/level-1/positions-motions/+page.svelte -->
<script lang="ts">
  import { setGuideData } from "../_data/guide-data-context";
  import chapterData from "../_data/positions-motions.json";
  import type { GuideChapterData } from "../_data/guide-types";

  import TheGrid from "../_sections/ch10/TheGrid.svelte";
  import HandPositions from "../_sections/ch10/HandPositions.svelte";
  import HandMotions from "../_sections/ch10/HandMotions.svelte";
  import Type1AlphaBeta from "../_sections/ch10/Type1AlphaBeta.svelte";
  import Type1Gamma from "../_sections/ch10/Type1Gamma.svelte";
  import Type2Shifts from "../_sections/ch10/Type2Shifts.svelte";
  import Type3CrossShifts from "../_sections/ch10/Type3CrossShifts.svelte";
  import Type4Dash from "../_sections/ch10/Type4Dash.svelte";
  import Type5DualDash from "../_sections/ch10/Type5DualDash.svelte";
  import Type6Static from "../_sections/ch10/Type6Static.svelte";
  import StaffPositions from "../_sections/ch10/StaffPositions.svelte";
  import StaffMotions from "../_sections/ch10/StaffMotions.svelte";
  import NegativeSpace from "../_sections/ch10/NegativeSpace.svelte";

  setGuideData(chapterData as GuideChapterData);
</script>

<svelte:head>
  <title>1.0 Positions & Motions — Level 1 Guide</title>
</svelte:head>

<h1>Positions & Motions</h1>

<TheGrid />
<HandPositions />
<HandMotions />
<Type1AlphaBeta />
<Type1Gamma />
<Type2Shifts />
<Type3CrossShifts />
<Type4Dash />
<Type5DualDash />
<Type6Static />
<StaffPositions />
<StaffMotions />
<NegativeSpace />
```

- [ ] **Step 2: Create TheGrid section**

This is the instructional pattern — diagrams + explanatory text. Content from PDF page 7.

```svelte
<!-- src/routes/(public)/guide/level-1/_sections/ch10/TheGrid.svelte -->
<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuideDiagram from "../../_components/GuideDiagram.svelte";
</script>

<GuideSection id="the-grid" title="The Grid">
  <p>
    TKA uses a grid of reference points around the body. Your hands move between
    these points to create letters. The grid has two modes — <strong>diamond</strong> and
    <strong>box</strong> — which together form the full 8-point grid.
  </p>

  <GuideDiagram
    src="/guide/level-1/images/the-grid/grid-diamond.png"
    alt="Diamond grid showing cardinal points: north, south, east, west"
    caption="Diamond mode — 4 cardinal points"
  />

  <GuideDiagram
    src="/guide/level-1/images/the-grid/grid-box.png"
    alt="Box grid showing intercardinal points: northeast, southeast, southwest, northwest"
    caption="Box mode — 4 intercardinal points"
  />

  <p>
    Combined, diamond and box modes create the 8-point grid. Every hand position
    in TKA maps to a point on this grid.
  </p>
</GuideSection>
```

- [ ] **Step 3: Create HandPositions section**

This is the reference grid pattern — pictograph grids with labels. Content from PDF page 8.

```svelte
<!-- src/routes/(public)/guide/level-1/_sections/ch10/HandPositions.svelte -->
<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuidePictographGrid from "../../_components/GuidePictographGrid.svelte";
  import { getGuideData } from "../../_data/guide-data-context";

  const data = getGuideData();

  function p(id: string) {
    return data.pictographs[id] ?? null;
  }

  const alphaRows = [
    {
      label: "Alpha",
      sublabel: "Hands opposite",
      cells: [
        { data: p("A-0"), label: "α1" },
        { data: p("A-1"), label: "α2" },
        { data: p("A-2"), label: "α3" },
        { data: p("A-3"), label: "α4" },
      ],
    },
  ];

  const betaRows = [
    {
      label: "Beta",
      sublabel: "Hands together",
      cells: [
        { data: p("B-0"), label: "β1" },
        { data: p("B-1"), label: "β2" },
        { data: p("B-2"), label: "β3" },
        { data: p("B-3"), label: "β4" },
      ],
    },
  ];

  const gammaRows = [
    {
      label: "Gamma",
      sublabel: "Hands at right angle",
      cells: [
        { data: p("G-0"), label: "Γ1" },
        { data: p("G-1"), label: "Γ2" },
        { data: p("G-2"), label: "Γ3" },
        { data: p("G-3"), label: "Γ4" },
      ],
    },
  ];
</script>

<GuideSection id="hand-positions" title="Hand Positions">
  <p>
    Hand positions describe where both hands are on the grid at the same time.
    There are three position families: alpha, beta, and gamma.
  </p>

  <h3 class="type-dual-shift">Alpha — Hands at Opposite Points</h3>
  <GuidePictographGrid rows={alphaRows} />

  <h3 class="type-dual-shift">Beta — Hands at the Same Point</h3>
  <GuidePictographGrid rows={betaRows} />

  <h3 class="type-dual-shift">Gamma — Hands at a Right Angle</h3>
  <GuidePictographGrid rows={gammaRows} />
</GuideSection>
```

- [ ] **Step 4: Create HandMotions section**

Instructional — diagrams showing shift/dash/static definitions. PDF page 9.

```svelte
<!-- src/routes/(public)/guide/level-1/_sections/ch10/HandMotions.svelte -->
<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuideDiagram from "../../_components/GuideDiagram.svelte";
</script>

<GuideSection id="hand-motions" title="Hand Motions">
  <p>
    Each hand performs one of three basic motions per beat: <strong>shift</strong>,
    <strong>dash</strong>, or <strong>static</strong>.
  </p>

  <h3>Shift</h3>
  <p>The hand moves to an adjacent grid point while the prop rotates continuously.</p>

  <h3>Dash</h3>
  <p>The hand moves to an adjacent grid point with no prop rotation — the prop translates without spinning.</p>

  <h3>Static</h3>
  <p>The hand stays at its current grid point. The prop may or may not rotate in place.</p>

  <h3>Six Combinations</h3>
  <p>
    With two hands and three motion types, six combinations define the six letter types:
  </p>
  <ol>
    <li><span class="type-dual-shift"><strong>Type 1 — Dual-Shift:</strong></span> Both hands shift</li>
    <li><span class="type-shift"><strong>Type 2 — Shift:</strong></span> One hand shifts, one is static</li>
    <li><span class="type-cross-shift"><strong>Type 3 — Cross-Shift:</strong></span> One hand shifts, one dashes</li>
    <li><span class="type-dash"><strong>Type 4 — Dash:</strong></span> One hand dashes, one is static</li>
    <li><span class="type-dual-dash"><strong>Type 5 — Dual-Dash:</strong></span> Both hands dash</li>
    <li><span class="type-static"><strong>Type 6 — Static:</strong></span> Both hands are static</li>
  </ol>
</GuideSection>
```

- [ ] **Step 5: Create remaining Chapter 1.0 sections**

Each remaining section follows one of the patterns above. Create these files with the same structure:

**Type1AlphaBeta.svelte** — GuideSection + GuideSequencePlayer. Shows SS α→α, TS β→β, SO α↔β, TO α↔β sequences. Content from PDF page 10.

**Type1Gamma.svelte** — GuideSection + GuideSequencePlayer. Shows QO Γ→Γ, QS Γ→Γ sequences. PDF page 11.

**Type2Shifts.svelte** — GuideSection + GuideSequencePlayer. Same/opposite direction shifts. PDF page 12.

**Type3CrossShifts.svelte** — GuideSection + GuideDiagram + GuideSequencePlayer. Breakdown diagram + sequences. PDF page 13.

**Type4Dash.svelte** — GuideSection + GuideSequencePlayer. α→β (2 beats), Γ→Γ (4 beats). PDF page 13.

**Type5DualDash.svelte** — GuideSection + GuidePictographGrid. 3 pictographs (Φ, Ψ, Λ). PDF page 14.

**Type6Static.svelte** — GuideSection + GuidePictographGrid. 3 pictographs (α, β, γ statics). PDF page 14.

**StaffPositions.svelte** — GuideSection + GuidePictographGrid. Alpha/Beta/Gamma × thumb orientations. PDF page 15.

**StaffMotions.svelte** — GuideSection + GuideDiagram. Prospin/antispin/dash diagrams. PDF page 16.

**NegativeSpace.svelte** — GuideSection + GuideSequencePlayer. 360° isolation, 4-petal antispin. PDF page 17.

Each section file:
1. Imports `GuideSection` + the relevant content components
2. Imports `getGuideData` and defines a `p(id)` helper for pictograph lookup
3. Uses the exact section ID from `nav-config.ts`
4. Transcribes instructional text from the referenced PDF page

Template for sequence sections (Type1AlphaBeta and similar):

```svelte
<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuideSequencePlayer from "../../_components/GuideSequencePlayer.svelte";
  import { getGuideData } from "../../_data/guide-data-context";

  const data = getGuideData();

  function p(id: string) {
    return data.pictographs[id] ?? null;
  }

  // Build sequences from individual pictograph beats
  const ssAlpha = [p("A-0"), p("A-1"), p("A-2"), p("A-3")].filter(Boolean);
</script>

<GuideSection id="type-1-alpha-beta" title="Type 1 — Dual-Shifts">
  <p>
    Type 1 letters use <span class="type-dual-shift">dual-shifts</span> — both
    hands shift simultaneously.
  </p>

  <h3>SS — Same-Same (α → α)</h3>
  <GuideSequencePlayer beats={ssAlpha} label="Both shift same direction" startLabel="α" />

  <!-- Additional sequences follow the same pattern -->
</GuideSection>
```

Template for grid sections (Type5DualDash and similar):

```svelte
<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuidePictographGrid from "../../_components/GuidePictographGrid.svelte";
  import { getGuideData } from "../../_data/guide-data-context";

  const data = getGuideData();

  function p(id: string) {
    return data.pictographs[id] ?? null;
  }

  const rows = [
    {
      label: "Dual-Dash",
      cells: [
        { data: p("Φ-0"), label: "Φ" },
        { data: p("Ψ-0"), label: "Ψ" },
        { data: p("Λ-0"), label: "Λ" },
      ],
    },
  ];
</script>

<GuideSection id="type-5-dual-dash" title="Type 5 — Dual-Dash">
  <p>
    Type 5 letters use <span class="type-dual-dash">dual-dashes</span> — both
    hands dash simultaneously.
  </p>
  <GuidePictographGrid rows={rows} />
</GuideSection>
```

- [ ] **Step 6: Verify build**

```bash
npm run check
```

- [ ] **Step 7: Commit**

```bash
git add src/routes/\(public\)/guide/level-1/positions-motions/ \
       src/routes/\(public\)/guide/level-1/_sections/ch10/
git commit -m "feat(guide): add Chapter 1.0 — Positions & Motions (13 sections)"
```

---

### Task 14: IntersectionObserver scroll-spy

**Files:**
- Modify: `src/routes/(public)/guide/level-1/_components/GuideSection.svelte`
- Modify: `src/routes/(public)/guide/level-1/+layout.svelte`

Wire up IntersectionObserver so the sidebar highlights the active section on scroll.

- [ ] **Step 1: Update GuideSection with observer**

```svelte
<!-- src/routes/(public)/guide/level-1/_components/GuideSection.svelte -->
<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    id,
    title,
    subtitle,
    onVisible,
    children,
  }: {
    id: string;
    title: string;
    subtitle?: string;
    onVisible?: (id: string) => void;
    children: Snippet;
  } = $props();

  let sectionEl: HTMLElement | undefined = $state();

  $effect(() => {
    if (!sectionEl || !onVisible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            onVisible(id);
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );

    observer.observe(sectionEl);
    return () => observer.disconnect();
  });
</script>

<section bind:this={sectionEl} {id} class="guide-section">
  <h2>{title}</h2>
  {#if subtitle}
    <h3>{subtitle}</h3>
  {/if}
  {@render children()}
</section>
```

- [ ] **Step 2: Thread onVisible through layout**

Update `+layout.svelte` to export a `setActiveSectionId` function via context that sections can call. Then thread it through the chapter pages so each `GuideSection` reports its visibility.

The simplest mechanism: a writable store set in the layout context.

```typescript
// Add to _data/guide-data-context.ts:

const ACTIVE_SECTION_KEY = Symbol("active-section");

export function setActiveSectionContext(setter: (id: string) => void): void {
  setContext(ACTIVE_SECTION_KEY, setter);
}

export function getActiveSectionSetter(): ((id: string) => void) | null {
  return getContext<((id: string) => void) | null>(ACTIVE_SECTION_KEY) ?? null;
}
```

Update `+layout.svelte` to call `setActiveSectionContext`:

```svelte
<script lang="ts">
  // ... existing imports ...
  import { setActiveSectionContext } from "./_data/guide-data-context";

  // ... existing state ...

  setActiveSectionContext((id: string) => {
    activeSectionId = id;
  });
</script>
```

Update `GuideSection.svelte` to auto-register:

```svelte
<script lang="ts">
  import { getActiveSectionSetter } from "../_data/guide-data-context";
  // ... existing code ...

  const reportActive = getActiveSectionSetter();

  $effect(() => {
    if (!sectionEl || !reportActive) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) reportActive(id);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );

    observer.observe(sectionEl);
    return () => observer.disconnect();
  });
</script>
```

This removes the need for an explicit `onVisible` prop — sections self-register via context.

- [ ] **Step 3: Verify build**

```bash
npm run check
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/\(public\)/guide/level-1/_components/GuideSection.svelte \
       src/routes/\(public\)/guide/level-1/_data/guide-data-context.ts \
       src/routes/\(public\)/guide/level-1/+layout.svelte
git commit -m "feat(guide): add IntersectionObserver scroll-spy for sidebar section highlighting"
```

---

### Task 15: Build verification for Phase 1

- [ ] **Step 1: Run typecheck**

```bash
npm run check
```

Expected: PASS

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: PASS. All 4 routes prerender successfully.

- [ ] **Step 3: Start dev server and verify routes**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/guide/level-1
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/guide/level-1/positions-motions
```

Expected: 200 for both.

- [ ] **Step 4: If errors, fix and re-verify**

Common issues:
- JSON import may need `resolveJsonModule: true` in tsconfig (likely already set)
- `setContext` must be called during component init, not in `$effect`
- PictographPreparer is async — ensure the `$effect` handles the promise correctly

---

## Phase 2: Chapter 1.1 — Letters

### Task 16: Chapter 1.1 content

**Files:**
- Create: `src/routes/(public)/guide/level-1/letters/+page.svelte`
- Create: 11 section files in `_sections/ch11/`

The data is already generated in `letters.json` (from Task 12). This chapter is the most pictograph-dense — heavy use of `GuidePictographGrid`.

- [ ] **Step 1: Create chapter page**

```svelte
<!-- src/routes/(public)/guide/level-1/letters/+page.svelte -->
<script lang="ts">
  import { setGuideData } from "../_data/guide-data-context";
  import chapterData from "../_data/letters.json";
  import type { GuideChapterData } from "../_data/guide-types";

  import CodexType12 from "../_sections/ch11/CodexType12.svelte";
  import CodexType36 from "../_sections/ch11/CodexType36.svelte";
  import Type1Letters from "../_sections/ch11/Type1Letters.svelte";
  import AlphaBetaWords from "../_sections/ch11/AlphaBetaWords.svelte";
  import CompoundLetters from "../_sections/ch11/CompoundLetters.svelte";
  import CompoundWords from "../_sections/ch11/CompoundWords.svelte";
  import GammaLetters from "../_sections/ch11/GammaLetters.svelte";
  import GammaWords from "../_sections/ch11/GammaWords.svelte";
  import Type2ShiftLetters from "../_sections/ch11/Type2ShiftLetters.svelte";
  import Type3CrossShiftLetters from "../_sections/ch11/Type3CrossShiftLetters.svelte";
  import Type456Letters from "../_sections/ch11/Type456Letters.svelte";

  setGuideData(chapterData as GuideChapterData);
</script>

<svelte:head>
  <title>1.1 Letters — Level 1 Guide</title>
</svelte:head>

<h1>Letters</h1>

<CodexType12 />
<CodexType36 />
<Type1Letters />
<AlphaBetaWords />
<CompoundLetters />
<CompoundWords />
<GammaLetters />
<GammaWords />
<Type2ShiftLetters />
<Type3CrossShiftLetters />
<Type456Letters />
```

- [ ] **Step 2: Create section files**

Each section follows the patterns from Phase 1. Key data mapping for each section:

| Section File | Section ID | Components Used | Key Data |
|---|---|---|---|
| `CodexType12.svelte` | `codex-type-1-2` | GuidePictographGrid | All Type 1 letters (A–V) + Type 2 (W–Ω) in Pro/Anti/Hybrid columns |
| `CodexType36.svelte` | `codex-type-3-6` | GuidePictographGrid | Type 3 (W- through Ω-), Type 4 (Φ, Ψ, Λ), Type 5 (Φ-, Ψ-, Λ-), Type 6 (α, β, γ) |
| `Type1Letters.svelte` | `type-1-letters` | GuidePictographGrid | ABC (α↔α) with Pro/Anti/Hybrid rows, GHI (β↔β) with same columns |
| `AlphaBetaWords.svelte` | `alpha-beta-words` | GuideSequencePlayer | A×4, B×4, C×4, G×4, H×4, I×4 — each as a 4-beat sequence |
| `CompoundLetters.svelte` | `compound-letters` | GuidePictographGrid + GuideSequencePlayer | D–L grid (Tog-Opp/Split-Opp columns), DJ/EK/FL sequences |
| `CompoundWords.svelte` | `compound-words` | GuideSequencePlayer | DJ/EK/FL in Tog-Opp and Split-Opp variations |
| `GammaLetters.svelte` | `gamma-letters` | GuidePictographGrid + GuideSequencePlayer | M–V grid, MP/NQ/OR sequences |
| `GammaWords.svelte` | `gamma-words` | GuideSequencePlayer | MP/NQ/OR opposite, SS/TT/UU/VV same-direction |
| `Type2ShiftLetters.svelte` | `type-2-shifts-letters` | GuidePictographGrid + GuideSequencePlayer | W/X/Y/Z/Σ/Δ/θ/Ω grid, WΣYθ/XΔZΩ sequences |
| `Type3CrossShiftLetters.svelte` | `type-3-cross-shift-letters` | GuidePictographGrid | W-/X-/Y-/Z-/Σ-/Δ-/θ-/Ω- grid |
| `Type456Letters.svelte` | `type-4-5-6-letters` | GuidePictographGrid | Type 4 (Φ/Ψ/Λ), Type 5 (Φ-/Ψ-/Λ-), Type 6 (α/β/γ) |

Each section file follows the same template:

```svelte
<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuidePictographGrid from "../../_components/GuidePictographGrid.svelte";
  import { getGuideData } from "../../_data/guide-data-context";

  const data = getGuideData();
  function p(id: string) { return data.pictographs[id] ?? null; }

  const rows = [
    {
      label: "Row Label",
      cells: [
        { data: p("LETTER-VARIATION"), label: "Letter" },
        // ... more cells
      ],
    },
  ];
</script>

<GuideSection id="SECTION-ID" title="Section Title">
  <p>Instructional text transcribed from PDF page N.</p>
  <GuidePictographGrid {rows} columnHeaders={["Pro", "Anti", "Hybrid"]} />
</GuideSection>
```

The implementer should:
1. Open `F:\Downloads\level-1 (2).pdf` pages 19–29
2. For each section, transcribe the instructional text
3. Map the pictographs shown to data IDs from `letters.json`
4. Wire up grids and sequences using the component APIs

- [ ] **Step 3: Verify build**

```bash
npm run check && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/\(public\)/guide/level-1/letters/ \
       src/routes/\(public\)/guide/level-1/_sections/ch11/
git commit -m "feat(guide): add Chapter 1.1 — Letters (11 sections, codex grids + sequences)"
```

---

## Phase 3: Chapter 1.2 — Words / CAPs / Reversals

### Task 17: Chapter 1.2 content

**Files:**
- Create: `src/routes/(public)/guide/level-1/words/+page.svelte`
- Create: 13 section files in `_sections/ch12/`

This is the most sequence-heavy chapter. Heavy use of `GuideSequencePlayer`. Some sequences are 16 beats long — the player's horizontal scroll handles this.

- [ ] **Step 1: Create chapter page**

```svelte
<!-- src/routes/(public)/guide/level-1/words/+page.svelte -->
<script lang="ts">
  import { setGuideData } from "../_data/guide-data-context";
  import chapterData from "../_data/words.json";
  import type { GuideChapterData } from "../_data/guide-types";

  import WordsIntro from "../_sections/ch12/WordsIntro.svelte";
  import Caps from "../_sections/ch12/Caps.svelte";
  import Reversals from "../_sections/ch12/Reversals.svelte";
  import AABBExamples from "../_sections/ch12/AABBExamples.svelte";
  import AABBBodyTurn from "../_sections/ch12/AABBBodyTurn.svelte";
  import ACACBCBC from "../_sections/ch12/ACACBCBC.svelte";
  import Type1Caps from "../_sections/ch12/Type1Caps.svelte";
  import GammaCaps from "../_sections/ch12/GammaCaps.svelte";
  import Type2Caps from "../_sections/ch12/Type2Caps.svelte";
  import SixteenCount from "../_sections/ch12/SixteenCount.svelte";
  import EightLetterWords from "../_sections/ch12/EightLetterWords.svelte";
  import PropReversalCaps from "../_sections/ch12/PropReversalCaps.svelte";
  import FullReversalCaps from "../_sections/ch12/FullReversalCaps.svelte";

  setGuideData(chapterData as GuideChapterData);
</script>

<svelte:head>
  <title>1.2 Words & CAPs — Level 1 Guide</title>
</svelte:head>

<h1>Words, CAPs & Reversals</h1>

<WordsIntro />
<Caps />
<Reversals />
<AABBExamples />
<AABBBodyTurn />
<ACACBCBC />
<Type1Caps />
<GammaCaps />
<Type2Caps />
<SixteenCount />
<EightLetterWords />
<PropReversalCaps />
<FullReversalCaps />
```

- [ ] **Step 2: Create section files**

| Section File | Section ID | Components Used | Key Content |
|---|---|---|---|
| `WordsIntro.svelte` | `words-intro` | GuideSequencePlayer | AABB × 3 thumb variations |
| `Caps.svelte` | `caps` | GuideSequencePlayer | Mirrored/Rotated/Swapped examples |
| `Reversals.svelte` | `reversals` | GuideDiagram | Hand/prop/full reversal diagrams |
| `AABBExamples.svelte` | `aabb-examples` | GuideSequencePlayer | Prop-reversal AABB, reversal-after-1, reversal-after-3 |
| `AABBBodyTurn.svelte` | `aabb-body-turn` | GuideSequencePlayer | 8-beat AABB + body turn, CCCC hand/prop/full |
| `ACACBCBC.svelte` | `acac-bcbc` | GuideSequencePlayer | ACAC continuous, ACAC with full-reversal, BCBC |
| `Type1Caps.svelte` | `type-1-caps` | GuideSequencePlayer | DJII, BBLF, KIEC (all 8-beat) |
| `GammaCaps.svelte` | `gamma-caps` | GuideSequencePlayer | SOTR, VPUQ, MVNU (all 8-beat) |
| `Type2Caps.svelte` | `type-2-caps` | GuideSequencePlayer | BΣTX, EΔUZ, OYHθ (all 8-beat) |
| `SixteenCount.svelte` | `sixteen-count` | GuideSequencePlayer | GθOZ 16-beat, EΔQY 16-beat |
| `EightLetterWords.svelte` | `eight-letter-words` | GuideSequencePlayer | IIΩXKEΣY, CΣNZIθVW (16-beat) |
| `PropReversalCaps.svelte` | `prop-reversal-caps` | GuideSequencePlayer | EΣQY, TWKθ, BΔMX (8-beat) |
| `FullReversalCaps.svelte` | `full-reversal-caps` | GuideSequencePlayer | CCKE, FLII, DAK (8-beat) |

Each section follows the sequence template from Task 13. The implementer:
1. Opens PDF pages 31–43
2. Transcribes instructional text
3. Builds beat arrays from the `words.json` data (by letter + variation)
4. Passes beat arrays to `GuideSequencePlayer`

For 16-beat sequences, the beat strip scrolls horizontally — no special handling needed beyond the existing CSS `overflow-x: auto` on `.beat-strip`.

- [ ] **Step 3: Verify build**

```bash
npm run check && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/\(public\)/guide/level-1/words/ \
       src/routes/\(public\)/guide/level-1/_sections/ch12/
git commit -m "feat(guide): add Chapter 1.2 — Words, CAPs & Reversals (13 sections)"
```

---

## Phase 4: Polish

### Task 18: Mobile responsiveness

- [ ] **Step 1: Test mobile viewports**

Use Chrome DevTools or `curl` to verify the guide renders correctly at 375px, 768px, and 1024px widths. Check:
- Sidebar collapses to hamburger at ≤768px
- Pictograph grids reflow (3→2→1 columns)
- Sequence player beat strip scrolls horizontally
- Typography is readable at all sizes

- [ ] **Step 2: Fix any mobile layout issues**

Common fixes:
- Add `overflow-x: auto` to grid containers for very wide grids
- Adjust pictograph sizes for narrow viewports
- Ensure touch targets are ≥44px (WCAG 2.5.8)

- [ ] **Step 3: Commit**

```bash
git add -u
git commit -m "fix(guide): mobile responsiveness fixes"
```

---

### Task 19: Lazy loading pictographs

- [ ] **Step 1: Add IntersectionObserver lazy loading to GuidePictograph**

Only prepare pictographs when they scroll into view. Add an IntersectionObserver that triggers `prepareSingle()` when the pictograph wrapper enters the viewport with 200px margin.

```svelte
<!-- Update GuidePictograph.svelte -->
<script lang="ts">
  // ... existing code ...
  let wrapperEl: HTMLElement | undefined = $state();
  let isVisible = $state(false);

  $effect(() => {
    if (!wrapperEl) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          isVisible = true;
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(wrapperEl);
    return () => observer.disconnect();
  });

  $effect(() => {
    if (!data || !isVisible) {
      prepared = null;
      return;
    }
    // ... existing prepare logic ...
  });
</script>

<div bind:this={wrapperEl} class="guide-pictograph size-{size}" class:bordered>
  <!-- ... existing template ... -->
</div>
```

- [ ] **Step 2: Verify build**

```bash
npm run check
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/\(public\)/guide/level-1/_components/GuidePictograph.svelte
git commit -m "perf(guide): lazy-load pictograph preparation via IntersectionObserver"
```

---

### Task 20: Footer + SEO

- [ ] **Step 1: Add footer content to landing page**

Below the download section in `+page.svelte`, add sections for collaboration call and support links (from PDF pages 44–47).

- [ ] **Step 2: Add SEO meta tags**

Each chapter page should have:
- `<title>` (already done)
- `<meta name="description">`
- `<meta property="og:title">`
- `<meta property="og:description">`
- `<meta property="og:image">` pointing to the cover art

- [ ] **Step 3: Verify build**

```bash
npm run check && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "feat(guide): add footer content and SEO meta tags"
```

---

### Task 21: Final PDF cross-check

- [ ] **Step 1: Open PDF and verify content completeness**

Open `F:\Downloads\level-1 (2).pdf` and verify each page's content is represented in the HTML guide:
- All instructional text present
- All pictographs rendered (live SVG or PNG fallback)
- All sequences represented
- No sections missing
- Type colors match PDF
- Hand colors (red/blue) match PDF

- [ ] **Step 2: Log any discrepancies and fix**

Create a checklist of any missing content and address each item.

- [ ] **Step 3: Final build verification**

```bash
npm run check && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "fix(guide): content completeness fixes from PDF cross-check"
```
