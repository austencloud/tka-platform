<script module lang="ts">
  import { TextureLoader } from "three";

  // One TextureLoader shared across all FramedSequence instances.
  // Creating a loader per-instance (or per prop change inside a $effect)
  // was wasteful - the loader itself is stateless and safe to share.
  const sharedLoader = new TextureLoader();
  sharedLoader.setCrossOrigin("anonymous");
</script>

<script lang="ts">
  import { T } from "@threlte/core";
  import { Color, LinearFilter, SRGBColorSpace } from "three";
  import type { Texture } from "three";
  import type { ExhibitSlot } from "../domain/museum-types";

  interface Props {
    slot: ExhibitSlot;
    thumbnailUrl: string;
    title?: string;
  }

  let { slot, thumbnailUrl, title = "" }: Props = $props();

  const FRAME_WIDTH = 1.2;
  const FRAME_HEIGHT = 1.2;
  const FRAME_BORDER = 0.08;
  const FRAME_DEPTH = 0.05;

  const goldColor = new Color(0xc9a227);
  const goldBright = new Color(0xe8d589);
  const darkBg = new Color(0x1a1a2e);

  // Load thumbnail texture
  let texture = $state<Texture | null>(null);
  let loadError = $state(false);

  $effect(() => {
    sharedLoader.load(
      thumbnailUrl,
      (tex) => {
        tex.minFilter = LinearFilter;
        tex.colorSpace = SRGBColorSpace;
        texture = tex;
      },
      undefined,
      () => { loadError = true; }
    );
  });
</script>

<T.Group
  position.x={slot.position.x}
  position.y={slot.position.y}
  position.z={slot.position.z}
  rotation.y={slot.rotationY}
>
  <!-- Outer frame -->
  <T.Mesh castShadow>
    <T.BoxGeometry args={[FRAME_WIDTH + FRAME_BORDER * 2, FRAME_HEIGHT + FRAME_BORDER * 2, FRAME_DEPTH]} />
    <T.MeshStandardMaterial color={goldColor} metalness={0.6} roughness={0.3} />
  </T.Mesh>

  <!-- Inner frame (brighter gold) -->
  <T.Mesh position.z={0.01}>
    <T.BoxGeometry args={[FRAME_WIDTH + FRAME_BORDER * 0.5, FRAME_HEIGHT + FRAME_BORDER * 0.5, FRAME_DEPTH]} />
    <T.MeshStandardMaterial color={goldBright} metalness={0.5} roughness={0.4} />
  </T.Mesh>

  <!-- Image plane or dark placeholder -->
  <T.Mesh position.z={FRAME_DEPTH / 2 + 0.001}>
    <T.PlaneGeometry args={[FRAME_WIDTH, FRAME_HEIGHT]} />
    {#if texture}
      <T.MeshBasicMaterial map={texture} />
    {:else}
      <T.MeshStandardMaterial color={loadError ? 0x4a1528 : darkBg} />
    {/if}
  </T.Mesh>
</T.Group>
