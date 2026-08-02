# TKA Public Platform Launch Video Strategy — Handoff (2026-07-30)

## Mission

Develop the public launch film for The Kinetic Alphabet and Flow Arts Composer.
This is not a version-release recap. The film must introduce the notation system,
show why it exists, and prove that Flow Arts Composer makes the system practical
to build with, animate, save, and share. No separate design spec exists yet;
this handoff is the strategy record and the starting point for the script.

## Source video and extracted strategy

Reference:
[“Veritasium - why he still gets views”](https://www.youtube.com/watch?v=QHhJ8_TJeNo),
published by The Internet Stamp on 2026-07-13. Runtime: 6:03.

The English auto-caption track was extracted with:

```powershell
yt-dlp --skip-download --write-auto-subs --sub-langs 'en-orig' `
  --sub-format 'vtt' `
  'https://www.youtube.com/watch?v=QHhJ8_TJeNo'
```

No transcript was added to the repository. The useful content was converted into
the following timestamped account:

- **0:00–0:21:** Complex Veritasium subjects establish the puzzle. Explanation
  quality and visuals alone do not account for the audience size.
- **0:21–1:20:** Derek Muller’s gravity experiment is introduced. Students
  average 6/26, praise a conventional explainer, then average 6.3/26. A video
  they describe as confusing raises the average to 11/26.
- **1:20–2:32:** The second video activates an incorrect mental model before
  correcting it. Familiar explanations let students feel that they already
  understand; a misconception creates a reason to listen.
- **2:32–3:45:** Titles and thumbnails should create a specific unresolved
  question instead of merely naming the topic.
- **3:45–4:41:** Ask the question before giving the explanation. The viewer
  becomes invested in the answer.
- **4:41–5:38:** Alternate an experiential or human A plot with a technical
  B plot before either becomes tiring.
- **5:41–6:03:** Final formula: misconception, question, explanation, then
  A-plot/B-plot alternation.

The usable mechanism is cognitive conflict, not muddy explanation:

```text
misconception -> specific question -> earned explanation
                         |
                  alternate A and B plots
```

Current YouTube guidance adds a third requirement the reference video
understates: performance is evaluated through **appeal, engagement, and
satisfaction**. Packaging must earn the click, the film must hold attention,
and the ending must deliver the value promised by the title and thumbnail.

Primary references:

- [Understand content performance for recommendations](https://support.google.com/youtube/answer/16559650?hl=en)
- [Thumbnail and title guidance](https://support.google.com/youtube/answer/12340300?hl=en)
- [A/B test titles and thumbnails](https://support.google.com/youtube/answer/16391400?hl=en)

YouTube Studio currently supports testing up to three title-and-thumbnail
combinations and chooses the winner by resulting watch time. Capture enough
material during production to support distinct thumbnail concepts.

## Launch thesis

The film should be built around a test, not a feature tour.

The working misconception:

> If a person watched the sequence, they understood the sequence.

The test:

1. Perform a short sequence.
2. Perform it again with one step changed.
3. Ask, “What changed?”
4. Replay both at full speed.
5. Reveal two TKA strips with the changed pictograph highlighted.

Working cold-open narration:

> Watch this once.
>
> Now watch it again. One step changed.
>
> Which one?
>
> Video kept both performances. The difference is still buried inside them.
>
> The Kinetic Alphabet writes that difference down.

The viewer experiences the same mechanism as Muller’s students: recognition
felt like understanding until a concrete test exposed the missing structure.

## Story structure

| Veritasium device | TKA launch-film version |
|---|---|
| Misconception | Watching movement means understanding its structure |
| Question | Can flow arts be written down? |
| A plot | Two nearly identical physical sequences and the changed-step challenge |
| B plot | One physical step becomes a pictograph, then part of a readable sequence |
| Payoff | Composer edits the step, animates the result, and passes it to another spinner |

The notation reveal should happen through one physical step:

```text
physical movement
      |
two hands and props on the grid
      |
paths and orientations appear
      |
one pictograph
      |
a named pattern
      |
a readable sequence
```

Teach one step well. Do not introduce the whole alphabet, all nine levels,
position terminology, turn theory, and LOOP transformations in the same film.
The viewer only needs to understand that the marks correspond to decisions the
body and props made.

## Recommended beat sheet

### 0:00–0:25: The test

Perform sequence A, perform altered sequence B, and ask what changed. Do not
open with a logo, founder history, or UI.

### 0:25–1:05: The system appears

Freeze the changed step. Build its pictograph around the performer: grid
positions, both prop orientations, then motion paths. Pull back to reveal the
written sequence.

### 1:05–1:50: Composer answers the question

Open that sequence in Flow Arts Composer. Select the changed step, replace it,
and show the animation update. Show that the constructor presents valid
continuations. The product behavior is the proof.

### 1:50–2:35: Another person reads it

The strongest A plot is a second spinner receiving the score or shared link
without seeing the original performance, then performing it. Cast someone who
already understands enough notation. Do not stage instant literacy.

If a second spinner is unavailable, reopen the written sequence after enough
time has passed that memory cannot carry the demonstration. This is weaker than
person-to-person transfer but still proves that the sequence survived its
original performance.

### 2:35–3:15: It becomes a platform

Save the sequence, publish it, and show it arriving in the public collection or
creator surface. This is supported by the shipped save path: a public save is
mirrored into the public index before a signed-in save reports completion.

### 3:15–3:45: Earn the spectacle

After the viewer understands the notation, show selected outputs such as a
mandala, tunnel, 3D performance, generated sequence, or physical card. These
images are payoff material. Leading with them risks producing admiration
without comprehension.

### 3:45–4:00: Name both entities

Working close:

> The Kinetic Alphabet is notation for flow arts.
>
> Flow Arts Composer is the software built on it.
>
> Open Composer at tkaflowarts.com.

Four minutes is a writing target, not a runtime requirement. The final cut
should be exactly long enough to complete the proof.

## Positioning

TKA and Composer should not receive equal introductions:

- **TKA is the answer.** It makes movement readable and editable.
- **Composer is the proof.** It makes the system practical to build with,
  animate, save, and share.
- **The platform is the consequence.** Written sequences can move between
  people instead of remaining inside one performance or clip.

The system works on paper and predates the application. Flow Arts Composer is
an instrument built for it, not the source of the notation.

Tracing the shipped product path changed the proposed ending. The sequence does
not need to stop at an export. The current source supports:

```text
Create -> LibrarySaveService -> LibraryRepository
       -> PublicIndexSyncer -> public browse surface
```

Relevant sources:

- [`src/routes/(public)/composer/+page.svelte`](<../../../src/routes/(public)/composer/+page.svelte>)
  defines the public product claims and current workflow.
- [`src/lib/shared/landing/faq/faq-items.ts`](../../../src/lib/shared/landing/faq/faq-items.ts)
  owns the public explanation of video versus notation and the current sharing
  claims.
- [`src/lib/shared/notation/notation-catalog.ts`](../../../src/lib/shared/notation/notation-catalog.ts)
  places TKA in the documented notation lineage.
- [`docs/architecture/save-paths.md`](../../architecture/save-paths.md)
  documents the public-index boundary.
- [`src/lib/shared/library/services/library-repository.ts`](../../../src/lib/shared/library/services/library-repository.ts)
  awaits `syncToPublicIndex` for a public save.

## Domain grounding

The Flow Arts Knowledge MCP was queried on 2026-07-30 using
`get_alphabet_info`, `get_domain_topic("static-props")`,
`get_domain_topic("combinatorial-space")`, and
`get_domain_topic("level-system")`.

Grounded facts used by this strategy:

- TKA is a notation system for flow arts built around double staves.
- One pictograph represents one step and shows both props, their positions, and
  the corresponding motion information.
- Directly gripped static props can use the system, but double staves remain
  canonical.
- The parameter space is finite and organized into levels.
- Grip changes, tosses, contact rolling, and some other movement categories are
  outside the current model.

These facts must be queried through the MCP again in any future turn that states
them. This handoff is not a substitute for the current-turn grounding rule.

## Packaging

Recommended primary title:

**Can You Write Down Flow Arts? | The Kinetic Alphabet**

Recommended challenger:

**What Video Misses About Flow Arts | The Kinetic Alphabet**

The primary is the stronger public-launch title. It introduces the category
without treating video as an enemy. The challenger creates more tension but
could imply that recordings and notation are competing formats.

Primary thumbnail:

- Real performed position on one side.
- Corresponding TKA score on the other.
- Physical props aligned with the marks across the split.
- No UI collage.
- Product mark may appear small, but the visual relationship must carry the
  image.

Capture a separate changed-step thumbnail option during the shoot: two similar
physical frames with the differing score cell highlighted.

## Guardrails

- Do not claim TKA covers every prop or every form of movement.
- Do not call it the first notation system for flow arts. The public notation
  catalog documents multiple predecessors and peers.
- Do not imply that Composer automatically transcribes arbitrary video.
- Do not imply that every prop visual in Composer has a complete equivalent
  physical movement model.
- Do not lead with mandalas, tunnels, 3D scenes, games, or the generator.
- Do not turn the film into a list of modules.
- Do not use a second spinner as staged proof unless the person can genuinely
  read the presented material.
- Keep one spoken CTA. The description can link separately to `/notation` and
  `/composer`.

## Done — verified

- **Reference-video structure recovered and analyzed.**
  Commit: none; research only.
  Evidence: `yt-dlp --dump-single-json` returned video
  `QHhJ8_TJeNo`, title `Veritasium - why he still gets views`,
  uploader `The Internet Stamp`, duration `363`, and English automatic
  captions. The `en-orig` VTT was downloaded and parsed by timestamp.
- **Current YouTube recommendation and packaging guidance checked.**
  Commit: none; research only.
  Evidence: the official YouTube Help pages linked above document
  appeal/engagement/satisfaction, title-and-thumbnail accuracy, and native
  A/B testing.
- **One real product path traced.**
  Commit: none; source review only.
  Evidence:
  `LibrarySaveService.saveSequence()` calls
  `LibraryRepository.saveSequenceWithMetadata()`;
  `LibraryRepository.saveSequence()` awaits
  `PublicIndexSyncer.syncToPublicIndex()` for public saves; the syncer updates
  the public collection and browse cache.
- **TKA facts checked at the required domain source.**
  Commit: none; MCP research only.
  Evidence: the four Flow Arts Knowledge MCP calls listed under
  “Domain grounding.”
- **No product, film, or application files changed in this strategy session.**
  Commit: none.

## Believed done — unverified

- The changed-step opening is the strongest current creative direction. It has
  not been tested on a cold audience.
- The primary title and thumbnail concept have not been tested in YouTube
  Studio.
- A four-minute structure appears sufficient on paper. No narration timing or
  assembly edit exists.
- The person-to-person reading demonstration is the strongest proof concept.
  Casting, notation fluency, and filming feasibility remain unverified.
- No exact sequence pair has been selected or physically rehearsed.

## In flight

Branch: `main`.

No film asset, script, storyboard, or product file is in flight from this
session. This handoff is the only owned repository change.

The shared working tree was already dirty before this handoff. These paths
belong to other live work and must not be staged, reverted, or folded into a
video-strategy commit:

```text
 M src/lib/features/browse/collections/components/AllLibraryView.svelte
 M src/lib/features/create/construct/start-position-picker/components/StartPositionPicker.svelte
 M src/lib/features/create/construct/start-position-picker/components/StartPositionPicker.svelte.test.ts
 M src/lib/features/create/generate/components/CardBasedSettingsContainer.svelte
 M src/lib/features/create/shared/components/ConstructTabContent.svelte
 M src/lib/features/create/shared/components/CreationToolPanelSlot.svelte
 M src/lib/features/create/shared/services/undo-manager.ts
 M src/lib/features/create/shared/state/create-module/undo-controller.svelte.ts
 M src/lib/features/create/shared/workspace-panel/shared/components/buttons/UndoButton.svelte
 M src/lib/features/lab/components/screenshots/ScreenshotGallery.svelte
 D src/lib/features/lab/components/screenshots/SelectionToolbar.svelte
 M src/lib/features/lab/components/screenshots/state/gallery-selection-state.svelte.ts
 M src/lib/features/library/components/collection-picker/CollectionPickerContent.svelte
 M src/lib/features/library/components/collection-picker/CollectionPickerContent.svelte.test.ts
 M src/lib/features/library/components/collection-picker/CollectionPickerHost.svelte
 M src/lib/features/library/components/collection-picker/CollectionPickerSheet.svelte
 M src/lib/features/library/state/__tests__/collections-state.test.ts
 M src/lib/features/library/state/collection-picker-state.svelte.ts
 M src/lib/features/library/state/collections-state.svelte.ts
 M src/lib/shared/browse/components/BrowseGrid.svelte
 M src/lib/shared/browse/components/BrowsePanel.svelte
 M src/lib/shared/browse/components/BrowseToolbar.svelte
 M src/lib/shared/browse/components/ChoreoCardThumbnail/ChoreoCardThumbnail.svelte
 M src/lib/shared/browse/components/SectionedVirtualGrid.svelte
 M src/lib/shared/browse/components/VirtualizedSequenceGrid.svelte
 M src/lib/shared/library/services/collection-manager.ts
 M tests/unit/library/collection-manager-profile-count.test.ts
?? artifacts/
?? scripts/tmp-sort-field-presence.mjs
?? scripts/tmp-thumb-check.mjs
?? src/lib/shared/components/selection/SelectionToolbar.svelte
?? src/lib/shared/selection/state/
?? tests/unit/create/clear-sequence-undo.test.ts
?? tests/unit/selection/
?? tka-share-test.png
```

## Loose ends (ranked)

1. **Build and test the changed-step experiment.**
   Select a short, readable pair of physically valid sequences with exactly one
   changed step. Use Flow Arts MCP data and rendering tools only. For a
   length-based generation request, use `constraintPreset: "smooth"`.
2. **Test the cold open before writing the whole script.**
   Show the two performances to a small set of flow artists without context.
   Record whether they can identify the changed step and what they believe the
   film is about.
3. **Write the complete narration and shot list.**
   Time every line against real footage. Keep the one-step system explanation
   intact and cut feature-list detours.
4. **Prove the A plot.**
   Cast and rehearse the second-spinner transfer demonstration. Confirm what
   source material they receive and what prior TKA knowledge they have.
5. **Storyboard the system reveal.**
   Plan the physical freeze, grid registration, arrows, pictograph, letter, and
   full sequence without hand-drawing TKA output.
6. **Choose the payoff outputs.**
   Limit the final montage to the outputs that best demonstrate consequences of
   written structure. Do not give every module equal time.
7. **Produce packaging variants.**
   Shoot the primary performer/score thumbnail and a distinct changed-step
   challenger. Prepare title combinations for YouTube Studio testing.
8. **Plan the stable watch page.**
   Publish the final video with a visible transcript, useful stills, direct
   `/notation` and `/composer` links, and matching video metadata.

## Decisions already made

Explicit Austen decisions from 2026-07-30:

- This is a **public platform launch**, not a normal version-release video.
- The launch must introduce **the system itself**, not only Flow Arts Composer.
- Preserve this strategy as a handoff for continuation.

Current working recommendations, preserved but not recorded as separately
approved Austen decisions:

- Build the film around the changed-step test.
- Treat TKA as the answer, Composer as the proof, and the public platform as the
  consequence.
- Use person-to-person transfer as the A-plot proof.
- Hold the most spectacular outputs until the viewer understands one step.
- Lead packaging with “Can You Write Down Flow Arts?”

## Gotchas

- TKA domain claims require a Flow Arts Knowledge MCP call in the current turn.
  Do not treat this handoff, application source, or memory as domain authority.
- TKA pictographs and sequences may only be rendered with
  `generate_pictograph` and `generate_sequence` MCP tools. If the MCP is
  unavailable, stop and ask Austen to restart Codex.
- A named-word sequence with creative freedom triggers the humor-pair workflow
  and requires a tagline choice before generation. Avoid that requirement by
  starting with a length-based or letter-constrained test sequence.
- Port 5173 is Austen’s HTTPS/2 development server. Never stop or restart it.
- The Git index is shared. Commit only explicit owned paths.
- Do not create a branch or worktree unless Austen explicitly requests one in
  the current conversation.
- The full source-video transcript cannot be reproduced in the handoff. The
  timestamped account above contains the complete strategic argument without
  copying the script.
- The repo contains roadmap work for camera-based notation. Do not present that
  as a shipped launch capability.
