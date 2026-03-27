<script lang="ts">
  /**
   * FramedSequence
   *
   * An ornate 3D picture frame displaying a sequence's thumbnail image.
   * Features multi-layer gilded frame with decorative elements.
   * Frame adjusts to match image aspect ratio.
   */

  import { T } from "@threlte/core";
  import { onDestroy } from "svelte";
  import { TextureLoader, LinearFilter, ClampToEdgeWrapping, SRGBColorSpace, type Texture } from "three";
  import type { ExhibitSlot } from "../../domain/models/GalleryLayout";
  import type { Exhibit } from "../../domain/models/Exhibit";
  import {
    FRAME_HEIGHT,
    FRAME_DEPTH,
    FRAME_BORDER,
  } from "../../domain/constants/gallery-dimensions";

  // Ornate frame colors
  const OUTER_FRAME_COLOR = "#8b6914"; // Darker gold (outer edge)
  const INNER_FRAME_COLOR = "#c9a227"; // Bright gold (inner detail)
  const ACCENT_COLOR = "#d4af37"; // Highlight gold

  interface Props {
    /** The exhibit to display */
    exhibit: Exhibit;
    /** The slot this frame occupies */
    slot: ExhibitSlot;
    /** Whether gallery lights are on (affects thumbnail variant) */
    lightsOn?: boolean;
  }

  let { exhibit, slot, lightsOn = true }: Props = $props();

  // State
  let texture = $state<Texture | null>(null);
  let imageAspect = $state(1); // width / height
  let loaded = $state(false);
  let error = $state<string | null>(null);
  let currentUrl = $state<string | null>(null);

  // Derive the appropriate thumbnail URL based on lights state
  // When lights are ON: use dark-mode thumbnails (white figures on dark bg)
  // When lights are OFF: use light-mode thumbnails (dark figures on light bg) for better visibility
  const thumbnailUrl = $derived.by(() => {
    const baseUrl = exhibit.thumbnailUrl;
    if (!baseUrl) return null;

    // Check if the URL has a _light or _dark suffix pattern
    // Firebase storage URLs typically have format: /sequenceId_dark.webp or /sequenceId_light.webp
    if (lightsOn) {
      // When lights are on, use dark mode thumbnails (they look better in bright gallery)
      return baseUrl.replace(/_light\.webp/, "_dark.webp");
    } else {
      // When lights are off, use light mode thumbnails (glowing effect in dark)
      return baseUrl.replace(/_dark\.webp/, "_light.webp");
    }
  });

  // Frame layer dimensions
  const outerBorder = FRAME_BORDER;
  const innerBorder = FRAME_BORDER * 0.6;
  const totalBorder = outerBorder + innerBorder;

  // Calculate frame dimensions based on image aspect ratio
  const baseHeight = FRAME_HEIGHT;
  const innerHeight = $derived(baseHeight - totalBorder * 2);
  const innerWidth = $derived(innerHeight * imageAspect);
  const middleWidth = $derived(innerWidth + innerBorder * 2);
  const middleHeight = $derived(innerHeight + innerBorder * 2);
  const outerWidth = $derived(middleWidth + outerBorder * 2);
  const outerHeight = $derived(middleHeight + outerBorder * 2);

  // Texture loader with CORS support
  const textureLoader = new TextureLoader();
  textureLoader.setCrossOrigin("anonymous");

  // Load the thumbnail image
  async function loadThumbnail(url: string) {
    if (!url) {
      error = "No thumbnail URL";
      return;
    }

    // Skip if same URL already loaded
    if (url === currentUrl && texture) return;

    // Cleanup previous texture
    if (texture) {
      texture.dispose();
      texture = null;
    }

    loaded = false;
    error = null;

    try {
      // Load texture directly - TextureLoader handles CORS internally
      const newTexture = await new Promise<Texture>((resolve, reject) => {
        textureLoader.load(
          url,
          (tex) => {
            // Get dimensions from the loaded image
            const img = tex.image as HTMLImageElement;
            if (img && img.width && img.height) {
              imageAspect = img.width / img.height;
            }

            tex.minFilter = LinearFilter;
            tex.magFilter = LinearFilter;
            tex.wrapS = ClampToEdgeWrapping;
            tex.wrapT = ClampToEdgeWrapping;
            tex.colorSpace = SRGBColorSpace; // Preserve original colors
            tex.needsUpdate = true;
            resolve(tex);
          },
          undefined,
          (err) => {
            console.error(`[FramedSequence] TextureLoader error:`, err);
            reject(new Error("Texture load failed"));
          }
        );
      });

      texture = newTexture;
      currentUrl = url;
      loaded = true;
    } catch (err) {
      console.error(`[FramedSequence] Failed to load ${exhibit.id}:`, err);
      error = err instanceof Error ? err.message : "Load failed";
    }
  }

  // Cleanup
  function cleanup() {
    if (texture) {
      texture.dispose();
      texture = null;
    }
  }

  // Reactive effect: load/reload texture when thumbnailUrl changes (due to lightsOn toggle)
  $effect(() => {
    if (thumbnailUrl) {
      loadThumbnail(thumbnailUrl);
    }
  });

  onDestroy(() => {
    cleanup();
  });
</script>

<T.Group
  position={[slot.position.x, slot.position.y, slot.position.z]}
  rotation.y={slot.rotation}
>
  <!-- OUTER FRAME LAYER (darker gold) -->
  <!-- Top outer -->
  <T.Mesh position={[0, middleHeight / 2 + outerBorder / 2, FRAME_DEPTH / 2]}>
    <T.BoxGeometry args={[outerWidth, outerBorder, FRAME_DEPTH]} />
    <T.MeshStandardMaterial color={OUTER_FRAME_COLOR} roughness={0.35} metalness={0.7} />
  </T.Mesh>
  <!-- Bottom outer -->
  <T.Mesh position={[0, -middleHeight / 2 - outerBorder / 2, FRAME_DEPTH / 2]}>
    <T.BoxGeometry args={[outerWidth, outerBorder, FRAME_DEPTH]} />
    <T.MeshStandardMaterial color={OUTER_FRAME_COLOR} roughness={0.35} metalness={0.7} />
  </T.Mesh>
  <!-- Left outer -->
  <T.Mesh position={[-middleWidth / 2 - outerBorder / 2, 0, FRAME_DEPTH / 2]}>
    <T.BoxGeometry args={[outerBorder, middleHeight, FRAME_DEPTH]} />
    <T.MeshStandardMaterial color={OUTER_FRAME_COLOR} roughness={0.35} metalness={0.7} />
  </T.Mesh>
  <!-- Right outer -->
  <T.Mesh position={[middleWidth / 2 + outerBorder / 2, 0, FRAME_DEPTH / 2]}>
    <T.BoxGeometry args={[outerBorder, middleHeight, FRAME_DEPTH]} />
    <T.MeshStandardMaterial color={OUTER_FRAME_COLOR} roughness={0.35} metalness={0.7} />
  </T.Mesh>

  <!-- INNER FRAME LAYER (brighter gold, raised) -->
  <!-- Top inner -->
  <T.Mesh position={[0, innerHeight / 2 + innerBorder / 2, FRAME_DEPTH / 2 + 2]}>
    <T.BoxGeometry args={[middleWidth - 4, innerBorder, FRAME_DEPTH * 0.6]} />
    <T.MeshStandardMaterial color={INNER_FRAME_COLOR} roughness={0.25} metalness={0.8} />
  </T.Mesh>
  <!-- Bottom inner -->
  <T.Mesh position={[0, -innerHeight / 2 - innerBorder / 2, FRAME_DEPTH / 2 + 2]}>
    <T.BoxGeometry args={[middleWidth - 4, innerBorder, FRAME_DEPTH * 0.6]} />
    <T.MeshStandardMaterial color={INNER_FRAME_COLOR} roughness={0.25} metalness={0.8} />
  </T.Mesh>
  <!-- Left inner -->
  <T.Mesh position={[-innerWidth / 2 - innerBorder / 2, 0, FRAME_DEPTH / 2 + 2]}>
    <T.BoxGeometry args={[innerBorder, innerHeight, FRAME_DEPTH * 0.6]} />
    <T.MeshStandardMaterial color={INNER_FRAME_COLOR} roughness={0.25} metalness={0.8} />
  </T.Mesh>
  <!-- Right inner -->
  <T.Mesh position={[innerWidth / 2 + innerBorder / 2, 0, FRAME_DEPTH / 2 + 2]}>
    <T.BoxGeometry args={[innerBorder, innerHeight, FRAME_DEPTH * 0.6]} />
    <T.MeshStandardMaterial color={INNER_FRAME_COLOR} roughness={0.25} metalness={0.8} />
  </T.Mesh>

  <!-- CORNER ACCENTS (decorative spheres) -->
  {#each [{ x: -1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: 1, y: 1 }] as corner}
    <T.Mesh
      position={[
        corner.x * (middleWidth / 2 + outerBorder / 2),
        corner.y * (middleHeight / 2 + outerBorder / 2),
        FRAME_DEPTH / 2 + 4,
      ]}
    >
      <T.SphereGeometry args={[outerBorder * 0.4, 8, 8]} />
      <T.MeshStandardMaterial color={ACCENT_COLOR} roughness={0.2} metalness={0.9} />
    </T.Mesh>
  {/each}

  <!-- Backing (prevents see-through) -->
  <T.Mesh position={[0, 0, FRAME_DEPTH / 2 - 1]}>
    <T.PlaneGeometry args={[innerWidth, innerHeight]} />
    <T.MeshBasicMaterial color="#0a0a0a" />
  </T.Mesh>

  <!-- Image plane -->
  {#if texture && loaded}
    <T.Mesh position={[0, 0, FRAME_DEPTH / 2 + 1]}>
      <T.PlaneGeometry args={[innerWidth, innerHeight]} />
      <T.MeshBasicMaterial map={texture} toneMapped={false} />
    </T.Mesh>
  {:else if error}
    <!-- Error state - dark placeholder -->
    <T.Mesh position={[0, 0, FRAME_DEPTH / 2 + 1]}>
      <T.PlaneGeometry args={[innerWidth, innerHeight]} />
      <T.MeshBasicMaterial color="#1a0808" />
    </T.Mesh>
  {:else}
    <!-- Loading state -->
    <T.Mesh position={[0, 0, FRAME_DEPTH / 2 + 1]}>
      <T.PlaneGeometry args={[innerWidth, innerHeight]} />
      <T.MeshBasicMaterial color="#111111" />
    </T.Mesh>
  {/if}
</T.Group>
