<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { T, useTask } from "@threlte/core";
  import { Box3, Quaternion, Vector3 } from "three";
  import type { Mesh, Object3D, SkinnedMesh } from "three";
  import { createAvatarServices, GripType, Plane } from "@austencloud/scene-3d";
  import type { PropState3D } from "@austencloud/scene-3d";
  import type { StressPoseId } from "./avatar-bakeoff-data";

  export interface AvatarBakeoffDiagnostics {
    status: "loading" | "ready" | "error";
    loadMs: number | null;
    mappedBones: string[];
    mappedBoneCount: number;
    skinnedMeshCount: number;
    skeletonBoneCount: number;
    leftArmChain: boolean;
    rightArmChain: boolean;
    leftLegChain: boolean;
    rightLegChain: boolean;
    fingerChains: boolean;
    sourceHeightMeters: number | null;
    normalizedHeightMeters: number | null;
    feetOffsetMeters: number | null;
    leftHandErrorMeters: number | null;
    rightHandErrorMeters: number | null;
    error: string | null;
  }

  interface Props {
    modelUrl: string;
    pose: StressPoseId;
    onDiagnostics: (diagnostics: AvatarBakeoffDiagnostics) => void;
  }

  const TARGET_HEIGHT_METERS = 1.8;

  const POSE_TARGETS: Record<
    StressPoseId,
    { left: [number, number, number]; right: [number, number, number] }
  > = {
    neutral: { left: [0.52, 1.08, 0.08], right: [-0.52, 1.08, 0.08] },
    overhead: { left: [0.3, 1.92, 0.08], right: [-0.3, 1.92, 0.08] },
    "cross-body": { left: [-0.34, 1.3, 0.2], right: [0.34, 1.3, 0.2] },
    depth: { left: [0.48, 1.18, 0.5], right: [-0.48, 1.18, -0.34] },
    low: { left: [0.46, 0.42, 0.14], right: [-0.46, 0.42, 0.14] },
  };

  let { modelUrl, pose, onDiagnostics }: Props = $props();
  let root = $state<Object3D | null>(null);
  let feetOffset = $state(0);
  let services: ReturnType<typeof createAvatarServices> | null = null;
  let settledPose = false;
  let leftStaff: Mesh | undefined;
  let rightStaff: Mesh | undefined;
  const leftHandWorld = new Vector3();
  const rightHandWorld = new Vector3();
  const knuckleWorld = new Vector3();
  const shaftPinkyAxis = new Vector3(0, -1, 0);

  const targets = POSE_TARGETS[pose];
  const leftProp = createPropState(targets.left);
  const rightProp = createPropState(targets.right);
  const propOrientations = {
    blue: leftProp.worldRotation,
    red: rightProp.worldRotation,
  } satisfies NonNullable<
    Parameters<
      ReturnType<typeof createAvatarServices>["animator"]["setPropsAndBlend"]
    >[3]
  >;

  function createPropState(position: [number, number, number]): PropState3D {
    return {
      centerPathAngle: 0,
      staffRotationAngle: 0,
      plane: Plane.WALL,
      worldPosition: new Vector3(...position),
      worldRotation: new Quaternion(),
      gripType: GripType.SQUARE,
    };
  }

  let currentDiagnostics: AvatarBakeoffDiagnostics = {
    status: "loading",
    loadMs: null,
    mappedBones: [],
    mappedBoneCount: 0,
    skinnedMeshCount: 0,
    skeletonBoneCount: 0,
    leftArmChain: false,
    rightArmChain: false,
    leftLegChain: false,
    rightLegChain: false,
    fingerChains: false,
    sourceHeightMeters: null,
    normalizedHeightMeters: null,
    feetOffsetMeters: null,
    leftHandErrorMeters: null,
    rightHandErrorMeters: null,
    error: null,
  };

  function report(partial: Partial<AvatarBakeoffDiagnostics>): void {
    currentDiagnostics = { ...currentDiagnostics, ...partial };
    onDiagnostics(currentDiagnostics);
  }

  onMount(async () => {
    report({ status: "loading" });
    const startedAt = performance.now();

    try {
      services = createAvatarServices({
        enableLocomotion: false,
        enableRootMotion: false,
        enableFootPlanting: false,
      });
      await services.skeleton.loadModel(modelUrl);

      const loadedRoot = services.skeleton.getRoot();
      if (!loadedRoot)
        throw new Error("Skeleton loader returned no scene root.");

      loadedRoot.updateMatrixWorld(true);
      const sourceBounds = new Box3().setFromObject(loadedRoot);
      const sourceHeight = sourceBounds.max.y - sourceBounds.min.y;

      services.skeleton.setHeight(TARGET_HEIGHT_METERS);
      feetOffset = services.skeleton.getFeetOffset();
      loadedRoot.traverse((child) => {
        const mesh = child as SkinnedMesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        // Keep the ground contact shadow, but remove directional-light acne
        // from the candidate itself so texture and deformation stay legible.
        mesh.receiveShadow = false;
      });

      const state = services.skeleton.getState();
      if (state.fingerChains) {
        services.fingers.initialize(state.fingerChains);
        services.fingers.setGrips(GripType.SQUARE, GripType.SQUARE);
      }

      root = loadedRoot;
      loadedRoot.updateMatrixWorld(true);
      const normalizedBounds = new Box3().setFromObject(loadedRoot);
      const skeletonBones = new Set<string>();
      for (const mesh of state.meshes) {
        for (const bone of mesh.skeleton.bones) skeletonBones.add(bone.uuid);
      }

      report({
        status: "ready",
        loadMs: performance.now() - startedAt,
        mappedBones: [...state.bones.keys()].sort(),
        mappedBoneCount: state.bones.size,
        skinnedMeshCount: state.meshes.length,
        skeletonBoneCount: skeletonBones.size,
        leftArmChain: state.leftArmChain !== null,
        rightArmChain: state.rightArmChain !== null,
        leftLegChain: state.leftLegChain !== null,
        rightLegChain: state.rightLegChain !== null,
        fingerChains: state.fingerChains !== null,
        sourceHeightMeters: sourceHeight,
        normalizedHeightMeters: normalizedBounds.max.y - normalizedBounds.min.y,
        feetOffsetMeters: feetOffset,
      });
    } catch (error) {
      report({
        status: "error",
        loadMs: performance.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  onDestroy(() => {
    services?.fingers.dispose();
    services?.skeleton.dispose();
  });

  useTask((delta) => {
    if (!services || !root) return;
    root.updateMatrixWorld(true);
    if (!settledPose) {
      // A fixed two seconds makes every screenshot deterministic even when
      // Chrome throttles this task-owned background tab.
      for (let frame = 0; frame < 120; frame += 1) {
        services.animator.setPropsAndBlend(
          leftProp,
          rightProp,
          undefined,
          propOrientations
        );
        services.animator.update(1 / 60);
        services.fingers.update(1 / 60);
        services.skeleton.updateMatrices();
      }

      settledPose = true;
    } else {
      services.animator.update(delta);
      services.fingers.update(delta);
      services.skeleton.updateMatrices();
    }

    // The animator supplies the achieved grip, including wrist limits. Keep
    // these inspection staffs in that grip, as the production performer does,
    // instead of leaving them floating at an unreachable requested position.
    const leftPalm = services.animator.getPalmWorldPoint("left", leftHandWorld);
    const rightPalm = services.animator.getPalmWorldPoint(
      "right",
      rightHandWorld
    );
    for (const [side, staff, palm] of [
      ["left", leftStaff, leftPalm],
      ["right", rightStaff, rightPalm],
    ] as const) {
      if (!staff || !palm) continue;
      staff.position.copy(palm);
      const axis = services.animator.getKnuckleLineWorld(side, knuckleWorld);
      if (axis) staff.quaternion.setFromUnitVectors(shaftPinkyAxis, axis);
    }
    report({
      leftHandErrorMeters: leftPalm
        ? leftPalm.distanceTo(leftProp.worldPosition)
        : null,
      rightHandErrorMeters: rightPalm
        ? rightPalm.distanceTo(rightProp.worldPosition)
        : null,
    });
  });
</script>

{#if root}
  <T.Group position.y={-feetOffset}>
    <T is={root} />
  </T.Group>

  <T.Mesh bind:ref={leftStaff} position={targets.left} castShadow>
    <T.CylinderGeometry args={[0.016, 0.016, 0.92, 16]} />
    <T.MeshStandardMaterial color="#3b82f6" roughness={0.34} />
  </T.Mesh>
  <T.Mesh bind:ref={rightStaff} position={targets.right} castShadow>
    <T.CylinderGeometry args={[0.016, 0.016, 0.92, 16]} />
    <T.MeshStandardMaterial color="#ef4444" roughness={0.34} />
  </T.Mesh>
{/if}
