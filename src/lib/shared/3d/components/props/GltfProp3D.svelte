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
  import { untrack } from "svelte";
  import { recolorPropModel } from "./prop-model-recolor";
  import { computePropRotation } from "./prop3d-transforms";
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
    isActivePlayer?: boolean;
    /** Extra scale multiplier (for big variants) */
    extraScale?: number;
  }

  const props: Props = $props();

  const propLayer = $derived(props.isActivePlayer ? LAYER_PLAYER_BODY : LAYER_WORLD);

  // Load the GLTF model — useGltf is a one-time hook call, untrack to suppress warning
  const gltf = useGltf(untrack(() => props.modelEntry.modelUrl));

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
    if (props.color !== lastColor || !coloredScene) {
      const clone = loaded.scene.clone(true);
      recolorPropModel(clone, props.color);
      // Enable shadow casting on all prop meshes
      clone.traverse((child: any) => {
        if (child.isMesh) child.castShadow = true;
      });
      coloredScene = clone;
      lastColor = props.color;
    }
  });

  // Rotation only — position is handled by the parent PerformerRig scene graph
  const rotation = $derived(computePropRotation(props.propState));

  // Combined scale: model's authored scale × big variant multiplier × user proportions ratio
  const effectiveScale = $derived.by((): [number, number, number] => {
    const s = props.modelEntry.scale * (props.extraScale ?? 1);
    return [s, s, s];
  });
</script>

{#if (props.visible ?? true) && coloredScene}
  <T.Group {rotation} layers={propLayer}>
    <T.Group
      scale={effectiveScale}
      position.y={props.modelEntry.gripOffsetY}
    >
      <T is={coloredScene} />
    </T.Group>
  </T.Group>
{/if}
