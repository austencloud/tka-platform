<!--
  HandPoseEditor.svelte — Debug tool for authoring finger grip poses.
  Renders a close-up hand with per-joint sliders and "Copy as JSON" export.
  Lab tab only.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { Canvas, T } from "@threlte/core";
  import { OrbitControls } from "@threlte/extras";
  import { Euler, Quaternion } from "three";
  import { AvatarSkeletonBuilder } from "$lib/shared/3d/services/implementations/AvatarSkeletonBuilder";
  import { FINGER_BONES, GripType } from "$lib/shared/3d/domain/models/GripPose";
  import { STAFF_GRIP_POSES } from "$lib/shared/3d/data/grip-poses/staff-grip-poses";
  import FingerSliderGroup from "./FingerSliderGroup.svelte";
  import { AVATAR_DEFINITIONS } from "$lib/shared/3d/config/avatar-definitions";

  const FINGERS = ["Thumb", "Index", "Middle", "Ring", "Pinky"] as const;

  let eulerAngles = $state<{ x: number; y: number; z: number }[]>(
    FINGER_BONES.map(() => ({ x: 0, y: 0, z: 0 }))
  );

  let skeleton: AvatarSkeletonBuilder | null = $state(null);
  let cachedRoot = $state<any>(null);
  let selectedPreset = $state<GripType>(GripType.IDLE);
  let copied = $state(false);

  onMount(async () => {
    const skel = new AvatarSkeletonBuilder();
    const defaultModel = AVATAR_DEFINITIONS[0];
    if (defaultModel) {
      await skel.loadModel(defaultModel.modelPath);
      cachedRoot = skel.getRoot();
      skeleton = skel;
      loadPreset(GripType.IDLE);
    }
  });

  function loadPreset(type: GripType) {
    selectedPreset = type;
    const pose = STAFF_GRIP_POSES[type];

    eulerAngles = pose.rotations.map(([x, y, z, w]) => {
      const euler = new Euler();
      euler.setFromQuaternion(new Quaternion(x, y, z, w));
      return {
        x: Math.round((euler.x * 180) / Math.PI),
        y: Math.round((euler.y * 180) / Math.PI),
        z: Math.round((euler.z * 180) / Math.PI),
      };
    });

    applyToBones();
  }

  function handleSliderChange(fingerIndex: number, boneInFinger: number, axis: "x" | "y" | "z", degrees: number) {
    const globalIndex = fingerIndex * 3 + boneInFinger;
    eulerAngles[globalIndex] = { ...eulerAngles[globalIndex], [axis]: degrees };
    applyToBones();
  }

  function applyToBones() {
    if (!skeleton) return;
    const state = skeleton.getState();
    if (!state.fingerChains) return;

    for (let i = 0; i < FINGER_BONES.length; i++) {
      const boneName = FINGER_BONES[i];
      const bone = state.fingerChains.left.get(boneName);
      if (!bone) continue;

      const angles = eulerAngles[i];
      const euler = new Euler(
        (angles.x * Math.PI) / 180,
        (angles.y * Math.PI) / 180,
        (angles.z * Math.PI) / 180
      );
      bone.quaternion.setFromEuler(euler);
    }
  }

  function copyAsJson() {
    const rotations = eulerAngles.map((angles) => {
      const euler = new Euler(
        (angles.x * Math.PI) / 180,
        (angles.y * Math.PI) / 180,
        (angles.z * Math.PI) / 180
      );
      const q = new Quaternion().setFromEuler(euler);
      return [
        Math.round(q.x * 1000) / 1000,
        Math.round(q.y * 1000) / 1000,
        Math.round(q.z * 1000) / 1000,
        Math.round(q.w * 1000) / 1000,
      ] as [number, number, number, number];
    });

    navigator.clipboard.writeText(JSON.stringify(rotations, null, 2));
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  function resetAll() {
    eulerAngles = FINGER_BONES.map(() => ({ x: 0, y: 0, z: 0 }));
    applyToBones();
  }
</script>

<div class="editor-layout">
  <div class="viewport">
    <Canvas>
      <T.PerspectiveCamera makeDefault position={[0.3, 1.0, 0.4]} fov={45}>
        <OrbitControls target={[0, 0.9, 0]} />
      </T.PerspectiveCamera>

      <T.AmbientLight intensity={0.6} />
      <T.DirectionalLight position={[2, 3, 1]} intensity={1} />

      <!-- Staff reference cylinder -->
      <T.Mesh position={[0, 0.9, -0.15]} rotation={[Math.PI / 2, 0, 0]}>
        <T.CylinderGeometry args={[0.012, 0.012, 0.8, 8]} />
        <T.MeshStandardMaterial color="#888888" />
      </T.Mesh>

      {#if cachedRoot}
        <T is={cachedRoot} />
      {/if}
    </Canvas>
  </div>

  <div class="controls">
    <div class="toolbar">
      <select
        value={selectedPreset}
        onchange={(e) => loadPreset(e.currentTarget.value as GripType)}
      >
        {#each Object.values(GripType) as type}
          <option value={type}>{STAFF_GRIP_POSES[type].name}</option>
        {/each}
      </select>

      <button onclick={copyAsJson}>
        {copied ? "Copied!" : "Copy JSON"}
      </button>

      <button onclick={resetAll}>Reset</button>
    </div>

    <div class="sliders">
      {#each FINGERS as finger, fi}
        <FingerSliderGroup
          fingerName={finger}
          isThumb={finger === "Thumb"}
          rotations={eulerAngles.slice(fi * 3, fi * 3 + 3)}
          onchange={(boneIndex, axis, degrees) =>
            handleSliderChange(fi, boneIndex, axis, degrees)
          }
        />
      {/each}
    </div>
  </div>
</div>

<style>
  .editor-layout {
    display: grid;
    grid-template-columns: 1fr 320px;
    height: 100%;
    gap: 0;
  }

  .viewport {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    min-height: 400px;
  }

  .controls {
    overflow-y: auto;
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .toolbar {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .toolbar select,
  .toolbar button {
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
  }

  .sliders {
    display: flex;
    flex-direction: column;
  }
</style>
