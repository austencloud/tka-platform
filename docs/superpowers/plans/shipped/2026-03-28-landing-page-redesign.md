# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the landing page with a community-hub aesthetic: video carousel hero → 5-step notation explainer → navigation doorways → interactive effects showcase → printable guides.

**Architecture:** Replaces the existing landing page sections with new components while reusing proven infrastructure (PictographRenderer, ChoreoCard, EndlessSpinnerOrchestrator, VideoShowcaseSection). Each section is its own component composed in the root `+page.svelte`. All notation cards use live components, not static images.

**Tech Stack:** Svelte 5, TypeScript, ITI DI, PictographRenderer, ChoreoCard, EndlessSpinnerOrchestrator, EndlessVideoPlayer, Firestore (showcase videos)

**Spec:** `docs/superpowers/specs/2026-03-27-landing-page-redesign-design.md`

---

## File Structure

### New files to create:
- `src/routes/landing/components/HeroCarouselSection.svelte` — Section 1: video carousel hero
- `src/routes/landing/components/HowTkaWorksSection.svelte` — Section 2: 5-step notation grid
- `src/routes/landing/components/WhatsHereSectionV2.svelte` — Section 3: doorway cards with inline icons
- `src/routes/landing/components/PlayWithItSection.svelte` — Section 4: endless spinner + effects + prop switcher
- `src/routes/landing/landing-videos.ts` — Data-driven video list for carousel

### Files to modify:
- `src/routes/+page.svelte` — Replace section composition, keep SEO metadata

### Files reused as-is:
- `src/routes/landing/components/GuidesSection.svelte` — Section 5 (minor style tweaks only)
- `src/routes/landing/components/LandingFooter.svelte` — Section 6 (minor style tweaks only)
- `src/routes/landing/components/VideoShowcaseSection.svelte` — Reused inside HeroCarouselSection
- `src/lib/features/landing-preview/components/EndlessVideoPlayer.svelte` — Video crossfade player
- `src/lib/shared/pictograph/shared/components/PictographRenderer.svelte`
- `src/lib/shared/pictograph/shared/components/PictographContainer.svelte`
- `src/lib/features/choreo-card/components/ChoreoCard.svelte`
- `src/lib/features/landing/services/implementations/EndlessSpinnerOrchestrator.ts`
- `src/lib/features/landing/services/implementations/InfiniteSequenceGenerator.ts`
- `src/lib/shared/background/shared/components/BackgroundHost.svelte`

### Files that become unused (can be removed after redesign is verified):
- `src/routes/landing/components/HearthSection.svelte`
- `src/routes/landing/components/NotationProgressionSection.svelte`
- `src/routes/landing/components/NotationShowcaseSection.svelte`
- `src/routes/landing/components/VideoPerformanceSection.svelte`
- `src/routes/landing/components/LazyLandingDemo.svelte`
- `src/routes/landing/components/LandingAnimationDemo.svelte`

---

## Task 1: Video Carousel Data + Hero Section

**Goal:** Replace the HearthSection with a video carousel hero.

**Files:**
- Create: `src/routes/landing/landing-videos.ts`
- Create: `src/routes/landing/components/HeroCarouselSection.svelte`

- [ ] **Step 1: Create video data file**

Create `src/routes/landing/landing-videos.ts` with a typed array of video entries. Each entry has a video source URL, performer name, and prop type. This is the data-driven list — add videos here without touching components.

```typescript
export interface LandingVideo {
  src: string;           // video URL (Firestore storage or CDN)
  performer: string;     // "Kai M."
  prop: string;          // "double staves"
}

export const LANDING_VIDEOS: LandingVideo[] = [
  // Populate with real videos — for now, use showcase videos from Firestore
  // This array can also be loaded from Firestore at runtime
];
```

**Decision:** If videos should come from Firestore's `showcaseVideos` collection (like the current VideoShowcaseSection does), this file becomes a fallback/override list and the component queries Firestore. Check how `VideoShowcaseSection.svelte` queries Firestore — it filters `featured: true, approved: true`. Reuse that pattern.

- [ ] **Step 2: Create HeroCarouselSection component**

Create `src/routes/landing/components/HeroCarouselSection.svelte`. Structure:
- Title: "The Kinetic Alphabet"
- Subtitle: "Notation for flow arts. A shared language for staff, fans, clubs, hoops, and everything you grip and spin."
- Video carousel frame (16:9 aspect ratio) with crossfading slides. Videos must have `autoplay muted loop playsinline` attributes.
- Prev/next navigation buttons
- Dot indicators (one per video)
- Credit line below (performer name + prop)
- Crossfade timer (~5s interval), manual nav resets timer

Reference the existing `EndlessVideoPlayer.svelte` at `src/lib/features/landing-preview/components/EndlessVideoPlayer.svelte` for crossfade implementation patterns, but this carousel may need a simpler approach since it's multiple discrete videos with dots, not an infinite loop.

Alternatively, reuse `VideoShowcaseSection.svelte` directly if it already supports the carousel pattern — read it first to determine if adaptation or new component is better.

- [ ] **Step 3: Verify hero renders**

Add HeroCarouselSection to `+page.svelte` temporarily (alongside existing sections, not replacing yet). Confirm it renders with placeholder content. Check responsive behavior at mobile widths.

- [ ] **Step 4: Commit**

```
feat(landing): add hero video carousel section
```

---

## Task 2: How TKA Works — 5-Step Grid

**Goal:** Create the 5-step notation explainer using live PictographRenderer and ChoreoCard components.

**Files:**
- Create: `src/routes/landing/components/HowTkaWorksSection.svelte`

- [ ] **Step 1: Understand PictographRenderer props for each card**

Read these files to understand how to configure each card's pictograph:
- `src/lib/shared/pictograph/shared/components/PictographRenderer.svelte` — the renderer props
- `src/lib/shared/pictograph/shared/components/PictographContainer.svelte` — smart wrapper that prepares data
- `src/routes/landing/components/HearthSection.svelte` — existing example of loading a sequence and rendering a pictograph on the landing page

The key pattern: load a sequence via `browseLoader.loadFullSequenceData()`, then extract start position and individual steps to feed into PictographRenderer with different visibility flags:
- Card 1 (Hands): `showGrid=true`, hide props and arrows via motion visibility flags
- Card 2 (Props): `showGrid=true`, show props, hide arrows
- Card 3 (Motion): `showGrid=true`, show props, show arrows, `showTKA=true` (letter glyph)
- Card 4 (Sequence): Use ChoreoCard with the full sequence
- Card 5 (Animation): Mini version of the animation player

- [ ] **Step 2: Create HowTkaWorksSection component**

Create `src/routes/landing/components/HowTkaWorksSection.svelte`. Structure:
- Heading: "How TKA works" (centered)
- Top row: 3 cards in CSS grid (`grid-template-columns: repeat(3, 1fr)`, stacks on mobile)
- Bottom row: 2 cards centered (`max-width: 640px, margin: 0 auto`)
- Each card has: step number badge, live pictograph/component, heading, description
- Connected narrative: all 5 cards derive from one loaded sequence (e.g., AABB)

Card structure per step:
1. **Hand positions** — PictographContainer with props hidden, arrows hidden. Position glyph visible.
2. **Add props** — Same position, props visible (double staves), arrows hidden.
3. **Add motion** — Beat 1 of the sequence with full pictograph (props + arrows + letter glyph).
4. **String them together** — ChoreoCard rendering the full sequence. Word label above.
5. **Watch it move** — Lazy-loaded mini animation player. Could reuse a simplified version of `LandingAnimationDemo` or create a minimal player that just animates one sequence.

**Important:** For cards 1-3, you need to construct `PreparedPictographData` with the right visibility. Study how `PictographContainer` does this — it may handle visibility internally via props like `blueMotionVisible`, `redMotionVisible`. The key is:
- Card 1: set `blueMotionVisible=false, redMotionVisible=false` and find how to hide props (check if there's a prop visibility flag, or if you need to construct MotionData without prop placement)
- Card 2: still `blueMotionVisible=false, redMotionVisible=false` but with props showing
- Card 3: full visibility

If hiding props independently isn't straightforward, consider using PictographRenderer directly with manually constructed data where props are omitted for card 1.

- [ ] **Step 3: Load sequence data on mount**

Use the same pattern as HearthSection: on mount, call `browseLoader.loadFullSequenceData("seq_1773477720946_so6kw28yf")` (the AABB sequence). If this ID doesn't resolve (returns null), fall back to generating a fresh AABB sequence via the MCP tools or by constructing minimal StepData for the 4 beats manually. The section must not break silently if the hardcoded ID is missing. Extract:
- `startPosition` → Cards 1 and 2
- `steps[0]` → Card 3
- Full sequence → Card 4
- Full sequence → Card 5 (animation)

- [ ] **Step 4: Style the grid layout**

CSS for the 5-step grid:
- Top row: `display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;`
- Bottom row: `display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; max-width: 640px; margin: 0 auto;`
- Mobile (`max-width: 680px`): both rows become `grid-template-columns: 1fr`
- Card styling: matches community-hub aesthetic (card-bg, card-border, hover glow)
- Step number badges: small amber circles with numbers

- [ ] **Step 5: Verify all 5 cards render with real components**

Add HowTkaWorksSection to `+page.svelte` temporarily. Confirm:
- Cards 1-3 show real pictographs with correct visibility
- Card 4 shows real ChoreoCard
- Card 5 shows mini animation (or placeholder for now)
- Grid layout is responsive

- [ ] **Step 6: Commit**

```
feat(landing): add 5-step "How TKA Works" notation grid
```

---

## Task 3: What's Here — Doorway Cards with Inline Icons

**Goal:** Replace WhatsHereSection with inline-icon doorway cards.

**Files:**
- Create: `src/routes/landing/components/WhatsHereSectionV2.svelte`

- [ ] **Step 1: Create WhatsHereSectionV2 component**

Create `src/routes/landing/components/WhatsHereSectionV2.svelte`. Structure:
- Heading: "What's here"
- 2x2 grid of doorway cards (single column on mobile)
- Each card is a fully-clickable `<a>` tag with inline icon layout:
  - Left: colored icon badge (40x40px, rounded, with Font Awesome icon)
  - Middle: title (Instrument Serif) + description (DM Sans, dimmed)
  - Right: arrow that slides right + turns amber on hover

Cards data (hardcoded, 4 items):
```typescript
const DOORWAYS = [
  { href: '/create', icon: 'fas fa-pen-nib', iconClass: 'composer', title: 'The Composer', desc: 'Build sequences or generate them from a word. Animate and export.' },
  { href: '/browse', icon: 'fas fa-book-open', iconClass: 'library', title: 'Sequence Library', desc: '2,800+ sequences. Browse, filter, find patterns.' },
  { href: 'https://youtube.com/@tkaflowarts', icon: 'fas fa-play-circle', iconClass: 'tutorials', title: 'Watch Tutorials', desc: 'Video walkthroughs for each prop type.' },
  { href: '/about', icon: 'fas fa-seedling', iconClass: 'about', title: 'About & Roots', desc: 'Where TKA came from. The ideas behind it.' },
];
```

Icon badge colors:
- composer: `background: rgba(99,102,241,0.12); color: #818cf8;`
- library: `background: rgba(34,197,94,0.12); color: #4ade80;`
- tutorials: `background: rgba(244,114,182,0.12); color: #f472b6;`
- about: `background: rgba(212,129,58,0.12); color: var(--accent);`

Hover: `border-color: var(--card-border-hover); box-shadow: 0 0 20px var(--accent-glow); transform: translateY(-2px);`

- [ ] **Step 2: Verify rendering and hover states**

Add to `+page.svelte` temporarily. Check:
- All 4 cards render with icons
- Hover state works (glow, lift, arrow animation)
- Entire card is clickable (not just text)
- Mobile: stacks to single column at 600px
- Touch targets meet minimum 44px height

- [ ] **Step 3: Commit**

```
feat(landing): add doorway cards with inline icons for What's Here
```

---

## Task 4: Play With It — Endless Spinner + Effects + Prop Switcher

**Goal:** Create the interactive effects showcase section with the endless spinner.

**Files:**
- Create: `src/routes/landing/components/PlayWithItSection.svelte`

- [ ] **Step 1: Study existing LandingAnimationDemo**

Read `src/routes/landing/components/LandingAnimationDemo.svelte` (~657 lines). Understand:
- How it creates the EndlessSpinnerOrchestrator
- How it connects to AnimatorCanvas
- How DemoControlBar manages effects (trails, fire, LEDs)
- How it handles prop type cycling
- What the lazy loading pattern looks like

This is the heaviest component. PlayWithItSection will reuse the same orchestrator and canvas but with a different layout and control surface.

- [ ] **Step 2: Create PlayWithItSection component**

Create `src/routes/landing/components/PlayWithItSection.svelte`. Structure:
- Heading: "Play with it"
- Control bar: effect chips (pill buttons) + prop switcher button, all in a flex row
- Showcase unit (responsive):
  - Desktop (>800px): CSS grid with `grid-template-columns: 1fr 220px` — canvas left, notation panel right
  - Mobile (≤800px): single column — canvas on top, beat strip below
- Canvas: uses AnimatorCanvas (same as LandingAnimationDemo)
- Side panel (desktop): sequence word + beat grid (4-column grid of mini pictographs)
- Beat strip (mobile): horizontal row of beat cells

Effect chips: Clean, Trails, Fire, Charcoal, LEDs
- Pill buttons with min-height 44px (touch target)
- Active state: amber background + border
- Each chip sets the effect on the animator canvas
- **Verify "Charcoal" exists** in the animation engine before implementing. Check `DemoControlBar.svelte` for the list of available effects. If Charcoal doesn't exist, replace with whatever effects the engine actually supports.

Prop switcher: "Change prop" button with shuffle icon
- Cycles through prop types (staves → fans → clubs → etc.)
- Updates the canvas renderer

**Key implementation detail:** This component needs lazy loading (IntersectionObserver) since it pulls in the animation engine. Wrap the heavy content in a lazy loader similar to `LazyLandingDemo.svelte`.

- [ ] **Step 3: Implement effect switching**

Wire up the effect chips to the animation canvas. Study how `DemoControlBar.svelte` at `src/routes/landing/components/DemoControlBar.svelte` handles effect toggling — it likely sets properties on the animator canvas or a state object.

- [ ] **Step 4: Implement prop switching**

Wire up the "Change prop" button. Study how HearthSection's prop cycling works (`RANDOM_PROPS` from `landing-content.ts`). Apply the selected prop type to the canvas renderer.

- [ ] **Step 5: Implement responsive notation panel**

Desktop: side panel showing sequence word + beat cells in a 4-column grid. Each beat cell renders a mini pictograph (use PictographRenderer at small size).

Mobile: same beat cells in a horizontal strip below the canvas.

Use CSS `@media (max-width: 800px)` to switch between layouts. The side panel's `border-left` becomes `border-top` on mobile.

- [ ] **Step 6: Verify the section works**

Add to `+page.svelte` temporarily. Confirm:
- Endless spinner autoplays
- Effect chips toggle correctly
- Prop switching works
- Notation panel shows current sequence beats
- Responsive layout switches at 800px
- Touch targets are at least 44px

- [ ] **Step 7: Commit**

```
feat(landing): add Play With It effects showcase section
```

---

## Task 5: Update GuidesSection Styling

**Goal:** Minor style updates to make GuidesSection match the redesigned page aesthetic.

**Files:**
- Modify: `src/routes/landing/components/GuidesSection.svelte`

- [ ] **Step 1: Review current GuidesSection**

Read `src/routes/landing/components/GuidesSection.svelte`. The content is already good — 3 level cards with PDF downloads. Changes needed:
- Ensure entire card is a clickable `<a download>` tag (not just a link inside the card)
- Add a download indicator button/badge inside each card
- Match card styling to community-hub aesthetic (card-bg, card-border, hover glow)
- Ensure minimum touch target sizes

- [ ] **Step 2: Apply styling updates**

Update the card structure so each card is wrapped in an `<a>` tag with `download` attribute. Add a `guide-dl` span showing "↓ Download PDF". Match the hover state to other sections (glow + lift).

- [ ] **Step 3: Verify**

Confirm cards are fully clickable, download works, hover state matches other sections.

- [ ] **Step 4: Commit**

```
style(landing): update GuidesSection cards to be fully clickable downloads
```

---

## Task 6: Compose the Final Page

**Goal:** Wire all new sections into `+page.svelte`, replacing the old section composition.

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Replace section imports and composition**

Update `src/routes/+page.svelte`:
- Remove old section imports (HearthSection, NotationProgressionSection, NotationShowcaseSection, VideoPerformanceSection, old WhatsHereSection)
- Add new section imports (HeroCarouselSection, HowTkaWorksSection, WhatsHereSectionV2, PlayWithItSection)
- Keep: GuidesSection, LandingFooter, BackgroundHost
- Keep: all SEO metadata (`<svelte:head>` block)

New composition order:
```svelte
<HeroCarouselSection />
<hr class="divider" />
<HowTkaWorksSection />
<hr class="divider" />
<WhatsHereSectionV2 />
<hr class="divider" />
<PlayWithItSection />
<hr class="divider" />
<GuidesSection />
<LandingFooter />
```

- [ ] **Step 2: Add section dividers and scroll-reveal animations**

Add `<hr class="divider">` between sections (styled as `border-top: 1px solid var(--card-border)`).

Keep the existing IntersectionObserver scroll-reveal pattern. Wrap each section in a `.scroll-reveal` div.

- [ ] **Step 3: Remove old state management**

The old page managed `aabbSequence` state and `landingPropType` state that was passed between HearthSection and other sections. The new design handles state differently:
- HowTkaWorksSection loads its own sequence data internally
- PlayWithItSection manages its own prop type and effects state
- No cross-section state needed from the root page

Remove: `aabbSequence`, `landingPropType`, `handleSequenceLoaded`, `handlePropTypeChange` from the root page.

- [ ] **Step 4: Clean up old component files**

After verifying the new page works, remove unused components:
- `src/routes/landing/components/HearthSection.svelte`
- `src/routes/landing/components/NotationProgressionSection.svelte`
- `src/routes/landing/components/NotationShowcaseSection.svelte`
- `src/routes/landing/components/VideoPerformanceSection.svelte`
- `src/routes/landing/components/LazyLandingDemo.svelte`
- `src/routes/landing/components/LandingAnimationDemo.svelte`
- `src/routes/landing/components/WhatsHereSection.svelte`
- `src/routes/landing/components/DemoControlBar.svelte` (check if used elsewhere first — if PlayWithItSection replaces its functionality, it becomes unused)

**Do NOT remove until the new page is verified working.** Ask the user to check first.

- [ ] **Step 5: Full page verification**

Load the landing page at `localhost:5173`. Verify:
- All 6 sections render in correct order
- Video carousel plays and crossfades
- 5-step grid shows real pictographs
- Doorway cards are clickable with correct destinations
- Effects showcase autoplays and switches work
- Guide cards download PDFs
- Footer links work
- Scroll-reveal animations fire on scroll
- Mobile responsive at 375px, 768px, 1920px, 4K
- No console errors
- `prefers-reduced-motion` disables animations

- [ ] **Step 6: Commit**

```
feat(landing): complete landing page redesign with all new sections
```

---

## Task 7: Remove Old Landing Page at /landing Route

**Goal:** Clean up the alternate landing page route.

**Files:**
- Remove: `src/routes/(public)/landing/+page.svelte`

- [ ] **Step 1: Check if /landing route is linked anywhere**

Search the codebase for references to `/landing` route. If nothing links to it, it's safe to remove.

- [ ] **Step 2: Remove the file**

Delete `src/routes/(public)/landing/+page.svelte` — it's the old alternate landing page with different sections (HeroSection, NotationShowcaseSection, GuidesSection only).

- [ ] **Step 3: Commit**

```
chore(landing): remove unused /landing alternate route
```

---

## Execution Notes

- **Task order matters:** Tasks 1-4 can be developed somewhat independently (each creates a standalone section), but Task 6 composes them all and should be last.
- **Task 2 is the hardest:** Getting PictographRenderer to show hands-only (no props, no arrows) for Card 1 may require investigation. The component may not have a direct "hide props" flag — you may need to construct PictographData with empty motion data.
- **Task 4 is the heaviest:** Reusing the animation engine requires understanding the EndlessSpinnerOrchestrator + AnimatorCanvas integration. Study the existing LandingAnimationDemo thoroughly.
- **Double staves default:** All pictograph rendering on the landing page uses double staves (PropType.STAFF). The prop switcher in Section 4 is the only place other props appear.
- **No branches:** All work on main, per CLAUDE.md rules.
