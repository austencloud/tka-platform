<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { SphereGeometry, ShaderMaterial, Color, AdditiveBlending } from "three";
  import type { CloudIslandsConfig } from "../../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    config: CloudIslandsConfig;
  }

  let { config }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  const sphereGeometry = new SphereGeometry(1, 16, 16);

  const vertexShader = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform vec3 uColor;
    uniform float uTime;
    varying vec3 vNormal;
    varying vec3 vPosition;

    float hash(vec3 p) {
      p = fract(p * 0.3183099 + 0.1);
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    float noise3D(vec3 p) {
      vec3 i = floor(p); vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x),
                     mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                 mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                     mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
    }

    float fbm(vec3 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 4; i++) {
        v += a * noise3D(p); p = p * 2.0 + vec3(100.0); a *= 0.5;
      }
      return v;
    }

    void main() {
      float n = fbm(vPosition * 2.0 + uTime * 0.1);

      float dist = length(vPosition);
      float edge = 1.0 - smoothstep(0.5, 1.0, dist);
      float cloudAlpha = smoothstep(0.3, 0.6, n) * edge;

      float lighting = dot(vNormal, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
      lighting = pow(lighting, 1.2);

      vec3 color = uColor * (0.7 + lighting * 0.3);
      color += vec3(1.0, 0.95, 0.85) * pow(lighting, 3.0) * 0.3;

      gl_FragColor = vec4(color, cloudAlpha * 0.7);
    }
  `;

  interface IslandState {
    angle: number;
    orbitRadius: number;
    height: number;
    bobPhase: number;
    scale: number;
  }

  function seededRandom(seed: number): number {
    const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  const islandStates = $derived.by(() => {
    if (!config.enabled) return [];
    const states: IslandState[] = [];
    for (let i = 0; i < config.count; i++) {
      const r0 = seededRandom(i * 3);
      const r1 = seededRandom(i * 3 + 1);
      const r2 = seededRandom(i * 3 + 2);
      states.push({
        angle: r0 * Math.PI * 2,
        orbitRadius: config.spawnRadius * (0.5 + r1 * 0.5),
        height:
          config.heightRange[0] +
          r2 * (config.heightRange[1] - config.heightRange[0]),
        bobPhase: r0 * Math.PI * 2,
        scale:
          config.sizeRange[0] +
          r1 * (config.sizeRange[1] - config.sizeRange[0]),
      });
    }
    return states;
  });

  let islands = $state<{ x: number; y: number; z: number; scale: number }[]>([]);

  const cloudMaterial = $derived.by(() => {
    return new ShaderMaterial({
      uniforms: {
        uColor: { value: new Color(config.color) },
        uTime: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
    });
  });

  let time = 0;

  useTask((delta) => {
    if (!config.enabled || islandStates.length === 0 || !cloudMaterial) return;
    time += delta;
    cloudMaterial.uniforms.uTime!.value = time;

    const updated: { x: number; y: number; z: number; scale: number }[] = [];
    for (let i = 0; i < islandStates.length; i++) {
      const s = islandStates[i]!;
      const currentAngle = s.angle + time * config.driftSpeed * 0.1;
      const x = Math.cos(currentAngle) * s.orbitRadius;
      const z = Math.sin(currentAngle) * s.orbitRadius;
      const bob = Math.sin(time * config.bobSpeed + s.bobPhase) * 0.3;
      const y = groundY + s.height + bob;
      updated.push({ x, y, z, scale: s.scale });
    }
    islands = updated;
  });

  $effect(() => {
    if (!cloudMaterial) return;
    cloudMaterial.uniforms.uColor!.value = new Color(config.color);
  });
</script>

{#if config.enabled}
  {#each islands as island, i (i)}
    <T.Mesh
      geometry={sphereGeometry}
      material={cloudMaterial}
      position.x={island.x}
      position.y={island.y}
      position.z={island.z}
      scale.x={island.scale * 1.5}
      scale.y={island.scale * 0.6}
      scale.z={island.scale}
    />
  {/each}
{/if}
