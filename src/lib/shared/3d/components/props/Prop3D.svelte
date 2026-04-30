<script lang="ts">
  /**
   * Prop3D - Dispatcher Component
   *
   * Two-tier rendering:
   * 1. If a GLTF model exists in the registry → render GltfProp3D (high quality)
   * 2. Otherwise → fall back to procedural geometry component (always available)
   *
   * This is the single entry point for rendering any prop in 3D.
   * Scenes should use <Prop3D> instead of <Staff3D> directly.
   */

  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { PropState3D } from "../../domain/models/PropState3D";
  import { resolvePropModel } from "./prop-model-registry";
  import GltfProp3D from "./GltfProp3D.svelte";

  // Procedural fallback geometry components
  import Staff3D from "../Staff3D.svelte";
  import Club3D from "./Club3D.svelte";
  import Fan3D from "./Fan3D.svelte";
  import Hoop3D from "./Hoop3D.svelte";
  import Ball3D from "./Ball3D.svelte";
  import Torch3D from "./Torch3D.svelte";
  import Sword3D from "./Sword3D.svelte";
  import Buugeng3D from "./Buugeng3D.svelte";
  import Triad3D from "./Triad3D.svelte";
  import Doublestar3D from "./Doublestar3D.svelte";
  import Chicken3D from "./Chicken3D.svelte";
  import Guitar3D from "./Guitar3D.svelte";
  import Triquetra3D from "./Triquetra3D.svelte";
  import Eightrings3D from "./Eightrings3D.svelte";
  import Poi3D from "./Poi3D.svelte";

  interface Props {
    propType: PropType;
    propState: PropState3D;
    color: "blue" | "red";
    visible?: boolean;
    isActivePlayer?: boolean;
  }

  let {
    propType,
    propState,
    color,
    visible = true,
    isActivePlayer = false,
  }: Props = $props();

  // "Big" variants use a 1.4x scale on the base prop.
  const BIG_SCALE = 1.4;

  // Check if a GLTF model is available for this prop type.
  // resolvePropModel handles big variant → base type resolution.
  const gltfResolution = $derived(resolvePropModel(propType));
</script>

{#if visible}
  <!-- Tier 1: GLTF model (when available in registry) -->
  {#if gltfResolution}
    <GltfProp3D
      modelEntry={gltfResolution.entry}
      {propState}
      {color}
      {visible}
      {isActivePlayer}
      extraScale={gltfResolution.scale}
    />

  <!-- Tier 2: Procedural fallback geometry -->
  {:else if propType === PropType.STAFF || propType === PropType.SIMPLESTAFF || propType === PropType.STAFF2}
    <Staff3D {propState} {color} {visible} {isActivePlayer} />
  {:else if propType === PropType.BIGSTAFF}
    <Staff3D {propState} {color} {visible} {isActivePlayer} />

  {:else if propType === PropType.CLUB}
    <Club3D {propState} {color} {visible} {isActivePlayer} />
  {:else if propType === PropType.BIGCLUB}
    <Club3D {propState} {color} {visible} {isActivePlayer} scale={BIG_SCALE} />

  {:else if propType === PropType.FAN}
    <Fan3D {propState} {color} {visible} {isActivePlayer} />
  {:else if propType === PropType.BIGFAN}
    <Fan3D {propState} {color} {visible} {isActivePlayer} scale={BIG_SCALE} />

  {:else if propType === PropType.TRIAD}
    <Triad3D {propState} {color} {visible} {isActivePlayer} />
  {:else if propType === PropType.BIGTRIAD}
    <Triad3D {propState} {color} {visible} {isActivePlayer} scale={BIG_SCALE} />

  {:else if propType === PropType.MINIHOOP}
    <Hoop3D {propState} {color} {visible} {isActivePlayer} />
  {:else if propType === PropType.BIGHOOP}
    <Hoop3D {propState} {color} {visible} {isActivePlayer} scale={BIG_SCALE} />

  {:else if propType === PropType.BUUGENG || propType === PropType.FRACTALGENG}
    <Buugeng3D {propState} {color} {visible} {isActivePlayer} />
  {:else if propType === PropType.BIGBUUGENG}
    <Buugeng3D {propState} {color} {visible} {isActivePlayer} scale={BIG_SCALE} />

  {:else if propType === PropType.TRIGENG}
    <Buugeng3D {propState} {color} {visible} {isActivePlayer} />

  {:else if propType === PropType.TRIQUETRA || propType === PropType.TRIQUETRA2}
    <Triquetra3D {propState} {color} {visible} {isActivePlayer} />

  {:else if propType === PropType.SWORD}
    <Sword3D {propState} {color} {visible} {isActivePlayer} />

  {:else if propType === PropType.CHICKEN}
    <Chicken3D {propState} {color} {visible} {isActivePlayer} />
  {:else if propType === PropType.BIGCHICKEN}
    <Chicken3D {propState} {color} {visible} {isActivePlayer} scale={BIG_SCALE} />

  {:else if propType === PropType.GUITAR}
    <Guitar3D {propState} {color} {visible} {isActivePlayer} />
  {:else if propType === PropType.UKULELE}
    <Guitar3D {propState} {color} {visible} {isActivePlayer} scale={0.75} />

  {:else if propType === PropType.DOUBLESTAR}
    <Doublestar3D {propState} {color} {visible} {isActivePlayer} />
  {:else if propType === PropType.BIGDOUBLESTAR}
    <Doublestar3D {propState} {color} {visible} {isActivePlayer} scale={BIG_SCALE} />

  {:else if propType === PropType.EIGHTRINGS}
    <Eightrings3D {propState} {color} {visible} {isActivePlayer} />
  {:else if propType === PropType.BIGEIGHTRINGS}
    <Eightrings3D {propState} {color} {visible} {isActivePlayer} scale={BIG_SCALE} />

  {:else if propType === PropType.CONTACTBALL}
    <Ball3D {propState} {color} {visible} {isActivePlayer} />
  {:else if propType === PropType.BIGCONTACTBALL}
    <Ball3D {propState} {color} {visible} {isActivePlayer} scale={BIG_SCALE} />
  {:else if propType === PropType.DOUBLECONTACTBALL}
    <Ball3D {propState} {color} {visible} {isActivePlayer} />
  {:else if propType === PropType.BIGDOUBLECONTACTBALL}
    <Ball3D {propState} {color} {visible} {isActivePlayer} scale={BIG_SCALE} />

  {:else if propType === PropType.QUIAD}
    <Triad3D {propState} {color} {visible} {isActivePlayer} />

  {:else if propType === PropType.TORCH}
    <Torch3D {propState} {color} {visible} {isActivePlayer} />
  {:else if propType === PropType.BIGTORCH}
    <Torch3D {propState} {color} {visible} {isActivePlayer} scale={BIG_SCALE} />

  {:else if propType === PropType.POI}
    <Poi3D {propState} {color} {visible} {isActivePlayer} />

  {:else if propType === PropType.HAND}
    <!-- Hand = no prop visible, just the trail indicator -->
    <Staff3D {propState} {color} visible={false} {isActivePlayer} />

  {:else}
    <!-- Unknown prop type: fall back to staff -->
    <Staff3D {propState} {color} {visible} {isActivePlayer} />
  {/if}
{/if}
