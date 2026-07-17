# Flow Arts Software SEO Pass + Software Lineage Page

**Date:** 2026-07-16
**Status:** Approved (brainstormed with Austen this session)
**Branch:** `feat/flow-arts-software-seo` (worktree `C:\worktrees\tka-platform\flow-arts-software-seo`)

## The Hole

The query "flow arts software" surfaces nothing of ours. The phrase appears zero
times in `src/`. Page-one results are AR Flow Arts (a video-effects app), Taylor
Flows (hoop tutorials), flowarts.me (a resource site), and flowchart-software
noise (Visio, Slite). No result is a choreography tool. The term is a
commercial-intent ghost town and nobody is trying to own it.

Our own docs saw this coming and lost it: `seo-content-roadmap.md:56` flagged
"flow arts choreography software / app" as a commercial keyword, but the newer
authoritative `seo-winning-strategy.md` (2026-07-14) never mentions "software"
once. This spec closes that gap.

## Strategy

One page owns the commercial phrase (`/composer`), everything else links to it
with varied natural anchors, and a new informational lineage page
(`/roots/software`) takes the "know" intent while honoring the tools TKA
descends from. Two adjacent SERP results, not two competing ones.

`flowartscomposer.com` already 301s into `tkaflowarts.com/composer`, so
authority consolidates on the right page.

## Section 1: /composer owns the phrase

File: `src/routes/(public)/composer/+page.svelte`

- **Title** (line 60): `Flow Arts Composer | Choreography App for Staff, Fans,
  Clubs & More` becomes `Flow Arts Composer | Free Flow Arts Software for
  Choreography`. "App" stays in body copy so both variants stay covered
  without stuffing the title.
- **`DESCRIPTION` const** (line 11, feeds meta description, og/twitter
  description, and SoftwareApplication JSON-LD description): reworked to lead
  with the phrase. Draft: "Flow Arts Composer is free flow arts software for
  building choreography in your browser. Construct sequences step by step,
  generate them from parameters, animate them, and share them. Supports staff,
  fans, clubs, hoops, buugeng, and more."
- **OG/Twitter titles** (lines 67, 72): follow the new title.
- **Page subtitle** (line 182): "The flow arts choreography app built on The
  Kinetic Alphabet" becomes "Free flow arts software built on The Kinetic
  Alphabet" (keeps the `/notation` link).
- **Lede paragraph** (line 188): first sentence adopts the new DESCRIPTION
  opening so visible copy matches metadata.
- **SoftwareApplication JSON-LD**: add a `keywords` property: "flow arts
  software, flow arts choreography software, flow arts app".

## Section 2: Internal link web

Only `/composer` targets the bare commercial phrase in its metadata
(`/roots/software` targets the informational variant "history of flow arts
software", which contains but does not compete for the head term). Other
pages mention it once,
in prose, as or near a link to `/composer`, with varied anchors:

- **New FAQ item** in `src/lib/shared/landing/faq/faq-items.ts` (renders on `/`
  and `/about`, feeds FAQPage JSON-LD): question "Is there software for flow
  arts choreography?", answer names Flow Arts Composer as free flow arts
  software that runs in the browser, CTA to `/composer`. NOTE: this file has
  uncommitted edits in the primary checkout from another session; this branch
  edits the committed version and any merge conflict is expected and small.
- **/notation** (line 156 area): the existing "Then Flow Arts Composer..."
  sentence gains "software" phrasing.
- **Per-prop notation pages** (`/notation/fans`, `/notation/clubs`,
  `/notation/buugeng`): each already links "Flow Arts Composer"; one light
  wording touch each ("choreography software" in the surrounding sentence),
  varied per page, not the full phrase on all three.
- **/roots/software** links to `/composer` once with the exact "flow arts
  software" anchor (the only exact-match anchor on the site).
- **Nav/footer labels stay clean** ("Composer"). No keyword-stuffed nav.

## Section 3: Config + strategy docs

- `src/config/domains.ts`: add "flow arts software, flow arts choreography
  software" to `LANDING_SEO_CONFIG.keywords` and `APP_SEO_CONFIG.keywords`.
- `docs/reference/seo-winning-strategy.md`: add the software cluster with the
  SERP evidence (term unowned, commercial intent, /composer owns it,
  /roots/software takes informational intent).
- `docs/superpowers/specs/2026-07-16-seo-a-plus-plan.md`: add ledger entries
  for this pass.
- `src/routes/sitemap.xml/+server.ts`: add `/roots/software` to the static URL
  list.

## Section 4: The lineage page — /roots/software

File: `src/routes/(public)/roots/software/+page.svelte`. The `/roots` prefix
already routes as public in `domains.ts` (prefix match), so no mode-detection
change.

**Head:** title "The History of Flow Arts Software | The Kinetic Alphabet".
Meta description mentions no competitor brand names (anti-brand-jacking
guardrail: their names appear only in body copy and H2s, never title/meta).
`Article` + `BreadcrumbList` JSON-LD, same pattern as `/roots`.

**Structure (era-based lineage):**

1. **The VTG era** — the VTG app across versions. AMENDED post-research: the
   Kevin "NCK" first-version and Alien Jon animation credits are podcast-sourced
   only and could not be confirmed by any live source, so the shipped page
   credits only what the store listings verify (current release by Michael
   Caden Pike and Noel Yee) and says "multiple versions with different
   developers" for the rest. Revisit if tutorials.firestaff.net comes back up.
2. **The LAB family** — Pike's simulators: Poi LAB, Double Staff LAB, Hoop
   Twinz LAB, Tutting Lab. Status noted (live/delisted), store links where
   they exist.
3. **Today** — AR Flow Arts, Taylor Flows, and anything else the research
   verification pass confirms. flowarts.me noted as a resource site, not
   software, if included at all.
4. **Where TKA fits** — closing section linking `/composer` (the exact-match
   anchor) and cross-linking `/roots`.

**Fact gate:** every claim comes from the flow-arts-wiki cited drafts
(`C:\flow-arts-wiki\content\drafts\MCP_(flow_arts).wiki`,
`Vulcan_Tech_Gospel.wiki`, `Vulcan_Crew.wiki`, `Noel_Yee.wiki`,
`research-synthesis-2026-02-11.md`) or the live verification research pass run
this session. Anything unverified gets cut, not hedged. VisualSpinner is
currently unverified; it ships only if the research pass confirms it.

**Framing guardrails (Austen's explicit concerns):**

- No rankings, no "best", no reviews. Lineage and respect, not comparison.
- Every living project gets a prominent outbound link to its own home.
- Competitor brand names never appear in our title tag or meta description.
- Dead/delisted tools are documented as history (that is a service, not
  theft).

**Copy:** editorial register on `public-editorial.css` like other pillar
pages. Fire-jam test. No em dashes anywhere user-visible. Varied sentence
length. `/roots` gets a short cross-link section pointing here.

## Verification

- One full `npm run check` in the worktree before commit.
- Grep the diff for U+2014 (em dashes): zero in user-visible text.
- Grep confirming the exact phrase appears in title/meta on `/composer` only.
- Confirm `/roots/software` present in sitemap static list.
- Curl the built or dev-served pages if a server is available; otherwise
  static checks + check output are the evidence.

## Ledger

- [x] /composer title, DESCRIPTION, og/twitter, subtitle, lede, JSON-LD keywords
- [x] FAQ item added (faq-items.ts)
- [x] /notation wording touch
- [x] Per-prop notation pages wording touches (fans, clubs, buugeng)
- [x] domains.ts keywords
- [x] /roots/software page built (research-verified roster)
- [x] /roots cross-link to /roots/software
- [x] sitemap static list entry
- [x] seo-winning-strategy.md software cluster section
- [x] seo-a-plus-plan.md ledger entries
- [x] Verification pass (check, em-dash grep, phrase-placement grep)
