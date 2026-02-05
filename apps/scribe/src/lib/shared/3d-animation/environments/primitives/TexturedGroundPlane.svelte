<script lang="ts">
  /**
   * TexturedGroundPlane Primitive
   *
   * Ground surface with PBR textures (diffuse, normal, roughness).
   * Ground Y is derived from user proportions.
   */

  import { T, useLoader } from "@threlte/core";
  import {
    TextureLoader,
    RepeatWrapping,
    SRGBColorSpace,
    type MeshStandardMaterial as MeshStandardMaterialType,
  } from "three";
  import { userProportionsState } from "../../state/user-proportions-state.svelte";

  interface Props {
    /** Color tint applied over texture */
    color?: string;
    /** Radius of the plane */
    size?: number;
    /** Path to diffuse/albedo texture */
    diffuseMap: string;
    /** Path to normal map */
    normalMap?: string;
    /** Path to roughness map */
    roughnessMap?: string;
    /** Texture repeat count */
    textureRepeat?: number;
  }

  // Default values in meters (1 unit = 1 meter)
  let {
    color = "#ffffff",
    size = 25, // 25 meters radius
    diffuseMap,
    normalMap,
    roughnessMap,
    textureRepeat = 8,
  }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);

  // Load texture using Threlte's useLoader - reactive to diffuseMap changes
  const textureLoader = useLoader(TextureLoader);
  const texture = $derived(textureLoader.load(diffuseMap));

  // Reference to material for direct manipulation
  let materialRef = $state<MeshStandardMaterialType | undefined>(undefined);

  // Configure texture and apply to material when both are ready
  $effect(() => {
    const tex = $texture;
    const mat = materialRef;

    if (tex && mat) {
      // Configure texture
      tex.wrapS = RepeatWrapping;
      tex.wrapT = RepeatWrapping;
      tex.repeat.set(textureRepeat, textureRepeat);
      tex.colorSpace = SRGBColorSpace;
      tex.needsUpdate = true;

      // Apply directly to material
      mat.map = tex;
      mat.needsUpdate = true;
    }
  });
</script>

<T.Group position={[0, groundY, 0]}>
  <T.Mesh rotation.x={-Math.PI / 2}>
    <T.CircleGeometry args={[size, 64]} />
    <T.MeshStandardMaterial
      bind:ref={materialRef}
      {color}
      side={2}
      roughness={0.9}
      metalness={0}
    />
  </T.Mesh>
</T.Group>
