<script lang="ts">
  import { T, useThrelte, useTask } from "@threlte/core";
  import { useGltf } from "@threlte/extras";
  import TexturedGroundPlane from "../primitives/TexturedGroundPlane.svelte";
  import GroundPlane from "../primitives/GroundPlane.svelte";
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import FallingParticles from "../primitives/FallingParticles.svelte";
  import type { OceanVariant } from "../domain/enums/environment-enums";
  import {
    type OceanSceneConfig,
    createDefaultOceanDeepConfig,
    createDefaultOceanReefConfig,
  } from "../domain/models/scene-configs";
  import { onMount } from "svelte";
  import { userProportionsState } from "../../state/user-proportions-state.svelte";
  import {
    FogExp2,
    Color,
    ShaderMaterial,
    AdditiveBlending,
    DoubleSide,
    Group,
    Mesh,
    IcosahedronGeometry,
    ConeGeometry,
    CylinderGeometry,
    DodecahedronGeometry,
    PlaneGeometry,
    SphereGeometry,
    MeshStandardMaterial,
    MeshPhysicalMaterial,
    InstancedMesh,
    Object3D,
  } from "three";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";

  interface Props {
    variant?: OceanVariant;
    config?: OceanSceneConfig;
  }

  let { variant = "deep", config }: Props = $props();

  const activeConfig = $derived(
    config ??
      (variant === "reef"
        ? createDefaultOceanReefConfig()
        : createDefaultOceanDeepConfig())
  );

  const R2_CDN = "https://pub-f5505ed75927471cb198c54336317370.r2.dev";

  // Keep rock GLBs (they exist on R2)
  const rockA = useGltf(`${R2_CDN}/models/forest/Rock_1_A_Color1.gltf`);
  const rockB = useGltf(`${R2_CDN}/models/forest/Rock_1_B_Color1.gltf`);

  const { scene } = useThrelte();

  let sceneFeatures = $state<ReturnType<typeof getSceneFeatureContext> | null>(null);
  try {
    sceneFeatures = getSceneFeatureContext();
  } catch {
    // May render outside scene feature system
  }

  const groundY = $derived(userProportionsState.groundY);

  // ============================================================================
  // Procedural geometry factory functions
  // ============================================================================

  function createBrainCoral(color: string, emissiveColor: string): Group {
    const group = new Group();
    const mainGeo = new IcosahedronGeometry(0.35, 2);
    const mat = new MeshStandardMaterial({
      color: new Color(color),
      roughness: 0.85,
      emissive: new Color(emissiveColor),
      emissiveIntensity: 0.15,
    });
    const main = new Mesh(mainGeo, mat);
    group.add(main);

    // Lumpy cluster — 2 smaller offset icosahedrons
    const bumpGeo = new IcosahedronGeometry(0.22, 2);
    const bump1 = new Mesh(bumpGeo, mat);
    bump1.position.set(0.2, 0.08, 0.15);
    bump1.scale.setScalar(0.8);
    group.add(bump1);

    const bump2 = new Mesh(bumpGeo, mat);
    bump2.position.set(-0.15, 0.05, -0.2);
    bump2.scale.setScalar(0.65);
    group.add(bump2);

    const bump3 = new Mesh(bumpGeo, mat);
    bump3.position.set(0.05, 0.18, -0.1);
    bump3.scale.setScalar(0.55);
    group.add(bump3);

    return group;
  }

  function createFanCoral(color: string): Group {
    const group = new Group();
    const geo = new PlaneGeometry(0.6, 0.8, 1, 4);
    const mat = new MeshStandardMaterial({
      color: new Color(color),
      roughness: 0.7,
      transparent: true,
      opacity: 0.85,
      side: DoubleSide,
    });
    const fan = new Mesh(geo, mat);
    fan.position.y = 0.4; // lift so base sits at origin
    group.add(fan);
    return group;
  }

  function createTubeCoral(color: string): Group {
    const group = new Group();
    const tubeCount = 5;
    for (let i = 0; i < tubeCount; i++) {
      const height = 0.3 + Math.random() * 0.3;
      const geo = new CylinderGeometry(0.04, 0.03, height, 6);
      const mat = new MeshStandardMaterial({
        color: new Color(color),
        roughness: 0.75,
        emissive: new Color(color),
        emissiveIntensity: 0.1,
      });
      const tube = new Mesh(geo, mat);
      const angle = (i / tubeCount) * Math.PI * 2;
      const radius = 0.06 + Math.random() * 0.06;
      tube.position.set(
        Math.cos(angle) * radius,
        height / 2,
        Math.sin(angle) * radius,
      );
      // Slight tilt outward
      tube.rotation.x = (Math.random() - 0.5) * 0.3;
      tube.rotation.z = (Math.random() - 0.5) * 0.3;
      group.add(tube);
    }
    return group;
  }

  function createKelpStrand(height: number, color: string): Mesh {
    const geo = new PlaneGeometry(0.15, height, 1, 8);
    const mat = new MeshStandardMaterial({
      color: new Color(color),
      roughness: 0.6,
      transparent: true,
      opacity: 0.75,
      side: DoubleSide,
    });
    const mesh = new Mesh(geo, mat);
    mesh.position.y = height / 2; // anchor base at origin
    return mesh;
  }

  function createProceduralRock(scale: number, color: string): Mesh {
    const geo = new DodecahedronGeometry(0.5, 1);
    const mat = new MeshStandardMaterial({
      color: new Color(color),
      roughness: 0.9,
    });
    const mesh = new Mesh(geo, mat);
    mesh.scale.setScalar(scale);
    return mesh;
  }

  function createProceduralJellyfish(bellColor: string, tentacleColor: string): Group {
    const group = new Group();

    // Bell — slightly more than a hemisphere
    const bellGeo = new SphereGeometry(0.25, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const bellMat = new MeshPhysicalMaterial({
      color: new Color(bellColor),
      roughness: 0.1,
      transmission: 0.4,
      transparent: true,
      opacity: 0.7,
      emissive: new Color(bellColor),
      emissiveIntensity: 0.3,
      side: DoubleSide,
    });
    const bell = new Mesh(bellGeo, bellMat);
    group.add(bell);

    // Tentacles
    const tentacleCount = 6;
    const tentacleMat = new MeshStandardMaterial({
      color: new Color(tentacleColor),
      transparent: true,
      opacity: 0.5,
      emissive: new Color(tentacleColor),
      emissiveIntensity: 0.2,
    });
    for (let i = 0; i < tentacleCount; i++) {
      const angle = (i / tentacleCount) * Math.PI * 2;
      const radius = 0.1 + Math.random() * 0.06;
      const tentGeo = new CylinderGeometry(0.008, 0.003, 0.5, 4);
      const tentacle = new Mesh(tentGeo, tentacleMat);
      tentacle.position.set(
        Math.cos(angle) * radius,
        -0.28,
        Math.sin(angle) * radius,
      );
      // Slight splay outward
      tentacle.rotation.x = (Math.cos(angle)) * 0.15;
      tentacle.rotation.z = (Math.sin(angle)) * 0.15;
      group.add(tentacle);
    }

    return group;
  }

  // ============================================================================
  // Procedural instance arrays (reactive from config)
  // ============================================================================

  interface PlacedMesh {
    mesh: Group | Mesh;
    x: number;
    z: number;
    scale: number;
    rotY: number;
  }

  const CORAL_COLORS = [
    { color: "#e06060", emissive: "#ff8888" },  // brain coral — warm red
    { color: "#f0a050", emissive: "#ffcc88" },  // fan coral — orange
    { color: "#d070d0", emissive: "#ff99ff" },  // tube coral — purple
    { color: "#50c0a0", emissive: "#88ffcc" },  // brain coral — teal
    { color: "#e0e060", emissive: "#ffff88" },  // fan coral — yellow
    { color: "#6080e0", emissive: "#88aaff" },  // tube coral — blue
  ];

  const coralInstances = $derived.by(() => {
    if (!activeConfig.coral.enabled) return [];
    const { count, clearingRadius } = activeConfig.coral;
    const result: PlacedMesh[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + 0.3;
      const radius = clearingRadius - 1.5 + Math.sin(i * 3.7) * 1.5;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const scale = 0.6 + Math.abs(Math.sin(i * 2.3) * 0.4);
      const rotY = Math.sin(i * 1.7) * Math.PI;
      const palette = CORAL_COLORS[i % CORAL_COLORS.length]!;
      const kind = i % 3;
      let mesh: Group;
      if (kind === 0) {
        mesh = createBrainCoral(palette.color, palette.emissive);
      } else if (kind === 1) {
        mesh = createFanCoral(palette.color);
      } else {
        mesh = createTubeCoral(palette.color);
      }
      result.push({ mesh, x, z, scale, rotY });
    }
    return result;
  });

  const KELP_COLORS = ["#1a5a2a", "#0d4a1a", "#2a6a3a", "#0a3a14"];

  const kelpInstances = $derived.by(() => {
    if (!activeConfig.kelp.enabled) return [];
    const result: PlacedMesh[] = [];
    activeConfig.kelp.rings.forEach((ring, ringIndex) => {
      for (let i = 0; i < ring.count; i++) {
        const angleOffset = ringIndex * 0.4;
        const angle = (i / ring.count) * Math.PI * 2 + angleOffset;
        const seed = ringIndex * 100 + i;
        const radiusVariation = ring.radius + Math.sin(seed * 3.7) * ring.radiusJitter;
        const x = Math.cos(angle) * radiusVariation;
        const z = Math.sin(angle) * radiusVariation;
        const scale = ring.scaleBase + Math.abs(Math.sin(seed * 2.3) * ring.scaleVariation);
        const rotY = angle + Math.PI + Math.sin(seed * 1.7) * 0.3;
        const height = 1.5 + Math.abs(Math.sin(seed * 4.1)) * 2.0;
        const color = KELP_COLORS[seed % KELP_COLORS.length]!;
        const mesh = createKelpStrand(height, color);
        result.push({ mesh, x, z, scale, rotY });
      }
    });
    return result;
  });

  const proceduralRockInstances = $derived.by(() => {
    const count = activeConfig.rockCount;
    const clearingRadius = activeConfig.kelp.clearingRadius;
    const result: PlacedMesh[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + 0.2;
      const radius = clearingRadius - 2.0 + Math.sin(i * 4.1) * 1.0;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const scale = 0.3 + Math.abs(Math.sin(i * 3.2) * 0.25);
      const rotY = Math.sin(i * 2.8) * Math.PI;
      const mesh = createProceduralRock(1.0, activeConfig.rockTintColor);
      result.push({ mesh, x, z, scale, rotY });
    }
    return result;
  });

  // Keep the original rock placements for the GLB path
  const rockPlacements = $derived.by(() => {
    const count = activeConfig.rockCount;
    const clearingRadius = activeConfig.kelp.clearingRadius;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + 0.2;
      const radius = clearingRadius - 2.0 + Math.sin(i * 4.1) * 1.0;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const scale = 0.3 + Math.abs(Math.sin(i * 3.2) * 0.25);
      const rotation = Math.sin(i * 2.8) * Math.PI;
      return [x, z, scale, rotation] as [number, number, number, number];
    });
  });

  interface JellyfishInstance {
    mesh: Group;
    x: number;
    y: number;
    z: number;
    seed: number;
  }

  const jellyfishInstances = $derived.by((): JellyfishInstance[] => {
    const jf = activeConfig.jellyfish;
    if (!jf?.enabled) return [];
    return Array.from({ length: jf.count }, (_, i) => {
      const angle = (i / jf.count) * Math.PI * 2 + 0.5;
      const radius = jf.spawnRadius * (0.5 + Math.sin(i * 2.7) * 0.3);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = jf.heightRange[0] + (jf.heightRange[1] - jf.heightRange[0]) * ((i + 0.5) / jf.count);
      const mesh = createProceduralJellyfish(jf.glowColor, jf.glowColor);
      return { mesh, x, y, z, seed: i * 37 };
    });
  });

  // ============================================================================
  // Schooling fish (InstancedMesh)
  // ============================================================================

  interface FishInstance {
    angle: number;
    radius: number;
    height: number;
    speed: number;
    phase: number;
  }

  const FISH_COUNT = 40;

  const fishData = $derived.by((): FishInstance[] => {
    return Array.from({ length: FISH_COUNT }, (_, i) => ({
      angle: (i / FISH_COUNT) * Math.PI * 2,
      radius: 4 + Math.random() * 8,
      height: 1.5 + Math.random() * 4,
      speed: 0.3 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
    }));
  });

  const fishGeometry = new ConeGeometry(0.04, 0.12, 4);
  fishGeometry.rotateX(Math.PI / 2); // point forward along +Z
  const fishMaterial = new MeshStandardMaterial({
    color: new Color("#8899bb"),
    emissive: new Color("#334466"),
    emissiveIntensity: 0.2,
    roughness: 0.5,
  });

  let fishMesh: InstancedMesh | null = null;
  const fishTempObj = new Object3D();

  function handleFishMeshCreated(mesh: InstancedMesh) {
    fishMesh = mesh;
  }

  // ============================================================================
  // Underwater tint (for GLB rocks)
  // ============================================================================

  function tintUnderwater(root: { traverse: (cb: (obj: unknown) => void) => void }, color: string, blend: number) {
    const tintColor = new Color(color);
    root.traverse((obj) => {
      const m = obj as { isMesh?: boolean; material?: unknown };
      if (!m.isMesh || !m.material) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const cloned = mats.map((mat) => {
        const clone = (mat as import("three").MeshStandardMaterial).clone();
        if (clone.color) clone.color.lerp(tintColor, blend);
        if (clone.emissive) clone.emissive.lerp(tintColor, blend * 0.5);
        return clone;
      });
      (m as { material: unknown }).material = Array.isArray(m.material)
        ? cloned
        : cloned[0];
    });
  }

  function underwaterClone(
    sourceScene: { clone: () => { traverse: (cb: (obj: unknown) => void) => void } },
    color: string,
    blend: number,
  ) {
    const cloned = sourceScene.clone();
    tintUnderwater(cloned, color, blend);
    return cloned;
  }

  // ============================================================================
  // Caustic shader
  // ============================================================================

  function createCausticMaterial(color: string, intensity: number, _speed: number, scale: number): ShaderMaterial {
    return new ShaderMaterial({
      transparent: true,
      blending: AdditiveBlending,
      side: DoubleSide,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new Color(color) },
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
        uniform vec3 uColor;
        uniform float uIntensity;
        uniform float uScale;
        varying vec2 vUv;

        float causticLayer(vec2 p, float t) {
          float a = sin(p.x * 3.0 + t * 0.7) * sin(p.y * 2.5 + t * 0.5);
          float b = sin(p.x * 2.0 - t * 0.6) * sin(p.y * 3.5 - t * 0.4);
          float c = sin((p.x + p.y) * 2.8 + t * 0.8);
          return (a + b + c) / 3.0;
        }

        void main() {
          vec2 scaledUv = (vUv - 0.5) * uScale;
          float c1 = causticLayer(scaledUv, uTime);
          float c2 = causticLayer(scaledUv * 1.3 + 0.5, uTime * 1.2);
          float pattern = smoothstep(0.0, 0.8, (c1 + c2) * 0.5 + 0.5);
          float alpha = pattern * uIntensity;
          gl_FragColor = vec4(uColor * alpha, alpha);
        }
      `,
    });
  }

  let causticMaterial = $state<ShaderMaterial | null>(null);

  $effect(() => {
    const c = activeConfig.caustics;
    if (!c?.enabled) {
      causticMaterial = null;
      return;
    }
    causticMaterial = createCausticMaterial(c.color, c.intensity, c.speed, c.scale);
  });

  $effect(() => {
    if (!causticMaterial || !activeConfig.caustics) return;
    causticMaterial.uniforms.uColor!.value = new Color(activeConfig.caustics.color);
    causticMaterial.uniforms.uIntensity!.value = activeConfig.caustics.intensity;
    causticMaterial.uniforms.uScale!.value = activeConfig.caustics.scale;
  });

  // ============================================================================
  // Jellyfish animation (drift + pulse)
  // ============================================================================

  let jellyfishOffsets = $state<{ dx: number; dy: number; dz: number }[]>([]);

  $effect(() => {
    const jf = activeConfig.jellyfish;
    if (!jf?.enabled) {
      jellyfishOffsets = [];
      return;
    }
    jellyfishOffsets = Array.from({ length: jf.count }, () => ({ dx: 0, dy: 0, dz: 0 }));
  });

  let jellyfishTime = $state(0);
  let fishTime = 0;

  // ============================================================================
  // Main animation loop
  // ============================================================================

  useTask((delta) => {
    // Animate caustic uniforms
    if (causticMaterial) {
      causticMaterial.uniforms.uTime!.value += delta * (activeConfig.caustics?.speed ?? 0.02) * 10;
    }

    // Animate jellyfish drift
    const jf = activeConfig.jellyfish;
    if (jf?.enabled && jellyfishOffsets.length > 0) {
      jellyfishTime += delta * jf.driftSpeed;
      for (let i = 0; i < jellyfishOffsets.length; i++) {
        const phase = i * 2.3;
        jellyfishOffsets[i] = {
          dx: Math.sin(jellyfishTime * 0.7 + phase) * 1.5,
          dy: Math.sin(jellyfishTime * 0.4 + phase * 1.3) * 0.5,
          dz: Math.cos(jellyfishTime * 0.5 + phase * 0.8) * 1.5,
        };
      }
    }

    // Animate schooling fish
    fishTime += delta;
    if (fishMesh && fishData.length > 0) {
      for (let i = 0; i < fishData.length; i++) {
        const fish = fishData[i]!;
        fish.angle += fish.speed * delta;

        const px = Math.cos(fish.angle) * fish.radius;
        const py = groundY + fish.height + Math.sin(fishTime + fish.phase) * 0.3;
        const pz = Math.sin(fish.angle) * fish.radius;

        fishTempObj.position.set(px, py, pz);

        // Face tangent direction (perpendicular to radius)
        const tangentAngle = fish.angle + Math.PI / 2;
        fishTempObj.rotation.set(0, tangentAngle, 0);

        fishTempObj.updateMatrix();
        fishMesh.setMatrixAt(i, fishTempObj.matrix);
      }
      fishMesh.instanceMatrix.needsUpdate = true;
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
  // Loading progress — no longer depends on ocean GLBs, report ready immediately
  // ============================================================================

  $effect(() => {
    if (!sceneFeatures) return;
    // Only rock GLBs are external dependencies now. Report progress based on them,
    // but don't block readiness — procedural fallback covers the case.
    sceneFeatures.reportProgress("environment", 1);
    sceneFeatures.reportReady("environment");
  });

  onMount(() => {
    // Fallback in case the effect above doesn't fire (e.g. no sceneFeatures)
    const timer = setTimeout(() => {
      if (sceneFeatures && !sceneFeatures.isReady("environment")) {
        console.warn("[OceanScene] Lifting curtain via timeout");
        sceneFeatures.reportReady("environment");
      }
    }, 3_000);
    return () => clearTimeout(timer);
  });
</script>

<!-- Sky gradient -->
<SkyGradient
  topColor={activeConfig.sky.topColor}
  midColor={activeConfig.sky.midColor}
  bottomColor={activeConfig.sky.bottomColor}
/>

<!-- Ocean floor -->
{#if activeConfig.ground.textured && activeConfig.ground.diffuseMap}
  <TexturedGroundPlane
    color={activeConfig.ground.color}
    size={activeConfig.ground.size}
    diffuseMap={activeConfig.ground.diffuseMap}
    normalMap={activeConfig.ground.normalMap}
    roughnessMap={activeConfig.ground.roughnessMap}
    normalScale={activeConfig.ground.normalScale ?? 1.0}
    textureRepeat={activeConfig.ground.textureRepeat ?? 8}
  />
{:else}
  <GroundPlane
    color={activeConfig.ground.color}
    size={activeConfig.ground.size}
    opacity={activeConfig.ground.opacity ?? 1}
  />
{/if}

<!-- Caustic light ripples -->
{#if activeConfig.caustics?.enabled && causticMaterial}
  <T.Mesh
    position.y={groundY + 0.02}
    rotation.x={-Math.PI / 2}
    material={causticMaterial}
  >
    <T.PlaneGeometry args={[activeConfig.ground.size * 0.8, activeConfig.ground.size * 0.8]} />
  </T.Mesh>
{/if}

<!-- Procedural coral formations -->
{#if activeConfig.coral.enabled}
  {#each coralInstances as coral}
    <T
      is={coral.mesh}
      position.x={coral.x}
      position.y={groundY}
      position.z={coral.z}
      scale={coral.scale}
      rotation.y={coral.rotY}
    />
  {/each}
{/if}

<!-- Kelp forest -->
{#if activeConfig.kelp.enabled}
  {#each kelpInstances as kelp}
    <T
      is={kelp.mesh}
      position.x={kelp.x}
      position.y={groundY}
      position.z={kelp.z}
      scale={kelp.scale}
      rotation.y={kelp.rotY}
    />
  {/each}
{/if}

<!-- Seabed rocks — GLB with procedural fallback -->
{#if $rockA && $rockB}
  {#each rockPlacements as [x, z, scale, rotY], i}
    {@const source = i % 2 === 0 ? $rockA : $rockB}
    <T
      is={underwaterClone(source.scene, activeConfig.rockTintColor, activeConfig.rockTintBlend)}
      position.x={x}
      position.y={groundY}
      position.z={z}
      {scale}
      rotation.y={rotY}
    />
  {/each}
{:else}
  {#each proceduralRockInstances as rock}
    <T
      is={rock.mesh}
      position.x={rock.x}
      position.y={groundY}
      position.z={rock.z}
      scale={rock.scale}
      rotation.y={rock.rotY}
    />
  {/each}
{/if}

<!-- Schooling fish -->
<T.InstancedMesh
  args={[fishGeometry, fishMaterial, FISH_COUNT]}
  frustumCulled={false}
  oncreate={handleFishMeshCreated}
/>

<!-- Jellyfish with animated drift + pulsing glow -->
{#if activeConfig.jellyfish?.enabled}
  {#each jellyfishInstances as jf, i}
    {@const offset = jellyfishOffsets[i] ?? { dx: 0, dy: 0, dz: 0 }}
    <T.Group
      position.x={jf.x + offset.dx}
      position.y={groundY + jf.y + offset.dy}
      position.z={jf.z + offset.dz}
    >
      <T is={jf.mesh} scale={0.5} />
      <T.PointLight
        color={activeConfig.jellyfish.glowColor}
        intensity={activeConfig.jellyfish.lightIntensity * (0.7 + 0.3 * Math.sin(jellyfishTime * activeConfig.jellyfish.pulseRate * Math.PI * 2 + i * 1.7))}
        distance={activeConfig.jellyfish.lightDistance}
        decay={2}
      />
    </T.Group>
  {/each}
{/if}

<!-- Bubbles -->
{#key `bubbles|${activeConfig.bubbles.count}|${activeConfig.bubbles.sizeRange[0]}|${activeConfig.bubbles.area.width}|${activeConfig.bubbles.speed}`}
  <FallingParticles
    type={activeConfig.bubbles.type}
    count={activeConfig.bubbles.count}
    area={activeConfig.bubbles.area}
    speed={activeConfig.bubbles.speed}
    colors={activeConfig.bubbles.colors}
    sizeRange={activeConfig.bubbles.sizeRange}
    spin={activeConfig.bubbles.spin}
  />
{/key}

<!-- Dust motes -->
{#if activeConfig.dust}
  {#key `dust|${activeConfig.dust.count}|${activeConfig.dust.sizeRange[0]}|${activeConfig.dust.area.width}|${activeConfig.dust.speed}`}
    <FallingParticles
      type={activeConfig.dust.type}
      count={activeConfig.dust.count}
      area={activeConfig.dust.area}
      speed={activeConfig.dust.speed}
      colors={activeConfig.dust.colors}
      sizeRange={activeConfig.dust.sizeRange}
      spin={activeConfig.dust.spin}
    />
  {/key}
{/if}

<!-- Bioluminescent plankton -->
{#if activeConfig.plankton}
  {#key `plankton|${activeConfig.plankton.count}|${activeConfig.plankton.sizeRange[0]}|${activeConfig.plankton.area.width}`}
    <FallingParticles
      type={activeConfig.plankton.type}
      count={activeConfig.plankton.count}
      area={activeConfig.plankton.area}
      speed={activeConfig.plankton.speed}
      colors={activeConfig.plankton.colors}
      sizeRange={activeConfig.plankton.sizeRange}
      spin={activeConfig.plankton.spin}
    />
  {/key}
{/if}

<!-- God rays (directional light from above) -->
{#if activeConfig.godRays?.enabled}
  <T.DirectionalLight
    color={activeConfig.godRays.color}
    intensity={activeConfig.godRays.intensity}
    position.x={activeConfig.godRays.position[0]}
    position.y={activeConfig.godRays.position[1]}
    position.z={activeConfig.godRays.position[2]}
  />
{/if}

<!-- Hemisphere ambient -->
<T.HemisphereLight
  color={activeConfig.hemisphereLight.skyColor}
  groundColor={activeConfig.hemisphereLight.groundColor}
  intensity={activeConfig.hemisphereLight.intensity}
/>
