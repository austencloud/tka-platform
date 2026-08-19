<!--
  AvatarPreviewStage

  A focused, standalone look at ONE avatar: the real rigged figure idling on a
  small pedestal, slowly orbiting. Deliberately not Scene3D — no environment,
  no grid, no scene-feature context, no props. Two lights and a camera are
  enough to read a body, and the avatar-select modal has to stay cheap enough
  to open on a phone.

  Vertical framing note: Avatar3D's model origin sits at shoulder height and it
  drops the figure to `userProportionsState.groundY` on its own. Lifting the
  wrapper group by that same amount (the way PerformerRig does with
  `groundOffset`) puts the feet on y = 0, which is where the pedestal is.
-->
<script lang="ts">
  import { untrack } from "svelte";
  import { Tween } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { Canvas, T } from "@threlte/core";
  import {
    Avatar3D,
    userProportionsState,
    type AvatarId,
  } from "@austencloud/scene-3d";
  import OrbitControls from "$lib/shared/3d/components/OrbitControls.svelte";
  import { prefersReducedMotion } from "$lib/shared/3d/environments/primitives/motion-preference";

  interface Props {
    avatarId: AvatarId;
  }

  let { avatarId }: Props = $props();

  const reduceMotion = $derived(prefersReducedMotion());
  const fadeOutMs = $derived(reduceMotion ? 0 : 120);
  const fadeInMs = $derived(reduceMotion ? 0 : 180);

  // Avatar3D applies whatever `opacity` it is handed to every material on the
  // loaded model, and fires `onModelSwapped` once the replacement root is
  // compiled and live. It never animates between the two on its own — that is
  // exactly the seam this stage fills, so browsing the grid dissolves between
  // bodies instead of cutting.
  const modelOpacity = new Tween(1, { duration: 180, easing: cubicOut });

  // The avatar currently being faded toward. Comparing against the live prop
  // in the callback is the race guard: if focus moved again while a model was
  // loading, the older load's `onModelSwapped` names a body we no longer want
  // and must not ramp opacity back up over the newer one still in flight.
  let requestedId: AvatarId | null = null;

  $effect(() => {
    const nextId = avatarId;
    untrack(() => {
      // First run is the initial load, which has nothing on screen to fade out.
      if (requestedId === null || requestedId === nextId) {
        requestedId = nextId;
        return;
      }
      requestedId = nextId;
      void modelOpacity.set(0, { duration: fadeOutMs });
    });
  });

  function handleModelSwapped(swappedId: string): void {
    if (swappedId !== avatarId) return;
    void modelOpacity.set(1, { duration: fadeInMs });
  }

  const CAMERA_POSITION: [number, number, number] = [0, 1.35, 3.1];
  const ORBIT_TARGET: [number, number, number] = [0, 0.95, 0];
  // camera-controls derives its orbit radius from the camera's distance to the
  // target. Pinning min === max to that radius is how this stage refuses zoom
  // without reaching past the shared OrbitControls prop surface.
  const ORBIT_RADIUS = Math.hypot(
    CAMERA_POSITION[1] - ORBIT_TARGET[1],
    CAMERA_POSITION[2] - ORBIT_TARGET[2]
  );

  const groundOffset = $derived(-userProportionsState.groundY);
  const autoRotate = $derived(!prefersReducedMotion());
</script>

<div class="stage">
  <Canvas>
    <T.PerspectiveCamera makeDefault position={CAMERA_POSITION} fov={32} />
    <OrbitControls
      {autoRotate}
      autoRotateSpeed={0.9}
      enablePan={false}
      minDistance={ORBIT_RADIUS}
      maxDistance={ORBIT_RADIUS}
      target={ORBIT_TARGET}
    />

    <T.AmbientLight intensity={0.85} />
    <T.DirectionalLight position={[2.4, 4, 3]} intensity={1.6} />
    <T.DirectionalLight position={[-3, 2.2, -2]} intensity={0.5} />

    <T.Group position.y={groundOffset}>
      <!-- `avatarId` is a live prop rather than a keyed remount: Avatar3D
           hot-swaps its model root without ever flashing empty, and keying
           would tear down its services and this stage's camera on every
           hover. The dissolve across that swap is owned here — opacity down,
           then back up when onModelSwapped reports the new body is live. -->
      <Avatar3D
        id="avatar-select-preview"
        {avatarId}
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
