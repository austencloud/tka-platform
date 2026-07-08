# Shop & Release Strategy — Design Spec

**Date:** 2026-07-08
**Status:** Approved 2026-07-08 — build track next (all decisions D1–D4 locked, §9)
**Supersedes:** the narrower planned `2026-07-08-loop-deck-lineup-design.md` (deck lineup folded in here as §5)

---

## 1. Vision

The TKA shop is the monetization path (the Scribe subscription was shelved
2026-07-06 — see `project_premium_philosophy`). It sells physical choreo-card
decks, a printed guide, and a free reference sheet, across **two shelves**:

- **Beta shelf** — home-printed on Austen's industrial guillotine cutter,
  warehoused ahead, ships same-day. Lower price. This is also the physical
  give-away pile for in-person seeding at jams/events (a real distribution
  channel in a community culture, not dead stock).
- **Finished shelf** — professionally produced (MPC decks, saddle-stitch/perfect-bound
  guide), pre-order → Kickstarter. Higher price. Maps to the existing Kickstarter
  2-phase plan (laminated proof run → pro MPC — see the `kickstarter` skill and
  `project_physical_merch_store`).

The distinction the user wants — **beta product vs finished product** — is these
two shelves. Beta validates demand and gets product in hands now; finished funds
the volume run.

---

## 2. Price Ladder

Guide-included is a flat **+$15** on either shelf. Standalone guide is $15 beta /
$20 prod — so buying the guide *with* a deck on the finished shelf is a built-in
$5 attach discount (drives guide attach, which is the thing that makes the system
click and drives word-of-mouth).

| Product | Beta | Finished |
|---|---|---|
| Laminated 19-sequence sheet | **FREE** (giveaway / pack-in) | **FREE** |
| Master guide (book, standalone) | $15 | $20\* |
| LOOP deck — poker, bare | $25 | $35 |
| LOOP deck + guide | $40 | $50 |
| Tarot-size deck — bare | $35 | $45 |
| Tarot deck + guide | $50 | $60 |

- Decks carry **+$10** beta→finished (quality upgrade premium).
- Guide add-on is **+$15** flat, both shelves and both sizes.
- `*` Finished guide is pro-printed. What Austen hand-makes (fold + staple through
  spine) is **saddle-stitch** — the standard booklet bind, mechanized. Vendors:
  **Mixam, Lulu, PrintNinja** (~$3–8/unit at small runs; perfect-bound if the
  guide is thick). Beta guide stays hand-stapled; finished guide moves to a
  booklet printer. No new tooling — a vendor upload.

**D1 — LOCKED:** flat +$15 guide-included, with the baked-in $5 finished-shelf
attach discount. Confirmed 2026-07-08.

---

## 3. Catalog

Product families:

1. **LOOP decks** — the configurable core (see §5 for the buildable lineup).
   Two sizes: poker (2.5"×3.5", MPC-compatible — `project_card_size_decision`)
   and tarot (larger, premium).
2. **Master guide** — ONE comprehensive single-source guide covering the whole
   system (currently mid-rewrite — `project_guide_single_source`,
   `docs/superpowers/specs/2026-06-21-guide-rebuild-tracker.md`). Sold both
   standalone and bundled with any deck. Not a per-deck booklet.
3. **Laminated 19-sequence sheet** — free quick-reference. Hand it out, pack it
   in. Marketing, not a SKU.

Every deck ships with a **+1 explainer card** (see §5.3): 54 sequence cards + 1
card stating what the buyer holds — a curated 54-card representative slice of the
[flavor] LOOP family — and how it relates to the full enumeration of the system.
Doubles as the transparency note: the deck itself tells the buyer it's a
representative selection, not the complete set. Physical deck = 55 cards.

Presentation (from earlier brainstorm, approach A): the shop surfaces the deck
family as a **single configurable product** with dials (loop-type / length /
level / size / blend) rather than N flat SKUs, so "lots of products" reads as one
simple thing. Blend feature: up to 2 styles, even split. Shop UI build is a
**separate spec** (§7).

---

## 4. Production & Inventory

- **Warehouse the buildable decks ahead**, both sizes. Capital is trivial
  (~$200 paper + ink for the full buildable set). The pile IS marketing.
- **Guide print timing:** warehouse decks now (enumerated sequences are frozen
  math), but **hold the guide print run until the rewrite settles** — pre-printing
  a pile of guides mid-rewrite = obsolete booklets.
- **Pilot (Phase 0):** two buyers already committed (~1 week ago). Fulfill them
  now, off-platform if needed — validate packaging, ship weight/rate, and
  in-hand feel before scaling the pile.

**D2 — LOCKED:** packaging = foldable deck boxes from existing on-hand stock (use
up current supply); a better box is a later upgrade, not a launch blocker.

---

## 5. Deck Lineup — Buildable vs Blocked

Grounded against `scripts/enumerate-deck.cjs` and `.claude/skills/deck/deck-reference.md`.

### 5.1 The user's ideal matrix

7 loop-type flavors × {8-count, 16-count} × {L1, L2-T1}, **all quartered**:

rotated · mirrored · inverted · swapped · mirrored+inverted · mirrored+swapped ·
mirrored+inverted+swapped.

### 5.2 Enumerator reality

**Quartered forces rotation** (`enumerate-deck.cjs:85-94`). `QUARTERED_CAPABLE` =
`rotated, rotated_swapped, rotated_inverted, mirrored_rotated,
mirrored_inverted_rotated, mirrored_rotated_inverted_swapped`. Everything else is
**halved-only** (`deck-reference.md:22`). A quarter-turn closure needs rotation in
the composite; pure mirror/invert/swap close at half (2-fold), not quarter (4-fold).

The user's 7 flavors map to quartered composites as:

| User flavor (quartered) | Enumerator loopType | Quartered-capable? |
|---|---|---|
| rotated | `rotated` | ✅ |
| mirrored | `mirrored_rotated` | ✅ |
| inverted | `rotated_inverted` | ✅ |
| swapped | `rotated_swapped` | ✅ |
| mirrored+inverted | `mirrored_inverted_rotated` | ✅ |
| mirrored+swapped | `mirrored_rotated_swapped` | ❌ **not in capable set** |
| mirrored+inverted+swapped | `mirrored_rotated_inverted_swapped` | ✅ |

→ **6 of 7 quartered flavors buildable; mirrored+swapped-quartered is a gap.**

**L2-T1 is not built** (`enumerate-deck.cjs:202-206`): the CSV is all 0-turn;
turn-allocation for L2/L3 is *"deferred for now."* Only one bespoke L2 deck exists
(`scripts/seed-l2-quartered-rotated-deck.cjs`, 10 cards). The entire L2 half of the
matrix is **blocked** pending enumerator turn-allocation.

**Counts aren't 54** (`deck-reference.md:65-83`):

| Slice · length | Raw dedup count |
|---|---|
| quartered 8-count (seed 2) | 128 |
| quartered 16-count (seed 4) | 27,892 |
| halved 8-count (seed 4) | 22,595 |
| halved 4-count (seed 2) | 47 |

A shippable ~54-card deck needs a **curation pass** (128→54, or 27,892→54). No such
tool exists — raw enumeration is either too small, or thousands.

**`--twin` flag** (`enumerate-deck.cjs:49`, `:1062-1194`) pairs each card with its
mirror-swap twin — a cheap way to fold a "mirrored" feel into a rotated deck and
roughly double its count.

### 5.3 What ships now

- **L1, 0-turn, quartered, 8-count**, the 6 capable flavors — each curated from
  ~128 down to a shippable deck.
- Optionally `--twin` editions to double/vary a deck.
- Existing halved-rotated decks already enumerated (`deck-reference.md:74-84`).

### 5.4 What's blocked (→ §6 roadmap)

- All **L2-T1** decks (turn-allocation not implemented).
- **mirrored+swapped quartered** (`mirrored_rotated_swapped` not capable).
- **16-count** decks (27,892 raw → heavy curation).
- The **constrain-to-54 mechanism** (§6.1) — tune enumeration params to emit ~54.

**D3 — LOCKED: constrain enumeration to land at ~54.** Not post-hoc curation —
tune enumeration params (start positions / hand-path family filter / seed length)
so the DFS emits ~54 directly per flavor. Plus a **+1 explainer card** per deck
(§3). 54 sequence cards + 1 explainer = 55-card physical deck.

---

### 5.5 RESOLVED LINEUP (2026-07-08 — supersedes §5.2–§5.4)

The "all quartered" constraint fought the grain: mirror LOOPs are natively
**halved**, and forcing them quartered via rotation composites multiplies length
(see the mirror-length finding below). Decision: use each flavor's **native
slice** — `rotated` is natively quartered; the other 6 are halved. This also
unlocked the 7th flavor (`mirrored_swapped`) the quartered-capable set lacked.

**Beta lineup — 7 flavors, all L1 (0-turn), all 8-count, all curated to 54:**

| Flavor | loopType | slice · seed | raw pool |
|---|---|---|---|
| rotated | `rotated` | quartered · 2 | 128 |
| inverted | `inverted` | halved · 4 | 22,595 |
| swapped | `swapped` | halved · 4 | 21,890 |
| mirrored | `mirrored` | halved · 4 | 26,238 |
| mirrored+inverted | `mirrored_inverted` | halved · 4 | 26,238 |
| mirrored+swapped | `mirrored_swapped` | halved · 4 | 25,806 |
| mirrored+inverted+swapped | `mirrored_swapped_inverted` | halved · 4 | 22,595 |

Verified distinct (executed the shared skeleton through each executor — no two
collapse to the same deck; worst overlap 24/128). Counts from `--dry-run`
2026-07-08.

**16-count:** only the 3 rotated-family flavors (quartered seed 4 = 27,892 →
curate). Mirror 16-count = halved seed 8, infeasible (~17^8). So mirror flavors
are 8-count only until a different mechanism exists.

**Mirror-length finding (why quartered mirror blows up):** the legacy
`loopSpecFromLegacy` (`loop-spec.ts:334-339`) applies one `--slice` period to
*every* component, so `mirrored_rotated --slice quartered` sets ROTATED=4 AND
MIRRORED=4 → ROTATED expands ×4, then the MIRRORED FusedExecutor expands ×4
again = ×16 → seed 2 = 32 beats (`spec-executor.ts:47-68`). Mixed periods
(½mirror × ¼rotate = ×8 = 16-count) are only expressible via the per-component
`LOOPSpec` (`executeSpec`, `loop-spec.ts:73`), NOT the CLI flag. Mirror+rotate
composites at controlled lengths are a **parked future option**.

### 5.6 BUILD STATUS (2026-07-08)

All 7 curated decks **seeded + verified** in production `catalogs/`:
`l1-quartered-rotated-8beat-c54` + `l1-halved-{inverted,swapped,mirrored,
mirrored-inverted,mirrored-swapped,mirrored-swapped-inverted}-8beat-c54`.
Each verified: 54 docs, 8-count, `totalSequences`=54, family sum=54, anti motions
flip orientation (0 bad).

Curation = `enumerate-deck.cjs --curate N`: execute + apply the continuous
reversal filter FIRST, then select N survivors by even (family × start) coverage.
(Curating *pre*-filter was a bug — the filter then decimated the pick to 3–35;
fixed via the seed-path pre-pass.)

✅ **Content caveat RESOLVED (2026-07-08)** — `inverted` and `mirrored` were
degenerate under the continuous filter (0 antispin, only ~99–106 survivors)
because inversion/mirroring flips prop spin at the transformation seam →
reversal → dropped. Fix: `enumerate-deck.cjs --allow-reversals` keeps the
naturally-reversing sequences and marks their reversals via the canonical
`deriveReversals` detector (prop channel = dot channel), because `catalog-loader`
TRUSTS stored reversal flags (it only derives when they are absent, and the
enumerator always writes them). This is NOT the reversal-pattern workflow — that
imposes designed patterns; here the reversals are intrinsic to the LOOP. Verified:
inverted anti=170, 51/54 cards carry dots; mirrored anti=60, 49/54 carry dots.
The other 5 flavors stay continuous (no seam reversal, or the composite flips
cancel).

Uncommitted: `enumerate-deck.cjs` (the `--curate` / `--no-write` additions).
Explainer card still lands at the deck-release/compose layer, not the catalog.

## 6. Enumerator Roadmap (unlocks catalog depth)

Ordered by leverage:

1. **Constrain-to-54 mechanism** — tune enumeration params (start positions /
   hand-path family filter / seed length) so each flavor emits ~54 sequences
   directly, no post-hoc curation. Add the +1 explainer card at seed time. Unlocks
   a shippable deck from every buildable variant. **Highest leverage — build first.**
2. **L2-T1 turn allocation** — generate 1-turn motion variants so the L2 half of
   the matrix enumerates generally (not one bespoke script per deck).
3. **`mirrored_rotated_swapped` quartered support** — add to `QUARTERED_CAPABLE`
   + its validation set, closing the 7th flavor.
4. **16-count viability** — only meaningful behind (1); 27,892 → 54 is pure
   curation.

Note: the enumerator writes to Firestore collection **`catalogs/{deckId}`**
(`enumerate-deck.cjs:884`, `:1251`), not `decks/` as `deck-reference.md:27`
implies (reference is stale on this).

---

## 7. Shop UI (separate spec — not built here)

Current shop is a flat product grid (`src/lib/features/store/StorePage.svelte`).
The two-shelf model needs:

- Two shelves (beta / finished pre-order) in the storefront.
- Deck **configurator** (loop-type / length / level / size / blend dials) →
  resolves to a deck SKU / Stripe price.
- Bundle toggle (deck / deck+guide).
- Reuse `SegmentedControl`, `FilterChipBase`, `CardMockupPreview` (per
  `never-hand-roll` / `chip-primitives`).

This is its own design + implementation pass after the strategy is approved.

---

## 8. Phased Rollout

- **Phase 0 — Pilot (now):** fulfill the 2 committed buyers off-platform.
  Validate packaging, shipping, feel.
- **Phase 1 — Beta shelf:** warehouse + list **all 6 buildable quartered flavors**
  (L1, 8-count, constrained to ~54 + explainer card; optional twins) — build them
  all at once (D4). Free sheet + foldable deck box with every deck. Beta prices.
  Requires the constrain-to-54 mechanism (§6.1).
- **Phase 2 — Finished shelf / Kickstarter:** pro MPC decks + pro guide, pre-order.
  Finished prices. Requires enumerator L2 unlock (§6.2) for full-matrix depth and
  the guide rewrite settled.

---

## 9. Decisions (all resolved 2026-07-08)

- **D1 ✅** flat +$15 guide-included ($5 finished-shelf attach discount baked in).
- **D2 ✅** foldable deck boxes from on-hand stock; better box is a later upgrade,
  not a launch blocker.
- **D3 ✅** constrain enumeration to ~54 + a +1 explainer card per deck (55-card
  physical deck).
- **D4 ✅** build all 6 buildable quartered flavors at once for beta.

---

## Grounding / references

- `scripts/enumerate-deck.cjs` — `QUARTERED_CAPABLE` (`:85`), halved-only reject
  (`:91`), L2 deferral (`:202-206`), `--twin` (`:49`, `:1062`), Firestore
  `catalogs/` path (`:884`, `:1251`).
- `.claude/skills/deck/deck-reference.md` — halved-only list (`:22`), scaling
  table (`:65`), current decks (`:74`).
- `scripts/seed-l2-quartered-rotated-deck.cjs` — the only bespoke L2 deck.
- Memory: `project_physical_merch_store`, `project_premium_philosophy`,
  `project_card_size_decision`, `project_guide_single_source`,
  `reference_halved_loop_type_compatibility`.
- `kickstarter` skill — Phase 1/2 production plan.
