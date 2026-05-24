# Deck Releaser — Design Spec

**Date:** 2026-05-23
**Status:** Approved (verbal)
**Context:** Fire Drums 2026 print run. Physical choreo card decks, home inkjet manual duplex.

## Problem

Austen needs to compose, enumerate, and print unique 52-card choreo card decks from the 18,000+ enumerated LOOP sequences. Each deck is one-of-a-kind. The print workflow must be foolproof for manual duplex (flip paper, print backs).

## Architecture

New `"releaser"` tab in the ChoreoCard module. Linear four-step wizard:

1. **Configure** — set step count weights, total card count (default 52)
2. **Draw** — random weighted selection from LOOP deck pools
3. **Review** — print preview of drawn cards with swap capability
4. **Release** — Firebase atomic increment, manifest save, export

### New Files

```
src/lib/features/choreo-card/
  components/deck-releaser/
    DeckReleaserTab.svelte        # Wizard container with step navigation
    ConfigureStep.svelte          # Pool ratio sliders + card count
    ReviewStep.svelte             # Card grid preview, swap, reorder
    ReleaseStep.svelte            # Finalize: assign number, save, export
  services/
    deck-composer.ts              # Random weighted selection from deck pools
    deck-release-store.ts         # Firebase counter + manifest CRUD
  domain/models/
    DeckRelease.ts                # Release data model
```

### Modified Files

```
src/lib/shared/navigation/config/tab-definitions.ts   # Add "releaser" tab
src/lib/features/choreo-card/components/ChoreoCardTab.svelte  # Add mode + import
src/lib/shared/library/data/firestore-paths.ts         # Add release paths
```

## Data Model

```typescript
interface DeckRelease {
  deckNumber: number;           // Sequential, globally unique
  createdAt: string;            // ISO 8601
  theme: string;                // Card back theme (e.g. "cosmic")
  cardCount: number;            // Usually 52
  notes: string;                // e.g. "Fire Drums 2026"
  sequences: DeckReleaseCard[]; // Ordered card list
}

interface DeckReleaseCard {
  sequenceId: string;
  sourceDeckId: string;         // Which LOOP deck it came from
  stepCount: number;
  word: string;                 // Sequence word/name
  position: number;             // 1-based position in the deck
}
```

## Firebase Structure

```
deckReleases/                   # Collection
  counter                       # Document: { next: 1 }
  manifests/                    # Subcollection
    001/                        # Document: DeckRelease
    002/
```

Atomic increment via Firestore transaction: read `counter.next`, write release manifest with that number, increment `counter.next`.

## Composition Algorithm

1. Load all deck metadata via `loadDecks()` (includes `families[].sequenceIds[]`)
2. Build pool: group all sequence IDs by `deck.stepCount`, tagged with `sourceDeckId`
3. For each step count in the weight config, compute target card count:
   - `targetForStep = Math.round(totalCards * weight / totalWeight)`
   - Adjust rounding to hit exact total
4. Random sample without replacement from each step count pool
5. Shuffle final 52-card array for variety
6. Return `DeckReleaseCard[]` with positions assigned

### Default Weights

| Step Count | Weight | Cards (of 52) |
|-----------|--------|---------------|
| 16        | 40%    | 21            |
| 8         | 25%    | 13            |
| 12        | 20%    | 10            |
| 4         | 15%    | 8             |

Weights configurable via sliders. Only step counts with available sequences shown.

## Print Workflow

Reuses existing `PrintPreviewPages` (sheets mode) and `exportHomePrintPDF`.

The PDF exporter already handles column mirroring for long-edge duplex:
- Fronts: left-to-right, top-to-bottom (1,2,3 / 4,5,6 / 7,8,9)
- Backs: columns reversed (3,2,1 / 6,5,4 / 9,8,7)

User prints fronts, flips paper along long edge, prints backs. Each back aligns with its front.

## Deck Number on Card Back

Small text in the copyright/branding area: `"Deck #042"` alongside the existing `"tkaflowarts.com"` and `"© 2026"`. Passed as a prop through the render pipeline.

## UI Design

### Configure Step
- Step count weight sliders (4, 8, 12, 16)
- Total card count input (default 52)
- Theme selector (reuses existing theme picker)
- "Draw Cards" button

### Review Step
- Grid of card thumbnails (reuses ChoreoCard component)
- Step count distribution summary bar
- Click card to swap for another from same pool
- "Release Deck" button

### Release Step
- Assigned deck number displayed prominently
- Manifest summary (card count, step distribution, date)
- Export buttons: Home Print PDF, MPC PDF, ZIP
- "Save & Close" commits manifest to Firebase

## Scope Boundaries

**In scope:**
- Mixed LOOP grab-bag composition
- Firebase enumeration + manifest
- Print preview + export
- Card swap during review

**Out of scope (future):**
- VTG standalone deck releases (separate workflow)
- Deck number printed on card back (fast follow)
- Release history browser
- Undo/revert a release
