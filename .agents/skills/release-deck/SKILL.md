---
name: release-deck
description: Compose, release, render, and export physical choreo card decks. Use when user wants to create a printable deck, release to Firestore, or order prints.
argument-hint: "[vtg|loop] [pattern-filter] [--notes \"Edition Name\"]"
---

# Deck Release Pipeline

Compose a deck from the catalog, release it to Firestore, render print-ready cards, and export for printing or ordering.

## Arguments

`$ARGUMENTS` — parsed as: `[collection] [filter] [--notes "..."]`

| Arg | Default | Examples |
|-----|---------|---------|
| collection | vtg | `vtg`, `loop` |
| filter | all | `whole-turn`, `half-turn`, `symmetric`, `0T`, `1T,2T`, `uniform-1t,uniform-2t`, `0\|1,1\|2` |
| --notes | auto-generated | `--notes "Fire Drums 2026"` |
| --dry-run | off | Preview composition without writing |

## Filter Shorthands

| Shorthand | Expands to |
|-----------|-----------|
| `whole-turn` | `uniform-0t,uniform-1t,uniform-2t,uniform-3t` |
| `half-turn` | `uniform-0.5t,uniform-1.5t,uniform-2.5t` |
| `symmetric` | All `uniform-*` patterns |
| `0T` through `3T` | `uniform-0t` through `uniform-3t` |
| `0.5T` through `2.5T` | `uniform-0.5t` through `uniform-2.5t` |
| Pipe patterns | `0\|1`, `1.5\|3` etc. passed through as-is |

## Pipeline Steps

### Step 1: Parse & Compose

Parse `$ARGUMENTS` to determine collection and turn pattern filter.

Run the release script in dry-run mode first:

```bash
node scripts/release-tnd-deck.cjs --dry-run --patterns "uniform-0t,uniform-1t,uniform-2t,uniform-3t" --notes "Whole Turn TnD"
```

Show the user:
- Total card count
- Breakdown by turn pattern
- Breakdown by family
- Sample card list

### Step 2: Confirm & Release

After user confirms (or if they said "just do it" in their original message), run without `--dry-run`:

```bash
node scripts/release-tnd-deck.cjs --patterns "uniform-0t,uniform-1t,uniform-2t,uniform-3t" --notes "Whole Turn TnD"
```

Report the deck number assigned.

### Step 3: Render

Tell the user to navigate to the Deck Releaser tab to render and export:

> Deck #NNN released. Open **Choreo Cards > Deck Releaser** — your deck is in the release history panel. Click it to load the print preview, then export as:
> - **Home Print PDF** — 3x3 grid on US Letter, duplex-aligned
> - **MPC ZIP** — individual PNGs for MakePlayingCards.com upload
> - **Single-card PDF** — one card per page for custom print services

### Step 4: Print Order (if requested)

If the user wants to order physical prints:

**MakePlayingCards.com (MPC) workflow:**
1. Export deck as ZIP (fronts/ and backs/ folders)
2. Go to makeplayingcards.com > Design Your Own > Poker Size
3. Upload fronts in order, then backs in order
4. Select card stock: S33 (standard) or M31 (linen, premium)
5. Quantity: 1 deck minimum, price breaks at 100+
6. Checkout and order

**Home printing workflow:**
1. Export as Home Print PDF
2. Print double-sided on cardstock (long-edge flip)
3. Cut along guides
4. Sleeve in penny sleeves (Ultra Pro or KMC Perfect Fit)

**PrintNinja (bulk 500+):**
1. Export as MPC ZIP format
2. Submit to printninja.com with specs: 2.5" x 3.5", 300gsm blue core, CMYK
3. Requires 500 minimum order

## LOOP Deck Support

For LOOP decks, the script doesn't apply — LOOP deck composition uses weighted random sampling from the pool. Use the Deck Releaser UI for LOOP decks (step count weights, slice type filtering, preset configurations).

If user asks for a LOOP deck via this skill, tell them:
> LOOP decks use weighted random sampling — the UI at **Choreo Cards > Deck Releaser** gives you sliders for step count mix, presets (Even/Beginner/Advanced), and slice type filtering. Switch to "LOOP Sequences" mode there.

## Key Files

| Purpose | Path |
|---------|------|
| Release script | `scripts/release-tnd-deck.cjs` |
| Deck composer | `src/lib/features/choreo-card/services/deck-composer.ts` |
| Release store | `src/lib/features/choreo-card/services/deck-release-store.ts` |
| Print renderer | `src/lib/features/choreo-card/services/PrintCardRenderer.ts` |
| PDF exporter | `src/lib/features/choreo-card/services/print-pdf-exporter.ts` |
| ZIP exporter | `src/lib/features/choreo-card/services/print-zip-exporter.ts` |
| Card back renderer | `src/lib/features/choreo-card/services/card-back-dom-renderer.ts` |
| Deck reference | `.Codex/skills/deck/deck-reference.md` |

## Exit Criteria

You're done when:
- Deck manifest exists in Firestore at `deckReleases/counter/manifests/{number}`
- User has been told how to render and export
- If print ordering was requested, MPC/PrintNinja instructions were provided
