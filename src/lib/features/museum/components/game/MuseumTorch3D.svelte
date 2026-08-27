<script module lang="ts">
  // Module-scoped: shared across ALL MuseumTorch3D instances.
  // Without this, each of ~30 torches would create its own GLTFLoader
  // and independently fetch+parse the same GLB files.
  import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
  import { Box3, Vector3, PointLight, Group } from "three";
  import type { Object3D, Scene } from "three";
  import { FIXTURE_REGISTRY, type FixtureConfig } from "../../domain/fixture-registry";
  import type { WingTheme } from "../../domain/museum-grid-types";

  const sharedLoader = new GLTFLoader();
  const modelTemplateCache = new Map<string, Object3D>();
  const modelPendingCache = new Map<string, Promise<Object3D>>();

  const TARGET_HEIGHT = 0.3;

  /** Load and cache a single model. Returns the template (do NOT mutate - clone it). */
  function loadModel(modelPath: string, scale: number): Promise<Object3D> {
    const cached = modelTemplateCache.get(modelPath);
    if (cached) return Promise.resolve(cached);

    let pending = modelPendingCache.get(modelPath);
    if (!pending) {
      pending = new Promise<Object3D>((resolve, reject) => {
        sharedLoader.load(
          modelPath,
          (gltf) => {
            const template = gltf.scene;
            const box = new Box3().setFromObject(template);
            const size = new Vector3();
            box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim > 0) {
              const autoScale = (TARGET_HEIGHT / maxDim) * scale;
              template.scale.setScalar(autoScale);
            }
            modelTemplateCache.set(modelPath, template);
            modelPendingCache.delete(modelPath);
            resolve(template);
          },
          undefined,
          (err) => {
            modelPendingCache.delete(modelPath);
            reject(err);
          },
        );
      });
      modelPendingCache.set(modelPath, pending);
    }
    return pending;
  }

  /** Preload ALL fixture models so the editor ghost + instant placement work. */
  export async function preloadAllFixtureModels(): Promise<void> {
    const entries = Object.entries(FIXTURE_REGISTRY) as [WingTheme, FixtureConfig][];
    const unique = new Map<string, number>();
    for (const [, config] of entries) {
      if (!unique.has(config.modelPath)) {
        unique.set(config.modelPath, config.scale);
      }
    }
    await Promise.allSettled(
      [...unique.entries()].map(([path, scale]) => loadModel(path, scale))
    );
  }

  /**
   * Instantly add a torch to the scene imperatively - no Svelte component overhead.
   * Returns the Group so it can be removed later (for undo/delete).
   */
  export function addTorchToScene(
    scene: Scene,
    x: number, z: number,
    wallOffsetX: number, wallOffsetZ: number,
    wingTheme: WingTheme,
    placementId: string,
  ): Group | null {
    const config = FIXTURE_REGISTRY[wingTheme];
    const template = modelTemplateCache.get(config.modelPath);

    const group = new Group();
    group.name = `manual-placement-${placementId}`;
    group.userData.__manualPlacementId = placementId;

    const tx = x + wallOffsetX;
    const tz = z + wallOffsetZ;
    const fixtureY = 1.25 + config.yOffset;

    if (template) {
      const model = template.clone();
      model.position.set(tx, fixtureY, tz);
      group.add(model);
    }

    // Point light for the torch
    const light = new PointLight(config.lightColor, config.lightIntensity, 8, 2);
    light.position.set(tx, fixtureY + 0.2, tz);
    group.add(light);

    scene.add(group);
    return group;
  }

  /** Remove an imperatively-added torch group from the scene. */
  export function removeTorchFromScene(scene: Scene, placementId: string): boolean {
    const obj = scene.getObjectByName(`manual-placement-${placementId}`);
    if (obj) {
      scene.remove(obj);
      return true;
    }
    return false;
  }

  export { modelTemplateCache };
</script>

<script lang="ts">
  /**
   * Museum light fixture: loads a GLTF model per wing theme, with optional
   * flame shader, ember particles, volumetric light cone, and animated point light.
   * Falls back to procedural geometry when the GLB model hasn't been added yet.
   *
   * PERFORMANCE: Shader materials are provided by TorchMaterialCache (pre-compiled
   * once at scene init). Without this, each torch triggers GPU shader compilation
   * on mount (~200-800ms), causing visible stutter while walking.
   */
  import { T, useTask } from "@threlte/core";
  import { onDestroy } from "svelte";
  import {
    Points,
    BufferGeometry,
    Float32BufferAttribute,
  } from "three";
  import type { TorchMaterials } from "../../services/torch-material-cache";

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
    /** Pre-compiled materials from TorchMaterialCache - avoids shader compilation per torch */
    materials: TorchMaterials;
    /** Enable shadow casting on the point light (expensive - use sparingly) */
    castShadow?: boolean;
    /** Player world position - ember particles skip animation when far away */
    playerPosition?: { x: number; y: number; z: number };
    /** False when the museum is mounted-but-hidden (keep-alive) - pause flicker/ember animation */
    visible?: boolean;
  }

  const props: Props = $props();

  // Resolve defaults (plain consts - initial values for Three.js objects, not reactive)
  const x = props.x;
  const z = props.z;
  const y = props.y ?? 1.25;
  const wallOffsetX = props.wallOffsetX ?? 0;
  const wallOffsetZ = props.wallOffsetZ ?? 0;
  const baseIntensity = props.baseIntensity ?? 4;
  const distance = props.distance ?? 8;
  const wingTheme = props.wingTheme ?? ("cave" as WingTheme);
  const materials = props.materials;

  const config: FixtureConfig = FIXTURE_REGISTRY[wingTheme];
  const effectiveIntensity = baseIntensity > 0 ? config.lightIntensity : 0;

  // The fixture's actual world position, offset from the wall into the room
  const tx = x + wallOffsetX;
  const tz = z + wallOffsetZ;
  const fixtureY = y + config.yOffset;

  // ── GLTF model loading (template-cached) ──
  // First torch for a given model path parses the GLB and stores the scaled
  // template. All subsequent torches clone the template (cheap deep copy that
  // shares GPU vertex buffers). Also deduplicates in-flight fetches so 30
  // torches mounting simultaneously don't trigger 30 parallel HTTP requests.
  let gltfModel: Object3D | null = $state(null);
  let modelFailed = $state(false);

  async function loadCachedModel(): Promise<Object3D> {
    const cached = modelTemplateCache.get(config.modelPath);
    if (cached) return cached.clone();

    let pending = modelPendingCache.get(config.modelPath);
    if (!pending) {
      pending = new Promise<Object3D>((resolve, reject) => {
        sharedLoader.load(
          config.modelPath,
          (gltf) => {
            const template = gltf.scene;
            const box = new Box3().setFromObject(template);
            const size = new Vector3();
            box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim > 0) {
              const autoScale = (TARGET_HEIGHT / maxDim) * config.scale;
              template.scale.setScalar(autoScale);
            }
            modelTemplateCache.set(config.modelPath, template);
            modelPendingCache.delete(config.modelPath);
            resolve(template);
          },
          undefined,
          (err) => {
            modelPendingCache.delete(config.modelPath);
            reject(err);
          },
        );
      });
      modelPendingCache.set(config.modelPath, pending);
    }

    const template = await pending;
    return template.clone();
  }

  loadCachedModel()
    .then((model) => {
      model.position.set(tx, fixtureY, tz);
      gltfModel = model;
    })
    .catch(() => {
      modelFailed = true;
    });

  // Use pre-compiled materials from cache (cloned, so uniforms are per-instance)
  const { flameMat, flameGeo, coneMat, coneGeo, fallbackGeo, fallbackMat, emberMat } = materials;

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
  const emberPoints = new Points(emberGeo, emberMat);

  let light: PointLight | undefined = $state();
  let elapsed = Math.random() * 100;
  const isFireBased = config.hasFlame;

  // Ember particles are pure cosmetic detail - invisible beyond ~5 world units.
  // Skipping their per-frame position updates for distant torches saves ~700
  // particle calculations per frame across ~30 torches.
  const EMBER_PROXIMITY_SQ = 5 * 5; // 5 world units squared

  useTask((delta) => {
    // Keep-alive: pause flicker + ember animation while hidden.
    if (props.visible === false) return;

    elapsed += delta;

    if (config.hasFlame) {
      flameMat.uniforms.uTime!.value = elapsed;
    }

    if (light && effectiveIntensity > 0) {
      if (isFireBased) {
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
        const hum = Math.sin(elapsed * 120) * 0.02;
        light.intensity = effectiveIntensity + hum * effectiveIntensity;
      }
    }

    // Animate embers only when player is nearby - distant embers are
    // sub-pixel and invisible, so updating their positions is pure waste.
    if (EMBER_COUNT > 0) {
      const pp = props.playerPosition;
      if (pp) {
        const dx = pp.x - tx;
        const dz = pp.z - tz;
        if (dx * dx + dz * dz > EMBER_PROXIMITY_SQ) return;
      }

      for (let i = 0; i < EMBER_COUNT; i++) {
        emberPositions[i * 3] = (emberPositions[i * 3] ?? 0) + (emberDrifts[i * 2] ?? 0) * delta;
        emberPositions[i * 3 + 1] = (emberPositions[i * 3 + 1] ?? 0) + (emberSpeeds[i] ?? 0) * delta;
        emberPositions[i * 3 + 2] = (emberPositions[i * 3 + 2] ?? 0) + (emberDrifts[i * 2 + 1] ?? 0) * delta;
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
    // Only dispose per-instance resources. Shared geometries and emberMat
    // are owned by TorchMaterialCache. Cloned flameMat/coneMat are per-instance.
    flameMat.dispose();
    coneMat.dispose();
    fallbackMat.dispose();
    emberGeo.dispose();
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
    castShadow={props.castShadow ?? false}
    shadow.mapSize.width={512}
    shadow.mapSize.height={512}
    shadow.bias={-0.005}
    shadow.camera.near={0.2}
    shadow.camera.far={distance}
  />
{/if}
