# Deck Releaser Decomposition

**Date:** 2026-08-09
**Status:** Shipped
**Owner:** Choreo Card deck releaser

## Decision

Restore `DeckReleaserTab.svelte` to its original role as the wizard and sidebar
coordinator. Deck session state, card production, print issuance, generated-deck
archives, and released-deck history each receive one named owner.

The user-visible workflow and layout stay unchanged.

## Evidence

The component had 1,823 lines when this work began. Its script ended at line
1,414 and contained five independently changing workflows:

- LOOP, Timing and Direction, and gallery deck production;
- sequence resolution, swap, redraw, and cancellation handling;
- PDF, ZIP, and browser-print issuance;
- local IndexedDB archive recovery;
- Firebase release creation, rename, selection, and deletion.

Its 429-line companion state was a module singleton imported by four components.
That lifetime conflicts with the approved factory-and-context state pattern and
makes tests share mutable process state.

The monolith four-perspective check converged 4/4:

- **Architecture:** the boundaries correspond to real product capabilities.
- **Change safety:** output, generation, and release changes can be verified
  without touching unrelated workflows.
- **Agent context:** a future task can load one behavior owner instead of the
  full tab and singleton.
- **Skeptic:** the target contains business rules and external boundaries, not
  only large markup or honest orchestration.

## Capability Ownership

Existing capabilities remain canonical:

- `deck-composer.ts` owns deterministic catalog composition.
- `generation-orchestrator` owns live sequence generation.
- `deck-release-store.ts` owns Firebase release persistence.
- `deck-archive-store.ts` owns IndexedDB archive persistence.
- `serialized-print-run.ts`, `print-pdf-exporter.ts`, and
  `print-zip-exporter.ts` own physical output encoding and issuance.

This work composes those owners. It does not add another implementation of any
of them.

## Target Structure

`DeckReleaserTab.svelte` creates the component-scoped state, installs context,
composes the workflow owners, and wires the existing UI components.

The extracted owners are:

- `state/deck-releaser-state.svelte.ts`: session-backed deck state factory;
- `context/deck-releaser-context.ts`: descendant access to that state;
- `state/deck-production-state.svelte.ts`: pool setup, card production,
  sequence resolution, redraw, refresh, swap, and cancellation;
- `state/deck-print-state.svelte.ts`: preview ordering, print settings,
  metadata, PDF/ZIP issuance, and rendering progress;
- `state/deck-archive-state.svelte.ts`: generated-deck archive list and recovery;
- `state/deck-release-state.svelte.ts`: release history, duplicate lookup,
  creation, rename, selection state, and deletion.

`ConfigureStep.svelte`, `ReviewStep.svelte`, `PrintPanel.svelte`, and the release
history panels remain the presentation owners.

## Behavior Locks

The refactor must preserve these details:

- saved drafts reopen without the initial persistence effect erasing the viewed
  release number;
- stale generation runs cannot replace a newer draw;
- LOOP generation keeps exact-length and skeleton-deduplication gates;
- release duplicate detection remains order-insensitive;
- print sorting remains stable when grouping is disabled;
- backs-only PDF export reuses the byte cache and creates no issuance run;
- fronts, combined PDFs, and ZIP exports create distinct serialized runs;
- generated live decks restore from IndexedDB because catalog lookup cannot
  reconstruct them;
- released LOOP decks retain pinned props while Timing and Direction and gallery
  decks follow the live prop selection.

## Tests and Verification

Focused unit tests cover session isolation, recipe round trips, print ordering
and metadata, release classification, release identity, and duplicate
detection. The existing deck composition, variation, gallery source, print
issuance, home-print, and exact-length generation tests remain green.

Verification completed with 73 focused and adjacent tests plus the production
SvelteKit build. The build used a command-scoped placeholder for the required
public Google Maps key and completed through the Cloudflare adapter. The root
component fell from 1,823 lines with a 1,414-line script to 821 lines with a
369-line script. Its markup and CSS were preserved, so this boundary-only
refactor did not require a visual baseline change.

## Main Risks

The main risk is stale closure state across async generation and release loads.
Every extracted owner receives the live deck state object and reads values at
operation time. Cancellation continues to use `drawGeneration` as the single
monotonic token.

The second risk is changing persistence lifetime. The root creates exactly one
state instance per mounted deck releaser and sets its context synchronously
before descendants initialize.
