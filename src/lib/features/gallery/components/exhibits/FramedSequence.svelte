<script lang="ts">
  /**
   * FramedSequence
   *
   * A 3D picture frame displaying a sequence thumbnail on the gallery wall.
   * The frame consists of border pieces and an inner plane with the image texture.
   */

  import { T } from "@threlte/core";
  import { TextureLoader, SRGBColorSpace, CanvasTexture } from "three";
  import type { ExhibitSlot } from "../../domain/models/GalleryLayout";
  import type { Exhibit } from "../../domain/models/Exhibit";
  import {
    FRAME_WIDTH,
    FRAME_HEIGHT,
    FRAME_DEPTH,
    FRAME_BORDER,
    FRAME_COLOR,
  } from "../../domain/constants/gallery-dimensions";

  interface Props {
    /** The exhibit to display */
    exhibit: Exhibit;
    /** The slot this frame occupies */
    slot: ExhibitSlot;
  }

  let { exhibit, slot }: Props = $props();

  // Inner dimensions (where the image goes)
  const innerWidth = FRAME_WIDTH - FRAME_BORDER * 2;
  const innerHeight = FRAME_HEIGHT - FRAME_BORDER * 2;

  // Create a placeholder texture with sequence name
  function createPlaceholderTexture(): CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;

    // Dark gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, "#2d1b4e");
    gradient.addColorStop(1, "#1a1a2e");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    // Decorative border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, 472, 472);

    // Sequence name
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const displayName =
      exhibit.sequence.word ||
      exhibit.sequence.displayName ||
      exhibit.sequence.name ||
      "Sequence";

    // Word wrap for long names
    const words = displayName.split("");
    if (displayName.length > 8) {
      ctx.font = "bold 28px Arial";
    }
    ctx.fillText(displayName.slice(0, 16), 256, 220);

    // Beat count
    ctx.font = "20px Arial";
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    const beatCount = exhibit.sequence.beats?.length ?? 0;
    ctx.fillText(`${beatCount} beats`, 256, 280);

    // Decorative icon placeholder
    ctx.font = "48px Arial";
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillText("🎭", 256, 380);

    const texture = new CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  // Initialize with placeholder, try to load real thumbnail
  let imageTexture = $state<THREE.Texture>(createPlaceholderTexture());

  // Try to load actual thumbnail if available
  $effect(() => {
    if (exhibit.thumbnailUrl) {
      const loader = new TextureLoader();
      loader.load(
        exhibit.thumbnailUrl,
        (tex) => {
          tex.colorSpace = SRGBColorSpace;
          imageTexture = tex;
        },
        undefined,
        (err) => {
          console.debug(`[FramedSequence] Failed to load thumbnail: ${exhibit.thumbnailUrl}`, err);
          // Keep placeholder on error
        }
      );
    }
  });
</script>

<T.Group
  position={[slot.position.x, slot.position.y, slot.position.z]}
  rotation.y={slot.rotation}
>
  <!-- Frame border pieces -->
  <!-- Top border -->
  <T.Mesh position={[0, innerHeight / 2 + FRAME_BORDER / 2, FRAME_DEPTH / 2]}>
    <T.BoxGeometry args={[FRAME_WIDTH, FRAME_BORDER, FRAME_DEPTH]} />
    <T.MeshStandardMaterial color={FRAME_COLOR} roughness={0.3} metalness={0.5} />
  </T.Mesh>

  <!-- Bottom border -->
  <T.Mesh position={[0, -innerHeight / 2 - FRAME_BORDER / 2, FRAME_DEPTH / 2]}>
    <T.BoxGeometry args={[FRAME_WIDTH, FRAME_BORDER, FRAME_DEPTH]} />
    <T.MeshStandardMaterial color={FRAME_COLOR} roughness={0.3} metalness={0.5} />
  </T.Mesh>

  <!-- Left border -->
  <T.Mesh position={[-innerWidth / 2 - FRAME_BORDER / 2, 0, FRAME_DEPTH / 2]}>
    <T.BoxGeometry args={[FRAME_BORDER, innerHeight, FRAME_DEPTH]} />
    <T.MeshStandardMaterial color={FRAME_COLOR} roughness={0.3} metalness={0.5} />
  </T.Mesh>

  <!-- Right border -->
  <T.Mesh position={[innerWidth / 2 + FRAME_BORDER / 2, 0, FRAME_DEPTH / 2]}>
    <T.BoxGeometry args={[FRAME_BORDER, innerHeight, FRAME_DEPTH]} />
    <T.MeshStandardMaterial color={FRAME_COLOR} roughness={0.3} metalness={0.5} />
  </T.Mesh>

  <!-- Inner image plane -->
  <T.Mesh position={[0, 0, FRAME_DEPTH / 2 + 1]}>
    <T.PlaneGeometry args={[innerWidth, innerHeight]} />
    <T.MeshBasicMaterial map={imageTexture} />
  </T.Mesh>
</T.Group>
