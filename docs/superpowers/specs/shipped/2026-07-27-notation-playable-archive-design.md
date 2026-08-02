# /notation as a Playable Archive

**Date:** 2026-07-27  
**Status:** Ready for a Fable prototype  
**Supersedes:** the interaction and layout direction in
`2026-07-26-notation-catalog-design.md`  
**Preserves:** the catalog entries, sourcing rules, chronology, creator
attribution, and outbound links in
`src/lib/shared/notation/notation-catalog.ts`

## The brief

The current page is a document. The replacement is a toy.

Nine systems sit on a one-screen time rail as tangible artifacts. The visitor
can drag, swipe, click, tap, or use arrow keys to move through them. One artifact
is alive in the center. Neighbors remain visible as tempting objects. Selecting
one changes the stage, the timeline, and the interface response at the same
time. Opening it morphs that object into a focused detail view. The sourced
prose only appears after the visitor asks for it.

Austen's correction on 2026-07-27 is the design authority:

> Fundamentally what we've created is a thing that I have to scroll down to
> see. It does not feel modern. It feels like something that could have been
> created in 2005.

> There's all these words on the page. I want to be able to click on stuff and
> get dopamine and feel like I'm playing a video game every time I interact
> with anything related to the Kinetic Alphabet.

The old rule that every entry must have the same visual shape is retired. It
produced exactly the monotony Austen rejected. Source neutrality still matters:
distinct presentation must never invent a relationship, judgment, or technical
claim about another person's system.

## The emotional target

The first frame should prompt a hand movement.

Within five seconds, a visitor should see:

- one large moving artifact;
- pieces of the previous and next artifacts;
- a complete 2009 to 2022 rail with nine reachable stops;
- an obvious invitation to touch, drag, or click;
- less than one short paragraph of visible copy.

Within thirty seconds, a visitor should be able to:

- traverse all nine artifacts without scrolling the page;
- open two entries and return without losing their place;
- play or manipulate at least one live artifact;
- follow a creator's source;
- see which entries they have already discovered.

The page should feel closer to picking objects up in a game inventory than
reading a museum placard.

## Product thesis

### One room, not nine sections

After the fixed public header, the experience owns the remaining viewport:

```text
height: calc(100dvh - public header)
body scroll: none
```

The main stage never asks the visitor to scroll down for the next entry.
Chronology is horizontal and spatial. Long content lives in a detail surface
opened by choice.

### Reading is a reward

The catalog's factual fields remain unchanged, but their presentation changes:

| Field           | Resting stage                       | Focused detail              |
| --------------- | ----------------------------------- | --------------------------- |
| Year            | Visible                             | Visible                     |
| System          | Visible                             | Visible                     |
| People          | One compact line when space permits | Full                        |
| What it records | Hidden                              | Full                        |
| Subworks        | Hidden                              | Full                        |
| Sources         | One clear action                    | Full button group           |
| Videos          | Poster or thumbnail clue            | Full horizontal media strip |

The main stage is not a summary card. It is an object with a label.

### Feedback is causal

Every deliberate selection produces three synchronized responses:

1. **At the finger or pointer:** press spring, light bloom, and optional haptic.
2. **At the artifact:** the chosen object moves into focus and becomes live.
3. **Across the room:** the rail advances and the visited path stays lit.

The local response begins in the same frame as the input. The larger settle can
take 280 to 500 ms, but it must be interruptible. No interaction waits for an
entrance animation to finish.

### Discovery, not fake achievement

Visited nodes remain illuminated for the session. The count reads `3 of 9
discovered`, not XP, mastery, or completion percentage. Visiting all nine joins
the full rail with one brief light pass and one success haptic.

There are no coins, streaks, badges, confetti cannons, or account-level
progress. The reward is that the archive responds and reveals itself.

## Chosen concept: the Artifact Rail

Three concepts were considered:

1. **Free-roam 3D museum.** Visually tempting, but navigation becomes the task.
   Nine entries do not justify a virtual building, WebGL cost, camera controls,
   or the accessibility burden.
2. **Interactive bento wall.** Better than the current document, but still
   reads as a dashboard of cards. It has no strong temporal motion and gives
   every entry the same rectangular grammar again.
3. **Focus-and-context time rail.** Chosen. It keeps chronology legible, makes
   every entry directly reachable, fills a 4K screen, and turns selection into
   the primary behavior.

### Desktop and 4K composition

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  WRITING FLOW ARTS DOWN        [Two borrowed ideas]        4 / 9         │
│                                                                          │
│      previous artifact      ACTIVE ARTIFACT       next artifact          │
│          dimmed            live, tactile, large      dimmed              │
│                             2010 · VTG                                   │
│                          [Open artifact]                                 │
│                                                                          │
│  2009  ●━━●━━●━━◉━━○━━○━━○━━○━━○  2022       [←] [→]                  │
└──────────────────────────────────────────────────────────────────────────┘
```

- At 3840px, five artifacts can remain in the composition: the active object,
  its two nearest neighbors, and faint outer context.
- At 2560px and 1920px, show the active object plus meaningful previous and
  next previews.
- At 1440px, preserve a clear center object and partial neighbor peeks.
- The active artifact occupies enough height to feel like a stage, not a card.
- The rail and controls stay within the same `--shell-w` band as the public
  header.

### Phone composition

```text
┌─────────────────────────────┐
│ Writing flow arts down  1/9 │
│ 2009 ━━━━━━━━━━━━━ 2022     │
│                             │
│   ╭─────────────────────╮   │
│   │                     │   │
│   │   ACTIVE ARTIFACT   │   │
│   │     live visual     │   │
│   │                     │   │
│   ╰─────────────────────╯   │
│ Continuous Assembly...     │
│ [Inspect]       [Source ↗]  │
│     ‹ swipe or tap ›         │
└─────────────────────────────┘
```

- The main view still fits in one viewport at 375×667.
- One artifact is fully visible. A 12 to 20px neighbor peek makes swiping
  discoverable.
- Horizontal swipe is primary. Previous, next, and all nine timeline stops are
  equivalent single-pointer alternatives.
- The visual timeline keeps the full 2009 to 2022 span in view. Its nine
  controls sit in a locally scrollable stop strip with 44×44px targets. Keep
  the active stop centered; do not shrink or overlap hit areas to force all
  nine controls into one row.
- Details open in the existing bottom `Drawer` primitive. The main stage stays
  mounted behind it.
- The detail drawer may scroll because reading was explicitly requested. The
  page itself does not.

### 960×412 composition

Short landscape gets its own arrangement:

- visual stage on the left;
- year, system, and actions on the right;
- compact rail along the bottom;
- no large title block;
- no vertical stack taller than the viewport.

This viewport must be designed directly. It is not the portrait phone with a
media query that merely shrinks gaps.

## Interaction map

| Input                            | Behavior                                              |
| -------------------------------- | ----------------------------------------------------- |
| Click or tap an artifact         | Select it; selecting the active artifact opens detail |
| Drag or horizontal swipe         | Scrub the artifact rail with snap-to-center           |
| Click a timeline stop            | Select that entry directly                            |
| Left / right arrow               | Previous or next entry                                |
| Home / End                       | First or last entry                                   |
| Enter / Space on active artifact | Open detail                                           |
| Escape                           | Close detail and return focus to the source artifact  |
| Previous / next buttons          | Always present as 44px minimum targets                |

Hover can preview glow, tilt, and a one-line label. Hover never contains the
only route to content.

### Selection choreography

1. The pressed artifact compresses with `pressSpring`.
2. `getHapticFeedback().trigger("selection")` fires when supported and enabled.
3. The selected artifact glides to the center on the Embla rail.
4. The prior live preview settles to its poster. The selected poster wakes into
   its live state.
5. Year, title, creator, count, and rail marker update in reserved boxes with no
   layout shift.
6. A first visit sends one short light pulse from the selected node into the
   visited rail.

### Detail choreography

The active artifact is the origin of the detail surface. It must not dissolve
into an unrelated modal.

- Use Motion's installed `animateView` shared-element transition where browser
  support exists.
- Morph the active visual and title into the focused detail composition.
- Dim the room, but leave enough context to understand where the object came
  from.
- Use the existing `Drawer` primitive on mobile.
- In reduced motion, open the final surface immediately with an opacity change.
- Return focus to the artifact that opened the detail.

The focused desktop detail is a single viewport:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ [Close]                                              2009 · 1 of 9   │
│                                                                      │
│   LIVE OR SOURCE ARTIFACT        Continuous Assembly Patterns        │
│   keeps moving                   Damien ...                          │
│                                  What it records, on demand           │
│                                  [Read the source ↗]                 │
│                                                                      │
│   optional media strip or subworks, only when that entry owns them   │
└──────────────────────────────────────────────────────────────────────┘
```

## Artifact direction

Every entry needs a distinct silhouette and active behavior. Difference is
earned by source material, not arbitrary icon swaps.

| Entry                        | Resting object                                            | Active behavior                                                             | Reuse or source                                                                                          |
| ---------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Continuous Assembly Patterns | A closed two-color path on a dark field                   | The two halves draw and join, then can be replayed                          | Reuse `CapsAssembly.svelte` and `YutaCapLiveDemo.svelte`                                                 |
| The trochoid model           | A source plot or curve sheet presented like drafting film | Curves fan or trace from the verified model                                 | Use `static/caps/original/model.jpg` and the existing CAP curve assets only after attribution is checked |
| Unit Circle Theory           | An orbital measuring object, not a paragraph              | One measured radius responds to pointer position                            | Build only from the sourced 2009 definition; do not imply a relationship to QFT                          |
| Vulcan Tech Gospel           | A compact field of real VTG glyphs                        | The focused glyph field shifts between existing categories                  | Reuse `static/images/vtg_glyphs/` or the existing VTG visualizer; no invented 2×2 reduction              |
| 9-Square Theory              | A stack of Charlie Cushing video frames                   | The stack fans and the selected poster becomes the media strip              | Reuse `SourceVideoCard.svelte` and the verified video IDs                                                |
| QFT Notation                 | The numbered field with a traced prop path                | The cursor advances around the field; direct manipulation lights positions  | Promote and reuse `QftStage.svelte` plus the shared QFT model                                            |
| Lorq Nichols' catalogs       | The 144-cell matrix as a luminous physical sheet          | Pointer movement sends a restrained highlight wave through the cells        | Reuse `NotationShapeMatrix.svelte` or `static/notation/lorq-144-shape-matrix.webp`                       |
| PoiNotation                  | A code cartridge containing exact repository syntax       | A cursor steps through a verified example and reveals the repository action | Pull the example from Tiffany Fong's repository during implementation; no invented syntax                |
| The Kinetic Alphabet         | A pictograph/mandala object with a visible word strip     | The sequence plays and the active pictograph advances                       | Reuse `SequenceHeroDemo.svelte`, `StepStrip.svelte`, and the existing demo sequence fixture              |

Only the active artifact gets an expensive live renderer. Neighbor artifacts
use reserved static posters. Adjacent assets can prefetch during idle time.

### Canon guardrail

The rail means chronology only.

Do not:

- draw arrows from one system to another;
- morph one notation system's marks into another's;
- label any entry as a predecessor, successor, influence, or failed version;
- use a TKA pictograph as another system's icon;
- add explanatory facts not already present in the sourced catalog.

## Visual language

### Tactile, not ornamental

The artifact itself carries the visual interest. Use material, depth, light,
motion, and scale to make it feel touchable.

- Reuse the cosmic background, but give the active object a readable stage.
- Let source artifacts retain their own visual texture.
- Give each artifact an accent and light behavior.
- Keep labels quiet enough that the object wins.
- Make the active target unmistakably clickable before hover.
- Use partial clipping and depth for neighbors, not a row of equal cards.

### Game feel without game UI cosplay

Use:

- spring settle;
- cursor glow;
- slight perspective tilt;
- press compression;
- magnetic pull on primary actions;
- haptic selection;
- visited light;
- a single completion flourish.

Avoid:

- neon HUD brackets around every label;
- fake stats;
- health bars;
- random particle noise;
- perpetual bouncing controls;
- autoplay that moves the visitor to another entry;
- motion that takes longer than the thought it communicates.

### Copy

Keep the existing title: **Writing flow arts down**.

The long paragraph about siteswap and music notation becomes a button labelled
**Two borrowed ideas**. It opens a `bits-ui` popover containing the existing
sourced copy. It does not occupy the first frame.

Main-stage actions:

- **Inspect**
- **Read the source**
- **Watch the series** when the entry owns video

Focused detail uses the exact catalog copy. No marketing conclusion or TKA
funnel is added.

## Responsive rules

| Viewport  | Required composition                                                                |
| --------- | ----------------------------------------------------------------------------------- |
| 3840×2160 | Five-object focus-and-context rail; native-size active artifact; no dead lower half |
| 2560×1440 | Three strong objects plus outer hints; detail fits without inner scroll             |
| 1920×1080 | Active object plus previous and next; title and rail remain in frame                |
| 1440×900  | Center object dominates; neighbor peeks remain clickable                            |
| 820×1180  | Touch-first horizontal rail; larger central object; no body scroll                  |
| 960×412   | Left visual, right metadata/actions, rail below                                     |
| 375×667   | One object, neighbor peek, scrolling 44px stop strip, detail in bottom drawer       |

Use container-relative sizing and the existing root font ramp. The public shell
continues to use `--shell-w`.

## Accessibility contract

- All nine entries remain in an ordered list in chronological DOM order.
- The rail uses real buttons with the system name and year in the accessible
  name.
- Use roving `tabindex` for artifact navigation.
- Inactive heavy slides are `inert`; their timeline buttons remain reachable.
- Announce selection as `2011, QFT Notation, 6 of 9`.
- The active artifact has a visible focus treatment matching its silhouette.
- Dragging is optional. Buttons and timeline stops provide single-pointer
  alternatives.
- Every target meets TKA's 44px floor.
- No information exists only as color, motion, hover, haptic, or video.
- `prefers-reduced-motion: reduce` removes tilt, magnetic movement, ambient
  motion, shared-element travel, and rail pulses. Opacity and instant state
  changes remain.
- Autoplay audio is forbidden. No interaction-sound system is introduced by
  this work.
- Video remains poster-led and opens externally because the site's CSP blocks
  YouTube frames.

## Performance contract

- Mount at most one heavy live artifact renderer.
- Use `LazyMount.svelte` with geometry-matched placeholders.
- Keep fixed aspect boxes for every poster, visual, and media strip.
- Prefetch only the active and adjacent artifact chunks.
- No Three.js or free-roam WebGL scene.
- Avoid canvas for effects CSS and SVG can render.
- Stop requestAnimationFrame loops when an artifact loses active status.
- Selection feedback must begin within 100 ms.
- No cumulative layout shift when title, year, count, or detail state changes.
- A rapid left-right-left input sequence must remain responsive and end on the
  final requested entry.

## Reuse inventory and build decisions

This inventory satisfies the mandatory internal and external primitive search.

| Need                      | Existing solution                                   | Decision                                                                                       |
| ------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Tilt                      | `src/lib/actions/tilt.ts`                           | Reuse                                                                                          |
| Cursor light              | `src/lib/actions/cursor-glow.ts`                    | Reuse                                                                                          |
| Press response            | `src/lib/actions/press-spring.ts`                   | Reuse                                                                                          |
| Magnetic action           | `src/lib/actions/magnetic.ts`                       | Reuse on primary controls only                                                                 |
| Haptics                   | `src/lib/shared/application/get-haptic-feedback.ts` | Reuse                                                                                          |
| Carousel engine           | `embla-carousel-svelte` 8.6.0                       | Use directly for the focus-and-context rail                                                    |
| Existing carousel wrapper | `HorizontalSwipeContainer.svelte`                   | Do not use unchanged: it forces every slide to 100% width and cannot show meaningful neighbors |
| Shared-element morph      | `motion` 12.42.0 `animateView`                      | Reuse; it supports spring morphs and graceful fallback                                         |
| Existing morph pattern    | `CapsHub.svelte`                                    | Follow its focus capture and close choreography                                                |
| Cheap content swap        | `Crossfade.svelte` with `fill`                      | Reuse                                                                                          |
| Heavy media loading       | `LazyMount.svelte`                                  | Reuse                                                                                          |
| Mobile detail             | `Drawer.svelte`                                     | Reuse                                                                                          |
| Gallery/detail shell      | `CollectionGalleryDetail.svelte`                    | Follow its mobile pattern, but do not use its desktop whole-gallery swap                       |
| Video poster              | `SourceVideoCard.svelte`                            | Reuse                                                                                          |
| CAP visual                | `CapsAssembly.svelte`, `YutaCapLiveDemo.svelte`     | Reuse                                                                                          |
| QFT visual                | `QftStage.svelte` and shared QFT model              | Promote from the test route, then reuse                                                        |
| Matrix visual             | `NotationShapeMatrix.svelte`                        | Promote from the test route, then reuse                                                        |
| TKA visual                | `SequenceHeroDemo.svelte`, `StepStrip.svelte`       | Reuse                                                                                          |

The rail's visual composition is feature-specific, so a new route component is
justified. Its movement engine is Embla; its effects and feedback come from
existing primitives.

No new audio service, drag engine, spring loop, drawer, crossfade, haptic
wrapper, or video card may be created.

## External research that informs the direction

- [The Playable Archive](https://www.playablearchive.com/) states the core
  problem directly: digital archives become more inviting when people can
  explore them as places and curate their own path instead of reading a static
  collection.
- [Neal.fun](https://neal.fun/) is the tonal reference for a web page that
  presents itself as something to do, not something to study.
- [Apple's feedback guidance](https://developer.apple.com/design/human-interface-guidelines/feedback)
  ties clear, consistent response to deeper exploration.
- [Apple's game-control guidance](https://developer.apple.com/design/human-interface-guidelines/game-controls)
  recommends direct interaction with game objects, visible press states, and
  coordinated visual and haptic feedback.
- [Material motion choreography](https://m1.material.io/motion/choreography.html)
  supports keeping a shared focal element visible through transitions and
  connecting reactions to the point of input.
- [Motion `animateView`](https://motion.dev/docs/animate-view) provides the
  installed shared-element morph, spring behavior, interruption queue, and
  non-support fallback.
- [W3C WCAG 2.2 target and dragging guidance](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)
  requires pointer alternatives to dragging and adequate target size.
- [MDN's 2026 carousel guidance](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Overflow/Carousels)
  reinforces centered snap points and explicit previous/next controls.

## Fable prototype assignment

Build a high-fidelity prototype at:

`src/routes/test/notation-playable/`

Do not replace the production `/notation` route during the visual exploration.

The prototype must:

1. use the real `NOTATION_CATALOG` data;
2. make all nine entries selectable by mouse, touch, and keyboard;
3. fit the main experience inside one viewport at 2560×1440 and 375×667;
4. include the complete rail, visited state, and focused detail transition;
5. make CAPs, QFT, and TKA fully live as the three proof artifacts;
6. give the other six deliberate source-derived posters with no placeholders;
7. use the existing interaction primitives listed above;
8. show reduced-motion behavior;
9. provide screenshots at 2560×1440, 960×412, and 375×667;
10. provide a short screen recording or equivalent interaction capture showing
    selection, detail morph, return, swipe, and all-nine completion.

Fable owns:

- artifact silhouettes;
- final accent palette;
- rail geometry;
- stage lighting;
- neighbor depth and clipping;
- the exact completion flourish;
- the visual treatment of posters and source material.

Fable does not own:

- catalog facts or copy;
- chronology;
- source attribution;
- new claims about relationships;
- new interaction infrastructure;
- production-route integration.

## Opus production assignment

After Austen approves the prototype:

1. promote any production-worthy visual components currently under `/test`;
2. replace the current `NotationCatalog.svelte` presentation without changing
   `NOTATION_CATALOG`;
3. preserve SSR, SEO, JSON-LD, canonical URL, and sitemap behavior;
4. complete keyboard, focus, inert-state, reduced-motion, and screen-reader
   behavior;
5. enforce the active-only media budget;
6. run the complete seven-viewport visual pass;
7. update the notation contract only for new structural guarantees;
8. keep every existing sourcing and em-dash guard green.

## Acceptance tests

The production experience is accepted only when all are true:

- No body scroll is needed to reach any of the nine entries at all seven
  required viewports.
- All nine entries are reachable through pointer, touch, and keyboard.
- First paint contains no `records` paragraph or source list.
- One artifact is obviously interactive before hover.
- Selection begins responding within 100 ms.
- The selected artifact, title, year, and rail agree after rapid navigation.
- Opening detail visibly originates from the selected artifact.
- Closing detail restores focus and selection.
- The visited rail records each entry once and performs one restrained
  completion flourish after all nine.
- No selection changes the layout box of neighboring controls.
- No horizontal overflow appears at 375px.
- Reduced motion removes spatial travel without removing access to content.
- Only one heavy renderer is mounted or animating.
- All source links and video IDs retain their verified targets.
- `notation-roots-remediation-contract.test.ts` remains green.
- Any extracted pure state transition receives a unit test because a wrong
  visited count or active index would be a silent bug.
- The repository checker reports no diagnostics in files changed by this work.
- Screenshots at 3840×2160, 2560×1440, 1920×1080, 1440×900, 820×1180,
  960×412, and 375×667 look like one product, not seven compromises.

## Out of scope

- changing catalog facts or source wording;
- teaching another creator's notation system;
- a free-roam 3D museum;
- accounts, achievements, or persistent progress;
- social features;
- sound design;
- autoplaying YouTube;
- redesigning the destination pages;
- changing the global public header or `--shell-w`.
