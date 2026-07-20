# /notation/caps Redesign — Design Spec

Date: 2026-07-20
Status: Draft for review
Route: `src/routes/(public)/notation/caps/+page.svelte`
Prototype (verified, throwaway): `src/routes/test/caps-hero/+page.svelte`

## Problem

The live `/notation/caps` is a long vertical scroll of editorial sections that
opens by name-dropping flow artists a zero-context visitor has never heard of,
and its six video embeds are refused by the site CSP so they render as broken
frames. It does not answer "what is a CAP, and why is that exciting" in the
first screen. It reads as a document, not a single cohesive "wow" experience,
and nothing about the first viewport says "designed for a 4K monitor."

Austen's framing: a first-time visitor should hit one screen that makes CAPs
feel alive and legible, in the home-launchpad Bento language he already reads
easily, with the people and history living deeper rather than gating the top.

## Decisions already locked (this session)

1. **Bento hub plus depth below.** Viewport one is a single-screen Bento hub (no
   scroll to understand it). The existing editorial sections become the depth
   below the fold. Hub tiles anchor down to those sections.
2. **Sides-only frame.** The live CAP demo is a centered square; six compact
   destination tiles frame it, three down the left, three down the right. The
   earlier "wrap" variant is dropped.
3. **Reframe off individuals on the surface.** The hub credits only the
   originator (Damien, Home of Poi, 2009). The full cast stays in the deeper
   "Credit where it started" section, not the hero.
4. **Keep the live canvas, not a baked video.** iOS Safari cannot render a
   transparent video, so the live `YutaCapLiveDemo` stays.
5. **No em dashes anywhere** in shipped copy (site-wide rule).

## The hub (viewport one) — verified prototype

Built and measured in `src/routes/test/caps-hero/+page.svelte` at 1920, 2350,
and 3840 wide. Reference implementation, to be lifted into the real page.

### Composition

- A 2:1 band sized off available height via a size container
  (`inline-size: min(100cqw, 200cqh)`), centered. Because the band is 2:1 and
  the demo spans the center two of four columns across all three rows, the demo
  cell is inherently square.
- The demo is bound on both axes (`min(100cqw, 100cqh)`) so it can never
  top-align in a too-tall wrapper. This was the 721x869 defect in the first
  pass; it now measures square (788, 995, 1035 at the three widths).
- Six tiles are the real launchpad `LaunchpadTile` (glass, tilt, cursor-glow,
  press-spring). They are compact, vertically centered in their row, so the
  bottom-anchored heading sits by its icon instead of under dead headroom.
- Height reserves the production 64px `SiteHeader`
  (`calc(100dvh - var(--caps-chrome))`) so "no scroll" holds for the hub on the
  real route, not just the bare test page. The hub is exactly the first viewport;
  the depth sections and the `MarketingChrome` footer scroll below it. The footer
  is not suppressed, it is simply the last scroll stop after the depth.
- Fluid type ramps (no fixed clamp ceiling that stalls at 4K). The banned
  `min-width: 2200px` big-screen tier is removed in favor of container sizing
  (`4k-native-layout.md`).

### Copy (grounded at `packages/caps-domain/src/data/glossary.ts`)

Eyebrow: "Continuous Assembly Patterns". Title: "CAPs". Subtitle: "A
prop-spinning path assembled from pieces of simpler patterns, looped forever."
Demo caption: "The bright path is traced by one prop."

DOM order equals reading order (row by row across the demo):

| Row | Left tile | Right tile |
|---|---|---|
| 1 | What is a CAP? — "One prop traces a closed loop built from two or more simpler patterns." | How this CAP is built — "Four steps, two halves." |
| 2 | Watch CAPs — "CAPs on video, 2009 to now." | CAPs and LOOPs — "Parallel systems, different base units." |
| 3 | Underlying math — "Trochoids on nested circles." | Where it came from — "Damien coined the term on Home of Poi in 2009." |

Copy notes:

- "Two or more simpler patterns" replaces "two fragments" per the canonical
  definition (a CAP is the serial assembly of two or more elementary patterns,
  each iterated one or more times, drawn by one prop).
- Two labels were GPT-5.6 suggestions adopted over earlier tentative wording:
  "How this CAP is built" (was "Breakdown") and "CAPs and LOOPs" (was
  "relationship to the kinetic alphabet"). "Underlying math" is kept as Austen
  chose it. Open to flip either back.

### Tile destinations

Each tile anchors to its matching editorial section below the fold (same accent
palette already used on both). The "CAPs and LOOPs" tile links across to
`/notation/loops`. Anchors, not dead fragments: the depth sections are the
targets.

## The depth (below the fold) — keep and repair the editorial sections

The existing sections stay as the scroll-down depth. Accent colors already match
the hub tiles. Repairs:

1. **Fix the broken videos.** The six `youtube-nocookie.com` iframes
   (`+page.svelte:404`) are refused: `frame-src` in `src/hooks.server.ts:110`
   does not allow YouTube. Replace the iframe grid with thumbnail-first cards
   using `https://img.youtube.com/vi/{id}/hqdefault.jpg` (allowed by the
   `img-src https:` rule), reusing the id-extract and fallback pattern from
   `src/lib/features/festivals/components/portfolio/VideosSection.svelte`. Click
   opens the video (lightbox or new tab). This needs no CSP change. Video ids
   already present: `DyK42suXQUk`, `B-o3E7Ix5uM`, `UBx2IZVzSVA`, `Lh5wtTddhEE`,
   `dBn6kz_7huc`, `Chf9IAhqp7M`.
2. **Correct the definition.** The "Four steps, two fragments" section title
   (`+page.svelte:146`) inherits the same too-narrow framing. Reword to the
   "two or more elementary patterns" definition; the "four steps, two halves"
   detail is specific to the Yuta CAP and should be labelled as this example,
   not the general rule.
3. **Strip em dashes** from retained material (for example lines 405 and 433 and
   any others in the sections).
4. **Preserve SEO.** Keep both `application/ld+json` blocks
   (`+page.svelte:83, 95`) and the page title/meta. Do not replace the file
   wholesale in a way that drops structured data.
5. **Cast stays deeper.** "Credit where it started" (Damien, Alien Jon, Nick
   Woolsey, Charlie Cushing, Drex) remains a below-the-fold section, unchanged
   in spirit. The hub does not foreground it.

## Cross-cutting work

1. **Reuse `LaunchpadTile` in place.** It lives under
   `src/lib/shared/landing/components/launchpad/`, is already generic
   (`{tile, active, index}`), and is already under `shared/`. The hub imports it
   directly. Moving it out of the `landing/` path is a pure rename with import
   churn and no behavior gain, so promotion is deferred, not done in this work.
   No fork.
2. **Accessibility for the locked demo.** `YutaCapLiveDemo` autoplays forever
   with `interactive: false`. Austen's directive is no play/pause control on the
   exhibit, so the accommodation is a static poster, not a pause button: under
   `prefers-reduced-motion: reduce` the live player is not mounted and the static
   poster plus ghost mandala render instead. (Strict WCAG 2.2.2 favors a
   pause/stop mechanism; the reduced-motion still is the accepted accommodation
   here and honors the no-control directive.)
3. **SSR poster fallback.** The player is client-only. Render the static ghost
   mandala (or a `/caps` still) immediately as the poster and as the failure
   fallback, so there is never an empty square on first paint.
4. **Let the cosmic background show.** The prototype paints an opaque gradient.
   The real page keeps the `MarketingChrome` cosmic `BackgroundHost` visible
   behind the hub; do not cover it.
5. **Semantics.** Demo is a labelled `<figure>` with a `<figcaption>`; tiles are
   a `role="list"`, so the demo is not an unlabelled seventh item in a nav-like
   list (already done in the prototype).
6. **caps-domain: add a Yuta contributor record.** The demo pattern is the
   famous Yuta CAP (glossary already references it). Add Yuta to
   `CAP_CONTRIBUTORS` from the research pass (Japanese poi artist, Poi Lab
   founder, poi since 2003, LED and visual-poi pioneer; keep the mononym, do
   not assert an unconfirmed surname). This is repo knowledge, not surface copy.

## Already shipped this session (not pending)

**Ghost mandala aligned to the visible prop tip.** The ghost was drawn from the
trail emitter tip (`dx=130`), which sits about seven percent inside the club's
visible bulb tip that the eye follows, so the ghost read as inset inside the
very path the prop traces. `YutaCapLiveDemo.svelte` now uses the visible tip
reach (`clubTipDx = 150`). Verified by pixel measurement: ghost stroke core and
club reach both land at ~0.316 of the square (was ~0.295 ghost vs ~0.316 club),
and the trace now reads as one clean glowing curve. This edits the real
component, so it is live on `/notation/caps` already.

## Out of scope

Poi Lab build-out, new video sourcing beyond the six existing ids, any change to
`/notation/loops`, and any CSP change (the thumbnail approach avoids it).

## Resolved decisions (Austen, 2026-07-20)

1. **Tile clicks anchor-scroll** down to the matching deeper sections. Not detail
   panels. The "CAPs and LOOPs" tile links across to `/notation/loops`.
2. **Labels:** keep "Underlying math"; take "CAPs and LOOPs". Not "The geometry",
   not "Relationship to the Kinetic Alphabet".
3. **Footer not suppressed.** The hub is exactly the first viewport; depth
   sections scroll below, footer last.

## Verification protocol (for implementation)

- Hub fits one viewport with no scroll at 1920, 2350, and 3840 wide (per
  `4k-native-layout.md`), demo square at each.
- Videos: thumbnails load (network 200 on `img.youtube.com`), no refused frames
  in console.
- Ghost sits on the trail (already verified).
- `npm run check` clean; grep the diff for `type="checkbox"`, raw `class="chip"`
  filter buttons, and em dashes before claiming done.
