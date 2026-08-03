# Notation Archive and Fan Relation Lab — Handoff (2026-08-03)

## Mission

Continue the notation-history redesign and the fan-relation research without
collapsing three different things into one taxonomy: historical notation work,
the fan community's static letter relations, and The Kinetic Alphabet's finite
motion system. The current implementation is governed by the
[CAP exhibit redesign](./2026-08-01-notation-caps-exhibit-redesign.md), the
[4K density correction](./2026-08-02-notation-caps-4k-density-correction.md),
and the [Fan Relation Lab design](./2026-08-02-fan-relation-lab-design.md).
Read the earlier
[fan alphabet research handoff](../handoffs/2026-08-02-fan-alphabet-notation-handoff.md)
as source history, then use this document as the delta containing Austen's
later corrections and the implementation state.

## Done — verified

### The public notation route is a history, not a letter index

Commit `42555eaa9a` promoted the playable chronological archive to `/notation`
and made the CAP trochoid model interactive. Commit `e2d581d675` added the
piecewise CAP assembly model, reconstructed the published plots, and regenerated
the clean SVGs. Commit `45ef4587cc` labels the homepage destination **History**;
the homepage and sitemap no longer link to `/notation/letters`.

Evidence at local `main` on 2026-08-03:

```text
pnpm exec vitest run --config tests/config/vitest.config.ts \
  tests/unit/caps-trochoid-model.test.ts \
  tests/unit/notation-playable-archive-contract.test.ts \
  tests/unit/notation-playable-archive-state.test.ts

3 files passed, 26 tests passed (included in the 52-test run below).

pnpm exec vitest run --config tests/config/vitest.config.ts \
  tests/unit/homepage-public-links-contract.test.ts \
  tests/unit/notation-roots-remediation-contract.test.ts

2 files passed, 24 tests passed.

GET https://localhost:5173/notation       -> 200, 475489 bytes
GET https://localhost:5173/notation/caps  -> 200, 527745 bytes
```

### The fan source record is preserved with cautious attribution

Commit `8790a6a88e` added `docs/reference/fan-letter-relations.md` and the
2026-08-02 research handoff. Clarissa Ohm is credited as the person who
documented the fullest published enumeration. The originator remains unknown.
The raw transcript is research material, not public-page copy.

This source record is evidence of what Clarissa said. It is not TKA canon and it
must not be silently rewritten when Austen's physical observations disagree.

### Big Fan and the Fan Relation Lab are active

Commit `4d01a3a636` restored Big Fan as a selectable first-class prop and added
`/lab/fan-relations`. The lab separates hand placement, local orientation, fan
presentation plane, and camera viewpoint. C, CC, I, S, X, O, and W remain manual
working labels. The lab deliberately does not infer a relation.

Evidence at local `main` on 2026-08-03:

```text
tests/unit/fan-relation-geometry.test.ts     9 passed
tests/unit/big-fan-reactivation.test.ts      4 passed
GET https://localhost:5173/lab/fan-relations -> 200, 50963 bytes
```

### Fan reach now uses a prop-aware grid and body response

Commit `ea476cdcaa` carries the shared scene patch and fan reach changes. The
fan lab no longer borrows the staff grid's hand radius. At the default
proportions the fan hand ring is about `0.41472 m`, bounded between `0.34 m` and
`0.42 m`. Big Fan enlarges the visible outer field without pushing the grips
farther apart. Cross-body demand advances the wall plane from `0.30 m` to a
maximum of `0.42 m` in front of the performer.

The same commit corrects a real sign error in `SpineTwister`: the performer's
left hand crosses the body at positive X and the right hand crosses at negative
X. Symmetric crossing now carries the upper body forward. A one-sided crossing
also turns toward the reaching hand.

Evidence at local `main` on 2026-08-03:

```text
tests/unit/scene-3d-spine-reach.test.ts       3 passed
@austencloud/scene-3d SpineTwister.test.ts    7 passed
pnpm exec svelte-check --tsconfig ./tsconfig.json
0 errors, 0 warnings
```

### Interradials are Level 6

Commit `8c91fcf7e7` resolves the historical drift. Current canon is:

- Level 6: interradial orientations, completing one 2D grid.
- Level 7: conjoined grids, expanding the canvas after the single grid is
  complete.

The contrary Level 7 references came from January and early February 2026.
Commit `46b06cf797` deliberately swapped the order on 2026-02-22 under the
"complete, then expand" rationale. Current MCP, curriculum, glossary,
navigation, detector, and translated labels now agree.

Evidence at local `main` on 2026-08-03:

```text
tests/unit/level-feature-detector.test.ts  10 passed
```

The full focused run was:

```text
7 test files passed, 52 tests passed
```

## Believed done — unverified

### The new fan reach looks anatomically better

The geometry and solver outputs are proven, but the final GLTF pose has not been
visually inspected after commit `ea476cdcaa`. The prior Codex session did not
have Chrome DevTools MCP exposed. Route success and quaternion tests do not
prove that elbows, shoulders, hands, and fan grips look right together.

### The current fan-relation observations form a coherent model

Austen's later hands-on work resolved one major question: relations can survive
together and extended placements when the fan is physically large enough. That
supersedes the earlier attempt to define C as beta-only or X as alpha-only.
Placement supplies an example; it is not necessarily the relation's identity.

The following are useful observations, not classifier rules:

- CC has been demonstrated at an outer point plus center when both fans share a
  world-space heading. The center fan uses an absolute compass orientation.
- O uses opposite world-space headings across different placements.
- X has been demonstrated with fans facing toward one another across alpha and
  may extend to tau.
- W has a concrete interradial example: one hand at NE and the other at NW,
  with local compound orientations that make both fans point north.
- I is recognized by an audience-facing edge-on projection. The performer still
  needs the hidden in/out or upstage/downstage orientation recorded.
- S is not mapped well enough to encode.

No exhaustive matrix proves these observations yet. Keep the lab's relation
selector manual.

### The notation route is ready to replace production

The local routes compile and the focused contracts pass. A final visual sweep,
link audit, and deployment decision have not been recorded in this handoff.
Local `main` is ahead of `origin/main`; do not assume these commits are live.

## In flight

All implementation named above is committed on local `main`. The handoff itself
adds no application code.

At handoff time the working tree also contains unrelated untracked work owned by
other sessions:

- `.codex-qft-review.md`
- `.codex/visualizations/`
- `artifacts/`
- `scripts/tmp-sort-field-presence.mjs`
- `scripts/tmp-thumb-check.mjs`
- `tests/unit/browse/gallery-prefetcher.test.ts`
- `tka-share-test.png`

Preserve those files. Do not stage, delete, or fold them into this work.

## Loose ends (ranked)

### 1. Visually verify the fan lab and tune from evidence

Use the repository's shared Chrome DevTools target and inspect at the required
viewports. Start with these pose cases:

1. Big Fan, blue at W and red at E, wall plane, audience view. This is the
   symmetric crossed-hand stress case.
2. Big Fan, blue at E and red at W. This is the natural-side control.
3. One fan at center and one at an outer point. Confirm the center hand reaches
   forward without entering the chest.
4. Switch Audience, Stage right, and Above without changing the underlying
   state.

Check that grips meet hands, elbows do not invert, forearms clear the ribcage,
the upper body contributes without bowing excessively, and the fan-sized hand
ring reads independently from the outer fan extent. Tune the constants only
after screenshots identify a specific failure.

### 2. Turn the physical observations into a relation matrix

Add a separate **Austen observations** section to
`docs/reference/fan-letter-relations.md`. Do not alter Clarissa's transcript or
present her wording as settled geometry. For each candidate relation, enumerate:

- left and right grid locations;
- local orientations;
- derived world headings;
- presentation plane;
- viewpoint and projection;
- standard versus Big Fan physical feasibility;
- whether the case is observed, inferred, contradicted, or unknown.

Use the lab to capture counterexamples. A classifier is authorized only after
the matrix has no unresolved collisions between relation names.

### 3. Decide how fans enter the public notation history

Do not build a universal dictionary of every move name for every prop. Austen
does not want the notation section to become permanent maintenance of all flow
arts terminology. A fan page should document this one finite notation lineage,
credit the people who recorded it, link readers outward, and state its boundary
with TKA.

Austen is not ready to contact Clarissa. Do not draft or send outreach. The
existing recommendation is a dedicated fan-relations page framed as another
community's system, but this still needs approval after the matrix exists.

### 4. Resolve the Guide entry point separately

The letter index has been removed and the homepage notation destination is now
History. The Guide still points to public `/guide` from the homepage and header.
Austen proposed opening Flow Arts Composer in Learn mode with the guide sidebar
already open. That architecture is not implemented or approved yet.

Preserve the crawlable public guide routes for search and direct reading while
evaluating an app-first header/home entry. This needs its own spec because a
redirect-only change could throw away the public guide's indexable pages.

### 5. Run the replacement gate

After the fan visual pass and a public-link audit, compare local `/notation` and
`/notation/caps` against production, confirm no stale navigation descriptions,
then decide whether to push and deploy. Do not call the replacement complete
from local route checks alone.

## Decisions already made

All decisions below are Austen's calls from 2026-08-01 through 2026-08-03.

- **Notation means history on the public site.** It follows attempts to record
  and visualize flow arts. It is not a hidden second glossary.
- **The letter index stays removed.** Do not recreate it on the homepage.
- **The Guide belongs with learning.** The open question is how the public guide
  and the Composer's Learn mode divide that job.
- **Do not build an encyclopedia of every prop's tech names.** The purpose is a
  thread through finite or generative notation systems, not ownership of all
  flow-arts vocabulary.
- **TKA is not bounded by poi.** Earlier poi systems belong in the historical
  record. TKA's finite variable space applies across dual-wielded props and can
  express static-prop possibilities that poi-first systems do not foreground.
- **Attribution must be factual.** Credit creators for the work supported by a
  source. Do not include Forest Stearns merely for making a logo. Do not invent
  an originator for the fan alphabet.
- **Original CAP images are archival evidence.** The clean mathematical model is
  the primary explanation. Ancient forum pages should not be the only way a
  curious reader can understand the model.
- **Fan relations remain manual research labels.** No automatic C/CC/I/S/X/O/W
  inference until the geometry is exhaustively mapped.
- **Fan size affects physical feasibility, not necessarily relation identity.**
  Together and extended examples may describe the same relation.
- **Fan scenes use a prop-aware grid.** Grip reach and visible prop extent are
  separate quantities. The wall plane may advance when the pose requires chest
  clearance, and the performer's torso and shoulders may contribute.
- **Use performer/avatar language.** Do not assign the model a gender.
- **Level 6 is interradials; Level 7 is conjoined grids.** The curriculum
  completes one grid before expanding it.
- **No outreach yet.** Austen will write any eventual message personally.

## Gotchas

- Blue is the performer's left hand; red is the performer's right hand. From an
  audience-facing camera those screen sides appear reversed. Cross-body signs
  are therefore left at positive X and right at negative X. The old solver had
  these signs backward.
- `FanRelationScene.svelte` advances the prop anchor groups in Z. `Avatar3D`
  reads the anchors' world positions through `bluePropAnchorRef` and
  `redPropAnchorRef`. Moving only the rendered mesh or only the grid would break
  the IK target alignment.
- The fan grid has two radii. `handRadius` is for grips. `outerRadius` is the
  visible fan extent. Do not grow the hand radius merely because Big Fan is
  larger.
- The shared scene dependency is patched through
  `patches/@austencloud__scene-3d@0.1.6.patch`, with registrations in
  `pnpm-workspace.yaml` and `pnpm-lock.yaml`. The patch includes both Big Fan
  scale and `SpineTwister` changes. Regenerate the patch and hash if dependency
  source changes; do not rely on an unrecorded `node_modules` edit.
- Commit `ea476cdcaa` also contains museum preview, camera, and shared grid work.
  Do not revert the whole commit to alter fan reach.
- The 2026-08-02 fan research handoff predates Austen's physical experiments.
  Its "Believed done" mappings are historical context, not current truth.
- Clarissa's source descriptions and Austen's observations must stay visibly
  distinct. Attribution does not require treating every claim as correct.
- The dev server is HTTPS at `https://localhost:5173`. Port 5173 belongs to
  Austen's VS Code session and must not be restarted or killed.
