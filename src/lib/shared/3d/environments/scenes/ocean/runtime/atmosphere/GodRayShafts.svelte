<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import {
    ShaderMaterial,
    AdditiveBlending,
    DoubleSide,
    Color,
    PlaneGeometry,
    InstancedMesh,
    InstancedBufferAttribute,
    Matrix4,
    Vector3,
    Quaternion,
    Euler,
  } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { onDestroy } from "svelte";
  import { OCEAN_WATER_DEPTH_METERS } from "$lib/shared/3d/environments/domain/models/ocean-water-depth";
  import vertexShader from "../../shaders/atmosphere/god-ray.vert?raw";
  import fragmentShader from "../../shaders/atmosphere/god-ray.frag?raw";
  import { oceanDebugToggles } from "../../quality/ocean-debug-toggles.svelte";
  import {
    SHAFT_HEIGHT,
    LEAN,
    LEAN_AXIS,
    HERO_TARGET_XZ,
    shaftCentreForTarget,
  } from "./god-ray-axis";

  // ── Config ─────────────────────────────────────────────────────────────
  // One hero column plus a supporting cast. The hero descends from the water
  // plane onto the stage and is the scene's key light made visible; the other 13
  // are background depth cues, deliberately far dimmer so they cannot compete
  // with it. A flat ring of 14 equal shafts is wallpaper, not a key.
  const COUNT = 14;
  // NOT comparable to the pre-2026-08-09 value — see god-ray.frag, which used to
  // square its own alpha through the additive blend. The same visible result now
  // needs roughly 1/25th the number.
  const INTENSITY = 0.42;
  const WIDTH = 3.5;
  const HEIGHT = SHAFT_HEIGHT;
  const SPEED = 0.3;

  // Narrower than the 8 m stage and at full opacity. Tight-and-bright reads as a
  // beam; wide-and-dim reads as haze, and the hero sits directly in front of the
  // proscenium arch where haze just washes the arch out. 2.6x/1.0 washed it,
  // 1.9x/0.8 disappeared into it; this is the beam.
  const HERO_WIDTH_SCALE = 1.5;
  const HERO_OPACITY = 1;
  const SUPPORT_RADIUS_MIN = 7.5;
  const SUPPORT_RADIUS_MAX = 15;
  // Trimmed from 0.16/0.34. The hero is partly occluded by the arch (it reads
  // THROUGH the aperture, which is the composition we want), so a support that
  // lands in open water beside the arch was winning the frame outright at 0.34.
  // The supporting cast has to stay quiet enough that the eye never mistakes one
  // of them for the key.
  const SUPPORT_OPACITY_MIN = 0.1;
  const SUPPORT_OPACITY_MAX = 0.2;
  // Golden angle: distributes the supporting columns without clumping and
  // without the visible ring that an even angular step produces.
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

  interface Props {
    halfRes?: boolean;
    worldYOffset?: number;
  }

  let { halfRes = false, worldYOffset = 0 }: Props = $props();

  const localGroundY = $derived(userProportionsState.groundY);
  const worldGroundY = $derived(localGroundY + worldYOffset);

  function seededRandom(seed: number) {
    let s = seed;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return s / 2147483647;
    };
  }

  const material = new ShaderMaterial({
    transparent: true,
    blending: AdditiveBlending,
    side: DoubleSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uColorTop: { value: new Color("#ffffdd") }, // sun color at the surface
      uColorBottom: { value: new Color("#bcd6e6") }, // cooler where the shaft fades into depth
      uIntensity: { value: INTENSITY },
      uHeight: { value: HEIGHT },
      uGroundY: { value: 0 },
    },
    vertexShader,
    fragmentShader,
  });

  let instancedMesh = $state<InstancedMesh | null>(null);

  $effect(() => {
    const geo = new PlaneGeometry(WIDTH, HEIGHT);
    const rng = seededRandom(777);

    const opacities = new Float32Array(COUNT);
    const inst = new InstancedMesh(geo, material, COUNT);
    inst.frustumCulled = false;

    const mat = new Matrix4();
    const q = new Quaternion();
    const spinQ = new Quaternion();
    const leanQ = new Quaternion();
    const s = new Vector3(1, 1, 1);
    const pos = new Vector3();
    const euler = new Euler();

    for (let i = 0; i < COUNT; i++) {
      const isHero = i === 0;

      let rotY: number;
      let widthScale: number;
      let leanJitter: number;

      if (isHero) {
        // Broadside to the default camera (which looks down -Z at the stage), so
        // the hero reads as a beam rather than an edge-on sliver. No lean jitter:
        // this column has to stay coaxial with the key spot light.
        rotY = 0;
        widthScale = HERO_WIDTH_SCALE;
        leanJitter = 0;
        // Solve the centre backwards from where the column must LAND — the tilt
        // means a shaft centred over the stage would come down beside it.
        pos.copy(
          shaftCentreForTarget(
            localGroundY,
            HERO_TARGET_XZ.x,
            HERO_TARGET_XZ.z
          )
        );
        opacities[i] = HERO_OPACITY;
      } else {
        const t = (i - 1) / (COUNT - 2);
        const angle = (i - 1) * GOLDEN_ANGLE;
        const radius =
          SUPPORT_RADIUS_MIN +
          t * (SUPPORT_RADIUS_MAX - SUPPORT_RADIUS_MIN) +
          (rng() - 0.5) * 2.5;
        rotY = rng() * Math.PI * 2;
        widthScale = 0.5 + rng() * 0.8;
        leanJitter = (rng() - 0.5) * 0.08;
        opacities[i] =
          SUPPORT_OPACITY_MIN +
          rng() * (SUPPORT_OPACITY_MAX - SUPPORT_OPACITY_MIN);
        // Annulus, never the middle: the supporting columns ring the reef and
        // leave the frame's centre to the hero.
        pos.set(
          Math.cos(angle) * radius,
          localGroundY + OCEAN_WATER_DEPTH_METERS - HEIGHT * 0.5,
          Math.sin(angle) * radius
        );
      }

      // Each column keeps its own Y spin (so the planes face many ways and read
      // as a volume), then all tip toward the one sun by LEAN (+ small jitter).
      euler.set(0, rotY, 0);
      spinQ.setFromEuler(euler);
      leanQ.setFromAxisAngle(LEAN_AXIS, LEAN + leanJitter);
      q.copy(leanQ).multiply(spinQ);

      s.set(widthScale, 1, 1);
      mat.compose(pos, q, s);
      inst.setMatrixAt(i, mat);
    }

    inst.instanceMatrix.needsUpdate = true;
    geo.setAttribute(
      "aOpacityMult",
      new InstancedBufferAttribute(opacities, 1),
    );

    instancedMesh = inst;

    return () => {
      geo.dispose();
      inst.dispose();
    };
  });

  $effect(() => {
    material.uniforms.uGroundY!.value = worldGroundY;
  });

  // Dev A/B toggle — zero intensity when shafts are off (no rebuild).
  $effect(() => {
    material.uniforms.uIntensity!.value = oceanDebugToggles.godRayShafts ? INTENSITY : 0;
  });

  useTask((delta) => {
    material.uniforms.uTime!.value += delta * SPEED * 5;
  });

  onDestroy(() => {
    material.dispose();
  });
</script>

{#if instancedMesh}
  <T is={instancedMesh} />
{/if}
