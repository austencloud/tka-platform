# Festivals Module UI Upgrade — Design Spec

## Problem

The Festivals module has several UX issues:

1. **Redundant navigation** — tabs appear in both the sidebar and a horizontal top bar, wasting space and creating confusion about which controls navigation.
2. **Gray sidebar tabs** — all four sub-tabs under Festivals lack color/gradient definitions, rendering as gray icons that are hard to distinguish.
3. **Discover tab wastes space on wide screens** — single-column list leaves most of a 4K monitor empty.
4. **My Workshops layout doesn't scale** — single scrolling column of forms underutilizes horizontal space.
5. **Map popup is bare** — minimal text-only popup doesn't match the visual richness planned for Discover cards.

## Changes

### 1. Remove Top Tab Bar

Delete the horizontal tab bar rendered in `FestivalModule.svelte`. The sidebar already provides tab navigation (Discover, Map, Calendar, My Workshops). Removing the top bar reclaims ~50px of vertical space.

**Files affected:**
- `src/lib/features/festivals/FestivalModule.svelte` — remove tab bar markup and related tab-click handlers. Keep the bidirectional nav sync with `navigationState.activeTab`.

### 2. Sidebar Tab Colors

Add `color` and `gradient` properties to each tab in `src/lib/shared/navigation/config/tab-definitions.ts`:

| Tab | Color | Gradient |
|-----|-------|----------|
| Discover | `#10b981` (emerald) | `linear-gradient(135deg, #10b981, #34d399)` |
| Map | `#f97316` (orange) | `linear-gradient(135deg, #f97316, #fb923c)` |
| Calendar | `#6366f1` (indigo) | `linear-gradient(135deg, #6366f1, #818cf8)` |
| My Workshops | `#a855f7` (purple) | `linear-gradient(135deg, #a855f7, #c084fc)` |

The `SectionButton.svelte` component already supports these properties via `--section-gradient` CSS variable. Adding them to the tab definitions is sufficient.

### 3. Discover Tab — Card Grid with Images

#### Data Model Change

Add `imageUrl?: string` to the `Festival` interface in `src/lib/features/festivals/domain/models/festival.ts`.

#### Layout

Replace the single-column `festival-list` in `DiscoverTab.svelte` with a CSS Grid. The `FestivalFilterBar` remains above the grid, unchanged. The "Load more" and "Submit a festival" buttons remain below the grid, full-width, same styling as today.

Layout:

```css
.festival-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.25rem;
  padding: 1.25rem;
}
```

Expected column counts by screen width:
- 1440px (laptop): 3-4 columns
- 2560px (QHD): 5-6 columns
- 3840px (4K): 8+ columns (minmax will cap card width naturally)

#### Card Component

Create `FestivalGridCard.svelte` to replace `FestivalCard.svelte` usage in Discover. The existing `FestivalCard` may still be used elsewhere (detail views, popups), so keep it.

**Card structure:**
```
festival-grid-card
├── card-image (aspect-ratio: 16/9, overflow: hidden)
│   ├── <img> with object-fit: cover (if imageUrl exists)
│   ├── gradient-fallback (if no imageUrl)
│   │   └── festival name centered, large text
│   ├── bookmark-button (absolute, top-right)
│   └── region-badge (absolute, top-left, small pill)
├── card-body (padding)
│   ├── festival-name (truncated to 2 lines)
│   ├── location (city, country — single line, truncated)
│   └── date-range (formatted date span)
└── card-footer
    ├── attendance-badge (going count)
    └── applications-open indicator (if deadline > now && seeking)
```

**Props:** Same as existing `FestivalCard` — `festival`, `tracker`, `attendanceCount`, `onselect`, `onbookmark`.

**Hover state:** `translateY(-2px)` lift, `var(--theme-stroke-strong)` border, subtle shadow. Under `prefers-reduced-motion: reduce`, disable the lift and shadow transition.

**Keyboard:** `role="button"`, `tabindex="0"`, Enter/Space triggers `onselect` (same pattern as existing `FestivalCard`).

**Click:** Opens `FestivalDetailView` (existing behavior).

#### Image Fallback

When `imageUrl` is not set or fails to load:
- Background: `linear-gradient(135deg, hsl(H, 60%, 25%), hsl(H, 60%, 15%))` where H is derived from festival name hash: `name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360`. Deterministic color per festival.
- Festival name rendered centered in the gradient area, white text, `font-size: 1.25rem`, `font-weight: 600`.

**Image error handling:** Render the gradient fallback by default. Overlay the `<img>` element on top. Use a reactive `$state` boolean (`imageLoaded`) set via `onload`/`onerror` handlers. Show `<img>` only when loaded; on error, it stays hidden and the fallback remains visible.

#### Seed Data Images

During implementation, a subagent will search for appropriate images for the 51 seeded festivals and add `imageUrl` values to `festival-seed.ts`. Priority order:
1. Festival's own logo or banner
2. Photo of the festival venue/event
3. Scenic photo of the festival's location

Any festivals without a good image will use the gradient fallback.

Images are external URLs. Hotlinking is acceptable for seed data; the gradient fallback handles broken links gracefully. Firebase Storage hosting is out of scope (future enhancement).

**Migration:** The `imageUrl` field is optional. Existing Firestore documents work as-is with the gradient fallback. Re-seeding is optional — the seed button in admin will include `imageUrl` when writing new documents. No migration script needed.

### 4. My Workshops — Card-Based Section Grid

Replace the single scrolling column in `WorkshopPortfolioEditor.svelte` with a responsive card grid.

#### Layout

```css
.portfolio-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(400px, 100%), 1fr));
  gap: 1.25rem;
  padding: 1.25rem;
}
```

#### Section Cards

Each section becomes a card with consistent styling:

```css
.section-card {
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-lg, 12px);
  padding: 1.25rem;
}
```

**Sections:**

| Card | Content | Grid Behavior |
|------|---------|---------------|
| Workshops | Workshop list + Add button + inline form | `grid-column: 1 / -1` (full width — workshop forms need space) |
| Bio | BioEditor component | Normal flow |
| Performance Credits | String list + add row | Normal flow |
| Performance Videos | URL list + add row | Normal flow |
| Social Links | 2-column form grid | Normal flow |
| About | 2-column form grid (home city, years, insurance) | Normal flow |

Each card has a header row: section title (left) + action button if applicable (right, e.g. "Add Workshop").

The empty state (no portfolio) remains as-is — full-width centered CTA.

### 5. Map Popup — Rich Card Treatment

Replace the text-only `FestivalMapPopup.svelte` with a card that matches Discover's visual language.

**Popup structure:**
```
map-popup-card (max-width: 320px)
├── popup-image (aspect-ratio: 16/9)
│   ├── <img> or gradient fallback (same logic as grid card)
│   └── region-badge (top-left)
├── popup-body (padding)
│   ├── festival-name
│   ├── location (city, country)
│   ├── date-range
│   └── applications-open badge (if applicable)
└── popup-footer
    └── "View Details" button (full width)
```

**Styling:** Same `var(--theme-card-bg)` background and `var(--theme-stroke)` border as Discover cards, but fixed width (~320px) to fit comfortably in the map overlay. The map library's auto-pan handles positioning. If the popup exceeds the viewport, the map pans to accommodate.

## Files Affected

| File | Change |
|------|--------|
| `festivals/domain/models/festival.ts` | Add `imageUrl?: string` to both `Festival` and `FestivalSeed` interfaces |
| `festivals/data/festival-seed.ts` | Add `imageUrl` values for seeded festivals |
| `festivals/FestivalModule.svelte` | Remove top tab bar |
| `festivals/components/discover/DiscoverTab.svelte` | Replace list with card grid |
| `festivals/components/discover/FestivalGridCard.svelte` | New — image card component |
| `festivals/components/portfolio/WorkshopPortfolioEditor.svelte` | Rewrite layout as card grid |
| `festivals/components/map/FestivalMapPopup.svelte` | Rich card treatment |
| `navigation/config/tab-definitions.ts` | Add color/gradient to FESTIVAL_TABS |

## Out of Scope

- Map tab layout (already full-bleed, works well)
- Calendar tab layout (works well)
- Festival submission form changes
- New data fields beyond `imageUrl`
- Firebase Storage for image uploads (future enhancement)
