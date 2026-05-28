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
    Box3,
    BufferAttribute,
    type BufferGeometry,
    type Material,
  } from "three";
  import { OCEAN_PLACEMENTS } from "./placements";
  import type { OceanQualityConfig } from "../quality/ocean-quality";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    quality: OceanQualityConfig;
  }

  let { quality }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);

  // ── Model path lookup ─────────────────────────────────────────────────
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

  // ── Dequantize KHR_mesh_quantization INT16 positions to Float32 ──────
  // Prevents integer overflow when applyMatrix4 shifts values outside [-1,1].
  function dequantizePositions(geo: BufferGeometry): void {
    const pos = geo.getAttribute("position");
    if (!pos || pos.array instanceof Float32Array) return;
    const count = pos.count;
    const f32 = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      f32[i * 3] = pos.getX(i);
      f32[i * 3 + 1] = pos.getY(i);
      f32[i * 3 + 2] = pos.getZ(i);
    }
    geo.setAttribute("position", new BufferAttribute(f32, 3));
  }

  // ── Build InstancedMesh array for ALL meshes within a model ──────────
  // Creates one InstancedMesh per mesh in the GLB. All share the same
  // instance matrices so multi-part models stay assembled at each placement.
  function buildInstancedMeshesForModel(
    modelScene: Object3D,
    entries: PlacementGroup["entries"]
  ): InstancedMesh[] {
    if (entries.length === 0) return [];

    modelScene.updateMatrixWorld(true);

    // 1. Collect all mesh geometries in world space
    const parts: { geo: BufferGeometry; material: Material }[] = [];

    modelScene.traverse((child) => {
      const m = child as Mesh;
      if (!m.isMesh || !m.geometry) return;

      const geo = m.geometry.clone();
      dequantizePositions(geo);
      geo.applyMatrix4(m.matrixWorld);

      const mat = Array.isArray(m.material)
        ? (m.material[0] as Material).clone()
        : (m.material as Material).clone();
      parts.push({ geo, material: mat });
    });

    if (parts.length === 0) return [];

    // Debug: log model info to diagnose sizing
    console.log(`[Flora] Model loaded: ${parts.length} mesh(es)`);

    // 2. Compute COMBINED bounding box across all parts
    const combinedBox = new Box3();
    for (const { geo } of parts) {
      geo.computeBoundingBox();
      combinedBox.union(geo.boundingBox!);
    }

    // 3. Build shared normalization matrix: bottom at Y=0, centered XZ, max extent = 1
    const size = new Vector3();
    combinedBox.getSize(size);
    const maxExtent = Math.max(size.x, size.y, size.z);

    if (maxExtent > 0.001) {
      const center = new Vector3();
      combinedBox.getCenter(center);

      console.log(`[Flora]   bbox: [${size.x.toFixed(3)}, ${size.y.toFixed(3)}, ${size.z.toFixed(3)}] maxExtent=${maxExtent.toFixed(3)}`);

      const translation = new Matrix4().makeTranslation(
        -center.x,
        -combinedBox.min.y,
        -center.z
      );
      const ns = 1 / maxExtent;
      const scale = new Matrix4().makeScale(ns, ns, ns);
      const normMatrix = new Matrix4().multiplyMatrices(scale, translation);

      // 4. Apply SAME normalization to ALL parts
      for (const { geo } of parts) {
        geo.applyMatrix4(normMatrix);
      }
    }

    // 5. Compute shared instance matrices + bounding sphere
    const mat4 = new Matrix4();
    const q = new Quaternion();
    const s = new Vector3();
    const pos = new Vector3();
    let maxDist = 0;

    const instanceMatrices: Matrix4[] = [];
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]!;
      pos.set(e.position[0], e.position[1], e.position[2]);
      q.set(e.rotation[0], e.rotation[1], e.rotation[2], e.rotation[3]);
      s.set(e.scale[0], e.scale[1], e.scale[2]);
      const m = new Matrix4();
      m.compose(pos, q, s);
      instanceMatrices.push(m);

      const dist =
        Math.sqrt(e.position[0] ** 2 + e.position[1] ** 2 + e.position[2] ** 2) +
        Math.max(e.scale[0], e.scale[1], e.scale[2]) * 2;
      if (dist > maxDist) maxDist = dist;
    }

    const boundingSphere = new Sphere(new Vector3(0, 0, 0), maxDist);

    // 6. Create one InstancedMesh per part, all sharing the same transforms
    const result: InstancedMesh[] = [];
    for (const { geo, material } of parts) {
      const inst = new InstancedMesh(geo, material, entries.length);
      inst.frustumCulled = true;

      for (let i = 0; i < instanceMatrices.length; i++) {
        inst.setMatrixAt(i, instanceMatrices[i]!);
      }

      inst.instanceMatrix.needsUpdate = true;
      inst.geometry.boundingSphere = boundingSphere.clone();
      result.push(inst);
    }

    return result;
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
          const meshes = buildInstancedMeshesForModel(gltf.scene, group.entries);
          if (meshes.length > 0) {
            activeMeshes.push(...meshes);
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

<T.Group position.y={groundY}>
  {#each instancedMeshes as mesh (mesh.uuid)}
    <T is={mesh} />
  {/each}
</T.Group>
