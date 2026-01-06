<script lang="ts">
  /**
   * ExhibitLabel
   *
   * A placard/label below the frame showing sequence info.
   * Uses CanvasTexture to render text in 3D.
   */

  import { T } from "@threlte/core";
  import { CanvasTexture } from "three";
  import type { ExhibitSlot } from "../../domain/models/GalleryLayout";
  import type { Exhibit } from "../../domain/models/Exhibit";
  import { FRAME_HEIGHT, FRAME_BORDER } from "../../domain/constants/gallery-dimensions";

  interface Props {
    /** The exhibit to label */
    exhibit: Exhibit;
    /** The slot this label belongs to */
    slot: ExhibitSlot;
  }

  let { exhibit, slot }: Props = $props();

  // Label dimensions
  const labelWidth = 120;
  const labelHeight = 40;

  // Position below the frame
  const labelY = slot.position.y - FRAME_HEIGHT / 2 - FRAME_BORDER - labelHeight / 2 - 10;

  // Create text texture
  function createLabelTexture(): CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 256, 64);

    // Title text
    ctx.fillStyle = "#1a1a2e";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const title =
      exhibit.sequence.displayName ||
      exhibit.sequence.name ||
      exhibit.sequence.word ||
      "Untitled";
    ctx.fillText(title.slice(0, 20), 128, 8);

    // Author text (if available)
    const author = exhibit.sequence.author || exhibit.sequence.ownerDisplayName;
    if (author) {
      ctx.fillStyle = "#666666";
      ctx.font = "14px Arial";
      ctx.fillText(`by ${author.slice(0, 18)}`, 128, 36);
    }

    const texture = new CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  const labelTexture = createLabelTexture();
</script>

<T.Group
  position={[slot.position.x, labelY, slot.position.z]}
  rotation.y={slot.rotation}
>
  <T.Mesh position={[0, 0, 5]}>
    <T.PlaneGeometry args={[labelWidth, labelHeight]} />
    <T.MeshBasicMaterial map={labelTexture} />
  </T.Mesh>
</T.Group>
