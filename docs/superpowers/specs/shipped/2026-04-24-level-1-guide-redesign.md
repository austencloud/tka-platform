---
status: backlog
value: 4
effort: L
remaining: Content authoring for 40+ interactive pages
depends_on: ""
plan_path: plans/backlog/2026-04-25-level-1-guide-redesign.md
tags: []
last_triaged: 2026-04-26
---
# Level 1 Guide — Interactive HTML Redesign

## 1. Problem

The previous attempt converted the Level 1 PDF by screenshotting Illustrator artboards as PNGs, embedding them in Svelte pages, and duplicating the text above each image. This produced:

- Dead images instead of live, interactive content
- Duplicate text that drifted from the actual artboard content
- No connection to the app's rendering pipeline
- A WYSIWYG editor infrastructure (~20 files) built for a broken foundation
- No animations, no interactivity, no value over the PDF itself

## 2. Goal

Rebuild the Level 1 guide as an interactive web experience where:

- Every pictograph is **live SVG** rendered through the existing `PictographRenderer` pipeline
- Sequences are **animatable** via a simplified sequence player
- Content is **semantic HTML** — parseable, searchable, accessible
- The guide reads like a **web textbook**, not a PDF viewer
- All content connects to the app's data model and can eventually link to deeper app features

## 3. Audience & Usage

**Self-study PDF replacement.** A reader opens it in a browser, reads through it like a book. Pictographs are live SVG. Tapping a sequence opens a simplified viewer with animated playback.

Not a workshop projector tool, not an app-integrated learning path (yet). Those can build on this foundation later.

## 4. Route Structure

### 4.1 Routes

| Route | Content | PDF Pages |
|---|---|---|
| `/guide/level-1` | Landing: cover art, Read Me First, TOC with chapter links, support/collab footer | 1–5, 44–47 |
| `/guide/level-1/positions-motions` | Chapter 1.0: Grid, hand positions, hand motions, Types 1–6, staff positions/motions, negative space | 7–17 |
| `/guide/level-1/letters` | Chapter 1.1: Codex, Type 1 letters (ABC through STUV), compound letters, gamma letters, Type 2–6 letters | 19–29 |
| `/guide/level-1/words` | Chapter 1.2: Words intro, CAPs, reversals, AABB examples, ACAC/BCBC, Type 1/gamma/Type 2 CAPs, 16-count, 8-letter, prop/full-reversal CAPs | 31–43 |

### 4.2 Navigation

- **Sidebar nav** (fixed left rail on desktop, hamburger on mobile)
- Shows all three chapters, expandable to section links
- Sections are anchor IDs within each chapter page
- Current section highlights on scroll (IntersectionObserver)
- Chapter titles link to the chapter route
- Section links are smooth-scroll anchors within the chapter

### 4.3 Scroll Behavior

Chapters are continuous scroll pages. Sections flow into each other within a chapter. Chapters are discrete route transitions.

## 5. Rendering Architecture

### 5.1 GuidePictograph

Wrapper around `PictographRenderer` for guide context.

**Input:** Pictograph ID string → looks up `PictographData` from the chapter's static JSON manifest → runs through `PictographPreparer` → renders live SVG.

**Props:**
- `id: string` — key into the chapter data manifest
- `size: 'sm' | 'md' | 'lg'` — controls rendered width
- `label?: string` — letter name displayed below (e.g., "A", "Σ-")
- `bordered?: boolean` — thin border for grid cells
- `showGrid?: boolean` — override grid visibility (default: true)

**Interaction:** Tap/click opens a centered modal (backdrop + dismiss on click-outside/Escape) showing the pictograph at full size (~600px) with position labels and motion annotations visible. Phase 4 polish item — not required for initial delivery.

**Fallback:** If the pictograph ID has no data in the manifest, renders the corresponding PNG from `static/guide/level-1/images/` with a dev-only "static preview" indicator. This allows incremental delivery.

### 5.2 GuideSequencePlayer

Simplified sequence viewer purpose-built for the guide. Not the app's full `AnimationPlayer`.

**Layout:** Horizontal strip of `GuidePictograph` cells showing all beats simultaneously (matches the PDF's familiar layout). A play button triggers animated playback.

**Playback behavior:**
- Play/pause toggle
- Current beat highlighted (border glow or background tint)
- Auto-advances on timer (configurable BPM, default ~60 BPM)
- Beat indicator dots below the strip
- Tap any beat to jump to it
- Optional speed toggle (1x / 0.5x)

**Props:**
- `sequenceId: string` — key into chapter data manifest (resolves to array of PictographData)
- `label?: string` — descriptive label above (e.g., "Thumbs: in | in")
- `startLabel?: string` — label for the start position cell (e.g., "Start", "α", "β")

**No:** transport bar, effects panel, mode controls, layer toggles, export options. The guide player is read-only and minimal.

### 5.3 GuidePictographGrid

For codex pages and reference layouts. CSS grid of `GuidePictograph` cells with labels.

**Props:**
- `rows: Array<{ label: string; sublabel?: string; ids: string[] }>` — row definitions
- `columnHeaders?: string[]` — optional column headers (e.g., "Pro", "Anti", "Hybrid")
- `columns?: number` — override column count (default: inferred from first row's ids length)

**Renders:** A labeled grid matching the PDF's patterns — row label on the left (position transition + handpath name), column headers on top, pictographs in cells with letter labels below each.

### 5.4 GuideDiagram

For non-pictograph visuals: the grid point diagram, hand motion arrows, staff position illustrations, the diamond+box→8-point-grid illustration.

These are Illustrator artwork with no data model equivalent. Rendered as `<img>` tags loading from `static/guide/level-1/images/_shared/`.

**Props:**
- `src: string` — image path
- `alt: string` — accessibility description
- `caption?: string` — optional caption below

### 5.5 GuideSection

Container for each scrollable section within a chapter.

**Props:**
- `id: string` — anchor ID for nav linking
- `title: string` — section heading
- `subtitle?: string` — optional subheading

**Renders:** `<section>` element with `id`, an `<h2>` title, and a slot for content. Handles the IntersectionObserver registration for sidebar highlighting.

## 6. Data Pipeline

### 6.1 Generation Script

`scripts/generate-guide-data.cjs`

Calls MCP tools (`get_pictograph_data`, `get_sequence_data`) for every pictograph and sequence referenced in the guide. Run once, committed to repo. Re-run when guide content changes.

**Output:** Three JSON files:

```
src/routes/(public)/guide/level-1/_data/
  positions-motions.json
  letters.json
  words.json
```

Each file structure:

```typescript
{
  pictographs: Record<string, PictographData>,
  sequences: Record<string, PictographData[]>
}
```

Pictographs keyed by human-readable ID (e.g., `"alpha-ss-A"`, `"gamma-qo-M"`). Sequences keyed by word name (e.g., `"AABB-thumbs-in"`, `"DJII-mirrored-cap"`), value is an ordered array of `PictographData` for each beat.

### 6.2 Section Manifest

TypeScript file mapping sections to their pictograph/sequence IDs in render order:

```typescript
// _data/section-manifest.ts
export const positionsMotionsSections = {
  'the-grid': {
    diagrams: ['grid-points', 'diamond-box-8point'],
  },
  'hand-positions': {
    pictographGroups: [
      { label: 'Alpha', ids: ['alpha-1', 'alpha-2', 'alpha-3', 'alpha-4'] },
      { label: 'Beta', ids: ['beta-1', 'beta-2', 'beta-3', 'beta-4'] },
      { label: 'Gamma', ids: ['gamma-1', ...] },
    ],
  },
  // ...
};
```

Components import from the manifest to know which data to render.

### 6.3 PNG Fallback

`static/guide/level-1/images/` PNGs serve as fallback for any pictograph not yet in the JSON manifest. `GuidePictograph` checks the manifest first, falls back to PNG path convention. Dev-only badge marks fallback renders so we know what's left to convert.

## 7. Content Structure by Chapter

### Chapter 1.0 — Positions & Motions (11 sections)

| Section ID | Title | Content Type | Key Elements |
|---|---|---|---|
| `the-grid` | The Grid | Instructional | Grid point diagram (diagram), diamond/box/8-point illustration (diagram) |
| `hand-positions` | Hand Positions | Reference grid | Alpha (4 variations), Beta (4), Gamma (8) — all as pictograph grids |
| `hand-motions` | Hand Motions | Instructional | Shift/dash/static motion diagrams, 6 combination definitions |
| `type-1-alpha-beta` | Type 1 — Dual-Shifts | Sequence examples | SS α→α (4 beats), TS β→β (4), SO α↔β (4), TO α↔β (4) |
| `type-1-gamma` | Gamma | Sequence examples | QO Γ→Γ (4 beats), QS Γ→Γ (4), mixed QO/QS (8 beats) |
| `type-2-shifts` | Type 2 — Shifts | Sequence examples | Same-direction shifts (8 beats), opposite-direction shifts (8 beats) |
| `type-3-cross-shifts` | Type 3 — Cross-Shifts | Instructional + sequences | Breakdown diagram, α→Γ (8 beats), β→Γ (8 beats) |
| `type-4-dash` | Type 4 — Dash | Sequence examples | α→β (2 beats), Γ→Γ (4 beats) |
| `type-5-dual-dash` | Type 5 — Dual-Dash | Pictograph grid | α→α, β→β, Γ→Γ (3 pictographs) |
| `type-6-static` | Type 6 — Static | Pictograph grid | α, β, Γ (3 pictographs) |
| `staff-positions` | Staff Positions | Reference grid | Alpha/Beta/Gamma × 4 thumb orientations |
| `staff-motions` | Staff Motions | Instructional | Prospin/antispin/dash breakdown diagrams |
| `negative-space` | Negative Space / Body Turns | Sequence examples | 360° Isolation (4 beats), 4-Petal Antispin (4 beats) |

### Chapter 1.1 — Letters (11 sections)

| Section ID | Title | Content Type |
|---|---|---|
| `codex-type-1-2` | Codex — Type 1/2 | Reference grid (all Type 1 + Type 2 letters) |
| `codex-type-3-6` | Codex — Type 3/4/5/6 | Reference grid |
| `type-1-letters` | Type 1 — Dual-Shift Letters | Instructional + grids (ABC, GHI with Pro/Anti/Hybrid) |
| `alpha-beta-words` | Alpha/Beta Words | Sequence examples (A×4, B×4, C×4, G×4, H×4, I×4) |
| `compound-letters` | Compound Letters | Reference grid (D–L, Tog-Opp/Split-Opp) + sequences (DJ, EK, FL) |
| `compound-words` | Compound Words | Sequence examples (DJ/EK/FL in Tog-Opp and Split-Opp) |
| `gamma-letters` | Gamma Letters | Reference grid (M–V) + sequences (MP, NQ, OR) |
| `gamma-words` | Gamma Words | Sequence examples (MP/NQ/OR opp, SS/TT/UU/VV same) |
| `type-2-shifts-letters` | Type 2 — Shift Letters | Reference grid (W/X/Y/Z/Σ/Δ/θ/Ω) + sequences (WΣYθ, XΔZΩ) |
| `type-3-cross-shift-letters` | Type 3 — Cross-Shift Letters | Reference grid (W-/X-/Y-/Z-/Σ-/Δ-/θ-/Ω-) + breakdown |
| `type-4-5-6-letters` | Type 4/5/6 Letters | Reference grids (Φ/Ψ/Λ, Φ-/Ψ-/Λ-, α/β/Γ statics) |

### Chapter 1.2 — Words / CAPs / Reversals (13 sections)

| Section ID | Title | Content Type |
|---|---|---|
| `words-intro` | Words | Instructional + sequences (AABB × 3 thumb variations) |
| `caps` | CAPs | Instructional + sequences (Mirrored/Rotated/Swapped examples) |
| `reversals` | Reversals | Instructional (hand/prop/full reversal diagrams) |
| `aabb-examples` | Examples — AABB | Sequences (prop-reversal AABB, reversal-after-1, reversal-after-3) |
| `aabb-body-turn` | AABB Body Turn / CCCC | Sequences (8-beat AABB + body turn, CCCC hand/prop/full) |
| `acac-bcbc` | ACAC, BCBC | Sequences (ACAC continuous, ACAC with full-reversal, BCBC) |
| `type-1-caps` | Type 1 CAPs | Sequences (DJII, BBLF, KIEC — all 8-beat) |
| `gamma-caps` | Gamma CAPs | Sequences (SOTR, VPUQ, MVNU — all 8-beat) |
| `type-2-caps` | Type 2 CAPs | Sequences (BΣTX, EΔUZ, OYHθ — all 8-beat) |
| `sixteen-count` | 16-Count Sequences | Sequences (GθOZ 16-beat, EΔQY 16-beat) |
| `eight-letter-words` | 8-Letter Words | Sequences (IIΩXKEΣY, CΣNZIθVW — 16-beat) |
| `prop-reversal-caps` | Prop-Reversal CAPs | Sequences (EΣQY, TWKθ, BΔMX — 8-beat) |
| `full-reversal-caps` | Full-Reversal CAPs | Sequences (CCKE, FLII, DAK — 8-beat) |

## 8. Styling

### Typography
- **Page titles:** Serif/calligraphic italic — matching the PDF's decorative headings ("The Grid", "Hand Positions")
- **Body text:** Clean sans-serif (system font stack or Inter)
- **Type color coding** (matching PDF exactly):
  - Dual-Shift: `#4ea7e8` (blue) + `#6c5ba8` (purple for "Shift")
  - Shift: `#6c5ba8` (purple)
  - Cross-Shift: `#2d8f5e` (green) + `#6c5ba8` (purple)
  - Dash: `#d4832f` (orange)
  - Dual-Dash: `#2a9d9d` (teal) + `#d4832f` (orange)
  - Static: `#808080` (gray)
- **Hand colors:** Red (`#c1272d`) = Right, Blue (`#1d3a86`) = Left — consistent with PDF and app

### Layout
- Content column: max-width ~800px, centered
- Sidebar nav: 250px fixed left on desktop
- Pictograph grids: responsive (3-col desktop, 2-col tablet, stack on mobile)
- Generous vertical spacing between sections
- Horizontal rules between major topic transitions (matching PDF)

### Theme
- Light mode default (white background, dark text — matches PDF)
- Dark mode supported via existing app toggle (PictographRenderer already handles dark mode)

### Feel
Clean, spacious, educational. Feels like a well-designed web textbook (MDN, Stripe docs). Not app chrome. No sidebar panels, no toolbars, no floating action buttons.

## 9. What Gets Deleted

### Deleted (4.7's work)
- All 47 `Page*.svelte` files in `_pages/`
- All editor infrastructure: `EditorMode`, `EditorShell`, `EditorTopBar`, `EditableText`, `PlacedAssetsLayer`, `DraggableAsset`, `AssetInspector`, `LibraryPanel`, `SaveIndicator`, `PageNav`, `ReadOnlyPageBoundary`
- Editor state: `EditorContext.svelte.ts`, `AutosaveCoordinator.svelte.ts`, `UndoStack.svelte.ts`, `editor-prefs.svelte.ts`
- Sidecar data: all `_data/page-*.json` files
- API routes: `/api/guide/level-1/page/[n]`, `/api/guide/level-1/library`
- Utilities: `library-schema.ts`, `library-client.ts`, `library-drop.ts`, `sidecar-schema.ts`, `original-artboards.ts`, `page-manifest.ts`
- Components: `PageFrame.svelte`, `HybridPage.svelte`, `TextPage.svelte`, `TitlePage.svelte`, `ArtboardPage.svelte`, `RenderedText.svelte`
- Old Pictograph/Sequence wrappers: `_lib/Pictograph.svelte`, `_lib/Sequence.svelte`, `Caption.svelte`, `SectionLabel.svelte`
- Compare route: `compare/+page.svelte`, `compare/+page.ts`
- `+page.svelte`, `+page.ts`, `+page.server.ts` (replaced by new route structure)
- Git tags: `phase-1-complete-guide-editor`, `phase-2-complete-guide-editor` (leave in git history, don't delete)

### Kept
- `static/guide/level-1/images/` — PNG pictograph assets (fallback + Illustrator diagrams)
- `static/guide/level-1/artboards/` — reference material (not rendered, but useful for comparison)
- `static/guide/level-1/images/_shared/level-1-front-cover.png` — cover art
- `static/guides/level-1.pdf` — the downloadable PDF
- `docs/superpowers/specs/2026-04-19-guide-editor-design.md` — historical reference

## 10. Phased Delivery

### Phase 1: Scaffold + Chapter 1.0

- Delete all 4.7 code listed in Section 9
- Create new route structure (`/guide/level-1`, three chapter routes)
- Build shared components: `GuidePictograph`, `GuidePictographGrid`, `GuideDiagram`, `GuideSection`, `GuideSequencePlayer`, sidebar nav
- Write data generation script, generate Chapter 1.0 data
- Convert all 13 sections of Chapter 1.0
- Landing page with TOC

### Phase 2: Chapter 1.1 (Letters)

- Generate Chapter 1.1 data (codex grids, compound letters, gamma letters, Type 2–6)
- Convert all 11 sections
- Most pictograph-dense chapter — stress tests `GuidePictographGrid`

### Phase 3: Chapter 1.2 (Words / CAPs / Reversals)

- Generate Chapter 1.2 data (complex sequences, 16-count, reversals)
- Convert all 13 sections
- Most sequence-heavy chapter — stress tests `GuideSequencePlayer`
- Some sequences here are 16 beats long — player needs to handle horizontal scrolling or wrapping

### Phase 4: Polish

- Mobile responsiveness audit
- Performance: lazy-load pictographs below fold (IntersectionObserver + dynamic import of data)
- Footer content (collab call, Taco Tuesday, support links)
- SEO: meta tags, structured data, OG images
- Verify against PDF page-by-page for content completeness
