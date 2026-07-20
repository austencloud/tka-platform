---
name: kickstarter
description: Use when working on the Choreo Cards Kickstarter campaign — updating copy, reward tiers, stretch goals, refining the mockup page, tracking content production, vendor decisions, or transitioning between Phase 1 (laminated proof run) and Phase 2 (Kickstarter launch)
---

<!-- generated from .claude by scripts/sync-codex-skills.mjs; do not edit directly -->

# Choreo Cards Kickstarter Campaign

Track and advance the Kickstarter campaign for physical TKA Choreo Card decks.

## Key Files

- **Spec:** `docs/superpowers/specs/2026-04-27-kickstarter-campaign-design.md`
- **Visual mockup:** `static/kickstarter-preview.html`
- **Print export:** `src/lib/features/choreo-card/components/ChoreoCardExport.svelte`
- **Card renderer:** `src/lib/features/choreo-card/components/ChoreoCard.svelte`
- **Card back:** `src/lib/features/choreo-card/components/card-back/CardBack.svelte`
- **Store product seed:** `scripts/seed-store-product.cjs`
- **Deck enumerator:** `scripts/enumerate-deck.cjs`

## Campaign Overview

**Product:** Complete algorithmic decks — every possible sequence for a given LOOP configuration. Not curated, not sampled. The entire mathematical space.

**Two phases:**
1. **Phase 1 (current):** Laminated proof run. Print + laminate Starter (47) and Deep Dive (128) decks with QR codes + mandalas. Hand out at festivals. Film content.
2. **Phase 2 (later):** Launch Kickstarter with real photos/video. Professional printing as the upgrade pitch.

**Funding goal:** $4,500 (250 deck sets via professional vendor)

## Entering This Skill

On invocation, read the spec file first:
```
Read docs/superpowers/specs/2026-04-27-kickstarter-campaign-design.md
```

Then assess current phase and ask what to work on:

### Phase 1 Checklist (Laminated Proof Run)
- [ ] Print Prep tab can batch-export complete 47-card deck with QR codes
- [ ] Print Prep tab can batch-export complete 128-card deck with QR codes
- [ ] Card backs render with mandalas at print resolution
- [ ] Laminated samples produced and photographed
- [ ] Festival footage captured (handing cards to people, reactions)
- [ ] Performance footage: sequences from cards performed with staves
- [ ] QR scan demo footage: phone scanning card → 3D animation
- [ ] MPC stock sample pack ordered and compared

### Phase 2 Checklist (Kickstarter Launch)
- [ ] Campaign copy finalized (review spec Section: Campaign Page Structure)
- [ ] Video produced (60-90 sec, outline in spec)
- [ ] Reward tiers confirmed and priced
- [ ] Vendor selected (MPC/PrintNinja/AdMagic based on funding level)
- [ ] Mockup page updated with real photos replacing placeholders
- [ ] Kickstarter account set up
- [ ] Pre-launch page live
- [ ] Email list seeded

## The Decks

| Deck | Config | Cards | Status |
|---|---|---|---|
| Starter | L1 halved strict-rotated 4-beat | 47 | Enumerated |
| Deep Dive | L1 quartered strict-rotated 8-beat | 128 | Enumerated |
| VTG Ratio | L1 VTG motions × 7 ratios | ~133 | Enumerated (stretch goal) |

Future decks from the combinatorial space become stretch goals or ongoing releases.

## Reward Tiers

| Tier | Price | Contents |
|---|---|---|
| Digital Backer | $10 | PDF print files for Starter (47) |
| Starter Deck | $25 | Physical 47-card deck |
| Full Set (Early Bird) | $45 | Starter + Deep Dive (first 50) |
| Full Set | $55 | Starter (47) + Deep Dive (128) |
| Collector | $80 | Full Set + name on Backers card |
| Workshop | $150 | Full Set + 1hr private video session |
| Patron | $250 | Full Set + workshop + future decks for year one |

## Stretch Goals

$4,500 → Funded (Starter + Deep Dive ship)
$6,000 → Linen-finish card stock upgrade
$8,000 → Custom tuck boxes with mandala art
$10,000 → VTG Ratio deck (~133 cards)
$15,000 → Foil-stamped mandala on card backs
$20,000 → Quarterly deck drops for Patron tier, year one

## Vendor Quick Reference

| Funding level | Vendor | Stock | ~$/deck |
|---|---|---|---|
| $4,500 (goal) | MPC S33 | 300gsm black core smooth | $4-5 |
| $6,000 (stretch) | MPC M31 | 310gsm linen air | $5-6 |
| $10,000+ | PrintNinja | 280gsm blue core offset | $2.34 at 500 |

## Tone Rules

All campaign copy follows `docs/reference/ai-writing-guide.md`. Key points:
- Educational resource, not a sales pitch
- No em dashes, superlatives, or marketing speak
- Show the object first, explain the system second
- VTG acknowledged respectfully as Vulcan Tech Gospel (Noel Yee, Vulcan Lofts, Oakland)
- VTG is a classification layer within TKA, not a separate product line
- No fabricated biographical claims about Austen

## Working on the Mockup

The mockup at `static/kickstarter-preview.html` is a standalone HTML page. Open in browser to preview. Photo/video placeholders marked with `[ bracket descriptions ]`. Replace placeholders with real content as it becomes available.

## Exit Criteria

Phase 1 done when:
- Both complete decks exported and laminated
- Photo + video content captured
- MPC stock samples evaluated

Phase 2 done when:
- Kickstarter page copy finalized
- Video produced and embedded
- All mockup placeholders replaced with real content
- Campaign launched
