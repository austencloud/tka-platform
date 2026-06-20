<script lang="ts">
  /**
   * Dodge Lab — step a performer clear of a prop while the hands stay on it.
   *
   * Preset (Letter A variation 3): LH (blue) staff on the WHEEL plane sweeps the
   * sagittal plane the torso occupies (impales); RH (red) staff on the WALL plane.
   * Dodge OFF shows the impale; Dodge ON solves a clearing stance. Manual mode
   * scrubs the stance live (Step-X / Step-Z / Face) over the looping motion, with
   * the body stepping toward the props so the hands stay glued.
   *
   * The clearance readout is authoritative — it runs the StanceSimulator at the
   * avatar's live stance against the prop swept volume.
   *
   * Sibling to Collision Lab; shares StanceSimulator/StanceOptimizer but keeps its
   * own <Canvas> for the live per-frame loop (Collision Lab is static-pose).
   */
  import { Canvas, T } from "@threlte/core";
  import {
    type Object3D,
    Group,
    Mesh,
    PlaneGeometry,
    MeshBasicMaterial,
    CanvasTexture,
    GridHelper,
  } from "three";
  import { Plane } from "@austencloud/scene-3d";
  import {
    MotionType,
    RotationDirection,
    Orientation,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import OrbitControls from "$lib/shared/3d/components/OrbitControls.svelte";
  import CameraControls from "camera-controls";
  import { createSelfLoadedRigBinding } from "$lib/features/stage/locomotion/motion-matching/self-loaded-rig-binding";
  import { MmLocomotionController } from "$lib/features/stage/locomotion/motion-matching/mm-locomotion-controller";
  import type { RigBinding } from "$lib/features/stage/locomotion/motion-matching/rig-binding";
  import type { MotionConfig3D } from "$lib/shared/3d/domain/models/motion-data-3d";
  import type { DodgeSolution } from "$lib/features/stage/locomotion/dodge/dodge-types";
  import DodgeDriver from "./DodgeDriver.svelte";

  // Letter A, variation 3 (alpha1 -> alpha3), from the Flow Arts Knowledge MCP:
  //   Blue: s -> w (pro, cw)   Red: n -> e (pro, cw)
  // One plane moved to WHEEL (blue/LH) so its prop sweeps the sagittal plane the
  // torso occupies (impales); red/RH stays on WALL. (orientation IN / 0 turns are
  // the base-shift defaults.) A letter/variation/plane picker is a later follow-up.
  const blueConfig: MotionConfig3D = {
    plane: Plane.WHEEL,
    startLocation: GridLocation.SOUTH,
    endLocation: GridLocation.WEST,
    motionType: MotionType.PRO,
    rotationDirection: RotationDirection.CLOCKWISE,
    turns: 0,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.IN,
    // Explicit arc path (PRO's canonical shape) so prop interpolation does not
    // reach for the global AnimationVisibilityManager, which this tab does not
    // initialize.
    pathShape: "arc",
  };
  const redConfig: MotionConfig3D = {
    plane: Plane.WALL,
    startLocation: GridLocation.NORTH,
    endLocation: GridLocation.EAST,
    motionType: MotionType.PRO,
    rotationDirection: RotationDirection.CLOCKWISE,
    turns: 0,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.IN,
    pathShape: "arc",
  };

  let rigRoot = $state<Object3D | null>(null);
  let rig = $state<RigBinding | null>(null);
  let controller = $state<MmLocomotionController | null>(null);
  let status = $state("Loading rig + clips…");

  let dodgeOn = $state(false);
  let clearanceM = $state(0);
  let solution = $state<DodgeSolution | null>(null);
  let floorGroup = $state<Group | null>(null);

  // Manual mode: scrub the avatar's stance live while the props keep looping.
  let manualMode = $state(false);
  let manualX = $state(0);
  let manualZ = $state(0);
  let manualYawDeg = $state(0);

  // Puppet mode: freeze the prop on a scrubbable timeline and drag the body with
  // a 3D gizmo (hands auto-lock to the staves) to author a correct-dodge
  // demonstration. Slice 1: drag/turn the whole root; more anchors + keyframes
  // come next.
  let puppetMode = $state(false);
  let puppetProgress = $state(0);
  let gizmoMode = $state<"translate" | "rotate">("translate");
  let puppetPart = $state<"body" | "chest" | "head" | "lfoot" | "rfoot">("body");
  // True while the puppet gizmo is being dragged — pauses the camera orbit so a
  // gizmo drag doesn't also spin the camera.
  let gizmoDragging = $state(false);
  // Live camera-controls instance — in Puppet mode we remap the mouse so LEFT is
  // free for the gizmo (camera-controls otherwise eats left-drag before the gizmo
  // can grab it) and orbit/pan move to right/middle.
  let camRef = $state<CameraControls | null>(null);

  // Place mode: click the floor to step the avatar there, facing grid center,
  // hands glued. The honest "get out of the way" dodge — step OUT into the open
  // quadrant, not into the prop-crossing the auto inside-gamma bias aims for.
  let placeMode = $state(false);

  $effect(() => {
    if (!camRef) return;
    // Free left-drag for the gizmo (puppet) or the floor click (place); orbit on
    // right so a left action doesn't also spin the camera.
    if (puppetMode || placeMode) {
      camRef.mouseButtons.left = CameraControls.ACTION.NONE;
      camRef.mouseButtons.right = CameraControls.ACTION.ROTATE;
      camRef.mouseButtons.middle = CameraControls.ACTION.TRUCK;
    } else {
      camRef.mouseButtons.left = CameraControls.ACTION.ROTATE;
      camRef.mouseButtons.right = CameraControls.ACTION.TRUCK;
      camRef.mouseButtons.middle = CameraControls.ACTION.DOLLY;
    }
  });

  /** Heading (deg) that points the avatar from (x,z) at the grid center (0,0).
   *  Forward at yaw θ is (sinθ, cosθ), so looking at the origin is atan2(-x,-z). */
  function faceCenterDeg(x: number, z: number): number {
    return (Math.atan2(-x, -z) * 180) / Math.PI;
  }

  function togglePlace() {
    placeMode = !placeMode;
    if (placeMode) {
      puppetMode = false;
      dodgeOn = false;
    }
  }

  /** Place a step at floor (x,z): step the avatar there, facing center. Drives
   *  the existing (static) manual path — no per-frame trajectory, so no jitter.
   *  Fine-tune after with the Step / Face sliders. Called by DodgeDriver's
   *  ground raycast on a Place-mode click. */
  function onPlace(x: number, z: number) {
    if (!placeMode) return;
    // Clamp to the visible ±2 grid — a near-horizon click hits the infinite
    // floor plane far out, which would fling the avatar off-grid.
    const cx = Math.max(-2, Math.min(2, x));
    const cz = Math.max(-2, Math.min(2, z));
    manualX = +cx.toFixed(3);
    manualZ = +cz.toFixed(3);
    manualYawDeg = +faceCenterDeg(cx, cz).toFixed(0);
    manualMode = true;
    dodgeOn = false;
    puppetMode = false;
  }

  const PUPPET_PARTS: { id: typeof puppetPart; label: string }[] = [
    { id: "body", label: "Body" },
    { id: "chest", label: "Chest" },
    { id: "head", label: "Head" },
    { id: "lfoot", label: "L Foot" },
    { id: "rfoot", label: "R Foot" },
  ];

  function togglePuppet() {
    puppetMode = !puppetMode;
    if (puppetMode) {
      dodgeOn = false;
      manualMode = false;
    }
  }

  let didSetup = false;

  /** A flat floor label (number / compass letter) readable from a top-down view.
   *  The plane lies face-up (rotation.x = -π/2); seen from above with north away
   *  that maps the glyph's right edge to world +X and its top to world -Z, so the
   *  glyph renders rotated 180°. Pre-rotate the glyph 180° on the canvas (scale
   *  x AND y by -1) so it reads upright from a top-down, north-up view. */
  function makeFloorLabel(text: string, color: string, size: number, x: number, z: number): Mesh {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    const ctx = cv.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.font = "bold 92px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.translate(cv.width, cv.height);
    ctx.scale(-1, -1);
    ctx.fillText(text, cv.width / 2, cv.height / 2);
    const tex = new CanvasTexture(cv);
    const m = new Mesh(
      new PlaneGeometry(size, size),
      new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2; // lie flat on the floor, facing up
    m.position.set(x, 0.02, z);
    return m;
  }

  /** Numbered quadrant reference + N/E/S/W facing marks on the floor. Quadrants:
   *  1 = +X/+Z, 2 = -X/+Z, 3 = -X/-Z, 4 = +X/-Z. Cardinal axes follow the
   *  canonical FLOOR-plane mapping (plane-transforms.ts): N = +Z, S = -Z,
   *  E = -X, W = +X — so the rose reads clockwise N→E→S→W from above. */
  function buildFloorReference(): Group {
    const g = new Group();
    const grid = new GridHelper(4, 8, 0x55556a, 0x2c2c3a);
    grid.position.y = 0.005;
    g.add(grid);
    const quads: { n: string; x: number; z: number }[] = [
      { n: "1", x: 1.2, z: 1.2 },
      { n: "2", x: -1.2, z: 1.2 },
      { n: "3", x: -1.2, z: -1.2 },
      { n: "4", x: 1.2, z: -1.2 },
    ];
    for (const q of quads) g.add(makeFloorLabel(q.n, "#7dd3fc", 0.55, q.x, q.z));
    const comp: { t: string; x: number; z: number }[] = [
      { t: "N", x: 0, z: 2 },
      { t: "S", x: 0, z: -2 },
      { t: "E", x: -2, z: 0 },
      { t: "W", x: 2, z: 0 },
    ];
    for (const c of comp) g.add(makeFloorLabel(c.t, "#fbbf24", 0.4, c.x, c.z));
    return g;
  }

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
      console.error("[dodge] setup failed", err);
    }
  }

  $effect(() => {
    if (didSetup) return;
    didSetup = true;
    floorGroup = buildFloorReference();
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
      console.log("[dodge] diagnostic", payload);
    }
  }

  const clearanceCm = $derived((clearanceM * 100).toFixed(1));
  // Within 1cm of the conservative collision shell counts as clear — a sub-cm
  // graze of the 12cm torso sphere means the prop is ~11cm off the actual spine.
  const cleared = $derived(clearanceM >= -0.01);
</script>

<div class="page">
  <Canvas>
    <T.PerspectiveCamera makeDefault position={[2.4, 1.6, 3.2]} fov={50}>
      <OrbitControls
        bind:ref={camRef}
        enableDamping
        enabled={!gizmoDragging}
        target={[0, 1, 0]}
        maxPolarAngle={Math.PI / 2}
      />
    </T.PerspectiveCamera>

    <T.AmbientLight intensity={0.6} />
    <T.DirectionalLight position={[5, 10, 5]} intensity={1.1} />
    <T.DirectionalLight position={[-5, 5, -5]} intensity={0.3} />

    <T.Mesh rotation.x={-Math.PI / 2} receiveShadow>
      <T.PlaneGeometry args={[20, 20]} />
      <T.MeshStandardMaterial color="#2a2a33" />
    </T.Mesh>

    {#if floorGroup}
      <T is={floorGroup} />
    {/if}

    {#if rigRoot}
      <T is={rigRoot} />
    {/if}

    <DodgeDriver
      {controller}
      {rig}
      {blueConfig}
      {redConfig}
      {dodgeOn}
      {manualMode}
      {manualX}
      {manualZ}
      {manualYawDeg}
      {puppetMode}
      {puppetProgress}
      {puppetPart}
      puppetGizmoMode={gizmoMode}
      onGizmoDrag={(d) => (gizmoDragging = d)}
      {placeMode}
      {onPlace}
      {onClearance}
    />
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
      disabled={!controller || manualMode || puppetMode}
    >
      <span class="dot" class:on={dodgeOn}></span>
      Dodge {dodgeOn ? "ON" : "OFF"}
    </button>

    <button
      type="button"
      class="toggle"
      class:on={manualMode}
      aria-pressed={manualMode}
      onclick={() => (manualMode = !manualMode)}
      disabled={!controller || puppetMode}
    >
      <span class="dot" class:on={manualMode}></span>
      Manual {manualMode ? "ON" : "OFF"}
    </button>

    <button
      type="button"
      class="toggle"
      class:on={puppetMode}
      aria-pressed={puppetMode}
      onclick={togglePuppet}
      disabled={!controller}
    >
      <span class="dot" class:on={puppetMode}></span>
      Puppet {puppetMode ? "ON" : "OFF"}
    </button>

    <button
      type="button"
      class="toggle"
      class:on={placeMode}
      aria-pressed={placeMode}
      onclick={togglePlace}
      disabled={!controller}
    >
      <span class="dot" class:on={placeMode}></span>
      Place {placeMode ? "ON" : "OFF"}
    </button>

    {#if placeMode}
      <p class="hint">
        Click the floor to step the avatar there, facing the grid center. Try a
        spot in <b>quadrant 3</b> (toward the 3, away from the props). Fine-tune
        with the Step / Face sliders below.
        <br /><b>Left-click</b> = place · <b>right-drag</b> = orbit · <b>wheel</b> = zoom.
      </p>
    {/if}

    {#if puppetMode}
      <div class="sliders">
        <label class="slider">
          <span class="slabel">Timeline <b>{(puppetProgress * 100).toFixed(0)}%</b></span>
          <input type="range" min="0" max="1" step="0.01" bind:value={puppetProgress} />
        </label>

        <span class="slabel">Drag part</span>
        <div class="gizmo-modes">
          {#each PUPPET_PARTS as p (p.id)}
            <button
              type="button"
              class="seg"
              class:on={puppetPart === p.id}
              aria-pressed={puppetPart === p.id}
              onclick={() => (puppetPart = p.id)}
            >{p.label}</button>
          {/each}
        </div>

        {#if puppetPart === "body"}
          <div class="gizmo-modes">
            <button
              type="button"
              class="seg"
              class:on={gizmoMode === "translate"}
              aria-pressed={gizmoMode === "translate"}
              onclick={() => (gizmoMode = "translate")}
            >Move</button>
            <button
              type="button"
              class="seg"
              class:on={gizmoMode === "rotate"}
              aria-pressed={gizmoMode === "rotate"}
              onclick={() => (gizmoMode = "rotate")}
            >Turn</button>
          </div>
        {/if}

        <p class="hint">
          {#if puppetPart === "body"}Move/turn the whole body across the floor.
          {:else if puppetPart === "chest"}Rotate the chest — lean + twist into the plane.
          {:else if puppetPart === "head"}Rotate the head.
          {:else}Drag the orange foot target — the leg bends to follow (plant / weight-shift).{/if}
          Hands + feet stay locked. Scrub the timeline to pose other moments.
          <br /><b>Left-drag</b> = gizmo · <b>right-drag</b> = orbit · <b>wheel</b> = zoom.
        </p>
      </div>
    {/if}

    {#if manualMode}
      <div class="sliders">
        <label class="slider">
          <span class="slabel">Step X <b>{manualX.toFixed(2)} m</b></span>
          <input type="range" min="-2" max="2" step="0.01" bind:value={manualX} />
        </label>
        <label class="slider">
          <span class="slabel">Step Z <b>{manualZ.toFixed(2)} m</b></span>
          <input type="range" min="-2" max="2" step="0.01" bind:value={manualZ} />
        </label>
        <label class="slider">
          <span class="slabel">Face <b>{manualYawDeg.toFixed(0)}°</b></span>
          <input type="range" min="-180" max="180" step="1" bind:value={manualYawDeg} />
        </label>
      </div>
    {/if}

    <div class="readout" class:clear={cleared} class:hit={!cleared}>
      <span class="readout-label">Body clearance</span>
      <span class="readout-value">{clearanceM > 0 ? "+" : ""}{clearanceCm} cm</span>
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
    height: 100%;
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

  .sliders {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.2rem 0;
  }

  .slider {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .slabel {
    display: flex;
    justify-content: space-between;
    font-size: 0.72rem;
    opacity: 0.8;
  }

  .slabel b {
    color: #7dd3fc;
    font-variant-numeric: tabular-nums;
  }

  .slider input[type="range"] {
    width: 100%;
    accent-color: #22c55e;
  }

  .gizmo-modes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .seg {
    flex: 1 1 auto;
    min-width: 3.1rem;
    min-height: 36px;
    border-radius: 7px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.06);
    color: #e8e8f0;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
  }

  .seg.on {
    background: rgba(125, 211, 252, 0.18);
    border-color: rgba(125, 211, 252, 0.5);
  }

  .hint {
    margin: 0;
    font-size: 0.7rem;
    line-height: 1.35;
    opacity: 0.6;
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
