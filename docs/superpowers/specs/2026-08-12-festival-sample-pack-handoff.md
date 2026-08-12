# Festival Sample Pack + /start Funnel — Handoff (2026-08-12)

Written for a fresh agent (ChatGPT / Codex CLI) with zero context. Design spec:
`docs/superpowers/specs/2026-08-11-festival-sample-pack-design.md`.

## Mission

Austen is at a festival this weekend and needs printed materials by **Friday
2026-08-14**. The deliverable is a home-printed 9-up duplex sheet: **1 signup
card + 8 sample choreo cards**, cut into poker-size cards and handed out. The
signup card's QR lands on `tkaflowarts.com/start`, a pre-signup pitch page that
asks for an account before dropping anyone into the app, with a deadpan
guest-account escape hatch and PWA install instructions on the success screen
(no iOS build exists; the App Store was ruled out for the 48-hour window).

The funnel page, the signup card art, and the 9-up sheet script are **done and
on main**. What remains is choosing the eight sample cards, rendering them, and
printing the sheet.

## Done — verified

| What | Commit | Evidence |
|---|---|---|
| `/start` funnel page (signup / member / guest states, PWA install sheet, success beat) | `42bea4a003` | Screenshotted at 7 viewports (1920×1080, 2560×1440, 3840×2160, 1440×900, 820×1180, 960×412, 375×667) plus the guest flow and install sheet; `npm run check` → "found 0 errors and 0 warnings"; full `npm run build` green |
| `/start` renders on demand instead of prerendering | `c602e277e5` | Build #1 failed with `Cannot access url.searchParams on a page with prerendering enabled` (thrown from `SocialAuthCompact`, which reads `page.url.searchParams` for in-app-browser detection); adding `export const prerender = false` in `+page.ts` made the build pass |
| Signup card art + `/test/signup-card` harness | `018ea07638` | QR machine-decoded, not eyeballed: sharp raw RGBA → zxing-wasm `readBarcodes` returned exactly `["https://tkaflowarts.com/start"]`; `npx vitest run tests/unit/qr-code-generator-cell-warm.test.ts` → 4 passed |
| 9-up duplex sheet script | `247b5f148e` | Ran end-to-end against a 9-cell manifest; PDF rendered and read: 3×3 poker grid, shared cut lines, back page column-mirrored. Proof at `docs/superpowers/specs/festival-sample-pack/evidence/festival-pack-9up-proof.pdf` |
| Signup card restyled home-printer friendly | `1166a24918` | Rebuilt on `wrapContentInCardFrame` (white content, stripe border) instead of the dark full-bleed info-card look; QR re-decoded after the restyle → same exact URL; front/back PNGs at `docs/superpowers/specs/festival-sample-pack/evidence/` |
| Production `/start` responds | (deploy of the above) | `curl -o /dev/null -w "%{http_code}" https://tkaflowarts.com/start` → **200**, 55,319 bytes |

All five commits are on `main` and pushed (`git branch -r --contains 1166a24918`
→ `origin/main`).

`npm run type-check` reports 85 errors repo-wide; **zero** are in any file
touched here (grepped by path). Those are the known type-gate-repair backlog —
see `project_type_gate_repair` in memory. Do not treat them as regressions.

## Believed done — unverified

- **Production `/start` renders correctly.** The route returns 200 and 55 KB of
  HTML, but the page is client-rendered (`prerender = false`), so `curl` cannot
  confirm the signup UI paints. Nobody has loaded the production URL in a
  browser. Verify with Chrome DevTools MCP before Austen prints QR codes
  pointing at it — a live-but-broken page is the one failure that ruins the
  whole pack.
- **Cut alignment on a real printer.** The 9-up geometry is arithmetically
  correct (612×792 pt page, 3×3 of 180×252 pt = 2.5in × 3.5in, margins 36/18 pt,
  36 px bleed cropped off each 822×1122 canvas) and looks right on screen, but
  no one has printed and cut a sheet. Duplex back-page column mirroring assumes
  **long-edge** binding.

## In flight

Working tree on `main`, uncommitted, **belonging to this work**:

- `scripts/festival-pack-census.cjs` — new. Counts candidate sequences per pack
  slot from both data sources (details below).
- `docs/superpowers/specs/festival-sample-pack/evidence/` — new. The signup card
  front/back PNGs and the 9-up proof PDF, copied out of a session scratchpad
  that will be garbage-collected.
- `docs/superpowers/specs/2026-08-12-festival-sample-pack-handoff.md` — this doc.

Uncommitted files in the tree that are **NOT part of this work** (another
session's deck-print / print-preview changes — do not stage them):
`deck-print-model.ts`, `deck-print-model.test.ts`, `deck-production-state.svelte.ts`,
`CopiesSelect.svelte`, `print-preview-cache.ts`, `deck-ai-summary.ts`,
`print-pdf-cache.ts`, `services/__tests__/print-pdf-cache.test.ts`. Commit with
explicit pathspecs only (`git commit -m "..." -- <paths>`); the index is shared
across agent sessions here.

## Loose ends (ranked)

### 1. Resolve the card-list constraint, then pick the 8 cards

Austen asked for **50 candidate 8-card lists** to compare. Under the constraint
the first proposal used — every LOOP word made only of Type 1 letters (A–V),
Level 1 — that is **arithmetically impossible**. Run
`node scripts/festival-pack-census.cjs --catalogs` (about 4 minutes cold, then
cached):

```
slot                   total  pureT1  <=1 non-T1
mirrored 16                2       2           2     JIDCKIEC, "Sequence 12:34:48 AM"
mirrored 8                52       1           1     DJII
rotated 16             18092       3           3     ALFALGGF, NROT, RRRS
rotated 8                 77       7           7     MVNU, OT, QT, RT, SN, SOTR, VPUQ
mirrored_swapped 8        56       3           3     FALG, GELIGELI, DCCJDCCJ
mirrored_swapped 16        8       0           0
mirrored_inverted 8       51       0           0
mirrored_inverted 16       0       0           0
```

One usable all-Type-1 mirrored-8 word exists. Zero all-Type-1 mirrored/inverted
words exist at any length. Fifty distinct lists cannot be built.

**The constraint is probably wrong, and that is the thing to check first.**
Austen's actual words were: *"2 VTG cards that teach basic Type 1 letters, max
turn intensity 2."* Type 1 was attached to the **VTG/TnD teaching cards only**.
The prior proposal generalized it to all six LOOP slots as a legibility
heuristic that Austen never asked for. Drop it from the LOOP slots and the pools
become 52 / 18,092 / 77 / 56 / 51 — ample for 50 varied lists, with **mirrored
16-count the single real bottleneck (2 candidates repo-wide)**.

Ask Austen to confirm, then generate the 50 lists varying across: loop word,
start position (alpha / beta / gamma), grid mode, period, turn intensity on the
TnD pair, and prop type. Options if he wants the mirrored-16 slot to vary too:
generate fresh LOOPs via the MCP `generate_loop_sequence` tool (they would need
releasing before print), or make the mirrored pair 8+8 with different words.

### 2. Confirm production `/start` in a browser

Chrome DevTools MCP, `https://tkaflowarts.com/start`, at least 375×667 and
1920×1080. This gates printing.

### 3. Render the 8 chosen cards and build the real sheet

Cards render through `PrintCardRenderer` (`renderFront` / `renderBack`); the
signup card has its own `renderSignupCardPair`. Write the nine front/back PNG
pairs to disk, list them in a manifest, and run:

```bash
node scripts/festival-pack-9up.cjs <manifest.json> <out.pdf>
```

Manifest shape: `{ "cards": [ { "front": "a.png", "back": "a-back.png" }, ...×9 ] }`,
in grid order left-to-right then top-to-bottom. Paths may be relative to the
manifest. Slot the signup card wherever Austen wants it in the 3×3.

### 4. Print, cut, and check one sheet before running the batch

## Decisions already made

Do not re-litigate these.

- **Pack composition** (Austen, 2026-08-11): 2 mirrored LOOPs (16-count and
  8-count), 2 rotated LOOPs (16 and 8), 2 VTG cards teaching basic Type 1
  letters at max turn intensity 2, 2 compound LOOPs (mirrored/swapped and
  mirrored/inverted).
- **PWA install instructions on the success screen**, not an App Store link.
  Austen: *"unless you think it's actually realistic to get it into the app
  store within 48 hrs"* — it is not; no iOS build exists.
- **Show all UI before calling anything finished** (Austen, 2026-08-11):
  *"yes. But I want to see the page first so show me everything UI related
  before we finish."* Every visual change goes to him as an image.
- **Home-printer friendly** (Austen, 2026-08-12): *"They links need to be home-printer
  friendly."* Cards are white-bodied with a stripe border — ink in the border and
  the QR only, never a full-bleed dark ground. This is why the signup card was
  rebuilt on `wrapContentInCardFrame`.
- **The 8-card proposal Austen liked** (his words: *"that 8 card list looks
  perfect"*), as the quality bar the 50 lists must match: JIDCKIEC (mirrored 16),
  DJII (mirrored 8), NROT (rotated 16), MVNU (rotated 8), AAAA Split-Same /
  Water and GGGG Tog-Same / Earth (the TnD pair at `uniform-1t`), FALG
  (mirrored/swapped), `BΦ-AΦ-` (mirrored/inverted).

## Gotchas

- **Never start the dev server on :5173.** It is Austen's, started from a button
  in Agent Hub that also carries the Cloudflare tunnel and pm2 supervision. If
  it is wedged, diagnose and ask him to press the button. Run your own on a free
  port and reap it in the same turn. `npm run dev` binds IPv6 (`vite --host ::`),
  so `curl https://localhost:5173/` returns `000` on a perfectly healthy server —
  use `curl -k -g 'https://[::1]:5173/'`.
- **`git push` on this repo takes minutes.** A pre-push hook builds the Android
  app from the pushed commit (`git archive` → native build). Two push attempts
  were killed by a 2–3 minute command timeout before one was run in the
  background and completed cleanly. Give it 10 minutes; check
  `git status -sb` rather than assuming failure.
- **pnpm does not hoist transitive deps.** `zxing-wasm` (used to machine-decode
  the QR) is not resolvable as `zxing-wasm/reader` from anywhere. Import it by
  its store path:
  `file:///E:/tka-platform/node_modules/.pnpm/zxing-wasm@3.1.0_@types+emscripten@1.41.5/node_modules/zxing-wasm/dist/es/reader/index.js`.
  `barcode-detector/pure` is a dead end in Node — it does strict `instanceof`
  checks and rejects plain ImageData-like objects. In-browser decoding via the
  Vite dev server is also a dead end: the WASM fetch is blocked.
- **`QRCodeGenerator`'s `shortCodeManager` is now optional.** URL-only consumers
  (like the signup card, which renders in a bare `/test` harness with no app
  shell) construct it with `new QRCodeGenerator()`. Sequence QRs still require
  the manager and throw a clear error without it. The signup card also passes
  `centerIcon: "none"`, which skips the green play badge and the forced "H"
  error correction — that badge belongs on QRs whose destination is a player.
- **`npm run check` (svelte-check) does not read plain `.ts` files.**
  `npm run type-check` is the gap-closer. Both are slow and memory-hungry; never
  run two at once machine-wide, and capture output to a log then grep it rather
  than re-running.
- **`vitest run --reporter=basic` fails to start** on vitest 4 ("Failed to load
  custom Reporter from basic"). Omit the flag; the default reporter is fine.
  This looked like a test failure and was not.
- **The catalogs are not what their names suggest.** `catalogs/*` in Firestore
  are machine enumerations whose words are overwhelmingly Greek/dash glyphs
  (`AAΣW-AAΣW-`, `Θ-W-αAΘ-W-αA`). Human-authored, plain-letter, beginner-legible
  words live in `static/data/snapshots/public-sequences.json` (the
  `publicSequences` export, 466 docs). Reading the catalogs needs
  `serviceAccountKey.json` at the repo root and takes minutes;
  `festival-pack-census.cjs` caches the dump under `scripts/.cache/`
  (gitignored) — delete that file to refetch.
- **The TnD variation authority is `static/data/hero/tnd-base-words.json`**
  (22 entries, 4 steps each, all `turns: 0`), not the path in older notes.
  `scripts/build-tnd-base-words.ts` is its generator. Turn intensity mapping
  lives in `scripts/seed-tnd-turn-decks.cjs:62-69` — 2:1 = 0.5, 3:1 = 1,
  4:1 = 1.5, 5:1 = 2, so "max intensity 2" means `uniform-2t` and the proposed
  `uniform-1t` is the 3:1 ratio.
- **"Previously printed" cannot be answered offline.** Release manifests live at
  `deckReleases/counter/manifests/{n}`. The only repo-side print record is
  `docs/superpowers/specs/2026-08-04-deck-insert-card-handoff.md:77-84`: Deck
  #003 shipped as Rotated · Quartered · 8-step · L1 · 1 turn · Diamond · Staff,
  54 cards. That shape's render path is proven; nothing else is.
- **`renderSignupCardFront` caches by theme and size** in module scope. Editing
  the renderer and re-rendering in the same page session returns the stale
  canvas — reload the harness.
