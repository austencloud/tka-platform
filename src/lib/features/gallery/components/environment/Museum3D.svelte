<script lang="ts">
  /**
   * Museum3D
   *
   * Loads a hand-crafted museum model from a glTF/GLB file.
   * Extracts exhibit slot positions from:
   * 1. Empty objects named Slot_* (preferred - explicit markers)
   * 2. Painting/frame meshes (fallback - auto-detect from denis_cliofas models)
   *
   * Replaces procedural geometry with a visually-designed 3D model.
   */

  import { T } from "@threlte/core";
  import { useGltf } from "@threlte/extras";
  import { Box3, Vector3, Mesh } from "three";
  import type { Object3D, Material } from "three";
  import type { ModelSlot } from "../../services/implementations/MuseumModelLoader";

  interface Props {
    /** Path to the museum glTF/GLB file (relative to static/) */
    modelPath: string;
    /** Callback when slots are extracted from the model */
    onSlotsLoaded?: (slots: ModelSlot[]) => void;
    /** Whether to cast shadows */
    castShadow?: boolean;
    /** Whether to receive shadows */
    receiveShadow?: boolean;
  }

  let {
    modelPath,
    onSlotsLoaded,
    castShadow = true,
    receiveShadow = true,
  }: Props = $props();

  // Load the museum model - useGltf returns an async store
  // Note: useGltf is a Threlte hook that must run at init, can't be reactive
  const getPath = () => modelPath;
  const gltf = useGltf(getPath());

  // Track if we've already extracted slots
  let slotsExtracted = $state(false);

  // Extract slots when model loads
  $effect(() => {
    if ($gltf && !slotsExtracted) {
      // First try explicit Slot_ markers
      let slots = extractExplicitSlots($gltf.scene);

      // If no explicit slots, try to find painting meshes
      if (slots.length === 0) {
        slots = extractPaintingSlots($gltf.scene);
      }

      slotsExtracted = true;

      if (onSlotsLoaded) {
        onSlotsLoaded(slots);
      }
    }
  });

  /**
   * Extract exhibit slots from Empty objects named Slot_*
   */
  function extractExplicitSlots(scene: Object3D): ModelSlot[] {
    const slots: ModelSlot[] = [];

    scene.traverse((object) => {
      if (object.name.startsWith("Slot_")) {
        const slot = parseExplicitSlot(object);
        if (slot) {
          slots.push(slot);
        }
      }
    });

    slots.sort((a, b) => a.id.localeCompare(b.id));
    return slots;
  }

  /**
   * Extract slots by finding painting/frame meshes.
   * Works with denis_cliofas Art Gallery model structure.
   */
  function extractPaintingSlots(scene: Object3D): ModelSlot[] {
    const slots: ModelSlot[] = [];
    let slotIndex = 0;

    scene.traverse((object) => {
      // Look for painting-related mesh names
      const name = object.name.toLowerCase();
      const isPainting =
        name.includes("painting") ||
        name.includes("paiting") || // Typo in the model
        name.includes("frame") ||
        name.includes("canvas") ||
        name.includes("artwork");

      if (isPainting && object instanceof Mesh) {
        // Get world position of this mesh
        const worldPos = new Vector3();
        object.getWorldPosition(worldPos);

        // Get bounding box for size/center
        const box = new Box3().setFromObject(object);
        const center = new Vector3();
        box.getCenter(center);

        // Calculate facing direction from mesh normal or parent
        // For now, estimate from parent name
        const parentName = object.parent?.parent?.name?.toLowerCase() || "";
        let rotation = 0;
        if (parentName.includes("inside")) {
          rotation = Math.PI; // Face inward
        }

        const slot: ModelSlot = {
          id: `painting_${slotIndex}`,
          position: {
            x: center.x,
            y: center.y,
            z: center.z,
          },
          rotation,
          slotType: "standard",
          roomId: parentName.includes("outside") ? "outside" : "inside",
        };

        slots.push(slot);
        slotIndex++;
      }
    });

    return slots;
  }

  /**
   * Parse a slot from a Blender Empty object.
   */
  function parseExplicitSlot(object: Object3D): ModelSlot | null {
    const parts = object.name.split("_");

    if (parts.length < 2) {
      return null;
    }

    const roomParts = parts.slice(1, parts.length - 1);
    const roomId = roomParts.join("_").toLowerCase();
    const slotType = parseSlotType(object.userData);

    return {
      id: object.name,
      position: {
        x: object.position.x,
        y: object.position.y,
        z: object.position.z,
      },
      rotation: object.rotation.y,
      slotType,
      roomId: roomId || "unknown",
    };
  }

  /**
   * Parse slot type from Blender custom properties.
   */
  function parseSlotType(
    userData: Record<string, unknown>
  ): ModelSlot["slotType"] {
    const rawType = userData?.slot_type;

    if (rawType === "large") return "large";
    if (rawType === "video") return "video";

    return "standard";
  }
</script>

{#if $gltf}
  <T
    is={$gltf.scene}
    {castShadow}
    {receiveShadow}
  />
{:else}
  <!-- Loading state - show placeholder geometry -->
  <T.Mesh position={[0, 0.5, 0]}>
    <T.BoxGeometry args={[1, 1, 1]} />
    <T.MeshStandardMaterial color="#4488ff" />
  </T.Mesh>
  <T.Mesh rotation.x={-Math.PI / 2} position={[0, 0, 0]}>
    <T.PlaneGeometry args={[20, 20]} />
    <T.MeshStandardMaterial color="#333333" />
  </T.Mesh>
{/if}

<!-- Always render a ground plane for reference -->
<T.Mesh rotation.x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow>
  <T.PlaneGeometry args={[100, 100]} />
  <T.MeshStandardMaterial color="#222222" />
</T.Mesh>
