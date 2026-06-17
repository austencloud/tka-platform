<script lang="ts">
  /**
   * Prop-Dodge Harness — anticipatory wheel-plane dodge slice.
   *
   * alpha1 start: LH (blue) staff spins on the WHEEL plane through the sagittal
   * plane the torso sits in; RH (red) staff is on the WALL plane. With the dodge
   * OFF the blue staff impales the torso; with it ON the avatar pre-steps and
   * reorients to the solved collision-free stance so the staff clears the body.
   *
   * The clearance readout is authoritative — it runs the StanceSimulator at the
   * avatar's live stance against the prop swept volume, so it reports exactly
   * what is on screen (negative = impaling, >= 0 = cleared).
   */
  import { Canvas, T } from "@threlte/core";
  import type { Object3D } from "three";
  import { Plane } from "@austencloud/scene-3d";
  import {
    MotionType,
    RotationDirection,
    Orientation,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import OrbitControls from "$lib/shared/3d/components/OrbitControls.svelte";
  import { createSelfLoadedRigBinding } from "$lib/features/stage/locomotion/motion-matching/self-loaded-rig-binding";
  import { MmLocomotionController } from "$lib/features/stage/locomotion/motion-matching/mm-locomotion-controller";
  import type { RigBinding } from "$lib/features/stage/locomotion/motion-matching/rig-binding";
  import type { MotionConfig3D } from "$lib/shared/3d/domain/models/motion-data-3d";
  import type { DodgeSolution } from "$lib/features/stage/locomotion/dodge/dodge-types";
  import DodgeDriver from "./DodgeDriver.svelte";

  // alpha1: LH (blue) wheel-plane spin at SOUTH; RH (red) wall-plane spin at NORTH.
  const blueConfig: MotionConfig3D = {
    plane: Plane.WHEEL,
    startLocation: GridLocation.SOUTH,
    endLocation: GridLocation.SOUTH,
    motionType: MotionType.STATIC,
    rotationDirection: RotationDirection.CLOCKWISE,
    turns: 2,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.IN,
  };
  const redConfig: MotionConfig3D = {
    plane: Plane.WALL,
    startLocation: GridLocation.NORTH,
    endLocation: GridLocation.NORTH,
    motionType: MotionType.STATIC,
    rotationDirection: RotationDirection.CLOCKWISE,
    turns: 2,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.IN,
  };

  let rigRoot = $state<Object3D | null>(null);
  let rig = $state<RigBinding | null>(null);
  let controller = $state<MmLocomotionController | null>(null);
  let status = $state("Loading rig + clips…");

  let dodgeOn = $state(false);
  let clearanceM = $state(0);
  let solution = $state<DodgeSolution | null>(null);

  let didSetup = false;

  async function setup() {
    try {
      const loaded = await createSelfLoadedRigBinding(
        "/animations/locomotion-pack/X%20Bot.glb",
        [
          { clipId: "idle", url: "/animations/locomotion-pack/idle.glb" },
          { clipId: "walk-forward", url: "/animations/locomotion-pack/walk-forward.glb" },
          { clipId: "turn-left", url: "/animations/locomotion-pack/turn-left.glb" },
          { clipId: "turn-right", url: "/animations/locomotion-pack/turn-right.glb" },
        ],
      );
      const ctrl = new MmLocomotionController(loaded);
      await ctrl.initialize();

      rigRoot = loaded.root;
      rig = loaded;
      controller = ctrl;
      status = "Ready";

      if (typeof window !== "undefined") {
        (window as unknown as { __dodgeController?: MmLocomotionController }).__dodgeController = ctrl;
        (window as unknown as { __dodgeRig?: RigBinding }).__dodgeRig = loaded;
      }
    } catch (err) {
      status = `Setup failed: ${err instanceof Error ? err.message : String(err)}`;
      console.error("[mm-dodge] setup failed", err);
    }
  }

  $effect(() => {
    if (didSetup) return;
    didSetup = true;
    void setup();
  });

  function onClearance(c: number, sol: DodgeSolution | null) {
    clearanceM = c;
    solution = sol;
  }

  function toggleDodge() {
    dodgeOn = !dodgeOn;
  }

  async function copyDiagnostic() {
    const payload = {
      blueConfig,
      redConfig,
      solution,
      liveClearanceM: clearanceM,
      dodgeOn,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      status = "Diagnostic copied";
    } catch {
      status = "Clipboard blocked — see console";
      console.log("[mm-dodge] diagnostic", payload);
    }
  }

  const clearanceCm = $derived((clearanceM * 100).toFixed(1));
  const cleared = $derived(clearanceM >= 0);
</script>

<svelte:head>
  <title>Prop-Dodge Harness</title>
</svelte:head>

<div class="page">
  <Canvas>
    <T.PerspectiveCamera makeDefault position={[2.4, 1.6, 3.2]} fov={50}>
      <OrbitControls enableDamping target={[0, 1, 0]} maxPolarAngle={Math.PI / 2} />
    </T.PerspectiveCamera>

    <T.AmbientLight intensity={0.6} />
    <T.DirectionalLight position={[5, 10, 5]} intensity={1.1} />
    <T.DirectionalLight position={[-5, 5, -5]} intensity={0.3} />

    <T.Mesh rotation.x={-Math.PI / 2} receiveShadow>
      <T.PlaneGeometry args={[20, 20]} />
      <T.MeshStandardMaterial color="#2a2a33" />
    </T.Mesh>

    {#if rigRoot}
      <T is={rigRoot} />
    {/if}

    <DodgeDriver {controller} {rig} {blueConfig} {redConfig} {dodgeOn} {onClearance} />
  </Canvas>

  <div class="panel">
    <h1>Prop Dodge</h1>
    <p class="status">{status}</p>

    <button
      type="button"
      class="toggle"
      class:on={dodgeOn}
      aria-pressed={dodgeOn}
      onclick={toggleDodge}
      disabled={!controller}
    >
      <span class="dot" class:on={dodgeOn}></span>
      Dodge {dodgeOn ? "ON" : "OFF"}
    </button>

    <div class="readout" class:clear={cleared} class:hit={!cleared}>
      <span class="readout-label">Body clearance</span>
      <span class="readout-value">{cleared ? "+" : ""}{clearanceCm} cm</span>
      <span class="readout-state">{cleared ? "clear" : "IMPALED"}</span>
    </div>

    {#if solution}
      <p class="solved">
        step ({solution.stance.footOffsetX.toFixed(2)}, {solution.stance.footOffsetZ.toFixed(2)})
        · yaw {((solution.stance.rootYawRad * 180) / Math.PI).toFixed(0)}°
        · {solution.feasible ? "feasible" : "best-effort"}
      </p>
    {/if}

    <button type="button" class="action" onclick={copyDiagnostic} disabled={!solution}>
      Copy Diagnostic
    </button>
  </div>
</div>

<style>
  .page {
    position: relative;
    width: 100%;
    height: 100vh;
    overflow: hidden;
    background: #14141c;
  }

  .panel {
    position: absolute;
    top: 1rem;
    left: 1rem;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    width: 19rem;
    max-width: calc(100vw - 2rem);
    padding: 1rem 1.1rem;
    border-radius: 12px;
    background: rgba(18, 18, 26, 0.78);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #e8e8f0;
  }

  .panel h1 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 600;
  }

  .status {
    margin: 0;
    font-size: 0.8rem;
    opacity: 0.7;
    font-variant-numeric: tabular-nums;
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-height: 44px;
    padding: 0.55rem 0.9rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.06);
    color: #e8e8f0;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 120ms ease;
  }

  .toggle.on {
    background: rgba(34, 197, 94, 0.18);
    border-color: rgba(34, 197, 94, 0.5);
  }

  .toggle:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #555;
    transition: background 120ms ease;
  }

  .dot.on {
    background: #22c55e;
  }

  .readout {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas: "label state" "value value";
    gap: 0.15rem 0.5rem;
    padding: 0.6rem 0.75rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .readout.clear {
    background: rgba(34, 197, 94, 0.1);
  }

  .readout.hit {
    background: rgba(239, 68, 68, 0.12);
  }

  .readout-label {
    grid-area: label;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    opacity: 0.6;
  }

  .readout-state {
    grid-area: state;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .readout.clear .readout-state {
    color: #22c55e;
  }

  .readout.hit .readout-state {
    color: #ef4444;
  }

  .readout-value {
    grid-area: value;
    font-size: 1.3rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    /* Reserve width for the widest value (-99.9 cm) so the sign flip does not
       shift the row — see no-layout-shift rule. */
    min-width: 6ch;
  }

  .solved {
    margin: 0;
    font-size: 0.72rem;
    opacity: 0.7;
    font-variant-numeric: tabular-nums;
  }

  .action {
    min-height: 44px;
    padding: 0.55rem 0.9rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.06);
    color: #e8e8f0;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 120ms ease;
  }

  .action:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
  }

  .action:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
