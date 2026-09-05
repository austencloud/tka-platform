<script lang="ts">
  import { T } from "@threlte/core";
  import { useDraco, useGltf, useMeshopt } from "@threlte/extras";
  import { onDestroy, untrack } from "svelte";
  import type { Object3D } from "three";
  import type { FlowFestCarDynamics } from "$lib/features/flow-fest-sim/domain/flow-fest-car";
  import {
    buildFlowFestCarBody,
    disposeFlowFestCarBody,
    flowFestParkedCarModel,
    settleFlowFestParkedCarOnGround,
    type FlowFestCarBody,
  } from "./flow-fest-parked-cars";

  /**
   * The player's own car: the same catalogue body the lot instances, built
   * once as a single articulated object so its wheels can steer and spin.
   *
   * The body is chosen on the loadout screen and never changes mid-session;
   * the host keys this component on the model id, so the model is read once.
   */
  interface Props {
    modelId: string;
    paintIndex: number;
    /** Body centre on the ground plane; height comes from the terrain. */
    position: { x: number; z: number };
    dynamics: FlowFestCarDynamics;
    sampleGroundY: (x: number, z: number) => number;
    visible?: boolean;
    onReady?: (details: { wheels: number }) => void;
    onError?: (message: string) => void;
  }

  const props: Props = $props();
  const model = flowFestParkedCarModel(untrack(() => props.modelId));
  const loaderOptions = {
    dracoLoader: useDraco("/draco/"),
    meshoptDecoder: useMeshopt(),
  };

  interface CarAssetSource {
    subscribe: (run: (value: unknown) => void) => () => void;
    error: {
      subscribe: (run: (value: Error | undefined) => void) => () => void;
    };
  }

  const source = useGltf(model.url, loaderOptions) as unknown as CarAssetSource;
  let body = $state<FlowFestCarBody | null>(null);

  $effect(() => {
    const unsubscribers = [
      source.subscribe((value) => {
        const scene = (value as { scene?: Object3D } | undefined)?.scene;
        if (!scene || untrack(() => body)) return;
        const built = buildFlowFestCarBody(
          scene,
          model,
          untrack(() => props.paintIndex)
        );
        body = built;
        props.onReady?.({ wheels: built.wheels.length });
      }),
      source.error.subscribe((error) => {
        if (!error) return;
        console.error(
          `[flow-fest-sim] Driven-car asset failed to load: ${model.id} (${model.url})`,
          error
        );
        props.onError?.(error.message || String(error));
      }),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  });

  onDestroy(() => {
    if (body) disposeFlowFestCarBody(body);
  });

  // Placement yaw: the body's nose is local +X while the drive's heading is
  // the direction (sin h, cos h), a quarter turn apart.
  const yaw = $derived(props.dynamics.headingRadians - Math.PI / 2);
  // Four tyres on the terrain every frame, exactly as a parked body settles,
  // with the weight-transfer attitude from the drive added on top.
  const settled = $derived(
    settleFlowFestParkedCarOnGround(
      model,
      { x: props.position.x, z: props.position.z, rotation: yaw },
      props.sampleGroundY
    )
  );
  const pitch = $derived(settled.pitch + props.dynamics.bodyPitchRadians);
  const roll = $derived(settled.roll + props.dynamics.bodyRollRadians);
</script>

{#if body}
  <!--
    YZX reproduces the parked placement matrix (yaw, then pitch about the
    body's Z, then roll about its X); tests/unit/flow-fest-parked-cars.test.ts
    pins the order against flowFestParkedCarPlacementMatrix.
  -->
  <T.Group
    name={`FFS_DrivenCar_${model.id}`}
    position={[props.position.x, settled.y, props.position.z]}
    rotation={[roll, yaw, pitch, "YZX"]}
    visible={props.visible ?? true}
  >
    <T is={body.root} />
    {#each body.wheels as wheel (wheel.corner)}
      <!-- Front wheels yaw with the steering; every wheel spins on its axle. -->
      <T.Group
        name={`FFS_DrivenCar_Wheel_${wheel.corner}`}
        position={[wheel.center.x, wheel.center.y, wheel.center.z]}
        rotation={[
          0,
          wheel.steers ? props.dynamics.steeringRadians : 0,
          -props.dynamics.wheelTravelMeters / wheel.radiusMeters,
          "XYZ",
        ]}
      >
        {#each wheel.parts as part, index (index)}
          <T.Mesh
            geometry={part.geometry}
            material={part.material}
            castShadow
            receiveShadow
          />
        {/each}
      </T.Group>
    {/each}
  </T.Group>
{/if}
