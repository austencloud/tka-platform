# Landing Page Redesign — Design Spec

**Date:** 2026-03-27
**Status:** Approved

## Overview

Redesign the landing page based on the "community-hub" prototype aesthetic, using a hybrid approach: video carousel hero → 5-step notation explainer → navigation doorways → interactive effects showcase → printable guides.

All props default to double staves on the landing page — the canonical TKA prop.

## Design Decisions

### Approach
- **Hybrid layout**: Video hook → notation build-up → navigation → effects showcase → guides
- **Community-hub aesthetic**: Warm tones (amber/teal accents), Instrument Serif headings, DM Sans body, dark base
- **Live components**: Notation cards use real PictographRenderer/ChoreoCard components, not static images
- **Data-driven video carousel**: Videos managed as a data list, no code changes to add/remove
- **Responsive showcase**: Side panel on desktop/4K, stacked on mobile

### Section Order

1. **Hero** — Title, subtitle, video carousel
2. **How TKA Works** — 5-step grid (Hands → Props → Motion → Sequence → Animation)
3. **What's Here** — 4 fully-clickable doorway cards with inline icons
4. **Play With It** — Endless spinner with effect chips + prop switcher
5. **Printable Guides** — 3 clickable download cards
6. **Footer**

---

### Section 1: Hero

- Title: "The Kinetic Alphabet"
- Subtitle: "Notation for flow arts. A shared language for staff, fans, clubs, hoops, and everything you grip and spin."
- Video carousel:
  - Data-driven list of cherry-picked performance videos (unlimited, add without code changes)
  - Crossfade on timer (~5s interval)
  - Manual prev/next navigation arrows
  - Dot indicators
  - Credit line below (performer name + prop type)
  - Videos: autoplay, muted, looping embeds

### Section 2: How TKA Works

5-step grid layout. Top row of 3, bottom row of 2 centered. Each step builds on the previous, teaching one layer at a time. All use live components (PictographRenderer / ChoreoCard), not static images.

**Top row (3 cards):**
1. **Hand positions** — PictographRenderer showing just hands on the grid (no props, no arrows). Position glyph visible (α). "Two hands on a diamond grid. Where they sit is the position."
2. **Add props** — Same position, now with props rendered. Shows double staves. "Each hand holds a prop. Staves, fans, clubs — the notation works for all of them."
3. **Add motion** — Full single-beat pictograph with arrows showing hand paths and prop rotation. Letter glyph visible. "Arrows show the hand path. The letter encodes direction, timing, and prop rotation."

**Bottom row (2 cards, centered):**
4. **String them together** — ChoreoCard rendering a short sequence (e.g., AABB). Word displayed above. "Letters form a word. Each beat reads left to right."
5. **Watch it move** — Mini animation player showing the same sequence animated. "Every sequence animates. See the props spin through each beat."

**Connected narrative:** All 5 cards derive from the same loaded sequence. Card 1 shows the start position (hands only). Card 2 adds props to that same position. Card 3 shows beat 1 with motion arrows. Card 4 shows the full sequence as a ChoreoCard. Card 5 animates it.

### Section 3: What's Here

- 2x2 grid of doorway cards (single column on mobile)
- Each card is a fully-clickable `<a>` tag — entire card is the link
- **Inline icon layout**: icon on left, content middle, arrow right
- Hover: border glow, slight lift (-2px), arrow slides right and turns amber
- Cards:
  - **The Composer** (pen-nib icon, indigo) → `/create` — "Build sequences or generate them from a word. Animate and export."
  - **Sequence Library** (book-open icon, green) → `/browse` — "2,800+ sequences. Browse, filter, find patterns."
  - **Watch Tutorials** (play-circle icon, pink) → YouTube (temporary) / `/tutorials` (future) — "Video walkthroughs for each prop type."
  - **About & Roots** (seedling icon, amber) → `/about` — "Where TKA came from. The ideas behind it."

### Section 4: Play With It

**Heading:** "Play with it" — the buttons explain themselves.

**Content:** The endless spinner running live, generating and playing back sequences continuously.

**Interactive controls:**
- **Effect chips** (pill buttons, min 44px height for touch): Clean, Trails, Fire, Charcoal, LEDs — swap the renderer effect live
- **Prop switcher**: "Change prop" button to cycle through prop types

**Layout (responsive):**
- **Desktop/4K (wide side panel)**: Animation canvas on the left, beat notation grid on the right side panel. Side panel shows sequence word + beat cells only — no redundant metadata.
- **Mobile/narrow (stacked)**: Canvas on top, beat strip at bottom. Same content, vertical layout.

**Technical:** Uses the existing endless spinner / infinite sequence generator. Autoplays on scroll-into-view. Playback bar may be unnecessary since endless spinner runs continuously — decide during implementation.

**What this is NOT:**
- Not a composition tool (compositions = multi-grid layouts with mixed media, a future feature)
- Not repeating Section 2's animation demo — Section 2's 5th card already covers "sequences animate"
- This section showcases the effects layer and prop variety

### Section 5: Printable Guides

- 3 cards in a horizontal row (stacks on mobile)
- Each card is a clickable `<a download>` — entire card triggers PDF download
- Level badge, title, description, download indicator button
- Cards:
  - **Level 1: Base Motions** — "Six letters. Zero turns. The building blocks everything else rests on."
  - **Level 2: Whole Turns** — "Same six letters, now with 180° rotations. The props spin through each motion."
  - **Level 3: Half Turns & Floats** — "90° rotations and float entries. Finer control, more expressive sequences."
- Closing note: "Start with Level 1. Grab a pair of staves and follow along."

### Section 6: Footer

- Credit: "Made by Austen Cloud."
- Links: About, Roots, Open the app, Terms, Privacy

---

## Copy Rules

All text follows the fire jam test (see CLAUDE.md). No AI-isms, no marketing fluff. Direct, specific, human.

## Technical Notes

- Background: Night Sky (existing BackgroundHost component) or community-hub's solid dark base — decide during implementation
- Scroll-triggered reveal animations (IntersectionObserver, fade-up)
- Reduced motion: all animations disabled via `prefers-reduced-motion`
- SEO: existing JSON-LD structured data retained from current landing page
- Video data source: array/config file, not hardcoded in component
- All props default to double staves on the landing page

## Issues Fixed By This Redesign

1. Card showcase artificially capped at 700px width
2. Animated section shows different sequence than the one built up in progression
3. "Notation animates" section looks hacked together — two components side-by-side without cohesion
4. AI-generated copy throughout ("Sequences performed with Staffs, clubs and fans", "In practice real performances", "The figure on the left is the performance" — there is no figure on the left)
5. "What's Here" cards not fully clickable, two link to same destination
6. "Guides" card links to section directly below it (redundant)
7. No effects showcase — the app's visual effects are a selling point but invisible on the landing page
8. No prop switching — visitors can't see what TKA looks like with different props

## Visual Reference

Complete mockup: `.superpowers/brainstorm/291820-1774669812/complete-page.html`
Section-specific mockups in the same directory.
