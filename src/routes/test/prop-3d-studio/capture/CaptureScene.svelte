<!--
  Build-preview capture scene. Renders one prop through the real Prop3D
  dispatcher (same models the studio shows), auto-framed against the picker
  tile's background so screenshots drop straight into
  static/images/props/build-previews/.

  The camera re-frames every task tick: GLTF-tier props stream in after
  mount, so a one-shot fit would frame an empty box. Once the bounding box
  has been non-empty and stable for FRAMES_STABLE ticks, the page flags
  document.body.dataset.captureReady for the capture driver.
-->
<script lang="ts">
  import { T, useTask, useThrelte } from "@threlte/core";
  import {
    Box3,
    Color,
    Group,
    PerspectiveCamera,
    Vector3,
    Quaternion,
  } from "three";
  import { Plane, Prop3D, type PropType } from "@austencloud/scene-3d";

  interface Props {
    propType: PropType;
    /** Presentation rotation of the whole prop, degrees. */
    rotationDeg: { x: number; y: number; z: number };
    /** Multiplier on the auto-framed camera distance. <1 zooms in. */
    zoom: number;
  }

  let { propType, rotationDeg, zoom }: Props = $props();

  const FOV_DEG = 28;
  const ASPECT = 1280 / 480;
  const MARGIN = 1.1;
  const FRAMES_STABLE = 30;

  const { scene } = useThrelte();
  scene.background = new Color("#070911");

  const propState = {
    centerPathAngle: 0,
    staffRotationAngle: 0,
    plane: Plane.WALL,
    worldPosition: new Vector3(0, 0, 0),
    worldRotation: new Quaternion(),
  };

  let group = $state<Group | undefined>(undefined);
  let camera = $state<PerspectiveCamera | undefined>(undefined);

  const rotationRad = $derived({
    x: (rotationDeg.x * Math.PI) / 180,
    y: (rotationDeg.y * Math.PI) / 180,
    z: (rotationDeg.z * Math.PI) / 180,
  });

  const box = new Box3();
  const center = new Vector3();
  const size = new Vector3();
  let lastSizeKey = "";
  let stableFrames = 0;

  useTask(() => {
    if (!group || !camera) return;

    box.setFromObject(group);
    if (box.isEmpty()) return;

    box.getCenter(center);
    box.getSize(size);

    const halfFov = (FOV_DEG * Math.PI) / 360;
    const halfHFov = Math.atan(Math.tan(halfFov) * ASPECT);
    const distForHeight = (size.y / 2) / Math.tan(halfFov);
    const distForWidth = (size.x / 2) / Math.tan(halfHFov);
    const distance =
      (Math.max(distForHeight, distForWidth) * MARGIN + size.z / 2) * zoom;

    camera.position.set(center.x, center.y, center.z + distance);
    camera.lookAt(center);

    const sizeKey = `${size.x.toFixed(3)}:${size.y.toFixed(3)}:${size.z.toFixed(3)}`;
    if (sizeKey === lastSizeKey) {
      stableFrames += 1;
    } else {
      stableFrames = 0;
      lastSizeKey = sizeKey;
    }

    document.body.dataset.captureReady =
      stableFrames >= FRAMES_STABLE ? "1" : "0";
  });
</script>

<T.PerspectiveCamera
  bind:ref={camera}
  makeDefault
  fov={FOV_DEG}
  near={0.01}
  far={100}
  position={[0, 0, 4]}
/>

<T.AmbientLight intensity={0.7} color="#ffffff" />
<T.DirectionalLight position={[2.5, 3, 4]} intensity={1.5} color="#ffffff" />
<T.DirectionalLight position={[-3, 1, 2]} intensity={0.55} color="#dfe6ff" />
<T.DirectionalLight position={[0, 2, -4]} intensity={0.8} color="#ffffff" />

<T.Group
  bind:ref={group}
  rotation={[rotationRad.x, rotationRad.y, rotationRad.z]}
>
  <Prop3D {propType} {propState} color="blue" isActivePlayer />
</T.Group>
