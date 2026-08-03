# Choreo — MCP Act Control + Performance Variants (handoff)

**Date:** 2026-07-26
**Branch:** `main` (all work committed and pushed to the primary checkout)
**Previous phase:** `docs/superpowers/specs/2026-07-25-choreo-gorgeous-4k-design.md` (shipped)

---

## Part 0 — Where things stand

This session was bug-fixing and instrumentation on `/choreo`. Everything below is
committed on `main`, typechecked (`npm run check`: 0 errors), and verified in a
real browser rather than by reasoning.

| Commit | What |
|---|---|
| `da6f91b418` | Toolbar recomposed (was 110px/two rows → 54px/one row), stage-fit control moved onto the stage, settled-with-holes stage state, `Crossfade` grid layers get `min-width: 0`, narrow-workspace stage collapse fixed |
| `a6fb0a80c5` | `firestoreGetDetailed` (found / absent / unknown / invalid); resolver stops reporting unanswered reads as deleted sequences |
| `93c4840094` | Page chrome (title block 186pt, running header 28pt) is now RESERVED by the band packer, the preview, and the PDF — fixes the clipped bottom row in portrait |
| `0589c54ecd` | Keyboard shortcuts (32, via the app's own shortcut subsystem), zoom control replacing Page/Width, click-to-select in Annotated, resolver no longer calls a zero-step document "missing" |
| `50ff7b5b16` | Ctrl combos dropped — `Ctrl+E`/`Ctrl+O` are browser-reserved and unclaimable |

### Things worth knowing before touching this module

- **The planner is complete-or-empty.** `planRows` returns `[]` unless EVERY
  roster row resolved. A sheet is never paginated, played, or exported around a
  hole, because row N+1 normalizes against row N−1 across a gap and silently
  produces a wrong sheet. Do not "just render what we have."
- **Preview and PDF must agree by construction, not by inspection.** They share
  `planSheet()` / `planBands()` / `getSheetPageLayout()` / `SHEET_CELL_VISIBILITY`.
  The clipped-row bug happened because page CHROME was outside that shared
  contract — the preview measured its own header, the PDF drew its own, and the
  packer knew about neither. `TITLE_BLOCK_PT` / `RUNNING_HEADER_PT` are now the
  single source; if you add page furniture, add it there too.
- **Resolution vocabulary.** `missing` means the server said absent. Everything
  else — read didn't reach the server, no identity yet, permission denied, doc
  present but zero steps — is retried and then reported as `permission` /
  `unreadable` / `transient`. Never widen `missing`.
- **Shortcuts live in the app's keyboard subsystem**, not in a component handler:
  `src/lib/shared/keyboard/registration/register-choreo-shortcuts.ts` holds the
  static definitions (so they appear in `?` and in Settings → Keyboard Shortcuts,
  rebindable, conflict-checked); `ChoreoSheetView` re-registers the same ids with
  live actions on mount.

### Open follow-ups (small, not blocking)

- `pictograph-cloud-cache` negative cache is session-scoped. Every reload
  re-probes the same un-warmed hashes → the 404 burst in the console. Persisting
  the miss set (24h TTL, same shape as `thumbnail-repair.ts`) would end it.
- Someone's in-flight edit left `src/routes/(public)/notation/+page.svelte` with a
  `<svelte:head>` inside an `{:else}` block. It breaks HMR for that route with a
  Vite overlay. Not mine to fix mid-edit; check whether it's still there.
- `Space` opens the act player; once open, the player's own `Space` owns
  playback, so `Space` won't close it (Escape does). Fine, but undocumented in
  the UI.

---

## Part 1 — MCP act control surface

**Goal:** an AI agent can do anything to an act that a human can do with the UI —
build it, reorder it, toggle every control, annotate it, export it, animate it.

### The fork that has to be decided first

The MCP server (`mcp-server/`, NSSM service on :3333) is a **separate Node
process**. Its dependencies are rendering and domain packages — `@tka/domain`,
`@tka/sequence-engine`, `@tka/render-core`, `@tka/render-composition`, `canvas`,
`resvg`. **It has no Firebase dependency and no access to the browser app's
state or the user's session.** So "an agent creates an act" means one of:

**A. Headless act documents.** MCP tools operate on an act as data — build a
`ChoreoSheet` (references + layout + annotations), render it, export the PDF,
produce the animation. Read/write to `users/{uid}/acts` requires adding a
Firestore admin path to the MCP server (`TKA_ADMIN=1` forces the admin SDK
elsewhere in this repo — see `project_public_mirror_admin_residual`). Nothing
needs the browser. This is almost certainly the right first move: the whole
sheet pipeline is already pure functions over data.

**B. Driving the live app.** A bridge into the running client so the agent
operates the actual UI state. Much more plumbing, only worth it for things that
genuinely have no headless equivalent.

Recommendation: **A**, and treat B as out of scope until something demands it.

### What the surface actually is

The act model is small and already serializable — this is the good news.
`ChoreoSheet` = `{ id, name, ownerId, sequenceIds[], layout, annotations,
createdAt, updatedAt }`. Everything the UI toggles is a field on `layout` or
`annotations`:

| UI control | Field |
|---|---|
| Step numbers | `layout.showStepNumbers` |
| Group separator | `layout.groupSeparator`: `rule \| gap \| none` |
| Sheet style | `layout.packing`: `flow` (Study) \| `aligned` (Annotated) |
| Pictograph size | `layout.columns` + `layout.rowsPerPage` (4/3, 6/4, 8/6) |
| Orientation | `layout.orientation` |
| Cue rail / Note strips | `layout.showCueRail` / `layout.showNoteStrips` |
| Title block fields | `annotations.header` |
| Cues | `annotations.cues[]` — `{ band, timestamp, text }` |
| Notes | `annotations.notes[]` — `{ id, band, count, text }` |
| Row order | `sequenceIds[]` order |

So the tool surface is roughly:

- `create_act` / `get_act` / `list_acts` / `save_act`
- `act_add_sequences(ids[], atIndex?)`, `act_remove_sequence(id)`,
  `act_reorder(from, to)`
- `act_set_layout(patch)` — one tool, partial patch, covers every toggle
- `act_set_header(patch)`
- `act_set_cue(band, {timestamp, text})`, `act_add_note(band, count, text)`,
  `act_set_note(id, text)`, `act_remove_note(id)`
- `export_act_pdf(actId)` → the PDF exporter is browser-coupled today
  (`pdf-lib` + rendered cells); porting it needs the same cell rendering the MCP
  server already does for `generate_sequence`, so this is real work but not
  novel work
- `render_act_page(actId, pageIndex)` → PNG, for an agent to *look* at the sheet
- `animate_act(actId)` → the act is already available as ONE continuous sequence
  via `buildActSequence(normalizedRows, name)`; that is the input an animation
  tool wants

**Do not re-implement the planner.** `planSheet` / `planBands` /
`getSheetPageLayout` are pure and already shared by the preview and the PDF. The
MCP tools must consume them, or the third surface will drift from the first two
exactly the way the page chrome did.

### One defect to fix before building on the annotation model

**Per-step notes are keyed to the LAYOUT, not to the sequence.** A note is
`{ band: "sequenceId:rowInSequence", count }` — and `rowInSequence` is derived by
chunking the sequence into rows of `layout.columns`. Change pictograph size from
Compact (8 columns) to Large (4 columns) and every band re-chunks: a note pinned
at `(band 0, count 5)` no longer addresses a cell, and `pinnedNotes()` silently
demotes it to a full-width bullet (`count > band.cells.length`).

So today a note attached to a specific step **moves or unpins when you change an
unrelated layout control.** That is already wrong for annotations, and it is
disqualifying for Part 2, where the note IS the data. Fix by addressing notes
with an absolute step index within the sequence and deriving `(band, count)` at
render time.

---

## Part 2 — Performance variants (the big idea)

### The observation

A TKA sequence is stored as **positions and motions** — the *what*. How a
performer executes those positions is a separate axis — the *how* — and the app
currently has no representation of it at all.

Two performers can execute byte-identical stored data and look nothing alike:
which hand leads, where the grip sits, which plane the movement passes through,
whether a transition goes over or under the shoulder, whether the body turns to
pass behind, the level, the timing feel, and — critically — the prop. The same
position pair is a roll on staves, an isolation on fans, and a different thing
again on clubs.

**The per-step note line in an act is where that information first gets typed.**
When you write "left thumb roll, pass behind on the body turn" under step 3,
you are not annotating the act. You are describing **a performance of that
sequence**. Same sequence in a different act with a different note is a
different performance.

### The claim

A sequence therefore has **many performances**, and a performance is worth
storing as a first-class thing:

```
PerformanceVariant {
  id
  sequenceId
  sequenceContentHash     // what it was authored against — see "staleness"
  name                    // "Paul's version" · "fans, low plane" · "jam default"
  propType?               // staff | fan | club | ... — the biggest single axis
  steps: PerformanceStep[]
  notes?                  // variant-level prose
}

PerformanceStep {
  stepIndex               // absolute index into sequence.steps, NOT band/count
  text                    // free-form. This is the capture surface AND the dataset.
  // Extracted later, never instead:
  // leadHand?, grip?, plane?, level?, bodyFacing?, technique?[]
}
```

An act then **references a variant** instead of owning loose notes. The same
sequence can appear in two acts with two different performances, and a variant
you worked out once is reusable rather than retyped.

### Why this is worth building

- **Teaching.** "Here is the same sequence performed three ways" is a thing TKA
  cannot currently express, and it is most of what teaching flow actually is.
- **Prop translation.** The positions are prop-agnostic by design; the technique
  is not. A variant per prop is the natural home for that difference, and it is
  the piece that makes "generate this for fans" mean something.
- **The long game.** Enough hand-written variants become a dataset that maps
  (positions + prop + constraints) → technique. That is Austen's stated end
  state: recognise the patterns well enough to predict how the requirements of
  movement translate across props under different conditions. You cannot train
  that on data you never captured, which is why the manual capture surface comes
  first and should be as low-friction as a text line under a step.

### Design principles to hold

1. **Free text first, structure later.** Do NOT invent a technique ontology
   before there are real examples. The text field is the dataset. When patterns
   emerge, add a parsed sidecar and *keep the original text forever* — the raw
   phrasing is the ground truth and the structure is a lossy derivative.
2. **Address steps absolutely.** `stepIndex` into the sequence, never
   `(band, count)`. See the layout-coupling defect in Part 1. A note about how
   you perform step 3 must survive changing the pictograph size.
3. **Version against content, not time.** Sequences get edited. Store the
   `contentHash` the variant was authored against (`LibrarySequenceDocSchema`
   already carries `contentHash` + `contentHashVersion`). On mismatch, show the
   variant as stale rather than silently mis-aligning technique notes onto
   different steps — the same "never guess when you can say you don't know"
   discipline the resolver now follows.
4. **The prop is not a decoration.** `propType` on the variant is load-bearing;
   most of what differs between performances differs *because* of the prop.
5. **Use the domain's own vocabulary.** TKA already has precise technique
   language — the thumb/pinky reference system, negative space above and below
   the shoulder, body turns to pass into the plane behind, gripped-directly vs
   other holds. Any structure extracted later should land on those terms, not on
   invented ones. Verify against MCP (`get_domain_topic`, `get_term_definition`)
   before writing any of it into a schema; per `.claude/rules/mcp-ground-truth.md`
   these are not facts to recall from memory.

### Open questions for the next session

- **Where does a variant live?** `users/{uid}/sequences/{id}/variants/{vid}` puts
  it with the sequence and inherits its access rules. A top-level collection
  makes cross-user variants (someone else's performance of your sequence)
  easier. The second is more interesting and more work.
- **Is a variant per-prop or does it hold per-prop branches?** One variant with a
  `propType` is simpler; one variant holding several prop treatments is closer to
  how a teacher thinks. Probably start with the former.
- **Migration.** Existing `annotations.notes` on saved acts are per-band. Any move
  to `stepIndex` needs a migration that resolves band+count → absolute index
  using the layout the act was saved with.
- **Does a variant belong to an act or to the library?** The claim above says the
  library (it describes the sequence, not the sheet). Worth pressure-testing —
  a note like "hit this on the drop" IS act-specific and belongs on the cue, not
  the variant. The split is probably: **cues are act-specific, performance notes
  are sequence-specific.** That is a clean line and it maps onto the two existing
  annotation types.

---

## First moves for the next session

1. Fix the note-addressing defect (Part 1, last section). It is small, it is a
   real bug today, and everything in Part 2 sits on top of it.
2. Decide the headless-vs-live fork. Recommend headless; write it down either way.
3. Stand up `mcp-server/src/tools/act-tools.ts` with the read/build/layout tools
   over a pure `ChoreoSheet` — no export, no animation yet. Prove an agent can
   compose and reorder an act end to end.
4. Then export/render, which is where the real porting work is.
5. Then variants — brainstorm properly first
   (`.claude/rules/brainstorming-gate.md`). Part 2 is a design sketch, not a spec.

## Files that matter

```
src/lib/features/write/
  domain/types/choreo-sheet.ts        the act model — small, serializable
  domain/sheet-page-layout.ts         geometry + TITLE_BLOCK_PT/RUNNING_HEADER_PT
  services/sheet-row-planner.ts       planSheet + planBands (pure, shared)
  services/sheet-pdf-exporter.ts      the export to port
  services/sheet-act-sequence.ts      buildActSequence — the act as one sequence
  services/sheet-sequence-resolver.ts classification + retry ladder
  services/choreo-sheet-repository.ts users/{uid}/acts persistence
  state/choreo-sheet-state.svelte.ts  the builder (roster, planner input, undo-free)
  components/sheet/ChoreoSheetView.svelte    host: toolbar, rail, stage, shortcuts
  components/sheet/SheetPreviewPages.svelte  both render branches

src/lib/shared/keyboard/registration/register-choreo-shortcuts.ts
mcp-server/src/tools/                 server.tool(name, desc, zodShape, handler)
```
