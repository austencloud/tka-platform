# Composer Marketing Page — Five-Wings Rework — Handoff (2026-07-18)

## Mission

Rebuild the `/composer` marketing page from a flat feature list into a narrative
organized as five "wings," each demonstrated with the app's REAL components (not
wireframes or mockups). Everything is being prototyped on a throwaway harness at
`/test/composer-wings` before any of it touches the real `/composer`.

The five wings (Austen's taxonomy — do NOT conflate the first two):

- **Create** (how you make a sequence): Construct · Generate · Fuse · Assemble
- **Outputs** (what a sequence becomes): 2D animation · Mandala · Tunnel · Card · 3D recording
- **Learn**: the Guide · the games arcade · Practice/drilling
- **Connect**: follow creators
- **Library & Browse**: collections + the community gallery

No formal master spec exists yet (loose end #3 — this handoff is the interim
source of truth). Related prior spec: the hero/type-scale work at
`docs/superpowers/specs/2026-07-17-composer-proportionate-scale-design.md`.

## Done — verified

- **Hero redesign on the real `/composer`** — a centered title band above a
  copy/canvas duo, with symmetric outer margins via
  `grid-template-columns: auto auto` + `justify-content: center` (in
  `src/routes/(public)/composer/+page.svelte`, the `@media (min-width:1680px)`
  `.hero-duo` block). Committed in `9543e9f444` (consolidation merge).
  Evidence: fixes Austen's "more empty space to the right of the canvas than to
  the left of the text" note (2026-07-17); he proceeded to the next section
  without further hero objections.
- **Generate preset = 16-count · level 2 · max turn intensity · rotated ·
  QUARTERED** across `src/routes/(public)/composer/_data/per-visit-demo.ts` and
  `src/routes/(public)/composer/_components/ComposerGenerateDemo.svelte`.
  Committed in `b45281a6bb`. Evidence: option values grounded against the enums
  — `Period.QUARTERED` (circular-models.ts:77), `turnIntensity?` is a real
  `GenerationOptions` field (generate-models.ts:44), `DifficultyLevel.INTERMEDIATE`
  → level 2 (sequence-metadata-manager.ts:35-36). Quartered on a 16-count makes
  `simplifyRepeatedWord` render a tidy 4-glyph title.
- **zod install repaired on THIS machine.** Evidence:
  `node --input-type=module -e "import('zod')..."` → `ZOD RESOLVES OK · z = object`;
  `.pnpm/zod@4.3.6/node_modules/zod/package.json` restored (13 files) after being
  a dangling junction to empty store dirs. This is an ENVIRONMENT fix (`pnpm
  install`), not a code change — see Gotchas for the desktop.
- **Construct test section renders the real pickers.** Evidence: a Chrome
  DevTools snapshot (2026-07-17) showed the real `StartPositionPicker` with live
  α / β / γ start-position buttons on `/test/composer-wings`.
- **Austen's 36 saved mandalas pulled + 12 chosen.** Evidence: the admin-SDK
  pull listed 36 by name; `chosen-mandalas.ts` contains 12 top-level entries
  (ZDΔU, Θ-SOX-, AΦ-, FΨ, Φ-JΨ-DΦ-JΨ-D, YΘY-Θ, FΨFL, LΦAΩ-RS, Φ-JΣ-W-, LGΔ-W-,
  CCΣX, JΣ-W-Φ-), confirmed by grep.

## Believed done — unverified

- **The full `/test/composer-wings` page rendering clean after the zod fix.**
  NEVER visually confirmed — Chrome's debug port (9222) died mid-session and the
  chrome-devtools-mcp is connect-only (see Gotchas). Generate/Mandala/Games each
  painted content (8 canvases + 17 SVGs counted via `evaluate_script`) but always
  UNDER the zod error overlay; after the zod fix there was no way to re-verify.
  **This is the next agent's first job:** load `/test/composer-wings` in a
  signed-in browser and confirm all four sections render clean.
- **GenerateSection** — the 2×2 real param cards (Length/Level/Turns/Grid) +
  Generate + animated result. Built to mirror `ComposerGenerateDemo` + the real
  card components; the builder flagged edge cases it handled (TurnIntensityCard
  empty allowed-values at level 1; LengthCard tier clamp). Not runtime-verified.
- **GamesStripSection** — 8 real `*Preview.svelte` arcade tiles. Built to mirror
  `GameCard`'s mount recipe (container-type 16:10 stage, offscreen pause). Not
  runtime-verified.
- **MandalaSection Beat B (12 chosen, breathing).** Beat B WAS verified rendering
  as the static PICKER (Austen picked 12 through it), but the switch to the
  animated display of the 12 chosen is not runtime-verified.

## In flight

Committed WITH this handoff (my uncommitted deltas):

- `src/routes/test/composer-wings/_sections/MandalaSection.svelte` — rewritten to
  render `CHOSEN_MANDALAS` breathing (Beat B); Beat A (Shape Matrix) unchanged.
- `src/routes/test/composer-wings/_sections/chosen-mandalas.ts` — the 12 picks
  (~450 KB of StepData), written by the Choose button.
- `src/routes/test/mandala-pick/` — the interactive picker page (`+page.svelte`,
  `+page.ts`) and the dev save endpoint (`save/+server.ts`).

Already committed on main (context): the full `/test/composer-wings/` harness
(`+page.svelte`, `+page.ts`, `_sections/ConstructSection.svelte`,
`GenerateSection.svelte`, `GamesStripSection.svelte`, `showcase-mandalas.ts`),
plus the hero + generation-preset changes above.

NOT committed (another agent's uncommitted work — left untouched):
`src/routes/test/landing-directions/`, `tests/unit/landing-directions-contract.test.ts`.

## Loose ends (ranked)

1. **Verify `/test/composer-wings` renders clean** (see Believed-done #1). Load
   it in a signed-in browser, confirm all four sections (Construct, Generate,
   Mandala, Games) render without the zod overlay. Fix whatever's broken.
2. **Finalize the mandala showcase.** Austen picked 12 but leaned toward a
   tighter hero set (6–8). Re-pick anytime at `/test/mandala-pick` (Choose
   overwrites `chosen-mandalas.ts`). Then SLIM each chosen entry to only the
   fields `SequenceMandala` reads (it's ~450 KB of full StepData now), and
   DELETE/trim the 1.3 MB `showcase-mandalas.ts` picking pool (it's committed to
   main — bloat).
3. **Write the master spec** for the five-wings vision (brainstorming → spec).
   This handoff is the stopgap.
4. **Build the remaining wing sections on the harness:**
   - **Outputs OPENER** — "one sequence, many forms": a generated sequence shown
     as its Choreo Card beside its mandala, with a reroll. DROP the 2D animation
     there (redundant with hero/Generate/Play). This is where card+mandala+reroll
     lives, NOT the mandala section.
   - **Learn** — Guide tease (`GuideCover` emblem + the spine "Grid · Positions ·
     Motions · Letters · Words · Turns"; honest "Level 1 complete, Level 2
     landing") + Practice tease (tempo-ramp cockpit: climbing BPM + metronome).
     Games strip already built.
   - **Connect** — Featured-creators row (`CreatorCard`: avatar + accent ring +
     prop badge + follower count + Follow). Real follow graph exists; there is NO
     social feed — pitch "follow the people whose flow you like," not "a timeline."
   - **Library & Browse** — community browse grid (static pictograph tiles + filter
     chips) + collections shelf (include a Smart Collection card).
5. **Integrate the finished wings into the real `/composer`** (all of the above is
   on the test harness). Reorganize the existing sections into the five-wing
   narrative and pull the mandala OUT of the Generate demo (it's an Output).
6. **Cleanup:** delete the deprecated wireframe
   `static/sketches/2026-07-17-composer-wings-layout.html` (Austen: "utterly
   useless"). Scratchpad scripts (`pull-mandalas.cjs`, `bake-mandalas.cjs`,
   `mandalas-full.json`) lived in the laptop scratchpad — gone on the machine
   switch, re-derivable via the admin SDK (see Gotchas).

## Decisions already made (Austen, 2026-07-17/18)

- **Five wings; don't conflate creation techniques with art outputs.** The
  mandala is an OUTPUT (peer of tunnel/card/3D), not a step after Construct/Generate.
- **Mandala section = STRUCTURAL depth, not color swatches.** The first draft
  (one shape in nine palettes) was rejected: "cute but... not functionally
  expressing the complexity." It must show the Shape Matrix baseline and how TKA
  expands past it (non-radial orientations + hand-path/prop-rotation reversals).
  **Credit** the Shape Matrix (Lorq "Sir Lorq" Nichols' work, per MCP) and VTG
  (Noel Yee) as the foundation TKA extends. **Do NOT knock VTG** — frame it as
  lineage/expansion.
- **Mandala showcase content = Austen's own hand-picked SAVED mandalas** (12
  chosen), breathing/undulating. Mention the living/breathing quality lightly
  ("a nifty thing only our software does"). The generated non-radial/reversed
  examples were "too complicated with too many lines" and were rejected in favor
  of his curated saves.
- **Card+mandala+reroll = the Outputs OPENER, not the mandala section. Drop the
  animation** (redundant with the other live sections).
- **Games = a STRIP of the arcade's real preview tiles**, not one Pictionary
  round (meaningless to a visitor who doesn't know the alphabet). Lead with the 4
  alphabet-agnostic ones: Mandala Match, Watch It Bloom, Read the Performer (3D),
  Trace the Card.
- **Fuse = prose only** (can't be a self-contained tile — loads gallery
  sequences over the network, hands off to the viewer). **Assemble = a scoped
  "tap two dots" teaser**, later.
- **Generate preset = 16 / level 2 / max turns / rotated / QUARTERED** (Austen's
  favorite; quartered → short titles).
- **Build order:** Create demos → Mandala → Learn → Connect + Library.
- **Visualization = real components in a test page, never wireframes/mockups.**
  Austen rejected the HTML sketch outright.

## Gotchas

- **zod / the desktop.** The Vite SSR overlay "Cannot find module 'zod' imported
  from special-arrow-placement.ts" is caused by a BROKEN node_modules install
  (empty `.pnpm/zod@X/node_modules/zod` dirs → dangling `node_modules/zod`
  junction), not by the code. Fixed here with `pnpm install`. The desktop has its
  own node_modules; if it hits that overlay when anything SSR-touches the
  pictograph pipeline, run `pnpm install` (it may say "Already up to date" but
  still re-hardlinks the missing files).
- **Test-route SSR trap.** `/test/composer-wings/+page.svelte` loads its section
  components via CLIENT-ONLY dynamic import (inside an IntersectionObserver), NOT
  static top-level imports. Static imports drag the heavy pictograph graph
  through the dev SSR module runner and re-trigger the zod error. Keep the
  dynamic pattern for any new heavy section.
- **Browser verification is currently blocked.** Chrome's debug port (9222) died
  mid-session; the chrome-devtools-mcp is CONNECT-ONLY (`--browserUrl`) and
  cannot launch Chrome. A fresh-profile debug Chrome (a) isn't signed into
  Austen's account (so the mandala collection is empty) and (b) rendered a blank
  app (cold-profile localhost self-signed cert / hydration). To drive it: verify
  in Austen's own signed-in Chrome, OR fully quit his main Chrome and relaunch it
  with `--remote-debugging-port=9222 --remote-allow-origins=*` on his real profile.
- **Mandala collection is per-user Firestore** at `users/{uid}/mandala-collection`.
  The `/test` route does NOT hydrate it (no auth boot in a signed-out/other
  browser) — that's why the picker showed "No saved mandalas." Worked around by
  reading it SERVER-SIDE with the admin SDK: `serviceAccountKey.json` (project
  root) + `firebase-admin`,
  `admin.auth().getUserByEmail("austencloud@gmail.com")` → uid
  `PBp3GSBO6igCKPwJyLZNmVEmamI3`, then `users/{uid}/mandala-collection`. That's
  how the 36 were pulled and baked into `showcase-mandalas.ts`; the 12 picks live
  in `chosen-mandalas.ts`.
- **The mandala-pick save endpoint** (`/test/mandala-pick/save/+server.ts`) writes
  a SOURCE file (`chosen-mandalas.ts`) via `node:fs.writeFileSync` from a dev
  `+server.ts`. Dev-only tooling; fine for the harness, would not survive a
  production adapter build. The Choose button POSTs the selected mandala objects
  there.
- **Worktree policy REVERSED.** `c53fbeadce docs(rules): reverse worktree mandate
  — work on main directly`. Everyone is on `main` now; the feature branch was
  consolidated in `9543e9f444`. Commit to main directly, SCOPED to your own files
  — the tree is shared with other live agents (e.g. `landing-directions/` is
  someone else's uncommitted work; leave it).
