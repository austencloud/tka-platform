<script lang="ts">
  import { T, useTask, useThrelte } from "@threlte/core";
  import { useGltf, useKtx2, useMeshopt } from "@threlte/extras";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { Color, Mesh, MeshStandardMaterial, type Object3D } from "three";
  import {
    prefersReducedMotion,
    resolveMotionScale,
  } from "../../primitives/motion-preference";

  interface Props {
    interactionPulse?: number;
    onReady?: () => void;
  }

  interface AnimatedCanopy {
    object: Object3D;
    baseRotationZ: number;
    phase: number;
  }

  let { interactionPulse = 0, onReady }: Props = $props();

  const cloudbreak = useGltf(
    "/models/celestial/olive-cloudbreak-production-slice.glb?v=gate4-cloudbreak-r6",
    {
      meshoptDecoder: useMeshopt(),
      ktx2Loader: useKtx2("/basis/"),
    }
  );
  const { scene, renderer, camera } = useThrelte();
  const canopies: AnimatedCanopy[] = [];
  const lagoonMaterials = new Set<MeshStandardMaterial>();
  const waterfallMaterials = new Set<MeshStandardMaterial>();
  let reportedReady = false;
  let elapsed = 0;
  let responseEnergy = 0;

  function gradeMaterial(material: MeshStandardMaterial, role: string): void {
    material.metalness = 0;
    material.envMapIntensity = 0.42;

    if (role === "cloudbreak-lagoon-water") {
      material.color.set("#58aeb8");
      material.emissive.set("#4fa2ac");
      material.emissiveIntensity = 0.1;
      material.roughness = 0.18;
      material.transparent = true;
      material.opacity = 0.78;
      material.depthWrite = false;
      lagoonMaterials.add(material);
    } else if (role === "cloudbreak-waterfall") {
      material.color.set("#d8f0f4");
      material.emissive.set("#a9dce5");
      material.emissiveIntensity = 0.16;
      material.roughness = 0.24;
      material.transparent = true;
      material.opacity = 0.68;
      material.depthWrite = false;
      waterfallMaterials.add(material);
    } else if (role === "cloudbreak-olive-canopy") {
      material.color.lerp(new Color("#80905e"), 0.18);
      material.roughness = Math.max(0.78, material.roughness);
    } else if (role === "cloudbreak-olive-trunk") {
      material.color.lerp(new Color("#685746"), 0.12);
      material.roughness = Math.max(0.86, material.roughness);
    } else {
      material.roughness = Math.max(0.74, material.roughness);
      material.emissive.set("#927b5e");
      material.emissiveIntensity = 0.018;
    }
    material.needsUpdate = true;
  }

  function prepareCloudbreak(root: Object3D): void {
    if (root.userData.tkaCloudbreakRuntimePrepared === true) return;
    canopies.length = 0;
    lagoonMaterials.clear();
    waterfallMaterials.clear();

    root.traverse((child: Object3D) => {
      if (!(child instanceof Mesh)) return;
      const role = String(child.userData.tka_role ?? "");
      child.castShadow =
        role === "cloudbreak-olive-trunk" || role === "cloudbreak-olive-canopy";
      child.receiveShadow = role !== "cloudbreak-waterfall";

      if (role === "cloudbreak-olive-canopy") {
        canopies.push({
          object: child,
          baseRotationZ: child.rotation.z,
          phase: canopies.length * 1.71,
        });
      }

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      for (const material of materials) {
        if (material instanceof MeshStandardMaterial) {
          gradeMaterial(material, role);
        }
      }
    });

    root.userData.tkaCloudbreakRuntimePrepared = true;
  }

  $effect(() => {
    const root = $cloudbreak?.scene;
    if (!root) return;
    prepareCloudbreak(root);
    if (renderer.current && camera.current && scene.current) {
      renderer.current.compile(scene.current, camera.current);
    }
    if (!reportedReady) {
      reportedReady = true;
      onReady?.();
    }
  });

  $effect(() => {
    void interactionPulse;
    if (interactionPulse > 0) responseEnergy = 1;
  });

  const reducedMotion = $derived(prefersReducedMotion());
  const motionScale = $derived(resolveMotionScale(reducedMotion));

  useTask((delta) => {
    const motion = motionScale;
    elapsed += delta * motion;
    responseEnergy = Math.max(0, responseEnergy - delta * 0.72);

    for (const canopy of canopies) {
      canopy.object.rotation.z =
        canopy.baseRotationZ +
        Math.sin(elapsed * 0.32 + canopy.phase) * 0.012 * motion;
    }

    const lagoonShimmer =
      0.105 + Math.sin(elapsed * 0.74) * 0.018 + responseEnergy * 0.11;
    for (const material of lagoonMaterials) {
      material.emissiveIntensity = lagoonShimmer;
      material.opacity = 0.78 + Math.sin(elapsed * 0.53) * 0.025;
    }

    const fallShimmer = 0.16 + Math.sin(elapsed * 1.08) * 0.025;
    for (const material of waterfallMaterials) {
      material.emissiveIntensity = fallShimmer + responseEnergy * 0.05;
    }
  });
</script>

{#if $cloudbreak}
  <T.Group
    position.y={userProportionsState.groundY}
    scale.x={-1}
    scale.z={-1}
  >
    <T is={$cloudbreak.scene} />
  </T.Group>
{/if}
