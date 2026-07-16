# LOOP Deck Order Fulfillment Runbook

**Scope:** a paid LOOP Deck or Deck Architect order → a printed, shipped deck.
**Verified:** 2026-07-16. The decode + generation legs of this runbook are
exercised end-to-end by `tests/unit/services/order-fulfillment-simulation.test.ts`
(all three order shapes, 8 slices, real pipeline — green). The browser legs
(render, export) and the live Stripe purchase have NOT been drilled yet; run
the fire drill below before announcing the shop.

---

## 0. How you learn an order exists

There is no admin orders UI and no custom email. Two signals:

1. **Stripe Dashboard** email notification for the payment (fastest).
2. The Firestore **`orders`** collection — the merch webhook writes one doc per
   completed checkout ([Firebase console → orders](https://console.firebase.google.com/project/the-kinetic-alphabet/firestore/data/~2Forders)).

The order doc is the source of truth for fulfillment. Fields you need:

| Field | Meaning |
|---|---|
| `customerEmail`, `shippingAddress` | Where it goes |
| `items[0].propType` | Buyer's print prop (absent = staff) |
| `items[0].loopPack` | Curated pack id (`mild` / `medium` / `spicy`) |
| `items[0].loopRecipe` | Deck Architect recipe string |
| `items[0].loopLevel/.loopLength/.loopFlavor/.loopCustom` | Configurator dials |
| `totalAmount` | Grand total actually charged (cents) |

Exactly ONE of pack / recipe / dials is present (pack XOR dials XOR recipe).

## 1. Decode the config into slices

Every order reduces to slices of `{count, flavor, level, steps, maxTurns?}`.

**Pack orders** — resolve against `LOOP_PACKS` in
`src/lib/features/store/domain/loop-config.ts` (the id is the contract; the
recipe lives in code):

| Pack | Slices |
|---|---|
| `mild` | 38× rotated L1 8-step · 8× rotated L1 12-step · 8× rotated L1 16-step |
| `medium` | 14× rotated L1 8 · 10× rotated L1 12 · 6× rotated L1 16 · 8× rotated L2 8 ≤1T · 6× rotated L2 12 ≤1T · 4× rotated L2 16 ≤1T · 6× mirrored-swapped L1 8 |
| `spicy` | 10× rotated L2 8 ≤2T · 8× rotated L2 12 ≤2T · 6× rotated L2 16 ≤2T · 6× rotated L3 8 ≤2T · 4× rotated L3 12 ≤2T · 7× mirrored-swapped L2 8 ≤1T · 7× mirrored-inverted L1 8 · 6× swapped-inverted L2 8 ≤1T |

(If the code's `LOOP_PACKS` ever disagrees with this table, the code wins.)

**Dial orders** — one slice: `count=54, flavor=loopFlavor, level=loopLevel,
steps=loopLength, maxTurns=loopCustom.maxTurns` (default 1 for L2+). `mix`
values mean you compose a spread in the spirit of the copy ("mostly Level 1 /
mostly eight-counts, a few that bite") — buyer never picked exact percentages.

**Architect orders** — `loopRecipe` is `count:flavor:level:steps[:maxTurns]`
segments joined by `;`. Decode with `parseRecipe` in `loop-config.ts`, e.g.
`18:rotated:2:8:1;12:mirrored-swapped:1:8;…`.

## 2. Translate each slice to Deck Releaser settings

Open **Choreo Cards → Deck Releaser**, mode **LOOP Sequences** (this is the
live-generation mode — it drives the same engine as the Generate panel; it is
NOT limited to the enumerated catalogs). One draw = ONE config, so a
multi-slice order is one draw per slice.

| Releaser control | Set to |
|---|---|
| Loop Type | slice flavor, hyphens read as the chip names (`mirrored-swapped` → Mirrored Swapped; `rewound` → Strict Rewound) |
| Level | slice level |
| Length | slice steps |
| Total cards | slice count |
| Turn intensity | slice `maxTurns` (leave 0 for Level 1) |
| Slice type | **quartered** for rotated-family flavors (mandalas), **halved** otherwise (non-rotated coerces to halved anyway) |
| Prop | the order's `propType` on BOTH hands |
| Notes/footer | order-specific edition text if desired |

Draw, review the fan, Redraw until the deck reads well.

**Count check before moving on:** the releaser prioritizes distinct words and
will honestly deliver fewer cards when a config's word space is small (short
quartered lengths especially — Mild's 38× 8-step quartered slice is near that
edge; the releaser opens up 2nd copies automatically). A paid deck must total
54: if a slice comes up short, make up the difference with extra cards from
the order's other slices (packs/architect) or re-draw at a longer length only
if the buyer's config allows it. Never ship short.

## 3. Render + export (browser leg)

Per slice: load the draw in the print preview and export. For a multi-slice
order export each slice, then combine at upload/print time (card backs are
identical, so order only matters within fronts).

- **Home Print PDF** — 3×3 on US Letter, duplex-aligned (the beta shelf's
  default: printed and cut by hand in Chicago).
- **MPC ZIP** — `fronts/` + `backs/` PNGs for MakePlayingCards.com.
- **Single-card PDF** — one card per page for other print services.

## 4. Print + ship

**Home print (beta shelf):** duplex on cardstock (long-edge flip), cut along
guides, deck box + explainer card + laminated quick-reference sheet per the
listing's promise list.

**MPC (finished shelf / overflow):** makeplayingcards.com → Design Your Own →
Poker Size → upload fronts then backs in matched order → S33 (standard) or
M31 (linen) stock.

Ship to `shippingAddress`. US shipping is free (already priced in); the label
cost is yours.

## 5. Close out

1. In Stripe Dashboard, mark the payment fulfilled (add the tracking number).
2. In Firestore, edit the order doc `status: "paid"` → `"fulfilled"` (manual —
   there is no admin UI yet).
3. Email the buyer the tracking number from `customerEmail` (manual — no
   automated order emails exist).

## Gotchas

- **One config per draw.** Every pack and most Architect recipes are
  multi-slice: expect 3–8 draws per order. Budget ~30–60 min per order end to
  end until this is automated.
- **Off-length cards are auto-rejected** by the releaser's exact-length gate
  (some combos, e.g. mirrored-inverted at certain lengths, only close
  seamlessly at 2×). You'll never accidentally ship a wrong-count card, but
  those combos draw slower.
- **The enumerated c54 catalogs are a backstop, not the path.** The seven
  `l1-*-c54` catalogs cover only 8-step L1 in seven flavors. Live generation is
  the fulfillment path; the catalogs are useful only if you want a
  hand-curated fallback for an 8-step L1 slice.
- **`variety` flavor** (dial orders) is a blend concept: compose it as a
  spread of flavors, honoring `loopCustom.excludeFlavors` if present.

## What the simulation proved / what's still undrilled

Proven by `tests/unit/services/order-fulfillment-simulation.test.ts`:
- All three order shapes decode to valid 54-card slice plans with the real
  client code (`LOOP_PACKS`, `parseRecipe`, flavor→LOOPType bridge).
- Every slice — including rotated L3 12-step ≤2T quartered, swapped-inverted
  L2, and 16-step quartered — live-generates exact-length cards through the
  real orchestrator pipeline.

Still undrilled (do these as the live fire drill):
1. A real prod purchase (one LOOP Deck, one Architect) → order doc appears
   with config intact.
2. The browser leg: releaser draw → print preview → PDF/ZIP export for a real
   order's slices.
3. Physical print + cut + pack + ship timing.
