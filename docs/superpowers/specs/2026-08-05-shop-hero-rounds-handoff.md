# Shop Front-Door Hero, Rounds 10–13 — Handoff (2026-08-05)

## Mission

The `/shop` front door is the unified shop's landing surface: a hero where two
Choreo Cards sit on a stage and a phone scans one — the phone's screen being a
literal iframe of the real `/q/<code>` scan page (`?demo=1`), not a mock. This
session ran feedback rounds 10–13 with Austen: scanned-state card visibility,
his own hero copy, a page-wide layout pass (fold / catalog tiles / closed-shop
bands), phone materiality, and a live interactive phone screen with
demo-context chrome trimming.

Authority for everything hero: the "Hero iteration rounds" section (R1–R13,
each round with commits + evidence) of
`docs/superpowers/specs/active/2026-08-02-shop-unification-design.md`. This
handoff covers session state; the spec covers design rationale. Read both.

Operating mode (standing, from Austen): Fable orchestrates, Opus executors
implement, and the orchestrator personally screenshots every visual claim
(`visual-verification-mandatory.md`). Genuine design forks go to Austen as
multiple-choice questions; he decides fast and enjoys deliberating.

## Done — verified

All commits LOCAL on main. **Not pushed, deliberately** — see Loose end #1.
`git log origin/main..HEAD` is ~80 commits deep across many sessions.

| Round | Commits | What + evidence |
|---|---|---|
| R10 copy | `dc4f037186` | Austen's own hero copy rewrite committed standalone + two mechanical fixes ("repoirtoire"→"repertoire", "Learn"→"learn"). Subline untouched per his later ruling. |
| R10 spread | `5a60f7058`→ full `5a60ff7058`, spec `f63a4b0301` | Scanned state spreads both cards clear of the phone: 100%/100% unoccluded at 1920/2560/3840 (was 37%/70%), measured by opacity-aware rect hit-test sampling; copy↔card gap 426→~110px at 1920, ~716→184px at 3840; 375 and 960×412 pixel-identical by design. Orchestrator-verified frames at 1920+3840 rest+scanned, 2026-08-04. |
| R11 | `42780c55b0`, spec `ea3b227b54` | Phone materiality (conic metallic rim, punch-hole clear of the viewer top bar, bezel earpiece, side nubs, glare sweep ≤11% white, pointer-inert) + live-screen gate at scale ≥0.9 (hysteresis 0.86). Interaction proven at 4K with trusted clicks: 5 nav tabs switch views (Tunnel WebGL renders in-phone), playback panel opens, step cells move the playhead; `elementFromPoint` returns IFRAME over all tabs; no scroll trap (inner scrollHeight == clientHeight). |
| R12 | `f71cc1d693`, spec `390947dd4a` | Page-wide layout: fold rule `min-height: calc(100svh - header - reserve)` below ~3000px (fold deltas −1px at 1920/2560/820), 4K instead shows the whole first tile row (bottom 2129 of 2160); grid pinned 1/2/3 with double tracks so 5 products = 3 + centered 2; single-item shelves (Books/Bundles) center instead of stretching one tile across 1669px; tile art derived from fan span pitch via `100cqi` (uniform card size across tiles; 820-clip fixed); the two closed-shop bands became one row of two equal cards, page height 3190→2913 at 1920; empty kicker deleted. Full 7-viewport sweep by executor; orchestrator-verified 1920 fold/catalog/bands frames + 375, 2026-08-04. |
| R13 | `e84ee4ab4b`, `122a9b0cb6`, spec `1e43623142` | Pointer-aware gate: fine pointer live at scale ≥0.55 (WCAG 24px against the measured 67.6×44 nav tab), coarse keeps 0.9/0.86 — so Austen's 4K@200% (=1920 CSS) machine is now live; A/B proved same viewport inert under emulated touch. Demo chrome trim via ONE new shell prop `embedded` (host passes it only when `demo=1`): X, account, share, and nav-away/auth ⋮ items hidden (not dead); motion L/R + practice + playback + all 5 nav tabs kept and re-proven at 1920; Escape fenced in the /q host (`closeViewer` no-ops under demo — it bypasses the button). Shell contract test 19/19 unmodified. Standalone `/q` full chrome confirmed. Orchestrator-verified at emulated 1920: pointer auto, IFRAME hit-tests, cue chip, viewer animating (2026-08-05 frame). |

Cross-round invariants that held every round: 960×412 fold guarantees (pill,
trigger, CTA under the fold), zero layout shift through scan→deal→scan, zero
console page errors, `check:fast` clean in touched files.

## Believed done — unverified

- **Austen's own eyes on the live phone.** R13 was verified at *emulated* 1920
  in the shared debug Chrome; Austen reported the dead screen before R13 and
  has not yet confirmed post-fix in his real window (he must reload `/shop` —
  concurrent-session HMR leaves stale module graphs). Confirmation is his
  reply, nothing to run.
- **Live-gate hysteresis under real window drag** (0.55/0.52 and 0.9/0.86) is
  reasoned + spot-checked, not exercised across a continuous resize.

## In flight

- Nothing of this session's work is uncommitted. The checkout carries many
  OTHER sessions' dirty files (museum, analytics, choreo-card, landing…) —
  none are shop files; do not touch or commit them
  (`commit-only-your-own-changes.md`).
- `stash@{0}: autostash` sits in the stash list — residue of another session's
  `git pull --rebase --autostash` that ran mid-R13 (see Gotchas). Not ours to
  drop; flagged to Austen 2026-08-05.
- One dirty file inside a shop-adjacent area:
  `src/lib/shared/sequence-viewer/components/export-coordinator.svelte.ts` —
  another session's, NOT part of R13's viewer changes.

## Loose ends (ranked)

1. **Push sequencing (Austen-owned, blocks everything reaching prod).** Push
   of main = Cloudflare Pages production deploy. ~80 local commits queued.
   Gates: `SALES_LIVE=false` must be respected on prod, nav files carry
   another session's Notation→History relabel, and the spec's "Decisions
   Austen owns" section lists the rest. Do not push without his explicit call.
2. **Austen confirms the live phone on his machine** (see Believed done).
   If still dead for him after reload: first suspect `(hover: hover) and
   (pointer: fine)` evaluating false on his setup (touchscreen laptops report
   fine+coarse mixes), then the gate's measured screenW.
3. **`claimUsername()` failed-precondition Firestore write**
   (`src/lib/shared/auth/services/username-validator.ts:108-137`) still fires
   on every signed-in page load, /shop included. Shared auth, not shop code;
   flagged to Austen repeatedly; unfixed by his choice so far.
4. **Catalog sequence-id migration** — stopped-before-writing decision
   documented in the spec ("Decisions Austen owns"): 852 shortcode docs join
   seed ids, code parses them; recommended `${seedId}__t_${pattern}` scheme.
   Needs his catalog-identity ruling, not a scoped repair.
5. **4K fold margin is ~30px.** A future two-line product title at 3840 pushes
   the first tile row back under the fold (degrades to a peek, doesn't
   break). Recorded in spec R12.
6. **Trilogy tile fan reads narrower** than sibling tiles (3 cards at the
   uniform card size span 62% of the panel, centered) — deliberate cost of
   one consistent card size; revisit only if Austen calls it out.
7. **2D view's corner play/pause never appears in the embed** (auto-hiding
   chrome parked above the frame). Playback reachable via the panel.
   Pre-existing, low priority.
8. **Duplicate Firestore product doc** `products/prod_UsGN7MufXHI8VI` — still
   listed in the spec's Austen-owned decisions.

## Decisions already made (do not re-litigate)

- **Subline stays**: "The latest evolution of flow arts technology" is
  deliberate deadpan — inventing a solemn category and claiming its throne.
  Austen, 2026-08-04: it's "something that I would say in real life." The
  earlier recommendation to restore "Scan it and it moves." was withdrawn.
- **Kicker deleted** — Austen confirmed nothing goes back in it (2026-08-04).
- **Phone = literal iframe of real /q** (2026-08-03), mandala facsimile
  retired; camera-viewfinder scan flavor.
- **Live screen**: pointer-aware gate (2026-08-04 "on my 4K device I actually
  could click each one of these buttons very easily"; 2026-08-05 "actually
  use them right now"). Bottom five nav = usable; nonsense-in-context
  controls deactivated — his exact word — implemented as hidden-not-dead.
- **"Everything real, no fences"** was the R11 starting posture; Austen then
  narrowed it (2026-08-05): fence what navigates away or requires auth.
- **Fold**: hero fills the first screen below ~3000px; at 4K the first tile
  row shows instead (R12, from his "designed for that device" directive
  2026-08-04).
- **Bands**: side-by-side equal cards; copy and SALES_LIVE gating untouched.
- **Uniform card size across catalog tiles**, even where it narrows the
  trilogy fan.
- **Standing**: never key any cache on sequence id alone (add deck
  discriminators); hero looks up codes via `findExistingCodeForSequence`,
  NEVER mints; all hero /q loads carry `?demo=1`.

## Gotchas

Verification environment (all bit someone this session):

- Shared debug Chrome (launcher script ONLY:
  `pwsh -NoProfile -File scripts/launch-chrome-debug.ps1 -Url about:blank`)
  runs devicePixelRatio **1.1** — emulate dims land in physical px. Pass
  target×1.1 (1920 CSS → `2112x1188x1`) and verify `innerWidth` after.
- **Occluded window = frozen paint.** Canvases and CSS transitions hold while
  the window is backgrounded; a loaded phone screen screenshots BLACK. Bit
  the orchestrator on 2026-08-05 (false alarm). `SetForegroundWindow` via
  PowerShell user32 before any animated capture.
- **DevTools MCP `click` ignores CSS `transform: scale()`** on the iframe —
  clicks land at target/scale and can't reach the bottom ~6% of the screen.
  Drive in-phone clicks either at a window size where scale = 1.0 (3840×1553
  in R11) or by dispatching events into the same-origin
  `iframe.contentDocument`.
- **Never toggle isMobile emulation on a live page** — collapses the /q
  animation pane (historic 366×0 false alarm).
- Screenshots always `format: "webp", quality: 70`. Mid-beat frames by
  scrubbing `document.getAnimations()` (pause + currentTime), not racing.

Code traps:

- **Svelte 5 `store_rune_conflict`**: a variable named `state` alongside
  `$state` miscompiles silently (page renders fine!) — caught only by
  `check`. Hit in R12's tile work. See memory
  `reference_svelte5_store_rune_conflict`.
- **Escape ≠ the X.** The viewer's Escape reaches `onClose` through the /q
  host's orchestrator, not the shell button — hiding chrome without fencing
  `closeViewer` leaves the keyboard navigating the phone away (R13).
- The shell `embedded` prop is the ONE sanctioned demo-trim seam; the shell
  contract test (`tests/unit/sequence-viewer-shell-contract.test.ts`, 19
  tests) must stay green and unmodified. Run it with
  `--config tests/config/vitest.config.ts` or it dies on `window is not
  defined` (env, not the test).
- Hidden > dead: never render a control that ignores clicks; remove it.
- `?demo=1` suppresses 4 things by construction (PostHog init, beginScanVisit,
  card_scanned ledger, root $pageview) — see QScanPage.svelte comments.

Shared-checkout hazards (both happened this session):

- A parallel session **committed R10's working-tree files first** under its
  own message (`5a60ff7058`) — content was exactly the verified work; no
  history rewrite per the multi-agent rule.
- A parallel session ran **`git pull --rebase --autostash` mid-R13**,
  stashing the executor's edits and detaching HEAD; recovered byte-identical
  from the autostash commit. The leftover `stash@{0}` remains (In flight).
- The spec doc is shared across concurrent executors: check
  `git status --short` on it before editing; append your round entry after
  the latest.
- Concurrent-session HMR churn remounts the hero and throws
  `[HMR] State/URL desync` — noise, not product. Reload before judging.
