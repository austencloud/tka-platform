<script lang="ts">
  import { useTask } from "@threlte/core";
  import { Mesh, type Object3D, type Material } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";
  import GltfAsset from "../../../primitives/GltfAsset.svelte";
  import { createTopMaterial, type RuinsShaderConfig } from "./ruins-shaders";

  interface Props {
    config: RuinsShaderConfig & { groundOffset?: number };
  }

  let { config }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);
  // The dais GLB is authored base-at-origin; place it on the seabed surface.
  const baseY = $derived(groundY + (config.groundOffset ?? 0));

  // Body / pillars / columns keep their Blender-baked stone textures (so the app
  // matches Blender exactly). Only the deck swaps to the live shader — the
  // breathing bioluminescent crack glow that glTF can't carry.
  let topMat = $state(createTopMaterial(config));

  $effect(() => {
    topMat.uniforms.uStoneColor!.value.set(config.stoneColor);
    topMat.uniforms.uBioGlowColor!.value.set(config.runeGlowColor);
    topMat.uniforms.uGlowIntensity!.value = config.glowIntensity;
    topMat.uniforms.uMossIntensity!.value = config.mossIntensity;
  });

  $effect(() => {
    return () => topMat.dispose();
  });

  function isDeck(mesh: Mesh): boolean {
    if (mesh.name === "Dais_Deck" || mesh.name.includes("Deck")) return true;
    const mats: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    return mats.some((m) => m?.name === "DaisDeck");
  }

  function applyShaders(scene: Object3D): void {
    scene.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh || !isDeck(mesh)) return;
      // Only the deck wears the live glow; dispose its baked stand-in material.
      const old = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      old.forEach((m) => m?.dispose());
      mesh.material = topMat;
    });
  }

  useTask((delta) => {
    topMat.uniforms.uTime!.value += delta * 0.8;
  });
</script>

<GltfAsset url="/models/ocean/dais.glb" position={[0, baseY, 0]} onReady={applyShaders} />
