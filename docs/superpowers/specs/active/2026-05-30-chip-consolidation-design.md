# Chip / Pill Consolidation — Design + Phased Migration

**Goal:** Consolidate the codebase's interactive chip/pill UI onto one definitive primitive — `src/lib/shared/browse/components/filter-chips/FilterChipBase.svelte` (modes `toggle | dropdown | action`) — plus `SegmentedControl` for single-select rows, deleting the byte-duplicate base and migrating hand-rolled inline filter bars feature-by-feature.

> SPEC ONLY. No code changes are authorized by this document. Every implementation phase below ships independently with an explicit `git commit -- <pathspec>` (shared index holds other agents' WIP — see Risks).

---

## Evidence base (verified this session)

All claims below are grounded in Read/Grep output captured during authoring:

- **Canonical base:** `src/lib/shared/browse/components/filter-chips/FilterChipBase.svelte` — `mode?: "toggle" | "dropdown" | "action"` at line 18; `action` documented as "momentary button (no chevron, no switch role)" at line 17. Renders a `<button class="filter-chip">` with `role` switching on mode (line 58), optional `count` badge (lines 73–75), chevron only in `dropdown` mode (lines 77–79), and a fixed-position popover for `children` (lines 82–91).
- **Duplicate base:** `src/lib/features/browse/sequences/filtering/components/inline-filter/FilterChipBase.svelte` — byte-identical to the canonical copy EXCEPT line 17 reads `mode?: "toggle" | "dropdown";` (no `action`). It is a strict subset; nothing is lost by deleting it. Both copies carry the same dead `import { t }` at line 9 (no `t(` call anywhere in either file — confirmed by grep returning "No matches").

---

## Canonical primitive — why `FilterChipBase`

The shared-`browse` copy is the superset (adds `mode="action"`) and lives in `shared/` where any feature may import it without crossing a feature boundary (the cross-feature-decoupling backlog spec at `docs/superpowers/specs/backlog/2026-05-23-cross-feature-decoupling-design.md:70` already flags `choreo-card`/`retro` importing across into `features/browse/`). It already backs the production filter row.

### Current API (verified, lines 11–23 of the canonical file)

```ts
interface Props {
  label: string;
  icon?: string;                          // FontAwesome class, e.g. "fas fa-layer-group"
  active?: boolean;                       // selected/on state
  count?: number | null;                  // optional count badge
  chipColor?: string;                     // CSS color or var; default var(--theme-accent)
  mode?: "toggle" | "dropdown" | "action";
  expanded?: boolean;                     // dropdown open state (parent-owned)
  disabled?: boolean;
  children?: Snippet;                     // popover contents (dropdown mode)
  onclick?: () => void;
}
```

### Modes

| Mode | Role | Use |
|---|---|---|
| `toggle` | `role="switch"`, `aria-pressed` | one independent boolean (e.g. Favorites, a single multi-select option) |
| `dropdown` | `aria-haspopup="listbox"` + chevron + popover | chip that opens a list of options (Level, Length, Family) |
| `action` | plain `button` | momentary action (clear, apply) |

### Additions it needs to absorb the inline patterns

Prefer reuse over extension. After reading the representative inline bars, the existing API already covers their needs with one exception worth pre-deciding:

1. **`size` variant (small, optional add).** Several inline bars render denser chips (e.g. `PropFilterChips.svelte` uses `padding: 4px 10px`, `border-radius: 20px`, `font-size-compact`). The base hard-codes `padding: 10px 14px` (line 99). To match without per-callsite overrides, add `size?: "sm" | "md"` (default `"md"`), where `sm` reduces padding to ~`6px 10px`. Rationale: avoids 60 callsites shipping `style=` overrides; mirrors the `size` prop SegmentedControl already exposes (`SegmentedControl.svelte:23`). This is the ONLY base change proposed; everything else reuses existing props. Defer adding it until a phase actually needs it (Phase 2), then thread it through both `toggle` and the button styling.

No new mode is needed. No `chips` array prop is needed — callers `{#each}` over their own data and render one `FilterChipBase` per item (the wrapper-chip pattern already proven in `LevelFilterChip.svelte`).

### Dead-import cleanup (folded into Phase 0)

Both base copies import `t` (line 9) and never use it. Remove the line from the surviving canonical file during Phase 0.

---

## Wrapper chips already delegating (no migration needed — reference implementations)

These already consume a `FilterChipBase` and are the canonical reuse pattern to copy:

| Wrapper | Imports | Pattern |
|---|---|---|
| `shared/browse/components/filter-chips/LevelFilterChip.svelte:7` | `./FilterChipBase.svelte` (canonical) | dropdown, single-select list |
| `shared/browse/components/filter-chips/LengthFilterChip.svelte:7` | `./FilterChipBase.svelte` (canonical) | dropdown |
| `shared/browse/components/filter-chips/LOOPFilterChip.svelte:7` | `./FilterChipBase.svelte` (canonical) | dropdown |
| `shared/browse/components/filter-chips/FavoritesFilterChip.svelte:6` | `./FilterChipBase.svelte` (canonical) | toggle |
| `choreo-card/components/filters/FamilyFilterChip.svelte:8` | **duplicate** (`inline-filter/FilterChipBase.svelte`) — multi-select dropdown | repoint in Phase 0 |
| `browse/.../inline-filter/chips/PositionFilterChip.svelte:6` | **duplicate** (`../FilterChipBase.svelte`) | repoint in Phase 0 |
| `browse/.../inline-filter/chips/LetterFilterChip.svelte:6` | **duplicate** (`../FilterChipBase.svelte`) | repoint in Phase 0 |
| `browse/.../inline-filter/chips/GridModeFilterChip.svelte:7` | **duplicate** (`../FilterChipBase.svelte`) | repoint in Phase 0 |

The four `shared/browse` wrappers already point at the canonical base — they need NO change. The four in the table's bottom group point at the duplicate and are Phase 0 work.

`BrowseFilterBar.svelte` (`src/lib/shared/browse/components/BrowseFilterBar.svelte:11-14`) composes `Level/Favorites/Length/LOOPFilterChip` — already canonical, no change.

---

## Phase 0 — Kill the duplicate (highest value, zero behavior change)

**Delete** `src/lib/features/browse/sequences/filtering/components/inline-filter/FilterChipBase.svelte` and repoint its exact 7 consumers (found via `grep "import FilterChipBase from"`) at the canonical shared base. Each repoint is an import-line-only change; the component API is identical (superset), so runtime behavior is unchanged.

### Exact import edits

| File:line | Before | After |
|---|---|---|
| `src/lib/features/browse/sequences/filtering/components/inline-filter/chips/PositionFilterChip.svelte:6` | `import FilterChipBase from "../FilterChipBase.svelte";` | `import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";` |
| `src/lib/features/browse/sequences/filtering/components/inline-filter/chips/LetterFilterChip.svelte:6` | `import FilterChipBase from "../FilterChipBase.svelte";` | `import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";` |
| `src/lib/features/browse/sequences/filtering/components/inline-filter/chips/GridModeFilterChip.svelte:7` | `import FilterChipBase from "../FilterChipBase.svelte";` | `import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";` |
| `src/lib/features/choreo-card/components/filters/FamilyFilterChip.svelte:8` | `import FilterChipBase from "$lib/features/browse/sequences/filtering/components/inline-filter/FilterChipBase.svelte";` | `import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";` |
| `src/lib/features/choreo-card/components/filters/CatalogInteriorFilterPanel.svelte:8` | `import FilterChipBase from "$lib/features/browse/sequences/filtering/components/inline-filter/FilterChipBase.svelte";` | `import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";` |
| `src/lib/features/choreo-card/components/CatalogBrowseFilterBar.svelte:3` | `import FilterChipBase from "$lib/features/browse/sequences/filtering/components/inline-filter/FilterChipBase.svelte";` | `import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";` |
| `src/lib/features/retro/labs/RetroPictographLab.svelte:11` | `import FilterChipBase from "$lib/features/browse/sequences/filtering/components/inline-filter/FilterChipBase.svelte";` | `import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";` |

Also: delete the dead `import { t } from "$lib/shared/i18n/i18n.svelte";` (line 9) from the surviving canonical `FilterChipBase.svelte` — it's referenced nowhere in the file.

### Phase 0 verification

- `npm run check` clean (one full cold run into a log; the only risk is a missed relative-path consumer — grep `inline-filter/FilterChipBase` must return zero non-doc hits after the edit).
- Visual smoke of the chips those files render: sequence browse filter row (Position/Letter/GridMode chips), the choreo-card Catalog browse filter bar + interior filter panel + Family chip, and the Retro pictograph lab. Confirm each chip still toggles/opens its popover.

### Phase 0 acceptance criteria

- `inline-filter/FilterChipBase.svelte` no longer exists.
- `grep -r "inline-filter/FilterChipBase"` over `src/` returns no matches.
- `npm run check` passes with no new errors.
- All 7 repointed screens render and interact identically (verified visually).
- Commit touches ONLY the 7 consumers + the deleted file + the canonical file's dead-import removal: `git commit -- <those 9 paths>`.

---

## Phases 1..N — Inline-bar migration (feature-by-feature, low → high risk)

Each phase migrates ONE filter-bar family. Single-select groups route to `SegmentedControl` (`src/lib/shared/3d/components/controls/SegmentedControl.svelte` — `options/value/onchange/color/size`, sliding indicator, `aria-pressed`). Multi-select rows route to `FilterChipBase` `toggle` chips. Phases are independently shippable.

### Routing rule (applied per bar)

- **Mutually-exclusive options, exactly one active** (including an "All" reset) → `SegmentedControl`. FilterChipBase has NO single-select-group/sliding-indicator semantics (it manages no group exclusivity), so N toggle chips would only fake it via parent state and lose the indicator. SegmentedControl is the correct primitive.
- **Independent booleans, many can be on at once** → N × `FilterChipBase mode="toggle"`.

### Representative conversion (multi-select → FilterChipBase)

Before (`PropFilterChips.svelte:34-44`):
```svelte
<button type="button" class="prop-chip" class:selected={isSelected}
        onclick={() => onToggle(prop)} aria-pressed={isSelected} aria-label="{info.label} filter">
  <img src={info.image} alt="" class="chip-icon" aria-hidden="true" />
  <span class="chip-label">{info.label}</span>
</button>
```
After:
```svelte
<FilterChipBase mode="toggle" size="sm" label={info.label} active={isSelected}
                onclick={() => onToggle(prop)} />
```
(image-icon callers either pass an `icon` FontAwesome class or, if an `<img>` is required, that bar is a candidate to keep its own thin wrapper — flag during the phase rather than forcing it.)

### Representative conversion (single-select → SegmentedControl)

Before (`level5-lab/FilterChips.svelte:24-55`, four `class="chip" class:active` buttons, exactly one active):
```svelte
<button class="chip" class:active={selectedGroup === "all"} onclick={() => onSelect("all")}>All …</button>
```
After:
```svelte
<SegmentedControl
  options={[
    { value: "all", label: "All" },
    { value: "tau-diamond", label: "Tau Diamond" },
    { value: "tau-box", label: "Tau Box" },
    { value: "terra", label: "Terra" },
  ]}
  value={selectedGroup}
  onchange={onSelect}
  color="accent"
  size="sm"
/>
```
(Per-option count badges — `level5` shows counts — are not currently a SegmentedControl feature; if counts must stay, either add an optional `count` to its `Option` type as a scoped extension in that phase, or keep the counts in an adjacent label. Decide per-phase; default to dropping inline counts only if product confirms.)

### Phase ordering (each = one bar family, grep-enumerated)

Enumerated from `grep 'class="chip|class="pill|class="filter-chip|...'` (197 files total; the list below is the interactive-filter-bar subset after reading candidates — display badges, tooltip chips, and nav pills are NOT in scope and stay as-is). Classification (S = single-select → SegmentedControl, M = multi-select → FilterChipBase toggles) was read from each file's handler/aria semantics where checked; bars marked "(verify)" need a 2-minute read at phase start to confirm S vs M before converting.

**Phase 1 — Browse / creators prop filter (lowest risk, isolated, M).**
- `src/lib/features/browse/creators/components/PropFilterChips.svelte` — M (multi-select, `selectedProps.includes`, `aria-pressed`, verified lines 30-46). → `FilterChipBase mode="toggle"` (needs `size="sm"`; introduce the `size` prop here). `<img>` icon: keep a thin per-callsite image slot or pass through `icon` if a font glyph exists.

**Phase 2 — level5-lab position group (S, isolated lab).**
- `src/lib/features/levels/level5-lab/components/FilterChips.svelte` — S (single `selectedGroup`, verified lines 23-56) → `SegmentedControl`. Resolve the per-chip count question here.

**Phase 3 — Festivals discover filter bar (S × 3 radiogroups).**
- `src/lib/features/festivals/components/discover/FestivalFilterBar.svelte` — three `role="radiogroup"` single-select rows (Region/Time/Seeking, verified lines 66-90) → three `SegmentedControl`s. Region has 7 options (wide); confirm horizontal-scroll vs wrap behavior of SegmentedControl at that count before committing.
- Sibling in same family (verify, likely display/detail, NOT filter): `festivals/components/discover/FestivalDetailView.svelte`, `festivals/components/calendar/FestivalCalendarEntry.svelte` — read; only migrate the ones that are interactive filters.

**Phase 4 — Feedback manage filter bar (already abstracted; align, don't rewrite).**
- `src/lib/features/feedback/components/manage/FeedbackFilterBar.svelte` already delegates to a local `FilterButton.svelte` (verified lines 81-125) with a single-select `chip-group` (type) + panel-trigger buttons. This is NOT a raw-button bar. Decide: either (a) leave as-is (it's already a clean abstraction) or (b) re-skin `FilterButton` to wrap `FilterChipBase mode="action"/"toggle"`. Recommend (a) unless visual drift is observed — lowest churn. Flag, don't force.

**Phase 5 — Compose browse filter bars (mixed; MorphChip stays).**
- `src/lib/features/compose/tabs/browse/components/CompositionFilterBar.svelte` already uses `MorphChipGroup`/`MorphChip` (verified lines 8-9) — KEEP (morph-chip is a keep-separate primitive). No migration.
- `src/lib/features/landing-preview/components/VideoFilterBar.svelte` — read fully at phase start; it exposes category/performer/featured filters via callbacks (lines 14-45). Classify each control S vs M and route. `filterFeatured` is a tri-state (`boolean | null`) → likely SegmentedControl with three options, not a toggle.

**Phase 6 — choreo-card subset / loop catalog bars (M, higher-traffic).**
- `src/lib/features/choreo-card/components/card-preview/SubsetFilterBar.svelte`, `choreo-card/components/LoopCatalogFilters.svelte` (verify S/M each). These sit near already-migrated FilterChipBase consumers (`CatalogBrowseFilterBar`, `FamilyFilterChip`) so the conversion pattern is established; ship after Phase 0 has proven the shared base in this feature.

**Phase 7 — level7-lab + remaining lab bars (S/M, isolated labs, last).**
- `src/lib/features/levels/level7-lab/Level7LabModule.svelte`, plus any lab filter bar still on raw `class="chip"` after the above (re-grep at phase start to get the current residue). Labs are internal/lower-stakes → safe to do last.

> The remaining ~180 `class="chip|pill"` files from the grep are predominantly: display-only badges/pills, nav pills (`animation-panel/pill-nav/*` — explicitly KEEP per `feedback_keep_pill_nav`), effect-customize sliders, and the keep-separate primitives below. They are NOT interactive filter bars and are out of scope. Each phase re-greps its own feature to confirm no raw filter buttons were missed.

### Per-phase verification (applies to every phase 1..N)

1. `npm run check` clean (one cold run per phase, at the commit gate).
2. Visual confirmation the migrated bar filters identically: select each option, confirm the underlying list/grid responds, confirm active styling and (for SegmentedControl) the sliding indicator lands on the right segment.
3. Keyboard + a11y: SegmentedControl exposes `aria-pressed`; FilterChipBase toggles expose `role="switch"`/`aria-pressed`. Confirm no checkbox crept in (grep the diff for `type="checkbox"`).
4. Commit with explicit pathspec for that feature only.

### Per-phase acceptance criteria

- Zero raw `<button class="chip|pill|filter-chip">` filter buttons remain in the migrated bar (grep the file).
- Single-select bars use `SegmentedControl`; multi-select use `FilterChipBase mode="toggle"`.
- `npm run check` passes; no new errors.
- Bar behaves identically (verified visually, evidence in the phase report).
- Commit pathspec lists only that feature's files.

---

## Keep-separate primitives (do NOT fold into FilterChipBase)

Each verified to exist this session:

| Primitive | Path | Why separate |
|---|---|---|
| `SegmentedControl` | `src/lib/shared/3d/components/controls/SegmentedControl.svelte` | Single-select group with sliding indicator — the capability FilterChipBase deliberately lacks. The migration TARGET, not a duplicate. |
| `MorphChip` / `MorphChipGroup` | `src/lib/shared/foundation/ui/morph-chip/{MorphChip,MorphChipGroup}.svelte` | Animated morphing chip group with shared layout transitions; distinct interaction model. |
| `BpmChips` | `src/lib/shared/animation-engine/components/controls/BpmChips.svelte` | Domain-specific tempo presets, not a generic filter. |
| `MotionColorChips` | `src/lib/shared/components/MotionColorChips.svelte` | Color-swatch selector, not a label/toggle chip. |
| `PresetChip` / `PresetChipBar` | `src/lib/shared/settings/components/tabs/prop-type/{PresetChip,PresetChipBar}.svelte` | Prop-type preset selector with its own data shape. |
| `MotionTypePills` | `src/lib/features/choreo-card/components/MotionTypePills.svelte` | Display-only motion-type badges (see Naming). |
| `*Badge` components | various | Display-only, non-interactive — never a chip. |
| Nav pills | `src/lib/shared/animation-panel/pill-nav/*` | Explicitly retained per `feedback_keep_pill_nav`. |

---

## Phase F (final, optional, lowest priority) — Naming cleanup

Cosmetic only. Proposed rule: **interactive = `*Chip`, display-only = `*Badge`.** Implied renames (do NOT bundle with behavior changes; ship as a pure rename PR if done at all):

- `MotionTypePills.svelte` — display-only (parses & renders motion-type labels) → `MotionTypeBadges` (and the `motion-pill` class → `motion-badge`). Note: `FamilyFilterChip.svelte` renders its own inline `motion-pill` spans (lines 160-168) — those are display badges inside an interactive chip; rename the class for consistency only.
- `VTGModeChips.svelte` (`src/lib/features/learn/components/interactive/vtg/vtg-experience/VTGModeChips.svelte`) — read to confirm interactive vs display; rename to `*Badge` only if non-interactive.
- `VariationPill.svelte`, `LinkedSequenceChip.svelte`, `PropContextChip.svelte`, `TimeSignatureChip.svelte`, `LetterChip.svelte` — audit each: keep `*Chip` if interactive, rename to `*Badge` if display-only.

Defer this phase indefinitely unless the inconsistency actively causes confusion. It carries import-site churn for zero behavior benefit.

---

## Risks / blast radius

- **Shared git index (primary process risk).** The working tree currently holds other agents' uncommitted WIP (`git status` shows large unrelated mandala/3d/render churn). Every phase MUST `git add` + `git commit -- <its own explicit paths>` — never a bare `git commit`, never `git add -A/.`. A bar migration touches only its feature's files plus, for Phase 0, the 9 enumerated paths.
- **Single-select capability gap (primary technical risk).** Routing a single-select bar to N FilterChipBase toggles would silently break the "exactly one active" invariant and drop the sliding indicator. Mitigation: the routing rule forces single-select bars to SegmentedControl. Every phase classifies S vs M from the file's own handler before converting; "(verify)" bars get a read at phase start.
- **Icon shape mismatch.** `PropFilterChips` uses `<img>` icons; FilterChipBase's `icon` is a FontAwesome class. Phases that hit image-icon bars must decide pass-through vs a thin wrapper rather than dropping the icon.
- **SegmentedControl width at high option counts.** Festivals Region (7 options) may overflow; confirm scroll/wrap before committing Phase 3.
- **Count badges in SegmentedControl.** Single-select bars that show per-option counts (level5) need a decision (extend `Option` with `count`, or drop) — scoped to that phase.
- **No barrel/index churn expected.** All imports are direct file paths (`$lib/...`), matching existing style — no re-export indices to update.

---

## Summary of deliverable phases

| Phase | Scope | Files | Route |
|---|---|---|---|
| 0 | Kill duplicate base | 7 consumers + 1 deleted + 1 dead-import = 9 | repoint imports |
| 1 | Browse creators prop filter | 1 | M → FilterChipBase + add `size` |
| 2 | level5-lab position group | 1 | S → SegmentedControl |
| 3 | Festivals discover bar | 1 (+ verify 2 siblings) | S×3 → SegmentedControl |
| 4 | Feedback manage bar | 1 (FilterButton) | align/keep (recommend keep) |
| 5 | Compose/landing video bars | 1 migrate (+ 1 keep: MorphChip) | mixed S/M |
| 6 | choreo-card subset/loop bars | 2 (verify) | M → FilterChipBase |
| 7 | level7-lab + lab residue | 1+ (re-grep) | S/M |
| F | Naming cleanup (optional) | ~6 renames | cosmetic |
