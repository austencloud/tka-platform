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
    LinearSRGBColorSpace,
    type MeshStandardMaterial as MeshStandardMaterialType,
    type Texture,
  } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";

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
    /** Normal map intensity (default 1.0) */
    normalScale?: number;
  }

  // Default values in meters (1 unit = 1 meter)
  let {
    color = "#ffffff",
    size = 25, // 25 meters radius
    diffuseMap,
    normalMap,
    roughnessMap,
    textureRepeat = 8,
    normalScale = 1.0,
  }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);

  const textureLoader = useLoader(TextureLoader);

  // Load all texture maps
  const diffuseTex = $derived(textureLoader.load(diffuseMap));
  const normalTex = $derived(normalMap ? textureLoader.load(normalMap) : null);
  const roughnessTex = $derived(
    roughnessMap ? textureLoader.load(roughnessMap) : null
  );

  let materialRef = $state<MeshStandardMaterialType | undefined>(undefined);

  /** Configure a texture for tiling: wrapping, repeat, and color space. */
  function configureTexture(tex: Texture, colorSpace: string) {
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.repeat.set(textureRepeat, textureRepeat);
    tex.colorSpace = colorSpace;
    tex.needsUpdate = true;
  }

  // Apply diffuse map
  $effect(() => {
    const tex = $diffuseTex;
    const mat = materialRef;
    if (tex && mat) {
      configureTexture(tex, SRGBColorSpace);
      mat.map = tex;
      mat.needsUpdate = true;
    }
  });

  // Apply normal map (adds surface depth - twigs, leaves, dirt ridges)
  $effect(() => {
    const tex = normalTex ? $normalTex : null;
    const mat = materialRef;
    if (tex && mat) {
      configureTexture(tex, LinearSRGBColorSpace);
      mat.normalMap = tex;
      mat.normalScale.set(normalScale, normalScale);
      mat.needsUpdate = true;
    }
  });

  // Apply roughness map (variation in shininess across the surface)
  $effect(() => {
    const tex = roughnessTex ? $roughnessTex : null;
    const mat = materialRef;
    if (tex && mat) {
      configureTexture(tex, LinearSRGBColorSpace);
      mat.roughnessMap = tex;
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
