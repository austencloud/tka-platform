# Interactive FAQ — Design

**Date:** 2026-07-16
**Status:** Approved (brainstormed in-conversation with Austen; decisions: full interactivity incl. tap-to-read test, first-person objection voice)

**Layout addendum (2026-07-16, same day):** Austen rejected the accordion
("bubbles feel overdone / tack-on"). Three candidates were built live at
`/test/faq-layouts`; he chose **B — interview spread, editorial grid**
(`FaqInterview.svelte`), with the mandate that every tier feel individually
designed (iPhone SE → 4K), empty space minimized, and buttons placed naturally
per layout. Resolution: desktop grid puts each CTA under its question (the door
answers the question and fills the short left column); stacked tiers re-order
so the CTA closes the exchange, full-width on phones. `FaqAccordion.svelte` is
deleted; /about embeds `FaqInterview mode="stack" dense`.

## Problem

The landing FAQ reads as auto-generated SEO filler. Root cause is structural: `faq-items.ts`
exists to feed `faqPageJsonLd()`, so every answer is shaped like a schema `acceptedAnswer.text`
capped at one breath. It is also the only landing section that is pure text in gray boxes,
while every neighbor (How TKA Works, Play With It, Guides) demonstrates with real rendered
product.

## Design rule

Every FAQ item follows **claim → proof → door**:

- **claim** — prose that answers a real visitor's actual hesitation, first-person objection voice
- **proof** — where the answer makes a claim, a real rendered artifact proves it (not asserted)
- **door** — a button-styled CTA routing to the next step

## Question set (7)

| # | Question | Proof | Door |
|---|---|---|---|
| 1 | What is The Kinetic Alphabet? | live pictograph beside prose | `#how-it-works` anchor |
| 2 | Do I have to memorize letters and symbols first? | **tap-to-read test** (see below) | `/guide/level-1` |
| 3 | I learn moves from videos. Why would I need notation? | — (prose carries it) | `/composer` |
| 4 | I've never spun a prop. Where do I start? | — (double staves rationale per tka-domain rules) | `/guide/level-1` |
| 5 | Does it work with my prop? | — | `#play-with-it` anchor (spinner has prop switching) |
| 6 | Is Flow Arts Composer free? | — | `/composer` |
| 7 | Can I share what I make? | — | `/composer` |

## The tap-to-read test (flagship)

Inside item 2: render a real pictograph the visitor has never seen, ask
"Where does the blue hand end up?", offer three location buttons. Correct answer is **computed
from the pictograph's own data** (`motions.blue.endLocation`), never hardcoded — zero
domain-hallucination surface. Distractors: the blue hand's start location (the classic wrong
answer) plus one other cardinal. Deterministic pick: first CSV variation whose blue motion
travels cardinal→cardinal.

- Correct → "Correct. You just read a TKA pictograph with zero training."
- Incorrect → "Not quite. The blue hand ends at {X}. That is the whole trick: follow the arrow."

The visitor experiences competence instead of being promised it.

## Reuse (never-hand-roll gate)

- **Reusing** `PictographContainer` (`src/lib/shared/pictograph/shared/components/`) — the shared
  smart renderer; same primitive + flags `HowTkaWorksSection` already uses on this page.
- **Reusing** `letterQueryHandler.getAllPictographVariations(GridMode.DIAMOND)` — the CSV-backed
  data path proven by `src/routes/admin/tutorials/_data/pictograph-resolver.ts` (route-private,
  so the landing FAQ gets its own thin loader on the same handler rather than importing across
  route privates).
- **Borrowing state styles** from `QuizPictographButton` (correct/incorrect semantics). NOT
  reusing `QuizFeedbackBanner` — it is `position: fixed` viewport-overlay, wrong for inline
  accordion content; feedback renders inline with reserved space instead.
- **Not migrating** `GuidePictograph` — route-private guide wrapper; landing keeps its
  established direct-`PictographContainer` pattern.
- **Creating** `FaqPictographDemo.svelte` + `FaqReadTest.svelte` — nothing in `src/lib/shared/`
  combines "pictograph + inline tap-answer" outside the Learn context (grep: Quiz*, landing
  components, FilterChip*).

## Files

- `src/lib/shared/landing/faq/faq-items.ts` — `FaqItem` gains optional `demo` + `cta`; all
  answers rewritten. `faqPageJsonLd()` unchanged (serializes question + answer prose only, so
  visible prose and schema stay matched; demos/CTAs are extra visible content, which Google's
  policy allows).
- `src/lib/shared/landing/faq/faq-pictographs.ts` — NEW: cached CSV loader, intro pictograph
  pick, read-test question builder (data-derived correct answer).
- `src/lib/shared/landing/components/FaqPictographDemo.svelte` — NEW.
- `src/lib/shared/landing/components/FaqReadTest.svelte` — NEW.
- `src/lib/shared/landing/components/FaqAccordion.svelte` — demo slot (lazy `import()` on first
  open, so the landing bundle keeps zero static pictograph deps — HowTkaWorks is already lazy
  via `LazyHowTkaWorksSection` and this must not regress that), CTA button per item.
- `src/routes/landing/components/HowTkaWorksSection.svelte` — add `id="how-it-works"` anchor.
- `tests/unit/landing-faq-content.test.ts` — NEW: content contract (non-empty prose, valid demo
  keys, CTA hrefs limited to known routes/anchors, JSON-LD parses and matches items).

## Constraints honored

- **No layout shift:** demo frames are fixed-size squares reserved before async prepare; the
  feedback line reserves its height; buttons are equal-width, ≥44px.
- **Buttons look like buttons:** CTAs are `<a>` styled as buttons, not text links.
- **`/about` (card variant):** gets the same items, demos included (they lazy-load on open).
- **Section slot discipline:** FAQ does NOT get a spinner or animation — Play With It owns
  "watch it move"; FAQ proofs are static renders plus the one tap interaction.

## Addendum 3 (2026-07-17): dedicated page, demos removed

Austen's review of the shipped interview layout redirected the design:

- **The FAQ is now its own page, `/faq`**, linked from the header's Learn menu and the
  footer's Learn column, instead of a landing-page section ("slapped on the landing page").
  The landing route no longer renders any FAQ; `/about` dropped its embedded copy and points
  to `/faq` from the CTA card. FAQPage JSON-LD is emitted only on `/faq`, matching its
  visible content. New public routes need BOTH registries: `MARKETING_EXACT` in
  `src/routes/+layout.svelte` (chrome) and `PUBLIC_PATH_PREFIXES` in `src/config/domains.ts`
  (landing-lite boot; missing it boots the full app shell with the "Connecting to cloud"
  splash over the page).
- **Pictograph demos and the read-test quiz are REMOVED** (`FaqPictographDemo`,
  `FaqReadTest`, `faq-pictographs.ts` deleted). Rejected on copy grounds: "dot to its
  arrowhead" isn't how anyone talks, "north in spinner terms" isn't what spinners say,
  and the canonical unit is a **step, never a beat** (answers corrected accordingly).
- **Layout is a single centered reading column** (`FaqInterview`, 42rem measure): question in
  the site serif, answer, then a door button in the reading flow. The two-column interview
  grid died because a short question next to a tall answer leaves unexplained voids, and
  full-width CTAs stranded whitespace to their right.
- **One door per destination across the whole list** (contract-tested), so the page doesn't
  read as a wall of repeated buttons. Doors: `/#how-it-works`, `/learn/guide`,
  `/#play-with-it`, `/composer`.
