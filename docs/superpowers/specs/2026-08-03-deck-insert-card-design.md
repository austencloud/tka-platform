# Deck Insert Card: Ship "How to Read" With Every Released Deck

**Date:** 2026-08-03
**Status:** Implemented in `6862f90db6` (+ `49a5a2d1b1`, the print-preview
follow-up). Two deviations from the plan below,
both additive: the canvas parity pass found the Svelte version drew inline
blue/red prop dots in step 2 and italicized *Start* in step 4, and those were
ported before deletion; and the first print-resolution screenshot showed both
faces top-aligned with the bottom third empty, so each now measures its wrapped
body and centres it. Verification step 1 (a real export from the releaser)
remains outstanding — it needs a signed-in admin session and a composed deck.

## Outcome

Every deck released from the Choreo Cards deck releaser ships with the existing
"How to Read a Choreo Card" insert as card 1 of the printed deck, in every
export format. The insert prints its deck number. The canvas renderer becomes
the single implementation of that card, so the designer preview shows the actual
print artifact.

## Why This Exists

The insert card is already built. `InfoCardFront.svelte` teaches the five
reading rules, the pronunciation table, and the QR hint; `InfoCardBack.svelte`
teaches the four corners, the levels, the LOOP key, and chaining by start
position. `PrintCardRenderer.renderInfoCardFront/Back` render both at full MPC
size with bleed.

None of it reaches a released deck. Those two methods have zero callers outside
`__tests__/print-card-renderer-front-worker.test.ts`. The only place the card
renders is a `showInfoCard` toggle in the designer preview, and
`CardInspectModal.svelte:190` passes `showInfoCard={false}`. Every deck exported
today is 55 pretty cards with no way in.

That matters more in a generative catalog than a fixed one. Generation varies
the sequences; it never varies the notation. Cells are steps, blue and red are
the two props, arrows are paths, the letter names the step, and it loops —
invariant across every deck the composer will ever emit. The insert is therefore
the one teaching surface with zero marginal cost per deck: authored once, ships
with deck 1 and deck 100 unchanged. And a generated deck is one of one, so its
owner has no friend with the same deck, no video, and nothing on the internet
about it. The deck has to teach itself.

## Decisions

| Question | Decision |
|---|---|
| Deck-aware content? | No. Static and universal — the card teaches the system, not this deck's slice. |
| Position in the deck | First. Card 1 of the printed stack in every export. |
| Counted? | Yes. The number handed to a print vendor includes it. |
| QR on the insert? | No. It keeps the existing "scan a card's QR" line, which points at sequence QRs that work in production today. |
| Deck identity | The deck number prints on the card. Identity is permanent and free; a printed URL is a commitment made before the release flow has been walked once. |
| Source of truth | The canvas renderer. The Svelte pair is deleted after a parity pass. |

## Out Of Scope

Deferred to a later spec, after a full release has been run end to end:

- A public `/deck/[n]` page. `deckReleases` manifests are auth-gated
  (`firestore.rules:1776`) and no such route exists.
- Deck-level short codes. Codes are hard-bound to sequence payloads
  (`payloadKind: "word" | "solo"`), and `firestore.rules:1156` rejects any other
  shape at write time.
- Any publish state on `DeckRelease`.

Printing the deck number now keeps that door open at zero cost: decks already in
the wild become retroactively addressable if the page is ever built, and no
printed card can be orphaned if it never is.

## Design

### 1. The insert is a constant, not a card record

`DeckReleaseCard` requires `sequenceId`, `word`, `stepCount`, `sourceCatalogId`,
and `footer` (`domain/models/DeckRelease.ts:40-49`). Adding a discriminated
`kind` to `sequences[]` would force every consumer to narrow before touching a
field it currently assumes. The insert carries none of that data and is
identical in every deck, so it is a flag, not a record.

`DeckRelease` gains:

```ts
insertCard?: { version: number };
```

Absent means a legacy deck released before this feature. `cardCount` keeps its
current meaning — sequence cards — so existing manifests remain accurate and no
backfill is needed. A derived helper alongside the model returns the number that
goes to the print vendor:

```ts
export function getPrintedCardCount(release: DeckRelease): number {
  return release.cardCount + (release.insertCard ? 1 : 0);
}
```

`releaseDeck()` in `services/deck-release-store.ts` stamps
`insertCard: { version: 1 }` on new releases. `scripts/release-tnd-deck.cjs`
stamps the same field in its admin-SDK manifest write so script-released and
UI-released decks agree.

`version` exists so a future insert revision is identifiable from a manifest —
deck 7 shipped v1, deck 40 shipped v2 — without reprinting or rewriting history.

### 2. Canvas becomes the only implementation

`services/info-card-canvas-renderer.ts` already draws both faces at MPC
dimensions with bleed, themed borders, and per-theme caching. The Svelte pair
draws the same content again at 500×700 for preview only. Every string exists
twice — `steps` (line 73), `pronItems` (line 133), `loopText` (line 397),
`chainText` (line 418) — with nothing keeping them in sync.

Order of work:

1. **Parity pass.** Render `InfoCardFront.svelte` / `InfoCardBack.svelte` and the
   canvas output side by side at print size. Port to the canvas renderer
   anything the Svelte versions have that it lacks, in content or layout.
   Resolve any wording differences in favor of the Svelte copy, which is the
   version Austen reviewed.
2. **Repoint the preview.** `components/designer/CardPreviewStack.svelte` renders
   the canvas output for its `showInfoCard` branch instead of mounting the Svelte
   components. Preview then equals print by construction.
3. **Delete** `InfoCardFront.svelte` and `InfoCardBack.svelte`.

### 3. Deck number on the card

`InfoCardCanvasOptions` gains `deckNumber?: number`. `renderInfoCardFront` prints
it in the front footer beside `tkaflowarts.com` (line 175), formatted
`Deck 007` — zero-padded to three digits, matching the manifest id.

The module-level cache is the one real bug risk here. It currently keys on theme
alone:

```ts
let cachedFront: HTMLCanvasElement | null = null;
let cachedTheme: string | null = null;
```

With a deck number on the front, that cache serves deck 7's card for deck 8. The
cache key must become `theme + deckNumber`, or the front cache must be dropped
entirely. The back has no deck-specific content and may keep its theme-only
cache.

When `deckNumber` is absent (designer preview with no release context), the
footer prints without it.

`PrintCardRenderer.renderInfoCardFront(theme?)` gains a `deckNumber` parameter
and passes it through.

### 4. Exports place it first

All three paths prepend the insert. Sequence card numbering shifts accordingly.

**ZIP** (`services/print-zip-exporter.ts`): `fronts/001_info_front.png` and
`backs/001_info_back.png`; sequence cards begin at `002`.

**MPC per-card PDF** (`exportDeckPDF` in `services/print-pdf-exporter.ts`): the
insert front and back become the first two pages.

**Home print PDF** (`exportHomePrintPDF`): one insert **per copy**. Printing
three copies produces three physical decks, so three inserts. This is the detail
most likely to be missed — the insert is not a one-off page at the front of the
document, it is card 1 of each deck in the run. Element grouping applies to
sequence cards only; the insert always leads its copy.

### 5. It gets no short code

`prepareSerializedPrintRun()` (`services/serialized-print-run.ts:188-279`) mints
one short code per card and issues a `PhysicalCardIssueRequest` per copy. The
insert has no sequence and must not consume a code or appear in that request.

The insert is prepended **after** serialization returns, so it never enters that
loop. `cardIndex` values in the issue request continue to refer to sequence
cards only, keeping the API contract and existing scan telemetry unchanged.

### 6. Releaser UI

`ReviewStep.svelte` and the export summary state the printed count explicitly:

> 56 cards — 55 sequences + 1 how-to-read

so the number copied into an MPC order is the number of physical cards.

## Verification

A green typecheck does not verify any of this. Required evidence before this is
called done:

1. **A real export.** Compose a small deck in the deck releaser, export both the
   ZIP and the home-print PDF, and confirm: the insert is card 1 in both, its
   deck number matches the release, and sequence cards are correctly renumbered.
2. **Two decks back to back.** Export deck N, then deck N+1, and confirm the
   second insert shows its own number. This is the cache-key regression and it
   will not surface any other way.
3. **Copies.** Export a home-print PDF with copies set to 3 and confirm three
   inserts, one leading each deck.
4. **Legibility at print resolution.** Read the rendered insert at 100% of its
   822×1122 output. The pronunciation table and the corner labels are the
   smallest type on the card and are the first things to fail.
5. **Parity screenshots** from step 2 of the canvas migration, showing the canvas
   output is not a downgrade from the Svelte version being deleted.

## Files

**Modify**

- `src/lib/features/choreo-card/domain/models/DeckRelease.ts` — `insertCard`, `getPrintedCardCount`
- `src/lib/features/choreo-card/services/deck-release-store.ts` — stamp `insertCard` in `releaseDeck`
- `src/lib/features/choreo-card/services/info-card-canvas-renderer.ts` — `deckNumber`, cache key, parity ports
- `src/lib/features/choreo-card/services/types.ts` — `InfoCardCanvasOptions.deckNumber`
- `src/lib/features/choreo-card/services/PrintCardRenderer.ts` — pass `deckNumber` through
- `src/lib/features/choreo-card/services/print-zip-exporter.ts` — prepend insert
- `src/lib/features/choreo-card/services/print-pdf-exporter.ts` — prepend insert in both exporters, per copy in home print
- `src/lib/features/choreo-card/components/designer/CardPreviewStack.svelte` — preview the canvas
- `src/lib/features/choreo-card/components/deck-releaser/ReviewStep.svelte` — printed count
- `scripts/release-tnd-deck.cjs` — stamp `insertCard`

**Delete**

- `src/lib/features/choreo-card/components/card-back/InfoCardFront.svelte`
- `src/lib/features/choreo-card/components/card-back/InfoCardBack.svelte`

## Known Adjacent Gaps (not fixed here)

Surfaced while mapping the release flow. Recorded so they are not rediscovered:

- `.claude/agents/deck-release-expert.md:70-78` documents a `decks/{catalogId}`
  collection, but the scripts and `firestore-paths.ts:174-176` use `catalogs`.
  Following the agent file sends you to the wrong collection.
- `scripts/release-tnd-deck.cjs` writes a manifest without `name`,
  `description`, `bluePropType`, or `redPropType` — all fields the typed
  `releaseDeck` path requires. Script-released decks land with no prop snapshot,
  which `DeckRelease.ts:128-131` says is what keeps cached renders valid.
- `scripts/release-tnd-deck.cjs:112` hardcodes `stepCount: 4`.
- `CardBack.svelte:249` prints `tkaflowarts.com` while the front QR resolves
  `tka.run/{code}` — two domains on two faces of one card.
- There is no scripted LOOP release path; both skill files punt to the UI.
