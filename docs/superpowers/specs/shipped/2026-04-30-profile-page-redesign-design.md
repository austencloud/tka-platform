# Profile Page Redesign

Date: 2026-04-30
Status: Approved

## Summary

Redesign the creator profile page from a generic stacked layout with a 900px max-width bottleneck into a 2026-grade creator portfolio that scales from mobile to 4K ultrawide. Replace the leaderboard/ranking philosophy with a journey model that shows what people create, not how they rank.

## Decisions

### Hero Section
- **Horizontal layout**: avatar left, info + stats right, follow button far right
- **Stats merged into hero** — the separate `ProfileStatsGrid` component is removed
- Stats shown inline: Sequences, Collections, Followers (clickable → modal), Following (clickable → modal)
- `profileColor` field drives an ambient radial gradient behind the avatar that tints the hero area
- Avatar gets a subtle glow ring using `profileColor`
- No card border on hero — it breathes into the page, separated by gradient dividers
- Max-width 900px, centered
- **Collapses to centered vertical stack on mobile** (≤640px)
- Instagram link, props row, bio all present

### Pinned Showcase
- Compact horizontal strip below hero, separated by gradient dividers
- **1–6 pins**, any content type: sequence, collection, act, composition, mandala
- Cards are 200×160px (desktop), horizontally scrollable if >4
- Each card shows a type badge (color-coded: blue=sequence, purple=composition, green=mandala, amber=act)
- **Polymorphic data model**: `pinnedItems: { type: PinnableContentType, id: string }[]` on user doc
- **Empty state**: own profile shows "Pin your best work to showcase it here"; hidden on others' profiles when empty
- Glass card styling: `--theme-card-bg`, `--theme-stroke`, backdrop blur

### Content Tabs
- Replace Sequences / Followers / Following tabs with content-type tabs: **All | Sequences | Compositions | Mandalas | Acts**
- **Only show tabs for types the user actually has content for** — no empty tabs
- Followers / Following accessed by tapping the count numbers in the hero stats (opens modal/drawer)
- Tab bar uses glass styling matching PanelTabs pattern

### Gallery Cards
- **Thumbnail only** — no word label (visible in image header), no date (visible in image footer), no step count (evident from image)
- Star count shown as glassmorphic pill overlay, **bottom-right of thumbnail**
- **Hover reveal**: pill fades in with translateY micro-animation on hover
- **Always visible on mobile/touch** (no hover available)
- Only shown when starCount > 0
- Cards use glass styling: `--theme-card-bg`, backdrop blur, `--shadow-glass-hover` on hover
- Grid: `repeat(auto-fill, minmax(260px, 1fr))` — scales naturally to 4K

### 4K / Ultrawide Strategy
- No blanket max-width on all children
- Hero + dividers: max-width 900px, centered
- Showcase strip: full width (horizontally scrollable)
- Gallery: full width, auto-fill grid scales to 5, 6, 7+ columns naturally
- Connection/Admin sections: max-width 800px, centered
- At 2000px+: gallery cards minmax bumps to 300px, showcase cards grow to 240×180px

### Responsive (Mobile ≤640px)
- Hero collapses to centered vertical stack
- Avatar shrinks to 80px
- Gallery grid: minmax(150px, 1fr)
- Showcase cards: 160×130px
- Star pills always visible (no hover on touch)
- `prefers-reduced-motion`: all transforms/transitions disabled

### Data Model Changes
- **Add `pinnedItems` field** to user document: `{ type: "sequence" | "collection" | "act" | "composition" | "mandala", id: string }[]`
- **forkCount already removed** (done this session, 8 files cleaned)
- **starCount** already exists on LibrarySequence — just needs to be rendered
- `profileColor` already exists on UserProfile — used for ambient gradient

### Followers/Following Modal
- Tapping Followers or Following count in hero stats opens a modal/drawer
- Reuses existing `followerUsers` / `followingUsers` data and user-list-card pattern
- Lazy-loaded on open (existing pattern)

### Components Affected
- `UserProfilePanel.svelte` — remove ProfileStatsGrid import, restructure layout
- `ProfileHeroSection.svelte` — full rewrite: horizontal layout, stats inline, profileColor ambient, avatar glow
- `ProfileStatsGrid.svelte` — **deleted** (merged into hero)
- `ProfileTabs.svelte` — rewrite: content-type tabs, remove follower/following tabs, strip card meta, add star overlay
- `ProfileConnectionSection.svelte` — max-width 800px (already done)
- `ProfileAdminSection.svelte` — max-width 800px (already done)
- **New**: `ProfileShowcase.svelte` — pinned showcase strip
- **New**: `FollowersModal.svelte` — followers/following modal triggered from hero stats
- **New**: `PinnedItem` type + Firestore read/write for `pinnedItems`

### Out of Scope
- Learn module progress badge (slots in later when Learn ships)
- Cover image / banner (no field exists, not needed with profileColor ambient)
- View count display on cards (exists in data, not surfacing now)
- Scroll-driven hero compaction / sticky mini-bar (future enhancement)
- Custom renderers per content type in showcase — use existing `thumbnailUrl` / `thumbnailDataUri` fields as-is

## Visual Reference

Approved mockup: `.superpowers/brainstorm/43955-1777533416/content/profile-2026-v3.html`
