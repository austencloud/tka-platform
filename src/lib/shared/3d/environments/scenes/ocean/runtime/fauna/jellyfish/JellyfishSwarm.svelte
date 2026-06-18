<script lang="ts">
  import { T, useTask, useThrelte } from "@threlte/core";
  import { onDestroy } from "svelte";
  import { Mesh, Raycaster, Vector2, Vector3 } from "three";
  import { Medusae, OCEAN_COLORS } from "./jellyfish-geometry";
  import { createJellyfishChime, buildPentatonicNotes, midiToFreq } from "./jellyfish-chime";
  import type { OceanQualityConfig } from "../../../quality/ocean-quality";

  // ── Props ──────────────────────────────────────────────────────────────

  interface Props {
    quality: OceanQualityConfig;
  }

  let { quality }: Props = $props();

  // ── Constants ──────────────────────────────────────────────────────────

  const SCALE = 0.012;
  const DRIFT_SPEED = 0.15;
  const FIXED_STEP = 1000 / 30;
  const STAGE_CLEAR_RADIUS = 6;
  const SPAWN_X_RANGE = 15;
  const SPAWN_Z_RANGE = 15;
  const SPAWN_Y_MIN = 3;
  const SPAWN_Y_MAX = 8;

  // Startle dart: impulse magnitude (world units/sec) and the time constants for
  // the velocity impulse dying off vs. the displacement easing back to rest.
  const DART_SPEED = 4;
  const DART_VEL_TAU = 0.15;
  const DART_OFFSET_TAU = 0.6;
  const DART_UP_BIAS = 0.5;
  // Hover affordance: world-space radius around each bell for the cheap
  // ray-vs-sphere test that drives the pointer cursor (no triangle raycast).
  const HOVER_RADIUS = 0.7;

  // ── Spawn position generation ──────────────────────────────────────────

  function generateSpawnPosition(seed: number): { x: number; y: number; z: number } {
    // Deterministic pseudo-random from seed — avoids hydration jitter
    const r1 = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    const r2 = Math.sin(seed * 269.5 + 183.3) * 43758.5453;
    const r3 = Math.sin(seed * 419.2 + 371.9) * 43758.5453;

    const frac = (v: number) => v - Math.floor(v);

    let x: number, z: number;
    let attempts = 0;

    // Reject positions inside the stage clear radius (center stage area)
    do {
      const rx = frac(Math.abs(r1 + attempts * 0.37));
      const rz = frac(Math.abs(r2 + attempts * 0.53));
      x = (rx * 2 - 1) * SPAWN_X_RANGE;
      z = (rz * 2 - 1) * SPAWN_Z_RANGE;
      attempts++;
    } while (Math.sqrt(x * x + z * z) < STAGE_CLEAR_RADIUS && attempts < 20);

    const ry = frac(Math.abs(r3));
    const y = SPAWN_Y_MIN + ry * (SPAWN_Y_MAX - SPAWN_Y_MIN);

    return { x, y, z };
  }

  // ── Jellyfish instances ────────────────────────────────────────────────

  interface JellyfishInstance {
    medusae: Medusae;
    baseX: number;
    baseY: number;
    baseZ: number;
    phaseOffset: number;
    elapsed: number;
    accumulator: number;
    dartVel: Vector3;
    dartOffset: Vector3;
    /** Frequency (Hz) this jelly chimes when tapped. */
    freq: number;
    /** Stereo pan in [-1, 1], from spawn X. */
    pan: number;
  }

  const instances: JellyfishInstance[] = [];
  const chime = createJellyfishChime();

  // Flat list of pickable meshes + a reverse map for click raycasting.
  const pickMeshes: Mesh[] = [];
  const meshToInstance = new Map<Mesh, JellyfishInstance>();

  const count = quality.maxJellyfish;

  for (let i = 0; i < count; i++) {
    const medusae = new Medusae(OCEAN_COLORS);

    // Warm up physics so jellyfish aren't in their initial collapsed state
    for (let w = 0; w < 200; w++) medusae.update(33);

    const { x, y, z } = generateSpawnPosition(i);
    const phaseOffset = i * 1.618; // Golden ratio spread for varied animation phases

    const inst: JellyfishInstance = {
      medusae,
      baseX: x,
      baseY: y,
      baseZ: z,
      phaseOffset,
      elapsed: phaseOffset * 1000,
      accumulator: 0,
      dartVel: new Vector3(),
      dartOffset: new Vector3(),
      freq: 0,
      pan: Math.max(-1, Math.min(1, x / SPAWN_X_RANGE)),
    };
    instances.push(inst);

    medusae.item.traverse((child) => {
      if ((child as Mesh).isMesh) {
        pickMeshes.push(child as Mesh);
        meshToInstance.set(child as Mesh, inst);
      }
    });
  }

  // Assign a major-pentatonic note per jelly by depth: deeper (lower Y) → lower
  // note, so the vertical swarm plays like a xylophone.
  const notes = buildPentatonicNotes(instances.length);
  instances
    .map((inst, i) => ({ inst, i }))
    .sort((a, b) => a.inst.baseY - b.inst.baseY)
    .forEach(({ inst }, rank) => {
      inst.freq = midiToFreq(notes[rank]!);
    });

  // ── Click picking → startle ─────────────────────────────────────────────

  const { renderer, camera } = useThrelte();
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const dartDir = new Vector3();

  function getGl(): import("three").WebGLRenderer | undefined {
    return (renderer as any)?.current ?? (renderer as any);
  }

  function getCam(): import("three").Camera | undefined {
    return (camera as any)?.current ?? (camera as any);
  }

  function onPointerDown(event: PointerEvent): void {
    const gl = getGl();
    const cam = getCam();
    const el = gl?.domElement as HTMLCanvasElement | undefined;
    if (!el || !cam) return;

    const rect = el.getBoundingClientRect();
    const cx = event.clientX;
    const cy = event.clientY;
    if (cx < rect.left || cx > rect.right || cy < rect.top || cy > rect.bottom) return;

    ndc.x = ((cx - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((cy - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, cam);

    // Bells deform every frame, so the cached bounding spheres go stale — refresh
    // before the hit test or three may cull a jelly that's actually under the cursor.
    for (const mesh of pickMeshes) mesh.geometry.computeBoundingSphere();

    const hit = raycaster.intersectObjects(pickMeshes, false)[0];
    if (!hit) return;

    const inst = meshToInstance.get(hit.object as Mesh);
    if (!inst) return;

    inst.medusae.triggerStartle();
    chime.play(inst.freq, inst.pan);

    // Dart away from the cursor: flee along the view ray (deeper into the scene)
    // with an upward jet, the way a startled jelly pulses off.
    dartDir.copy(raycaster.ray.direction).setY(raycaster.ray.direction.y + DART_UP_BIAS).normalize();
    inst.dartVel.copy(dartDir).multiplyScalar(DART_SPEED);
  }

  // Hover → pointer cursor. Cheap ray-vs-sphere against each bell (sphere reject,
  // no geometry raycast) so it can run on every pointermove without the cost of
  // the precise click pick.
  let cursorEl: HTMLCanvasElement | undefined;
  let cursorSet = false;

  function setHoverCursor(on: boolean): void {
    if (on === cursorSet) return;
    cursorSet = on;
    if (cursorEl) cursorEl.style.cursor = on ? "pointer" : "";
  }

  function onPointerMove(event: PointerEvent): void {
    const gl = getGl();
    const cam = getCam();
    const el = gl?.domElement as HTMLCanvasElement | undefined;
    if (!el || !cam) return;
    cursorEl = el;

    const rect = el.getBoundingClientRect();
    const cx = event.clientX;
    const cy = event.clientY;
    if (cx < rect.left || cx > rect.right || cy < rect.top || cy > rect.bottom) {
      setHoverCursor(false);
      return;
    }

    ndc.x = ((cx - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((cy - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, cam);

    let over = false;
    for (const inst of instances) {
      if (raycaster.ray.distanceToPoint(inst.medusae.item.position) <= HOVER_RADIUS) {
        over = true;
        break;
      }
    }
    setHoverCursor(over);
  }

  $effect(() => {
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      setHoverCursor(false);
    };
  });

  // ── Per-frame update ───────────────────────────────────────────────────

  useTask((delta) => {
    const dt = Math.min(delta * 1000, 50);
    const dtSec = dt * 0.001;
    const velDecay = Math.exp(-dtSec / DART_VEL_TAU);
    const offsetDecay = Math.exp(-dtSec / DART_OFFSET_TAU);

    for (const inst of instances) {
      inst.elapsed += dt;
      inst.accumulator += dt;

      while (inst.accumulator >= FIXED_STEP) {
        inst.medusae.update(FIXED_STEP);
        inst.accumulator -= FIXED_STEP;
      }

      // Dart impulse: velocity dies quickly, displacement eases back to rest, so
      // the jelly lurches off then settles into its drift.
      inst.dartVel.multiplyScalar(velDecay);
      inst.dartOffset.addScaledVector(inst.dartVel, dtSec).multiplyScalar(offsetDecay);

      const { elapsed, phaseOffset, baseX, baseY, baseZ, medusae, dartOffset } = inst;
      const t = elapsed * 0.001;

      const driftX = Math.sin(t * DRIFT_SPEED + phaseOffset) * 0.5;
      const driftY = Math.sin(t * DRIFT_SPEED * 0.6 + phaseOffset * 2) * 0.3;
      const driftZ = Math.cos(t * DRIFT_SPEED * 0.8 + phaseOffset * 0.5) * 0.4;

      const animT = medusae.animTime;
      const pulse = (Math.sin(animT * Math.PI - Math.PI * 0.5) + 1) * 0.5;
      const strength = 0.4 + 0.6
        * ((Math.sin(animT * 0.31 + phaseOffset * 5.3) + 1) * 0.5)
        * ((Math.sin(animT * 0.17 + phaseOffset * 2.9) + 1) * 0.5);
      const bob = pulse * strength * 0.08;

      medusae.item.position.set(
        baseX + driftX + dartOffset.x,
        baseY + driftY + bob + dartOffset.y,
        baseZ + driftZ + dartOffset.z,
      );
      medusae.item.scale.setScalar(SCALE);

      const tiltX = Math.sin(t * 0.3 + phaseOffset) * 0.1;
      const tiltZ = Math.cos(t * 0.25 + phaseOffset * 1.5) * 0.08;
      medusae.item.rotation.set(tiltX, t * 0.05, tiltZ);
    }
  });

  // ── Cleanup ────────────────────────────────────────────────────────────

  onDestroy(() => {
    for (const inst of instances) inst.medusae.dispose();
    chime.dispose();
  });
</script>

{#each instances as inst (inst.phaseOffset)}
  <T is={inst.medusae.item} />
{/each}
