# Ceremony Flattening — Dry Run Report

Generated: 2026-05-29T02:58:34.801Z

## Summary

| Metric | Count |
|---|---|
| PascalCase .ts files | 1305 |
| Feature modules | 38 |
| Shared modules | 57 |
| implementations/ dirs | 98 |
| contracts/ dirs (empty) | 2 |
| contracts/ dirs (types-only) | 56 |
| contracts/ dirs (interfaces) | 10 |
| Stateless classes | 51 |
| Stateless-deps classes | 52 |
| Stateless-cache classes | 15 |
| Stateful classes | 439 |
| Not-a-class (already functions) | 63 |
| Parse errors | 0 |

## Edge Cases

| Category | Count | Risk |
|---|---|---|
| Dynamic imports (PascalCase) | 261 | Agent handles manually |
| Stored service refs | 1250 | Must unwrap each method call |
| Service passed as argument | 154 | Receiver param type needs update |
| Reactive state with interface type | 5 | Needs restructuring |

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
- `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts`: `import('$lib/shared/animation-engine/getFireDefaultsLoader')`
- `src/lib/shared/animation-engine/services/implementations/CanvasLifecycleManager.ts`: `import('../effects/EffectRenderer')`
- `src/lib/shared/animation-engine/services/implementations/managers/EffectSystem.ts`: `import('../EffectController')`
- `src/lib/shared/animation-engine/services/implementations/managers/PlaybackSync.ts`: `import('../EffectRendererManager')`
- `src/lib/shared/animation-engine/services/implementations/managers/PlaybackSync.ts`: `import('../../../domain/types/TipEffectTypes')`
- `src/lib/shared/animation-engine/services/implementations/RenderContextFactory.ts`: `import('$lib/shared/animation-engine/services/implementations/Canvas2DAnimationRenderer')`
- `src/lib/shared/animation-engine/services/implementations/RenderContextFactory.ts`: `import('$lib/shared/animation-engine/services/implementations/EffectRendererManager')`
- `src/lib/shared/animation-engine/services/implementations/RenderContextFactory.ts`: `import('$lib/shared/animation-engine/services/implementations/TrailCapturer')`
- `src/lib/shared/animation-engine/services/implementations/RenderContextFactory.ts`: `import('$lib/shared/animation-engine/services/implementations/AnimationRenderLoop')`
- `src/lib/shared/animation-engine/services/implementations/RenderContextFactory.ts`: `import('$lib/shared/animation-engine/services/implementations/AnimationPrecomputer.svelte')`
- `src/lib/shared/animation-engine/services/implementations/RenderContextFactory.ts`: `import('$lib/shared/animation-engine/services/implementations/CanvasResizer.svelte')`
- `src/lib/shared/animation-engine/services/implementations/RenderContextFactory.ts`: `import('$lib/shared/animation-engine/services/implementations/FireTipTracker')`
- `src/lib/shared/animation-engine/services/implementations/RenderContextFactory.ts`: `import('$lib/shared/animation-engine/services/implementations/LedTipTracker')`
- `src/lib/shared/animation-engine/services/implementations/RenderContextFactory.ts`: `import('$lib/shared/animation-engine/services/implementations/DeviceTierDetector')`
- `src/lib/shared/animation-engine/services/implementations/RenderContextFactory.ts`: `import('$lib/shared/animation-engine/services/implementations/FrameBudgetMonitor')`
- `src/lib/shared/animation-engine/services/implementations/RenderContextFactory.ts`: `import('../effects/EffectRenderer')`
- `src/lib/shared/animation-engine/services/implementations/SequenceFramePreRenderer.ts`: `import('$lib/shared/animation-engine/services/implementations/Canvas2DAnimationRenderer')`
- `src/lib/shared/application/services/implementations/ErrorHandler.ts`: `import('$lib/shared/feedback/services/implementations/FeedbackRepository')`
- `src/lib/shared/application/state/services.svelte.ts`: `import('../../settings/state/SettingsState.svelte')`
- `src/lib/shared/application/state/services.svelte.ts`: `import('../../settings/state/SettingsState.svelte')`
- `src/lib/shared/auth/services/auth-boot-orchestrator.ts`: `import('$lib/shared/settings/state/SettingsState.svelte')`
- `src/lib/shared/auth/services/authenticator.ts`: `import('$lib/shared/desktop/isDesktop')`
- `src/lib/shared/auth/services/authenticator.ts`: `import('$lib/shared/desktop/TauriAuthBridge')`
- `src/lib/shared/auth/state/authState.svelte.ts`: `import('$lib/shared/desktop/isDesktop')`
- `src/lib/shared/auth/state/authState.svelte.ts`: `import('../../settings/state/SettingsState.svelte')`
- `src/lib/shared/choreo-card/services/choreo-card-context-menu.ts`: `import('$lib/shared/share/domain/models/ShareOptions')`
- `src/lib/shared/choreo-card/services/choreo-card-context-menu.ts`: `import('$lib/shared/share/services/implementations/Sharer')`
- `src/lib/shared/choreo-card/services/choreo-card-context-menu.ts`: `import('$lib/shared/share/domain/models/ShareOptions')`
- `src/lib/shared/choreo-card/services/choreo-card-context-menu.ts`: `import('$lib/shared/share/services/implementations/Sharer')`
- `src/lib/shared/choreo-card/services/choreo-card-context-menu.ts`: `import('$lib/shared/browse/getClaudeCodeCopier')`
- `src/lib/shared/create/services/BuildResultTransformer.ts`: `import('$lib/shared/foundation/domain/models/SequenceData')`
- `src/lib/shared/create/services/BuildResultTransformer.ts`: `import('$lib/shared/foundation/domain/models/SequenceData')`
- `src/lib/shared/navigation/services/sequence-encoder.ts`: `import('$lib/shared/qr/services/implementations/CompositionalEncoder')`
- `src/lib/shared/navigation/services/sequence-encoder.ts`: `import('$lib/shared/qr/services/implementations/CompositionalDecoder')`
- `src/lib/shared/navigation/state/navigation-state.svelte.ts`: `import('../../presence/getPresenceTracker')`
- `src/lib/shared/navigation/state/navigation-state.svelte.ts`: `import('../../presence/getPresenceTracker')`
- `src/lib/shared/onboarding/state/app-entry-state.svelte.ts`: `import('$lib/shared/auth/state/authState.svelte')`
- `src/lib/shared/onboarding/state/app-entry-state.svelte.ts`: `import('$lib/shared/auth/state/authState.svelte')`
- `src/lib/shared/onboarding/state/first-run-state.svelte.ts`: `import('$lib/shared/auth/state/authState.svelte')`
- `src/lib/shared/onboarding/state/first-run-state.svelte.ts`: `import('$lib/shared/auth/state/authState.svelte')`
- `src/lib/shared/pictograph/shared/state/visibility-state.svelte.ts`: `import('../../../settings/state/SettingsState.svelte')`
- `src/lib/shared/qr/services/implementations/compositional-utils.ts`: `import('$lib/features/create/generate/circular/services/implementations/StrictRotatedLOOPExecutor')`
- `src/lib/shared/qr/services/implementations/compositional-utils.ts`: `import('$lib/features/create/generate/circular/services/implementations/StrictMirroredLOOPExecutor')`
- `src/lib/shared/qr/services/implementations/compositional-utils.ts`: `import('$lib/features/create/generate/circular/services/implementations/StrictFlippedLOOPExecutor')`
- `src/lib/shared/qr/services/implementations/compositional-utils.ts`: `import('$lib/features/create/generate/circular/services/implementations/StrictSwappedLOOPExecutor')`
- `src/lib/shared/qr/services/implementations/compositional-utils.ts`: `import('$lib/features/create/generate/circular/services/implementations/StrictInvertedLOOPExecutor')`
- `src/lib/shared/qr/services/implementations/compositional-utils.ts`: `import('$lib/features/create/generate/circular/services/implementations/RewoundLOOPExecutor')`
- `src/lib/shared/render/services/implementations/ImageComposer.ts`: `import('../../../sequence-viewer/services/implementations/CellCacheKeyDeriver')`
- `src/lib/shared/render/services/implementations/ImageComposer.ts`: `import('../../../mandala/getMandalaGeometryCalculator')`
- `src/lib/shared/render/services/implementations/ImageComposer.ts`: `import('../../../pictograph/shared/services/implementations/PictographPreparer')`
- `src/lib/shared/render/services/implementations/LayerCompositor.ts`: `import('./Canvas2DDirectRenderer')`
- `src/lib/shared/render/services/implementations/LayerCompositor.ts`: `import('./SvgAssetLoader')`
- `src/lib/shared/render/services/implementations/LayerCompositor.ts`: `import('./SvgAssetLoader')`
- `src/lib/shared/render/services/implementations/TextRenderer.ts`: `import('$lib/shared/render/getGlyphCache')`
- `src/lib/shared/render/services/implementations/WorkerRenderPool.ts`: `import('./LayerCompositor')`
- `src/lib/shared/render/utils/cache-benchmark.ts`: `import('../getImageComposer')`
- `src/lib/shared/render/utils/cache-benchmark.ts`: `import('$lib/shared/browse/getBrowseLoader')`
- `src/lib/shared/render/utils/cache-benchmark.ts`: `import('../getImageComposer')`
- `src/lib/shared/render/utils/pictograph-to-svg.ts`: `import('../getGlyphCache')`
- `src/lib/shared/render/workers/composition.worker.ts`: `import('../services/implementations/ImageComposer')`
- `src/lib/shared/render/workers/composition.worker.ts`: `import('../services/implementations/TextRenderer')`
- `src/lib/shared/render/workers/composition.worker.ts`: `import('../services/implementations/Canvas2DDirectRenderer')`
- `src/lib/shared/render/workers/composition.worker.ts`: `import('../services/implementations/LayerCompositor')`
- `src/lib/shared/render/workers/composition.worker.ts`: `import('../services/implementations/PictographKeyHasher')`
- `src/routes/admin/+layout.ts`: `import('$lib/shared/auth/state/authState.svelte')`
- `src/routes/api/render-pictograph/+server.ts`: `import('$lib/shared/render/services/implementations/Canvas2DDirectRenderer')`
- `src/routes/q/[code]/+page.server.ts`: `import('$lib/server/firebaseAdmin')`
- `src/lib/features/admin/components/AdminDashboard.svelte`: `import('$lib/features/loop-labeler/components/LOOPLabelerModule.svelte')`
- `src/lib/features/admin/components/AdminDashboard.svelte`: `import('./analytics/PostHogDashboard.svelte')`
- `src/lib/features/admin/components/AdminDashboard.svelte`: `import('$lib/features/loop-labeler/components/LOOPLabelerModule.svelte')`
- `src/lib/features/admin/components/AdminDashboard.svelte`: `import('./analytics/PostHogDashboard.svelte')`
- `src/lib/features/arena/ArenaModule.svelte`: `import('./components/battle/ArenaBattleView.svelte')`
- `src/lib/features/arena/ArenaModule.svelte`: `import('./components/leaderboard/ArenaLeaderboardView.svelte')`
- `src/lib/features/arena/ArenaModule.svelte`: `import('./components/detail/ArenaSequenceDetail.svelte')`
- `src/lib/features/choreo-card/components/CardDesigner.svelte`: `import('$lib/shared/application/services/implementations/HapticFeedback')`
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
- `src/lib/features/lab/LabModule.svelte`: `import('./tools/coral-lab/CoralLab.svelte')`
- `src/lib/features/lab/phrase-effort-lab/PhraseEffortLabModule.svelte`: `import('$lib/shared/foundation/domain/models/Letter')`
- `src/lib/features/levels/LevelsModule.svelte`: `import('$lib/features/levels/level5-lab/Level5LabModule.svelte')`
- `src/lib/features/levels/LevelsModule.svelte`: `import('$lib/features/skewlab/SkewLabModule.svelte')`
- `src/lib/features/levels/LevelsModule.svelte`: `import('$lib/features/levels/level7-lab/Level7LabModule.svelte')`
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
- `src/lib/features/watch/components/feed/FeedContainer.svelte`: `import('../../services/FeedSnapDetector')`
- `src/lib/features/watch/components/feed/FeedContainer.svelte`: `import('../../services/FeedPreloader')`
- `src/lib/features/watch/components/feed/FeedContainer.svelte`: `import('../../services/FeedScrollBehavior')`
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
- `src/lib/shared/browse/components/ChoreoCardThumbnail/ChoreoCardThumbnail.svelte`: `import('$lib/shared/share/services/implementations/Sharer')`
- `src/lib/shared/browse/components/ChoreoCardThumbnail/ChoreoCardThumbnail.svelte`: `import('$lib/shared/share/services/implementations/Sharer')`
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
- `src/routes/+layout.svelte`: `import('$lib/shared/render/services/implementations/TextRenderer')`
- `src/routes/+layout.svelte`: `import('$lib/shared/platform/getNativeInitializer')`
- `src/routes/+layout.svelte`: `import('$lib/shared/desktop/getDesktopInitializer')`
- `src/routes/+layout.svelte`: `import('$lib/features/browse/shared/getGalleryPrefetcher')`
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
- `src/routes/q/[code]/+page.svelte`: `import('$lib/features/compose/services/implementations/VideoExportOrchestrator')`
- `src/routes/q/[code]/+page.svelte`: `import('$lib/shared/animation-engine/getVideoExporter')`
- `src/routes/q/[code]/+page.svelte`: `import('$lib/shared/animation-engine/getCompositeVideoRenderer')`
- `src/routes/q/[code]/+page.svelte`: `import('$lib/shared/animation-engine/getExportGlyphPrerenderer')`
- `src/routes/q/[code]/+page.svelte`: `import('$lib/shared/animation-engine/getBackgroundVideoEncoder')`
- `src/routes/q/[code]/+page.svelte`: `import('$lib/shared/sequence-viewer/components/AnimationPlayer.svelte')`
- `src/routes/q/[code]/+page.svelte`: `import('$lib/shared/animation-panel/components/AnimationPanel.svelte')`
- `src/routes/sequence/[id]/+page.svelte`: `import('$lib/shared/3d/components/Viewer3DFullscreen.svelte')`

### Stored Service References (top 30)

- `src/lib/features/admin/services/audit-logger.ts`: `currentUser = getAuthSync()`
- `src/lib/features/admin/services/PostHogAnalyticsProvider.ts`: `posthog = getPostHogInstance()`
- `src/lib/features/admin/services/PostHogAnalyticsProvider.ts`: `posthog = getPostHogInstance()`
- `src/lib/features/arena/services/arena-repository.ts`: `hydrator = getSequenceHydrator()`
- `src/lib/features/assemble-lab/services/SvgPropAnimator.ts`: `preset = getAnimationVisibilityManager()`
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
- `src/lib/features/browse/shared/services/implementations/BrowseEventHandler.ts`: `libraryRepo = getLibraryRepository()`
- `src/lib/features/browse/shared/services/implementations/BrowseEventHandler.ts`: `libraryRepo = getLibraryRepository()`
- `src/lib/features/browse/shared/services/implementations/OptimizedBrowser.ts`: `errorHandler = getErrorHandler()`
- `src/lib/features/browse/shared/services/implementations/OptimizedBrowser.ts`: `errorHandler = getErrorHandler()`
- _...and 1220 more_

### Services Passed as Arguments (top 20)

- `src/lib/features/admin/getAnalyticsDataProvider.ts`: `...(getUserMetricsAnalyzer())`
- `src/lib/features/admin/getUserActivityTracker.ts`: `...(getPresenceTracker())`
- `src/lib/features/admin/getUserMetricsAnalyzer.ts`: `...(getSystemStateManager())`
- `src/lib/features/background-builder/getCoralSceneRenderer.ts`: `...(getCoralAssetLoader())`
- `src/lib/features/browse/shared/getBrowseDataSource.ts`: `...(getBrowseLoader())`
- `src/lib/features/browse/shared/getBrowseEventHandler.ts`: `...(getBrowseLoader())`
- `src/lib/features/browse/shared/getGalleryPrefetcher.ts`: `...(getBrowseLoader())`
- `src/lib/features/browse/shared/getOptimizedBrowser.ts`: `...(getDeviceDetector())`
- `src/lib/features/choreo-card/getPrintCardRenderer.ts`: `...(getImageComposer())`
- `src/lib/features/community/getLocationSharingOrchestrator.ts`: `...(getGeocodingService())`
- `src/lib/features/connect/getConnectFriendshipManager.ts`: `...(getConnectPresenceTracker())`
- `src/lib/features/connect/getConnectOrchestrator.ts`: `...(getConnectPresenceTracker())`
- `src/lib/features/create/construct/option-picker/getLayoutDetector.ts`: `...(getDeviceDetector())`
- `src/lib/features/create/construct/option-picker/getOptionFilter.ts`: `...(getPositionAnalyzer())`
- `src/lib/features/create/construct/option-picker/getOptionSorter.ts`: `...(getPositionAnalyzer())`
- `src/lib/features/create/generate/circular/getLOOPExecutors.ts`: `...(getStrictRotatedLOOPExecutor())`
- `src/lib/features/create/generate/circular/getLOOPExecutors.ts`: `...(getStrictRotatedLOOPExecutor())`
- `src/lib/features/create/generate/circular/getLOOPExecutors.ts`: `...(getStrictRotatedLOOPExecutor())`
- `src/lib/features/create/generate/circular/getLOOPExecutors.ts`: `...(getStrictRotatedLOOPExecutor())`
- `src/lib/features/create/generate/circular/getOrientationCycleExtender.ts`: `...(getOrientationCycleDetector())`
- _...and 134 more_

### Reactive State with Interface Types

- `src/lib/features/create/generate/state/generate-actions.svelte.ts`: `$state<UIGenerationConfig | null>`
- `src/lib/features/create/generate/state/generate-config.svelte.ts`: `$state<UIGenerationConfig>`
- `src/lib/shared/application/state/PerformanceMetricsState.svelte.ts`: `$state<UIPerformanceMetrics>`
- `src/lib/shared/navigation/state/profile-settings-context.svelte.ts`: `$state<UIState>`
- `src/lib/features/create/shared/tool-panel/core/ToolPanel.svelte`: `$state<IAnimationStateRef>`

## Per-Module Breakdown

### create (158 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 71 | 25 | 35 | 55 | 387 |

**Renames:**
- `getFilterPersister.ts` → `get-filter-persister.ts`
- `getLayoutDetector.ts` → `get-layout-detector.ts`
- `getOptionFilter.ts` → `get-option-filter.ts`
- `getOptionLoader.ts` → `get-option-loader.ts`
- `getOptionSorter.ts` → `get-option-sorter.ts`
- `getOptionTransitionCoordinator.ts` → `get-option-transition-coordinator.ts`
- `getPositionAnalyzer.ts` → `get-position-analyzer.ts`
- `FilterPersister.ts` → `filter-persister.ts`
- (+flatten) `LayoutDetector.ts` → `layout-detector.ts` *(convert to functions)*
- (+flatten) `OptionFilter.ts` → `option-filter.ts`
- _...and 148 more_

### shared/animation-engine (124 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 78 | 4 | 74 | 18 | 627 |

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
- _...and 114 more_

### shared/pictograph (80 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 47 | 9 | 37 | 0 | 1033 |

**Renames:**
- (+flatten) `ArrowLifecycleManager.ts` → `arrow-lifecycle-manager.ts`
- `DashRotationMaps.ts` → `dash-rotation-maps.ts`
- `FloatRotationMaps.ts` → `float-rotation-maps.ts`
- `HandpathDirectionMaps.ts` → `handpath-direction-maps.ts`
- `ProAntiRotationMaps.ts` → `pro-anti-rotation-maps.ts`
- `StaticRotationMaps.ts` → `static-rotation-maps.ts`
- `PipelineDiagnostics.ts` → `pipeline-diagnostics.ts`
- (+flatten) `ArrowAdjustmentCalculator.ts` → `arrow-adjustment-calculator.ts`
- (+flatten) `ArrowLocationCalculator.ts` → `arrow-location-calculator.ts`
- (+flatten) `ArrowRotationCalculator.ts` → `arrow-rotation-calculator.ts`
- _...and 70 more_

### shared/3d (58 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 9 | 2 | 6 | 15 | 78 |

**Renames:**
- (+flatten) `CameraMovementController.ts` → `camera-movement-controller.ts`
- `MotionData3D.ts` → `motion-data3-d.ts`
- `Viewer3DExportHooks.ts` → `viewer3-d-export-hooks.ts`
- `CharcoalMaterial3D.ts` → `charcoal-material3-d.ts`
- `CharcoalRenderer3D.ts` → `charcoal-renderer3-d.ts`
- `FireColorCurve3D.ts` → `fire-color-curve3-d.ts`
- `FireRenderer3D.ts` → `fire-renderer3-d.ts`
- `VolumetricFireMesh.ts` → `volumetric-fire-mesh.ts`
- `getTipPositionBridge3D.ts` → `get-tip-position-bridge3-d.ts`
- `InkPalettes.ts` → `ink-palettes.ts`
- _...and 48 more_

### shared/foundation (39 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 9 | 6 | 2 | 6 | 1035 |

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
- _...and 29 more_

### shared/render (36 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 19 | 2 | 16 | 13 | 125 |

**Renames:**
- `ImageFormat.ts` → `image-format.ts`
- `SequenceExportOptions.ts` → `sequence-export-options.ts`
- `SvgConversion.ts` → `svg-conversion.ts`
- `getCanvas2DRenderer.ts` → `get-canvas2-d-renderer.ts`
- `getCanvasManager.ts` → `get-canvas-manager.ts`
- `getCompositionDispatcher.ts` → `get-composition-dispatcher.ts`
- `getGlyphCache.ts` → `get-glyph-cache.ts`
- `getImageComposer.ts` → `get-image-composer.ts`
- `getImageFormatConverter.ts` → `get-image-format-converter.ts`
- `getLayerCompositor.ts` → `get-layer-compositor.ts`
- _...and 26 more_

### shared/browse (31 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 2 | 6 | 9 | 14 | 158 |

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
- _...and 21 more_

### shared/voice-control (31 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 24 | 1 | 23 | 6 | 80 |

**Renames:**
- `getCommandDispatcher.ts` → `get-command-dispatcher.ts`
- `getCommandInterpreter.ts` → `get-command-interpreter.ts`
- `getTTSProvider.ts` → `get-tts-provider.ts`
- `getVoiceControlServices.ts` → `get-voice-control-services.ts`
- `getVoiceSessionRecorder.ts` → `get-voice-session-recorder.ts`
- `getWakeWordDetector.ts` → `get-wake-word-detector.ts`
- `ISubInterpreter.ts` → `i-sub-interpreter.ts`
- (+flatten) `CommandDispatcher.ts` → `command-dispatcher.ts` *(convert to functions)*
- (+flatten) `CommandInterpreter.ts` → `command-interpreter.ts`
- (+flatten) `CreateCommandHandler.ts` → `create-command-handler.ts`
- _...and 21 more_

### shared/effects (30 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 171 |

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

### shared/sequence-viewer (27 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 15 | 5 | 8 | 7 | 56 |

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
- _...and 17 more_

### shared/gamification (26 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 19 | 1 | 6 | 7 | 50 |

**Renames:**
- `getAchievementManager.ts` → `get-achievement-manager.ts`
- `getChallengeCoordinator.ts` → `get-challenge-coordinator.ts`
- `getDailyChallengeManager.ts` → `get-daily-challenge-manager.ts`
- `getGamificationNotifier.ts` → `get-gamification-notifier.ts`
- `getSkillProgressionTracker.ts` → `get-skill-progression-tracker.ts`
- `getStreakTracker.ts` → `get-streak-tracker.ts`
- `getWeeklyChallengeManager.ts` → `get-weekly-challenge-manager.ts`
- (+flatten) `AchievementManager.ts` → `achievement-manager.ts`
- (+flatten) `ChallengeCoordinator.ts` → `challenge-coordinator.ts`
- (+flatten) `DailyChallengeManager.ts` → `daily-challenge-manager.ts`
- _...and 16 more_

### shared/render-graph (26 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 13 | 0 | 12 | 0 | 64 |

**Renames:**
- `Backend.ts` → `backend.ts`
- `EffectPasses.ts` → `effect-passes.ts`
- `FirePass.ts` → `fire-pass.ts`
- `FrameGraph.ts` → `frame-graph.ts`
- `LedPass.ts` → `led-pass.ts`
- `ParticlePass.ts` → `particle-pass.ts`
- `RenderPass.ts` → `render-pass.ts`
- `TrailPass.ts` → `trail-pass.ts`
- (+flatten) `BackendFactory.ts` → `backend-factory.ts`
- (+flatten) `FBOPool.ts` → `fbo-pool.ts`
- _...and 16 more_

### compose (24 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 10 | 1 | 9 | 5 | 27 |

**Renames:**
- `AudioTrack.ts` → `audio-track.ts`
- `AudioStateManager.svelte.ts` → `audio-state-manager.svelte.ts`
- `CellOperationsManager.svelte.ts` → `cell-operations-manager.svelte.ts`
- `CompositionUIManager.svelte.ts` → `composition-ui-manager.svelte.ts`
- `TempoRegionManager.svelte.ts` → `tempo-region-manager.svelte.ts`
- `getAnimationPathCache.ts` → `get-animation-path-cache.ts`
- `getAnimationPlaybackControllerFactory.ts` → `get-animation-playback-controller-factory.ts`
- (+flatten) `CompositionSyncer.ts` → `composition-syncer.ts`
- (+flatten) `ExportGLCompositor.ts` → `export-gl-compositor.ts`
- (+flatten) `TunnelModeSequenceManager.ts` → `tunnel-mode-sequence-manager.ts` *(convert to functions)*
- _...and 14 more_

### lab (24 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 8 | 1 | 7 | 12 | 48 |

**Renames:**
- `ConstraintSolver.ts` → `constraint-solver.ts`
- `LayoutPersistence.ts` → `layout-persistence.ts`
- `LayoutPresets.ts` → `layout-presets.ts`
- `EffectDescriptor.ts` → `effect-descriptor.ts`
- `getEffectPointsPersister.ts` → `get-effect-points-persister.ts`
- `getTipPointOverrideProvider.ts` → `get-tip-point-override-provider.ts`
- (+flatten) `EffectPointsPersister.ts` → `effect-points-persister.ts`
- (+flatten) `TipPointOverrideProvider.ts` → `tip-point-override-provider.ts`
- `getScreenshotLoader.ts` → `get-screenshot-loader.ts`
- `getScreenshotOrchestrator.ts` → `get-screenshot-orchestrator.ts`
- _...and 14 more_

### village (24 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 1 | 0 | 0 | 50 |

**Renames:**
- `DeterministicProvider.ts` → `deterministic-provider.ts`
- `OllamaProvider.ts` → `ollama-provider.ts`
- `VillageDecisionEngine.ts` → `village-decision-engine.ts`
- `VillageEventLog.ts` → `village-event-log.ts`
- `CircleSystem.ts` → `circle-system.ts`
- `DecaySystem.ts` → `decay-system.ts`
- `FuneralSystem.ts` → `funeral-system.ts`
- `LifecycleSystem.ts` → `lifecycle-system.ts`
- `MonumentSystem.ts` → `monument-system.ts`
- `MovementSystem.ts` → `movement-system.ts`
- _...and 14 more_

### browse (23 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 14 | 4 | 8 | 9 | 11 |

**Renames:**
- `getBrowseCache.ts` → `get-browse-cache.ts`
- `getBrowseFilterPersister.ts` → `get-browse-filter-persister.ts`
- `getBrowseMetadataExtractor.ts` → `get-browse-metadata-extractor.ts`
- `getThumbnailRenderer.ts` → `get-thumbnail-renderer.ts`
- (+flatten) `BrowseCache.ts` → `browse-cache.ts`
- (+flatten) `BrowseFilter.ts` → `browse-filter.ts` *(convert to functions)*
- (+flatten) `BrowseMetadataExtractor.ts` → `browse-metadata-extractor.ts` *(convert to functions)*
- (+flatten) `MultiFilter.ts` → `multi-filter.ts` *(convert to functions)*
- (+flatten) `SequenceDifficultyCalculator.test.ts` → `sequence-difficulty-calculator.test.ts`
- (+flatten) `ThumbnailMetricsCollector.ts` → `thumbnail-metrics-collector.ts`
- _...and 13 more_

### shared/application (21 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 6 | 1 | 5 | 12 | 483 |

**Renames:**
- `getAnimator.ts` → `get-animator.ts`
- `getApplicationInitializer.ts` → `get-application-initializer.ts`
- `getAppState.ts` → `get-app-state.ts`
- `getAppStateInitializer.ts` → `get-app-state-initializer.ts`
- `getComponentManager.ts` → `get-component-manager.ts`
- `getDataTransformer.ts` → `get-data-transformer.ts`
- `getDeepLinkResolver.ts` → `get-deep-link-resolver.ts`
- `getErrorHandler.ts` → `get-error-handler.ts`
- `getHapticFeedback.ts` → `get-haptic-feedback.ts`
- `getPerformanceMetricsState.ts` → `get-performance-metrics-state.ts`
- _...and 11 more_

### shared/navigation (20 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 6 | 1 | 7 | 8 | 38 |

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
- _...and 10 more_

### shared/create (19 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 5 | 5 | 7 | 108 |

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

### train (18 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 8 | 0 | 8 | 8 | 64 |

**Renames:**
- `TrainEnums.ts` → `train-enums.ts`
- `TrainChallengeModels.ts` → `train-challenge-models.ts`
- `getHandAssigner.ts` → `get-hand-assigner.ts`
- `getHandLandmarker.ts` → `get-hand-landmarker.ts`
- `getHandTrackingStabilizer.ts` → `get-hand-tracking-stabilizer.ts`
- `getPerformanceHistoryTracker.ts` → `get-performance-history-tracker.ts`
- `getPositionDetector.ts` → `get-position-detector.ts`
- `getSessionCompletionProcessor.ts` → `get-session-completion-processor.ts`
- `getTrainChallengeManager.ts` → `get-train-challenge-manager.ts`
- `getVoiceCommandHandler.ts` → `get-voice-command-handler.ts`
- _...and 8 more_

### shared/auth (18 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 7 | 1 | 6 | 5 | 98 |

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
- _...and 8 more_

### admin (17 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 2 | 5 | 8 | 28 |

**Renames:**
- `AdminModels.ts` → `admin-models.ts`
- `getAdminChallengeManager.ts` → `get-admin-challenge-manager.ts`
- `getAnalyticsDataProvider.ts` → `get-analytics-data-provider.ts`
- `getEventActivityAnalyzer.ts` → `get-event-activity-analyzer.ts`
- `getPostHogAnalyticsProvider.ts` → `get-post-hog-analytics-provider.ts`
- `getPostHogUserAnalytics.ts` → `get-post-hog-user-analytics.ts`
- `getSystemStateManager.ts` → `get-system-state-manager.ts`
- `getUserActivityTracker.ts` → `get-user-activity-tracker.ts`
- `getUserMetricsAnalyzer.ts` → `get-user-metrics-analyzer.ts`
- `AnalyticsDataProvider.ts` → `analytics-data-provider.ts`
- _...and 7 more_

### feedback (16 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 2 | 5 | 8 | 25 |

**Renames:**
- `PreferenceItem.ts` → `preference-item.ts`
- `getAudioAnalyzer.ts` → `get-audio-analyzer.ts`
- `getFeedbackEditor.ts` → `get-feedback-editor.ts`
- `getFeedbackFormatter.ts` → `get-feedback-formatter.ts`
- `getFeedbackSorter.ts` → `get-feedback-sorter.ts`
- `getFeedbackSubtaskManager.ts` → `get-feedback-subtask-manager.ts`
- `getFeedbackTypeResolver.ts` → `get-feedback-type-resolver.ts`
- `getFormDraftPersister.ts` → `get-form-draft-persister.ts`
- `getVoiceRecorder.ts` → `get-voice-recorder.ts`
- `ArchiveLoader.ts` → `archive-loader.ts` *(convert to functions)*
- _...and 6 more_

### shared/sync (15 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 9 | 0 | 9 | 6 | 23 |

**Renames:**
- `getAdaptiveHeartbeat.ts` → `get-adaptive-heartbeat.ts`
- `getDeviceSyncCoordinator.ts` → `get-device-sync-coordinator.ts`
- `getMessageBatcher.ts` → `get-message-batcher.ts`
- `getMobileConnectionAdapter.ts` → `get-mobile-connection-adapter.ts`
- `getNetworkStatusMonitor.ts` → `get-network-status-monitor.ts`
- `getSequenceLocalCache.ts` → `get-sequence-local-cache.ts`
- (+flatten) `AdaptiveHeartbeat.ts` → `adaptive-heartbeat.ts`
- (+flatten) `DeviceSyncCoordinator.ts` → `device-sync-coordinator.ts`
- (+flatten) `HybridLogicalClock.ts` → `hybrid-logical-clock.ts`
- (+flatten) `MessageBatcher.ts` → `message-batcher.ts`
- _...and 5 more_

### library (14 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 4 | 2 | 5 | 19 |

**Renames:**
- `Act.ts` → `act.ts`
- `PublicSequenceIndex.ts` → `public-sequence-index.ts`
- `Tag.ts` → `tag.ts`
- `getArtifactExtractor.ts` → `get-artifact-extractor.ts`
- `getHandPathSaveOrchestrator.ts` → `get-hand-path-save-orchestrator.ts`
- `getLibrarySaveService.ts` → `get-library-save-service.ts`
- `getPublicIndexSyncer.ts` → `get-public-index-syncer.ts`
- `getSoloPropSaveOrchestrator.ts` → `get-solo-prop-save-orchestrator.ts`
- `ArtifactExtractor.ts` → `artifact-extractor.ts` *(convert to functions)*
- `FavoritesManager.ts` → `favorites-manager.ts` *(convert to functions)*
- _...and 4 more_

### retro (14 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 13 | 6 | 7 | 0 | 29 |

**Renames:**
- `IAsciiRenderer.ts` → `i-ascii-renderer.ts`
- (+flatten) `AsciiRenderer.ts` → `ascii-renderer.ts` *(convert to functions)*
- (+flatten) `BrailleHybridRenderer.ts` → `braille-hybrid-renderer.ts`
- (+flatten) `CommandParser.ts` → `command-parser.ts`
- (+flatten) `DosFileSystem.ts` → `dos-file-system.ts`
- (+flatten) `DosSoundManager.ts` → `dos-sound-manager.ts`
- (+flatten) `SvgToBrailleConverter.ts` → `svg-to-braille-converter.ts` *(convert to functions)*
- (+flatten) `EraRendererBase.ts` → `era-renderer-base.ts` *(convert to functions)*
- (+flatten) `DoomLoader.ts` → `doom-loader.ts`
- (+flatten) `FakeLoadingManager.ts` → `fake-loading-manager.ts`
- _...and 4 more_

### tika (14 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 2 | 6 | 4 | 20 |

**Renames:**
- `getTikaMarkdownParser.ts` → `get-tika-markdown-parser.ts`
- `getTikaMessageExtractor.ts` → `get-tika-message-extractor.ts`
- `getTikaSessionFormatter.ts` → `get-tika-session-formatter.ts`
- `getTikaSessionRepository.ts` → `get-tika-session-repository.ts`
- `ConversationMemoryRetriever.ts` → `conversation-memory-retriever.ts` *(convert to functions)*
- `StaticPictographWriter.ts` → `static-pictograph-writer.ts`
- `TikaInteractionTracker.ts` → `tika-interaction-tracker.ts` *(convert to functions)*
- `TikaModelProvider.ts` → `tika-model-provider.ts`
- `TikaPictographLoader.ts` → `tika-pictograph-loader.ts`
- `TikaQuizGenerator.ts` → `tika-quiz-generator.ts`
- _...and 4 more_

### shared/comparison (14 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 7 | 2 | 5 | 7 | 34 |

**Renames:**
- `getMotionSignatureGenerator.ts` → `get-motion-signature-generator.ts`
- `getSequenceAligner.ts` → `get-sequence-aligner.ts`
- `getSequenceCanonicalizer.ts` → `get-sequence-canonicalizer.ts`
- `getSequenceEquivalenceDetector.ts` → `get-sequence-equivalence-detector.ts`
- `getSimilarityCalculator.ts` → `get-similarity-calculator.ts`
- `getSpatialTransformDetector.ts` → `get-spatial-transform-detector.ts`
- `getStepSignatureGenerator.ts` → `get-step-signature-generator.ts`
- (+flatten) `MotionSignatureGenerator.ts` → `motion-signature-generator.ts` *(convert to functions)*
- (+flatten) `SequenceAligner.ts` → `sequence-aligner.ts`
- (+flatten) `SequenceCanonicalizer.ts` → `sequence-canonicalizer.ts`
- _...and 4 more_

### learn (13 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 5 | 0 | 5 | 7 | 37 |

**Renames:**
- `getCodex.ts` → `get-codex.ts`
- `getCodexLetterMappingRepo.ts` → `get-codex-letter-mapping-repo.ts`
- (+flatten) `Codex.ts` → `codex.ts`
- `Type1LetterData.ts` → `type1-letter-data.ts`
- `getConceptProgressTracker.ts` → `get-concept-progress-tracker.ts`
- `getGapDetector.ts` → `get-gap-detector.ts`
- `getUserKnowledgeProfilePersister.ts` → `get-user-knowledge-profile-persister.ts`
- `getQuizRepoManager.ts` → `get-quiz-repo-manager.ts`
- `getQuizSessionManager.ts` → `get-quiz-session-manager.ts`
- (+flatten) `QuizRepoManager.ts` → `quiz-repo-manager.ts`
- _...and 3 more_

### loop-labeler (13 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 2 | 3 | 5 | 38 |

**Renames:**
- `getLOOPDetector.ts` → `get-loop-detector.ts`
- `getLOOPLabelsFirebaseRepository.ts` → `get-loop-labels-firebase-repository.ts`
- `getSequenceFeatureExtractor.ts` → `get-sequence-feature-extractor.ts`
- `getStepComparisonOrchestrator.ts` → `get-step-comparison-orchestrator.ts`
- `getTransformationAnalyzer.ts` → `get-transformation-analyzer.ts`
- `StepComparisonOrchestrator.ts` → `step-comparison-orchestrator.ts` *(convert to functions)*
- `ILOOPDetector.ts` → `iloop-detector.ts`
- `LOOPDetector.ts` → `loop-detector.ts`
- `LOOPLabelsFirebaseRepository.ts` → `loop-labels-firebase-repository.ts`
- `SequenceFeatureExtractor.ts` → `sequence-feature-extractor.ts`
- _...and 3 more_

### video (13 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 5 | 1 | 4 | 7 | 24 |

**Renames:**
- `getColorEndpointDetector.ts` → `get-color-endpoint-detector.ts`
- `getDetectionCorrector.ts` → `get-detection-corrector.ts`
- `getEffectConfigMapper.ts` → `get-effect-config-mapper.ts`
- `getLedThresholdDetector.ts` → `get-led-threshold-detector.ts`
- `getVideoTipAdapter.ts` → `get-video-tip-adapter.ts`
- `getVideoTrailsExporter.ts` → `get-video-trails-exporter.ts`
- `getVideoTrailsRepository.ts` → `get-video-trails-repository.ts`
- `IEndpointDetector.ts` → `i-endpoint-detector.ts`
- (+flatten) `ColorEndpointDetector.ts` → `color-endpoint-detector.ts`
- (+flatten) `LedThresholdDetector.ts` → `led-threshold-detector.ts`
- _...and 3 more_

### museum (12 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 1 | 8 | 0 | 22 |

**Renames:**
- `MuseumAtmosphere.ts` → `museum-atmosphere.ts`
- `MuseumEditorPlacement.ts` → `museum-editor-placement.ts`
- `MuseumGeometryBuilder.ts` → `museum-geometry-builder.ts`
- `MuseumGridBuilder.ts` → `museum-grid-builder.ts` *(convert to functions)*
- `MuseumModelLoader.ts` → `museum-model-loader.ts`
- `MuseumPhysicsProvider.ts` → `museum-physics-provider.ts`
- `MuseumPortals.ts` → `museum-portals.ts`
- `MuseumRoomLightPool.ts` → `museum-room-light-pool.ts`
- `MuseumVillageManager.ts` → `museum-village-manager.ts`
- `ProximityGrid.ts` → `proximity-grid.ts`
- _...and 2 more_

### shared/persistence (12 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 2 | 0 | 2 | 1 | 66 |

**Renames:**
- `TKADatabase.ts` → `tka-database.ts`
- `DATABASE_CONSTANTS.ts` → `database_constants.ts`
- `FilteringEnums.ts` → `filtering-enums.ts`
- `UserWorkType.ts` → `user-work-type.ts`
- `FilteringModels.ts` → `filtering-models.ts`
- `UserProject.ts` → `user-project.ts`
- `UserWorkData.ts` → `user-work-data.ts`
- `FilteringTypes.ts` → `filtering-types.ts`
- `getPersistenceInitializationService.ts` → `get-persistence-initialization-service.ts`
- `IFilterPersister.ts` → `i-filter-persister.ts`
- _...and 2 more_

### shared/share (12 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 5 | 2 | 3 | 4 | 37 |

**Renames:**
- `InstagramLink.ts` → `instagram-link.ts`
- `InstagramMedia.ts` → `instagram-media.ts`
- `ShareOptions.ts` → `share-options.ts`
- `getMediaBundler.ts` → `get-media-bundler.ts`
- `getSequenceImageSharer.ts` → `get-sequence-image-sharer.ts`
- `getSharer.ts` → `get-sharer.ts`
- `getVideoUploader.ts` → `get-video-uploader.ts`
- (+flatten) `MediaBundler.ts` → `media-bundler.ts`
- (+flatten) `PreviewCache.ts` → `preview-cache.ts`
- (+flatten) `R2VideoUploader.ts` → `r2-video-uploader.ts` *(convert to functions)*
- _...and 2 more_

### background-builder (11 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 5 | 6 | 14 |

**Renames:**
- `getCoralAssetLoader.ts` → `get-coral-asset-loader.ts`
- `getCoralSceneRenderer.ts` → `get-coral-scene-renderer.ts`
- `getCosmicLabController.ts` → `get-cosmic-lab-controller.ts`
- `getOceanBackgroundSystem.ts` → `get-ocean-background-system.ts`
- `getPreviewAnimationController.ts` → `get-preview-animation-controller.ts`
- `getUFOStatusPoller.ts` → `get-ufo-status-poller.ts`
- `CoralAssetLoader.ts` → `coral-asset-loader.ts`
- `CoralSceneRenderer.ts` → `coral-scene-renderer.ts`
- `CosmicLabController.ts` → `cosmic-lab-controller.ts`
- `PreviewAnimationController.ts` → `preview-animation-controller.ts`
- _...and 1 more_

### promo-generator (11 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 5 | 0 | 5 | 5 | 16 |

**Renames:**
- `Timeline.ts` → `timeline.ts`
- `getPromoAnimationController.ts` → `get-promo-animation-controller.ts`
- `getPromoOrchestrator.ts` → `get-promo-orchestrator.ts`
- `getPromoSceneManager.ts` → `get-promo-scene-manager.ts`
- `getPromoVideoExporter.ts` → `get-promo-video-exporter.ts`
- `getScreenshotInjector.ts` → `get-screenshot-injector.ts`
- (+flatten) `PromoAnimationController.ts` → `promo-animation-controller.ts`
- (+flatten) `PromoOrchestrator.ts` → `promo-orchestrator.ts`
- (+flatten) `PromoSceneManager.ts` → `promo-scene-manager.ts`
- (+flatten) `PromoVideoExporter.ts` → `promo-video-exporter.ts`
- _...and 1 more_

### watch (11 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 1 | 4 | 6 | 14 |

**Renames:**
- `getFeedLoader.ts` → `get-feed-loader.ts`
- `getFeedPreloader.ts` → `get-feed-preloader.ts`
- `getFeedScrollBehavior.ts` → `get-feed-scroll-behavior.ts`
- `getFeedSnapDetector.ts` → `get-feed-snap-detector.ts`
- `getPublicVideoLoader.ts` → `get-public-video-loader.ts`
- `getVideoPlaybackController.ts` → `get-video-playback-controller.ts`
- `FeedLoader.ts` → `feed-loader.ts` *(convert to functions)*
- `FeedPreloader.ts` → `feed-preloader.ts`
- `FeedScrollBehavior.ts` → `feed-scroll-behavior.ts`
- `FeedSnapDetector.ts` → `feed-snap-detector.ts`
- _...and 1 more_

### connect (10 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 5 | 5 | 17 |

**Renames:**
- `getConnectFriendshipManager.ts` → `get-connect-friendship-manager.ts`
- `getConnectInviteHandler.ts` → `get-connect-invite-handler.ts`
- `getConnectOrchestrator.ts` → `get-connect-orchestrator.ts`
- `getConnectPresenceTracker.ts` → `get-connect-presence-tracker.ts`
- `getConnectSessionManager.ts` → `get-connect-session-manager.ts`
- `ConnectOrchestrator.ts` → `connect-orchestrator.ts`
- `FriendshipManager.ts` → `friendship-manager.ts`
- `InviteHandler.ts` → `invite-handler.ts`
- `PresenceTracker.ts` → `presence-tracker.ts`
- `SessionManager.ts` → `session-manager.ts`

### shared/keyboard (10 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 4 | 1 | 3 | 4 | 29 |

**Renames:**
- `KeyboardEvent.ts` → `keyboard-event.ts`
- `Shortcut.ts` → `shortcut.ts`
- `getCommandPalette.ts` → `get-command-palette.ts`
- `getKeyboardShortcutManager.ts` → `get-keyboard-shortcut-manager.ts`
- `getShortcutCustomizer.ts` → `get-shortcut-customizer.ts`
- `getShortcutRegistry.ts` → `get-shortcut-registry.ts`
- (+flatten) `CommandPalette.ts` → `command-palette.ts`
- (+flatten) `KeyboardShortcutManager.ts` → `keyboard-shortcut-manager.ts`
- (+flatten) `ShortcutCustomizer.ts` → `shortcut-customizer.ts`
- (+flatten) `ShortcutRegistry.ts` → `shortcut-registry.ts` *(convert to functions)*

### poi (9 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 3 | 1 | 2 | 3 | 21 |

**Renames:**
- `DeviceTypes.ts` → `device-types.ts`
- `PatternPreset.ts` → `pattern-preset.ts`
- `PoiImageLibraryEntry.ts` → `poi-image-library-entry.ts`
- `getOpenPixelPoiAdapter.ts` → `get-open-pixel-poi-adapter.ts`
- `getPoiDeviceManager.ts` → `get-poi-device-manager.ts`
- `getStripPatternEngine.ts` → `get-strip-pattern-engine.ts`
- (+flatten) `OpenPixelPoiAdapter.ts` → `open-pixel-poi-adapter.ts`
- (+flatten) `PoiDeviceManager.ts` → `poi-device-manager.ts`
- (+flatten) `StripPatternEngine.ts` → `strip-pattern-engine.ts` *(convert to functions)*

### shared/sequence-engine (9 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 5 | 0 | 1 | 0 | 15 |

**Renames:**
- (+flatten) `ContinuityConstraint.ts` → `continuity-constraint.ts`
- (+flatten) `HandPathConstraint.ts` → `hand-path-constraint.ts`
- (+flatten) `ReversalConstraint.ts` → `reversal-constraint.ts`
- `ConstraintPresets.ts` → `constraint-presets.ts`
- (+flatten) `BrowserDataProvider.ts` → `browser-data-provider.ts`
- `SequenceEngineTypes.ts` → `sequence-engine-types.ts`
- `IOrientationPropagator.ts` → `i-orientation-propagator.ts`
- `ITransitionGraph.ts` → `i-transition-graph.ts`
- (+flatten) `TransitionGraph.ts` → `transition-graph.ts`

### choreo-card (8 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 2 | 2 | 59 |

**Renames:**
- `Catalog.ts` → `catalog.ts`
- `DeckRelease.ts` → `deck-release.ts`
- `PageLayout.ts` → `page-layout.ts`
- `PageLayoutTypes.ts` → `page-layout-types.ts`
- `getPrintCardRenderer.ts` → `get-print-card-renderer.ts`
- `getTndFamilyAggregator.ts` → `get-tnd-family-aggregator.ts`
- `DeckCardBlobCache.ts` → `deck-card-blob-cache.ts`
- `PrintCardRenderer.ts` → `print-card-renderer.ts`

### hall-of-shame (8 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 4 | 4 | 19 |

**Renames:**
- `getAgeVerifier.ts` → `get-age-verifier.ts`
- `getHallOfShameLoader.ts` → `get-hall-of-shame-loader.ts`
- `getHallOfShameSubmitter.ts` → `get-hall-of-shame-submitter.ts`
- `getHallOfShameVoter.ts` → `get-hall-of-shame-voter.ts`
- `AgeVerifier.ts` → `age-verifier.ts`
- `HallOfShameLoader.ts` → `hall-of-shame-loader.ts`
- `HallOfShameSubmitter.ts` → `hall-of-shame-submitter.ts`
- `HallOfShameVoter.ts` → `hall-of-shame-voter.ts`

### skel2tka (8 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 4 | 0 | 4 | 4 | 14 |

**Renames:**
- `getImageModeHandLandmarker.ts` → `get-image-mode-hand-landmarker.ts`
- `getPhase1OverlayRenderer.ts` → `get-phase1-overlay-renderer.ts`
- `getTrainingDataPersister.ts` → `get-training-data-persister.ts`
- `getVideoHandAnalyzer.ts` → `get-video-hand-analyzer.ts`
- (+flatten) `ImageModeHandLandmarker.ts` → `image-mode-hand-landmarker.ts`
- (+flatten) `Phase1OverlayRenderer.ts` → `phase1-overlay-renderer.ts`
- (+flatten) `TrainingDataPersister.ts` → `training-data-persister.ts`
- (+flatten) `VideoHandAnalyzer.ts` → `video-hand-analyzer.ts`

### shared/lan-sync (8 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 4 | 0 | 4 | 4 | 17 |

**Renames:**
- `getLanSyncCoordinator.ts` → `get-lan-sync-coordinator.ts`
- `getPeerConnectionManager.ts` → `get-peer-connection-manager.ts`
- `getSyncRoomBroadcaster.ts` → `get-sync-room-broadcaster.ts`
- `getSyncRoomDiscovery.ts` → `get-sync-room-discovery.ts`
- (+flatten) `LanSyncCoordinator.ts` → `lan-sync-coordinator.ts`
- (+flatten) `PeerConnectionManager.ts` → `peer-connection-manager.ts`
- (+flatten) `SyncRoomBroadcaster.ts` → `sync-room-broadcaster.ts`
- (+flatten) `SyncRoomDiscovery.ts` → `sync-room-discovery.ts`

### shared/mobile (8 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 4 | 1 | 3 | 4 | 9 |

**Renames:**
- `getGestureHandler.ts` → `get-gesture-handler.ts`
- `getMobileFullscreenManager.ts` → `get-mobile-fullscreen-manager.ts`
- `getPWAEngagementTracker.ts` → `get-pwa-engagement-tracker.ts`
- `getPWAInstallDismissalManager.ts` → `get-pwa-install-dismissal-manager.ts`
- (+flatten) `GestureHandler.ts` → `gesture-handler.ts` *(convert to functions)*
- (+flatten) `MobileFullscreenManager.ts` → `mobile-fullscreen-manager.ts`
- (+flatten) `PWAEngagementTracker.ts` → `pwa-engagement-tracker.ts`
- (+flatten) `PWAInstallDismissalManager.ts` → `pwa-install-dismissal-manager.ts`

### moderation (7 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 1 | 0 | 5 | 8 |

**Renames:**
- `ContentModerationError.ts` → `content-moderation-error.ts`
- `getContentAppealManager.ts` → `get-content-appeal-manager.ts`
- `getContentModerator.ts` → `get-content-moderator.ts`
- `getReportQuerier.ts` → `get-report-querier.ts`
- `getReportResolver.ts` → `get-report-resolver.ts`
- `getReportSubmitter.ts` → `get-report-submitter.ts`
- `ReportResolver.ts` → `report-resolver.ts` *(convert to functions)*

### shared/export-panel (7 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 2 | 0 | 2 | 1 | 16 |

**Renames:**
- `CompositeLayout.ts` → `composite-layout.ts`
- `ExportSettings.ts` → `export-settings.ts`
- `MediaFormat.ts` → `media-format.ts`
- `ShareMode.ts` → `share-mode.ts`
- `getExportOrchestrator.ts` → `get-export-orchestrator.ts`
- (+flatten) `ExportOrchestrator.ts` → `export-orchestrator.ts`
- (+flatten) `ExportUrlManager.ts` → `export-url-manager.ts`

### shared/library (7 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 1 | 2 | 79 |

**Renames:**
- `Collection.ts` → `collection.ts`
- `LibrarySequence.ts` → `library-sequence.ts`
- `SequenceTag.ts` → `sequence-tag.ts`
- `getLibraryRepository.ts` → `get-library-repository.ts`
- `getTagMigrator.ts` → `get-tag-migrator.ts`
- `IPublicIndexSyncer.ts` → `i-public-index-syncer.ts`
- `LibraryRepository.ts` → `library-repository.ts`

### voice-sessions (6 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 1 | 0 | 5 | 8 |

**Renames:**
- `getTierPromotionEngine.ts` → `get-tier-promotion-engine.ts`
- `getVoiceSessionAnalyzer.ts` → `get-voice-session-analyzer.ts`
- `getVoiceSessionFormatter.ts` → `get-voice-session-formatter.ts`
- `getVoiceSessionReplayer.ts` → `get-voice-session-replayer.ts`
- `getVoiceSessionServices.ts` → `get-voice-session-services.ts`
- `VoiceSessionReplayer.ts` → `voice-session-replayer.ts` *(convert to functions)*

### shared/multi-grid (6 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 3 | 2 | 1 | 0 | 26 |

**Renames:**
- `GridModeOffsets.ts` → `grid-mode-offsets.ts`
- `TopologyPresets.ts` → `topology-presets.ts`
- `GridTopology.ts` → `grid-topology.ts`
- (+flatten) `TopologyBetaSeparator.ts` → `topology-beta-separator.ts` *(convert to functions)*
- (+flatten) `TopologyBuilder.ts` → `topology-builder.ts`
- (+flatten) `TopologyPropLoader.ts` → `topology-prop-loader.ts` *(convert to functions)*

### shared/offline (6 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 3 | 0 | 3 | 3 | 14 |

**Renames:**
- `getConflictResolver.ts` → `get-conflict-resolver.ts`
- `getGalleryOfflineCache.ts` → `get-gallery-offline-cache.ts`
- `getOfflineCacheOrchestrator.ts` → `get-offline-cache-orchestrator.ts`
- (+flatten) `ConflictResolver.ts` → `conflict-resolver.ts`
- (+flatten) `GalleryOfflineCache.ts` → `gallery-offline-cache.ts`
- (+flatten) `OfflineCacheOrchestrator.ts` → `offline-cache-orchestrator.ts`

### shared/qr (6 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 4 | 0 | 4 | 2 | 13 |

**Renames:**
- `getQRCodeGenerator.ts` → `get-qr-code-generator.ts`
- `getShortCodeManager.ts` → `get-short-code-manager.ts`
- (+flatten) `CompositionalDecoder.ts` → `compositional-decoder.ts`
- (+flatten) `CompositionalEncoder.ts` → `compositional-encoder.ts`
- (+flatten) `QRCodeGenerator.ts` → `qr-code-generator.ts`
- (+flatten) `ShortCodeManager.ts` → `short-code-manager.ts`

### shared/settings (6 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 1 | 0 | 1 | 1 | 24 |

**Renames:**
- `PropTypeRegistry.ts` → `prop-type-registry.ts`
- `AppSettings.ts` → `app-settings.ts`
- `getSettingsPersister.ts` → `get-settings-persister.ts`
- (+flatten) `FirebaseSettingsPersister.ts` → `firebase-settings-persister.ts`
- `PhotoPickerLayoutDetector.ts` → `photo-picker-layout-detector.ts`
- `SettingsState.svelte.ts` → `settings-state.svelte.ts`

### community (5 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 2 | 3 | 6 |

**Renames:**
- `getFollowingFeedProvider.ts` → `get-following-feed-provider.ts`
- `getGeocodingService.ts` → `get-geocoding-service.ts`
- `getLocationSharingOrchestrator.ts` → `get-location-sharing-orchestrator.ts`
- `GeocodingService.ts` → `geocoding-service.ts`
- `LocationSharingOrchestrator.ts` → `location-sharing-orchestrator.ts`

### levels (5 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 2 | 2 | 0 | 3 | 4 |

**Renames:**
- `getPoiConstraintValidator.ts` → `get-poi-constraint-validator.ts`
- `getPoiOptionFilterDecorator.ts` → `get-poi-option-filter-decorator.ts`
- `getPoiSequenceValidator.ts` → `get-poi-sequence-validator.ts`
- (+flatten) `PoiOptionFilterDecorator.ts` → `poi-option-filter-decorator.ts` *(convert to functions)*
- (+flatten) `PoiSequenceValidator.ts` → `poi-sequence-validator.ts` *(convert to functions)*

### shared/device (5 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 3 | 0 | 3 | 2 | 56 |

**Renames:**
- `getDeviceDetector.ts` → `get-device-detector.ts`
- `getViewportManager.ts` → `get-viewport-manager.ts`
- (+flatten) `DeviceDetector.ts` → `device-detector.ts`
- (+flatten) `GeoLocationProvider.ts` → `geo-location-provider.ts`
- (+flatten) `ViewportManager.svelte.ts` → `viewport-manager.svelte.ts`

### shared/feedback (5 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 3 | 1 | 2 | 1 | 17 |

**Renames:**
- `getContributorLoader.ts` → `get-contributor-loader.ts`
- `IFeedbackTesterWorkflow.ts` → `i-feedback-tester-workflow.ts`
- (+flatten) `FeedbackRepository.ts` → `feedback-repository.ts`
- (+flatten) `FeedbackStatusManager.ts` → `feedback-status-manager.ts` *(convert to functions)*
- (+flatten) `Notifier.ts` → `notifier.ts`

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

### shared/video (5 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 3 | 0 | 3 | 2 | 5 |

**Renames:**
- `getTrainingDataStore.ts` → `get-training-data-store.ts`
- `getVideoSourceProvider.ts` → `get-video-source-provider.ts`
- (+flatten) `TrainingDataStore.ts` → `training-data-store.ts`
- (+flatten) `VideoCache.ts` → `video-cache.ts`
- (+flatten) `VideoSourceProvider.ts` → `video-source-provider.ts`

### shared/video-export (5 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 1 | 0 | 1 | 1 | 11 |

**Renames:**
- `CameraKeyframe.ts` → `camera-keyframe.ts`
- `CapturedFrame.ts` → `captured-frame.ts`
- `ExportDiagnostics.ts` → `export-diagnostics.ts`
- `getCanvasFrameCapturer.ts` → `get-canvas-frame-capturer.ts`
- (+flatten) `CanvasFrameCapturer.ts` → `canvas-frame-capturer.ts`

### landing (4 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 4 | 0 | 10 |

**Renames:**
- `BroadcastRepository.ts` → `broadcast-repository.ts`
- `EndlessSpinnerOrchestrator.ts` → `endless-spinner-orchestrator.ts`
- `InfiniteSequenceGenerator.ts` → `infinite-sequence-generator.ts`
- `SpinnerMetricsRepository.ts` → `spinner-metrics-repository.ts`

### write (4 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 2 | 2 | 2 |

**Renames:**
- `getActManager.ts` → `get-act-manager.ts`
- `getMusicPlayer.ts` → `get-music-player.ts`
- `ActManager.ts` → `act-manager.ts`
- `MusicPlayer.ts` → `music-player.ts`

### shared/community (4 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 2 | 1 | 1 | 2 | 0 |

**Renames:**
- `getConnectionManager.ts` → `get-connection-manager.ts`
- `getLeaderboardManager.ts` → `get-leaderboard-manager.ts`
- (+flatten) `ConnectionManager.ts` → `connection-manager.ts`
- (+flatten) `LeaderboardManager.ts` → `leaderboard-manager.ts` *(convert to functions)*

### shared/desktop (4 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 1 | 2 |

**Renames:**
- `DesktopDataSeeder.ts` → `desktop-data-seeder.ts`
- `DesktopInitializer.ts` → `desktop-initializer.ts`
- `getDesktopInitializer.ts` → `get-desktop-initializer.ts`
- `TauriAuthBridge.ts` → `tauri-auth-bridge.ts`

### shared/mandala (4 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 3 | 1 | 2 | 1 | 14 |

**Renames:**
- `getMandalaGeometryCalculator.ts` → `get-mandala-geometry-calculator.ts`
- (+flatten) `MandalaGeometryCalculator.ts` → `mandala-geometry-calculator.ts` *(convert to functions)*
- (+flatten) `MandalaOverlayCanvas.ts` → `mandala-overlay-canvas.ts`
- (+flatten) `MandalaPathPreparer.ts` → `mandala-path-preparer.ts`

### landing-preview (3 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 1 | 1 | 3 |

**Renames:**
- `getSequenceMatcher.ts` → `get-sequence-matcher.ts`
- `SequenceMatcher.ts` → `sequence-matcher.ts`
- `VideoEditorController.svelte.ts` → `video-editor-controller.svelte.ts`

### sticker-lab (3 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 2 | 0 | 0 | 2 |

**Renames:**
- `LocalStickerSheetRepository.ts` → `local-sticker-sheet-repository.ts` *(convert to functions)*
- `ShapeCacheStore.ts` → `shape-cache-store.ts`
- `StickerSheetPdfExporter.ts` → `sticker-sheet-pdf-exporter.ts` *(convert to functions)*

### store (3 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 2 | 7 |

**Renames:**
- `Product.ts` → `product.ts`
- `getMerchCheckoutCreator.ts` → `get-merch-checkout-creator.ts`
- `getProductLoader.ts` → `get-product-loader.ts`

### shared/push (3 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 2 | 0 | 1 | 1 | 9 |

**Renames:**
- `getFCMTokenManager.ts` → `get-fcm-token-manager.ts`
- (+flatten) `FCMTokenManager.ts` → `fcm-token-manager.ts`
- (+flatten) `ForegroundMessageHandler.ts` → `foreground-message-handler.ts`

### arena (2 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 1 | 1 | 4 |

**Renames:**
- `getArenaOrchestrator.ts` → `get-arena-orchestrator.ts`
- `ArenaOrchestrator.ts` → `arena-orchestrator.ts`

### assemble-lab (2 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 1 | 1 | 2 |

**Renames:**
- `getSvgPropAnimator.ts` → `get-svg-prop-animator.ts`
- `SvgPropAnimator.ts` → `svg-prop-animator.ts`

### gallery-generator (2 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 1 | 1 | 0 | 2 |

**Renames:**
- `GalleryPersistence.ts` → `gallery-persistence.ts`
- `GalleryRenderer.ts` → `gallery-renderer.ts` *(convert to functions)*

### mandala (2 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 1 | 0 | 0 | 2 |

**Renames:**
- `FirebaseMandalaCollectionRepository.ts` → `firebase-mandala-collection-repository.ts`
- `LocalMandalaCollectionRepository.ts` → `local-mandala-collection-repository.ts` *(convert to functions)*

### shared/analytics (2 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 1 | 4 |

**Renames:**
- `ActivityEvent.ts` → `activity-event.ts`
- `getActivityLogger.ts` → `get-activity-logger.ts`

### shared/audio (2 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 1 | 0 | 1 | 1 | 1 |

**Renames:**
- `getSoundPlayer.ts` → `get-sound-player.ts`
- (+flatten) `SoundPlayer.ts` → `sound-player.ts`

### shared/debug (2 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 1 | 0 | 1 | 1 | 3 |

**Renames:**
- `getQuickAccessPersister.ts` → `get-quick-access-persister.ts`
- (+flatten) `QuickAccessPersister.ts` → `quick-access-persister.ts`

### shared/delight (2 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 1 | 0 | 1 | 1 | 5 |

**Renames:**
- `getDelightOrchestrator.ts` → `get-delight-orchestrator.ts`
- (+flatten) `DelightOrchestrator.ts` → `delight-orchestrator.ts`

### shared/messaging (2 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 2 | 0 | 2 | 0 | 14 |

**Renames:**
- (+flatten) `ConversationManager.ts` → `conversation-manager.ts`
- (+flatten) `Messenger.ts` → `messenger.ts`

### shared/onboarding (2 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 1 | 0 | 1 | 1 | 5 |

**Renames:**
- `getOnboardingPersister.ts` → `get-onboarding-persister.ts`
- (+flatten) `OnboardingPersister.ts` → `onboarding-persister.ts`

### shared/platform (2 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 1 | 1 | 0 | 1 | 1 |

**Renames:**
- `getNativeInitializer.ts` → `get-native-initializer.ts`
- (+flatten) `NativeInitializer.ts` → `native-initializer.ts` *(convert to functions)*

### shared/presence (2 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 1 | 0 | 1 | 1 | 5 |

**Renames:**
- `getPresenceTracker.ts` → `get-presence-tracker.ts`
- (+flatten) `PresenceTracker.ts` → `presence-tracker.ts`

### shared/qr-video (2 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 1 | 0 | 0 |

**Renames:**
- `HeadlessAnimationOrchestrator.ts` → `headless-animation-orchestrator.ts`
- `WorkerAssetLoader.ts` → `worker-asset-loader.ts`

### shared/video-record (2 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 1 | 0 | 1 | 0 | 4 |

**Renames:**
- `RecordingMetadata.ts` → `recording-metadata.ts`
- (+flatten) `VideoRecorder.ts` → `video-recorder.ts`

### other (1 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 1 |

**Renames:**
- `SpotlightGestures.svelte.ts` → `spotlight-gestures.svelte.ts`

### festivals (1 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 1 | 0 |

**Renames:**
- `getFestivalSubmissionReviewer.ts` → `get-festival-submission-reviewer.ts`

### hand-paths (1 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 1 | 0 | 3 |

**Renames:**
- `HandPathAnimator.ts` → `hand-path-animator.ts`

### shared/choreo-card (1 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 3 |

**Renames:**
- `CardDesignerContextMenuBuilder.ts` → `card-designer-context-menu-builder.ts`

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

### shared/video-collaboration (1 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 31 |

**Renames:**
- `CollaborativeVideo.ts` → `collaborative-video.ts`

### shared/voice-sessions (1 files)

| In impl/ | Stateless | Stateful | Getters | Consumers |
|---|---|---|---|---|
| 0 | 0 | 0 | 1 | 2 |

**Renames:**
- `getVoiceSessionRepository.ts` → `get-voice-session-repository.ts`

