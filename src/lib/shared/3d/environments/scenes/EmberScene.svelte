<script lang="ts">
  import { T, useThrelte, useTask } from "@threlte/core";
  import { useGltf } from "@threlte/extras";
  import { onMount } from "svelte";
  import {
    Vector3,
    FogExp2,
    Color,
    ShaderMaterial,
    AdditiveBlending,
    DoubleSide,
    Shape,
    ShapeGeometry,
    type MeshStandardMaterial,
  } from "three";
  import GroundPlane from "../primitives/GroundPlane.svelte";
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import FallingParticles from "../primitives/FallingParticles.svelte";
  import VolumetricFireComponent from "../../effects/volumetric-fire/VolumetricFireComponent.svelte";
  import {
    type EmberSceneConfig,
    createDefaultEmberGlowConfig,
  } from "../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";
  import ObsidianPillars from "./ember/ObsidianPillars.svelte";
  import FireWisps from "./ember/FireWisps.svelte";
  import EmberFountains from "./ember/EmberFountains.svelte";
  import VolcanicHaze from "./ember/VolcanicHaze.svelte";

  interface Props {
    config?: EmberSceneConfig;
  }

  let { config }: Props = $props();

  const activeConfig = $derived(config ?? createDefaultEmberGlowConfig());

  const rockA = useGltf("/models/winter/rock_largeA.glb");
  const rockB = useGltf("/models/winter/rock_largeB.glb");
  const logModel = useGltf("/models/camping/tree-log.glb");
  const logSmall = useGltf("/models/camping/tree-log-small.glb");
  const campfire = useGltf("/models/camping/campfire-pit.glb");

  const { scene } = useThrelte();

  let sceneFeatures = $state<ReturnType<typeof getSceneFeatureContext> | null>(
    null,
  );
  try {
    sceneFeatures = getSceneFeatureContext();
  } catch {
    // May render outside scene feature system
  }

  const groundY = $derived(userProportionsState.groundY);

  // ============================================================================
  // Volcanic tint — darkens and warms cloned models
  // ============================================================================

  function tintVolcanic(
    root: { traverse: (cb: (obj: unknown) => void) => void },
    color: string,
    blend: number,
  ) {
    const tintColor = new Color(color);
    root.traverse((obj) => {
      const m = obj as { isMesh?: boolean; material?: unknown };
      if (!m.isMesh || !m.material) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const cloned = mats.map((mat) => {
        const clone = (mat as MeshStandardMaterial).clone();
        if (clone.color) clone.color.lerp(tintColor, blend);
        if (clone.emissive) clone.emissive.lerp(new Color("#220800"), 0.2);
        return clone;
      });
      (m as { material: unknown }).material = Array.isArray(m.material)
        ? cloned
        : cloned[0];
    });
  }

  function volcanicClone(
    sourceScene: {
      clone: () => { traverse: (cb: (obj: unknown) => void) => void };
    },
    color: string,
    blend: number,
  ) {
    const cloned = sourceScene.clone();
    tintVolcanic(cloned, color, blend);
    return cloned;
  }

  // ============================================================================
  // Rock placements
  // ============================================================================

  const rockPlacements = $derived.by(() => {
    const count = activeConfig.rockCount;
    const clearingRadius = activeConfig.clearingRadius;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + 0.2;
      const radius = clearingRadius - 2.0 + Math.sin(i * 4.1) * 1.5;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const scale = 0.4 + Math.abs(Math.sin(i * 3.2) * 0.35);
      const rotation = Math.sin(i * 2.8) * Math.PI;
      return [x, z, scale, rotation] as [number, number, number, number];
    });
  });

  // Charred logs scattered near the fire vent
  const logPlacements: [number, number, number, number, boolean][] = [
    [7.0, -1.5, 1.8, Math.PI * 0.3, true],
    [3.5, -5.0, 1.5, Math.PI * 0.8, false],
    [8.5, -5.5, 1.4, Math.PI * 1.3, true],
    [-8.0, -4.0, 1.6, Math.PI * 0.5, false],
    [10.0, 2.5, 1.3, Math.PI * 1.1, true],
    [-9.5, 7.0, 1.5, Math.PI * 0.2, false],
  ];

  // ============================================================================
  // Lava pool — organic shape with animated lava shader
  // ============================================================================

  function createLavaPoolShape(
    radius: number,
    seed: number,
  ): Shape {
    const shape = new Shape();
    const pointCount = 12;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < pointCount; i++) {
      const angle = (i / pointCount) * Math.PI * 2;
      const noise =
        Math.sin(i * 2.3 + seed) * 0.2 +
        Math.cos(i * 1.7 + seed * 1.5) * 0.12;
      const r = radius * (1 + noise);
      pts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }
    shape.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 0; i < pointCount; i++) {
      const p = pts[i]!;
      const pNext = pts[(i + 1) % pointCount]!;
      const pPrev = pts[(i - 1 + pointCount) % pointCount]!;
      const pPlus = pts[(i + 2) % pointCount]!;
      const c1 = {
        x: p.x + (pNext.x - pPrev.x) / 6,
        y: p.y + (pNext.y - pPrev.y) / 6,
      };
      const c2 = {
        x: pNext.x - (pPlus.x - p.x) / 6,
        y: pNext.y - (pPlus.y - p.y) / 6,
      };
      shape.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, pNext.x, pNext.y);
    }
    return shape;
  }

  function createLavaMaterial(
    baseColor: string,
    hotColor: string,
    crustColor: string,
  ): ShaderMaterial {
    return new ShaderMaterial({
      transparent: false,
      side: DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uBaseColor: { value: new Color(baseColor) },
        uHotColor: { value: new Color(hotColor) },
        uCrustColor: { value: new Color(crustColor) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uBaseColor;
        uniform vec3 uHotColor;
        uniform vec3 uCrustColor;
        varying vec2 vUv;

        // Simplex-like noise
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
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
          float v = 0.0;
          float a = 0.5;
          vec2 shift = vec2(100.0);
          for (int i = 0; i < 5; i++) {
            v += a * noise(p);
            p = p * 2.0 + shift;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec2 uv = (vUv - 0.5) * 4.0;

          // Flowing lava pattern — two offset FBM layers
          float flow1 = fbm(uv * 2.0 + vec2(uTime * 0.3, uTime * 0.2));
          float flow2 = fbm(uv * 1.5 - vec2(uTime * 0.25, -uTime * 0.15));
          float flow = (flow1 + flow2) * 0.5;

          // Crust pattern — darker, slower-moving chunks
          float crust = fbm(uv * 3.0 + vec2(uTime * 0.05, uTime * 0.08));
          crust = smoothstep(0.35, 0.65, crust);

          // Hot veins visible between crust
          float veins = 1.0 - crust;
          veins *= smoothstep(0.3, 0.7, flow);

          // Color mixing
          vec3 lavaColor = mix(uBaseColor, uHotColor, veins * 0.8);
          vec3 finalColor = mix(lavaColor, uCrustColor, crust * 0.7);

          // Bright hotspots
          float hotspot = smoothstep(0.6, 0.9, flow) * veins;
          finalColor += uHotColor * hotspot * 1.5;

          // Edge darkening
          float dist = length(vUv - 0.5) * 2.0;
          float edgeFade = smoothstep(0.8, 1.0, dist);
          finalColor = mix(finalColor, uCrustColor * 0.3, edgeFade);

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });
  }

  let lavaMaterial = $state<ShaderMaterial | null>(null);
  let lavaGeometry = $state<ShapeGeometry | null>(null);

  $effect(() => {
    const pool = activeConfig.lavaPool;
    if (!pool.enabled) {
      lavaMaterial = null;
      lavaGeometry = null;
      return;
    }

    const shape = createLavaPoolShape(
      pool.radius,
      pool.position.x * 0.7 + pool.position.z * 1.3,
    );
    const nextGeom = new ShapeGeometry(shape, 64);
    const nextMat = createLavaMaterial(pool.baseColor, pool.hotColor, pool.crustColor);
    lavaGeometry = nextGeom;
    lavaMaterial = nextMat;

    return () => {
      nextGeom.dispose();
      nextMat.dispose();
    };
  });

  // ============================================================================
  // Lava cracks — ground overlay shader
  // ============================================================================

  function createLavaCracksMaterial(
    crackColor: string,
    intensity: number,
    scale: number,
  ): ShaderMaterial {
    return new ShaderMaterial({
      transparent: true,
      blending: AdditiveBlending,
      side: DoubleSide,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uCrackColor: { value: new Color(crackColor) },
        uIntensity: { value: intensity },
        uScale: { value: scale },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uCrackColor;
        uniform float uIntensity;
        uniform float uScale;
        varying vec2 vUv;

        // Voronoi cell distance for crack pattern
        float hash21(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        vec2 hash22(vec2 p) {
          return fract(sin(vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3)))) * 43758.5453);
        }

        float voronoi(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          float minDist = 1.0;
          float secondDist = 1.0;
          for (int x = -1; x <= 1; x++) {
            for (int y = -1; y <= 1; y++) {
              vec2 neighbor = vec2(float(x), float(y));
              vec2 point = hash22(i + neighbor);
              point = 0.5 + 0.5 * sin(uTime * 0.3 + 6.283 * point);
              vec2 diff = neighbor + point - f;
              float d = length(diff);
              if (d < minDist) {
                secondDist = minDist;
                minDist = d;
              } else if (d < secondDist) {
                secondDist = d;
              }
            }
          }
          return secondDist - minDist;
        }

        void main() {
          vec2 scaledUv = (vUv - 0.5) * uScale * 6.0;

          float cracks = voronoi(scaledUv);
          // Thin bright cracks
          float crackLine = 1.0 - smoothstep(0.0, 0.08, cracks);

          // Glow around cracks
          float crackGlow = 1.0 - smoothstep(0.0, 0.25, cracks);

          float alpha = (crackLine * 0.9 + crackGlow * 0.25) * uIntensity;

          // Fade at edges
          float dist = length(vUv - 0.5) * 2.0;
          alpha *= 1.0 - smoothstep(0.6, 1.0, dist);

          gl_FragColor = vec4(uCrackColor * (crackLine * 1.5 + crackGlow * 0.5), alpha);
        }
      `,
    });
  }

  let cracksMaterial = $state<ShaderMaterial | null>(null);

  $effect(() => {
    const cracks = activeConfig.lavaCracks;
    if (!cracks.enabled) {
      cracksMaterial = null;
      return;
    }
    const nextCracks = createLavaCracksMaterial(
      cracks.crackColor,
      cracks.intensity,
      cracks.scale,
    );
    cracksMaterial = nextCracks;

    return () => {
      nextCracks.dispose();
    };
  });

  // Keep crack uniforms in sync with config
  $effect(() => {
    if (!cracksMaterial || !activeConfig.lavaCracks) return;
    cracksMaterial.uniforms.uCrackColor!.value = new Color(
      activeConfig.lavaCracks.crackColor,
    );
    cracksMaterial.uniforms.uIntensity!.value = activeConfig.lavaCracks.intensity;
    cracksMaterial.uniforms.uScale!.value = activeConfig.lavaCracks.scale;
  });

  // ============================================================================
  // Fire vent position
  // ============================================================================

  const firePosition = $derived.by(() => {
    const fv = activeConfig.fireVent;
    if (!fv) return new Vector3(0, groundY, 0);
    const fireHalfHeight = (fv.fireHeight * fv.fireScale) / 2;
    return new Vector3(fv.position.x, groundY + fireHalfHeight, fv.position.z);
  });

  // ============================================================================
  // Lava pool pulsing light state
  // ============================================================================

  let lavaLightIntensity = $state(0);

  // ============================================================================
  // Animation loop
  // ============================================================================

  useTask((delta) => {
    // Animate lava pool shader
    if (lavaMaterial) {
      lavaMaterial.uniforms.uTime!.value +=
        delta * activeConfig.lavaPool.flowSpeed * 10;
    }

    // Animate lava cracks shader
    if (cracksMaterial) {
      cracksMaterial.uniforms.uTime!.value +=
        delta * activeConfig.lavaCracks.speed * 10;
    }

    // Pulse lava pool light
    const pool = activeConfig.lavaPool;
    if (pool.enabled) {
      const t = performance.now() * 0.001 * pool.pulseSpeed;
      const pulse = 0.85 + 0.15 * Math.sin(t * Math.PI * 2);
      lavaLightIntensity = pool.lightIntensity * pulse;
    }
  });

  // ============================================================================
  // Fog
  // ============================================================================

  $effect(() => {
    if (!scene.current) return;
    const fog = activeConfig.fog;
    scene.current.fog = new FogExp2(new Color(fog.color), fog.density);
    return () => {
      if (scene.current) scene.current.fog = null;
    };
  });

  // ============================================================================
  // Loading progress
  // ============================================================================

  $effect(() => {
    if (!sceneFeatures) return;
    const glbs = [$rockA, $rockB, $logModel, $logSmall, $campfire];
    const loaded = glbs.filter(Boolean).length;
    sceneFeatures.reportProgress("environment", loaded / glbs.length);
    if (loaded === glbs.length) {
      sceneFeatures.reportReady("environment");
    }
  });

  onMount(() => {
    const timer = setTimeout(() => {
      if (sceneFeatures && !sceneFeatures.isReady("environment")) {
        console.warn("[EmberScene] GLB loading timed out — lifting curtain");
        sceneFeatures.reportReady("environment");
      }
    }, 15_000);
    return () => clearTimeout(timer);
  });
</script>

<!-- Smoky volcanic sky -->
<SkyGradient
  topColor={activeConfig.sky.topColor}
  midColor={activeConfig.sky.midColor}
  bottomColor={activeConfig.sky.bottomColor}
/>

<!-- Volcanic ground -->
<GroundPlane
  color={activeConfig.ground.color}
  size={activeConfig.ground.size}
  opacity={activeConfig.ground.opacity ?? 1}
/>

<!-- Lava cracks overlay on ground -->
{#if activeConfig.lavaCracks.enabled && cracksMaterial}
  <T.Mesh
    position.y={groundY + 0.02}
    rotation.x={-Math.PI / 2}
    material={cracksMaterial}
  >
    <T.PlaneGeometry args={[activeConfig.ground.size * 0.7, activeConfig.ground.size * 0.7]} />
  </T.Mesh>
{/if}

<!-- Lava pool with animated shader -->
{#if activeConfig.lavaPool.enabled && lavaMaterial && lavaGeometry}
  <T.Mesh
    position.x={activeConfig.lavaPool.position.x}
    position.y={groundY + 0.03}
    position.z={activeConfig.lavaPool.position.z}
    rotation.x={-Math.PI / 2}
    geometry={lavaGeometry}
    material={lavaMaterial}
  />
  <!-- Warm upward glow from lava pool -->
  <T.PointLight
    position.x={activeConfig.lavaPool.position.x}
    position.y={groundY + 0.5}
    position.z={activeConfig.lavaPool.position.z}
    color={activeConfig.lavaPool.hotColor}
    intensity={lavaLightIntensity}
    distance={activeConfig.lavaPool.lightDistance}
    decay={1.5}
  />
  <!-- Secondary fill from pool edge -->
  <T.PointLight
    position.x={activeConfig.lavaPool.position.x + 2}
    position.y={groundY + 0.3}
    position.z={activeConfig.lavaPool.position.z - 1}
    color={activeConfig.lavaPool.baseColor}
    intensity={lavaLightIntensity * 0.4}
    distance={activeConfig.lavaPool.lightDistance * 0.6}
    decay={2}
  />
  <!-- Rising embers above lava pool -->
  <T.Group
    position.x={activeConfig.lavaPool.position.x}
    position.y={groundY + 0.2}
    position.z={activeConfig.lavaPool.position.z}
  >
    <FallingParticles
      type="embers"
      count={60}
      area={{ width: activeConfig.lavaPool.radius * 1.5, height: 4, depth: activeConfig.lavaPool.radius * 1.5 }}
      speed={0.18}
      colors={["#ff6b35", "#ff8c42", "#ffc145", "#ff4500"]}
      sizeRange={[0.02, 0.05]}
      spin={false}
    />
  </T.Group>
{/if}

<!-- Fire vent with volumetric fire -->
{#if activeConfig.fireVent?.enabled && $campfire}
  {@const fv = activeConfig.fireVent}
  <T
    is={$campfire.scene.clone()}
    position.x={fv.position.x}
    position.y={groundY}
    position.z={fv.position.z}
    scale={fv.modelScale}
  />
  <VolumetricFireComponent
    position={firePosition}
    width={1.0}
    height={fv.fireHeight}
    depth={1.0}
    scale={fv.fireScale}
    sliceSpacing={0.15}
  />
  <T.PointLight
    position.x={fv.position.x}
    position.y={groundY + fv.primaryLight.heightOffset}
    position.z={fv.position.z}
    color={fv.primaryLight.color}
    intensity={fv.primaryLight.intensity}
    distance={fv.primaryLight.distance}
    decay={fv.primaryLight.decay}
  />
  <T.PointLight
    position.x={fv.position.x}
    position.y={groundY + fv.fillLight.heightOffset}
    position.z={fv.position.z}
    color={fv.fillLight.color}
    intensity={fv.fillLight.intensity}
    distance={fv.fillLight.distance}
    decay={fv.fillLight.decay}
  />
  <!-- Smoke rising from fire vent -->
  <T.Group
    position.x={fv.position.x}
    position.y={groundY + (fv.fireHeight * fv.fireScale) / 2 + 0.5}
    position.z={fv.position.z}
  >
    {#key fv.smokeCount}
      <FallingParticles
        type="smoke"
        count={fv.smokeCount}
        area={{ width: 1.5, height: 5, depth: 1.5 }}
        speed={0.04}
        colors={fv.smokeColors}
        sizeRange={[0.15, 0.45]}
        spin={false}
      />
    {/key}
  </T.Group>
{/if}

<!-- Volcanic rock formations -->
{#if $rockA && $rockB}
  {#each rockPlacements as [x, z, scale, rotY], i}
    {@const source = i % 2 === 0 ? $rockA : $rockB}
    <T
      is={volcanicClone(source.scene, activeConfig.rockTintColor, activeConfig.rockTintBlend)}
      position.x={x}
      position.y={groundY}
      position.z={z}
      scale={scale * 2.2}
      rotation.y={rotY}
    />
  {/each}
{/if}

<!-- Charred fallen logs -->
{#if $logModel && $logSmall}
  {#each logPlacements as [x, z, scale, rotY, isLarge]}
    {@const source = isLarge ? $logModel : $logSmall}
    <T
      is={volcanicClone(source.scene, "#0a0505", 0.6)}
      position.x={x}
      position.y={groundY}
      position.z={z}
      scale={scale * 0.5}
      rotation.y={rotY}
    />
  {/each}
{/if}

<!-- Rising embers — main field -->
{#key `${activeConfig.embers.count}|${activeConfig.embers.sizeRange[0]}|${activeConfig.embers.sizeRange[1]}|${activeConfig.embers.area.width}|${activeConfig.embers.speed}`}
  <FallingParticles
    type={activeConfig.embers.type}
    count={activeConfig.embers.count}
    area={activeConfig.embers.area}
    speed={activeConfig.embers.speed}
    colors={activeConfig.embers.colors}
    sizeRange={activeConfig.embers.sizeRange}
    spin={activeConfig.embers.spin ?? false}
  />
{/key}

<!-- Falling ash -->
{#if activeConfig.ash}
  {#key `ash|${activeConfig.ash.count}|${activeConfig.ash.sizeRange[0]}|${activeConfig.ash.area.width}|${activeConfig.ash.speed}`}
    <FallingParticles
      type={activeConfig.ash.type}
      count={activeConfig.ash.count}
      area={activeConfig.ash.area}
      speed={activeConfig.ash.speed}
      colors={activeConfig.ash.colors}
      sizeRange={activeConfig.ash.sizeRange}
      spin={activeConfig.ash.spin ?? false}
    />
  {/key}
{/if}

<!-- Ambient smoke layer -->
{#if activeConfig.smoke}
  {#key `smoke|${activeConfig.smoke.count}|${activeConfig.smoke.sizeRange[0]}|${activeConfig.smoke.area.width}`}
    <FallingParticles
      type={activeConfig.smoke.type}
      count={activeConfig.smoke.count}
      area={activeConfig.smoke.area}
      speed={activeConfig.smoke.speed}
      colors={activeConfig.smoke.colors}
      sizeRange={activeConfig.smoke.sizeRange}
      spin={activeConfig.smoke.spin ?? false}
    />
  {/key}
{/if}

<!-- Floating glowing cinders -->
{#if activeConfig.cinders}
  {#key `cinders|${activeConfig.cinders.count}|${activeConfig.cinders.sizeRange[0]}|${activeConfig.cinders.area.width}`}
    <FallingParticles
      type={activeConfig.cinders.type}
      count={activeConfig.cinders.count}
      area={activeConfig.cinders.area}
      speed={activeConfig.cinders.speed}
      colors={activeConfig.cinders.colors}
      sizeRange={activeConfig.cinders.sizeRange}
      spin={activeConfig.cinders.spin ?? false}
    />
  {/key}
{/if}

<!-- Obsidian crystal pillars -->
{#if activeConfig.obsidianPillars.enabled}
  <ObsidianPillars config={activeConfig.obsidianPillars} />
{/if}

<!-- Drifting fire wisps with dynamic lighting -->
{#if activeConfig.fireWisps?.enabled}
  <FireWisps config={activeConfig.fireWisps} />
{/if}

<!-- Volcanic ember fountain eruptions -->
{#if activeConfig.emberFountains?.enabled}
  <EmberFountains config={activeConfig.emberFountains} />
{/if}

<!-- Atmospheric volcanic haze dome -->
{#if activeConfig.volcanicHaze?.enabled}
  <VolcanicHaze config={activeConfig.volcanicHaze} />
{/if}

<!-- Hemisphere ambient -->
<T.HemisphereLight
  color={activeConfig.hemisphereLight.skyColor}
  groundColor={activeConfig.hemisphereLight.groundColor}
  intensity={activeConfig.hemisphereLight.intensity}
/>

<!-- Directional volcanic sky light -->
{#if activeConfig.skyLight?.enabled}
  {@const sl = activeConfig.skyLight}
  <T.DirectionalLight
    color={sl.color}
    intensity={sl.intensity}
    position.x={sl.position[0]}
    position.y={sl.position[1]}
    position.z={sl.position[2]}
  />
{/if}
