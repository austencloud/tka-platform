<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { MathUtils, Vector3, Quaternion, Euler, CubicBezierCurve3 } from "three";
  import type { PerspectiveCamera } from "three";

  interface Props {
    flipRequested: number;
  }

  let { flipRequested }: Props = $props();

  let camera: PerspectiveCamera | undefined = $state();

  // Camera position follows a Bezier ARC, not a straight line.
  // This keeps the floor visible throughout the transition.
  // Control points push the camera backward (positive Z) early,
  // so it always has line-of-sight to the floor.
  const POSITION_CURVE = new CubicBezierCurve3(
    new Vector3(0, 50, 0),       // Start: directly above
    new Vector3(0, 45, 12),      // Control 1: push back early (keeps floor visible)
    new Vector3(0, 8, 14),       // Control 2: wide arc at low altitude
    new Vector3(0, 1.7, 6),      // End: first-person position
  );

  // The lookAt target also transitions — from floor center to eye-level ahead
  const TARGET_CURVE = new CubicBezierCurve3(
    new Vector3(0, 0, 0),        // Start: floor center (what top-down sees)
    new Vector3(0, 0, 0),        // Control 1: stay on floor
    new Vector3(0, 0.8, -2),     // Control 2: target rises slightly
    new Vector3(0, 1.7, 0),      // End: eye-level, straight ahead
  );

  const TOP_DOWN_FOV = 12;
  const FPS_FOV = 65;

  // Initial state quaternion (for first-frame init)
  const TOP_DOWN_QUAT = new Quaternion().setFromEuler(new Euler(-Math.PI / 2, 0, 0));

  const DURATION = 1.8;

  let progress = 0;
  let animating = false;
  let goingDown = true;
  let lastFlipCount = 0;
  let initialized = false;

  const tempTarget = new Vector3();
  const tempUp = new Vector3();

  function easeInOutCubic(x: number): number {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  useTask((delta) => {
    if (!camera) return;

    if (!initialized) {
      initialized = true;
      POSITION_CURVE.getPoint(0, camera.position);
      camera.quaternion.copy(TOP_DOWN_QUAT);
      camera.fov = TOP_DOWN_FOV;
      camera.near = 0.5;
      camera.far = 200;
      camera.updateProjectionMatrix();
      return;
    }

    if (flipRequested !== lastFlipCount) {
      lastFlipCount = flipRequested;
      if (!animating) {
        animating = true;
        goingDown = progress < 0.5;
      }
    }

    if (!animating) return;

    const step = delta / DURATION;
    if (goingDown) {
      progress = Math.min(progress + step, 1);
      if (progress >= 1) animating = false;
    } else {
      progress = Math.max(progress - step, 0);
      if (progress <= 0) animating = false;
    }

    const t = easeInOutCubic(progress);

    // Position follows the Bezier arc (keeps floor visible throughout)
    POSITION_CURVE.getPoint(t, camera.position);

    // LookAt target transitions from floor center to eye-level ahead
    TARGET_CURVE.getPoint(t, tempTarget);

    // Up vector: (0,0,-1) when looking down → (0,1,0) when looking forward
    // This prevents gimbal lock at the top-down pole
    tempUp.set(0, t, -(1 - t)).normalize();
    camera.up.copy(tempUp);
    camera.lookAt(tempTarget);

    // FOV widens as we descend (dolly-zoom keeps floor filling frame)
    camera.fov = MathUtils.lerp(TOP_DOWN_FOV, FPS_FOV, t);
    camera.near = MathUtils.lerp(0.5, 0.1, t);
    camera.far = MathUtils.lerp(200, 100, t);
    camera.updateProjectionMatrix();
  });

  // Scene data
  const GRID = 10;
  const TILE = 2;

  const floors: { x: number; z: number; color: string }[] = [];
  for (let row = 1; row < GRID - 1; row++) {
    for (let col = 1; col < GRID - 1; col++) {
      floors.push({
        x: (col - GRID / 2) * TILE,
        z: (row - GRID / 2) * TILE,
        color: (row + col) % 2 === 0 ? "#2a2520" : "#252018",
      });
    }
  }

  const walls: { x: number; z: number }[] = [];
  for (let i = 0; i < GRID; i++) {
    walls.push({ x: (i - GRID / 2) * TILE, z: (-GRID / 2) * TILE });
    walls.push({ x: (i - GRID / 2) * TILE, z: (GRID / 2 - 1) * TILE });
    if (i > 0 && i < GRID - 1) {
      walls.push({ x: (-GRID / 2) * TILE, z: (i - GRID / 2) * TILE });
      walls.push({ x: (GRID / 2 - 1) * TILE, z: (i - GRID / 2) * TILE });
    }
  }
</script>

<T.PerspectiveCamera makeDefault bind:ref={camera} fov={TOP_DOWN.fov} near={0.5} far={200} />

<T.AmbientLight intensity={0.5} color="#c8b890" />
<T.DirectionalLight intensity={0.8} position={[5, 15, 5]} color="#fff0d0" />

{#each floors as tile}
  <T.Mesh position.x={tile.x} position.y={0} position.z={tile.z}>
    <T.BoxGeometry args={[TILE - 0.05, 0.1, TILE - 0.05]} />
    <T.MeshStandardMaterial color={tile.color} />
  </T.Mesh>
{/each}

{#each walls as wall}
  <T.Mesh position.x={wall.x} position.y={1.5} position.z={wall.z}>
    <T.BoxGeometry args={[TILE, 3, TILE]} />
    <T.MeshStandardMaterial color="#1a1510" />
  </T.Mesh>
{/each}

<T.Mesh position.x={-2} position.y={0.5} position.z={-4}>
  <T.BoxGeometry args={[1.2, 1, 1.2]} />
  <T.MeshStandardMaterial color="#12123a" />
</T.Mesh>
<T.Mesh position.x={4} position.y={0.5} position.z={-2}>
  <T.BoxGeometry args={[1.2, 1, 1.2]} />
  <T.MeshStandardMaterial color="#0e2e0e" />
</T.Mesh>
<T.Mesh position.x={0} position.y={0.5} position.z={2}>
  <T.BoxGeometry args={[1.2, 1, 1.2]} />
  <T.MeshStandardMaterial color="#3a3028" />
</T.Mesh>

<T.PointLight position={[-7, 2.5, -7]} intensity={8} color="#ff9020" distance={14} />
<T.PointLight position={[7, 2.5, -7]} intensity={8} color="#ff9020" distance={14} />
<T.PointLight position={[-7, 2.5, 7]} intensity={8} color="#ff9020" distance={14} />
<T.PointLight position={[7, 2.5, 7]} intensity={8} color="#ff9020" distance={14} />
