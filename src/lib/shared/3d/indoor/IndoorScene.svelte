<script lang="ts">
  /**
   * IndoorScene
   *
   * Lightweight Threlte scene for enclosed indoor rooms. Wraps GalleryCanvas
   * (WebGPU support) and delegates physics, camera, input, and mesh rendering
   * to IndoorSceneContent (which has access to useThrelte() context).
   *
   * Usage:
   *   <IndoorScene {room} eyeHeight={1.7} moveSpeed={2.5}>
   *     <MyWingContent />
   *   </IndoorScene>
   */

  import { type Snippet } from "svelte";
  import GalleryCanvas from "$lib/features/realm/destinations/gallery/components/GalleryCanvas.svelte";
  import IndoorSceneContent from "./IndoorSceneContent.svelte";
  import type { SolvedRoom } from "./domain/room-types";

  interface Props {
    room: SolvedRoom;
    eyeHeight?: number;
    moveSpeed?: number;
    gravity?: number;
    onPositionChange?: (pos: { x: number; y: number; z: number }) => void;
    children: Snippet;
  }

  let {
    room,
    eyeHeight = 1.7,
    moveSpeed = 2.5,
    gravity = -9.81,
    onPositionChange,
    children,
  }: Props = $props();
</script>

<GalleryCanvas renderingBackend="webgpu-auto" autoRender={true} toneMapping={undefined}>
  <IndoorSceneContent {room} {eyeHeight} {moveSpeed} {gravity} {onPositionChange}>
    {@render children()}
  </IndoorSceneContent>
</GalleryCanvas>
