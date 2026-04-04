<script lang="ts">
  /**
   * Museum light fixture: loads a GLTF model per wing theme, with optional
   * flame shader, ember particles, volumetric light cone, and animated point light.
   * Falls back to procedural geometry when the GLB model hasn't been added yet.
   */
  import { T, useTask } from "@threlte/core";
  import { onDestroy } from "svelte";
  import {
    PointLight,
    ShaderMaterial,
    PlaneGeometry,
    ConeGeometry,
    MeshStandardMaterial,
    SphereGeometry,
    Points,
    BufferGeometry,
    Float32BufferAttribute,
    PointsMaterial,
    AdditiveBlending,
    DoubleSide,
    FrontSide,
    Color,
  } from "three";
  import { Box3, Vector3 } from "three";
  import type { Object3D } from "three";
  import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
  import type { FixtureConfig } from "../../domain/fixture-registry";
  import { FIXTURE_REGISTRY } from "../../domain/fixture-registry";
  import type { WingTheme } from "../../domain/museum-grid-types";

  // Shared loader instance — reuses HTTP cache across all fixture components
  const sharedLoader = new GLTFLoader();

  interface Props {
    x: number;
    z: number;
    y?: number;
    wallOffsetX?: number;
    wallOffsetZ?: number;
    baseIntensity?: number;
    distance?: number;
    /** Wing theme determines which fixture model and light color to use */
    wingTheme?: WingTheme;
  }

  let {
    x,
    z,
    y = 1.25,
    wallOffsetX = 0,
    wallOffsetZ = 0,
    baseIntensity = 4,
    distance = 8,
    wingTheme = "cave" as WingTheme,
  }: Props = $props();

  const config: FixtureConfig = FIXTURE_REGISTRY[wingTheme];
  const effectiveIntensity = baseIntensity > 0 ? config.lightIntensity : 0;

  // The fixture's actual world position, offset from the wall into the room
  const tx = x + wallOffsetX;
  const tz = z + wallOffsetZ;
  const fixtureY = y + config.yOffset;

  // ── GLTF model loading ──
  let gltfModel: Object3D | null = $state(null);
  let modelFailed = $state(false);

  // Target height for fixtures in world units (meters).
  // config.scale acts as a multiplier on this base size.
  const TARGET_HEIGHT = 0.3;

  sharedLoader.load(
    config.modelPath,
    (gltf) => {
      const model = gltf.scene;

      // Auto-scale: measure the model's bounding box and normalize to
      // TARGET_HEIGHT so every Sketchfab model lands at the same visual
      // size regardless of its native units.
      const box = new Box3().setFromObject(model);
      const size = new Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        const autoScale = (TARGET_HEIGHT / maxDim) * config.scale;
        model.scale.setScalar(autoScale);
      }

      model.position.set(tx, fixtureY, tz);
      gltfModel = model;
    },
    undefined,
    () => {
      // Model not found — use fallback
      modelFailed = true;
    },
  );

  // ── Fallback: simple emissive sphere when no GLB exists ──
  const fallbackGeo = new SphereGeometry(0.06, 8, 8);
  const fallbackMat = new MeshStandardMaterial({
    color: config.lightColor,
    emissive: config.lightColor,
    emissiveIntensity: 3.0,
  });

  // ── Flame billboard with noise shader (only for fire-based fixtures) ──
  const flameGeo = new PlaneGeometry(0.2, 0.35);
  const flameMat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: {
      uTime: { value: Math.random() * 100 },
      uIntensity: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 billboardPos = camRight * position.x + camUp * position.y;
        vec4 worldPos = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        worldPos.xyz += billboardPos;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 5; i++) {
          value += amplitude * noise(p);
          p *= 2.1;
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec2 uv = vUv;
        float xCenter = abs(uv.x - 0.5) * 2.0;
        float taper = 1.0 - pow(uv.y, 0.6);
        float mask = smoothstep(taper, taper - 0.3, xCenter);
        float vertFade = smoothstep(0.0, 0.15, uv.y) * smoothstep(1.0, 0.4, uv.y);
        vec2 noiseCoord = vec2(uv.x * 3.0, uv.y * 4.0 - uTime * 2.5);
        float n = fbm(noiseCoord);
        float flame = mask * vertFade * (0.6 + 0.4 * n);
        flame = smoothstep(0.1, 0.6, flame);

        vec3 white = vec3(1.0, 0.95, 0.85);
        vec3 yellow = vec3(1.0, 0.75, 0.2);
        vec3 orange = vec3(1.0, 0.4, 0.05);
        vec3 red = vec3(0.6, 0.1, 0.0);
        vec3 color = mix(red, orange, smoothstep(0.0, 0.3, flame));
        color = mix(color, yellow, smoothstep(0.3, 0.6, flame));
        color = mix(color, white, smoothstep(0.6, 0.9, flame));
        color *= 1.5 * uIntensity;

        gl_FragColor = vec4(color, flame * 0.9);
      }
    `,
  });

  // ── Volumetric light cone ──
  const coneGeo = new ConeGeometry(0.4, 0.8, 12, 1, true);
  const coneMat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: FrontSide,
    blending: AdditiveBlending,
    uniforms: {
      uColor: { value: new Color(config.lightColor) },
      uIntensity: { value: 0.15 },
    },
    vertexShader: /* glsl */ `
      varying float vHeight;
      void main() {
        vHeight = (position.y + 0.4) / 0.8;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uIntensity;
      varying float vHeight;
      void main() {
        float alpha = vHeight * vHeight * uIntensity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });

  // ── Ember particles (only for fire-based fixtures) ──
  const EMBER_COUNT = config.hasEmbers ? 24 : 0;
  const emberPositions = new Float32Array(Math.max(EMBER_COUNT * 3, 3));
  const emberSpeeds = new Float32Array(EMBER_COUNT);
  const emberDrifts = new Float32Array(EMBER_COUNT * 2);

  for (let i = 0; i < EMBER_COUNT; i++) {
    emberSpeeds[i] = 0.3 + Math.random() * 0.5;
    emberDrifts[i * 2] = (Math.random() - 0.5) * 0.15;
    emberDrifts[i * 2 + 1] = (Math.random() - 0.5) * 0.15;
    resetEmber(i, Math.random());
  }

  function resetEmber(i: number, heightFraction: number): void {
    emberPositions[i * 3] = (Math.random() - 0.5) * 0.08;
    emberPositions[i * 3 + 1] = heightFraction * 0.6;
    emberPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.08;
  }

  const emberGeo = new BufferGeometry();
  emberGeo.setAttribute("position", new Float32BufferAttribute(emberPositions, 3));
  const emberMat = new PointsMaterial({
    color: "#ffaa40",
    size: 0.015,
    transparent: true,
    opacity: 0.8,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const emberPoints = new Points(emberGeo, emberMat);

  // ── Point light ──
  let light: PointLight | undefined = $state();
  let elapsed = Math.random() * 100;
  const isFireBased = config.hasFlame;

  // ── Animation loop ──
  useTask((delta) => {
    elapsed += delta;

    if (config.hasFlame) {
      flameMat.uniforms.uTime!.value = elapsed;
    }

    if (light && effectiveIntensity > 0) {
      if (isFireBased) {
        // Organic flicker for fire-based fixtures
        const slow = Math.sin(elapsed * 1.2) * 0.15;
        const medium = Math.sin(elapsed * 4.7) * 0.1;
        const fast = Math.sin(elapsed * 13.3) * 0.05;
        const crackle = Math.sin(elapsed * 37.1) * Math.sin(elapsed * 23.7) * 0.08;
        const flicker = slow + medium + fast + crackle;

        light.intensity = effectiveIntensity + flicker * effectiveIntensity;
        light.color.setRGB(1.0, 0.56 + 0.02 * Math.sin(elapsed * 2.3), 0.13 - 0.01 * Math.sin(elapsed * 2.3));

        flameMat.uniforms.uIntensity!.value = 0.85 + flicker * 0.5;
        (coneMat.uniforms.uIntensity as { value: number }).value = 0.12 + flicker * 0.06;
      } else {
        // Subtle hum for electric fixtures (fluorescent flicker)
        const hum = Math.sin(elapsed * 120) * 0.02;
        light.intensity = effectiveIntensity + hum * effectiveIntensity;
      }
    }

    // Animate embers
    if (EMBER_COUNT > 0) {
      for (let i = 0; i < EMBER_COUNT; i++) {
        emberPositions[i * 3] += emberDrifts[i * 2]! * delta;
        emberPositions[i * 3 + 1] += emberSpeeds[i]! * delta;
        emberPositions[i * 3 + 2] += emberDrifts[i * 2 + 1]! * delta;
        if (emberPositions[i * 3 + 1]! > 0.6) {
          resetEmber(i, 0);
          emberDrifts[i * 2] = (Math.random() - 0.5) * 0.15;
          emberDrifts[i * 2 + 1] = (Math.random() - 0.5) * 0.15;
        }
      }
      (emberGeo.getAttribute("position") as Float32BufferAttribute).needsUpdate = true;
    }
  });

  const flameY = fixtureY + 0.2;

  onDestroy(() => {
    fallbackGeo.dispose();
    fallbackMat.dispose();
    flameGeo.dispose();
    flameMat.dispose();
    coneGeo.dispose();
    coneMat.dispose();
    emberGeo.dispose();
    emberMat.dispose();
  });
</script>

<!-- GLTF model (loaded async) -->
{#if gltfModel}
  <T is={gltfModel} />
{/if}

<!-- Fallback: emissive sphere when model hasn't loaded or doesn't exist -->
{#if modelFailed}
  <T.Mesh
    geometry={fallbackGeo}
    material={fallbackMat}
    position.x={tx}
    position.y={fixtureY}
    position.z={tz}
  />
{/if}

<!-- Flame billboard (fire-based fixtures only) -->
{#if config.hasFlame}
  <T.Mesh
    geometry={flameGeo}
    material={flameMat}
    position.x={tx}
    position.y={flameY}
    position.z={tz}
    frustumCulled={false}
  />
{/if}

<!-- Volumetric light cone -->
<T.Mesh
  geometry={coneGeo}
  material={coneMat}
  position.x={tx}
  position.y={flameY - 0.5}
  position.z={tz}
/>

<!-- Ember particles (fire-based fixtures only) -->
{#if config.hasEmbers}
  <T
    is={emberPoints}
    position.x={tx}
    position.y={flameY}
    position.z={tz}
  />
{/if}

<!-- Point light -->
{#if effectiveIntensity > 0}
  <T.PointLight
    bind:ref={light}
    position={[tx, flameY, tz]}
    intensity={effectiveIntensity}
    color={config.lightColor}
    {distance}
    decay={2}
  />
{/if}
