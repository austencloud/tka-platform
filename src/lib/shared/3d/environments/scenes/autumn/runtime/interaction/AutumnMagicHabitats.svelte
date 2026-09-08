<script lang="ts">
  import { T } from "@threlte/core";
  import { onDestroy, untrack } from "svelte";
  import {
    AdditiveBlending,
    CircleGeometry,
    Color,
    Raycaster,
    ShaderMaterial,
    Vector3,
    type Object3D,
  } from "three";
  import type { PulseTarget } from "./AutumnInteraction.svelte";
  import { AUTUMN_MAGIC_HABITATS } from "./autumn-magic-habitat-layout";

  interface Props {
    groundY?: number;
    intensity?: number;
    scene?: Object3D | null;
    onTargets?: (targets: PulseTarget[]) => void;
  }

  let { groundY = 0, intensity = 1, scene = null, onTargets }: Props = $props();

  const habitats = AUTUMN_MAGIC_HABITATS;

  const geometry = untrack(() => new CircleGeometry(1, 48));
  const raycaster = untrack(() => new Raycaster());
  const rayOrigin = untrack(() => new Vector3());
  const down = untrack(() => new Vector3(0, -1, 0));
  let surfaceYs = $state(habitats.map(() => groundY));
  const entries = untrack(() =>
    habitats.map((habitat) => {
      const material = new ShaderMaterial({
        name: `Autumn Magic Habitat ${habitat.id}`,
        uniforms: {
          uColor: { value: new Color(habitat.color) },
          uIntensity: { value: 0.009 },
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uIntensity;
          varying vec2 vUv;
          void main() {
            float distanceFromCentre = length(vUv - 0.5) * 2.0;
            float aura = 1.0 - smoothstep(0.05, 1.0, distanceFromCentre);
            aura *= aura;
            if (aura < 0.004) discard;
            gl_FragColor = vec4(uColor, aura * uIntensity);
          }
        `,
      });
      return {
        ...habitat,
        material,
        worldPosition: new Vector3(
          habitat.position[0],
          groundY,
          habitat.position[1]
        ),
      };
    })
  );

  const targets = entries.map<PulseTarget>((entry) => ({
    position: entry.worldPosition,
    baseIntensity: 0.009 * intensity,
    boostScale: 0.025,
    readIntensity: () => entry.material.uniforms.uIntensity!.value as number,
    writeIntensity: (value) =>
      (entry.material.uniforms.uIntensity!.value = value),
  }));

  // The GLB floor rises and falls around every habitat. Resolve each plane
  // against that real mesh instead of assuming the stage's flat groundY;
  // otherwise an apparently valid interaction target can be buried under a
  // moon-facing slope and never produce a visible response.
  $effect(() => {
    const loadedScene = scene;
    const fallbackY = groundY;
    const terrain = loadedScene?.getObjectByName("Autumn_Terrain");
    loadedScene?.updateMatrixWorld(true);

    for (const [index, entry] of entries.entries()) {
      let surfaceY = fallbackY;
      if (terrain) {
        rayOrigin.set(entry.position[0], fallbackY + 40, entry.position[1]);
        raycaster.set(rayOrigin, down);
        const hit = raycaster.intersectObject(terrain, true)[0];
        if (hit) surfaceY = hit.point.y;
      }
      surfaceYs[index] = surfaceY;
      entry.worldPosition.y = surfaceY;
    }
  });

  $effect(() => {
    const base = 0.009 * intensity;
    for (const [index, entry] of entries.entries()) {
      entry.worldPosition.y = groundY;
      targets[index]!.baseIntensity = base;
      if (entry.material.uniforms.uIntensity!.value < base) {
        entry.material.uniforms.uIntensity!.value = base;
      }
    }
  });

  let targetsFired = false;
  $effect(() => {
    if (targetsFired) return;
    targetsFired = true;
    onTargets?.(targets);
  });

  onDestroy(() => {
    geometry.dispose();
    for (const entry of entries) entry.material.dispose();
  });
</script>

{#each entries as entry, index (entry.id)}
  <T.Mesh
    {geometry}
    material={entry.material}
    position.x={entry.position[0]}
    position.y={surfaceYs[index] + 0.018}
    position.z={entry.position[1]}
    rotation.x={-Math.PI / 2}
    scale.x={entry.radius}
    scale.y={entry.radius}
    renderOrder={32}
  />
{/each}
