<script lang="ts">
  import { T, useTask, useThrelte } from "@threlte/core";
  import { useTexture } from "@threlte/extras";
  import { onDestroy, untrack } from "svelte";
  import {
    BackSide,
    ClampToEdgeWrapping,
    MeshBasicMaterial,
    RepeatWrapping,
    SphereGeometry,
    SRGBColorSpace,
    type Mesh,
  } from "three";

  const geometry = untrack(() => new SphereGeometry(160, 64, 40));
  const panorama = useTexture(
    "/textures/celestial/olive-cloudbreak-panorama-r1.webp?v=gate4-cloudbreak-r1"
  );
  const { camera } = useThrelte();
  let skyMesh = $state<Mesh | undefined>();
  let material = $state<MeshBasicMaterial | undefined>();

  $effect(() => {
    const texture = $panorama;
    if (!texture) return;
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.offset.x = 0;
    texture.offset.y = -0.1;
    texture.needsUpdate = true;

    const nextMaterial = new MeshBasicMaterial({
      map: texture,
      side: BackSide,
      depthTest: false,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    material = nextMaterial;
    return () => nextMaterial.dispose();
  });

  useTask(() => {
    if (skyMesh && camera.current) {
      skyMesh.position.copy(camera.current.position);
    }
  });

  onDestroy(() => geometry.dispose());
</script>

{#if material}
  <T.Mesh
    bind:ref={skyMesh}
    {geometry}
    {material}
    renderOrder={-0.5}
    frustumCulled={false}
  />
{/if}
