# Flow Arts Composer Marketing Page (`/composer`) — Design

**Date:** 2026-07-13
**Status:** Approved conversationally (skip-spec-gating applies)
**Driver:** Googling "Flow Arts Composer" returns an AI overview hallucinating a
TouchDesigner/Ableton mashup. No page anywhere ranks for the brand. TKA and
Flow Arts Composer are two separate entities now: TKA keeps the homepage;
the app gets its own crawlable page.

## Problem

- Homepage title/og/JSON-LD all say "TKA - The Kinetic Alphabet". "Flow Arts
  Composer" appears only in `alternateName`, `application-name`, and image alts.
- The app itself (`/create`) is an auth-gated JS shell, not a crawl target.
- Zero exact-phrase pages on the web → Google invents an answer.

## Decision

New public marketing page at **`/composer`** (`src/routes/(public)/composer/+page.svelte`),
sibling of `/notation`, same `public-editorial.css` editorial shell. The page IS
the Flow Arts Composer entity home: title, H1, definitional paragraph,
SoftwareApplication schema. The TKA homepage stays TKA's.

Approved in conversation: URL option A (`/composer`), copy option B (interview
with Austen + existing approved copy), visuals option C (one live hero embed,
rest prose + feature grid), CTA option C (primary "Open Composer" → `/create`,
secondary "See the notation" → `/notation`).

## SEO Head

- `<title>`: `Flow Arts Composer | Choreography App for Staff, Fans, Clubs & More`
- Meta description: definitional sentence (below)
- Canonical: `https://tkaflowarts.com/composer`
- OG/Twitter cards mirroring `/notation`'s pattern
- JSON-LD:
  - `SoftwareApplication` — **moved from homepage**, `url` updated to
    `https://tkaflowarts.com/composer`, author/publisher → TKA Organization
  - `HowTo` ("How to Create Flow Arts Choreography...") — **moved from homepage**
  - `BreadcrumbList` (Home → Composer)
- Homepage cleanup: remove those two blocks; drop "Flow Arts Composer" from the
  WebSite `alternateName` array (separate entities now). Homepage keeps
  WebSite + Organization + FAQ schema.

## Definitional paragraph (AI-overview bait, first prose on page)

> Flow Arts Composer is a free web app for building flow arts choreography.
> Construct sequences beat by beat, generate them from parameters, watch them
> animate, and share them with other flow artists. It supports staff, fans,
> clubs, hoops, buugeng, and more, built on The Kinetic Alphabet notation system.

## Sections (copy from Austen's interview, tightened; fire jam test applies)

1. **Hero** — H1 "Flow Arts Composer", definitional para, live animated
   sequence embed (the one wow moment), CTA row (Open Composer / See the notation).
2. **Build it beat by beat** — the constructor. "You're never presented with an
   invalid option": the app tracks validity, you create and approve. Before
   Composer this was red and blue pens on paper.
3. **Or just generate** — set parameters, hit generate, sequence appears. Every
   sequence produces a mandala; tunnels turn one performer into two, four, eight.
4. **Learn the language by osmosis** — every pictograph appears with its letter;
   you absorb the alphabet the way you absorbed language, by repeated exposure,
   no flashcards required. The map-of-the-territory framing: TKA maps the whole
   territory so your skills don't have holes. Levels split the difficulty; three
   of the nine theoretical levels are in the app today.
5. **In the app today / On the roadmap** — two honest lists (audited against
   codebase/memory):
   - Today: constructor, generator, 2D animation with trails, 3D viewer and
     scenes, library with collections and smart collections, community browse,
     tunnels, mandalas, image/video export with effects, choreo acts, practice
     modes, guide, play arcade, QR share via tka.run, PWA install, 11 props.
   - Roadmap: community video repository ("stored for generations, not
     Instagram-temporal"), 3D performance composing with 3D performers,
     camera practice overlay, higher levels (4+).
6. **Built on The Kinetic Alphabet** — relationship section. TKA exists on
   paper, existed before the app, and needs no app: pens and props suffice.
   Composer is an instrument built for the language, and you don't have to read
   the music to play it — the app handles the letters while you handle the
   movement. Cross-links: `/notation`, `/about`.
7. **CTA card** — same pattern as `/notation`'s (`cta-card` class).

## Hero embed

`InlineAnimationPlayer` (`src/lib/features/browse/.../media-viewer/InlineAnimationPlayer.svelte`)
is standalone by design ("Does not require Create module context"). Feed it a
baked-in `SequenceData` fixture (JSON of one real released sequence, captured
once from Firestore, stored beside the page as `demo-sequence.ts`). Wrap in
`LazyMount` (`src/lib/shared/components/LazyMount.svelte`) + dynamic import so
the animation engine never blocks initial paint; reserve the box
(`aspect-ratio`) per no-layout-shift. Prose is fully server-rendered; the embed
is progressive enhancement.

## Wiring

- `src/routes/sitemap.xml/+server.ts`: add `{ url: "composer", priority: "0.9", changefreq: "monthly" }`
  under pillar pages.
- `LandingFooter.svelte`: point the footer link at `/composer` (anchor text
  "Flow Arts Composer"); the page carries the app CTA.
- `/notation` page: inline prose link on "Flow Arts Composer" → `/composer`.
- SiteHeader: add Composer nav item if the header has a nav list (verify at build).
- Post-deploy (Austen): Search Console reindex request for `/` and `/composer`.

## Out of scope

- Renaming anything on the TKA homepage beyond removing the two moved schema
  blocks and the one alternateName entry.
- External mention updates (social bios, Kickstarter) — separate checklist for
  Austen.
- New screenshots/renders (embed + prose carry v1).

## Verification

- `npm run check` green (one full run before commit).
- Curl the built/preview page: title, H1, definitional para, JSON-LD present in
  SSR output.
- Sitemap output contains `/composer`.
- Homepage no longer emits SoftwareApplication/HowTo schema.

---

## Addendum (2026-07-13, round 2): editorial consistency + visual upgrade

Approved conversationally after audit + interview.

### Decisions
1. **Mini pillar nav (option A)** on all four editorial pages: shared sticky
   header component (brand wordmark → `/`, links Notation · Composer · Roots ·
   About, compact "Open Composer" button). One component = no drift.
2. **/about vs /notation role split:** /notation = the system (keeps
   PositionTrioGrid); /about = project + human + FAQ (PositionTrioGrid removed,
   links to /notation instead).
3. **/composer visual plan (all approved):** hero player stays; Construct gets
   live GuideSequencePlayer strip; Generate gets an interactive
   generationOrchestrator-backed "generate" demo + animated SequenceMandala;
   Tunnel gets lazy live preview (TunnelDetailPreview sandbox pattern); Learn
   gets GuidePictographs with letters; NEW 3D viewer section with still + deep
   link; feature bullet list shrinks to items without their own section.
   Generate demo params stay minimal (single action, no recipe UI).
4. **Breakout media pattern:** prose stays 46rem; visual bands widen (~70rem)
   on desktop. No change to mobile.
5. **Consistency pass:** Inter font loaded on all four (via shared nav
   component's head); title conventions unified; /roots gets canonical + OG +
   JSON-LD + breadcrumb; /roots CTA label/target fixed; homepage body/footer
   gain /notation links.
6. Screenshots captured from running app (browser control approved) for 3D
   viewer + Library.
