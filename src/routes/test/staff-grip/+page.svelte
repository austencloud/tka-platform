<script lang="ts">
  import { onMount } from "svelte";
  import { Canvas, T } from "@threlte/core";
  import OrbitControls from "$lib/shared/3d/components/OrbitControls.svelte";
  import StaffGripStage from "./StaffGripStage.svelte";

  let playing = $state(true);
  let ready = $state(false);
  let portraitFraming = $state(false);

  const cameraPosition = $derived<[number, number, number]>(
    portraitFraming ? [0, 1.02, 5.15] : [0, 1.08, 3.15]
  );
  const cameraFov = $derived(portraitFraming ? 48 : 40);

  onMount(() => {
    const syncCameraFraming = () => {
      portraitFraming = window.innerWidth / window.innerHeight < 0.75;
    };

    syncCameraFraming();
    window.addEventListener("resize", syncCameraFraming);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      playing = false;
    }

    return () => window.removeEventListener("resize", syncCameraFraming);
  });
</script>

<svelte:head>
  <title>Staff Grip Test</title>
  <meta
    name="description"
    content="Focused production-rig test with one character, two staffs, and the canonical wall grid."
  />
</svelte:head>

<main class="grip-test">
  <section class="stage" aria-label="Animated two-staff grip test">
    <Canvas shadows>
      <T.Color attach="background" args={["#0a101a"]} />
      <T.PerspectiveCamera
        makeDefault
        position={cameraPosition}
        fov={cameraFov}
      >
        <OrbitControls
          enableDamping
          enablePan={false}
          target={[0, 0.82, 0.22]}
          minDistance={portraitFraming ? 3.5 : 2.1}
          maxDistance={7}
          maxPolarAngle={Math.PI / 2}
        />
      </T.PerspectiveCamera>

      <StaffGripStage {playing} onready={() => (ready = true)} />
    </Canvas>
  </section>

  <header class="scene-label">
    <p class="eyebrow">Production grip test</p>
    <h1>Two staffs. One real rig.</h1>
    <p class="description">
      Current intake character, production staffs, and the canonical wall grid.
    </p>
  </header>

  <div class="status" class:ready role="status" aria-live="polite">
    <span class="status-dot" aria-hidden="true"></span>
    {ready ? "Character ready" : "Loading character"}
  </div>

  <button
    type="button"
    class="transport"
    aria-label={playing ? "Pause grip motion" : "Play grip motion"}
    aria-pressed={playing}
    onclick={() => (playing = !playing)}
  >
    <span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span>
    {playing ? "Pause" : "Play"}
  </button>

  <p class="orbit-hint">Drag to orbit · wheel or pinch to zoom</p>
</main>

<style>
  .grip-test {
    position: relative;
    min-height: 100dvh;
    overflow: hidden;
    background: #0a101a;
    color: var(--color-text-primary, #f4f7fb);
    container-type: inline-size;
  }

  .stage {
    position: absolute;
    inset: 0;
  }

  .stage :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
  }

  .scene-label,
  .status,
  .transport,
  .orbit-hint {
    position: absolute;
    z-index: 2;
  }

  .scene-label {
    top: clamp(1rem, 3cqi, 2rem);
    left: clamp(1rem, 3cqi, 2rem);
    max-width: min(26rem, calc(100% - 2rem));
    pointer-events: none;
    text-shadow: 0 2px 16px rgb(0 0 0 / 70%);
  }

  .eyebrow {
    margin: 0 0 0.35rem;
    color: #6fe7ff;
    font-size: 0.75rem;
    font-weight: 750;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    font-size: clamp(1.5rem, 3.2cqi, 2.65rem);
    line-height: 1.05;
    letter-spacing: -0.035em;
  }

  .description {
    margin: 0.55rem 0 0;
    color: rgb(230 239 250 / 78%);
    font-size: clamp(0.875rem, 1.25cqi, 1rem);
    line-height: 1.45;
  }

  .status {
    top: clamp(1rem, 3cqi, 2rem);
    right: clamp(1rem, 3cqi, 2rem);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.25rem;
    padding: 0.45rem 0.75rem;
    border: 1px solid rgb(255 255 255 / 13%);
    border-radius: 999px;
    background: rgb(8 14 24 / 76%);
    box-shadow: 0 12px 32px rgb(0 0 0 / 28%);
    backdrop-filter: blur(12px);
    color: rgb(230 239 250 / 82%);
    font-size: 0.8125rem;
    font-weight: 650;
  }

  .status-dot {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    background: #fbbf24;
    box-shadow: 0 0 0 0.2rem rgb(251 191 36 / 15%);
  }

  .status.ready .status-dot {
    background: #4ade80;
    box-shadow: 0 0 0 0.2rem rgb(74 222 128 / 15%);
  }

  .transport {
    bottom: clamp(1.25rem, 3cqi, 2rem);
    left: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.55rem;
    min-width: 7.5rem;
    min-height: 2.75rem;
    padding: 0.7rem 1rem;
    border: 1px solid rgb(111 231 255 / 48%);
    border-radius: 999px;
    background: rgb(12 28 43 / 88%);
    box-shadow:
      0 14px 36px rgb(0 0 0 / 35%),
      inset 0 0 0 1px rgb(255 255 255 / 6%);
    color: #eafcff;
    font: inherit;
    font-size: 0.875rem;
    font-weight: 720;
    cursor: pointer;
    transform: translateX(-50%);
    backdrop-filter: blur(12px);
    transition:
      background-color var(--transition-fast, 160ms) ease,
      border-color var(--transition-fast, 160ms) ease;
  }

  .transport:hover {
    border-color: #6fe7ff;
    background: rgb(18 48 69 / 94%);
  }

  .transport:focus-visible {
    outline: 2px solid #6fe7ff;
    outline-offset: 3px;
  }

  .orbit-hint {
    right: clamp(1rem, 3cqi, 2rem);
    bottom: clamp(1.25rem, 3cqi, 2rem);
    margin: 0;
    color: rgb(230 239 250 / 56%);
    font-size: 0.75rem;
    pointer-events: none;
  }

  @container (max-width: 42rem) {
    .scene-label {
      max-width: calc(100% - 8rem);
    }

    .description,
    .orbit-hint {
      display: none;
    }

    .transport {
      bottom: 1rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .transport {
      transition-duration: 0ms;
    }
  }
</style>
