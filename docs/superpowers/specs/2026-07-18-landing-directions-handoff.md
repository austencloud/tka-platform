# Article-First Landing Directions — Handoff (2026-07-18)

## Mission

Replace the landing page's oversized tutorial framing with an article-first front door. Austen wants the homepage to explain what TKA is, then route readers into the substantial pages that already exist: Flow Arts Notation, Flow Arts Composer, TKA's origins and software lineage, About, the Glossary, choreography articles, and Choreography Cards. The homepage should not begin with the Guide, host another Composer playground, or present a context-free three-step "How it works" diagram. Two code-native mockups now live in an isolated test route so Austen can compare them on his 4K monitor before anything touches `src/routes/+page.svelte`.

## Done — verified

There is no finished, committed production implementation yet. The work is deliberately isolated as an uncommitted test route; see **In flight**.

The following discovery claims were verified against `main` at `85e12c5586`:

- `/roots` is no longer a standalone article. `src/routes/(public)/roots/+page.ts` permanently redirects it to `/notation`; `/roots/software` remains a real page. The mockups therefore present Origins as part of Notation and give Software Lineage its own link.
- The real reusable public demo is `src/lib/shared/landing/components/SequenceHeroDemo.svelte`, seeded by `src/lib/shared/landing/data/demo-sequence.json`. Both directions use it. No pictograph or sequence was hand-rendered.
- The test harness reuses `MarketingChrome.svelte`, `SegmentedControl.svelte`, `SequenceHeroDemo.svelte`, and `public-editorial.css` instead of creating replacement primitives.
- The live Vite server returned HTTP 200 for `/test/landing-directions` and for the three transformed Svelte modules:
  - `/src/routes/test/landing-directions/%2Bpage.svelte`
  - `/src/routes/test/landing-directions/_components/EditorialFrontPage.svelte`
  - `/src/routes/test/landing-directions/_components/ReadingIndex.svelte`
- `pnpm exec prettier --check 'src/routes/test/landing-directions/**/*.svelte' 'tests/unit/landing-directions-contract.test.ts'` reported: `All matched files use Prettier code style!`
- The AI-writing pass found none of the project's banned openers, blacklisted marketing words, hedging transitions, or em dashes in the user-facing mockup copy.
- Flow Arts Knowledge MCP is connected in this Codex session. `get_term_definition({ term: "pictograph" })` grounded the mockup's pictograph description as one motion step showing props and motion arrows; `get_alphabet_info({ compact: true })` grounded the notation vocabulary. The new session must still use MCP for any additional TKA domain claim.

## Believed done — unverified

- Both mockups are designed for a bounded 4K composition and collapse through container queries, but neither received a browser screenshot pass. The browser bridge returned `No browser is available`, then `agent.browsers.list()` returned `[]`.
- The A/B segmented switch compiles, but its actual click behavior has not been exercised in a browser.
- The real `SequenceHeroDemo` is expected to lazy-mount normally in both directions, but the animation was not visually observed.
- The focused contract test exists but did not finish. `pnpm exec vitest run tests/unit/landing-directions-contract.test.ts` timed out while a separate machine-wide `svelte-check` held more than 4 GB and available memory fell below 1 GB. Do not report this test as passing.
- No full `npm run check` or build was run for this isolated mockup. The resource-budget gate correctly prevented a second checker while another session owned the running one.

## In flight

Work is on `main` in `C:\tka-platform`. Current HEAD when this handoff was written: `85e12c5586` (`feat(prop-picker): dev/admin-gated poi in the flat prop picker`).

These files belong to this landing task and are currently uncommitted:

- `src/routes/test/landing-directions/+page.svelte`
  - Wraps the preview in the real `MarketingChrome`.
  - Uses the existing generic `SegmentedControl` for the equal-width A/B selector.
  - Keeps the production homepage untouched.
- `src/routes/test/landing-directions/_components/EditorialFrontPage.svelte`
  - Direction A, the recommended spacious editorial front page.
  - Opens with one clear definition and two article doors.
  - Gives Notation one real live player, presents Composer as an article rather than an embedded generator, folds Roots into Origins, and ends with a secondary reading shelf.
- `src/routes/test/landing-directions/_components/ReadingIndex.svelte`
  - Direction B, a denser reading-room/index composition.
  - Uses a sticky contents column at wide sizes, concise article entries, one real live player, and a compact reference grid.
- `tests/unit/landing-directions-contract.test.ts`
  - Protects two directions, shared primitives, real demo use, the absence of `PlayWithItSection`/`ComposerGenerateDemo`, current article destinations, and the absence of a stale `/roots` door.

The live route is [https://localhost:5173/test/landing-directions](https://localhost:5173/test/landing-directions) while Austen's main-checkout dev server is running.

Unrelated dirty files were present and must not be staged, committed, reverted, or edited by this task:

- `src/routes/test/composer-wings/_sections/MandalaSection.svelte`
- `src/routes/test/composer-wings/_sections/chosen-mandalas.ts`
- `src/routes/test/mandala-pick/`

An earlier directory still exists at `C:\worktrees\tka-platform\landing-assembly-table`, but Git no longer registers it as a worktree and it has no `.git` file. It contains the rejected oversized/compact "How it works" experiments. Treat it as read-only evidence and do not resume work there.

## Loose ends (ranked)

1. Open [https://localhost:5173/test/landing-directions](https://localhost:5173/test/landing-directions) on Austen's desktop 4K display. Compare A and B at first glance, exercise the switch, scroll the whole page, confirm the real sequence player mounts, and inspect console errors. Browser interaction requires Austen's current-session permission under `AGENTS.md`.
2. Capture exactly what Austen likes and dislikes in each direction. Refine the test route first. Do not edit `src/routes/+page.svelte` until he selects a direction or an explicit hybrid.
3. Re-run `pnpm exec vitest run tests/unit/landing-directions-contract.test.ts` after the resource gate confirms no other `svelte-check` is running and memory pressure has recovered.
4. Run one captured full check before committing implementation: `npm run check > .fast-check/landing-directions-check.log 2>&1`, then inspect that log. Obey the one-check-machine-wide and 4 GB available-memory gates.
5. Commit only the four landing-task paths with an explicit pathspec. Never sweep in the Composer Wings or Mandala Pick changes.
6. Once Austen chooses the production direction, write the implementation plan. The likely production change replaces `LazyHowTkaWorksSection` and `PlayWithItSection` in `src/routes/+page.svelte` with the chosen article-first composition; preserve the real Marketing Chrome and reassess whether `GuidesSection` and `ShopCtaSection` become secondary article links or disappear.

## Decisions already made

- 2026-07-18, Austen rejected the raster image mockup as "funky" and explicitly asked for mockups built from real components.
- 2026-07-18, Austen rejected the oversized "How it works" assembly-table treatment as too big, overbearing, and over-explained.
- 2026-07-18, Austen also rejected the later near-empty state: the homepage still needs enough explanation to orient a new reader.
- 2026-07-18, the homepage should foreground the existing articles about Composer, Notation, roots/origins, and related work. It should not start with the Guide.
- 2026-07-18, the homepage may not be the right place for "Play with it." The approved mockups use one live notation demo as evidence but do not embed `PlayWithItSection` or `ComposerGenerateDemo`.
- 2026-07-18, Austen approved building both proposed directions with: "perfect full send."
- Direction A was presented as the recommendation; Direction B exists to test whether Austen prefers a denser, faster-scanning index on the 4K display. No winner has been selected.

## Gotchas

- Read `C:\tka-platform\AGENTS.md` and the relevant `.claude/rules/*.md` before acting. The current rule is to work directly on `main`; the old mandatory-worktree policy was reversed on 2026-07-18.
- Port 5173 is Austen's HTTPS/h2 dev server. Never start, stop, restart, or kill it. All local links use `https://`. Reuse it for this main-checkout route.
- The Git index is shared across agents. Use `git commit -m "..." -- <four exact landing paths>` and never a bare commit, `git add .`, or a broad directory path that might capture another session's files.
- Run the resource-budget checks before Vitest, `svelte-check`, or a build. During this session, another checker drove available memory as low as 574 MB and made the focused Vitest command time out without output.
- `/roots` is a redirect. Do not add a homepage card that pretends it is still an article. Link `/notation` for the integrated origins material and `/roots/software` for the retained software lineage.
- Do not infer TKA facts from memory. The MCP became available in this session despite the older known-gap note in `AGENTS.md`; check the next session's actual tool list and stop if Flow Arts Knowledge MCP is missing.
- Do not use image generation for the next design pass. Austen asked to judge real browser components.
- Do not revive the old six-step "How it works" component or the compact three-panel proof strip from the orphan directory. Both were rejected as the wrong information architecture.
