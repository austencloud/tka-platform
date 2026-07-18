# Per-Prop Notation Pages — Design

Date: 2026-07-16
Status: Approved direction (brainstormed this session); awaiting spec review
Owner: Austen + Claude

## Problem

`/notation` is a single page. There are no per-prop pages anywhere on the site,
so the site never answers the queries real spinners search for ("fan spinning
notation", "poi notation", "buugeng notation"), and the honest per-prop story
Austen wants told has no home:

> "Every prop is so unique that even when applying The Kinetic Alphabet's
> pedagogy it still has unique challenges with grip changes and body mechanics
> that can only be solved per prop. I only have authority to speak on double
> staves. Fans is not a language I speak regarding grip types, so I don't know
> if I'm qualified to write the page on how the Kinetic Alphabet can be used
> with fans. That might be the job of somebody who comes after me."

That honesty is the design, not a limitation to hide.

## Decisions made (brainstorm answers)

1. **Scope:** core four (staves, fans, clubs, buugeng) **plus poi** as a
   restricted-subset page. Hoops/triquetra/sword etc. deferred.
2. **Voice for fans/clubs/buugeng:** honest + open invitation. First person,
   states what is proven prop-agnostically, names the per-prop open territory,
   and explicitly invites the practitioner who speaks that prop's language to
   write the chapter.
3. **Structure:** approach A, a `/notation/[prop]` subtree (rejected: more
   `/learn/*` essays; one long anchored page).

## Routes

| Route | H1 / primary query | Authority mode |
|---|---|---|
| `/notation/staves` | Double Staff Notation | Authoritative (Austen's voice) |
| `/notation/fans` | Fan Spinning Notation | Open chapter |
| `/notation/clubs` | Club Spinning Notation | Open chapter |
| `/notation/buugeng` | Buugeng Notation | Open chapter |
| `/notation/poi` | Poi Notation | Restricted subset |

All under `src/routes/(public)/notation/<slug>/+page.svelte`. Prerendered via
the existing `(public)/+layout.ts` (`prerender = true`); no per-page load
functions needed.

## Shared page skeleton

Every page uses the editorial system that already exists (no new layout
primitives): `public-editorial.css`, `.editorial` / `.editorial-section` /
`.prose` / `.cta-card`, and the shared `Seo.svelte` head primitive
(`src/lib/shared/components/Seo.svelte`) with an Article + BreadcrumbList
JSON-LD block passed through its `children` snippet (three-deep breadcrumb:
Home -> Notation -> <Prop>).

Sections, in order:

1. **Header** — keyword-first H1 + subtitle (matches the SEO sprint pattern of
   `d68aff908e`).
2. **What carries over** — the prop-agnostic core: grid positions, letters,
   timing and direction. Same idea on every page but written fresh per page
   (anti-doorway); always links `/glossary`, `/guide`, and `/notation`.
3. **What's unique to this prop** — grip references, geometry, body mechanics.
   Every domain claim grounded via MCP (`get_domain_topic`,
   `get_term_definition`) at copy-writing time per `mcp-ground-truth.md`.
4. **Animation-example slot** — HTML comment placeholder per page: "same
   sequence rendered with this prop." The viewer already supports all five
   prop types (`prop-classification.ts`: staff/fan/club/buugeng families, poi
   restricted), so a future demo drops in without restructuring. NOT built in
   this round.
5. **Closing section by authority mode** (see below).
6. **CTA card** — open the composer (it renders this prop today), plus guide
   link.

## Authority modes (the closing sections)

### Staves — authoritative

Full voice: the dual-end thumb/pinky reference system, why pictographs show
staves, the technique that preserves grip references (negative space above and
below the shoulder, body turns to pass into the plane behind you). Cross-links
`/learn/staff-spinning-choreography` for the learning path. **Content split to
avoid duplication:** the learn article keeps owning "how to learn staff
choreography"; this page owns "how the notation maps onto the prop"
(orientation system, references, why staves are the canonical prop).

### Fans / clubs / buugeng — open chapters

Three beats, first person:

1. What is proven: positions, letters, timing and direction apply to any
   static prop. The composer renders this prop today.
2. What is open: this prop's grip language and body mechanics. Austen names
   plainly that he trained staves, not this prop, and won't fake authority.
3. The invitation: "this chapter is waiting for its author." The contact
   action is a button-styled `mailto:tkaflowarts@gmail.com` link (the address
   already published on /privacy and /delete-account), with a prefilled
   subject per prop (e.g. "Fans chapter").

Rendered inside the **OpenChapter** component (below) so the unfinishedness
reads as a designed feature of the system, not an apology.

### Poi — restricted subset

Honest answer to "can TKA notate poi": poi is momentum-based, not a static
prop, so it is a restricted subset of what TKA covers. VTG, which TKA is built
on, is the poi-native system; `/roots` carries the lineage. State what subset
applies; present Poi Lab as planned, never as built. Framing constraints from
`tka-domain.md` are binding: never list poi as an equal static prop, never
"fixed grip" (say "gripped directly"), never "any amount of rotation."

## New component: OpenChapter

`src/lib/shared/landing/components/OpenChapter.svelte`

Justification per `never-hand-roll.md`: three consumers (fans, clubs,
buugeng); grep of `src/lib/shared/landing/components/` and
`src/lib/shared/components/` found no callout/invitation primitive (closest are
`.cta-card` in `public-editorial.css`, which is a conversion CTA, and the
guide's card stages, which are pictograph stages). Creating new is justified;
it is the one visually distinct element of this feature: a bordered block with
a deliberately "unfinished manuscript" treatment (e.g. dashed/inked border,
muted header like "Open chapter"), holding a heading, prose slot, and one
button-styled contact link (per `clickables-look-like-buttons.md`). Styling
follows `styling` skill rules (component-scoped, theme vars, 44px targets,
reduced-motion safe).

## Reachability (three surfaces)

1. **`/notation` hub section** — new "Notation by Prop" editorial section on
   `/notation/+page.svelte` with five links styled via existing editorial
   patterns (link list or jump-chip row; no new primitives). Placed after
   "Where to Start."
2. **`SiteFooter` fourth column: Props** — Double Staves, Fans, Clubs,
   Buugeng, Poi. Footer is the sitemap; the Learn column at 9 items would
   bloat. Desktop grid `1.6fr repeat(3, 1fr)` becomes `1.6fr repeat(4, 1fr)`
   at >=1024px; at the >=560px breakpoint the four nav columns render as a
   2x2 grid (brand still spans its own row); mobile single-column stacking
   unchanged. Verify no layout shift
   and no horizontal overflow at 360px and 4K per `no-layout-shift.md`.
3. **Header: no change.** Notation is already a top-level item; the hub routes
   onward. Keeps the Learn/Shop dropdowns lean.

## Plumbing

- **Chrome:** in `src/routes/+layout.svelte`, remove `/notation` from
  `MARKETING_EXACT` and add it to `MARKETING_SUBTREES` (same mechanism as
  `/shop`). All five pages then get SiteHeader + SiteFooter by construction.
- **Sitemap:** add five entries to the hand-curated `pages` array in
  `src/routes/sitemap.xml/+server.ts` under the pillar-pages block, priority
  0.7, changefreq monthly.
- **Seo primitive:** each page uses `Seo.svelte` (title, description,
  canonical `https://tkaflowarts.com/notation/<slug>`, ogType "article") with
  JSON-LD via the children snippet.

## Copy rules (binding at implementation)

- Writing style per `CLAUDE.md` and `docs/reference/ai-writing-guide.md`: the
  fire jam test, no superlatives, no "Whether you're...", no em dashes
  anywhere user-visible (grep the diff for U+2014 before handover).
- All TKA domain claims grounded by MCP calls in the writing turn
  (`mcp-ground-truth.md`); prop-facing claims verified against
  `tka-domain.md` framing rules.
- First person only where it is Austen's actual voice and actual history; no
  invented biography (`no-fabrication.md`).

## Verification plan

- `npm run check` (capture once, grep for touched files).
- Unit-level: no new logic beyond OpenChapter markup; no new tests required.
  The existing `sequence-viewer-shell-contract` and nav tests must stay green.
- Browser pass (Chrome DevTools MCP, already granted this session): each of
  the five routes at 360px and 1440px, footer Props column at both plus 4K
  emulation, hub section links, zero console errors.
- Sitemap: curl `/sitemap.xml` locally and confirm the five URLs.
- Commit with explicit pathspec; cherry-pick to main and push per
  `feedback_merge_to_main_when_done`.

## Ledger

- [x] OpenChapter.svelte component
- [x] /notation/staves page
- [x] /notation/fans page
- [x] /notation/clubs page
- [x] /notation/buugeng page
- [x] /notation/poi page
- [x] /notation hub "Notation by Prop" section
- [x] SiteFooter Props column (+ responsive grid change; extra 820px
      breakpoint added so 4 columns don't cram between 560 and 1024)
- [x] MARKETING_SUBTREES promotion for /notation (removed the exact entry)
- [x] sitemap.xml entries (verified in served /sitemap.xml)
- [x] Copy pass: grounded in MCP `static-props` + `vtg-deep` topics; em-dash
      grep clean (only code comments); unilateral/bilateral claims from
      prop-classification.ts
- [x] Browser verification: 5 routes SSR with correct titles/canonical/JSON-LD,
      OpenChapter on exactly fans/clubs/buugeng, zero console errors/warnings,
      footer grid 1-col @360 / 2x2 @700 / 5-track @1440, no horizontal
      overflow, screenshots of OpenChapter + hub chips + footer
- [ ] Commit (pathspec), cherry-pick to main, push

## Interview rewrite (2026-07-16, same day)

Austen rejected the first copy pass ("canonical prop" framing read as
staff superiority). All five pages were rewritten from a live interview.
The theses now on the pages, in his words:

- Two prop families: dual-ended (staves base; buugeng, eight rings, double
  contact ball) and single-ended (clubs base, core of VTG; fans, triads).
- Translation rule: hold an imaginary staff with one end cut off; a
  single-ended prop's orientation = the staff's thumb orientation.
- The collapse: isolation+extension are one staff motion, two distinct club
  moves; vanti/hanti likewise (VTG V1 p.4 shapes, MCP-verified).
- Staves teach fastest because 8 orientations read as 4: less information,
  not superiority. Single-ended props display more and explore a wider
  complexity range.
- The no-fingerspin/no-regrip rule is staff pedagogy, a scaffold that stops
  mattering once you can read turn values. Finger spinning is established
  and welcomed on buugeng.
- Fans: folds (planar props crossing through 3D, hand orientation flips
  front/back) are fundamental to fans and not yet notatable; hand
  orientation matrix is a named missing piece.
- Poi: patterns are poi-capable only when rotational value stays relatively
  consistent; TKA is a generator poi can draw from, not an ideal poi
  description system.

A parallel session had shipped its own per-prop pages to main (SEO A+ plan);
the branch merge kept THIS implementation. Main gets the interview rewrite
after Austen reviews the branch copy — do not merge the copy to main before
his sign-off.

## Out of scope (named, not silent)

- Per-prop animation demos (slot reserved; needs a demo-sequence-per-prop
  component decision first).
- Hoops/triquetra/sword pages.
- Any contributor-program tooling; the invitation points at existing contact
  paths only.
