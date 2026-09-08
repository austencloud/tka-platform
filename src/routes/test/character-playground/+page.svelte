<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import {
    AVATAR_DEFINITIONS,
    Plane,
    type AvatarId,
  } from "@austencloud/scene-3d";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import Viewer3DCanvas from "$lib/shared/3d/components/Viewer3DCanvas.svelte";
  import { createViewer3DState } from "$lib/shared/3d/state/viewer-3d-state.svelte";
  import { setViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
  import { SceneEnvironmentId } from "$lib/shared/3d/environments/domain/scene-environment";
  import { ALL_FIXTURE_LOOPS } from "$lib/shared/combination/domain/demo-fixtures";
  import { createAnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
  import { createPlaybackControllerFactory } from "$lib/shared/animation-engine/create-playback-controller-factory";
  import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";
  import { AnimationVisibilityStateManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { setAnimationVisibilityContext } from "$lib/shared/animation-engine/state/animation-visibility-context";
  import {
    loadAvailableCandidates,
    resolveCandidate,
    type LocalCharacterCandidate,
  } from "../_lab-kit/local-character-candidates";

  const viewer = createViewer3DState({
    renderMode: "3d",
    environmentId: SceneEnvironmentId.FOREST,
    performers: [],
    selectedPerformerIndex: 0,
    selectedPerformerIndices: [0],
    camera: null,
    navMode: "orbit",
    activeCameraPreset: "manual",
    defaultProp: "staff",
    visiblePlanes: [Plane.WALL],
    showGridLabels: true,
    effectToggles: { fire: false, led: false, trails: false },
    sceneFeatures: { environment: true, stage: true, audience: false },
  });
  setViewer3DContext(viewer);
  const animation = createAnimationPanelState({ ephemeral: true });
  const visibility = new AnimationVisibilityStateManager({ ephemeral: true });
  setAnimationVisibilityContext(visibility);
  let playback: AnimationPlaybackController | null = null;
  let candidates = $state<LocalCharacterCandidate[]>([]);
  let selected = $state("");
  let example = $state("AAAA_CCW");
  let mounted = $state(false);
  let ready = $state(false);
  let generating = $state(false);
  let generatorAvailable = $state(false);
  let message = $state("Loading local characters…");
  let failure = $state("");
  let width = $state(1000);
  let height = $state(700);
  let speed = $state(1);
  let focus = $state<"body" | "hands">("body");
  const sequence = $derived(
    ALL_FIXTURE_LOOPS.find(([id]) => id === example)![1]
  );
  const performer = $derived(viewer.performerManager.performers[0]);
  const character = $derived(candidates.find(({ id }) => id === selected));

  async function refreshCharacters(preferred: string | null) {
    candidates = await loadAvailableCandidates();
    for (const candidate of candidates) {
      if (AVATAR_DEFINITIONS.some(({ id }) => id === candidate.id)) continue;
      AVATAR_DEFINITIONS.push({
        id: candidate.id as AvatarId,
        name: candidate.label,
        modelPath: candidate.modelUrl,
        description: candidate.note,
        icon: "fa-person",
        availability: "local-evaluation",
      });
    }
    selected = resolveCandidate(preferred, candidates)?.id ?? "";
  }

  function selectCharacter(id: string) {
    selected = id;
    performer?.setCharacter(id as AvatarId);
    const url = new URL(window.location.href);
    url.searchParams.set("character", id);
    window.history.replaceState(null, "", url);
  }

  function frame(nextFocus = focus) {
    focus = nextFocus;
    const portrait = width / height < 0.85;
    const distance = nextFocus === "hands" ? 2.7 : portrait ? 8 : 5.8;
    viewer.snapCameraTo(
      {
        x: nextFocus === "hands" ? 0.45 : 0,
        y: nextFocus === "hands" ? 1.5 : 2,
        z: distance,
      },
      { x: 0, y: nextFocus === "hands" ? 1.35 : 1.05, z: 0 },
      undefined,
      false
    );
  }

  function chooseExample(value: string) {
    const playing = animation.isPlaying;
    example = value;
    const next = ALL_FIXTURE_LOOPS.find(([id]) => id === value)![1];
    performer?.loadSequence(next);
    playback?.initialize(next, animation);
    animation.setShouldLoop(true);
    playback?.setSpeed(speed);
    if (playing) playback?.togglePlayback();
  }

  function startScene() {
    viewer.enter3D(sequence);
    selectCharacter(selected);
    playback?.initialize(sequence, animation);
    animation.setShouldLoop(true);
    playback?.setSpeed(speed);
    playback?.togglePlayback();
    mounted = true;
  }

  async function randomize() {
    const previousSelection = selected;
    generating = true;
    failure = "";
    message =
      "Generating a new body, face, hair and outfit… Your current character stays here while it loads.";
    try {
      const response = await fetch("/test/character-playground/generate", {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message ?? "Character generation failed.");
      await refreshCharacters(result.id);
      if (selected !== result.id)
        throw new Error(
          "The character was generated, but its model is not available yet. Reload to try loading it again."
        );
      if (mounted) selectCharacter(selected);
      else startScene();
      message = `Created seed ${result.seed}. Saved locally and added to your characters.`;
    } catch (cause) {
      selected = previousSelection;
      failure =
        cause instanceof Error
          ? cause.message
          : "Character generation failed. Please try again.";
      message = "";
    } finally {
      generating = false;
    }
  }

  onMount(() => {
    playback = createPlaybackControllerFactory(visibility);
    let active = true;
    void (async () => {
      const requested =
        new URL(window.location.href).searchParams.get("character") ??
        "intake-mpfb-proof";
      await refreshCharacters(requested);
      if (!active) return;
      if (selected) {
        startScene();
      }
      message = selected
        ? "Randomize makes a new MPFB character and saves it here."
        : "No local character files are available.";
      try {
        const response = await fetch("/test/character-playground/generate");
        const status = response.ok ? await response.json() : null;
        generatorAvailable = status?.available === true;
        if (!generatorAvailable)
          message =
            "Character viewing is available. Randomize needs the local Blender and MPFB installation.";
        else if (status.busy)
          message =
            "A character is being generated in another tab. You can keep exploring here.";
      } catch {
        message =
          "The local generator could not be reached. Reload to reconnect.";
      }
    })();
    return () => {
      active = false;
    };
  });
  onDestroy(() => {
    playback?.dispose(animation);
    animation.dispose();
    viewer.dispose();
  });
  $effect(() => {
    void width;
    void height;
    if (ready) frame();
  });
</script>

<svelte:head
  ><title>Character playground · Flow Arts Composer</title></svelte:head
>

<main>
  <header>
    <div>
      <p class="eyebrow">MAKEHUMAN / MPFB</p>
      <h1>Character playground</h1>
    </div>
    <p class="intro">New humans. Real choreography.</p>
  </header>
  <section class="workspace">
    <div
      class="stage"
      bind:clientWidth={width}
      bind:clientHeight={height}
      data-ready={ready}
      data-character={selected}
      data-playing={animation.isPlaying}
      data-step={animation.currentStep}
    >
      {#if mounted}
        <Viewer3DCanvas
          sequenceData={sequence}
          currentStep={animation.currentStep}
          isPlaying={animation.isPlaying}
          leftPropType="staff"
          rightPropType="staff"
          rendererHandleRequired
          hideOverlays
          hidePerformerBadges
          hideOrientationHelpers
          enablePerformerLocomotion={false}
          onSceneReadyChange={(value) => {
            ready = value;
            if (value) frame();
          }}
          onSystemPlaybackChange={(playing) => {
            if (playing !== animation.isPlaying) playback?.togglePlayback();
          }}
        />
      {:else}<p class="stage-message">{message}</p>{/if}
      <div class="camera-controls" aria-label="Camera framing">
        <PanelButton
          onclick={() => frame("body")}
          ariaPressed={focus === "body"}>Full body</PanelButton
        >
        <PanelButton
          onclick={() => frame("hands")}
          ariaPressed={focus === "hands"}>Hands</PanelButton
        >
      </div>
    </div>
    <aside aria-label="Character and scene controls">
      <div class="character-controls">
        <label for="character">Character</label>
        <select
          id="character"
          value={selected}
          onchange={(e) => selectCharacter(e.currentTarget.value)}
          disabled={!candidates.length}
        >
          {#each candidates as candidate}<option value={candidate.id}
              >{candidate.label}</option
            >{/each}
        </select>
        <PanelButton
          variant="primary"
          fullWidth
          onclick={randomize}
          disabled={generating || !generatorAvailable}
          ariaBusy={generating}
        >
          {generating ? "Generating character…" : "Randomize character"}
        </PanelButton>
        <div class="status" aria-live="polite" aria-atomic="true">
          {#if failure}<p role="alert" class="failure">{failure}</p>{:else}<p>
              {message}
            </p>{/if}
        </div>
      </div>
      <div class="scene-controls">
        <label for="example">Spinning example</label>
        <select
          id="example"
          value={example}
          onchange={(e) => chooseExample(e.currentTarget.value)}
        >
          {#each ALL_FIXTURE_LOOPS as [id, item]}<option value={id}
              >{item.name} · {id.includes("CCW")
                ? "counterclockwise"
                : id.includes("CW")
                  ? "clockwise"
                  : "mixed loop"}</option
            >{/each}
        </select>
        <div class="playback">
          <PanelButton
            fullWidth
            disabled={!ready}
            onclick={() => playback?.togglePlayback()}
            >{animation.isPlaying ? "Pause" : "Play"}</PanelButton
          >
          <label class="speed"
            >Speed<select
              aria-label="Playback speed"
              bind:value={speed}
              onchange={() => {
                playback?.setSpeed(speed);
              }}
              ><option value={0.25}>¼×</option><option value={0.5}>½×</option
              ><option value={1}>1×</option></select
            ></label
          >
        </div>
        <label for="scene">Environment</label>
        <select
          id="scene"
          value={viewer.environmentId}
          onchange={(e) =>
            viewer.setEnvironmentId(
              e.currentTarget.value as SceneEnvironmentId
            )}
        >
          <option value="forest">Forest</option><option value="cosmic"
            >Cosmic</option
          ><option value="winter">Winter</option><option value="void"
            >Void</option
          >
        </select>
        <PanelButton
          fullWidth
          ariaPressed={viewer.showGrid}
          onclick={() => viewer.toggleGrid()}
          >Grid {viewer.showGrid ? "on" : "off"}</PanelButton
        >
      </div>
      <footer>
        <strong>{character?.label ?? "Local characters"}</strong>
        <p>
          Drag to orbit. Scroll or pinch to zoom. Pause and choose Hands to
          inspect the grip.
        </p>
        <p>
          Generated characters stay on this computer. Finger contact is still
          being refined.
        </p>
      </footer>
    </aside>
  </section>
</main>

<style>
  :global(body) {
    margin: 0;
  }
  main {
    min-height: 100dvh;
    background: var(--bg-base, #101318);
    color: var(--text-primary, #f3f5f8);
    font-family: var(--font-family, sans-serif);
  }
  header {
    padding: 20px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  h1 {
    font-size: clamp(22px, 2vw, 30px);
    line-height: 1.2;
    margin: 4px 0 0;
  }
  .eyebrow {
    font-size: 12px;
    letter-spacing: 0.12em;
    margin: 0;
    color: var(--text-secondary, #b5bfcc);
  }
  .intro {
    font-size: 14px;
    color: var(--text-secondary, #b5bfcc);
  }
  .workspace {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    min-height: calc(100dvh - 98px);
  }
  .stage {
    position: relative;
    min-width: 0;
    min-height: 440px;
    height: calc(100dvh - 98px);
    overflow: hidden;
    background: #13191e;
  }
  .stage-message {
    padding: 24px;
  }
  .camera-controls {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
    white-space: nowrap;
  }
  aside {
    padding: 24px 20px;
    background: var(--bg-panel, #1b2028);
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-width: 0;
  }
  label {
    display: block;
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  select {
    display: block;
    width: 100%;
    min-height: 44px;
    padding: 10px 12px;
    color: var(--text-primary, #f3f5f8);
    background: var(--bg-input, #252e3a);
    border: 1px solid var(--border-default, #596474);
    border-radius: 8px;
    font: inherit;
    font-size: 14px;
    margin-bottom: 12px;
  }
  select:focus-visible {
    outline: 3px solid var(--theme-accent, #8cc4ff);
    outline-offset: 3px;
  }
  .status {
    min-height: 72px;
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-secondary, #b5bfcc);
  }
  .status p {
    margin: 12px 0 0;
  }
  .failure {
    color: var(--semantic-error, #ffadad);
  }
  .playback {
    display: flex;
    align-items: end;
    gap: 12px;
    margin-bottom: 18px;
  }
  .speed {
    margin: 0;
    min-width: 84px;
  }
  .speed select {
    margin: 4px 0 0;
  }
  footer {
    margin-top: auto;
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-secondary, #b5bfcc);
  }
  footer strong {
    color: var(--text-primary, #f3f5f8);
  }
  footer p {
    margin: 8px 0 0;
  }
  @media (max-width: 760px) {
    header {
      padding: 16px;
    }
    .intro {
      display: none;
    }
    .workspace {
      grid-template-columns: 1fr;
    }
    .stage {
      height: 62dvh;
      min-height: 360px;
    }
    aside {
      padding: 20px 16px;
    }
    .status {
      min-height: 48px;
    }
  }
  @media (min-width: 761px) and (max-height: 600px) {
    .stage {
      height: 100dvh;
    }
  }
</style>
