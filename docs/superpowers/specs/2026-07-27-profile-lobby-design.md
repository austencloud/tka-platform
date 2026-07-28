# Profile Lobby — Design

**Date:** 2026-07-27
**Status:** Approved, not implemented
**Supersedes nothing.** Extends `2026-07-26-profile-as-stage-design.md`.
**Feedback ledger:** `active/2026-07-27-profile-stage-feedback-ledger.md`

---

## The problem

The three-band stage shipped to `/creators/[id]` and it works: each artifact
renders in its own medium, the Showcase reads as a curated top, Collections
shows the variety. Then the Archive renders 505 sequences and undoes it.

Austen, on the live page (2026-07-27):

> "I immediately have to scroll to see the contents that are in front of me why
> would this be the case it should feel like I'm already on the destination as
> soon as I get there ... when I scroll down it's just a sea of mandalas it
> really doesn't feel accessible or parsable in any way"

Two distinct failures, one cause. The page does not **arrive** — you land above
the content and must scroll to reach it. And the page does not **end** — it runs
for a dozen screens of near-identical tiles. Both come from the profile trying
to be a container for everything a creator has made, rather than a way in.

## The question this design closes

Austen's instinct was that a drill-down would fix it, followed immediately by the
fear that this means rebuilding the gallery to be multimodal:

> "oh shit do we need to make the whole real gallery be a drill down into the
> different showcase collection media types ... I'm really starting to get lost
> in the sauce here"

**It does not.** Both drill-downs already exist:

| Media | Drill-down | Where |
|---|---|---|
| Sequences | `GalleryDrill` + `create-browse-engine` | `features/browse/gallery-home/GalleryDrill.svelte` |
| Scenes, tunnels, mandalas | `CollectionGalleryDetail` | `shared/modules/CollectionGalleryDetail.svelte` |

`CollectionGalleryDetail` is already medium-agnostic (poster grid → detail) and
already serves all three collection types. `GalleryDrill` is deliberately
sequence-shaped: its filter categories are turns, letters, TnD families, loop
components — **none of which mean anything for a mandala.**

So a single unified engine would be a discriminated union plus per-medium filter
and sort adapters: the two engines that already exist, wearing one costume, with
a new abstraction layer to maintain. That is the quicksand. We are not building
it.

**The profile does not need a new drill-down. It needs to stop being a wall and
start being a lobby that hands off to the drill-downs already built.**

`GalleryDrill` does model `author` as a first-class filter category
(`GalleryDrill.svelte:116,127`, section rendered at `:865`), complete with
per-creator counts, sample work, and avatars.

**Corrected 2026-07-28 after adversarial review.** An earlier draft of this spec
claimed that made a per-creator scope "not new machinery." That was wrong, and
the correction matters enough to state plainly rather than quietly edit:

- **`section` cannot be preset from outside.** It is internal `$state`
  initialised by `restoreSection()` from sessionStorage, page variant only
  (`:131-144`). The `Props` interface (`:60-95`) exposes `pool`, `getCount`,
  `onApply`, `onShowAll`, `onSearch`, the loop/family toggles and `variant` —
  and nothing that opens the drill on a chosen section or a chosen value.
  Landing a visitor on "this creator's work" therefore needs a **new prop**
  (`initialSection`, or a fuller `preset`). Small, but real, and it must be in
  the plan rather than assumed away.
- **Nothing here is URL-addressable.** Sub-screen state persists through
  `sessionStorage` (`gallery-view-persister`), not the URL. A handoff
  destination is not linkable or refresh-durable until that changes.

---

## Design

### The shape

| Band | Today | After |
|---|---|---|
| Showcase | 4 curated, large | **Unchanged.** This is the destination. |
| Collections | all 46, inline | Inline while small; a shallow row + handoff past a threshold |
| Archive | 505 tiles | A **doorway**: counts, a thin sample, one way in |

### Decisions taken (Austen, 2026-07-27)

**1. The Archive is a doorway for everyone, including the profile's owner.**
No owner/visitor branch. One design, one code path, and the owner always sees
what visitors see — a property worth more than the convenience of an inline
wall on your own page. Your own library stays one click away.

**2. The Archive doorway navigates to Browse, scoped to the creator.**
Not an in-place mount, not an overlay.

The decision stands; **the reason originally given for it was false.** That
draft argued `GalleryDrill` "keeps exactly one host" and that embedding it
elsewhere means owning its state there. Not true — embedding is a designed,
first-class mode. It ships a `variant?: "page" | "sheet"` prop (`:94,:106`) and
already has three hosts: `BrowseModule.svelte:502`,
`AddSequencesSheet.svelte:158`, `SmartCollectionBuilderSheet.svelte:171`
(plus `GalleryFilterSheet.svelte:77`).

So in-place mounting was never blocked by the architecture, and anyone reading
the old rationale would have been misled. The honest reasons to still navigate:
Browse is where a visitor expects to land when following "see all their work";
the sheet variant deliberately drops search, which an archive of 505 needs; and
the page variant is the one that persists its sub-screen. Weaker reasons than
the false one, and worth revisiting if navigating away proves jarring in use.

**3. Collections stays inline now, and becomes a doorway past a threshold.**
46 tiles is browsable, and it is the band that best shows the multimodal
variety — the whole argument for the stage. It flips to a shallow row + handoff
above **60 entries**. The page changing shape as a collection grows is accepted:
the alternative is either a sea later or a hidden band now.

### The doorway component

One shared `BandDoorway`, used by the Archive now and by Collections past its
threshold. Not two implementations of the same idea (`never-hand-roll.md`).

It shows: the count, a thin strip of the most recent few rendered as real
`ArtifactTile`s (so the doorway still shows WORK, not a button), and a single
clear action. The action is a button, not a text link
(`clickables-look-like-buttons.md`).

The strip is capped at one row at every breakpoint — it is a sample, not a
grid. Column counts come from the existing `capFor` tiers so it never strands
an orphan tile (`4k-native-layout.md`).

### Arrival

Making the Archive a doorway shortens the page from ~12 screens to roughly two.
That alone fixes "I have to scroll to see the contents." No separate work is
needed, and none should be invented — the scroll problem was a symptom of the
wall, not an independent layout bug.

The hero and the Showcase must both be substantially above the fold at 1080p.
This is a verification criterion, not a new mechanism.

### What the doorway hands off

- **Archive → Browse, `author` filter preset to this creator.** The drill's
  existing category, reached through a new preset prop (see the correction
  above). Prefer routing it through the URL so the destination is linkable and
  survives refresh; today nothing in this path is URL-addressable.

  **RESOLVED 2026-07-28 — and it partly breaks decision #1.**

  `allSequences` is fed by two mutually exclusive loaders, chosen by a `source`
  switch (`create-browse-engine.svelte.ts:164`, dispatched at `:721` and `:727`):

  | `source` | Loader | Contents |
  |---|---|---|
  | `"community"` | `loadCommunitySequences()` (`:449`) | The published/public pool |
  | `"my-library"` | `loadLibrarySequences()` | The signed-in user's own library |

  Meanwhile the Archive's count comes from
  `getLibraryRepository().getUserSequences(id)` (`ProfileStage.svelte:67`) —
  the **private library**. So the two profile cases need DIFFERENT handoffs:

  - **Another creator's profile** → `source: "community"` + `author` filter.
    Correct, and it shows their published work, which is all a visitor should
    see anyway.
  - **Your own profile** → must be `source: "my-library"`. Sending it to the
    community pool filtered by author would show only your PUBLISHED sequences,
    while the doorway above it advertises 505. **The doorway would lie about
    its own count**, and the gap is silent — no error, just a smaller grid.

  This does not undo decision #1 (the doorway looks and behaves the same for
  everyone, no owner-only wall), but it does mean the handoff cannot be one
  code path. The branch is in the plumbing — which `source` the destination
  opens in — not in the UI. Say so in the plan rather than discovering it in a
  browser.

  Whichever source is used, the doorway's count MUST be derived from the same
  pool the handoff lands in. A count from one source over a doorway into
  another is the defect this whole finding is about.

  **RESOLVED AGAIN 2026-07-28, from the code rather than a browser.** The
  prerequisite above was going to be answered by measuring two counts in a
  running app. Reading the seam answered it better, and overturned the shape
  the implementation plan assumed:

  - **There is no `/browse?source=…` URL to hand off to.** Browse is a module
    panel reached through `handleModuleChange("browse", tab)`; its gallery
    sub-screen persists in `sessionStorage`, and nothing in the path reads
    query params. A URL-based handoff would have to be built first.
  - **The gallery engine cannot be put in `my-library` at all.**
    `BrowseModule.svelte:75-89` constructs it with `sources: ["community"]`,
    and the engine sanitizes a persisted `my-library` back to community. So
    "send your own profile to Browse with `source: my-library`" is not
    available on that surface.
  - **The own-library surface that DOES exist is Browse › Library › the "All"
    shelf** (`MyCollectionsPanel.svelte:120-131` → `AllLibraryView.svelte`,
    an engine pinned to `sources: ["my-library"]`). Its pool is
    `getLibraryRepository().getSequences()`, which is literally
    `getUserSequences(ownUid)` (`library-repository.ts:1099-1104`) — the same
    call the Archive counts. **The counts match by construction**, not by
    coincidence, which is exactly the invariant this section demands.
  - **The visitor case is gated by Firestore, not by preference.**
    `firestore.rules:462` allows a read of `users/{id}/sequences/{seq}` only
    when `visibility == 'public'`, or to the owner, or to an admin. A query
    with no `visibility` clause is not provably satisfiable, so
    `getUserSequences(otherId, {})` — what `ProfileStage.svelte:67` issues
    today — is **rejected for any non-admin visitor**, and the whole stage
    falls into its error state. Austen never saw it because he is admin.

  So the resolved handoffs are:

  | Case | Doorway count reads | Handoff lands on |
  |---|---|---|
  | Own profile | `getUserSequences(uid, {})` — the private library | Browse › Library › **All** shelf (`viewCollectionDetail("all", "All")`) |
  | Another creator | `getUserSequences(id, { visibility: "public" })` — their published work | Browse › Gallery, `OWNER` filter applied to their display name |

  The visitor row also repairs the rejected-query defect above, and it is what
  keeps that doorway honest: a visitor is shown the count of the published work
  the handoff will actually show them.

  One consequence for the plan: **`GalleryDrill` does not need an
  `initialSection` prop.** That prop existed to open the drill on its author
  list so the visitor could pick the creator — but the creator is already
  known, so the handoff applies the `OWNER` filter directly through the
  engine (the same call the drill's own author row makes,
  `GalleryDrill.svelte:872`) and lands on the grid. Making the user choose
  something we already know would be the handoff failing at its one job.
- **Collections (past threshold) → `CollectionGalleryDetail`**, scoped to this
  user, opened on the medium that was showing when the handoff was taken (the
  filter chips already track this).

---

## Out of scope

Named explicitly so they are not smuggled in:

- **Any unification of the two browse engines.** The reason this design exists.
- **A custom profile-specific drill-down.** Rejected: it would be a third
  drill-down to maintain, and neither existing one is inadequate.
- **Archive virtualisation.** The doorway removes the need. `archiveCap` goes
  away with the wall rather than getting smarter.
- **Pinning UI.** The Showcase is still auto-picked because `PinnedItem` exists
  but nothing writes it. Real pinning is its own project.
- **The live panel's `max-width: 1920px`** (540px dead rail each side at 3000px).
  A product width decision, still awaiting Austen.

---

## Known defects this design does NOT fix

Tracked so they are not mistaken for regressions introduced here:

1. **Long words garble in `WordHeader`** — e.g. `Ω⊖SX⚹Ω⚹W`, where dashes collide
   with adjacent glyphs. Reproduces in Collections at current tile widths.
   Needs a fix in `WordHeader` or a length-aware tile head.
2. **Black quads in the 3D scene preview** — particle sprites failing to
   texture. Lead: `reference_render_context_registry_async_init`.
3. **Stored 3D-scene names are wrong** in Firestore (`"FΨFΨFΨFΨ — 3D scene"`).
   `ArtifactTile` simplifies per token at render; the data wants a repair.
4. **`ProfileShowcase.svelte` / `ProfileTabs.svelte`** are unreferenced by
   `UserProfilePanel` since the stage landed, but not deleted — every other
   consumer must be checked first (`feedback_verify_before_deleting`).

---

## Verification criteria

A claim that this is done requires, per `visual-verification-mandatory.md`:

1. Screenshots at 1920, 2560, 1440, 820×1180, 960×412, 375 — plus a real 3840
   if `resize_page` cooperates (it capped at 3000 in the sessions that built
   the stage; say so if it does again).
2. **Page height measured**, before and after, at 1080p. The Archive wall is
   gone only if the number says so.
3. **Hero and Showcase both above the fold at 1920×1080**, measured, not eyeballed.
4. Both handoffs actually taken in the browser, landing on the right filtered
   destination, with the back button returning to the profile.
5. Doorway strip shows no orphan row at any tier.
