<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { OrthographicCamera, Vector3 } from "three";
  import { getContactLabContext } from "../context/contact-lab-context";

  interface Props {
    aspect: number;
  }

  let { aspect }: Props = $props();
  const labState = getContactLabContext();
  let camera = $state.raw<OrthographicCamera | undefined>(undefined);

  const halfWidth = $derived(
    aspect < 0.75
      ? 1.45
      : aspect < 1
        ? 1.7
        : Math.min(3.6, Math.max(3.15, 1.85 * aspect))
  );
  const halfHeight = $derived(
    aspect < 1
      ? halfWidth / Math.max(aspect, 0.4)
      : Math.max(1.85, 3.15 / aspect)
  );

  const targetPosition = new Vector3();
  const targetUp = new Vector3();
  const lookTarget = new Vector3(0, 0.18, -0.24);

  useTask((delta) => {
    if (!camera) return;
    if (labState.cameraPreset === "top") {
      targetPosition.set(0, 6.6, 0.08);
      targetUp.set(0, 0, -1);
    } else if (labState.cameraPreset === "low") {
      targetPosition.set(0, 2.55, 4.75);
      targetUp.set(0, 1, 0);
    } else {
      targetPosition.set(0, 4.7, 3.25);
      targetUp.set(0, 1, -0.1).normalize();
    }

    const blend = 1 - Math.exp(-delta * 6.5);
    camera.position.lerp(targetPosition, blend);
    camera.up.lerp(targetUp, blend).normalize();
    camera.lookAt(lookTarget);
    camera.updateProjectionMatrix();
  });
</script>

<T.OrthographicCamera
  bind:ref={camera}
  makeDefault
  manual
  position={[0, 4.7, 3.25]}
  left={-halfWidth}
  right={halfWidth}
  top={halfHeight}
  bottom={-halfHeight}
  near={0.1}
  far={30}
/>
