# Landing Hub — Concepts + Fable 5 Brief (2026-07-18)

Homepage reframed from an article/marketing funnel to a **routing hub of juicy clickable links** for flow/circus insiders. Produced by an 8-agent ultracode workflow (juicy-link + spatial-nav + destination-inventory + audience/SEO research, Opus synthesis, 3 built sketches). Supersedes the rejected editorial A/B at `/test/landing-directions`.

## The three concepts

### Orbit (`orbit`)

A dark cosmic system where each headline destination is a slowly orbiting celestial body; drift the cursor near one and it swells, self-labels, and dims its siblings, and a click flies the camera into it before routing.

- **Why it fits the audience:** This is the exact picture Austen pitched, and it reads to a flow/circus insider as a system diagram, not a sales page. Orbiting bodies give idle 'alive' motion for free, so a low-attention visitor sees a living, cinematic thing on arrival with zero copy to read. Celestial-body identity (rings = the deck, a mandala-lit surface = the gallery, a glyph-etched planet = notation) encodes what each place IS rather than labeling it like a menu, which flatters people who already have the vocabulary.
- **Juicy-link treatment:** Each body behaves like a physical object eager to be selected. As the cursor approaches (pointermove distance falloff), the nearest body scales ~10 percent, raises a thin label ring showing its name plus a one-line insider descriptor, and brightens while every other body drops emissive/opacity (3D spotlight-and-dim). The custom cursor morphs from a dot into a reticle with an 'ENTER' label the moment it is over a body. Pointerdown pulses the body inward (elastic press) so the tap is felt before navigation. Click triggers a camera dolly straight toward the body (lerp position + slerp orientation) that resolves into the route, so the link literally pulls you in.
- **SEO/a11y layer:** The WebGL canvas is opaque to crawlers and screen readers, so the real routing lives in a parallel, always-present DOM layer that ships in SSR HTML before any Threlte code runs: a real <nav><ul> of <a href> wrapping an <h2> plus a short insider label for every destination (this is the visible 'ground control' rail on desktop and the primary list on mobile, not a hidden crutch). Because the rail is genuinely visible and focusable, it doubles as the accessibility path and the crawl path. Add JSON-LD WebSite/Organization. Insider vocabulary is front-loaded into the real link text ('Poi Notation', 'Choreo Cards', 'Gallery'), never generic 'Explore'. The 3D bodies are pure enhancement mapped to the same hrefs.
- **Feasibility:** Highest-cost concept, and it must be a NEW lightweight Threlte scene, not a retrofit: the shipping cosmic background is Canvas 2D and structurally cannot host clickable objects. Bodies are Blender-modeled GLB spheres per blender-first-3d-scenes.md (procedural Threlte reserved for the orbit/camera math only). Reuses the proven interactivity() click/hover recipe already wired in OceanScene/VillagePropWall, and existing camera-transition primitives (snapCameraTo / CameraStateSnapshot) for the fly-in rather than hand-rolling one. Hard caps at ~8 primary bodies before orbits collide and the map stops being readable; everything else must go to the rail. Mobile and a11y degrade hardest of the three (moving hit-targets need generous hit-slop; spatial nav is worst-case for screen readers), which is why the DOM rail is mandatory, not polish. Best used as a hero/seasonal takeover; heavier than an everyday routing hub needs to be.
- **Sketch:** /sketches/2026-07-18-hub-orbit.html

### Launchpad (`launchpad`) — RECOMMENDED

An oversized, unequal bento grid where every tile is a REAL living TKA artifact (a playing sequence, a drawn mandala, an actual choreo card) that tilts toward the cursor, breathes at rest, glows under the pointer, and squishes on press.

- **Why it fits the audience:** This is the itch.io move: lead with the artifact, not the pitch. An insider lands and immediately sees the notation working, sequences animating, a real card, a mandala tracing itself, which is more persuasive to someone with the vocabulary than any sentence defining flow arts. Variable tile size signals importance without words (a 2x2 Composer tile reads as 'start here'), big borderless tap targets read as generous and obviously clickable, and the whole grid feels responsive to attention rather than a static wall of equal links. It is a hub (a floor plan), not a funnel.
- **Juicy-link treatment:** Every tile runs the full 2026 bento stack, but built on the SHIPPED @austencloud/backgrounds/card primitives instead of hand-rolled math: attachTiltEffect for cursor-driven rotateX/rotateY depth, attachCursorGlowEffect for the moving radial sheen that tracks the pointer, and createSpring for physically-eased motion. At rest tiles 'breathe' (near-imperceptible staggered scale/shadow pulse). On hover the hovered tile lifts and brightens while siblings desaturate and dim (spotlight-and-dim via grid :has(.tile:hover)). The CTA/Composer tile adds a small magnetic nudge toward the cursor. Pointerdown compresses the tile to scale .96 with a spring return so the click is felt. The 'juice' is that the thing reacting is the actual product moving, not a decorative rectangle.
- **SEO/a11y layer:** Strongest of the three, and nearly free. Every tile is a real <a href> wrapping a real <h2>/<h3> label plus a short insider descriptor that is visually subtle but 100 percent present in SSR HTML before any canvas mounts. The grid itself is a semantic <nav><ul>. Distinct, vocabulary-correct link text per tile ('Staff Notation', 'Gallery', 'Choreo Cards') serves both crawlers and screen-reader link-list navigation. Living components lazy-mount AFTER the link/heading/alt text has shipped, so nothing routing-critical is gated behind JS (survives curl). JSON-LD WebSite/Organization. No shadow-DOM crutch needed because the accessible content and the visible content are the same nodes.
- **Feasibility:** Cheapest premium option and ships this quarter. Zero new 3D scene: reuses SequenceHeroDemo, SequenceMandala, ChoreoCard, PictographRenderer, ONE existing Environment3D scene (Museum tile only, boxed + LazyMount), BackgroundHost as the page backdrop, and the already-shipped @austencloud/backgrounds/card tilt+glow+spring exports (never-hand-roll satisfied). Scales cleanly past TKA's 10+ headline destinations plus the secondary rail, where orbit and map both break. Best mobile story: grid reflows to a single column, tilt disabled under pointer:coarse, breathing retained. Only real discipline points: fixed-aspect boxes on every living tile so async mounts do not cause layout shift (no-layout-shift.md), and cap concurrent autoplaying players so a phone is not decoding six videos at once.
- **Sketch:** /sketches/2026-07-18-hub-launchpad.html

### Marquee (`marquee`)

The navigation IS the content: a stack of oversized kinetic destination names set in the TKA display type that skew and split on hover to reveal the real artifact playing full-bleed behind the letters.

- **Why it fits the audience:** A wordless-to-the-eye but information-dense index that scans in one second. For an insider with low attention there is nothing to wade through, just enormous names of the places they already want, and the reward for reaching toward one is the actual sequence/mandala/card blooming behind the type. It treats the homepage as a table of contents rendered as kinetic sculpture, which fits an audience that already encodes movement as an alphabet. Few, enormous targets means no hunting for what is clickable.
- **Juicy-link treatment:** The type itself is the affordance. At rest the words are giant and high-contrast (obviously the only interactive thing on the page); an approach runs an underline/color wipe. On hover the word skews (skewX + a weight/letter-spacing shift) and the matching real artifact reveals full-bleed behind or masked inside the letterforms: SequenceHeroDemo for Composer, SequenceMandala for Library, a ChoreoCard for Shop, a PictographRenderer glyph for Notation, an Environment3D crop for Museum. A slight magnetic pull drags the hovered word a few px toward the cursor. The custom cursor grows into an 'OPEN' label over a row. Pointerdown compresses the letters (spring). Because the targets are enormous, the reveal feels like pulling back a curtain on the real thing.
- **SEO/a11y layer:** Best-in-class and requires no parallel layer at all, because the giant words ARE the semantic headings and links: a real <nav><ol> of <a href> each wrapping an <h2> whose visible text is the destination name. Insider vocabulary is the literal on-screen H2 text ('Poi Notation', 'Composer', 'Choreo Cards'), which is exactly what practitioners search. Art reveals lazy-mount on hover/focus only, so the full link+heading set ships in SSR HTML and survives curl. Add JSON-LD WebSite/Organization. Distinct link text per row is ideal for screen-reader link-list navigation, and focus states must mirror hover so keyboard users trigger the same reveal.
- **Feasibility:** Cheap and low-risk; no Threlte required except the single hover-gated Museum reveal. Reuses the TKA Letters display font (font:build pipeline), the existing living components in fixed boxes for reveals, and the Crossfade primitive for the reduced-motion path. Scales to many destinations (it is a list). Excellent a11y and the best mobile ergonomics of the three (huge rows = huge tap targets). Main craft risk is keeping the type distortion tasteful rather than cartoonish (anti-pattern: over-deformed squash/stretch), and ensuring one full-bleed reveal at a time so a phone never decodes several players. Distinct enough from Launchpad that it is not a reskin: text-as-nav with one focused reveal vs many simultaneous living tiles.
- **Sketch:** /sketches/2026-07-18-hub-marquee.html

## Recommendation: launchpad

Launchpad is the only concept that is simultaneously the juiciest link surface, the best SEO/a11y story, the cheapest to ship, and the one that scales past TKA's 10-plus destinations. Its juice is the actual product moving (real SequenceHeroDemo, SequenceMandala, ChoreoCard under a shipped tilt+glow+spring primitive from @austencloud/backgrounds/card), which is exactly the 'show the notation working, don't sell it' insider move Austen wants and a stronger hook than any orbit or type effect. Every tile is a real SSR heading+link, so the crawl/accessibility path and the visible path are the same nodes with no shadow-DOM crutch. It needs zero new Threlte scene, reuses existing primitives end to end, and reflows to one column on mobile. Orbit is the prettiest and is literally Austen's pitch, but it is a brand-new 3D scene (the shipping cosmic bg is Canvas 2D and cannot host clickable objects), caps at ~8 bodies, and degrades hardest on mobile and screen readers; it earns its keep as a hero/seasonal takeover or the Composer feature tile's future upgrade, not the everyday routing hub. Marquee is a close, cheap runner-up with a great SEO story but shows one artifact at a time and hides the rest behind type; the bento shows many living artifacts at once.

---

# Fable 5 Build Brief: TKA Homepage Hub — "Launchpad"

## What this is

Replace the current funnel homepage (`src/routes/+page.svelte`, today a `HeroCarousel → HowTkaWorks → PlayWithIt → Guides → ShopCta` SaaS funnel) with a **routing hub**: an oversized, unequal bento grid where every tile is a REAL living TKA artifact that tilts, breathes, glows, and squishes under the cursor. The homepage's entire job is to fling flow/circus insiders into every other place in the app via links so juicy they cannot resist. It is NOT a sales page. Do not add explainer copy, "How TKA Works", or a conversion CTA. Lead with the artifact.

## The feel (the juice)

Every tile runs the 2026 bento interaction stack, built on the **already-shipped** effects primitives, not hand-rolled math:

- **Tilt on hover** — `attachTiltEffect` from `@austencloud/backgrounds/card` (cursor-driven rotateX/rotateY depth).
- **Cursor glow** — `attachCursorGlowEffect` from the same entry (radial sheen tracking the pointer).
- **Spring physics** — `createSpring` from the same entry for the press/return easing. Do not import a new spring lib; this one ships in the package (`node_modules/@austencloud/backgrounds/dist/card.d.ts` exports `attachTiltEffect`, `attachCursorGlowEffect`, `createSpring`, plus the `<background-card>` custom element).
- **Idle breathing** — a near-imperceptible staggered scale/shadow pulse at rest so tiles feel alive before any hover.
- **Spotlight-and-dim** — hovered tile lifts and brightens while siblings desaturate/dim (`grid:has(.tile:hover) .tile`).
- **Elastic press** — pointerdown compresses to ~scale(.96) with a spring return so the click registers as felt before navigation.
- **Magnetic nudge** — only on the Composer feature tile, a small pull toward the cursor.

Keep all transitions under ~300ms. The point: the thing reacting is the real product moving, not a decorative rectangle.

## Layout

Responsive CSS bento grid, `repeat(4, 1fr)` on desktop, tiles spanning variable rows/cols so **size encodes priority**.

| Tile                | Span | Route                                                            | Living asset to mount                                                                   |
| ------------------- | ---- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Composer            | 2x2  | `/composer` → `/create`                                          | `SequenceHeroDemo.svelte` (autoplaying sequence, `chrome="minimal"`, `fill`)            |
| Library / Gallery   | 2x2  | `/browse/library`, `/browse/gallery`, `/browse/collections`      | `SequenceMandala.svelte` as living background                                           |
| Museum              | 2x1  | `/museum`                                                        | one existing `Environment3D` scene crop or `FramedSequence.svelte`, boxed + `LazyMount` |
| Shop / Choreo Cards | 2x1  | `/shop`, `/shop/choreography-cards`, `/shop/loop-deck`           | `ChoreoCard.svelte` (a real sequence)                                                   |
| Notation            | 1x1  | `/notation` (+ `/staves`, `/clubs`, `/fans`, `/buugeng`, `/poi`) | `PictographRenderer.svelte` single-letter glyph                                         |
| Guide               | 1x1  | `/guide` (+ `/guide/level-1`, `/level-2`, `/codex`)              | glyph or mandala thumb                                                                  |
| Play                | 1x1  | `/learn/play`                                                    | thumb                                                                                   |
| Practice            | 1x1  | `/train`                                                         | thumb                                                                                   |
| Glossary            | 1x1  | `/glossary`                                                      | `PictographRenderer` glyph                                                              |
| About               | 1x1  | `/about` (+ `/about/compare`)                                    | thumb                                                                                   |

Secondary text-first strip below (smaller tiles, no heavy media): FAQ `/faq`, Roots `/roots/software`, Compose `/compose`, Choreo `/choreo`, Watch `/watch`, Arena `/arena`, Social `/social`, Festivals `/festivals`, Levels `/levels`, Hand Paths `/hand-paths`, Video `/video`, Stage `/stage`, Tika `/tika`, Retro `/retro`.

Page background: a `BackgroundHost.svelte` canvas (cosmic) behind the glassy tiles — same package already used site-wide via `MarketingChrome`. Do not hand-roll a starfield.

## Components to wire (verified paths — reuse, do not rebuild)

- `src/lib/shared/landing/components/SequenceHeroDemo.svelte` — live player tile (wraps `InlineAnimationPlayer` via `LazyMount`). Feed a real `SequenceData` + `note`.
- `src/lib/shared/mandala/components/SequenceMandala.svelte` — mandala glyph background.
- `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte` — real animated card (per-cell pictographs, QR, difficulty, LOOP glyph).
- `src/lib/shared/pictograph/shared/components/PictographRenderer.svelte` — single-letter SVG glyph.
- `src/lib/shared/3d/environments/components/Environment3D.svelte` — Museum tile only; one scene, fixed-aspect box, `LazyMount`. This is the ONLY 3D on the page.
- `src/lib/shared/background/shared/components/BackgroundHost.svelte` — page backdrop.
- `@austencloud/backgrounds/card` — `attachTiltEffect`, `attachCursorGlowEffect`, `createSpring` for the hover/press juice.

Pull sequence data for the living tiles from real library/gallery content, not fixtures. Any word rendered as a tile label must go through `simplifyRepeatedWord` (`src/lib/shared/foundation/utils/word-simplifier.ts`).

## SEO / accessibility text layer (non-negotiable, and nearly free here)

The reconciliation is structural, not prose: SSR emits the real routing before any canvas mounts.

- The grid is a semantic `<nav aria-label="…"><ul>`; every tile is a real `<a href>` wrapping a real `<h2>`/`<h3>` label plus a short insider descriptor.
- Link text is **vocabulary-correct and distinct** per tile: "Staff Notation", "Gallery", "Choreo Cards", "Composer" — never a repeated generic "Explore". This serves crawlers and screen-reader link-list navigation equally.
- Living components (`SequenceHeroDemo`, `SequenceMandala`, `ChoreoCard`, `Environment3D`) **lazy-mount AFTER first paint**. The `<a>` + heading + alt text ship in the initial HTML and must survive `curl`. Nothing routing-critical is gated behind JS or behind `:hover`.
- Add JSON-LD `WebSite`/`Organization` (infra already exists in other routes; grep the sitemap/route heads).
- No shadow-DOM mirror is needed: the accessible content and the visible content are the same nodes. That is the whole reason this concept beat Orbit for the everyday hub.

## Constraints

- **Mobile:** grid reflows to a single column; disable tilt under `@media (pointer:coarse)`; keep breathing + press. Cap concurrent autoplaying players (one, maybe two) so a phone is not decoding six videos.
- **No layout shift:** every living-media tile gets a fixed `aspect-ratio`/sized box so async mounts do not reflow neighbors (`no-layout-shift.md`).
- **Reduced motion:** freeze breathing and tilt to static; hold animation players on their poster/first frame; keep only opacity focus/hover states. `BackgroundHost` already owns reduced-motion + pause-on-hidden-tab for the backdrop.
- **Theme-aware:** style light and dark. Dark = cosmic gradient with tinted tile glow; light = pale slate tiles keeping a tinted glow. Use `prefers-color-scheme` plus `:root[data-theme]` overrides so the viewer's toggle wins both directions. Consume `--theme-*`/`--semantic-*` tokens; do not redeclare them.
- **Never hand-roll:** tilt/glow/spring come from `@austencloud/backgrounds/card`; the backdrop from `BackgroundHost`; every tile's content from the existing components above. If a tile needs a capability a primitive lacks, extend the primitive, do not fork it. Grep before creating anything new.
- **Design system:** 44px minimum touch targets; every tile is an obviously-clickable button/card, not a bare text link (`clickables-look-like-buttons.md`). No checkboxes anywhere.

## Optional future upgrade (do not build now)

The Composer 2x2 feature tile is the natural home for a later mini-"Orbit" moment (a small Blender-GLB planet system as its living background) if a hero flourish is wanted. That is a separate new-Threlte-scene effort per `blender-first-3d-scenes.md`; ship the bento first.

## Definition of done

`curl` of `/` returns every destination as a real `<a href>` with distinct heading text before any JS runs; the grid renders and routes with keyboard + screen reader; tiles tilt/glow/breathe/press on desktop and reflow to a taptable column on mobile; reduced-motion and both themes verified; no layout shift on living-tile mount; `npm run check` clean. Provide screenshot or runtime evidence, not a claim.
