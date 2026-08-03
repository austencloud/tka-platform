# Ceremony Flattening — Dry Run Report

Generated: 2026-05-31T07:56:44.553Z

## Summary

| Metric | Count |
|---|---|
| PascalCase .ts files | 330 |
| Feature modules | 39 |
| Shared modules | 67 |
| implementations/ dirs | 1 |
| contracts/ dirs (empty) | 0 |
| contracts/ dirs (types-only) | 0 |
| contracts/ dirs (interfaces) | 0 |
| Stateless classes | 58 |
| Stateless-deps classes | 38 |
| Stateless-cache classes | 15 |
| Stateful classes | 441 |
| Not-a-class (already functions) | 630 |
| Parse errors | 0 |

## Edge Cases

| Category | Count | Risk |
|---|---|---|
| Dynamic imports (PascalCase) | 213 | Agent handles manually |
| Stored service refs | 1246 | Must unwrap each method call |
| Service passed as argument | 159 | Receiver param type needs update |
| Reactive state with interface type | 6 | Needs restructuring |

### Dynamic Imports

- `src/lib/features/retro/shared/services/retro-init.ts`: `import('$lib/shared/auth/state/authState.svelte')`
- `src/lib/features/retro/win95/adapters/settings-adapter.ts`: `import('$lib/shared/settings/state/SettingsState.svelte')`
- `src/lib/shared/3d/destinations/definitions.ts`: `import('../../../features/campground/CampgroundDestination.svelte')`
- `src/lib/shared/3d/destinations/definitions.ts`: `import('../../../features/archive/ArchiveDestination.svelte')`
- `src/lib/shared/3d/destinations/definitions.ts`: `import('../../../features/museum/scenes/procedural/MuseumDestination.svelte')`
- `src/lib/shared/3d/destinations/definitions.ts`: `import('../../../features/lab/tools/3d-controls/ThreeDControlsLab.svelte')`
- `src/lib/shared/3d/destinations/definitions.ts`: `import('../../../features/hannons-camp/HannonsCampDestination.svelte')`
- `src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts`: `import('./customize/TrailCustomize.svelte')`
- `src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts`: `import('./customize/FireCustomize.svelte')`
- `src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts`: `import('./customize/LedCustomize.svelte')`
- `src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts`: `import('./customize/CharcoalCustomize.svelte')`
- `src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts`: `import('./customize/ZapCustomize.svelte')`
- `src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts`: `import('./customize/SparklesCustomize.svelte')`
- `src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts`: `import('./customize/EchoCustomize.svelte')`
- `src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts`: `import('./customize/BloomCustomize.svelte')`
- `src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts`: `import('./customize/WaterCustomize.svelte')`
- `src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts`: `import('./customize/BubblesCustomize.svelte')`
- `src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts`: `import('./customize/PetalsCustomize.svelte')`
- `src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts`: `import('./customize/SmokeCustomize.svelte')`
- `src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts`: `import('./customize/InkCustomize.svelte')`
- `src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts`: `import('./customize/FrostCustomize.svelte')`
- `src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts`: `import('./customize/SilkCustomize.svelte')`
- `src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts`: `import('./customize/PulseCustomize.svelte')`
- `src/lib/shared/animation-engine/services/animation-engine.svelte.ts`: `import('$lib/shared/animation-engine/getFireDefaultsLoader')`
- `src/lib/shared/animation-engine/services/canvas-lifecycle-manager.ts`: `import('./effects/EffectRenderer')`
- `src/lib/shared/animation-engine/services/managers/playback-sync.ts`: `import('../../domain/types/TipEffectTypes')`
- `src/lib/shared/application/state/services.svelte.ts`: `import('../../settings/state/SettingsState.svelte')`
- `src/lib/shared/application/state/services.svelte.ts`: `import('../../settings/state/SettingsState.svelte')`
- `src/lib/shared/auth/services/auth-boot-orchestrator.ts`: `import('$lib/shared/settings/state/SettingsState.svelte')`
- `src/lib/shared/auth/services/authenticator.ts`: `import('$lib/shared/desktop/isDesktop')`
- `src/lib/shared/auth/services/authenticator.ts`: `import('$lib/shared/desktop/TauriAuthBridge')`
- `src/lib/shared/auth/state/authState.svelte.ts`: `import('$lib/shared/desktop/isDesktop')`
- `src/lib/shared/auth/state/authState.svelte.ts`: `import('../../settings/state/SettingsState.svelte')`
- `src/lib/shared/choreo-card/services/choreo-card-context-menu.ts`: `import('$lib/shared/browse/getClaudeCodeCopier')`
- `src/lib/shared/create/services/BuildResultTransformer.ts`: `import('$lib/shared/foundation/domain/models/SequenceData')`
- `src/lib/shared/create/services/BuildResultTransformer.ts`: `import('$lib/shared/foundation/domain/models/SequenceData')`
- `src/lib/shared/onboarding/state/app-entry-state.svelte.ts`: `import('$lib/shared/auth/state/authState.svelte')`
- `src/lib/shared/onboarding/state/app-entry-state.svelte.ts`: `import('$lib/shared/auth/state/authState.svelte')`
- `src/lib/shared/onboarding/state/first-run-state.svelte.ts`: `import('$lib/shared/auth/state/authState.svelte')`
- `src/lib/shared/onboarding/state/first-run-state.svelte.ts`: `import('$lib/shared/auth/state/authState.svelte')`
- `src/lib/shared/pictograph/shared/state/visibility-state.svelte.ts`: `import('../../../settings/state/SettingsState.svelte')`
- `src/lib/shared/render/services/image-composer.ts`: `import('../../mandala/getMandalaGeometryCalculator')`
- `src/lib/shared/render/utils/cache-benchmark.ts`: `import('$lib/shared/browse/getBrowseLoader')`
- `src/routes/admin/+layout.ts`: `import('$lib/shared/auth/state/authState.svelte')`
- `src/routes/q/[code]/+page.server.ts`: `import('$lib/server/firebaseAdmin')`
- `src/lib/features/admin/components/AdminDashboard.svelte`: `import('$lib/features/loop-labeler/components/LOOPLabelerModule.svelte')`
- `src/lib/features/admin/components/AdminDashboard.svelte`: `import('./analytics/PostHogDashboard.svelte')`
- `src/lib/features/admin/components/AdminDashboard.svelte`: `import('$lib/features/loop-labeler/components/LOOPLabelerModule.svelte')`
- `src/lib/features/admin/components/AdminDashboard.svelte`: `import('./analytics/PostHogDashboard.svelte')`
- `src/lib/features/arena/ArenaModule.svelte`: `import('./components/battle/ArenaBattleView.svelte')`
- `src/lib/features/arena/ArenaModule.svelte`: `import('./components/leaderboard/ArenaLeaderboardView.svelte')`
- `src/lib/features/arena/ArenaModule.svelte`: `import('./components/detail/ArenaSequenceDetail.svelte')`
- `src/lib/features/create/shared/components/CreateModule.svelte`: `import('./coordinators/VideoRecordCoordinator.svelte')`
- `src/lib/features/create/shared/components/CreateModule.svelte`: `import('$lib/features/create/construct/start-position-picker/components/OrientationPickerDrawer.svelte')`
- `src/lib/features/create/shared/components/CreateModule.svelte`: `import('./coordinators/SequenceActionsCoordinator.svelte')`
- `src/lib/features/create/shared/components/CreateModule.svelte`: `import('./coordinators/StepEditorCoordinator.svelte')`
- `src/lib/features/create/shared/components/CreateModule.svelte`: `import('./SaveToLibraryPanel.svelte')`
- `src/lib/features/hand-paths/HandPathModule.svelte`: `import('$lib/features/hand-paths/hand-path-explorer/HandPathExplorerLab.svelte')`
- `src/lib/features/hand-paths/HandPathModule.svelte`: `import('$lib/features/hand-paths/hand-path-builder/HandPathBuilderLab.svelte')`
- `src/lib/features/lab/duration-lab/DurationLabModule.svelte`: `import('$lib/shared/foundation/domain/models/Letter')`
- `src/lib/features/lab/effects-lab/EffectsLabModule.svelte`: `import('./components/EffectPointEditorTab.svelte')`
- `src/lib/features/lab/LabModule.svelte`: `import('$lib/features/themes-lab/ThemesLab.svelte')`
- `src/lib/features/lab/LabModule.svelte`: `import('$lib/features/landing-preview/LandingPreviewModule.svelte')`
- `src/lib/features/lab/LabModule.svelte`: `import('$lib/features/lab/constraint-layout-lab/CompositionLab.svelte')`
- `src/lib/features/lab/LabModule.svelte`: `import('./tabs/VoiceControlLab.svelte')`
- `src/lib/features/lab/LabModule.svelte`: `import('$lib/features/lab/vtg-lab/VtgLabModule.svelte')`
- `src/lib/features/lab/LabModule.svelte`: `import('$lib/features/lab/trigrid-lab/TriGridLabModule.svelte')`
- `src/lib/features/lab/LabModule.svelte`: `import('$lib/features/lab/duration-lab/DurationLabModule.svelte')`
- `src/lib/features/lab/LabModule.svelte`: `import('$lib/features/lab/effects-lab/EffectsLabModule.svelte')`
- `src/lib/features/lab/LabModule.svelte`: `import('./tabs/hand-pose-editor/HandPoseEditor.svelte')`
- `src/lib/features/lab/LabModule.svelte`: `import('$lib/features/lab/disassemble-lab/DisassembleLab.svelte')`
- `src/lib/features/lab/LabModule.svelte`: `import('./tabs/PropButtonLab.svelte')`
- `src/lib/features/lab/LabModule.svelte`: `import('$lib/features/lab/phrase-effort-lab/PhraseEffortLabModule.svelte')`
- `src/lib/features/lab/LabModule.svelte`: `import('$lib/features/village/VillageLabTab.svelte')`
- `src/lib/features/lab/LabModule.svelte`: `import('./tabs/PovPatternLab.svelte')`
- `src/lib/features/lab/LabModule.svelte`: `import('./tabs/collision-lab/CollisionLab.svelte')`
- `src/lib/features/lab/LabModule.svelte`: `import('./tabs/spatial-lab/SpatialLab.svelte')`
- `src/lib/features/lab/LabModule.svelte`: `import('$lib/features/sticker-lab/StickerLab.svelte')`
- `src/lib/features/lab/LabModule.svelte`: `import('./tabs/PathMandalaLab.svelte')`
- `src/lib/features/lab/LabModule.svelte`: `import('./tabs/pictograph-explorer/PictographExplorerLab.svelte')`
- `src/lib/features/lab/LabModule.svelte`: `import('./tools/coral-lab/CoralLab.svelte')`
- `src/lib/features/lab/phrase-effort-lab/PhraseEffortLabModule.svelte`: `import('$lib/shared/foundation/domain/models/Letter')`
- `src/lib/features/levels/LevelsModule.svelte`: `import('$lib/features/levels/level5-lab/Level5LabModule.svelte')`
- `src/lib/features/levels/LevelsModule.svelte`: `import('$lib/features/skewlab/SkewLabModule.svelte')`
- `src/lib/features/levels/LevelsModule.svelte`: `import('$lib/features/levels/level6-lab/Level6LabModule.svelte')`
- `src/lib/features/levels/LevelsModule.svelte`: `import('$lib/features/levels/conjoined-grid/ConjoinedGridTab.svelte')`
- `src/lib/features/levels/LevelsModule.svelte`: `import('$lib/features/levels/poi-lab/PoiLabModule.svelte')`
- `src/lib/features/museum/MuseumModule.svelte`: `import('./components/game/DimensionFlipProof.svelte')`
- `src/lib/features/museum/MuseumModule.svelte`: `import('./components/showroom/PropsShowroom.svelte')`
- `src/lib/features/museum/MuseumModule.svelte`: `import('./components/showroom/ThirdPersonTest.svelte')`
- `src/lib/features/museum/MuseumModule.svelte`: `import('./components/editor/Museum2DEditor.svelte')`
- `src/lib/features/retro/RetroModule.svelte`: `import('./dos/components/DosTerminal.svelte')`
- `src/lib/features/retro/RetroModule.svelte`: `import('./win95/components/shell/RetroDesktop.svelte')`
- `src/lib/features/retro/RetroModule.svelte`: `import('./labs/PictographTimelineLab.svelte')`
- `src/lib/features/retro/RetroModule.svelte`: `import('./labs/PictographHistoryLab.svelte')`
- `src/lib/features/social/SocialModule.svelte`: `import('$lib/features/community/Community.svelte')`
- `src/lib/features/social/SocialModule.svelte`: `import('$lib/features/connect/ConnectModule.svelte')`
- `src/lib/features/video/video-trails/VideoTrailsLab.svelte`: `import('./views/WorkspaceView.svelte')`
- `src/lib/features/video/video-trails/VideoTrailsLab.svelte`: `import('./views/DetectionStudioView.svelte')`
- `src/lib/features/video/video-trails/VideoTrailsLab.svelte`: `import('./views/LibraryView.svelte')`
- `src/lib/features/video/VideoModule.svelte`: `import('./video-trails/VideoTrailsLab.svelte')`
- `src/lib/features/video/VideoModule.svelte`: `import('./video-lab/VideoLab.svelte')`
- `src/lib/features/video/VideoModule.svelte`: `import('$lib/features/skel2tka/Skel2TKALab.svelte')`
- `src/lib/shared/3d/procedural-engine/components/WorldSceneContent.svelte`: `import('$lib/shared/input/InputCapabilities.svelte')`
- `src/lib/shared/3d/procedural-engine/components/WorldSceneContent.svelte`: `import('$lib/features/museum/scenes/procedural/components/MuseumGrounds.svelte')`
- `src/lib/shared/animation-engine/components/AnimationShareDrawer.svelte`: `import('$lib/features/create/shared/components/CreatePanelDrawer.svelte')`
- `src/lib/shared/animation-engine/components/AnimationShareDrawer.svelte`: `import('$lib/features/create/shared/components/CreatePanelDrawer.svelte')`
- `src/lib/shared/animation-engine/components/canvas/AnimationCanvas.svelte`: `import('$lib/features/compose/components/canvas/AnimationVideoPlayer.svelte')`
- `src/lib/shared/animation-engine/components/canvas/AnimationControlsPanel.svelte`: `import('$lib/features/compose/components/controls/CompactMobileRow.svelte')`
- `src/lib/shared/animation-engine/components/canvas/AnimationControlsPanel.svelte`: `import('$lib/features/compose/components/controls/AnimationSettingsSheet.svelte')`
- `src/lib/shared/animation-panel/components/AnimationPanel.svelte`: `import('$lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte')`
- `src/lib/shared/application/components/MainApplication.svelte`: `import('../../pwa/components/PwaMigrationBanner.svelte')`
- `src/lib/shared/application/components/MainApplication.svelte`: `import('../../onboarding/components/first-run/FirstRunWizard.svelte')`
- `src/lib/shared/application/components/MainApplication.svelte`: `import('../../onboarding/components/create-tutorial/CreateTutorialWizard.svelte')`
- `src/lib/shared/application/components/MainApplication.svelte`: `import('../../onboarding/components/create-tutorial/TutorialPrompt.svelte')`
- `src/lib/shared/application/components/MainApplication.svelte`: `import('../../auth/components/AuthDrawer.svelte')`
- `src/lib/shared/application/components/MainApplication.svelte`: `import('../../inbox/components/InboxDrawer.svelte')`
- `src/lib/shared/application/components/MainApplication.svelte`: `import('$lib/features/feedback/components/quick/QuickFeedbackPanel.svelte')`
- `src/lib/shared/application/components/MainApplication.svelte`: `import('$lib/features/feedback/components/my-feedback/MyFeedbackDetail.svelte')`
- `src/lib/shared/application/components/MainApplication.svelte`: `import('$lib/features/admin/components/AnnouncementChecker.svelte')`
- `src/lib/shared/application/components/MainApplication.svelte`: `import('../../settings/components/tabs/prop-type/PropSelectionSheet.svelte')`
- `src/lib/shared/application/components/MainApplication.svelte`: `import('../../voice-control/components/HeyTikaListener.svelte')`
- `src/lib/shared/application/components/MainApplication.svelte`: `import('../../voice-control/components/VoiceControlIndicator.svelte')`
- `src/lib/shared/application/components/MainApplication.svelte`: `import('../../voice-control/components/VoiceCommandHelpOverlay.svelte')`
- `src/lib/shared/application/components/MainApplication.svelte`: `import('../../sequence-viewer/components/SequenceViewerDrawerHost.svelte')`
- `src/lib/shared/components/LazyMount.svelte`: `import('./HeavyDrawer.svelte')`
- `src/lib/shared/MainInterface.svelte`: `import('$lib/features/connect/components/InviteOverlay.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/create/shared/components/CreateModule.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/browse/shared/components/BrowseModule.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/browse/shared/components/BrowseModule.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/social/SocialModule.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/learn/LearnTab.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/premium/PremiumModule.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/compose/ComposeModule.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/train/components/TrainModule.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/choreo-card/components/ChoreoCardTab.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/choreo-card/components/ChoreoCardTab.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/write/components/WriteTab.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/feedback/components/FeedbackModule.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/admin/components/AdminDashboard.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/train/prop-tracking-lab/components/PropTrackingLabModule.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/compose/ComposeModule.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/watch/WatchModule.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/arena/ArenaModule.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/social/SocialModule.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/social/SocialModule.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/settings/SettingsModule.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/tika/TikaModule.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/moderation/ModerationModule.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/festivals/FestivalModule.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/levels/LevelsModule.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/hand-paths/HandPathModule.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/video/VideoModule.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/lab/LabModule.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/levels/LevelsModule.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/levels/LevelsModule.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/retro/RetroModule.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/museum/MuseumModule.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/archive/ArchiveDestination.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/mandala/MandalaModule.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/lab/LabModule.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/lab/LabModule.svelte')`
- `src/lib/shared/modules/ModuleRenderer.svelte`: `import('../../features/stage/StageModule.svelte')`
- `src/lib/shared/onboarding/components/create-tutorial/steps/AddStepTutorialStep.svelte`: `import('$lib/features/create/construct/option-picker/components/OptionPicker.svelte')`
- `src/lib/shared/onboarding/components/create-tutorial/steps/PickStartPositionStep.svelte`: `import('$lib/features/create/construct/start-position-picker/components/StartPositionPicker.svelte')`
- `src/lib/shared/onboarding/components/create-tutorial/steps/ReadyStep.svelte`: `import('$lib/features/create/shared/workspace-panel/sequence-display/components/StepGrid.svelte')`
- `src/lib/shared/sequence-review/components/SequencePreviewPanel.svelte`: `import('$lib/features/create/shared/workspace-panel/sequence-display/components/StepGrid.svelte')`
- `src/lib/shared/sequence-viewer/components/CardHeader.svelte`: `import('$lib/shared/browse/domain/BrowseViewMode')`
- `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte`: `import('$lib/shared/browse/domain/BrowseViewMode')`
- `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte`: `import('$lib/shared/pictograph/shared/domain/models/MotionData')`
- `src/lib/shared/sequence-viewer/components/SequencePanel.svelte`: `import('$lib/shared/video-collaboration/components/VideosPanel.svelte')`
- `src/lib/shared/settings/components/tabs/release-notes/VersionDetailContent.svelte`: `import('$lib/features/feedback/components/manage/FeedbackDetailPanel.svelte')`
- `src/lib/shared/video-record/components/GridPreview.svelte`: `import('$lib/features/create/shared/workspace-panel/sequence-display/components/StepGrid.svelte')`
- `src/lib/shared/video-record/components/VideoRecordDrawer.svelte`: `import('$lib/features/create/shared/components/CreatePanelDrawer.svelte')`
- `src/lib/shared/video-record/components/VideoRecordPanel.svelte`: `import('$lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte')`
- `src/routes/+layout.svelte`: `import('$lib/features/create/shared/components/CreateModule.svelte')`
- `src/routes/+layout.svelte`: `import('$lib/features/create/shared/components/CreateModule.svelte')`
- `src/routes/+layout.svelte`: `import('$lib/features/browse/shared/components/BrowseModule.svelte')`
- `src/routes/+layout.svelte`: `import('$lib/features/compose/ComposeModule.svelte')`
- `src/routes/+layout.svelte`: `import('$lib/features/compose/ComposeModule.svelte')`
- `src/routes/+layout.svelte`: `import('$lib/features/museum/MuseumModule.svelte')`
- `src/routes/+layout.svelte`: `import('$lib/features/learn/LearnTab.svelte')`
- `src/routes/+layout.svelte`: `import('$lib/features/train/components/TrainModule.svelte')`
- `src/routes/+layout.svelte`: `import('$lib/features/arena/ArenaModule.svelte')`
- `src/routes/+layout.svelte`: `import('$lib/features/watch/WatchModule.svelte')`
- `src/routes/+layout.svelte`: `import('$lib/features/settings/SettingsModule.svelte')`
- `src/routes/+layout.svelte`: `import('$lib/features/tika/TikaModule.svelte')`
- `src/routes/+layout.svelte`: `import('$lib/features/festivals/FestivalModule.svelte')`
- `src/routes/+layout.svelte`: `import('$lib/features/admin/components/AdminDashboard.svelte')`
- `src/routes/+layout.svelte`: `import('$lib/features/stage/StageModule.svelte')`
- `src/routes/+layout.svelte`: `import('$lib/shared/auth/state/authState.svelte')`
- `src/routes/+layout.svelte`: `import('$lib/shared/application/components/MainApplication.svelte')`
- `src/routes/+layout.svelte`: `import('$lib/shared/desktop/getDesktopInitializer')`
- `src/routes/+layout.svelte`: `import('$lib/features/moderation/components/WarningBanner.svelte')`
- `src/routes/+layout.svelte`: `import('$lib/shared/auth/components/EmailVerificationBanner.svelte')`
- `src/routes/+layout.svelte`: `import('$lib/shared/components/FullscreenPrompt.svelte')`
- `src/routes/+layout.svelte`: `import('$lib/shared/auth/components/InAppBrowserPrompt.svelte')`
- `src/routes/+layout.svelte`: `import('$lib/features/moderation/components/ReportUserModal.svelte')`
- `src/routes/+layout.svelte`: `import('$lib/shared/application/components/ModalUrlRestorer.svelte')`
- `src/routes/app/AppShellLoader.svelte`: `import('$lib/shared/application/components/MainApplication.svelte')`
- `src/routes/landing/components/HowTkaAnimationCard.svelte`: `import('$lib/shared/animation-engine/components/AnimatorCanvas.svelte')`
- `src/routes/landing/components/LazyHowTkaWorksSection.svelte`: `import('./HowTkaWorksSection.svelte')`
- `src/routes/landing/components/LazyLandingDemo.svelte`: `import('./LandingAnimationDemo.svelte')`
- `src/routes/landing/components/PlayWithItSection.svelte`: `import('./PlayWithItInner.svelte')`
- `src/routes/q/[code]/+page.svelte`: `import('$lib/shared/sequence-viewer/components/AnimationPlayer.svelte')`
- `src/routes/q/[code]/+page.svelte`: `import('$lib/shared/animation-engine/getVideoExportOrchestrator')`
- `src/routes/q/[code]/+page.svelte`: `import('$lib/shared/animation-engine/getVideoExporter')`
- `src/routes/q/[code]/+page.svelte`: `import('$lib/shared/animation-engine/getCompositeVideoRenderer')`
- `src/routes/q/[code]/+page.svelte`: `import('$lib/shared/animation-engine/getExportGlyphPrerenderer')`
- `src/routes/q/[code]/+page.svelte`: `import('$lib/shared/animation-engine/getBackgroundVideoEncoder')`
- `src/routes/q/[code]/+page.svelte`: `import('$lib/shared/sequence-viewer/components/AnimationPlayer.svelte')`
- `src/routes/q/[code]/+page.svelte`: `import('$lib/shared/animation-panel/components/AnimationPanel.svelte')`
- `src/routes/sequence/[id]/+page.svelte`: `import('$lib/shared/3d/components/Viewer3DFullscreen.svelte')`

### Stored Service References (top 30)

- `src/lib/features/admin/override-migration/services/override-migration.ts`: `repo = getSpecialOverrideRepository()`
- `src/lib/features/admin/services/audit-logger.ts`: `currentUser = getAuthSync()`
- `src/lib/features/admin/services/post-hog-analytics-provider.ts`: `posthog = getPostHogInstance()`
- `src/lib/features/admin/services/post-hog-analytics-provider.ts`: `posthog = getPostHogInstance()`
- `src/lib/features/arena/services/arena-repository.ts`: `hydrator = getSequenceHydrator()`
- `src/lib/features/assemble-lab/services/svg-prop-animator.ts`: `preset = getAnimationVisibilityManager()`
- `src/lib/features/background-builder/state/background-builder-state.svelte.ts`: `labSettings = getLabSettings()`
- `src/lib/features/background-builder/state/background-builder-state.svelte.ts`: `current = getCosmicSettings()`
- `src/lib/features/background-builder/state/background-builder-state.svelte.ts`: `labSettings = getLabSettings()`
- `src/lib/features/background-builder/state/background-builder-state.svelte.ts`: `labSettings = getLabSettings()`
- `src/lib/features/background-builder/state/background-builder-state.svelte.ts`: `current = getForestSettings()`
- `src/lib/features/background-builder/state/background-builder-state.svelte.ts`: `labSettings = getLabSettings()`
- `src/lib/features/background-builder/state/background-builder-state.svelte.ts`: `labSettings = getLabSettings()`
- `src/lib/features/background-builder/state/background-builder-state.svelte.ts`: `current = getBlossomSettings()`
- `src/lib/features/background-builder/state/background-builder-state.svelte.ts`: `labSettings = getLabSettings()`
- `src/lib/features/background-builder/state/background-builder-state.svelte.ts`: `labSettings = getLabSettings()`
- `src/lib/features/background-builder/state/background-builder-state.svelte.ts`: `current = getRainbowSettings()`
- `src/lib/features/background-builder/state/background-builder-state.svelte.ts`: `labSettings = getLabSettings()`
- `src/lib/features/background-builder/state/background-builder-state.svelte.ts`: `labSettings = getLabSettings()`
- `src/lib/features/background-builder/state/background-builder-state.svelte.ts`: `current = getEmberSettings()`
- `src/lib/features/background-builder/state/background-builder-state.svelte.ts`: `labSettings = getLabSettings()`
- `src/lib/features/background-builder/state/background-builder-state.svelte.ts`: `labSettings = getLabSettings()`
- `src/lib/features/background-builder/state/background-builder-state.svelte.ts`: `current = getCelestialLabSettings()`
- `src/lib/features/background-builder/state/background-builder-state.svelte.ts`: `labSettings = getLabSettings()`
- `src/lib/features/background-builder/state/background-builder-state.svelte.ts`: `labSettings = getLabSettings()`
- `src/lib/features/background-builder/state/background-builder-state.svelte.ts`: `current = getVoidLabSettings()`
- `src/lib/features/background-builder/state/background-builder-state.svelte.ts`: `labSettings = getLabSettings()`
- `src/lib/features/browse/shared/services/browse-event-handler.ts`: `libraryRepo = getLibraryRepository()`
- `src/lib/features/browse/shared/services/browse-event-handler.ts`: `libraryRepo = getLibraryRepository()`
- `src/lib/features/browse/shared/services/optimized-browser.ts`: `errorHandler = getErrorHandler()`
- _...and 1216 more_

### Services Passed as Arguments (top 20)

- `src/lib/features/admin/get-analytics-data-provider.ts`: `...(getUserMetricsAnalyzer())`
- `src/lib/features/admin/get-user-activity-tracker.ts`: `...(getPresenceTracker())`
- `src/lib/features/admin/get-user-metrics-analyzer.ts`: `...(getSystemStateManager())`
- `src/lib/features/background-builder/get-coral-scene-renderer.ts`: `...(getCoralAssetLoader())`
- `src/lib/features/browse/shared/get-browse-data-source.ts`: `...(getBrowseLoader())`
- `src/lib/features/browse/shared/get-browse-event-handler.ts`: `...(getBrowseLoader())`
- `src/lib/features/browse/shared/get-gallery-prefetcher.ts`: `...(getBrowseLoader())`
- `src/lib/features/browse/shared/get-optimized-browser.ts`: `...(getDeviceDetector())`
- `src/lib/features/choreo-card/getPrintCardRenderer.ts`: `...(getImageComposer())`
- `src/lib/features/community/get-location-sharing-orchestrator.ts`: `...(getGeocodingService())`
- `src/lib/features/connect/get-connect-friendship-manager.ts`: `...(getConnectPresenceTracker())`
- `src/lib/features/connect/get-connect-orchestrator.ts`: `...(getConnectPresenceTracker())`
- `src/lib/features/create/construct/option-picker/get-layout-detector.ts`: `...(getDeviceDetector())`
- `src/lib/features/create/construct/option-picker/get-option-filter.ts`: `...(getPositionAnalyzer())`
- `src/lib/features/create/construct/option-picker/get-option-sorter.ts`: `...(getPositionAnalyzer())`
- `src/lib/features/create/generate/circular/get-loop-executors.ts`: `...(getLOOPParameterProvider())`
- `src/lib/features/create/generate/circular/get-loop-executors.ts`: `...(getLOOPParameterProvider())`
- `src/lib/features/create/generate/circular/get-loop-executors.ts`: `...(getLOOPParameterProvider())`
- `src/lib/features/create/generate/circular/get-loop-executors.ts`: `...(getStrictRotatedLOOPExecutor())`
- `src/lib/features/create/generate/circular/get-loop-executors.ts`: `...(getStrictRotatedLOOPExecutor())`
- _...and 139 more_

### Reactive State with Interface Types

- `src/lib/features/create/generate/state/generate-actions.svelte.ts`: `$state<UIGenerationConfig | null>`
- `src/lib/features/create/generate/state/generate-config.svelte.ts`: `$state<UIGenerationConfig>`
- `src/lib/shared/application/state/performance-metrics-state.svelte.ts`: `$state<UIPerformanceMetrics>`
- `src/lib/shared/navigation/state/profile-settings-context.svelte.ts`: `$state<UIState>`
- `src/lib/features/create/shared/tool-panel/core/ToolPanel.svelte`: `$state<IAnimationStateRef>`
- `src/routes/test/coven-hub/+page.svelte`: `$state<(typeof RING_OPTIONS)[number]>`

## Per-Module Breakdown

### shared/animation-engine (139 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 3 | 74 | 18 | 676 |

**Renames:**
- `CanvasContextMenuBuilder.ts` → `canvas-context-menu-builder.ts`
- `AnimationRenderTypes.ts` → `animation-render-types.ts`
- `CharcoalSparkTypes.ts` → `charcoal-spark-types.ts`
- `FireTypes.ts` → `fire-types.ts`
- `LedColorPresets.ts` → `led-color-presets.ts`
- `LedPatterns.ts` → `led-patterns.ts`
- `LedTypes.ts` → `led-types.ts`
- `PropTipPoints.ts` → `prop-tip-points.ts`
- `QualityTypes.ts` → `quality-types.ts`
- `SvgTypes.ts` → `svg-types.ts`
- _...and 36 more_

### create (127 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 25 | 35 | 0 | 423 |

**Renames:**
- `ILOOPExecutor.ts` → `iloop-executor.ts`

### shared/pictograph (110 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 6 | 29 | 0 | 1045 |

**Renames:**
- `DashRotationMaps.ts` → `dash-rotation-maps.ts`
- `FloatRotationMaps.ts` → `float-rotation-maps.ts`
- `HandpathDirectionMaps.ts` → `handpath-direction-maps.ts`
- `ProAntiRotationMaps.ts` → `pro-anti-rotation-maps.ts`
- `StaticRotationMaps.ts` → `static-rotation-maps.ts`
- `PipelineDiagnostics.ts` → `pipeline-diagnostics.ts`
- `RotationDirectionUtils.ts` → `rotation-direction-utils.ts`
- `DefaultArrowPlacement.ts` → `default-arrow-placement.ts`
- `DefaultArrowPlacementState.svelte.ts` → `default-arrow-placement-state.svelte.ts`
- `GlobalArrowAdjustment.ts` → `global-arrow-adjustment.ts`
- _...and 24 more_

### shared/3d (74 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 4 | 15 | 106 |

**Renames:**
- `MotionData3D.ts` → `motion-data3-d.ts`
- `Viewer3DExportHooks.ts` → `viewer3-d-export-hooks.ts`
- `CharcoalMaterial3D.ts` → `charcoal-material3-d.ts`
- `CharcoalRenderer3D.ts` → `charcoal-renderer3-d.ts`
- `FireColorCurve3D.ts` → `fire-color-curve3-d.ts`
- `FireRenderer3D.ts` → `fire-renderer3-d.ts`
- `VolumetricFireMesh.ts` → `volumetric-fire-mesh.ts`
- `getTipPositionBridge3D.ts` → `get-tip-position-bridge3-d.ts`
- `InkPalettes.ts` → `ink-palettes.ts`
- `LedMaterial3D.ts` → `led-material3-d.ts`
- _...and 39 more_

### shared/foundation (58 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 2 | 6 | 3 | 6 | 1125 |

**Renames:**
- `ArtifactProvenance.ts` → `artifact-provenance.ts`
- `CreatorIntent.ts` → `creator-intent.ts`
- `CsvModels.ts` → `csv-models.ts`
- `HandPathData.ts` → `hand-path-data.ts`
- `Letter.ts` → `letter.ts`
- `LetterType.ts` → `letter-type.ts`
- `PublicSequenceIndex.ts` → `public-sequence-index.ts`
- `SequenceData.ts` → `sequence-data.ts`
- `SoloPropData.ts` → `solo-prop-data.ts`
- `SoloPropStepData.ts` → `solo-prop-step-data.ts`
- _...and 21 more_

### choreo-card (52 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 2 | 2 | 194 |

**Renames:**
- `Catalog.ts` → `catalog.ts`
- `DeckRelease.ts` → `deck-release.ts`
- `PageLayout.ts` → `page-layout.ts`
- `PageLayoutTypes.ts` → `page-layout-types.ts`
- `getPrintCardRenderer.ts` → `get-print-card-renderer.ts`
- `getTndFamilyAggregator.ts` → `get-tnd-family-aggregator.ts`
- `DeckCardBlobCache.ts` → `deck-card-blob-cache.ts`
- `PrintCardRenderer.ts` → `print-card-renderer.ts`

### shared/render (42 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 2 | 16 | 0 | 152 |

**Renames:**
- `IDirectRenderer.ts` → `i-direct-renderer.ts`

### shared/browse (35 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 6 | 9 | 14 | 187 |

**Renames:**
- `BrowseViewMode.ts` → `browse-view-mode.ts`
- `getBrowseFilter.ts` → `get-browse-filter.ts`
- `getBrowseLoader.ts` → `get-browse-loader.ts`
- `getBrowseSectionManager.ts` → `get-browse-section-manager.ts`
- `getBrowseThumbnailProvider.ts` → `get-browse-thumbnail-provider.ts`
- `getClaudeCodeCopier.ts` → `get-claude-code-copier.ts`
- `getMultiFilter.ts` → `get-multi-filter.ts`
- `getSequenceDetailLoader.ts` → `get-sequence-detail-loader.ts`
- `getThumbnailLocalCache.ts` → `get-thumbnail-local-cache.ts`
- `getThumbnailMetricsCollector.ts` → `get-thumbnail-metrics-collector.ts`
- _...and 19 more_

### shared/create (35 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 5 | 5 | 7 | 195 |

**Renames:**
- `TurnPatternData.ts` → `turn-pattern-data.ts`
- `getLoopDetector.ts` → `get-loop-detector.ts`
- `getOrientationCycleDetector.ts` → `get-orientation-cycle-detector.ts`
- `getReversalDetector.ts` → `get-reversal-detector.ts`
- `getSequenceDomainManager.ts` → `get-sequence-domain-manager.ts`
- `getSequenceImporter.ts` → `get-sequence-importer.ts`
- `getSequenceRepository.ts` → `get-sequence-repository.ts`
- `getSequenceTransformer.ts` → `get-sequence-transformer.ts`
- `BrowserVariationProvider.ts` → `browser-variation-provider.ts`
- `BuildResultTransformer.ts` → `build-result-transformer.ts`
- _...and 9 more_

### lab (34 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 1 | 7 | 0 | 90 |

### loop-labeler (33 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 2 | 3 | 0 | 91 |

**Renames:**
- `ILOOPDetector.ts` → `iloop-detector.ts`

### shared/sequence-viewer (33 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 5 | 5 | 7 | 82 |

**Renames:**
- `AuthActionQueue.svelte.ts` → `auth-action-queue.svelte.ts`
- `ExportCoordinator.svelte.ts` → `export-coordinator.svelte.ts`
- `ImageCompositionSync.svelte.ts` → `image-composition-sync.svelte.ts`
- `PlaybackController.svelte.ts` → `playback-controller.svelte.ts`
- `PropContextResolver.svelte.ts` → `prop-context-resolver.svelte.ts`
- `getPendingActionQueue.ts` → `get-pending-action-queue.ts`
- `getPublicSequenceHashMatcher.ts` → `get-public-sequence-hash-matcher.ts`
- `getSequenceDataProvider.ts` → `get-sequence-data-provider.ts`
- `getSequenceMotionLoader.ts` → `get-sequence-motion-loader.ts`
- `getSequenceViewer.ts` → `get-sequence-viewer.ts`
- _...and 2 more_

### compose (33 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 1 | 10 | 0 | 52 |

### shared/effects (30 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 174 |

**Renames:**
- `BubblePalettes.ts` → `bubble-palettes.ts`
- `EffectsConfig.ts` → `effects-config.ts`
- `EffectsPreset.ts` → `effects-preset.ts`
- `FrostPalettes.ts` → `frost-palettes.ts`
- `PetalPalettes.ts` → `petal-palettes.ts`
- `PulsePalettes.ts` → `pulse-palettes.ts`
- `SilkPalettes.ts` → `silk-palettes.ts`
- `SmokePalettes.ts` → `smoke-palettes.ts`
- `WaterPalettes.ts` → `water-palettes.ts`
- `Bloom2DRenderer.test.ts` → `bloom2-d-renderer.test.ts`
- _...and 20 more_

### museum (30 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 1 | 12 | 0 | 51 |

### shared/navigation (27 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 2 | 6 | 8 | 66 |

**Renames:**
- `ViewportMode.ts` → `viewport-mode.ts`
- `ModuleSelection.ts` → `module-selection.ts`
- `ViewportState.ts` → `viewport-state.ts`
- `getDeepLinker.ts` → `get-deep-linker.ts`
- `getKeyboardNavigator.ts` → `get-keyboard-navigator.ts`
- `getLetterDeriver.ts` → `get-letter-deriver.ts`
- `getModuleSelector.ts` → `get-module-selector.ts`
- `getPositionDeriver.ts` → `get-position-deriver.ts`
- `getSheetRouter.ts` → `get-sheet-router.ts`
- `getSidebarTabToggler.ts` → `get-sidebar-tab-toggler.ts`
- _...and 4 more_

### shared/voice-control (27 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 1 | 23 | 0 | 81 |

**Renames:**
- `ISubInterpreter.ts` → `i-sub-interpreter.ts`

### shared/auth (25 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 1 | 5 | 5 | 125 |

**Renames:**
- `AccessTier.ts` → `access-tier.ts`
- `AuthNudgeTrigger.ts` → `auth-nudge-trigger.ts`
- `FeatureFlag.ts` → `feature-flag.ts`
- `UsernameValidation.ts` → `username-validation.ts`
- `UserRole.ts` → `user-role.ts`
- `getAccountManager.ts` → `get-account-manager.ts`
- `getGlobalFeatureFlagPersister.ts` → `get-global-feature-flag-persister.ts`
- `getUserDocumentManager.ts` → `get-user-document-manager.ts`
- `getUserFeatureFlagPersister.ts` → `get-user-feature-flag-persister.ts`
- `getUsernameValidator.ts` → `get-username-validator.ts`
- _...and 1 more_

### shared/gamification (20 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 6 | 0 | 36 |

### tika (18 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 2 | 7 | 0 | 44 |

### retro (17 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 6 | 7 | 0 | 34 |

**Renames:**
- `IAsciiRenderer.ts` → `i-ascii-renderer.ts`

### admin (17 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 2 | 5 | 0 | 39 |

### browse (17 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 4 | 8 | 0 | 13 |

### feedback (16 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 2 | 5 | 0 | 27 |

### learn (16 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 5 | 0 | 55 |

### shared/render-graph (15 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 13 | 0 | 24 |

### library (13 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 4 | 5 | 0 | 18 |

### shared/library (12 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 4 | 2 | 90 |

**Renames:**
- `Collection.ts` → `collection.ts`
- `LibrarySequence.ts` → `library-sequence.ts`
- `SequenceTag.ts` → `sequence-tag.ts`
- `getLibraryRepository.ts` → `get-library-repository.ts`
- `getTagMigrator.ts` → `get-tag-migrator.ts`
- `IPublicIndexSyncer.ts` → `i-public-index-syncer.ts`
- `LibraryRepository.ts` → `library-repository.ts`

### shared/qr (12 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 6 | 2 | 26 |

**Renames:**
- `getQRCodeGenerator.ts` → `get-qr-code-generator.ts`
- `getShortCodeManager.ts` → `get-short-code-manager.ts`

### train (12 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 8 | 0 | 32 |

### shared/feedback (11 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 1 | 2 | 0 | 29 |

**Renames:**
- `IFeedbackTesterWorkflow.ts` → `i-feedback-tester-workflow.ts`

### shared/application (10 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 1 | 4 | 0 | 242 |

### shared/sync (10 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 9 | 0 | 26 |

### festivals (8 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 1 | 10 |

**Renames:**
- `getFestivalSubmissionReviewer.ts` → `get-festival-submission-reviewer.ts`

### video (8 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 1 | 4 | 0 | 18 |

**Renames:**
- `IEndpointDetector.ts` → `i-endpoint-detector.ts`

### skel2tka (8 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 4 | 0 | 16 |

### shared/comparison (8 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 2 | 5 | 0 | 28 |

### shared/share (8 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 2 | 3 | 0 | 20 |

### shared/device (7 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 3 | 2 | 57 |

**Renames:**
- `getDeviceDetector.ts` → `get-device-detector.ts`
- `getViewportManager.ts` → `get-viewport-manager.ts`

### shared/mandala (7 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 1 | 2 | 1 | 40 |

**Renames:**
- `getMandalaGeometryCalculator.ts` → `get-mandala-geometry-calculator.ts`

### assemble-lab (7 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 1 | 0 | 9 |

### background-builder (7 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 5 | 0 | 15 |

### levels (7 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 2 | 0 | 0 | 8 |

### shared/multi-grid (7 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 2 | 1 | 0 | 12 |

### shared/video-export (7 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 2 | 0 | 8 |

### shared/settings (6 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 1 | 1 | 24 |

**Renames:**
- `PropTypeRegistry.ts` → `prop-type-registry.ts`
- `AppSettings.ts` → `app-settings.ts`
- `getSettingsPersister.ts` → `get-settings-persister.ts`
- `PhotoPickerLayoutDetector.ts` → `photo-picker-layout-detector.ts`
- `SettingsState.svelte.ts` → `settings-state.svelte.ts`

### arena (6 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 1 | 0 | 9 |

### community (6 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 2 | 0 | 10 |

### moderation (6 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 1 | 0 | 0 | 9 |

### poi (6 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 1 | 2 | 0 | 10 |

### promo-generator (6 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 5 | 0 | 15 |

### sticker-lab (6 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 2 | 0 | 0 | 6 |

### watch (6 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 1 | 4 | 0 | 12 |

### shared/keyboard (6 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 1 | 3 | 0 | 26 |

### shared/mobile (6 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 1 | 3 | 0 | 16 |

### shared/persistence (5 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 2 | 0 | 11 |

**Renames:**
- `DATABASE_CONSTANTS.ts` → `database_constants.ts`

### shared/train (5 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 1 | 1 | 31 |

**Renames:**
- `DetectionFrame.ts` → `detection-frame.ts`
- `PerformanceData.ts` → `performance-data.ts`
- `TrainDatabaseModels.ts` → `train-database-models.ts`
- `getCameraManager.ts` → `get-camera-manager.ts`
- `CameraManager.ts` → `camera-manager.ts`

### connect (5 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 5 | 0 | 11 |

### hall-of-shame (5 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 4 | 0 | 12 |

### landing (5 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 4 | 0 | 11 |

### mandala (5 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 1 | 0 | 0 | 5 |

### voice-sessions (5 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 1 | 0 | 0 | 18 |

### shared/community (5 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 20 |

### shared/video (5 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 3 | 0 | 10 |

### shared/desktop (4 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 1 | 2 |

**Renames:**
- `DesktopDataSeeder.ts` → `desktop-data-seeder.ts`
- `DesktopInitializer.ts` → `desktop-initializer.ts`
- `getDesktopInitializer.ts` → `get-desktop-initializer.ts`
- `TauriAuthBridge.ts` → `tauri-auth-bridge.ts`

### shared/qr-video (4 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 1 | 0 | 2 |

**Renames:**
- `HeadlessAnimationOrchestrator.ts` → `headless-animation-orchestrator.ts`
- `WorkerAssetLoader.ts` → `worker-asset-loader.ts`

### fuse (4 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 4 |

### gallery-generator (4 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 1 | 1 | 0 | 4 |

### landing-preview (4 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 1 | 0 | 6 |

### village (4 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 1 | 0 | 0 | 9 |

### shared/lan-sync (4 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 4 | 0 | 10 |

### shared/messaging (4 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 3 | 0 | 17 |

### shared/offline (4 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 3 | 0 | 10 |

### shared/choreo-card (3 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 5 |

**Renames:**
- `CardDesignerContextMenuBuilder.ts` → `card-designer-context-menu-builder.ts`

### shared/video-collaboration (3 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 47 |

**Renames:**
- `CollaborativeVideo.ts` → `collaborative-video.ts`

### write (3 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 2 | 0 | 3 |

### shared/analytics (3 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 18 |

### shared/export-panel (3 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 2 | 0 | 5 |

### shared/subscription (3 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 7 |

### shared/video-record (3 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 1 | 0 | 9 |

### shared/voice-sessions (2 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 1 | 1 | 8 |

**Renames:**
- `getVoiceSessionRepository.ts` → `get-voice-session-repository.ts`

### hand-paths (2 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 1 | 0 | 3 |

### store (2 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 2 |

### shared/audio (2 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 1 | 0 | 2 |

### shared/debug (2 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 1 | 0 | 6 |

### shared/museum (2 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 2 |

### shared/onboarding (2 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 1 | 0 | 4 |

### shared/phrase-effort-lab (2 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 4 |

### shared/platform (2 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 1 | 0 | 0 | 3 |

### shared/push (2 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 1 | 0 | 5 |

### shared/sequence-engine (2 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 1 | 0 | 1 |

### shared/user-search (2 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 6 |

### other (1 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 1 |

**Renames:**
- `SpotlightGestures.svelte.ts` → `spotlight-gestures.svelte.ts`

### shared/input (1 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 0 |

**Renames:**
- `InputCapabilities.svelte.ts` → `input-capabilities.svelte.ts`

### shared/learn (1 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 1 | 0 | 7 |

**Renames:**
- `CodexLetterMappingRepo.ts` → `codex-letter-mapping-repo.ts`

### shared/loop-labeler (1 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 1 | 4 |

**Renames:**
- `getLoopDisplayResolver.ts` → `get-loop-display-resolver.ts`

### shared/poi (1 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 14 |

**Renames:**
- `StripPattern.ts` → `strip-pattern.ts`

### shared/tika (1 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 1 | 0 | 4 |

**Renames:**
- `TikaPictographCache.ts` → `tika-pictograph-cache.ts`

### shared/validation (1 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 4 |

**Renames:**
- `ValidationResult.ts` → `validation-result.ts`

### shared/assemble-lab (1 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 3 |

### shared/delight (1 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 1 | 0 | 4 |

### shared/effort (1 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 1 |

### shared/error (1 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 1 |

### shared/landing (1 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 4 |

### shared/presence (1 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 1 | 0 | 2 |

### shared/services (1 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 1 |

### shared/theme (1 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 2 |
