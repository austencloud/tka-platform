<script lang="ts">
  import { onDestroy } from "svelte";

  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import SequencePickerModal from "$lib/shared/components/sequence-picker/SequencePickerModal.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import Viewer3DFullscreen from "$lib/shared/3d/components/Viewer3DFullscreen.svelte";
  import { setViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
  import { sceneEnvironmentIdForBackground } from "$lib/shared/3d/environments/domain/scene-environment";
  import { createPlaybackState } from "$lib/shared/3d/state/playback-state.svelte";
  import { createViewer3DState } from "$lib/shared/3d/state/viewer-3d-state.svelte";
  import { createFullscreenController } from "$lib/shared/fullscreen/state/fullscreen-controller.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
  import { consumeSceneStudioHandoff } from "$lib/features/scene-3d-collection/services/open-3d-scene";
  import Scene3DSetupGuide from "$lib/shared/3d/components/onboarding/Scene3DSetupGuide.svelte";
  import {
    isViewer3DIntroReplayRequested,
    shouldShowSceneStudioSetup,
  } from "$lib/shared/onboarding/state/viewer3d-intro-state";

  import SceneExportModal from "./components/SceneExportModal.svelte";
  import { createSceneVideoExport } from "./services/create-scene-video-export.svelte";

  const SOURCE_STORAGE_KEY = "tka-scene-studio-source";

  function loadSessionSource(): {
    sequence: SequenceData;
    bpm: number | null;
  } | null {
    if (typeof sessionStorage === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(SOURCE_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        sequence?: SequenceData;
        bpm?: number | null;
      };
      if (!parsed.sequence || !Array.isArray(parsed.sequence.steps))
        return null;
      return {
        sequence: parsed.sequence,
        bpm: typeof parsed.bpm === "number" ? parsed.bpm : null,
      };
    } catch {
      return null;
    }
  }

  const handoff = consumeSceneStudioHandoff();
  const restoredSource = handoff ?? loadSessionSource();
  const settings = getSettings();
  const viewer = createViewer3DState(undefined, {
    firstUseEnvironment: sceneEnvironmentIdForBackground(
      settings.backgroundType
    ),
    appDefaultProp: settings.bluePropType ?? null,
  });
  // The Studio is a 3D workspace even before choreography is chosen. Entering
  // here keeps the render loop, environment, camera, and neutral performer live.
  if (!restoredSource) viewer.enter3D();
  setViewer3DContext(viewer);

  const fullscreen = createFullscreenController({
    getHapticService: () => null,
    announce: (message) => console.debug("[3D Studio]", message),
  });
  const exporter = createSceneVideoExport(viewer);

  let sequence = $state<SequenceData | null>(restoredSource?.sequence ?? null);
  let currentStepBase = $state(0);
  let bpm = $state(restoredSource?.bpm ?? 60);
  let pickerOpen = $state(false);
  let exportOpen = $state(false);
  let loadedSequence = $state<SequenceData | null>(null);

  // The Studio is the one surface where "pick your stage" is a real question:
  // you arrive with nothing on it and build a scene to record. The guide waits
  // for choreography, because there is nothing to stage until then.
  const replaySetupGuide = isViewer3DIntroReplayRequested();
  let setupGuideUnseen = $state(
    replaySetupGuide || shouldShowSceneStudioSetup()
  );
  const showSetupGuide = $derived(Boolean(sequence) && setupGuideUnseen);

  const playback = createPlaybackState({
    persistenceKey: "tka-scene-studio-playback",
    onCycleComplete: () => {
      const stepCount = Math.max(1, sequence?.steps.length ?? 1);
      currentStepBase = (currentStepBase + 1) % stepCount;
      return true;
    },
  });
  const currentStep = $derived(currentStepBase + playback.progress);
  const isPlaying = $derived(playback.isPlaying);

  $effect(() => {
    playback.speed = bpm / 60;
  });

  $effect(() => {
    if (typeof sessionStorage === "undefined") return;
    if (!sequence) {
      sessionStorage.removeItem(SOURCE_STORAGE_KEY);
      return;
    }
    try {
      sessionStorage.setItem(
        SOURCE_STORAGE_KEY,
        JSON.stringify({ sequence, bpm })
      );
    } catch {
      // Source persistence is a convenience; the live workspace still works.
    }
  });

  $effect(() => {
    const next = sequence;
    if (!next || next === loadedSequence) return;
    loadedSequence = next;
    currentStepBase = 0;
    playback.setProgress(0);
    viewer.enter3D(next);
  });

  onDestroy(() => {
    playback.destroy();
    exporter.cancel();
    viewer.dispose();
  });

  function chooseSequence(next: SequenceData): void {
    playback.reset();
    loadedSequence = null;
    sequence = next;
  }

  function clearSequence(): void {
    playback.pause();
    sequence = null;
    loadedSequence = null;
    viewer.enter3D();
  }

  function togglePlayback(): void {
    playback.togglePlay();
  }
</script>

<section class="scene-studio" aria-label="3D Scene Studio">
  {#if !viewer.webgl2Available}
    <div class="unsupported-state" role="alert">
      <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
      <h1>3D isn’t available in this browser</h1>
      <p>WebGL 2 is required to build and export scenes.</p>
    </div>
  {:else}
    <Viewer3DFullscreen
      sequenceData={sequence}
      {currentStep}
      {isPlaying}
      {bpm}
      word={sequence?.word ??
        sequence?.intendedWord ??
        sequence?.displayName ??
        null}
      bluePropType={settings.bluePropType ?? settings.propType ?? "staff"}
      redPropType={settings.redPropType ?? settings.propType ?? "staff"}
      onClose={sequence ? clearSequence : undefined}
      onChangeSequence={() => (pickerOpen = true)}
      onExport={sequence ? () => (exportOpen = true) : undefined}
      exportBusy={exporter.state.isExporting}
      onPlaybackToggle={togglePlayback}
      onBpmChange={(nextBpm) => (bpm = nextBpm)}
      onProgressBarSeek={(targetStep) => {
        currentStepBase = targetStep;
        playback.setProgress(0);
      }}
      immersive={fullscreen.immersive}
      onToggleImmersive={(host) => fullscreen.toggleImmersive(host)}
      renderEmptyScene
      contained
    />
    {#if showSetupGuide}
      <Scene3DSetupGuide
        force={replaySetupGuide}
        onDismiss={() => (setupGuideUnseen = false)}
      />
    {/if}
    {#if !sequence}
      <div class="start-prompt" aria-labelledby="start-scene-title">
        <div class="prompt-copy">
          <h1 id="start-scene-title">No sequence loaded</h1>
          <p>Choose choreography to put on the stage.</p>
        </div>
        <div class="prompt-actions">
          <PanelButton
            variant="primary"
            onclick={(event) => {
              event.stopPropagation();
              pickerOpen = true;
            }}
          >
            <i class="fas fa-folder-open" aria-hidden="true"></i>
            Choose sequence
          </PanelButton>
          <PanelButton
            variant="secondary"
            onclick={(event) => {
              event.stopPropagation();
              void handleModuleChange("browse", "library");
            }}
          >
            <i class="fas fa-bookmark" aria-hidden="true"></i>
            Saved scenes
          </PanelButton>
        </div>
      </div>
    {/if}
  {/if}
</section>

<SequencePickerModal
  bind:open={pickerOpen}
  onClose={() => (pickerOpen = false)}
  onSelect={chooseSequence}
  title="Choose choreography for this scene"
/>

{#if sequence}
  <SceneExportModal
    bind:open={exportOpen}
    {sequence}
    {bpm}
    {exporter}
    onClose={() => (exportOpen = false)}
  />
{/if}

<style>
  .scene-studio {
    position: relative;
    display: flex;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    container-type: size;
    background: #080910;
  }

  .unsupported-state {
    position: relative;
    display: grid;
    width: 100%;
    min-height: 0;
    place-items: center;
    overflow: hidden;
    padding: clamp(1.25rem, 4cqi, 4.5rem);
    color: var(--theme-text, #fff);
  }

  .start-prompt {
    position: absolute;
    top: clamp(5.5rem, 12cqh, 8rem);
    left: clamp(1rem, 2.5cqi, 3rem);
    z-index: 3;
    display: flex;
    width: min(28rem, calc(100% - 7rem));
    flex-direction: column;
    gap: 1.125rem;
    padding: 1.25rem;
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.14));
    border-radius: 0.75rem;
    /* The scene is already visually rich. A solid workbench panel keeps the
       controls legible without turning the prompt into another glass card. */
    background: #0c0e16;
    box-shadow: var(--theme-panel-shadow, 0 1rem 3rem rgba(0, 0, 0, 0.48));
    color: var(--theme-text, #fff);
  }

  .prompt-copy h1 {
    margin: 0;
    font-size: clamp(1.25rem, 2.1cqi, 1.75rem);
    line-height: 1.15;
    letter-spacing: -0.02em;
  }

  .prompt-copy p {
    margin: 0.375rem 0 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.68));
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.45;
  }

  .prompt-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.625rem;
  }

  .unsupported-state {
    align-content: center;
    text-align: center;
  }

  .unsupported-state i {
    color: var(--semantic-warning, #f59e0b);
    font-size: 2.5rem;
  }

  .unsupported-state h1 {
    margin-top: 1rem;
    font-size: clamp(1.5rem, 3cqi, 2.5rem);
  }

  .unsupported-state p {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
  }

  @container (max-width: 36rem) {
    .start-prompt {
      right: 0.75rem;
      left: 0.75rem;
      width: auto;
      padding: 1rem;
    }

    .prompt-actions {
      flex-direction: column;
    }

    .prompt-actions :global(.panel-btn) {
      width: 100%;
    }
  }

  @container (min-width: 120rem) {
    .start-prompt {
      width: 34rem;
      gap: 1.375rem;
      padding: 1.5rem;
    }

    .prompt-copy h1 {
      font-size: 2rem;
    }

    .prompt-copy p,
    .prompt-actions :global(.panel-btn) {
      font-size: 1rem;
    }
  }
</style>
