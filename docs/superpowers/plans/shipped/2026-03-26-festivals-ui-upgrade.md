# Festivals Module UI Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Festivals module UI — remove redundant top tab bar, add sidebar tab colors, replace Discover list with image card grid, convert My Workshops to card-based section grid, and enrich map popups with festival imagery.

**Architecture:** Five independent visual changes plus a data model addition (`imageUrl`). No new services or DI changes. All changes are UI-layer: component markup, styles, and one interface update. A separate image-sourcing task populates seed data with festival image URLs.

**Tech Stack:** Svelte 5, TypeScript, CSS Grid, date-fns

**Spec:** `docs/superpowers/specs/2026-03-25-festivals-ui-upgrade-design.md`

---

### Task 1: Add `imageUrl` to Data Models

**Files:**
- Modify: `src/lib/features/festivals/domain/models/festival.ts:17-40`
- Modify: `src/lib/features/festivals/data/festival-seed.ts:5-29`

- [ ] **Step 1: Add `imageUrl` to `Festival` interface**

In `src/lib/features/festivals/domain/models/festival.ts`, add after `websiteUrl?`:

```typescript
imageUrl?: string;
```

Line 31, between `websiteUrl?: string;` and `socialLinks?`:

```typescript
  imageUrl?: string;
```

- [ ] **Step 2: Add `imageUrl` to `FestivalSeed` interface**

In `src/lib/features/festivals/data/festival-seed.ts`, add after `websiteUrl?`:

```typescript
  imageUrl?: string;
```

- [ ] **Step 3: Update seed function in DiscoverTab to pass `imageUrl`**

In `src/lib/features/festivals/components/discover/DiscoverTab.svelte`, inside the `seedDatabase()` function, add after the `if (seed.estimatedSize)` line:

```typescript
        if (seed.imageUrl) doc.imageUrl = seed.imageUrl;
```

- [ ] **Step 4: Verify build**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/festivals/domain/models/festival.ts src/lib/features/festivals/data/festival-seed.ts src/lib/features/festivals/components/discover/DiscoverTab.svelte
git commit -m "feat(festivals): add imageUrl field to Festival and FestivalSeed interfaces"
```

---

### Task 2: Add Sidebar Tab Colors

**Files:**
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts:574-600`

- [ ] **Step 1: Add color and gradient to each FESTIVAL_TABS entry**

Replace the `FESTIVAL_TABS` block (lines 575-600) with:

```typescript
export const FESTIVAL_TABS: Section[] = [
  {
    id: "discover",
    label: "Discover",
    icon: '<i class="fas fa-compass" aria-hidden="true"></i>',
    description: "Browse flow festivals worldwide",
    color: "#10b981",
    gradient: "linear-gradient(135deg, #10b981, #34d399)",
  },
  {
    id: "map",
    label: "Map",
    icon: '<i class="fas fa-globe" aria-hidden="true"></i>',
    description: "Festival locations worldwide",
    color: "#f97316",
    gradient: "linear-gradient(135deg, #f97316, #fb923c)",
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: '<i class="fas fa-calendar-alt" aria-hidden="true"></i>',
    description: "Tracked festival dates and deadlines",
    color: "#6366f1",
    gradient: "linear-gradient(135deg, #6366f1, #818cf8)",
  },
  {
    id: "workshops",
    label: "My Workshops",
    icon: '<i class="fas fa-chalkboard-teacher" aria-hidden="true"></i>',
    description: "Teaching portfolio and application materials",
    color: "#a855f7",
    gradient: "linear-gradient(135deg, #a855f7, #c084fc)",
  },
];
```

- [ ] **Step 2: Verify build**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/navigation/config/tab-definitions.ts
git commit -m "feat(festivals): add color and gradient to sidebar tab definitions"
```

---

### Task 3: Remove Top Tab Bar from FestivalModule

**Files:**
- Modify: `src/lib/features/festivals/FestivalModule.svelte`

- [ ] **Step 1: Remove tab bar markup and related code**

In `FestivalModule.svelte`:

1. Remove the `tabs` array definition (lines 25-30):
```typescript
  const tabs: { id: FestivalTab; label: string; icon: string }[] = [
    { id: "discover", label: "Discover", icon: "fas fa-compass" },
    { id: "map", label: "Map", icon: "fas fa-globe" },
    { id: "calendar", label: "Calendar", icon: "fas fa-calendar-alt" },
    { id: "workshops", label: "My Workshops", icon: "fas fa-chalkboard-teacher" },
  ];
```

2. Remove the comment on line 40: `// When clicking internal tab buttons, also update global navigation state`

3. Remove the `switchTab` function (lines 41-44):
```typescript
  function switchTab(tabId: FestivalTab) {
    festivalState.activeTab = tabId;
    navigationState.setActiveTab(tabId);
  }
```

4. Remove the entire `<div class="tab-nav">` block from the template (lines 56-69):
```svelte
  <div class="tab-nav" role="tablist" aria-label="Festival Hub tabs">
    {#each tabs as tab}
      ...
    {/each}
  </div>
```

4. Remove all `.tab-nav`, `.tab-button`, and the `@media (max-width: 600px)` rule for `.tab-button` from the `<style>` block (lines 117-181).

The `VALID_TABS` array and the nav sync `$effect` blocks stay — they're needed for sidebar navigation to work.

- [ ] **Step 2: Verify build**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/festivals/FestivalModule.svelte
git commit -m "feat(festivals): remove redundant top tab bar, sidebar owns navigation"
```

---

### Task 4: Create FestivalGridCard Component

**Files:**
- Create: `src/lib/features/festivals/components/discover/FestivalGridCard.svelte`

- [ ] **Step 1: Create the grid card component**

Create `src/lib/features/festivals/components/discover/FestivalGridCard.svelte`:

```svelte
<script lang="ts">
  import { format, differenceInDays } from "date-fns";
  import type { Festival } from "../../domain/models/festival";
  import type { UserFestivalTracker } from "../../domain/models/festival-tracker";
  import { toDate } from "../../domain/models/timestamp-utils";
  import AttendanceBadge from "./AttendanceBadge.svelte";

  interface Props {
    festival: Festival;
    tracker?: UserFestivalTracker;
    attendanceCount: number;
    onselect: () => void;
    onbookmark: () => void;
  }
  let { festival, tracker, attendanceCount, onselect, onbookmark }: Props = $props();

  let imageLoaded = $state(false);
  let imageError = $state(false);

  const startDate = $derived(toDate(festival.dates.start));
  const endDate = $derived(toDate(festival.dates.end));
  const dateRange = $derived(
    `${format(startDate, "MMM d")} – ${format(endDate, "MMM d")}`
  );

  const now = new Date();
  const applicationsOpen = $derived(
    festival.applicationDeadline != null &&
    toDate(festival.applicationDeadline) > now &&
    (festival.seekingInstructors || festival.seekingPerformers)
  );

  const daysLeft = $derived(
    festival.applicationDeadline != null
      ? differenceInDays(toDate(festival.applicationDeadline), now)
      : null
  );

  const locationLabel = $derived(
    festival.location.city && festival.location.country
      ? `${festival.location.city}, ${festival.location.country}`
      : festival.location.city || festival.location.country
  );

  // Deterministic hue from festival name for gradient fallback
  const nameHue = $derived(
    festival.name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  );

  const regionLabels: Record<string, string> = {
    "north-america": "N. America",
    "south-america": "S. America",
    europe: "Europe",
    asia: "Asia",
    oceania: "Oceania",
    africa: "Africa",
  };

  function handleBookmark(e: MouseEvent) {
    e.stopPropagation();
    onbookmark();
  }

  function handleCardKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onselect();
    }
  }
</script>

<div
  class="grid-card"
  role="button"
  tabindex="0"
  onclick={onselect}
  onkeydown={handleCardKeydown}
  aria-label={`View details for ${festival.name}`}
>
  <div
    class="card-image"
    style="--fallback-bg: linear-gradient(135deg, hsl({nameHue}, 60%, 25%), hsl({nameHue}, 60%, 15%))"
  >
    {#if festival.imageUrl && !imageError}
      <img
        src={festival.imageUrl}
        alt={festival.name}
        class="festival-img"
        class:loaded={imageLoaded}
        onload={() => (imageLoaded = true)}
        onerror={() => (imageError = true)}
      />
    {/if}

    <div class="fallback-text" class:hidden={imageLoaded && !imageError}>
      <span>{festival.name}</span>
    </div>

    <span class="region-badge">{regionLabels[festival.region] ?? festival.region}</span>

    <button
      class="bookmark-btn"
      onclick={handleBookmark}
      aria-label={tracker?.status === "interested" ? "Remove bookmark" : "Bookmark festival"}
      aria-pressed={tracker?.status === "interested"}
    >
      <i
        class={tracker ? "fas fa-bookmark" : "far fa-bookmark"}
        aria-hidden="true"
      ></i>
    </button>
  </div>

  <div class="card-body">
    <h3 class="festival-name">{festival.name}</h3>
    <span class="location">
      <i class="fas fa-map-marker-alt" aria-hidden="true"></i>
      {locationLabel}
    </span>
    <span class="dates">
      <i class="fas fa-calendar" aria-hidden="true"></i>
      {dateRange}
    </span>
  </div>

  <div class="card-footer">
    <AttendanceBadge count={attendanceCount} />
    {#if applicationsOpen}
      <span class="badge-open">
        Open
        {#if daysLeft !== null && daysLeft >= 0}
          · {daysLeft}d left
        {/if}
      </span>
    {/if}
  </div>
</div>

<style>
  .grid-card {
    display: flex;
    flex-direction: column;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-lg, 12px);
    overflow: hidden;
    cursor: pointer;
    color: var(--theme-text, #ffffff);
    transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
  }

  .grid-card:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  }

  .grid-card:active {
    transform: translateY(0);
  }

  .grid-card:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* ── Image area ─────────────────────────────────────── */

  .card-image {
    position: relative;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: var(--fallback-bg);
  }

  .festival-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .festival-img.loaded {
    opacity: 1;
  }

  .fallback-text {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    text-align: center;
    font-size: 1.25rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  }

  .fallback-text.hidden {
    opacity: 0;
    pointer-events: none;
  }

  .region-badge {
    position: absolute;
    top: 8px;
    left: 8px;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: var(--font-size-xs, 11px);
    font-weight: 500;
    background: rgba(0, 0, 0, 0.55);
    color: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(4px);
  }

  .bookmark-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(4px);
    border: none;
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.85);
    cursor: pointer;
    font-size: 14px;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .bookmark-btn:hover {
    background: rgba(0, 0, 0, 0.7);
    color: var(--theme-accent, #6366f1);
  }

  /* ── Body ────────────────────────────────────────────── */

  .card-body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 14px 8px;
  }

  .festival-name {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .location,
  .dates {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .location i,
  .dates i {
    font-size: 10px;
    opacity: 0.7;
    flex-shrink: 0;
  }

  /* ── Footer ─────────────────────────────────────────── */

  .card-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px 12px;
  }

  .badge-open {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 8px;
    font-size: var(--font-size-xs, 11px);
    font-weight: 500;
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
    border: 1px solid rgba(34, 197, 94, 0.3);
    white-space: nowrap;
  }

  /* ── Reduced motion ─────────────────────────────────── */

  @media (prefers-reduced-motion: reduce) {
    .grid-card {
      transition: none;
    }

    .grid-card:hover {
      transform: none;
      box-shadow: none;
    }

    .festival-img {
      transition: none;
    }

    .bookmark-btn {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 2: Verify build**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/festivals/components/discover/FestivalGridCard.svelte
git commit -m "feat(festivals): create FestivalGridCard component with image support"
```

---

### Task 5: Convert DiscoverTab to Card Grid Layout

**Files:**
- Modify: `src/lib/features/festivals/components/discover/DiscoverTab.svelte`

- [ ] **Step 1: Replace FestivalCard import with FestivalGridCard**

In the `<script>` block, replace:
```typescript
  import FestivalCard from "./FestivalCard.svelte";
```
with:
```typescript
  import FestivalGridCard from "./FestivalGridCard.svelte";
```

- [ ] **Step 2: Replace list markup with grid markup**

Replace the `festival-list` div and its contents (lines 89-101):

```svelte
    <div class="festival-list" role="list" aria-label="Festival results">
      {#each festivalState.festivals as festival (festival.id)}
        <div role="listitem">
          <FestivalCard
            {festival}
            tracker={festivalState.trackers.get(festival.id)}
            attendanceCount={festivalState.attendanceCounts.get(festival.id) ?? 0}
            onselect={() => (festivalState.selectedFestival = festival)}
            onbookmark={() => handleBookmark(festival.id)}
          />
        </div>
      {/each}
    </div>
```

with:

```svelte
    <div class="festival-grid" role="list" aria-label="Festival results">
      {#each festivalState.festivals as festival (festival.id)}
        <div role="listitem">
          <FestivalGridCard
            {festival}
            tracker={festivalState.trackers.get(festival.id)}
            attendanceCount={festivalState.attendanceCounts.get(festival.id) ?? 0}
            onselect={() => (festivalState.selectedFestival = festival)}
            onbookmark={() => handleBookmark(festival.id)}
          />
        </div>
      {/each}
    </div>
```

- [ ] **Step 3: Replace `.festival-list` styles with `.festival-grid` styles**

Replace the `.festival-list` CSS rules (lines 154-176) with:

```css
  .festival-grid {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.25rem;
    align-content: start;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;
  }

  .festival-grid::-webkit-scrollbar {
    width: 6px;
  }

  .festival-grid::-webkit-scrollbar-track {
    background: transparent;
  }

  .festival-grid::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2));
    border-radius: 3px;
  }
```

- [ ] **Step 4: Verify build**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/festivals/components/discover/DiscoverTab.svelte
git commit -m "feat(festivals): convert Discover tab from list to responsive card grid"
```

---

### Task 6: Convert WorkshopPortfolioEditor to Card Grid Layout

**Files:**
- Modify: `src/lib/features/festivals/components/portfolio/WorkshopPortfolioEditor.svelte`

- [ ] **Step 1: Wrap portfolio sections in grid container**

Replace the opening of the `{:else}` block. Currently the sections are direct children of `.portfolio-editor`. Wrap them in a grid container.

After `{:else}` (line 276), change the markup so the sections are wrapped:

```svelte
  {:else}
    <div class="portfolio-grid">
      <!-- Workshops section (full width) -->
      <section class="section-card workshops-card">
        <!-- existing workshops section content unchanged -->
      </section>

      <!-- Bios section -->
      <section class="section-card">
        <!-- existing bios section content unchanged -->
      </section>

      <!-- Performance Credits -->
      <section class="section-card">
        <!-- existing credits section content unchanged -->
      </section>

      <!-- Performance Videos -->
      <section class="section-card">
        <!-- existing videos section content unchanged -->
      </section>

      <!-- Social Links -->
      <section class="section-card">
        <!-- existing social links section content unchanged -->
      </section>

      <!-- About -->
      <section class="section-card">
        <!-- existing about section content unchanged -->
      </section>
    </div>
  {/if}
```

The key changes:
1. Add `<div class="portfolio-grid">` wrapper around all sections (after `{:else}`, close before `{/if}`)
2. Change all 6 occurrences of `class="section"` to `class="section-card"` — use `replace_all` on the Edit tool since the class name is unique in this file
3. Add `workshops-card` class to only the first section (Workshops): `class="section-card workshops-card"`

- [ ] **Step 2: Update styles**

Replace `.portfolio-editor` styles and `.section` styles.

Replace:
```css
  .portfolio-editor {
    display: flex;
    flex-direction: column;
    gap: 0;
    height: 100%;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }
```

with:
```css
  .portfolio-editor {
    height: 100%;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  .portfolio-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(400px, 100%), 1fr));
    gap: 1.25rem;
    padding: 1.25rem;
  }
```

Replace:
```css
  .section {
    padding: 20px 20px 24px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
```

with:
```css
  .section-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-lg, 12px);
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .workshops-card {
    grid-column: 1 / -1;
  }
```

- [ ] **Step 3: Verify build**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/festivals/components/portfolio/WorkshopPortfolioEditor.svelte
git commit -m "feat(festivals): convert My Workshops to card-based responsive grid layout"
```

---

### Task 7: Enrich Map Popup with Festival Image

**Files:**
- Modify: `src/lib/features/festivals/components/map/FestivalMapPopup.svelte`

- [ ] **Step 1: Add image state and name-hue computation to script**

In the `<script>` block, add after the `applicationsOpen` derived:

```typescript
  let imageLoaded = $state(false);
  let imageError = $state(false);

  const nameHue = $derived(
    festival.name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  );

  const regionLabels: Record<string, string> = {
    "north-america": "N. America",
    "south-america": "S. America",
    europe: "Europe",
    asia: "Asia",
    oceania: "Oceania",
    africa: "Africa",
  };
```

- [ ] **Step 2: Add image section to popup template**

Replace the `<div class="festival-popup">` body with:

```svelte
<div class="festival-popup">
  <button class="close-btn" onclick={onclose} aria-label="Close popup" type="button">
    <i class="fas fa-times" aria-hidden="true"></i>
  </button>

  <div
    class="popup-image"
    style="--fallback-bg: linear-gradient(135deg, hsl({nameHue}, 60%, 25%), hsl({nameHue}, 60%, 15%))"
  >
    {#if festival.imageUrl && !imageError}
      <img
        src={festival.imageUrl}
        alt={festival.name}
        class="popup-img"
        class:loaded={imageLoaded}
        onload={() => (imageLoaded = true)}
        onerror={() => (imageError = true)}
      />
    {/if}

    <div class="fallback-text" class:hidden={imageLoaded && !imageError}>
      <span>{festival.name}</span>
    </div>

    <span class="region-badge">{regionLabels[festival.region] ?? festival.region}</span>
  </div>

  <div class="popup-body">
    <h3 class="festival-name">{festival.name}</h3>

    <div class="meta-row">
      <i class="fas fa-map-marker-alt" aria-hidden="true"></i>
      <span>{locationLabel}</span>
    </div>

    <div class="meta-row">
      <i class="fas fa-calendar-alt" aria-hidden="true"></i>
      <span>{dateRange}</span>
    </div>

    {#if applicationsOpen}
      <span class="badge-open">Applications Open</span>
    {/if}
  </div>

  <button class="view-details-btn" onclick={onviewdetails} type="button">
    View Details
    <i class="fas fa-arrow-right" aria-hidden="true"></i>
  </button>
</div>
```

- [ ] **Step 3: Add image styles to the style block**

Add after the `.festival-popup` rule:

```css
  .popup-image {
    position: relative;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: var(--fallback-bg);
    border-radius: 16px 16px 0 0;
    margin: -20px -20px 0;
  }

  .popup-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .popup-img.loaded {
    opacity: 1;
  }

  .fallback-text {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    text-align: center;
    font-size: 1.1rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  }

  .fallback-text.hidden {
    opacity: 0;
    pointer-events: none;
  }

  .region-badge {
    position: absolute;
    top: 8px;
    left: 8px;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: var(--font-size-xs, 11px);
    font-weight: 500;
    background: rgba(0, 0, 0, 0.55);
    color: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(4px);
  }
```

Update the `.popup-body` rule to add top padding since the image now sits above:

```css
  .popup-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px 0 16px 0;
    margin-bottom: 0;
  }
```

Add `popup-img` to the reduced-motion rule:

```css
  @media (prefers-reduced-motion: reduce) {
    .close-btn,
    .view-details-btn,
    .popup-img {
      transition: none;
    }
  }
```

- [ ] **Step 4: Verify build**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/festivals/components/map/FestivalMapPopup.svelte
git commit -m "feat(festivals): enrich map popup with festival image and region badge"
```

---

### Task 8: Source Festival Images for Seed Data

**Files:**
- Modify: `src/lib/features/festivals/data/festival-seed.ts`

- [ ] **Step 1: Research and add imageUrl to each festival seed entry**

Use web search to find appropriate images for each of the 51 seeded festivals. Priority:
1. Festival's own logo or banner from their website
2. Photo of the festival venue/event
3. Scenic photo of the festival's location (city, landscape)

For each festival in `FESTIVAL_SEEDS`, add an `imageUrl` field with a publicly accessible image URL. Use Unsplash, Wikimedia Commons, or the festival's own website for reliable hosting.

If no suitable image can be found for a festival, leave `imageUrl` undefined — the gradient fallback will handle it.

- [ ] **Step 2: Verify build**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/festivals/data/festival-seed.ts
git commit -m "feat(festivals): add image URLs to 51 seeded festival entries"
```

---

## Task Dependencies

```
Task 1 (data model) ──┬── Task 4 (grid card) ── Task 5 (discover layout)
                       ├── Task 7 (map popup)
                       └── Task 8 (seed images)
Task 2 (sidebar colors) ── independent
Task 3 (remove tab bar) ── independent
Task 6 (workshops layout) ── independent
```

Tasks 2, 3, and 6 can run in parallel with everything else.
Tasks 4 and 7 depend on Task 1 (they use `imageUrl`).
Task 5 depends on Task 4 (it imports `FestivalGridCard`).
Task 8 depends on Task 1 (it adds `imageUrl` values to seed data).
