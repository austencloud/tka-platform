<!--
  LabModule.svelte - Consolidated experiments and UI prototypes

  A unified module for temporary experiments that would otherwise clutter
  the sidebar as individual modules. Each tab is a self-contained experiment.

  Navigation between tabs is handled by the sidebar - no internal tab bar needed.

  When experiments graduate to production, move them to their proper module.
  When experiments are abandoned, delete the tab component.
-->
<script lang="ts">
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { LAB_TABS } from "$lib/shared/navigation/config/tab-definitions";

  // Dynamic tab imports - add new experiments here
  const tabComponents: Record<string, () => Promise<{ default: any }>> = {
    attribution: () => import("./tabs/AttributionLab.svelte"),
    level4: () => import("$lib/features/level5-lab/Level5LabModule.svelte"),
    level5: () => import("$lib/features/skewlab/SkewLabModule.svelte"),
    level7: () => import("$lib/features/conjoined-lab/ConjoinedLabModule.svelte"),
    poi: () => import("$lib/features/poi-lab/PoiLabModule.svelte"),
    avatar: () => import("./tabs/ProfileAvatarLab.svelte"),
    "photo-picker": () => import("./tabs/PhotoPickerLab.svelte"),
    terrain: () => import("$lib/features/terrain-research/TerrainResearchModule.svelte"),
    mandala: () =>
      import("$lib/features/mandala-generator/components/MandalaGeneratorModule.svelte"),
    backgrounds: () => import("$lib/features/background-builder/BackgroundBuilder.svelte"),
    landing: () => import("$lib/features/landing-preview/LandingPreviewModule.svelte"),
    composition: () => import("$lib/features/constraint-layout-lab/CompositionLab.svelte"),
    level6: () => import("$lib/features/level7-lab/Level7LabModule.svelte"),
    "multi-grid": () => import("$lib/features/multi-grid-lab/MultiGridLabModule.svelte"),
    "ml-training": () =>
      import("$lib/features/train/ml-training/components/MLTrainingModule.svelte"),
    community: () => import("$lib/features/community/Community.svelte"),
    connect: () => import("$lib/features/connect/ConnectModule.svelte"),
    voice: () => import("./tabs/VoiceControlLab.svelte"),
    vtg: () => import("$lib/features/vtg-lab/VtgLabModule.svelte"),
    "screenshot-gallery": () => import("./tabs/ScreenshotCaptureLab.svelte"),
    skel2tka: () => import("$lib/features/skel2tka/Skel2TKALab.svelte"),
    trigrid: () => import("$lib/features/trigrid-lab/TriGridLabModule.svelte"),
    duration: () => import("$lib/features/duration-lab/DurationLabModule.svelte"),
    "assemble-lab": () => import("$lib/features/assemble-lab/AssembleLabModule.svelte"),
    effects: () => import("$lib/features/effects-lab/EffectsLabModule.svelte"),
    disassemble: () => import("$lib/features/disassemble-lab/DisassembleLab.svelte"),
    "prop-buttons": () => import("./tabs/PropButtonLab.svelte"),
    retro: () => import("$lib/features/retro/win95/components/RetroLab.svelte"),
    "contact-ball": () => import("./tabs/ContactBallLab.svelte"),
    "ascii-pictograph": () => import("./tabs/AsciiPictographLab.svelte"),
    "retro-pictograph": () => import("./tabs/RetroPictographLab.svelte"),
    effort: () => import("$lib/features/effort-lab/EffortLabModule.svelte"),
    "phrase-effort": () => import("$lib/features/phrase-effort-lab/PhraseEffortLabModule.svelte"),
    "audio-toolkit": () => import("./tabs/audio-lab/AudioToolkitLab.svelte"),
    "hand-path-explorer": () => import("$lib/features/hand-path-explorer/HandPathExplorerLab.svelte"),
    "hand-path-builder": () => import("$lib/features/hand-path-builder/HandPathBuilderLab.svelte"),
    "video-trails": () => import("./tabs/video-trails/VideoTrailsLab.svelte"),
    "video-lab": () => import("./tabs/video-lab/VideoLab.svelte"),
  };

  // Get current tab, default to first tab
  const activeTab = $derived(navigationState.activeTab || LAB_TABS[0]?.id || "spell-layouts");

  // Load the active tab component
  let TabComponent = $state<any>(null);
  let loadError = $state<string | null>(null);

  $effect(() => {
    const loader = tabComponents[activeTab];
    if (loader) {
      loadError = null;
      // Call the loader and handle both Promise and direct module returns (HMR edge case)
      try {
        const result = loader();
        // Check if it's a Promise (has .then method)
        if (result && typeof result.then === "function") {
          result
            .then((mod: { default: any }) => {
              TabComponent = mod.default;
            })
            .catch((err: Error) => {
              console.error(`Failed to load lab tab "${activeTab}":`, err);
              loadError = `Failed to load "${activeTab}" tab`;
              TabComponent = null;
            });
        } else {
          // HMR might return the module directly instead of a Promise
          const mod = result as unknown as { default: any };
          if (mod && mod.default) {
            TabComponent = mod.default;
          } else {
            console.error(`Unexpected loader result for "${activeTab}":`, result);
            loadError = `Failed to load "${activeTab}" tab`;
            TabComponent = null;
          }
        }
      } catch (err) {
        console.error(`Error calling loader for "${activeTab}":`, err);
        loadError = `Failed to load "${activeTab}" tab`;
        TabComponent = null;
      }
    } else {
      loadError = `Unknown tab: ${activeTab}`;
      TabComponent = null;
    }
  });
</script>

<div class="lab-module">
  {#if loadError}
    <div class="lab-error">
      <i class="fas fa-exclamation-triangle"></i>
      <span>{loadError}</span>
    </div>
  {:else if TabComponent}
    <TabComponent />
  {:else}
    <div class="lab-loading">
      <i class="fas fa-circle-notch fa-spin"></i>
      <span>Loading experiment...</span>
    </div>
  {/if}
</div>

<style>
  .lab-module {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .lab-loading,
  .lab-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 100%;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: 14px;
  }

  .lab-error {
    color: var(--semantic-error, #ef4444);
  }

  .lab-loading i,
  .lab-error i {
    font-size: 24px;
  }
</style>
