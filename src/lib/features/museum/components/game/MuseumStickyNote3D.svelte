<script module lang="ts">
  import { BoxGeometry, CanvasTexture, MeshStandardMaterial, PlaneGeometry } from "three";

  // Shared by every note in the building.
  const NOTE_SIZE = 0.35;
  const noteGeo = new PlaneGeometry(NOTE_SIZE, NOTE_SIZE);
  const postGeo = new BoxGeometry(0.04, 1.1, 0.04);
  const postMat = new MeshStandardMaterial({ color: "#5a4a36", roughness: 0.9 });
  const baseGeo = new BoxGeometry(0.28, 0.03, 0.28);
</script>

<script lang="ts">
  /**
   * A sticky note K stuck up on a post where there was nothing to stick it to:
   * the cave chambers, the Crumble. Positioned by the scene from room bounds.
   */
  import { T } from "@threlte/core";
  import { onDestroy } from "svelte";
  import { generateStickyNoteCanvas } from "../../services/plaque-texture-generator";

  interface Props {
    id: string;
    worldX: number;
    worldZ: number;
    /** Floor height at the post. */
    worldY?: number;
    /** 0 faces south (+Z). */
    yaw?: number;
    text: string;
  }

  const props: Props = $props();
  const worldX = props.worldX;
  const worldZ = props.worldZ;
  const worldY = props.worldY ?? 0;
  const yaw = props.yaw ?? 0;

  const canvas = generateStickyNoteCanvas(props.text, `note-${props.id}`);
  const texture = new CanvasTexture(canvas as unknown as HTMLCanvasElement);
  texture.needsUpdate = true;
  const noteMat = new MeshStandardMaterial({
    map: texture,
    emissive: "#8a857a",
    emissiveIntensity: 0.25,
    emissiveMap: texture,
    roughness: 0.9,
  });

  const NOTE_Y = 1.15;

  onDestroy(() => {
    noteMat.dispose();
    texture.dispose();
  });
</script>

<T.Group name={`note-${props.id}`} position={[worldX, worldY, worldZ]} rotation.y={yaw}>
  <T.Mesh geometry={baseGeo} material={postMat} position.y={0.015} />
  <T.Mesh geometry={postGeo} material={postMat} position.y={0.55} />
  <!-- Note leans back a touch on the post face (+Z is the viewer's side). -->
  <T.Mesh
    geometry={noteGeo}
    material={noteMat}
    position={[0, NOTE_Y, 0.025]}
    rotation.x={-0.08}
    rotation.z={0.05}
  />
</T.Group>
