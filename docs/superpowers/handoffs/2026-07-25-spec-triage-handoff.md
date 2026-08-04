# Handoff — Spec Triage + Orientation Fix (2026-07-25)

**For:** an Opus session asked to check this work and make the final calls.
**From:** Opus 5 session `170206dc`. Caveman mode was on; ignore that, it's cosmetic.

Two deliverables this session:

1. **One committed code fix** (`9c064a8255`) — a real orientation-derivation bug.
   Verify it.
2. **A 155-spec triage ledger**, nothing applied — `2026-07-25-spec-triage-ledger.md`.
   Adjudicate it.

Plus **one unfixed live production defect** found mid-audit. Read that first.

---

## 0. Unfixed and live: 42 of 47 notation letter images are broken in production

> **Retired 2026-08-02:** The standalone notation letter index, its baked
> images, sitemap entries, generator, and active design spec were removed. The
> Composer Guide Codex remains the supported interactive letter catalog. The
> material below is retained only as the original incident record.

Highest-priority item in this handoff. Not fixed — I found it while auditing and
did not want to bundle an unrelated change into the orientation commit.

`sitemap.xml` advertises 47 letter images to Google Images. Five exist. The other
42 return **HTTP 200 with `content-type: text/html`** — SvelteKit's SPA fallback,
not an image. A 200 serving the wrong content-type is worse than a 404: the
crawler indexes the promise and fetches garbage.

Reproduce:

```bash
curl -s https://tkaflowarts.com/sitemap.xml | grep -c '<image:loc>'   # 47
ls static/notation/letters/*.png | wc -l                              # 5
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" \
  https://tkaflowarts.com/notation/letters/kinetic-alphabet-letter-a.png  # 200 image/png
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" \
  https://tkaflowarts.com/notation/letters/kinetic-alphabet-letter-e.png  # 200 text/html
```

Root cause: `scripts/bake-notation-images.ts` exists but is **not in the `build`
script** (`package.json:28`). Someone ran it once for a/b/c/d/w and committed the
output. Everything else drifted.

Fix: run the bake for all 47 canonical letters, commit the output, and wire the
script into the `build` chain so it cannot drift again. Owning spec:
`active/2026-07-14-image-seo-google-images-design.md` (BANNER in the ledger).

---

## 1. Verify the committed fix — `9c064a8255`

**Claim:** `@tka/render-core` and `mcp-server` both normalized the start
orientation with a blanket `.toLowerCase()`. The rotation cycles are keyed
camelCase, so every interradial (`clockIn`) and centric (`centerN`) orientation
missed every lookup. Two failures at once — the turn silently no-opped, and an
invalid token (`centern`) escaped into stored data and the camelCase-keyed
rotation maps. Radial (`in`/`out`/`clock`/`counter`) was unaffected.

Files changed (3, scoped commit):

- `packages/render-core/src/calculations/orientation.ts` — added
  `canonicalOrientation()`, routed both normalization sites through it.
- `mcp-server/src/core/orientation-calculator.ts` — deleted ~300 lines of
  duplicated math, now a delegating shim. `Orientation` widened 4 → 16 values,
  kept as a const object so value and type usage stay source-compatible.
- `tests/unit/codec/deriver-parity.test.ts` — sweep all 16 orientations (was 4),
  cover `@tka/render-core`, lock two regressions.

### Fast check

```bash
npx vitest run tests/unit/codec/deriver-parity.test.ts   # expect 6 passed
```

### Independent check — rebuild the harness

The behavioral harness lived in scratch and is gone. Recreate it if you want a
first-principles check rather than trusting my test:

```ts
// save anywhere, run: node_modules/.bin/tsx <file>
import { calculateEndOrientation as mcp } from "E:/tka-platform/mcp-server/src/core/orientation-calculator.js";
import { calculateEndOrientation as app } from "E:/tka-platform/src/lib/shared/render/core/calculations/orientation.js";
import { calculateEndOrientation as rc  } from "E:/tka-platform/packages/render-core/src/calculations/orientation.js";
console.warn = () => {};
for (const startOrientation of ["centerN", "clockIn"]) {
  for (const turns of [0, 0.5, 1, 1.5]) {
    const i: any = { motionType: "pro", turns, rotationDirection: "cw",
                     startLocation: "n", endLocation: "e", startOrientation };
    console.log(startOrientation, turns, app(i), rc(i), mcp(i));
  }
}
```

Expected now: all three agree, and a turn advances the cycle
(`centerN` → `centerE` → `centerS` → `centerW`). Before the fix, `rc` and `mcp`
returned `centern` for every turn value.

### The trap that cost me 20 minutes — know it before you re-verify

`packages/render-core/package.json` maps `types` → `./src/index.ts` but
`import`/`default` → `./dist/index.js`. **Typecheck reads source; runtime reads
dist.** After fixing the source, `mcp-server` still measured 100% wrong until
`npm run build:packages`. If your harness disagrees with mine, rebuild first.

`mcp-server` has its own `dist/` too — `cd mcp-server && npm run build`. Both are
already rebuilt as of this commit.

### What I did NOT do

- **No `Restart-Service`.** The live MCP service still serves the previous build.
  `FlowArtsKnowledgeMCP` is Running on DESKTOP-TJLLGPG, port 3333 answering.
  Needs elevation:
  ```
  Restart-Service FlowArtsKnowledgeMCP
  ```
- **No push.** Pushing `main` triggers the Cloudflare Pages auto-deploy, and
  `active/2026-07-23-first-session-exception-remediation.md` is explicitly parked
  waiting for a clean deploy window. My commit is safe in isolation; the deploy
  it triggers is a separate decision.
- **Reverted one line of my own.** I had added `canonicalOrientation` to
  `packages/render-core/src/index.ts`'s public exports, then backed it out —
  that file is dirty from another session (their SVG-color exports). Not needed
  for the fix. Worth re-adding once their work lands, so app code can
  canonicalize before persisting.

### Scope I deliberately did not take

The owning spec, `active/2026-05-30-deriver-collapse-design.md`, is a 4-sub-job
`L`. I fixed only the live defect. Two related things remain and are worth your
call:

- **A 5th orientation copy exists** — `src/lib/shared/pictograph/prop/services/
  orientation-calculator.ts`. It delegates correctly, so it is not a bug, but its
  `calculateEndOrientation` wrapper is 25 lines of ceremony: a double cast
  (`as unknown as Orientation`) between **two structurally identical 16-value
  types**, an unused `_color` param forced on ~10 call sites, a dead null check
  whose message says "cannot be None" (a Python port artifact), and a hardcoded
  `propType: STAFF`. I verified with `tsc` that the two `Orientation` types are
  mutually assignable, so the cast is unnecessary.
- **The real root cause is two duplicate `Orientation` declarations** —
  `pictograph-enums.ts` (286 consumers) and `render/core/types.ts` (17). Collapse
  direction is forced: render-core is the shared package, so keep its union
  canonical and make `pictograph-enums`' exported *type* an alias of it, retaining
  the const object for value access. That is a 1-line change; all 286 imports keep
  working. Then the wrapper's reason to exist evaporates.

### An unresolved contradiction — do not paper over it

The two files disagree on TKA level labels:

- `render/core/types.ts:51` — centric orientations are **Level 5**
- `pictograph-enums.ts:109` — centric orientations are **Level 4**
- `pictograph-enums.ts:90` says cardinal is "Level 1-5", contradicting its own :106

I could not settle this. The Flow Arts MCP domain tools were unreachable all
session (only `authenticate`/`complete_authentication` exposed), and per
`.claude/rules/mcp-ground-truth.md` I will not assert TKA canon from a code
comment. **Resolve via MCP, then fix whichever comment is wrong** — one of them is
currently teaching future readers the wrong level.

To restore MCP: Austen runs `/mcp`, selects "claude.ai Flow Arts Knowledge",
authorizes. Interactive OAuth; an agent cannot drive it. That also unblocks
`active/2026-07-03-fable-loop-detection-audit-fixes-design.md`.

---

## 2. Adjudicate the triage ledger

`docs/superpowers/handoffs/2026-07-25-spec-triage-ledger.md` — all 155 specs in
`active/` + `backlog/`, one verdict each.

```
SHIP 55   ARCHIVE 18   BANNER 37   KEEP 16   BLOCKED 12   REFERENCE 17   = 155
```

**73 closeable** (SHIP + ARCHIVE). Roughly half the queue was noise.

Two rows in the ledger are deliberate cross-references and appear twice —
`sequence-viewer-redesign-notes.md` (ARCHIVE + REFERENCE, it moves with its
parent) and `2026-04-15-sequence-viewer-redesign-design.md` (BANNER row points at
its ARCHIVE row). Unique specs still total 155; verify with:

```bash
grep -oE "^\| (active|backlog)/[a-z0-9./-]+\.md" \
  docs/superpowers/handoffs/2026-07-25-spec-triage-ledger.md | sort -u | wc -l
```

**Nothing has been applied.** No moves, no re-scores. That was deliberate: 72
file moves plus 44 banner edits is a large batch, several entries need a product
decision, and the working tree carries several other sessions' uncommitted work.

Read the ledger's **"Method + confidence"** and **"Known detector blind spots"**
sections before acting on any single row. The short version: verdicts are
agent-reported with cited evidence (tier B), not controller-verified, and this
repo's kebab-case rename plus package extractions make "deliverables missing" an
unreliable archive signal on its own. **Glob the basename before archiving.**

Suggested order:

1. **SHIP** — lowest risk, highest signal. Spot-check ~5, then batch the `git mv`.
2. **ARCHIVE** — spot-check each; several are backed by an explicit deletion or
   revert commit (cited in the ledger), which is strong. `creators-to-social` is
   dirty from another session — coordinate.
3. **BANNER** — the actual rebuild hazards. Highest value per edit even though
   nothing moves. Two are near-certain ARCHIVE instead: `gallery-front-door-phase1`
   (zero named files ever existed) and `sequence-viewer-redesign` (architecture
   rebuilt twice).
4. **BLOCKED** — set `depends_on: "external: …"`. Seven are code-complete behind
   Austen's iPhone or a signed-in session; that's the verification jam, now
   precisely enumerated.
5. **REFERENCE** — decide whether audit logs and ledgers belong in `specs/` at
   all. They're currently scored by `/queue` as if they were work.

12 escalated product decisions are listed at the end of the ledger.

### Two findings that rhyme with the orientation bug

Both are complete, tested implementations that are **never called**:

- `active/2026-06-21-personal-museum-design.md` — full data/service/state/component
  layer, all tested, both hard rendering seams wired. **No `/my-museum` route**, so
  the feature is unreachable.
- `active/2026-05-12-anatomical-ik-constraints-design.md` — swing-twist constraint
  math written and unit-tested, **imported only by its own test file**. Avatars
  still produce the anatomically-impossible poses it was written to fix.

Same shape as the orientation bug: the work exists, the wiring doesn't, and no
test covers the gap. Worth a sweep for more of these.

---

## 3. Tooling built this session

`scripts/spec-drift-detector.cjs` (committed earlier today) — compares what each
spec *says* against what the repo *does*. Read-only, exits 1 on actionable drift.
`/queue drift` documents it; `/queue` now drift-checks its pick before acting.

**Its limits are documented in the ledger and they are real.** It rated
`effects-preset-data-consolidation` `OK` when that spec's own body says
"Implemented 2026-06-12", and reported `festival-hub` as 100% missing when the
module is live. It is a shortlisting tool, not an oracle. Reading found ~40
closures it could not see.

## 4. Repo state

- `main`, working tree carries several other sessions' uncommitted changes —
  including `packages/render-core/src/index.ts`, `rotation-maps.ts`,
  `package.json`, and ~14 `mcp-server/src` files. **Commit with explicit
  pathspecs** (`.claude/rules/commit-only-your-own-changes.md`).
- Earlier this session, 12 specs were moved to `shipped/` and 5 given DRIFT
  banners across 5 commits. Directory counts then: `active=106 backlog=49
  shipped=367 archived=29`. The ledger's 155 excludes those 12.
- `npm run check`: 0 errors, 4 pre-existing CSS warnings in
  `HeroCarouselSection.svelte`. `mcp-server` tsc clean.
