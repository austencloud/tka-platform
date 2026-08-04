# Deck Insert Card ("How to Read") — Handoff (2026-08-04)

## Mission

Austen found the first Choreo Card deck he printed and noticed it shipped with a
"How to Read" insert — the notation explained, a Greek pronunciation table, a
note that the cards are scannable, and the four things on each card back plus
how to group them. That artwork still existed in the repo but **had never
reached a released deck**: `PrintCardRenderer.renderInfoCardFront/Back` had zero
callers outside tests. This work wires it into the release and export pipeline
so every deck ships with it.

Design spec: `docs/superpowers/specs/2026-08-03-deck-insert-card-design.md`
(includes the Out Of Scope section and the adjacent gaps found while mapping the
release flow).

## Done — verified

All four commits are on `main`. Note the spec's original status line cited
`bad11655ce`, a **pre-rebase SHA that is not on main**; the landed feature
commit is `6862f90db6`.

| Commit | What |
|---|---|
| `42c2b7713e` | The design spec |
| `6862f90db6` | The feature |
| `481f9cf35f` | Spec status + deviations |
| `49a5a2d1b1` | Print-preview follow-up fix |

**The insert ships in every export path.** ZIP writes
`fronts/001_how-to-read_front.png` with sequence cards starting at `002`; the
MPC per-card PDF puts it on the first two pages; the home-print PDF gives it its
own leading sheet holding one insert **per copy**.
Evidence — `npx vitest run src/lib/features/choreo-card/services/__tests__/print-zip-insert-card.test.ts src/lib/features/choreo-card/services/__tests__/home-print-insert-card.test.ts`
→ **2 files, 8 tests, all passing** (re-run 2026-08-04 02:30 against HEAD). The
home-print tests assert page counts: 3 copies of a 2-card deck goes 3 → 5 pages
(one insert sheet added), and 12 copies goes to 9 pages (12 inserts overflow a
9-up sheet into two), which distinguishes per-copy from per-document.

**The insert never consumes a physical short code.** It is passed to the
exporters alongside `pairs`, never prepended to them, so `prepareSerializedPrintRun`'s
`frontRenderer` never sees it and card indexes stay 0-based over the real cards.
Evidence — the two `frontRenderer` tests assert exactly
`[{ABC,0},{DEF,1}]` and `["ABC:0","ABC:0"]`; the insert appears in neither.

**The card renders correctly at print resolution, and per-deck.** Screenshot of
`/test/insert-card` showing decks 007 and 008 side by side at 822×1122: front
footers read `Deck 007 · tkaflowarts.com` and `Deck 008 · …` respectively. That
two-deck view exists specifically because the front render cache originally
keyed on theme alone and would have served deck 8 the card reading Deck 007;
the key is now `theme|deckNumber|WxH`.

**Canvas is the only implementation.** `InfoCardFront.svelte` and
`InfoCardBack.svelte` are deleted (`git ls-tree -r HEAD` returns neither); the
designer preview renders the actual print canvas via the new
`InfoCardCanvasPreview.svelte`. Before deleting, a parity pass ported the two
things the Svelte version had and the canvas lacked: inline blue/red prop dots
in step 2 and italic *Start* in step 4. Both visible in the screenshot.

**Both faces are vertically balanced.** The first print-resolution screenshot
showed both top-aligned with the bottom third empty. Each face now lays its
wrapped body out once against a throwaway 1×1 context to measure it, then draws
it centred. Confirmed in the follow-up screenshot.

**The print preview matches the export.** `PrintPreviewPages` calls
`planPrintSlots` itself and was missed in the first pass, so the preview showed
6 sheets while the export had 7 — this is what made the insert look absent.
Evidence — in the live releaser with a composed 54-card deck, an
`evaluate_script` over the sheet labels returned
`["Fronts · How to read · Sheet 1 of 7", "Fronts · Sheet 2 of 7", …]` with 55
data-URL card images and a header of `Deck #001 / 55 cards`.

**`npx svelte-check` reports 0 errors and 0 warnings** at each of the three code
commits.

**A real export has been produced and opened** (2026-08-04, `1aa2a25c23`).
Backs-only export of Deck #003 (54 cards) from the live releaser →
`D:/Downloads/Deck_003_backs.pdf`, 23.8 MB. `pdf-lib` reports **7 pages** at
612×792pt. Page 1 is labelled `Deck #003 · Rotated · Quartered · 8-step · L1 ·
1 turn · Diamond · Staff · BACKS · How to Read · Sheet 1 of 7` and carries the
insert back ("Your Catalog") in the mirrored column, with the other eight slots
blank — correct for one insert at `copies: 1`. Pages 2–7 hold the 54 card backs,
nine per sheet. Backs-only claims no physical issuance (`printRunId: null`), so
this cost zero short codes.

That export exposed a third place doing its own print arithmetic:
`PrintPanel.svelte` advertised "Fronts 6 sheets" for a 7-page file and "Images
108 PNGs" for a 110-file ZIP, and its Combined formula was `sheets*2 + 2` when
the exporter emits `sheets*2 + 1`. Fixed in `1aa2a25c23`; the panel now reads
7 / 7 / 15 / 110 against that deck. The exported PDF's title also now carries
the printed count.

## Believed done — unverified

**The fronts / ZIP paths have still never been exported to disk.** Their
behaviour is covered by unit tests and they share the slot-planning code the
backs export just exercised, but no fronts PDF or ZIP has been opened by a
human. Doing so mints one permanent short code per card and issues physical-card
records, so it needs Austen's explicit go-ahead.

**Print legibility at physical size is unconfirmed.** The pronunciation table
and the corner labels are the smallest type on the card: 12px at the card's
500×700 reference, ×1.5 → 18px on an 822px canvas → ~4.3pt at 300 DPI. Typical
print minimum is ~6pt. These proportions are inherited from the original design
Austen already printed and liked, so this is **not a regression** — but nobody
has checked it on a physical proof from this pipeline.

**Tarot decks.** `renderInsertCardPair` accepts `cardSize` and sizes the canvas
correctly (897×1497), but `REF_SCALE = 1.5` in the renderer is tuned for poker's
750×1050 content area. A tarot insert will lay out correctly and stay in bounds
but its type will be proportionally small. Never rendered or looked at.

## In flight

Nothing uncommitted for this work — `git status --short` over
`src/lib/features/choreo-card`, `src/routes/test/insert-card`,
`scripts/release-tnd-deck.cjs` and `docs/superpowers/specs` is clean as of this
handoff. All work is on `main` in the primary checkout (`E:/tka-platform`). No
branch, no worktree.

## Loose ends (ranked)

1. **Physical proof for legibility.** Print one insert at actual size and read
   the pronunciation table and corner labels. If they fail, the fix is to bump
   those two type sizes in `info-card-canvas-renderer.ts`, not to redesign.
2. **`/test/insert-card` label casing.** Both `capitalize()` helpers (preview and
   PDF exporter) now touch only the first character and both call sites pass
   `"How to Read"`, so preview and PDF agree. Austen's live tab still showed the
   pre-HMR `"How to read"` — cosmetic, self-resolving on reload, listed only so
   nobody re-investigates it.
3. **The deferred deck page.** `/deck/[n]` + deck-level QR. See Decisions below
   before reopening; the reasoning and the three real costs are recorded in the
   spec's Out Of Scope section and in the `project_deck_insert_card` memory.
4. **Adjacent gaps in the release flow**, found while mapping it and deliberately
   not fixed here. Listed in full at the end of the design spec. The two that
   will bite during a first end-to-end release: `.claude/agents/deck-release-expert.md`
   documented a `decks/{catalogId}` collection that does not exist (it is
   `catalogs/`), and `scripts/release-tnd-deck.cjs` writes manifests missing
   `name`/`description`/`bluePropType`/`redPropType` — the prop snapshot that
   `DeckRelease.ts:128-131` says keeps cached card renders valid. It also
   hardcodes `stepCount: 4`.

## Decisions already made

Austen's calls on 2026-08-03. Do not re-litigate these.

- **Static, universal insert** — one card, same copy in every deck. It teaches
  the system, not the deck's slice. Rationale that settled it: generation varies
  the sequences but never the notation, so the insert is the one teaching
  surface with zero marginal cost per deck; and a generated deck is one of one,
  with no friend who owns it and no video about it, so it must teach itself.
- **First, and counted.** The insert is card 1 of the printed stack, and the
  number quoted to a print vendor includes it. `cardCount` keeps its old meaning
  so existing manifests stay accurate; `getPrintedCardCount()` adds the insert.
- **No QR on the insert; print the deck number instead.** Austen initially chose
  a deck-level QR to a new `/deck/[n]` page, then asked whether the deck page was
  premature given every deck is unique. Agreed answer: premature by one step. A
  printed QR is a permanent commitment made before the release flow has been
  walked once — if `/deck/7` ever 404s the physical card is dead. Printing the
  deck NUMBER costs nothing, commits to nothing, and makes every deck already in
  the wild retroactively addressable if the page is ever built.
- **Canvas is the source of truth**, the Svelte pair deleted, and the designer
  preview shows the actual print canvas.
- **Scope was explicitly narrowed to the insert cards**, with the full
  top-to-bottom release flow left for its own spec written from an actual run
  rather than from reading code.

## Gotchas

**My test broke production deploys.** `home-print-insert-card.test.ts` calls
`blob.arrayBuffer()`, which jsdom's Blob does not implement. It passed locally
but failed Web App CI, and Deploy Pages is gated on a green CI run via
`workflow_run` — so every deploy in that window was skipped and production
served stale builds. Fixed by Austen in `f9ab18f33c`, which polyfills
`Blob.prototype.arrayBuffer` once in `tests/setup/vitest-setup.ts`. Lesson for
the next agent: a locally green vitest run is not a green CI run, and in this
repo a red CI silently stops deploys rather than shouting.

**THREE places compute print composition, not one.** `print-pdf-exporter.ts`
and `PrintPreviewPages.svelte` each call `planPrintSlots` independently, and
`PrintPanel.svelte` re-derives sheet and file counts arithmetically without
calling the planner at all. The planner's docstring claims it guarantees preview
equals print; it only does if you change all three. The insert missed the
preview on the first pass and missed the panel on the second — each was found
only by looking at the actual surface. Any change to sheet composition must
touch all three, and the panel's formulas must be checked against a real
exported file, not against the preview.

**Do not route the insert through `planPrintSlots`.** It was tried. An untagged
item either merges into the cards' bucket (LOOP/gallery decks have no elements,
so everything is untagged) or, with `firstOnTop: true`, gets emitted first and
lands at the *bottom* of the cut stack. The insert gets its own hand-built slot
block in both call sites for this reason.

**`/test/*` routes need a layout reset AND a splash removal.** Without a
`+layout@.svelte`, the app shell swallows the route and redirects to
`/create/construct`. With the reset, `app.html`'s boot splash (`#app-loading`)
is never removed by the shell and covers the page — the harness removes it in an
`$effect`, and it comes back on every fresh load before the effect runs, so a
screenshot taken too early captures the splash.

**Screenshots of the harness time out** at full card size; `Page.captureScreenshot`
exceeded its protocol timeout twice on four 822×1122 data-URL images. Shrinking
the `<img>` widths to ~330px via `evaluate_script` before capturing works.

**Five choreo-card test files fail at import** with
`util.Long.fromNumber is not a function` from protobufjs, including
`reversal-matrix-solver.test.ts`, which touches none of this work. Pre-existing
and unrelated — do not chase it as a regression. 238 tests pass around them.

**Reloading the releaser destroys a composed deck.** The composed card set is
in-memory. If Austen has a deck up and you need to verify something, prefer
`evaluate_script` over a reload.

## Related

- Memory: `project_deck_insert_card`
- Expert file updated with this canon: `.claude/agents/deck-release-expert.md`
  (card specs section + export guidance)
