<!--
  CharacterPreviewStage

  A focused, standalone look at ONE character: the real rigged figure idling on a
  small pedestal, slowly orbiting. Deliberately not Scene3D — no environment,
  no grid, no scene-feature context, no props. Two lights and a camera are
  enough to read a body, and the character-select workspace has to stay cheap enough
  to open on a phone.

  Consumes the inherited `--performer-color` for its backdrop glow, so it must
  be rendered inside a subtree that declares one.

  Vertical framing note: the character model origin sits at shoulder height and it
  drops the figure to `userProportionsState.groundY` on its own. Lifting the
  wrapper group by that same amount (the way PerformerRig does with
  `groundOffset`) puts the feet on y = 0, which is where the pedestal is.
-->
<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { Tween } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { Canvas, T } from "@threlte/core";
  import CameraControls from "camera-controls";
  import { userProportionsState } from "@austencloud/scene-3d";
  import {
    Character3D,
    type CharacterId,
  } from "$lib/shared/3d/domain/character-model";
  import CanvasLifecycle from "$lib/shared/3d/components/CanvasLifecycle.svelte";
  import OrbitControls from "$lib/shared/3d/components/OrbitControls.svelte";
  import { prefersReducedMotion } from "$lib/shared/3d/environments/primitives/motion-preference";

  interface Props {
    characterId: CharacterId;
  }

  let { characterId }: Props = $props();

  const reduceMotion = $derived(prefersReducedMotion());

  const FADE_OUT_MS = 120;
  const FADE_IN_MS = 180;
  /** Never fully empty the pedestal: an uncached model can take seconds, and a
      blank stage reads as broken where a dimmed one reads as loading. */
  const FADE_FLOOR = 0.15;
  /** The renderer's load failure path installs a procedural fallback and never
      fires onModelSwapped, which would otherwise strand the stage dimmed. */
  const SWAP_WATCHDOG_MS = 4000;

  const modelOpacity = new Tween(1, { easing: cubicOut });

  // Character3D applies whatever `opacity` it is handed to every material on the
  // loaded model, and fires `onModelSwapped` once the replacement root is
  // compiled and live. It never animates between the two on its own — that is
  // exactly the seam this stage fills, so browsing the grid dissolves between
  // bodies instead of cutting.
  //
  // `requestedId` is the race token: if focus moved again while a model was
  // loading, the older load's callback names a body we no longer want and must
  // not ramp opacity back up over the newer one still in flight.
  let requestedId: CharacterId | null = null;
  let fadeOut: Promise<void> = Promise.resolve();
  let watchdog: ReturnType<typeof setTimeout> | null = null;

  function clearWatchdog(): void {
    if (watchdog === null) return;
    clearTimeout(watchdog);
    watchdog = null;
  }

  function revealModel(): void {
    clearWatchdog();
    void modelOpacity.set(1, { duration: FADE_IN_MS });
  }

  $effect(() => {
    const nextId = characterId;
    untrack(() => {
      // First run is the initial load, which has nothing on screen to fade out.
      if (requestedId === null || requestedId === nextId) {
        requestedId = nextId;
        return;
      }
      requestedId = nextId;

      // Reduced motion skips the dissolve entirely rather than shortening it:
      // a zero-duration fade means a blank pedestal for the whole load, which
      // is worse than the cut it was meant to soften. Character3D hot-swaps its
      // root without ever flashing empty, so leaving opacity alone is honest.
      if (reduceMotion) return;

      clearWatchdog();
      // One timer, always replaced — repeated focus changes reset the deadline
      // instead of stacking wake-ups that fight each other.
      watchdog = setTimeout(revealModel, SWAP_WATCHDOG_MS);
      fadeOut = modelOpacity.set(FADE_FLOOR, { duration: FADE_OUT_MS });
    });
  });

  function handleModelSwapped(swappedId: string): void {
    if (swappedId !== characterId) return;
    if (reduceMotion) return;
    // A cached model can report back inside the same frame the fade-out
    // started, which would ramp back up from ~0.97 and read as no transition
    // at all. Chaining on the fade-out promise guarantees the full dissolve.
    void fadeOut.then(() => {
      if (swappedId !== characterId) return;
      revealModel();
    });
  }

  onDestroy(clearWatchdog);

  const CAMERA_POSITION: [number, number, number] = [0, 1.35, 3.1];
  const ORBIT_TARGET: [number, number, number] = [0, 0.95, 0];
  const ORBIT_RADIUS = Math.hypot(
    CAMERA_POSITION[0] - ORBIT_TARGET[0],
    CAMERA_POSITION[1] - ORBIT_TARGET[1],
    CAMERA_POSITION[2] - ORBIT_TARGET[2]
  );

  // A preview does not own the wheel, and on a phone it does not own the
  // drag either: the stacked modal layout scrolls vertically straight through
  // the stage. Unbinding dolly and every touch gesture leaves the auto-orbit
  // and desktop mouse-drag orbit as the only camera motion.
  function restrictGestures(controls: CameraControls): void {
    const { NONE } = CameraControls.ACTION;
    controls.mouseButtons.wheel = NONE;
    controls.mouseButtons.middle = NONE;
    controls.touches.one = NONE;
    controls.touches.two = NONE;
    controls.touches.three = NONE;
  }

  // Retina detail on a small stage is invisible and quadruples the fill cost.
  const canvasDpr =
    typeof window === "undefined"
      ? 1
      : Math.min(window.devicePixelRatio || 1, 1.5);

  const groundOffset = $derived(-userProportionsState.groundY);
  const autoRotate = $derived(!reduceMotion);
</script>

<div class="stage" aria-hidden="true">
  <Canvas dpr={canvasDpr}>
    <CanvasLifecycle />

    <T.PerspectiveCamera makeDefault position={CAMERA_POSITION} fov={32} />
    <OrbitControls
      {autoRotate}
      autoRotateSpeed={0.9}
      enablePan={false}
      minDistance={ORBIT_RADIUS}
      maxDistance={ORBIT_RADIUS}
      target={ORBIT_TARGET}
      oncreate={restrictGestures}
    />

    <T.AmbientLight intensity={0.85} />
    <T.DirectionalLight position={[2.4, 4, 3]} intensity={1.6} />
    <T.DirectionalLight position={[-3, 2.2, -2]} intensity={0.5} />

    <T.Group position.y={groundOffset}>
      <!-- `characterId` is a live prop rather than a keyed remount: Character3D
           hot-swaps its model root without ever flashing empty, and keying
           would tear down its services and this stage's camera on every
           hover. The dissolve across that swap is owned here — opacity down,
           then back up when onModelSwapped reports the new body is live. -->
      <Character3D
        id="character-select-preview"
        avatarId={characterId}
        bluePropState={null}
        redPropState={null}
        isActive={false}
        enableLocomotion
        enableFootPlanting
        opacity={modelOpacity.current}
        onModelSwapped={handleModelSwapped}
      />
    </T.Group>

    <T.Mesh rotation.x={-Math.PI / 2} position.y={-0.02}>
      <T.CircleGeometry args={[0.9, 64]} />
      <T.MeshStandardMaterial color="#1c2333" roughness={0.85} />
    </T.Mesh>
  </Canvas>
</div>

<style>
  .stage {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 18rem;
    overflow: hidden;
    border-radius: 12px;
    border: 1px solid var(--theme-stroke);
    background:
      radial-gradient(
        circle at 50% 62%,
        color-mix(in srgb, var(--performer-color) 26%, transparent),
        transparent 62%
      ),
      var(--surface-inset-deep);
  }

  .stage :global(canvas) {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }
</style>
