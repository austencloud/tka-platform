# Profile as a Stage

**Date:** 2026-07-26
**Status:** Design approved, plan not yet written

## The problem

Your own profile loads a wall of choreo cards. Every sequence renders the same
way — a static `PropAwareThumbnail` at whatever prop you happen to have set —
grouped by step count and sorted. With the largest library in the software, that
is an overwhelming spreadsheet, not a portfolio.

The software already knows how to display a sequence many other ways: a playing
2D canvas, a configured 3D scene, a tunnel, a mandala. All of those are explored
in the viewer. None of them reach the profile.

Austen (2026-07-26): *"we only have one method of displaying a given sequence's
information and that is displaying it as a card."*

## What already exists (verified)

The infrastructure vote is largely already cast.

**Collections store presentation config.** `Collected3DScene`
(`src/lib/features/scene-3d-collection/domain/scene-3d-collection-types.ts:74`)
holds a `poster` (~200px WebP), a `snapshot` carrying prop, `effortId`,
`effectToggles`, `sceneFeatures`, background + ocean variant, camera, `bpm`, and
per-performer overrides, plus optional `steps` and a `sourceWord` /
`sourceSequenceId` lineage stamp. Its own comment already draws the distinction
this design depends on:

> `steps` present → opening reproduces the exact performance in the scene.
> Absent → the entry is a reusable "look" applied to whatever sequence is opened.

`CollectedTunnel` has the same shape (`snapshot` + `poster`).
`CollectedMandala` has **no poster** — it stores `steps`, `variant`,
`bluePropType`, `redPropType`, `pathShape` and re-renders from those.

**Collections are already per-user profile data.**
`createFirebaseCollectionRepository`
(`src/lib/shared/collections/firebase-collection-repository.ts:23`) writes to
`users/{uid}/{collectionName}` — one path over from `users/{uid}/sequences`.

**The showcase slot is built and empty.** `ProfileShowcase.svelte` accepts
`pinnedItems: PinnedItem[]`, typed `sequence | collection | act | composition |
mandala` (`src/lib/shared/community/domain/models/pinned-item.ts`), and renders
each as a grey FontAwesome icon in a 200×160 box. Five declared content types,
no resolver, no real render.

**The wall is `ProfileTabs.svelte`.** `getUserSequences()` → `sortSequences()` →
group by step count → `PropAwareThumbnail` in `repeat(auto-fill, minmax(240px,
1fr))`.

**Nothing links the profile to collections.** `CollectionGalleryDetail.svelte`'s
header calls them "the Playground collections (Tunnels, Mandala, Scene-3D)" —
they live in Playground, one tab at a time.

**Name collision, unrelated:** `LibrarySequence.collectionIds` means sequence
folders, not saved-artifact collections. Two different things called
"collection". This design does not merge them and does not rename either; it
only avoids conflating them.

## Decisions

| Question | Decision |
|---|---|
| Does saving a sequence capture presentation config? | **No.** Sequences stay raw notation. The profile surfaces collections, which already carry the config. |
| Profile front door | **Sectioned:** Showcase → Collections → Archive |
| Liveness | **Live whenever visible**, tiered per medium |
| Live 3D tiles | **Shared renderer with scissored viewports** |
| Archive tiles | **Animate 2D pictograph playback** on visible |
| Collection visibility | **Per-entry `private \| unlisted \| public`, default private** |
| `/profile` account card | **Fold into the creator profile** as a settings affordance |

The sequence-vs-collection split is the load-bearing one. A sequence is
notation. A saved artifact is notation *plus the conditions it was left in*. The
data model already says this; the profile just never read it.

Sectioning is what makes live-whenever-visible affordable. The Collections band
is bounded — a person saves tens of scenes, not thousands — so an
IntersectionObserver over it has a small ceiling. The Archive band is unbounded
and homogeneous. In one mixed feed, every liveness rule has to be written for
the worst case and collapses to posters-only by default.

## Architecture

### `ProfileArtifact` read-model

A normalizing read-model over four sources. Owns no storage; each collection
keeps its existing repository and zod schema.

| Source path | Type | Poster |
|---|---|---|
| `users/{uid}/sequences` | `LibrarySequence` | derived thumbnail |
| `users/{uid}/scene-3d-collection` | `Collected3DScene` | stored WebP |
| `users/{uid}/tunnel-collection` | `CollectedTunnel` | stored WebP |
| `users/{uid}/mandala-collection` | `CollectedMandala` | **none — renders from `steps`** |

Normalized shape: `{ id, kind, medium, title, poster?, createdAt, sourceWord? }`.

Titles route through `simplifyRepeatedWord` — LOOP words repeat by
construction (`.claude/rules/simplified-word-display.md`).

This read-model is also the resolver `PinnedItem { type, id }` has never had.

### Three bands (replacing `ProfileTabs`)

**Showcase** — pinned items rendering as themselves. Heterogeneous, large, all
live. This is the curation surface; `ProfileShowcase`'s placeholder icons are
replaced by real medium renderers.

**Collections** — scenes, tunnels, mandalas. Bounded counts. Answers "there is
no way to reach collections from the profile."

**Archive** — plain sequences. Retains the sort/group machinery `ProfileTabs`
already borrowed from Browse (`SortPopover`, `sortSequences`, `SectionHeader`).

### Liveness coordinator

One shared module. Tiles register with a medium; an `IntersectionObserver` ranks
registered tiles by distance from viewport center; the coordinator grants live
tokens against a per-medium budget and revokes them as ranking changes.

Single owner by design — three bands deciding their own liveness would race each
other for the GPU.

| Band | Live means |
|---|---|
| Showcase | all pinned items run |
| Collections | per-medium cap, nearest-to-center wins |
| Archive | 2D animator, capped instance count |

### Scissored multi-viewport renderer

One `WebGLRenderer` with `setScissorTest(true)`; per-tile `setViewport` /
`setScissor` derived from `getBoundingClientRect`; one rAF iterating registered
live tiles.

Grep found no renderer or WebGL context pool anywhere in `src/lib` —
`Viewer3DCanvas` and `UnifiedViewerCanvas` are single-viewer components. This is
new infrastructure and warrants a spike before the rest of the plan commits to
an N-live budget.

**Explicitly not the unified-GPU-render-pipeline project.** That is an
effect-pass render graph (`src/lib/shared/render-graph/`, partial foundation,
5 phases, aimed at the trails perf bug). This is multi-viewport compositing.
Adjacent, separate, must not be folded into that plan.

### Archive tiles

Reuse `AnimatorCanvas`
(`src/lib/shared/animation-engine/components/AnimatorCanvas.svelte`) directly.
Not `InlineAnimationPlayer` — that is standalone but drags in `BpmChips` and a
full control surface.

Each animation instance constructs its own `AnimationLoop`,
`AnimationPlaybackController`, `SequenceAnimationOrchestrator`, and
`AnimationStateManager` ("avoid shared singleton", per `InlineAnimationPlayer`'s
own comment). Instance count is therefore the cost driver, and the coordinator
caps it.

**Trails off in archive tiles.** The unified-pipeline work records the 2D
animator dropping to ~10fps when trails accumulate on a *single* canvas
(Canvas2D per-tip O(N) history redraws).

### Collection visibility

Collection entries gain `visibility: "private" | "unlisted" | "public"`,
matching `LibrarySequence`. Firestore rules at `firestore.rules:483` (mandala),
`:491` (tunnel), `:499` (scene-3d) currently read `allow read: if
isOwner(userId)` and change to the sequence pattern.

**Existing entries default to private.** Nothing already saved becomes public
retroactively. Opting an entry in is a deliberate act, which is what makes the
Showcase curation rather than a dump.

### One profile

`/profile` (`src/routes/profile/+page.svelte`) folds into the creator profile.
Account details — UID, provider, email verification, member-since — move behind
a settings affordance on your own profile. `/profile` redirects to
`/creators/{uid}`.

Canonical creator route is `/creators/[userId]`; the navigation coordinator
already rewrites the older `/browse/creators/[userId]` and
`/social/creators/[userId]` forms.

### 4K and SE

`UserProfilePanel` has partial 4K work (container queries, a `has-aside` grid)
but caps at a hard `max-width: 1920px`, leaving dead rail at 2560 and 3840.
Replace with `--shell-w` per `.claude/rules/4k-native-layout.md`.

The absorbed account card is a 600px box with a single `@media (max-width:
640px)` block and no rem ramp.

Band column counts are pinned per tier, never `repeat(auto-fill, minmax(Npx,
1fr))` — `ProfileTabs`' current grid is exactly the auto-fill pattern the rule
forbids for known item counts. `WorkWall.svelte` already does this correctly via
`fitColumns()` and is the in-repo precedent.

Verification at all seven required viewports per
`.claude/rules/visual-verification-mandatory.md`.

## Risks

**The scissored renderer is unproven here.** Standard technique, no in-repo
precedent. Spike first; the N-live budget is not a promise until measured.

**Archive liveness is unmeasured.** N concurrent `AnimationLoop` instances has
no benchmark. The cap is a measured number, not a guessed one, and the fallback
(static below a low cap) must be acceptable.

**Mandala has no poster.** Either it always renders live, or a poster is
generated at save time and backfilled. Cheapest medium to render, so
live-always is plausible, but it is a real asymmetry.

**Visibility is a migration.** Adding a field plus rules changes across three
collections, with a default-private backfill.

## Related

- `.claude/rules/4k-native-layout.md`, `visual-verification-mandatory.md`,
  `never-hand-roll.md`, `simplified-word-display.md`
- `docs/superpowers/specs/2026-07-10-save-a-3d-scene-collection-design.md`
- Memory: `project_unified_gpu_render_pipeline`, `project_collections_module`
