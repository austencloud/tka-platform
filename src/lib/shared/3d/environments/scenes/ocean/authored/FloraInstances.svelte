<script lang="ts">
  import { T } from "@threlte/core";
  import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
  import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
  import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
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
    "meshy-staghorn-coral": "/models/ocean/meshy/staghorn_coral.glb",
    "meshy-brain-coral": "/models/ocean/meshy/brain_coral.glb",
    "meshy-fan-coral": "/models/ocean/meshy/fan_coral.glb",
    "meshy-table-coral": "/models/ocean/meshy/table_coral.glb",
    "meshy-kelp": "/models/ocean/meshy/kelp.glb",
    "meshy-tall-kelp": "/models/ocean/meshy/tall_kelp.glb",
    "meshy-sea-grass": "/models/ocean/meshy/sea_grass.glb",
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
    "struct-coral-arch": "/models/ocean/structures/coral-arch.glb",
    "struct-coral-bommie": "/models/ocean/structures/coral-bommie.glb",
    "struct-coral-tower": "/models/ocean/structures/coral-tower.glb",
    "struct-reef-wall": "/models/ocean/structures/reef-wall.glb",
    "ph-boulder-01": "/models/ocean/polyhaven/boulder_01.glb",
    "ph-rock-07": "/models/ocean/polyhaven/rock_07.glb",
    "ph-stone-01": "/models/ocean/polyhaven/stone_01.glb",
    "ph-sand-rocks": "/models/ocean/polyhaven/sand_rocks_small_01.glb",
    "ph-coast-rocks-05": "/models/ocean/polyhaven/coast_rocks_05.glb",
  };

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("/draco/");
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);
  gltfLoader.setMeshoptDecoder(MeshoptDecoder);


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

    // Normalize geometry so max extent = 1 unit, bottom at Y=0.
    // Sketchfab models have wildly different native scales (0.6m to 141m).
    // After normalization, placement scale directly = world-space meters.
    geo.computeBoundingBox();
    const bbox = geo.boundingBox!;
    const size = new Vector3();
    bbox.getSize(size);
    const maxExtent = Math.max(size.x, size.y, size.z);
    if (maxExtent > 0.001) {
      const center = new Vector3();
      bbox.getCenter(center);
      geo.applyMatrix4(new Matrix4().makeTranslation(-center.x, -bbox.min.y, -center.z));
      const ns = 1 / maxExtent;
      geo.applyMatrix4(new Matrix4().makeScale(ns, ns, ns));
    }

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

  $effect(() => {
    const currentGroups = groups;
    if (currentGroups.length === 0) {
      instancedMeshes = [];
      return;
    }

    let cancelled = false;
    const activeMeshes: InstancedMesh[] = [];

    for (const group of currentGroups) {
      gltfLoader.load(
        group.modelPath,
        (gltf) => {
          if (cancelled) return;
          const im = buildInstancedMesh(gltf.scene, group.entries);
          if (im) {
            activeMeshes.push(im);
            instancedMeshes = [...activeMeshes];
          }
        },
        undefined,
        (err) => {
          console.error(`[FloraInstances] Failed: ${group.modelPath}`, err);
        }
      );
    }

    return () => {
      cancelled = true;
      for (const m of activeMeshes) {
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
