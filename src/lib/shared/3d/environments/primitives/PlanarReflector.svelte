<script lang="ts">
  /**
   * PlanarReflector — the one owner of real-time planar reflection.
   *
   * Extracted from MuseumMirror, which coupled the technique to a gilded wall
   * frame and so could not be reused for a horizontal water surface. The
   * reflector is added directly to the Threlte scene rather than through
   * T.Primitive: onBeforeRender only fires for objects the renderer owns, and
   * without it the reflection texture never updates and the surface renders
   * black.
   */
  import { useThrelte } from "@threlte/core";
  import { onMount } from "svelte";
  import { Reflector } from "three/examples/jsm/objects/Reflector.js";
  import { PlaneGeometry } from "three";

  interface Props {
    width?: number;
    height?: number;
    /** Reflection render-target size. Water can afford less than a mirror. */
    textureWidth?: number;
    textureHeight?: number;
    /** Tint multiplied into the reflection. Darker reads as deeper water. */
    color?: number;
    position?: [number, number, number];
    /** Radians. A floor-plane reflector is [-Math.PI / 2, 0, 0]. */
    rotation?: [number, number, number];
    clipBias?: number;
    /** False keeps the surface mounted but skips its full-scene reflection pass. */
    active?: boolean;
  }

  const props: Props = $props();

  const { scene } = useThrelte();

  const width = props.width ?? 1.5;
  const height = props.height ?? 2.5;
  const textureWidth = props.textureWidth ?? 512;
  const textureHeight = props.textureHeight ?? 768;
  const color = props.color ?? 0xc8b890;
  const position = props.position ?? ([0, 1.5, 0] as [number, number, number]);
  const rotation = props.rotation ?? ([0, 0, 0] as [number, number, number]);
  const clipBias = props.clipBias ?? 0.003;
  let reflector = $state.raw<Reflector | null>(null);

  $effect(() => {
    if (reflector) {
      reflector.visible = props.active !== false;
    }
  });

  onMount(() => {
    const geometry = new PlaneGeometry(width, height);
    reflector = new Reflector(geometry, {
      clipBias,
      textureWidth,
      textureHeight,
      color,
    });

    reflector.position.set(...position);
    reflector.rotation.set(...rotation);
    reflector.visible = props.active !== false;

    // Threlte 8's scene context IS the Scene. An earlier `scene.current` here
    // was always undefined, so the guard swallowed every reflector and the
    // surface rendered black — the bug that made the grotto look waterless.
    scene.add(reflector);

    return () => {
      if (!reflector) return;
      scene.remove(reflector);
      reflector.getRenderTarget().dispose();
      reflector.material.dispose();
      geometry.dispose();
      reflector = null;
    };
  });
</script>
