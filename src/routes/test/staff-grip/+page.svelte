<script lang="ts">
  import { onMount } from "svelte";
  import { Canvas, T } from "@threlte/core";
  import OrbitControls from "$lib/shared/3d/components/OrbitControls.svelte";
  import { FALG } from "$lib/shared/combination/domain/demo-fixtures";
  import StaffGripStage from "./StaffGripStage.svelte";

  let playing = $state(true);
  let portraitFraming = $state(false);
  const sequence = FALG;

  const cameraPosition = $derived<[number, number, number]>(
    portraitFraming ? [0, 1.98, 4.5] : [0, 1.98, 3.4]
  );
  const cameraFov = $derived(portraitFraming ? 48 : 42);

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
  <meta name="description" content="Test one character holding two staffs." />
</svelte:head>

<main
  class="grip-test"
  data-sequence-source="validated-production-fixture"
  data-sequence-id={sequence.id}
>
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
          rightDragAction="rotate"
          target={[0, 1.92, 0.22]}
          minDistance={0.65}
          maxDistance={7}
          maxPolarAngle={Math.PI / 2}
        />
      </T.PerspectiveCamera>

      <StaffGripStage {playing} {sequence} />
    </Canvas>
  </section>

  <button
    type="button"
    class="transport"
    aria-label={playing ? "Pause" : "Play"}
    aria-pressed={playing}
    onclick={() => (playing = !playing)}
  >
    <span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span>
  </button>
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

  .transport {
    position: absolute;
    z-index: 2;
  }

  .transport {
    bottom: clamp(1.25rem, 3cqi, 2rem);
    left: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    height: 2.75rem;
    padding: 0;
    border: 1px solid rgb(111 231 255 / 48%);
    border-radius: 999px;
    background: rgb(12 28 43 / 88%);
    box-shadow:
      0 14px 36px rgb(0 0 0 / 35%),
      inset 0 0 0 1px rgb(255 255 255 / 6%);
    color: #eafcff;
    font: inherit;
    font-size: 1rem;
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

  @container (max-width: 42rem) {
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
