# Smart Collection Responsive Composer Audit — Handoff (2026-08-02)

## Mission

Finish the Smart Collection experience so every screen, transition, and interaction feels intentionally composed for the exact space available. Austen asked Fable to lead a cold audit with Opus and subagents, then continue the implementation until no user is left thinking “huh, weird.” Treat the existing work as a candidate, not an approved result. The product foundation is described in [the Smart Collections design](shipped/2026-07-06-smart-collections-design.md), and the review workbench is at `https://localhost:5173/test/smart-collections`.

The quality bar is not merely “nothing overflows.” At each moment, the current decision must be obvious, every relevant action must be visible and comfortably tappable, irrelevant information must recede, navigation must preserve the user’s mental model, and larger displays must gain a better composition rather than a scaled-up phone flow.

## Done — verified

All implementation below is currently **uncommitted** on `main`; there is no implementation SHA to cherry-pick. The checkout base at handoff time is `90a5e0cea6`.

### Desktop catalog/editor composition

- `GalleryDrill.svelte` now accepts `persistentDesktopCatalog`, renders a persistent category catalog beside the active editor at desktop container widths, highlights the active category, and suppresses the redundant Back control in that composition.
- `SmartCollectionBuilderSheet.svelte` enables that composition for Smart Collections.
- At 1440 × 900, the filter catalog and active editor receive the modal canvas without forcing a live-preview column.
- At 1920 × 1080 and wider, the catalog/editor remains bounded while live matching results use the remaining width.
- At 2560 × 1440 and 3840 × 2160, the decision controls remain capped instead of expanding into oversized monuments.
- Evidence: Chrome DevTools visual passes on 2026-08-02 at 1440 × 900, 1920 × 1080, 2560 × 1440, and 3840 × 2160. The 1920 interaction pass switched from Length to Start position without dismissing the catalog or results. Persisted screenshots from the final sweep are at `C:\Users\Austen\AppData\Local\Temp\smart-collections-2560.webp` and `C:\Users\Austen\AppData\Local\Temp\smart-collections-3840.webp`.
- Loaded-state 4K geometry evidence from Chrome DevTools: `pageOverflowX=0`, `modalOverflowX=0`, `drillOverflowX=0`, `drillOverflowY=0`; the catalog was visible; seven visible Length options were each at least 163.5 × 224 CSS pixels.

### Compact-layout isolation

- The persistent desktop catalog is opt-in and defaults to false, so other `GalleryDrill` hosts retain their existing behavior.
- At 375 × 667, the desktop catalog is hidden, all seven Length choices remain on screen, Back is 44 × 44, each value choice is 82.4 × 112, and there is no page, modal, drill X, or drill Y overflow.
- Evidence: Chrome DevTools visual passes on 2026-08-02 at 375 × 667, 960 × 412, and 820 × 1180, followed by the loaded-state DOM geometry query above.

### Preview consistency

- The first-filter desktop composition can show a live result grid when data already exists.
- The preview body now keys off error, loading, and `engine.resultCount`; it no longer says “Choose a filter to start” under a heading that already reports a nonzero match count.
- Evidence: the 1920 × 1080 pass showed `1412 matches` with populated sequence cards, and switching filter categories left the preview visible.

### Targeted code checks

- `pnpm exec prettier --check src/lib/features/browse/gallery-home/GalleryDrill.svelte src/lib/features/browse/collections/components/SmartCollectionBuilderSheet.svelte` passed on 2026-08-02.
- `git diff --check -- src/lib/features/browse/gallery-home/GalleryDrill.svelte src/lib/features/browse/collections/components/SmartCollectionBuilderSheet.svelte` passed on 2026-08-02.
- `pnpm exec stylelint src/lib/features/browse/gallery-home/GalleryDrill.svelte src/lib/features/browse/collections/components/SmartCollectionBuilderSheet.svelte` completed with 0 errors and 13 pre-existing `declaration-no-important` warnings in `GalleryDrill.svelte`.
- Chrome DevTools reported no console errors or warnings on the final task-owned page. Debug-only static-manifest misses and a DevTools CSP `eval` issue were present in preserved history; do not report the entire console as empty.

## Believed done — unverified

These areas look promising but have not earned a “done” claim:

- The desktop composer was visually checked in representative Length, Start position, chooser, and result-preview states. Every other category was **not** re-audited at every desktop viewport after the final composer CSS landed.
- The compact Phone, Z Fold cover landscape, and Tablet Length layouts survived the desktop change, but the full Step 2 state matrix was not repeated after the final patch.
- The warm-cache work in `gallery-prefetcher.ts` and `SmartCollectionBuilderSheet.svelte` should make category controls appear before Firebase completes, but no cold-start and warm-start performance trace proves it.
- Unified access to all ten filter categories is implemented in the chooser. The production path still needs a deliberate interaction audit to confirm that returning from every editor lands in the right conceptual place and never resets unexpectedly.
- The first-filter desktop preview is useful at 1920+, but its card affordances still need review. Earlier feedback called out cards that appeared hoverable/clickable while doing nothing.
- Suggested collection names and save-with-suggestion behavior exist, but have not been re-tested through a real save after this layout pass.
- The full repository fast check is not green. An earlier `pnpm run check:fast` reached the target files without target errors, then failed on unrelated existing Museum, SEO missing-file, recorder, geometry, QR, and conversion work. Do not infer that the Smart Collection diff is type-safe merely from that partial run; isolate and prove target regressions during pickup without starting a second machine-wide `svelte-check`.

## In flight

### Relevant uncommitted files

The Smart Collection redesign is distributed across these modified files:

- `src/lib/features/browse/collections/components/MyCollectionsPanel.svelte` — creation entry affordance.
- `src/lib/features/browse/collections/components/SmartCollectionBuilderSheet.svelte` — focused modal, responsive workspace, suggested name, rule state, preview, save/cancel behavior, and gallery prewarm call.
- `src/lib/features/browse/gallery-home/GalleryDrill.svelte` — every filter category/editor and most responsive composition logic. This file contains a large accumulated redesign diff, not just the latest desktop patch.
- `src/lib/features/browse/shared/services/gallery-prefetcher.ts` — cache-first warm path.
- `src/routes/test/smart-collections/+page.svelte` — seven-step approval workbench, ten exact review viewports, and component-state selectors.
- `src/routes/test/smart-collections/_components/SmartCollectionReviewFrame.svelte` — real component fixtures mounted in the review frame.

At handoff time those six files total roughly 2,499 insertions and 579 deletions relative to `90a5e0cea6`; `GalleryDrill.svelte` accounts for most of that. Do not use a broad revert or assume every line belongs to the last desktop pass.

### Repository state

- Branch: `main`.
- Worktree: heavily dirty with many unrelated concurrent changes. Preserve them.
- No branch or worktree was created.
- No Smart Collection implementation commit exists yet.
- The shared Git index must be treated as live. Scope any commit with explicit pathspecs.
- Review route: `https://localhost:5173/test/smart-collections`.
- Review state is stored under `tka-smart-collection-review-v1` in local storage. The last known formal gate was 1 of 7 approved: Step 1 approved, Step 2 marked needs changes, Steps 3–7 not reviewed. Austen later verbally approved the Tablet composition, not all of Step 2.

## Loose ends (ranked)

### 1. Run the cold audit before making more layout changes

Fable should use Opus as the lead reviewer and split read-only audit coverage among subagents before centralizing fixes. Suggested partitions:

1. Compact: Phone 375 × 667, Z Fold cover portrait 412 × 960, Z Fold cover landscape 960 × 412.
2. Fold and Tablet: Z Fold open portrait 750 × 832, open landscape 832 × 750, Tablet 820 × 1180.
3. Desktop: 1440 × 900, 1920 × 1080, 2560 × 1440, 3840 × 2160.
4. Cross-cutting interaction, accessibility, loading, and save-path audit.

Audit first, then let one owner reconcile fixes. Do not let multiple workers independently rewrite `GalleryDrill.svelte`.

### 2. Exhaust the review workbench matrix

The workbench exposes ten viewports and these states:

- Step 1: entry point.
- Step 2: chooser, Level, Length, Starting letter, Start position, Grid mode, LOOPs, Creator, Timing & Direction, Max turn intensity.
- Step 3: focused result set, dense result set, filter chooser, and the same nine category editors.
- Step 4: Community, My Library, counting.
- Step 5: suggested name, custom/long name.
- Step 6: personal, built-in, long name.
- Step 7: empty, loading, error, built-in.

Inspect every rendered state at every viewport. Record a screenshot and verdict for each. A pass means more than no overflow: visual hierarchy, density, readable examples, touch size, text wrapping, alignment, focus, exit path, and semantic consistency all have to make sense.

### 3. Test real navigation, not only forced variants

Walk the production interaction path from the Library entry:

- Open and close with X, Cancel, backdrop, Escape, and browser Back where applicable.
- Add each filter, remove each filter chip, edit/refilter an existing chip, and add another filter.
- Verify Back returns one conceptual level and never unexpectedly returns to the initial start screen.
- Verify persistent desktop category selection updates only the editor and preserves rule/preview state.
- Verify LOOPs and Timing & Direction multi-select, deselect, counts, active styling, and Done/apply semantics.
- Verify Max turn intensity slider keyboard, pointer, touch, live count, and commit behavior.
- Verify the collection name suggestion appears as a suggestion, is accepted without typing, is replaced cleanly, and does not block saving.
- Save, return to Library, open the new Smart Collection, edit the rule, and confirm live membership.

### 4. Re-profile loading and prewarming

Measure cold IndexedDB, warm IndexedDB, slow Firebase, offline/retry, and authenticated/unauthenticated paths. The category shell must render immediately; Firebase counts and art can hydrate without layout shift. Ensure prewarm does not duplicate network work, leak subscriptions, hide actual failures, or block modal opening.

### 5. Resolve preview-card affordance

The preview is explicitly read-only. If cards cannot open, remove hover elevation, pointer cursor, focusability, and any other affordance that promises an action. If opening a non-destructive preview is useful and consistent with Browse, implement that behavior deliberately. Do not leave inert controls that look interactive.

### 6. Audit every category’s information design

- Level: examples should be legible without becoming giant empty slabs.
- Length: distribute all seven values intentionally at every aspect ratio; avoid stranded cards or tiny type in a large void.
- Letters: use available space without crowding; keep all characters tappable and distinguishable.
- Start position: pictographs are the primary evidence and should dominate labels/counts where space permits.
- Grid mode: use readable dark-theme pictographs or direct rendering; Diamond and Box must be visibly different without squinting.
- LOOPs: use the canvas; avoid small rows floating between large dead zones.
- Creator: long names must never collide or wrap awkwardly; avatar, name, count, and examples should form one readable target.
- Timing & Direction: keep the six family icons; Austen explicitly removed redundant WATER/EARTH/SUN/FIRE/AIR/MOON words because the icon already communicates the family.
- Max turn intensity: slider is the current direction; prove that discrete stops, labeling, count feedback, touch targeting, and screen-reader semantics are better than cards.
- Recently added: verify its immediate-apply behavior is as clear as the editors rather than an unexplained exception.

### 7. Audit Steps 3–7 as production workflows

The current conversation concentrated on Step 2. The remaining formal gate is still open. Verify rule readability beside results, naming, save/error/disabled states, the return to Library, cards, opening, loading, empty, error, built-in, edit, and delete/options behavior across all ten layouts.

### 8. Run accessibility and motion checks

Prove focus trapping/restoration, logical tab order, visible focus, Escape behavior when dirty, 44 × 44 minimum compact targets, accessible names/states, color contrast, screen-reader announcements for match-count changes, and reduced-motion behavior. Check that hidden desktop/compact layers are not focusable.

### 9. Check other `GalleryDrill` consumers

`GalleryDrill.svelte` carries a large responsive diff. Search every host and visually smoke-test non-Smart-Collection browse flows. The new catalog is prop-gated, but shared base CSS and snippets may still regress other consumers.

### 10. Add focused regression coverage

No dedicated Smart Collection builder or `GalleryDrill` component test was found during this pass. Add tests for silent behavioral failures: Back semantics, multi-select persistence, suggested-name save fallback, preview/result consistency, compact catalog isolation, and any loading race found during audit. Do not substitute brittle screenshot snapshots for the required human visual sweep.

## Decisions already made

These are Austen’s decisions from the redesign conversation through 2026-08-02. Do not re-litigate them without new evidence:

- Smart Collection creation is a focused modal/workspace, not a narrow drawer.
- Naming must not be a barrier. Generate a useful suggestion from the active rule and allow saving it without requiring typing.
- The current product does not need a Community/My Library source toggle in this builder. Users can choose themselves through Creator; reclaim the space.
- Show all ten filter categories in one coherent chooser. Do not hide most of them behind “More filters” merely to preserve an arbitrary hierarchy.
- A Back action must return to the user’s actual prior decision level, not reset the builder.
- Avoid scrolling when the complete decision set can fit with an intentional composition. Do not force a three-column or vertical layout merely for consistency; choose the layout that fits the specific viewport and content.
- Different fold states and orientations deserve different compositions. Do not treat 412 × 960, 960 × 412, 750 × 832, and 832 × 750 as scaled phones.
- Tablet 820 × 1180 was verbally approved after its dedicated density pass. Preserve it unless audit evidence reveals a real regression.
- At desktop widths, use the canvas for simultaneous context. The accepted direction is a persistent filter catalog plus active editor, with live results added when width permits.
- At 4K, controls must remain human-sized. Extra space belongs to useful context/results, not giant selectors.
- Start-position and grid pictographs carry the decision and should be large enough to understand.
- Timing & Direction uses the six designed icons without redundant elemental words.
- Preview sequence cards must either perform a clear action or stop looking actionable.
- The review page must resize one live component tree; changing viewport controls must not reload the app.

## Acceptance test: “no huh, weird”

A state fails if any reasonable user might ask one of these questions:

- “What am I supposed to click next?”
- “Why is this control here now?”
- “Why did Back erase where I was?”
- “Why does this look clickable if nothing happens?”
- “Why is this tiny when the screen is huge?”
- “Why is this enormous when the content is small?”
- “Why do I have to scroll when everything could fit?”
- “Why did the layout change its interaction pattern?”
- “Why is the heading saying one thing while the content says another?”
- “Did my filter apply, or is this still loading?”

Do not approve a surface until none of those questions survives the audit.

## Gotchas

- Port 5173 is Austen’s HTTPS/2 VS Code server. Use `https://localhost:5173`; never start, stop, restart, or kill it.
- Use the repository Chrome launcher and one task-owned background tab. Apply exact viewports with DevTools emulation; do not resize the shared browser window or use device-scale launch flags.
- The review workbench iframe changes dimensions without reloading the mounted app. Preserve that behavior.
- Chrome may retain Austen’s page zoom. DevTools emulation can therefore report a CSS `innerWidth` different from the nominal emulated width at very large sizes; use element geometry and screenshots, not an assumption that browser zoom is 100%.
- Forced review variants seed `initialFilterSection`, but they do not prove actual navigation history. Always repeat critical flows through clicks/taps.
- The gallery pool and preview use real cache/Firebase timing. A warm review can hide the slow first-open problem.
- The final browser task tab from this session was page 71 and was closed after clearing emulation. Do not close other shared tabs.
- The full worktree has many unrelated edits and deletions. Never use `git reset --hard`, broad checkout/revert, `git add -A`, or an unscoped commit.
- `GalleryDrill.svelte` is already very large and responsive-rule dense. Before adding another override, identify the owning layer and delete or consolidate obsolete rules where safe. A cascade patch that fixes one screenshot can easily break a different aspect ratio.
- The two persisted 2560/4K screenshots are evidence of representative states, not proof of the complete matrix. Fable’s audit must generate its own current screenshots after any new patch.
