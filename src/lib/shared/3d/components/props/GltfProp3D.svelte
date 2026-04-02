<script lang="ts">
  /**
   * GltfProp3D — Renders a prop from a loaded GLTF model.
   *
   * Loads a .glb file, clones the scene, recolors it to blue/red,
   * and positions it using the same transform pipeline as all other props.
   *
   * Falls back gracefully: if the model hasn't loaded yet, renders nothing
   * (the parent Prop3D component shows procedural geometry as fallback).
   */

  import { T } from "@threlte/core";
  import { useGltf } from "@threlte/extras";
  import { recolorPropModel } from "./prop-model-recolor";
  import { computePropPosition, computePropRotation } from "./prop3d-transforms";
  import { userProportionsState } from "../../state/user-proportions-state.svelte";
  import {
    LAYER_WORLD,
    LAYER_PLAYER_BODY,
  } from "$lib/shared/3d/layers/layer-constants";
  import type { PropState3D } from "../../domain/models/PropState3D";
  import type { PropModelEntry } from "./prop-model-registry";
  import type { Object3D } from "three";

  interface Props {
    modelEntry: PropModelEntry;
    propState: PropState3D;
    color: "blue" | "red";
    visible?: boolean;
    avatarPosition?: { x: number; y: number; z: number };
    facingAngle?: number;
    gridOffset?: number;
    isActivePlayer?: boolean;
    /** Extra scale multiplier (for big variants) */
    extraScale?: number;
  }

  let {
    modelEntry,
    propState,
    color,
    visible = true,
    avatarPosition = { x: 0, y: 0, z: 0 },
    facingAngle = 0,
    gridOffset = 0,
    isActivePlayer = false,
    extraScale = 1,
  }: Props = $props();

  const propLayer = $derived(isActivePlayer ? LAYER_PLAYER_BODY : LAYER_WORLD);

  // Load the GLTF model
  const gltf = useGltf(modelEntry.modelUrl);

  // Clone and recolor the scene when the model loads or color changes.
  // We need a fresh clone for each color to avoid shared material mutation.
  let coloredScene = $state<Object3D | null>(null);
  let lastColor = $state<string>("");

  $effect(() => {
    const loaded = $gltf;
    if (!loaded) {
      coloredScene = null;
      return;
    }

    // Re-clone whenever the color changes
    if (color !== lastColor || !coloredScene) {
      const clone = loaded.scene.clone(true);
      recolorPropModel(clone, color);
      coloredScene = clone;
      lastColor = color;
    }
  });

  // Transform calculations (same pipeline as procedural props)
  const position = $derived.by(() =>
    computePropPosition(propState, avatarPosition, facingAngle, gridOffset)
  );
  const rotation = $derived.by(() =>
    computePropRotation(propState, facingAngle)
  );

  // Combined scale: model's authored scale × big variant multiplier × user proportions ratio
  const effectiveScale = $derived.by((): [number, number, number] => {
    const s = modelEntry.scale * extraScale;
    return [s, s, s];
  });
</script>

{#if visible && coloredScene}
  <T.Group {position} {rotation} layers={propLayer}>
    <T.Group
      scale={effectiveScale}
      position.y={modelEntry.gripOffsetY}
    >
      <T is={coloredScene} />
    </T.Group>
  </T.Group>
{/if}
