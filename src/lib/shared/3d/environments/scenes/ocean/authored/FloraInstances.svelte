<script lang="ts">
  import { T } from "@threlte/core";
  import { useGltf } from "@threlte/extras";
  import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
  import {
    InstancedMesh,
    Matrix4,
    Vector3,
    Quaternion,
    Object3D,
    Mesh,
    Sphere,
    type BufferGeometry,
    type Material,
  } from "three";
  import { OCEAN_PLACEMENTS } from "./placements";
  import type { OceanQualityConfig } from "../quality/ocean-quality";

  interface Props {
    quality: OceanQualityConfig;
  }

  let { quality }: Props = $props();

  // ── Model path lookup ─────────────────────────────────────────────────
  // Maps objectKey from ComposerPlacement to model GLB path.
  // Mirrors ocean-composer-plugin.ts catalog without coupling to plugin internals.
  const MODEL_PATHS: Record<string, string> = {
    "coral-0": "/models/ocean/coral_0.glb",
    "coral-1": "/models/ocean/coral_1.glb",
    "coral-2": "/models/ocean/coral_2.glb",
    "coral-3": "/models/ocean/coral_3.glb",
    "coral-4": "/models/ocean/coral_4.glb",
    "coral-5": "/models/ocean/coral_5.glb",
    "coral-6": "/models/ocean/coral_6.glb",
    "coral-large": "/models/ocean/coral_large.glb",
    seaweed: "/models/ocean/seaweed.glb",
    "kelp-plant": "/models/ocean/kelp_plant.glb",
    starfish: "/models/ocean/starfish.glb",
    "sea-urchin": "/models/ocean/sea_urchin.glb",
    shell: "/models/ocean/shell.glb",
    anemone: "/models/ocean/anemone.glb",
    "rock-0": "/models/ocean/rock_0.glb",
    "rock-1": "/models/ocean/rock_1.glb",
    "rock-2": "/models/ocean/rock_2.glb",
    "rock-3": "/models/ocean/rock_3.glb",
    "rock-4": "/models/ocean/rock_4.glb",
    "rock-5": "/models/ocean/rock_5.glb",
    "meshy-basalt-pinnacle": "/models/ocean/meshy/basalt_pinnacle.glb",
    "meshy-coral-encrusted-rock": "/models/ocean/meshy/coral_encrusted_rock.glb",
    "meshy-coral-mountain": "/models/ocean/meshy/coral_mountain.glb",
    "meshy-neon-coral-summit": "/models/ocean/meshy/neon_coral_summit.glb",
    "meshy-submerged-coral-citadel": "/models/ocean/meshy/submerged_coral_citadel.glb",
    "meshy-sunlit-coral-arch": "/models/ocean/meshy/sunlit_coral_arch.glb",
    "meshy-underwater-coral-arch": "/models/ocean/meshy/underwater_coral_arch.glb",
    "meshy-underwater-rock-table": "/models/ocean/meshy/underwater_rock_table.glb",
    "meshy-photorealistic-coral-0": "/models/ocean/meshy/photorealistic_coral_0.glb",
    "meshy-photorealistic-coral-1": "/models/ocean/meshy/photorealistic_coral_1.glb",
    "meshy-photorealistic-coral-2": "/models/ocean/meshy/photorealistic_coral_2.glb",
    "meshy-photorealistic-coral-3": "/models/ocean/meshy/photorealistic_coral_3.glb",
  };

  const opts = { meshoptDecoder: MeshoptDecoder };

  // ── Group placements by objectKey ─────────────────────────────────────
  interface PlacementGroup {
    objectKey: string;
    modelPath: string;
    entries: Array<{
      position: [number, number, number];
      rotation: [number, number, number, number];
      scale: [number, number, number];
    }>;
  }

  const groups = $derived.by((): PlacementGroup[] => {
    if (OCEAN_PLACEMENTS.length === 0) return [];
    const map = new Map<string, PlacementGroup>();
    for (const p of OCEAN_PLACEMENTS) {
      const path = MODEL_PATHS[p.objectKey];
      if (!path) continue;
      let group = map.get(p.objectKey);
      if (!group) {
        group = { objectKey: p.objectKey, modelPath: path, entries: [] };
        map.set(p.objectKey, group);
      }
      group.entries.push({
        position: p.position,
        rotation: p.rotation,
        scale: p.scale,
      });
    }
    return Array.from(map.values());
  });

  // ── Load models for each unique objectKey ─────────────────────────────
  // useGltf is called per unique modelPath. Since OCEAN_PLACEMENTS is currently
  // empty, groups will be empty and no GLBs will be loaded.
  // When Blender populates placements, the groups reactive chain triggers loading.

  // We need to load models dynamically based on groups.
  // Since useGltf must be called at component top level (Svelte store),
  // and groups is currently empty, we pre-load nothing.
  // Instead, we build instanced meshes in an $effect when data arrives.

  let instancedMeshes = $state<InstancedMesh[]>([]);

  function extractFirstMesh(
    root: Object3D
  ): { geometry: BufferGeometry; material: Material; worldMatrix: Matrix4 } | null {
    root.updateMatrixWorld(true);
    let result: {
      geometry: BufferGeometry;
      material: Material;
      worldMatrix: Matrix4;
    } | null = null;
    root.traverse((child) => {
      if (result) return;
      const m = child as Mesh;
      if (!m.isMesh || !m.geometry) return;
      const mat = Array.isArray(m.material) ? m.material[0]! : m.material;
      result = {
        geometry: m.geometry,
        material: mat,
        worldMatrix: m.matrixWorld.clone(),
      };
    });
    return result;
  }

  function buildInstancedMesh(
    modelScene: Object3D,
    entries: PlacementGroup["entries"]
  ): InstancedMesh | null {
    if (entries.length === 0) return null;
    const extracted = extractFirstMesh(modelScene);
    if (!extracted) return null;

    const geo = extracted.geometry.clone();
    geo.applyMatrix4(extracted.worldMatrix);
    const clonedMat = (
      extracted.material as import("three").MeshStandardMaterial
    ).clone();
    const inst = new InstancedMesh(geo, clonedMat, entries.length);
    inst.frustumCulled = true;

    const mat = new Matrix4();
    const q = new Quaternion();
    const s = new Vector3();
    const pos = new Vector3();
    let maxDist = 0;

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]!;
      pos.set(e.position[0], e.position[1], e.position[2]);
      q.set(e.rotation[0], e.rotation[1], e.rotation[2], e.rotation[3]);
      s.set(e.scale[0], e.scale[1], e.scale[2]);
      mat.compose(pos, q, s);
      inst.setMatrixAt(i, mat);
      const dist =
        Math.sqrt(
          e.position[0] ** 2 + e.position[1] ** 2 + e.position[2] ** 2
        ) +
        Math.max(e.scale[0], e.scale[1], e.scale[2]) * 2;
      if (dist > maxDist) maxDist = dist;
    }

    inst.instanceMatrix.needsUpdate = true;
    inst.geometry.boundingSphere = new Sphere(new Vector3(0, 0, 0), maxDist);
    return inst;
  }

  // ── Dynamic model loading + instancing ────────────────────────────────
  // For each group, we load the GLB dynamically and build an InstancedMesh.
  // This approach handles the fact that groups are empty at init and may
  // grow when Blender exports placements.

  $effect(() => {
    const currentGroups = groups;
    if (currentGroups.length === 0) {
      instancedMeshes = [];
      return;
    }

    let cancelled = false;
    const meshes: InstancedMesh[] = [];

    Promise.all(
      currentGroups.map(async (group) => {
        const { useGltf: _ } = await import("@threlte/extras");
        // useGltf is a store creator and can't be used imperatively.
        // Instead, use Three.js GLTFLoader directly for dynamic loading.
        const { GLTFLoader } = await import(
          "three/examples/jsm/loaders/GLTFLoader.js"
        );
        const { MeshoptDecoder: Decoder } = await import(
          "three/examples/jsm/libs/meshopt_decoder.module.js"
        );

        const loader = new GLTFLoader();
        loader.setMeshoptDecoder(Decoder);

        return new Promise<InstancedMesh | null>((resolve) => {
          loader.load(
            group.modelPath,
            (gltf) => {
              if (cancelled) {
                resolve(null);
                return;
              }
              const inst = buildInstancedMesh(gltf.scene, group.entries);
              resolve(inst);
            },
            undefined,
            () => resolve(null)
          );
        });
      })
    ).then((results) => {
      if (cancelled) return;
      for (const m of results) {
        if (m) meshes.push(m);
      }
      instancedMeshes = meshes;
    });

    return () => {
      cancelled = true;
      for (const m of meshes) {
        m.geometry.dispose();
        if (m.material instanceof Array) {
          m.material.forEach((mat) => mat.dispose());
        } else {
          (m.material as Material).dispose();
        }
        m.dispose();
      }
    };
  });
</script>

{#each instancedMeshes as mesh (mesh.uuid)}
  <T is={mesh} />
{/each}
