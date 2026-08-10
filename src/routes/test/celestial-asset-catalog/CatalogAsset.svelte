<script lang="ts">
  import { T } from "@threlte/core";
  import { useGltf, useKtx2, useMeshopt } from "@threlte/extras";
  import {
    Box3,
    Color,
    Group,
    Mesh,
    MeshStandardMaterial,
    Vector3,
    type Material,
    type Object3D,
  } from "three";

  import type { CloudbreakAssetCandidate } from "./catalog";

  interface Props {
    asset: CloudbreakAssetCandidate;
    position: [number, number, number];
    rotationY?: number;
    scaleMultiplier?: number;
    stoneMaterial?: MeshStandardMaterial | null;
    onReady?: (id: string) => void;
  }

  let {
    asset,
    position,
    rotationY = 0,
    scaleMultiplier = 1,
    stoneMaterial = null,
    onReady,
  }: Props = $props();

  const gltf = useGltf(asset.path, {
    meshoptDecoder: useMeshopt(),
    ktx2Loader: useKtx2("/basis/"),
  });
  let prepared = $state<Group | null>(null);
  let reportedReady = false;

  function cloneMaterial(material: Material): Material {
    if (asset.materialGrade === "limestone" && stoneMaterial) {
      const limestoneClone = stoneMaterial.clone();
      limestoneClone.metalness = 0;
      limestoneClone.roughness = Math.max(0.84, limestoneClone.roughness);
      limestoneClone.envMapIntensity = 0.48;
      limestoneClone.needsUpdate = true;
      return limestoneClone;
    }

    const clone = material.clone();
    if (!(clone instanceof MeshStandardMaterial)) return clone;

    clone.metalness = 0;
    clone.envMapIntensity = 0.48;
    if (asset.materialGrade === "olive") {
      clone.color.lerp(new Color("#929b72"), 0.16);
      clone.roughness = Math.max(0.76, clone.roughness);
    } else {
      clone.map = null;
      clone.emissiveMap = null;
      clone.vertexColors = false;
      clone.color.set("#cdb58d");
      clone.emissive.set("#7d684e");
      clone.emissiveIntensity = 0.018;
      clone.roughness = Math.max(0.8, clone.roughness);
    }
    clone.needsUpdate = true;
    return clone;
  }

  function prepare(source: Object3D): Group {
    const root = source.clone(true) as Group;
    root.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      child.material = Array.isArray(child.material)
        ? child.material.map(cloneMaterial)
        : cloneMaterial(child.material);
    });

    root.updateWorldMatrix(true, true);
    const bounds = new Box3().setFromObject(root, true);
    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    const normalizingScale = asset.targetHeight / Math.max(size.y, 0.001);
    root.position.set(-center.x, -bounds.min.y, -center.z);
    root.scale.setScalar(normalizingScale * scaleMultiplier);
    root.updateWorldMatrix(true, true);
    return root;
  }

  $effect(() => {
    const source = $gltf?.scene;
    if (
      !source ||
      prepared ||
      (asset.materialGrade === "limestone" && !stoneMaterial)
    )
      return;
    prepared = prepare(source);
    if (!reportedReady) {
      reportedReady = true;
      onReady?.(asset.id);
    }
  });
</script>

{#if prepared}
  <T.Group {position} rotation.y={rotationY}>
    <T is={prepared} />
  </T.Group>
{/if}
