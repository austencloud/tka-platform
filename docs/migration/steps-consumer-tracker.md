# .steps Consumer Migration Tracker

> Tracks every `.steps` reference on `SequenceData` for migration to the
> three-tier compositional model (blueSoloProp + redSoloProp + stepPairings).

**Generated:** 2026-03-14
**Strategy:** Dual-storage during transition. `steps[]` continues to work.
Migrate consumers at any pace; remove `steps` field only after all consumers migrated.

---

## Summary

| Wave | Files | Description |
|------|-------|-------------|
| 1 (read-only) | 137 | Read `.steps` to iterate, count, display, or derive values |
| 2 (write/create) | 43 | Create or modify sequences with `steps` in constructors or spreads |
| 3 (complex mutation) | 10 | Direct step manipulation (push/pop/splice/reassign) |
| Skip | 23 | Composition infrastructure, MCP server, packages, tests, admin tooling |
| **Total** | **213** | Unique files with SequenceData `.steps` references |

Non-SequenceData `.steps` references (CSS classes, DOM elements, unrelated objects like
choo-choo config, PlatformInstructions, LOOPDesignator sort, MotionSignatureGenerator
locationDelta) are excluded from this tracker.

---

## Wave 1: Read-Only (137 files)

These only read `.steps` -- iterate, count, map, filter, access by index.
Simple substitution to `deriveSteps()` or no change needed if transitional getter is in place.

| File | Usage | Status |
|------|-------|--------|
| `src/routes/endless-spinner/+page.svelte` | Reads steps for letter/step lookup, passes to component | pending |
| `src/routes/sequence/[id]/+page.svelte` | Reads `steps.length` for beat count | pending |
| `src/routes/test/disassemble/+page.svelte` | Reads steps for letter/step lookup, checks length | pending |
| `src/routes/test/progress-in-context/+page.svelte` | Reads `steps.length` for total steps display | pending |
| `src/routes/test/render-compare/+page.svelte` | Iterates steps for rendering, reads length | pending |
| `src/routes/landing/components/LandingAnimationDemo.svelte` | Maps steps for prop type, reads for letter/step lookup | pending |
| `src/routes/api/batch-render/+server.ts` | Iterates steps for rendering, checks length | pending |
| `src/routes/api/tika/sequence/+server.ts` | Passes steps to response, reads length | pending |
| `src/lib/features/write/components/SequenceThumbnail.svelte` | Reads `steps.length` for beat count | pending |
| `src/lib/features/write/components/SequenceGrid.svelte` | Reads `steps.length` for display | pending |
| `src/lib/features/browse/shared/state/browse-state-factory.svelte.ts` | Reads `steps.length` for sequence length | pending |
| `src/lib/features/browse/shared/services/implementations/BrowseEventHandler.ts` | Checks `steps.length` for validation | pending |
| `src/lib/features/browse/sequences/navigation/services/implementations/Navigator.ts` | Reads `steps.length` for sequence length | pending |
| `src/lib/features/browse/sequences/display/services/implementations/ThumbnailRenderer.ts` | Reads steps for LOOP detection, checks length, reads first step | pending |
| `src/lib/features/browse/sequences/display/services/implementations/SequenceDetailLoader.ts` | Checks `steps.length` for empty detection | pending |
| `src/lib/features/browse/sequences/display/services/implementations/BrowseSectionManager.ts` | Reads steps for filtering/sorting | pending |
| `src/lib/features/browse/sequences/display/services/implementations/ClaudeCodeCopier.ts` | Reads steps for export | pending |
| `src/lib/features/browse/sequences/display/services/implementations/BrowseFilter.ts` | Reads steps for filtering | pending |
| `src/lib/features/browse/sequences/display/components/SequenceDetailContent.svelte` | Reads steps for display | pending |
| `src/lib/features/browse/sequences/display/components/PropAwareThumbnail.svelte` | Reads steps for prop detection | pending |
| `src/lib/features/browse/sequences/display/components/VirtualizedSequenceGrid.svelte` | Reads steps for display | pending |
| `src/lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte` | Reads steps for animation | pending |
| `src/lib/features/browse/creators/components/profile/ProfileTabs.svelte` | Reads steps for display | pending |
| `src/lib/features/gallery/services/implementations/ExhibitLoader.ts` | Filters sequences by `steps.length > 0` | pending |
| `src/lib/features/gallery/components/GalleryHUD.svelte` | Reads `steps.length` for beat count display | pending |
| `src/lib/features/gallery-generator/services/implementations/GalleryRenderer.ts` | Reads first step, iterates steps for rendering | pending |
| `src/lib/features/train/state/train-state.svelte.ts` | Reads `steps.length`, accesses step by index | pending |
| `src/lib/features/train/state/train-practice-state.svelte.ts` | Reads `steps.length` for step count | pending |
| `src/lib/features/train/components/SequenceBrowser.svelte` | Reads `steps.length` for step count display | pending |
| `src/lib/features/train/components/practice/PracticeViewContainer.svelte` | Reads `steps[0]` for prop type detection | pending |
| `src/lib/features/train/components/practice/PracticeBentoLayout.svelte` | Reads `steps[0]` for prop type, `steps.length` for count | pending |
| `src/lib/features/train/components/practice/GridSection.svelte` | Passes `steps` to component | pending |
| `src/lib/features/train/components/practice/CanvasSection.svelte` | Reads steps for letter/step lookup | pending |
| `src/lib/features/compose/timeline/services/implementations/TimelinePlaybackService.ts` | Reads `steps.length` for step count | pending |
| `src/lib/features/compose/timeline/domain/timeline-types.ts` | Reads `steps.length` for step count | pending |
| `src/lib/features/compose/timeline/components/TimelinePreview.svelte` | Reads steps for letter/step lookup, reads length | pending |
| `src/lib/features/compose/timeline/components/TimelinePanel.svelte` | Reads `steps.length` for recording duration | pending |
| `src/lib/features/compose/timeline/components/SourcePreview.svelte` | Reads steps for letter/step lookup | pending |
| `src/lib/features/compose/timeline/components/inspector/ClipInfoSection.svelte` | Reads `steps.length` for display | pending |
| `src/lib/features/compose/timeline/components/ClipInspector.svelte` | Reads `steps.length` for step count | pending |
| `src/lib/features/compose/timeline/components/media-browser/MediaSequenceCard.svelte` | Reads `steps.length` for display | pending |
| `src/lib/features/compose/tabs/playback/renderers/TunnelRenderer.svelte` | Reads steps for letter/step lookup | pending |
| `src/lib/features/compose/tabs/playback/renderers/SingleRenderer.svelte` | Reads steps for letter/step lookup | pending |
| `src/lib/features/compose/tabs/playback/renderers/GridRenderer.svelte` | Reads `steps.length` for display | pending |
| `src/lib/features/compose/tabs/playback/components/MobilePlaybackStepGrid.svelte` | Slices steps for display | pending |
| `src/lib/features/compose/tabs/browse/components/CompositionAnimatedPreview.svelte` | Reads `steps.length`, accesses steps by index | pending |
| `src/lib/features/compose/tabs/arrange/state/arrange-grid-state.svelte.ts` | Reads `steps.length` for beat count | pending |
| `src/lib/features/compose/tabs/arrange/services/implementations/ArrangeGridSerializer.ts` | Reads `steps.length`, accesses `steps[0]` | pending |
| `src/lib/features/compose/tabs/arrange/services/implementations/ArrangeBeatCalculator.ts` | Reads `steps.length` for beat count | pending |
| `src/lib/features/compose/tabs/arrange/components/grid/CellEditor.svelte` | Reads `steps.length` for beat count | pending |
| `src/lib/features/compose/tabs/arrange/components/grid/CellCanvas.svelte` | Reads steps for step lookup, reads length | pending |
| `src/lib/features/compose/compose/state/composition-state.svelte.ts` | Reads `steps.length` for step count | pending |
| `src/lib/features/compose/compose/components/canvas/CellRenderer.svelte` | Reads steps for step lookup | pending |
| `src/lib/features/compose/services/implementations/VideoPreRenderer.ts` | Reads `steps.length`, slices steps for fingerprint | pending |
| `src/lib/features/compose/services/implementations/CompositeVideoRenderer.ts` | Reads `steps.length` for step count | pending |
| `src/lib/features/compose/services/implementations/SequenceLoopabilityChecker.ts` | Reads steps array | pending |
| `src/lib/features/compose/services/implementations/TunnelModeSequenceManager.ts` | Checks `steps.length`, validates motion data | pending |
| `src/lib/features/compose/services/implementations/TrailPathGenerator.ts` | Reads `steps.length` for total steps | pending |
| `src/lib/features/choreo-card/services/implementations/SequenceToEntryConverter.ts` | Reads `steps.length`, iterates steps | pending |
| `src/lib/features/choreo-card/services/implementations/DeckLoader.ts` | Reads `steps` for hydration | pending |
| `src/lib/features/choreo-card/components/ChoreoCard.svelte` | Reads `steps.length` for level calc | pending |
| `src/lib/features/choreo-card/components/ChoreoCardTab.svelte` | Reads `steps.length` for difficulty | pending |
| `src/lib/features/choreo-card/components/ChoreoCardExport.svelte` | Checks `steps.length` for validation | pending |
| `src/lib/features/loop-labeler/services/implementations/SequenceFeatureExtractor.ts` | Reads steps for feature extraction, filters blanks | pending |
| `src/lib/features/loop-labeler/components/LOOPLabelerModule.svelte` | Reads `parsedData.steps`, iterates section steps | pending |
| `src/lib/features/loop-labeler/components/shared/SavedSectionsList.svelte` | Reads section steps for display | pending |
| `src/lib/features/loop-labeler/components/panels/designations/DesignationsList.svelte` | Reads section steps for display | pending |
| `src/lib/features/create/generate/circular/services/implementations/OrientationCycleDetector.ts` | Reads steps array for cycle detection | pending |
| `src/lib/features/create/generate/circular/services/implementations/LOOPDetector.ts` | Reads steps array for LOOP detection | pending |
| `src/lib/features/create/shared/components/StandardWorkspaceLayout.svelte` | Checks `steps.length` for has-step | pending |
| `src/lib/features/create/shared/components/sequence-actions/TurnPatternDrawer.svelte` | Reads `steps.length`, iterates steps for display | pending |
| `src/lib/features/create/shared/components/sequence-actions/RotationDirectionDrawer.svelte` | Reads `steps.length` for display | pending |
| `src/lib/features/create/shared/components/sequence-actions/DurationPatternDrawer.svelte` | Maps steps for durations, reads length | pending |
| `src/lib/features/create/shared/components/sequence-actions/DurationPreviewWorkspace.svelte` | Reads `steps.length`, iterates steps for duration calc | pending |
| `src/lib/features/create/shared/components/sequence-actions/StepEditorPanel.svelte` | Reads `steps.length`, reduces steps | pending |
| `src/lib/features/create/shared/components/sequence-actions/SequencePreviewDialog.svelte` | Reads `steps.length`, passes steps to component | pending |
| `src/lib/features/create/shared/components/sequence-actions/SequenceActionsPanel.svelte` | Checks `steps.length >= 2`, passes steps | pending |
| `src/lib/features/create/shared/components/sequence-actions/rotation-direction/SaveModePanel.svelte` | Reads `steps.length`, iterates steps | pending |
| `src/lib/features/create/shared/components/SaveToLibraryPanel.svelte` | Maps steps for letters, reads `steps.length` | pending |
| `src/lib/features/create/shared/components/CreationToolPanelSlot.svelte` | Spreads steps with start position | pending |
| `src/lib/features/create/shared/components/CreateModule.svelte` | Accesses `steps[0]`, checks `steps.length` | pending |
| `src/lib/features/create/shared/components/coordinators/SequenceDrawerHost.svelte` | Reads steps for letter/step lookup, fingerprinting | pending |
| `src/lib/features/create/shared/components/coordinators/VideoRecordCoordinator.svelte` | Reads `steps.length` for step count | pending |
| `src/lib/features/create/shared/workspace-panel/shared/components/buttons/SaveToLibraryButton.svelte` | Checks `steps.length > 0` | pending |
| `src/lib/features/create/shared/state/create-module-state.svelte.ts` | Checks `steps.length > 0` for has-step | pending |
| `src/lib/features/create/shared/state/managers/AutoEditPanelManager.svelte.ts` | Accesses steps by index | pending |
| `src/lib/features/create/shared/state/persistence/SequencePersistenceCoordinator.svelte.ts` | Reads `steps.length` for sequence length | pending |
| `src/lib/features/create/shared/state/construct-tab-state.svelte.ts` | Reads steps for construct state | pending |
| `src/lib/features/create/shared/state/create-module/option-history-manager.svelte.ts` | Reads steps for history | pending |
| `src/lib/features/create/shared/domain/DraftSequence.ts` | Reads `steps.length` for step count | pending |
| `src/lib/features/create/shared/services/implementations/SequenceStatsCalculator.ts` | Reads steps for stats | pending |
| `src/lib/features/create/shared/services/implementations/SequenceValidator.ts` | Reads steps for validation | pending |
| `src/lib/features/create/shared/services/implementations/SequenceAnalyzer.ts` | Reads steps for analysis | pending |
| `src/lib/features/create/shared/services/implementations/ReversalDetector.ts` | Reads steps for reversal detection | pending |
| `src/lib/features/create/shared/services/implementations/BridgeFinder.ts` | Reads `steps.length` for bridge finding | pending |
| `src/lib/features/create/shared/services/implementations/DeepLinkSequenceHandler.ts` | Reads steps for deep link handling | pending |
| `src/lib/features/create/generate/shared/services/implementations/SequenceMetadataManager.ts` | Reads step count for metadata | pending |
| `src/lib/features/create/record/state/record-tab-state.svelte.ts` | Reads `steps.length` for total steps | pending |
| `src/lib/features/create/spell/components/SpellPanel.svelte` | Checks `steps.length`, reads `steps[0]` | pending |
| `src/lib/features/watch/services/implementations/FeedLoader.ts` | Reads `steps.length` for step count | pending |
| `src/lib/features/connect/components/session/SessionViewer.svelte` | Reads `steps.length` for beat count | pending |
| `src/lib/features/disassemble-lab/components/DisassemblePlaybackHost.svelte` | Reads steps for letter/step lookup, validates motions | pending |
| `src/lib/features/effort-lab/components/EffortLabPlaybackHost.svelte` | Reads steps for playback | pending |
| `src/lib/features/effects-lab/components/EffectsLabPlaybackHost.svelte` | Reads steps for playback | pending |
| `src/lib/features/phrase-effort-lab/PhraseEffortLabModule.svelte` | Reads steps for effort lab | pending |
| `src/lib/features/lab/tabs/ascii-pictograph-lab-state.svelte.ts` | Reads steps for ASCII rendering | pending |
| `src/lib/features/lab/tabs/ContactBallLab.svelte` | Reads steps for lab | pending |
| `src/lib/features/poi-lab/components/BrowserTab.svelte` | Reads steps for poi lab | pending |
| `src/lib/features/poi-lab/components/ValidatorTab.svelte` | Reads steps for validation | pending |
| `src/lib/features/arena/services/implementations/MatchupSelector.ts` | Reads steps for matchup selection | pending |
| `src/lib/features/arena/services/implementations/ArenaRepository.ts` | Reads steps for arena | pending |
| `src/lib/features/arena/components/battle/ArenaMatchupPanel.svelte` | Reads steps for display | pending |
| `src/lib/features/admin/components/SequenceBrowser.svelte` | Reads steps for display | pending |
| `src/lib/features/admin/components/challenge-scheduler/ChallengeFormPanel.svelte` | Reads steps for challenge form | pending |
| `src/lib/features/tika/components/InlineSequencePlayer.svelte` | Reads steps for animation playback | pending |
| `src/lib/features/tika/components/TikaConversationReadOnly.svelte` | Checks for inline-step-grid type | pending |
| `src/lib/features/tika/services/implementations/TikaToolExecutor.ts` | Reads steps for tool execution | pending |
| `src/lib/features/tika/services/implementations/TikaMessageExtractor.ts` | Reads steps for message extraction | pending |
| `src/lib/features/tika/validation/output-filter.ts` | Reads steps for output filtering | pending |
| `src/lib/features/landing/services/implementations/EndlessSpinnerOrchestrator.ts` | Reads steps for endless spinner | pending |
| `src/lib/features/landing/services/implementations/PropTypeApplier.ts` | Reads steps for prop type application | pending |
| `src/lib/features/landing/services/implementations/BroadcastSequenceConverter.ts` | Reads steps for broadcast conversion | pending |
| `src/lib/features/learn/components/interactive/words/pages/AABBDemoPage.svelte` | Reads steps for demo | pending |
| `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte` | Reads steps extensively for layout, rendering, fingerprinting | pending |
| `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte` | Reads steps for step lookup, length for difficulty | pending |
| `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte` | Reads `steps.length` for beat count | pending |
| `src/lib/shared/sequence-viewer/components/SequenceViewer.svelte` | Checks `steps.length` for has-data | pending |
| `src/lib/shared/sequence-viewer/components/SequencePanel.svelte` | Checks `steps.length` for validation | pending |
| `src/lib/shared/sequence-viewer/components/SequencePreviewPanel.svelte` | Reads `steps.length` for step count | pending |
| `src/lib/shared/sequence-viewer/components/AnimationPlayer.svelte` | Reads steps for step lookup, fingerprinting | pending |
| `src/lib/shared/sequence-viewer/services/implementations/SequenceDataProvider.ts` | Checks steps for motion validation | pending |
| `src/lib/shared/sequence-viewer/services/implementations/SequenceAnimationLoader.ts` | Checks steps for motion validation | pending |
| `src/lib/shared/sequence-viewer/services/implementations/SequenceMotionLoader.ts` | Checks steps for motion presence | pending |
| `src/lib/shared/sequence-viewer/services/implementations/CellPreWarmer.ts` | Reads steps for pre-warming cache | pending |
| `src/lib/shared/animation-engine/components/AnimatorCanvas.svelte` | Reads `steps.length` for active step, passes steps | pending |
| `src/lib/shared/animation-engine/components/AnimationStepGrid.svelte` | Slices steps for display | pending |
| `src/lib/shared/animation-engine/components/EndlessSpinner.svelte` | Maps steps, reads for letter/step lookup | pending |
| `src/lib/shared/animation-engine/components/DisassembleTransition.svelte` | Checks `steps.length`, passes steps | pending |
| `src/lib/shared/animation-engine/components/DisassembleCanvasView.svelte` | Checks `steps.length`, passes steps | pending |
| `src/lib/shared/animation-engine/components/SourceControls.svelte` | Reads `steps.length` for beat count | pending |
| `src/lib/shared/animation-engine/components/canvas-settings-modal/CanvasSettingsModal.svelte` | Reads `steps.length` for total steps | pending |
| `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts` | Reads `steps.length`, finds step by index, fingerprinting | pending |
| `src/lib/shared/animation-engine/services/implementations/AnimationPrecomputer.svelte.ts` | Maps steps for fingerprint | pending |
| `src/lib/shared/animation-engine/services/implementations/SequenceChainingOrchestrator.ts` | Reads last step for chaining | pending |
| `src/lib/shared/animation-engine/services/implementations/SequenceCache.svelte.ts` | Reads `steps.length` for total steps | pending |
| `src/lib/shared/comparison/services/implementations/SimilarityCalculator.ts` | Reads steps for comparison algorithms | pending |
| `src/lib/shared/comparison/services/implementations/SequenceEquivalenceDetector.ts` | Reads steps for equivalence checking | pending |
| `src/lib/shared/comparison/services/implementations/SequenceCanonicalizer.ts` | Reads `steps.length`, generates signatures | pending |
| `src/lib/shared/comparison/services/implementations/SequenceAligner.ts` | Reads steps for alignment algorithms | pending |
| `src/lib/shared/3d-animation/state/avatar-instance-state.svelte.ts` | Reads first/last step | pending |
| `src/lib/shared/3d-animation/services/implementations/StageSceneAdapter.ts` | Reads `steps.length` for step count | pending |
| `src/lib/shared/3d-animation/services/implementations/SequenceConverter.ts` | Reads steps for 3D conversion | pending |
| `src/lib/shared/3d-animation/components/panels/DuetCreatorPanel.svelte` | Reads `steps.length` for display | pending |
| `src/lib/shared/navigation/services/implementations/URLSyncer.ts` | Checks `steps.length` for validation | pending |
| `src/lib/shared/navigation/services/implementations/SequenceEncoder.ts` | Reads steps for encoding | pending |
| `src/lib/shared/navigation/services/implementations/PositionDeriver.ts` | Maps steps for position derivation | pending |
| `src/lib/shared/navigation/services/implementations/LetterDeriver.ts` | Maps steps for letter derivation | pending |
| `src/lib/shared/render/services/implementations/SequenceRenderer.ts` | Checks `steps.length` for validation | pending |
| `src/lib/shared/render/services/implementations/ImageComposer.ts` | Reads steps for image composition | pending |
| `src/lib/shared/render/utils/cache-benchmark.ts` | Reads `steps.length` for benchmark | pending |
| `src/lib/shared/pictograph/shared/services/implementations/StartPositionDeriver.ts` | Reads `steps[0]` for start position | pending |
| `src/lib/shared/foundation/services/implementations/WordDeriver.ts` | Reads steps for word derivation | pending |
| `src/lib/shared/video-record/components/VideoRecordPanel.svelte` | Reads `steps[0]` for start position | pending |
| `src/lib/shared/video-record/components/GridPreview.svelte` | Reads `steps.length`, passes steps | pending |
| `src/lib/shared/sync/services/implementations/DeviceSyncCoordinator.ts` | Reads `steps.length` for total steps | pending |
| `src/lib/shared/inbox/state/send-sequence-state.svelte.ts` | Reads `steps.length` for step count | pending |
| `src/lib/shared/share/services/implementations/PreviewCache.ts` | Passes `steps` for preview cache | pending |
| `src/lib/shared/share-hub/components/single-media/AnimationExportView.svelte` | Reads steps for export | pending |
| `src/lib/shared/share-hub/components/composite/MediaPieceCard.svelte` | Reads steps for display | pending |
| `src/lib/shared/coordinators/AnimationSheetCoordinator.svelte` | Reads steps for animation coordination | pending |
| `src/lib/shared/coordinators/sequence-handoff.svelte.ts` | Reads steps for handoff | pending |
| `src/lib/shared/settings/components/tabs/visibility/AnimationPreviewController.svelte` | Reads steps for preview | pending |
| `src/lib/shared/settings/components/tabs/visibility/AnimationPreviewCanvas.svelte` | Reads steps for canvas | pending |
| `src/lib/shared/onboarding/components/create-tutorial/steps/PlaySequenceStep.svelte` | Reads steps for tutorial | pending |
| `src/lib/features/library/services/implementations/SequenceContentHasher.ts` | Maps steps for content hashing | pending |
| `src/lib/features/library/services/implementations/LibraryRepository.ts` | Reads `steps.length` for step count | pending |

---

## Wave 2: Write/Create (43 files)

These create or modify sequences with `steps` in constructors, spreads, or update patterns.
Need to use the compositional model when building sequence data.

| File | Usage | Status |
|------|-------|--------|
| `src/lib/shared/foundation/domain/models/SequenceData.ts` | `createSequenceData()`, `addStepToSequence()`, `removeStepFromSequence()`, `updateSequenceData()` | pending |
| `src/lib/shared/foundation/services/implementations/SequenceHydrator.ts` | Hydrates steps with derived data | pending |
| `src/lib/shared/foundation/services/implementations/SequenceDecomposer.ts` | Maps steps to solo prop data | pending |
| `src/lib/shared/foundation/services/implementations/SequenceComposer.ts` | Composes steps from solo prop data | pending |
| `src/lib/shared/foundation/services/implementations/StepDeriver.ts` | Derives steps from solo prop steps | pending |
| `src/lib/shared/foundation/services/implementations/ContentHasher.ts` | Hashes solo prop steps | pending |
| `src/lib/shared/foundation/services/implementations/SoloPropRepository.ts` | Passes solo prop steps | pending |
| `src/lib/features/create/generate/state/generate-actions.svelte.ts` | Spreads/modifies steps during generation, applies turns | pending |
| `src/lib/features/create/generate/circular/services/implementations/OrientationCycleExtender.ts` | Reads original steps for extension | pending |
| `src/lib/features/create/shared/state/SequenceStateOrchestrator.svelte.ts` | Creates new steps arrays, normalizes step numbers, spreads steps | pending |
| `src/lib/features/create/shared/state/operations/SequenceStepOperations.ts` | Add/remove/replace/insert steps, slices and spreads | pending |
| `src/lib/features/create/shared/state/create-module/undo-controller.svelte.ts` | Maps steps for undo snapshots | pending |
| `src/lib/features/create/shared/services/implementations/DurationPatternManager.ts` | Maps steps to apply duration patterns | pending |
| `src/lib/features/create/shared/services/implementations/RotationDirectionPatternManager.ts` | Maps steps to apply rotation patterns | pending |
| `src/lib/features/create/shared/services/implementations/TurnPatternManager.ts` | Maps steps to apply turn patterns | pending |
| `src/lib/features/create/shared/services/implementations/SequenceExporter.ts` | Reads steps for JSON export | pending |
| `src/lib/features/create/shared/services/implementations/SequenceJsonExporter.ts` | Reads steps for JSON export | pending |
| `src/lib/features/create/shared/services/implementations/SequenceDomainManager.ts` | Reads steps for domain operations | pending |
| `src/lib/features/create/shared/services/implementations/SequenceRepository.ts` | Reads/writes steps in persistence | pending |
| `src/lib/features/create/shared/services/implementations/SequenceExtender.ts` | Extends sequence steps | pending |
| `src/lib/features/create/shared/services/implementations/ExtensionFlowCoordinator.ts` | Coordinates step extension flow | pending |
| `src/lib/features/create/shared/services/implementations/ConstructCoordinator.ts` | Coordinates step construction | pending |
| `src/lib/features/create/shared/services/implementations/CreateModuleEventHandler.ts` | Handles step creation events | pending |
| `src/lib/features/create/shared/services/implementations/SequenceImporter.ts` | Imports steps from external formats | pending |
| `src/lib/features/create/shared/services/implementations/Autosaver.ts` | Reads steps for autosave | pending |
| `src/lib/features/create/shared/services/implementations/step-operations/DurationHandler.ts` | Modifies step durations | pending |
| `src/lib/features/create/shared/services/implementations/step-operations/TurnsHandler.ts` | Modifies step turns | pending |
| `src/lib/features/create/shared/services/implementations/step-operations/RotationDirectionHandler.ts` | Modifies step rotation directions | pending |
| `src/lib/features/create/shared/services/implementations/step-operations/OrientationHandler.ts` | Modifies step orientations | pending |
| `src/lib/features/create/shared/services/implementations/step-operations/StepRemovalHandler.ts` | Removes steps | pending |
| `src/lib/features/create/shared/services/implementations/step-operations/ArrowAdjustmentHandler.ts` | Modifies step arrow data | pending |
| `src/lib/features/create/shared/services/implementations/step-operations/PropTypeHandler.ts` | Modifies step prop types | pending |
| `src/lib/features/create/shared/services/implementations/step-operations/BatchEditHandler.ts` | Batch-modifies steps | pending |
| `src/lib/features/create/shared/services/implementations/step-operations/step-data-helpers.ts` | Step data utility operations | pending |
| `src/lib/features/create/shared/services/implementations/sequence-transforms/sequence-transforms.ts` | Transforms steps in sequences | pending |
| `src/lib/features/create/shared/services/implementations/sequence-transforms/orientation-propagation.ts` | Propagates orientations through steps | pending |
| `src/lib/features/create/shared/workspace-panel/shared/services/implementations/Workbench.ts` | Creates new steps, reads by index | pending |
| `src/lib/features/create/shared/components/coordinators/StepEditorCoordinator.svelte` | Updates steps array for editing | pending |
| `src/lib/features/create/spell/services/implementations/WordSequenceGenerator.ts` | Creates bridge steps, spreads steps | pending |
| `src/lib/features/create/spell/services/implementations/OrientationContinuityValidator.ts` | Reads steps for orientation validation | pending |
| `src/lib/features/compose/services/implementations/SequenceNormalizer.ts` | Normalizes steps, filters by step number | pending |
| `src/lib/features/compose/services/implementations/VideoExportOrchestrator.ts` | Reads steps for video export | pending |
| `src/lib/features/library/services/implementations/PublicIndexSyncer.ts` | Reads steps for public index, includes steps in sync payload | pending |
| `src/lib/features/browse/sequences/display/services/implementations/PublicSequencesLoader.ts` | Reads `steps` from Firestore data | pending |
| `src/lib/features/landing/services/implementations/SequenceDataSerializer.ts` | Serializes steps | pending |
| `src/lib/features/create/shared/utils/sequence-comparison.ts` | Compares step arrays | pending |
| `src/routes/admin/generate-thumbnails/+page.svelte` | Maps steps to add prop types | pending |

---

## Wave 3: Complex Mutation (10 files)

These do direct step manipulation (push, pop, splice, reassign `steps = [...]`).
Need refactoring to work through the compositional model.

| File | Usage | Status |
|------|-------|--------|
| `src/lib/features/create/spell/services/implementations/RandomSequenceGenerator.ts` | `state.steps.push(step)`, `state.steps.pop()`, `state.steps = [...]` backtracking | pending |
| `src/lib/features/compose/services/implementations/SequenceAnimationOrchestrator.ts` | `this.steps = []`, `this.steps = steps`, direct array assignment for animation state | pending |
| `src/lib/shared/sequence-viewer/services/implementations/SequenceViewer.ts` | `newSteps[arrayIndex] = {...}` direct element replacement for step editing | pending |
| `src/lib/features/create/shared/workspace-panel/sequence-display/utils/grid-calculations.ts` | `currentRow.steps.push(...)` for layout row building (not SequenceData.steps) | pending |
| `src/lib/shared/sequence-engine/services/implementations/OrientationPropagator.ts` | `updatedSteps = [...steps]` with element mutation for orientation propagation | pending |
| `src/lib/features/create/shared/state/operations/SequenceStepOperations.ts` | `newSteps[stepIndex] = updatedStep` direct element replacement | pending |
| `src/lib/features/create/shared/state/SequenceStateOrchestrator.svelte.ts` | `newSteps[stepIndex] = {...}` direct element replacement | pending |
| `src/lib/features/create/generate/state/generate-actions.svelte.ts` | `stepsWithTurns[i] = {...}` direct element replacement during turn application | pending |
| `src/lib/features/create/shared/components/coordinators/StepEditorCoordinator.svelte` | `updatedSteps[...] = {...}` direct element replacement | pending |
| `src/lib/features/compose/services/implementations/SequenceNormalizer.ts` | `steps: sequence.steps.filter(...)` filtering and reassignment | pending |

---

## Skip List (23 files)

These are composition infrastructure, external packages, tests, or admin tooling.
They either define the new model or are outside the migration scope.

| File | Reason |
|------|--------|
| `packages/sequence-engine/src/services/implementations/OrientationPropagator.ts` | External package |
| `packages/sequence-engine/src/constraints/search/search-state.ts` | External package |
| `packages/sequence-engine/src/constraints/search/constrained-builder.ts` | External package |
| `packages/sequence-engine/src/constraints/reporting/report-generator.ts` | External package |
| `packages/mcp-tika-talk/src/tika-bridge.ts` | External package |
| `mcp-server/src/tools/sequence-tools.ts` | MCP server tooling |
| `mcp-server/src/tools/loop-tools.ts` | MCP server tooling |
| `mcp-server/src/tools/preset-tools.ts` | MCP server tooling |
| `mcp-server/src/core/sequence-builder.ts` | MCP server core |
| `mcp-server/src/core/orientation-propagation.ts` | MCP server core |
| `mcp-server/src/core/constraints/search/constrained-builder.ts` | MCP server core |
| `mcp-server/src/core/constraints/search/search-state.ts` | MCP server core |
| `mcp-server/src/core/constraints/reporting/report-generator.ts` | MCP server core |
| `mcp-server/test-duckface.ts` | MCP test file |
| `tests/unit/SequenceComposer.test.ts` | Test file |
| `tests/unit/SequenceDecomposer.test.ts` | Test file |
| `tests/unit/StepDeriver.test.ts` | Test file |
| `tests/unit/library/fork-detection.test.ts` | Test file |
| `tests/unit/state/ReversalDetectionService.test.ts` | Test file |
| `tests/unit/infinite-generator/orientation-cycle-chaining.test.ts` | Test file |
| `tests/unit/sync/SequenceLocalCache.test.ts` | Test file |
| `tests/unit/services/SequenceEncoder.test.ts` | Test file |
| `tests/unit/comparison/MotionSignatureGenerator.test.ts` | Test file |
| `src/routes/admin/migrate-sequences/+page.svelte` | Admin migration tool |
| `src/routes/admin/migrate-firestore/+page.svelte` | Admin migration tool |

---

## Excluded (not SequenceData.steps)

These files contain `.steps` but reference unrelated objects (CSS classes, config, DOM):

- `src/routes/(public)/delete-account/+page.svelte` -- CSS class `.steps`
- `src/routes/test/choo-choo/choo-choo-generator.ts` -- `fullConfig.steps` (number of steps config)
- `src/lib/shared/mobile/components/PlatformInstructions.svelte` -- `instructions.steps` (UI instructions)
- `src/lib/shared/inbox/components/messages/SequenceMessageCard.svelte` -- CSS class `.steps`
- `src/lib/features/loop-labeler/services/implementations/LOOPDesignator.ts` -- `[...steps].sort()` on number array
- `src/lib/features/loop-labeler/services/implementations/LabelFormatter.ts` -- `[...steps].sort()` on number array
- `src/lib/shared/comparison/services/implementations/MotionSignatureGenerator.ts` -- `signature.locationDelta.steps` (different data model)
- `src/lib/features/tika/components/InlineStepGrid.svelte` -- `stepGrid.steps` (different data model)
- `src/lib/features/lab/tabs/audio-lab/components/BeatMarkerTrack.svelte` -- CSS class `.steps-container`
- Various CSS classes: `.steps-grid`, `.steps-count`, `.section-steps`
