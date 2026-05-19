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
  import { userProportionsState } from "@austencloud/scene-3d";
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
    Vector3,
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

  // ============================================================================
  // Local ocean GLB models (served from public/models/ocean/)
  // ============================================================================

  // Fish GLBs (3 varieties for visual diversity)
  const fishClown = useGltf("/models/ocean/fish_clownfish.glb");
  const fishButterfly = useGltf("/models/ocean/fish_butterfly.glb");
  const fishCommon = useGltf("/models/ocean/fish_common.glb");

  // Coral GLBs (4 varieties)
  const coralGlb0 = useGltf("/models/ocean/coral_0.glb");
  const coralGlb1 = useGltf("/models/ocean/coral_1.glb");
  const coralGlb2 = useGltf("/models/ocean/coral_2.glb");
  const coralGlb3 = useGltf("/models/ocean/coral_3.glb");

  // Kelp / seaweed
  const seaweedGlb = useGltf("/models/ocean/seaweed.glb");

  // Jellyfish
  const jellyfishGlb = useGltf("/models/ocean/jellyfish.glb");

  // Decorations
  const starfishGlb = useGltf("/models/ocean/starfish.glb");
  const seaUrchinGlb = useGltf("/models/ocean/sea_urchin.glb");
  const shellGlb = useGltf("/models/ocean/shell.glb");
  const anemoneGlb = useGltf("/models/ocean/anemone.glb");

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

  const CORAL_GLB_NORMALIZE = [
    0.5 / 821,
    0.5 / 3995,
    0.5 / 2597,
    0.5 / 4769,
  ];

  const CORAL_COLORS = [
    { color: "#e06060", emissive: "#ff8888" },
    { color: "#f0a050", emissive: "#ffcc88" },
    { color: "#d070d0", emissive: "#ff99ff" },
    { color: "#50c0a0", emissive: "#88ffcc" },
    { color: "#e0e060", emissive: "#ffff88" },
    { color: "#6080e0", emissive: "#88aaff" },
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
  // Placement arrays (position/scale/rotation data for GLB models)
  // ============================================================================

  interface Placement {
    x: number;
    z: number;
    scale: number;
    rotY: number;
  }

  const coralPlacements = $derived.by((): Placement[] => {
    if (!activeConfig.coral.enabled) return [];
    const { count, clearingRadius } = activeConfig.coral;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + 0.3;
      const radius = clearingRadius - 1.5 + Math.sin(i * 3.7) * 1.5;
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        scale: 0.6 + Math.abs(Math.sin(i * 2.3) * 0.4),
        rotY: Math.sin(i * 1.7) * Math.PI,
      };
    });
  });

  const kelpPlacements = $derived.by((): Placement[] => {
    if (!activeConfig.kelp.enabled) return [];
    const result: Placement[] = [];
    activeConfig.kelp.rings.forEach((ring, ringIndex) => {
      for (let i = 0; i < ring.count; i++) {
        const angleOffset = ringIndex * 0.4;
        const angle = (i / ring.count) * Math.PI * 2 + angleOffset;
        const seed = ringIndex * 100 + i;
        const radiusVariation = ring.radius + Math.sin(seed * 3.7) * ring.radiusJitter;
        result.push({
          x: Math.cos(angle) * radiusVariation,
          z: Math.sin(angle) * radiusVariation,
          scale: ring.scaleBase + Math.abs(Math.sin(seed * 2.3) * ring.scaleVariation),
          rotY: angle + Math.PI + Math.sin(seed * 1.7) * 0.3,
        });
      }
    });
    return result;
  });

  interface JellyfishPlacement {
    x: number;
    y: number;
    z: number;
    seed: number;
  }

  const jellyfishPlacements = $derived.by((): JellyfishPlacement[] => {
    const jf = activeConfig.jellyfish;
    if (!jf?.enabled) return [];
    return Array.from({ length: jf.count }, (_, i) => {
      const angle = (i / jf.count) * Math.PI * 2 + 0.5;
      const radius = jf.spawnRadius * (0.5 + Math.sin(i * 2.7) * 0.3);
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        y: jf.heightRange[0] + (jf.heightRange[1] - jf.heightRange[0]) * ((i + 0.5) / jf.count),
        seed: i * 37,
      };
    });
  });

  interface DecorationPlacement {
    x: number;
    z: number;
    scale: number;
    rotY: number;
    type: "starfish" | "urchin" | "shell" | "anemone";
  }

  const decorationPlacements = $derived.by((): DecorationPlacement[] => {
    const clearingRadius = activeConfig.coral.clearingRadius;
    const count = 12;
    const types: DecorationPlacement["type"][] = ["starfish", "urchin", "shell", "anemone"];
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + 1.1;
      const radius = clearingRadius - 3 + Math.sin(i * 5.3) * 2;
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        scale: 0.2 + Math.abs(Math.sin(i * 3.1) * 0.15),
        rotY: Math.sin(i * 2.1) * Math.PI,
        type: types[i % types.length]!,
      };
    });
  });

  // ============================================================================
  // Schooling fish (InstancedMesh fallback + GLB fish state)
  // ============================================================================

  interface FishInstance {
    angle: number;
    radius: number;
    height: number;
    speed: number;
    phase: number;
  }

  const GLB_FISH_COUNT = 15;
  const FISH_COUNT = 40;

  const fishData = $derived.by((): FishInstance[] => {
    // Use fewer fish when GLBs are loaded (heavier meshes)
    const count = ($fishClown && $fishButterfly && $fishCommon) ? GLB_FISH_COUNT : FISH_COUNT;
    return Array.from({ length: count }, (_, i) => ({
      angle: (i / count) * Math.PI * 2,
      radius: 8 + Math.random() * 6,
      height: 2.5 + Math.random() * 3,
      speed: 0.3 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
    }));
  });

  interface FishState {
    x: number;
    y: number;
    z: number;
    rotY: number;
    variety: number;
  }

  let fishStates = $state<FishState[]>([]);

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
    const useGlbFish = $fishClown && $fishButterfly && $fishCommon;
    if (useGlbFish) {
      // GLB fish: update reactive state array
      const next: FishState[] = [];
      for (let i = 0; i < fishData.length; i++) {
        const fish = fishData[i]!;
        fish.angle += fish.speed * delta;
        const px = Math.cos(fish.angle) * fish.radius;
        const py = groundY + fish.height + Math.sin(fishTime + fish.phase) * 0.3;
        const pz = Math.sin(fish.angle) * fish.radius;
        const tangentAngle = fish.angle + Math.PI / 2;
        next.push({ x: px, y: py, z: pz, rotY: tangentAngle, variety: i % 3 });
      }
      fishStates = next;
    } else if (fishMesh && fishData.length > 0) {
      // InstancedMesh fallback
      for (let i = 0; i < fishData.length; i++) {
        const fish = fishData[i]!;
        fish.angle += fish.speed * delta;

        const px = Math.cos(fish.angle) * fish.radius;
        const py = groundY + fish.height + Math.sin(fishTime + fish.phase) * 0.3;
        const pz = Math.sin(fish.angle) * fish.radius;

        fishTempObj.position.set(px, py, pz);
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

    // DEBUG: log all meshes > 1 unit — remove after diagnosis
    const s = scene.current;
    s.traverse((obj: Object3D) => {
      const m = obj as Mesh;
      if (!m.isMesh || !m.geometry) return;
      m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox;
      if (!bb) return;
      const ws = m.getWorldScale(new Vector3());
      const sz = new Vector3();
      bb.getSize(sz);
      sz.multiply(ws);
      const maxDim = Math.max(sz.x, sz.y, sz.z);
      if (maxDim > 1) {
        const wp = m.getWorldPosition(new Vector3());
        console.warn(`[OceanDebug] BIG MESH: "${m.name || m.parent?.name || '?'}" maxDim=${maxDim.toFixed(2)} size=[${sz.x.toFixed(2)},${sz.y.toFixed(2)},${sz.z.toFixed(2)}] pos=[${wp.x.toFixed(1)},${wp.y.toFixed(1)},${wp.z.toFixed(1)}] ws=[${ws.x.toFixed(4)},${ws.y.toFixed(4)},${ws.z.toFixed(4)}]`);
      }
    });

    const fog = activeConfig.fog;
    scene.current.fog = new FogExp2(new Color(fog.color), fog.density);
    return () => {
      if (scene.current) scene.current.fog = null;
    };
  });

  // ============================================================================
  // Loading progress — track local GLB loading, report ready when all loaded
  // ============================================================================

  $effect(() => {
    if (!sceneFeatures) return;
    const glbs = [
      $fishClown, $fishButterfly, $fishCommon,
      $coralGlb0, $coralGlb1, $coralGlb2, $coralGlb3,
      $seaweedGlb, $jellyfishGlb,
      $starfishGlb, $seaUrchinGlb, $shellGlb, $anemoneGlb,
    ];
    const loaded = glbs.filter(Boolean).length;
    sceneFeatures.reportProgress("environment", loaded / glbs.length);
    if (loaded === glbs.length) {
      sceneFeatures.reportReady("environment");
    }
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

<!-- Coral formations — GLB with procedural fallback -->
{#if activeConfig.coral.enabled}
  {#if $coralGlb0 && $coralGlb1 && $coralGlb2 && $coralGlb3}
    {#each coralPlacements as placement, i}
      {@const coralModels = [$coralGlb0, $coralGlb1, $coralGlb2, $coralGlb3]}
      {@const modelIdx = i % coralModels.length}
      {@const source = coralModels[modelIdx]!}
      <T
        is={underwaterClone(source.scene, activeConfig.coral.glowColor, activeConfig.coral.glowBlend)}
        position.x={placement.x}
        position.y={groundY}
        position.z={placement.z}
        scale={placement.scale * CORAL_GLB_NORMALIZE[modelIdx]!}
        rotation.y={placement.rotY}
      />
    {/each}
  {:else}
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
{/if}

<!-- Kelp forest — GLB seaweed with procedural fallback -->
{#if activeConfig.kelp.enabled}
  {#if $seaweedGlb}
    {#each kelpPlacements as placement}
      <T
        is={underwaterClone($seaweedGlb.scene, "#0d3a1a", 0.2)}
        position.x={placement.x}
        position.y={groundY}
        position.z={placement.z}
        scale={placement.scale * 0.8}
        rotation.y={placement.rotY}
      />
    {/each}
  {:else}
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

<!-- Schooling fish — GLB models with InstancedMesh fallback -->
{#if $fishClown && $fishButterfly && $fishCommon}
  {#each fishStates as fish}
    {@const models = [$fishClown, $fishButterfly, $fishCommon]}
    {@const model = models[fish.variety]!}
    <T
      is={model.scene.clone()}
      position.x={fish.x}
      position.y={fish.y}
      position.z={fish.z}
      rotation.y={fish.rotY}
      scale={0.015}
    />
  {/each}
{:else}
  <T.InstancedMesh
    args={[fishGeometry, fishMaterial, FISH_COUNT]}
    frustumCulled={false}
    oncreate={handleFishMeshCreated}
  />
{/if}

<!-- Jellyfish — GLB model with procedural fallback -->
{#if activeConfig.jellyfish?.enabled}
  {#if $jellyfishGlb}
    {#each jellyfishPlacements as jf, i}
      {@const offset = jellyfishOffsets[i] ?? { dx: 0, dy: 0, dz: 0 }}
      <T.Group
        position.x={jf.x + offset.dx}
        position.y={groundY + jf.y + offset.dy}
        position.z={jf.z + offset.dz}
      >
        <T is={$jellyfishGlb.scene.clone()} scale={0.06} />
        <T.PointLight
          color={activeConfig.jellyfish.glowColor}
          intensity={activeConfig.jellyfish.lightIntensity * (0.7 + 0.3 * Math.sin(jellyfishTime * activeConfig.jellyfish.pulseRate * Math.PI * 2 + i * 1.7))}
          distance={activeConfig.jellyfish.lightDistance}
          decay={2}
        />
      </T.Group>
    {/each}
  {:else}
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
{/if}

<!-- Ocean floor decorations (starfish, sea urchins, shells, anemones) -->
{#each decorationPlacements as dec}
  {#if dec.type === "starfish" && $starfishGlb}
    <T
      is={$starfishGlb.scene.clone()}
      position.x={dec.x}
      position.y={groundY}
      position.z={dec.z}
      scale={dec.scale}
      rotation.y={dec.rotY}
    />
  {:else if dec.type === "urchin" && $seaUrchinGlb}
    <T
      is={$seaUrchinGlb.scene.clone()}
      position.x={dec.x}
      position.y={groundY}
      position.z={dec.z}
      scale={dec.scale}
      rotation.y={dec.rotY}
    />
  {:else if dec.type === "shell" && $shellGlb}
    <T
      is={$shellGlb.scene.clone()}
      position.x={dec.x}
      position.y={groundY}
      position.z={dec.z}
      scale={dec.scale}
      rotation.y={dec.rotY}
    />
  {:else if dec.type === "anemone" && $anemoneGlb}
    <T
      is={underwaterClone($anemoneGlb.scene, "#cc3366", 0.25)}
      position.x={dec.x}
      position.y={groundY}
      position.z={dec.z}
      scale={dec.scale}
      rotation.y={dec.rotY}
    />
  {/if}
{/each}

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
