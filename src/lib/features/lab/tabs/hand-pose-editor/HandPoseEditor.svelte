<!--
  HandPoseEditor.svelte — Debug tool for authoring finger grip poses.
  Camera auto-targets the left hand bone. Staff positioned at hand.
  Lab tab only.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { Canvas, T } from "@threlte/core";
  import { OrbitControls } from "@threlte/extras";
  import { Euler, Quaternion, Vector3, PerspectiveCamera } from "three";
  import type { Bone } from "three";
  import { AvatarSkeletonBuilder } from "$lib/shared/3d/services/implementations/AvatarSkeletonBuilder";
  import { FINGER_BONES, GripType } from "$lib/shared/3d/domain/models/GripPose";
  import { STAFF_GRIP_POSES } from "$lib/shared/3d/data/grip-poses/staff-grip-poses";
  import FingerSliderGroup from "./FingerSliderGroup.svelte";
  import SkeletonUpdater from "./SkeletonUpdater.svelte";
  import { AVATAR_DEFINITIONS } from "$lib/shared/3d/config/avatar-definitions";
  import { cmToUnits } from "$lib/shared/3d/config/avatar-proportions";

  const FINGERS = ["Thumb", "Index", "Middle", "Ring", "Pinky"] as const;
  const SESSION_KEY = "hand-pose-editor";

  // Shape of what we persist to sessionStorage
  interface PersistedState {
    selectedPreset: GripType;
    eulerAngles: { x: number; y: number; z: number }[];
    camera: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
  }

  function loadFromSession(): PersistedState | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as PersistedState;
    } catch {
      return null;
    }
  }

  function saveToSession() {
    try {
      const camera = cameraRef
        ? { x: cameraRef.position.x, y: cameraRef.position.y, z: cameraRef.position.z }
        : { x: 0, y: 0, z: 0 };
      const target = controlsRef
        ? { x: controlsRef.target.x, y: controlsRef.target.y, z: controlsRef.target.z }
        : { x: 0, y: 0, z: 0 };
      const data: PersistedState = { selectedPreset, eulerAngles, camera, target };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch {
      // sessionStorage unavailable — silently skip
    }
  }

  let eulerAngles = $state<{ x: number; y: number; z: number }[]>(
    FINGER_BONES.map(() => ({ x: 0, y: 0, z: 0 }))
  );

  let skeleton: AvatarSkeletonBuilder | null = $state(null);
  let cachedRoot = $state<any>(null);
  let selectedPreset = $state<GripType>(GripType.IDLE);
  let copied = $state(false);
  let hasFingerChains = $state(false);
  let loadError = $state<string | null>(null);
  // Camera and controls refs — set imperatively after model loads
  let cameraRef: PerspectiveCamera | undefined = $state();
  let controlsRef: any = $state();

  // Staff position at hand
  let staffPos = $state<[number, number, number]>([0, 1, 0]);

  // Meshes for SkeletonUpdater (runs inside Canvas context via useTask)
  let skinnedMeshes = $state<any[]>([]);

  function focusCameraOnHand() {
    if (!skeleton) return;
    const leftHand = skeleton.getBone("LeftHand");
    if (!leftHand) return;

    skeleton.updateMatrices();
    const handPos = new Vector3();
    leftHand.getWorldPosition(handPos);

    staffPos = [handPos.x, handPos.y, handPos.z];

    // Point camera at the hand from slightly in front
    if (cameraRef) {
      cameraRef.position.set(handPos.x + 0.1, handPos.y + 0.05, handPos.z + 0.3);
      cameraRef.lookAt(handPos);
    }
    if (controlsRef) {
      controlsRef.target.copy(handPos);
      controlsRef.update();
    }
  }

  onMount(async () => {
    try {
      const skel = new AvatarSkeletonBuilder();
      const defaultModel = AVATAR_DEFINITIONS[0];
      if (!defaultModel) {
        loadError = "No avatar models defined";
        return;
      }
      await skel.loadModel(defaultModel.modelPath);

      const targetHeight = cmToUnits(175);
      skel.setHeight(targetHeight);

      cachedRoot = skel.getRoot();
      skeleton = skel;

      const state = skel.getState();
      hasFingerChains = state.fingerChains !== null;
      if (!hasFingerChains) {
        loadError = `Model "${defaultModel.name}" has no finger bones`;
      }

      // Pass meshes to SkeletonUpdater (inside Canvas) for per-frame skeleton updates
      skinnedMeshes = state.meshes;

      const persisted = loadFromSession();
      if (persisted) {
        // Restore pose state from last session
        selectedPreset = persisted.selectedPreset;
        eulerAngles = persisted.eulerAngles;
        applyToBones();

        // Restore camera after Threlte mounts the scene
        setTimeout(() => {
          if (cameraRef) {
            cameraRef.position.set(persisted.camera.x, persisted.camera.y, persisted.camera.z);
          }
          if (controlsRef) {
            controlsRef.target.set(persisted.target.x, persisted.target.y, persisted.target.z);
            controlsRef.update();
          }
        }, 100);
      } else {
        loadPreset(GripType.IDLE);
        // Focus camera after Threlte mounts the scene
        setTimeout(() => focusCameraOnHand(), 100);
      }
    } catch (err) {
      loadError = `Failed to load model: ${err instanceof Error ? err.message : String(err)}`;
      console.error("[HandPoseEditor]", err);
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
    saveToSession();
  }

  function handleSliderChange(fingerIndex: number, boneInFinger: number, axis: "x" | "y" | "z", degrees: number) {
    const globalIndex = fingerIndex * 3 + boneInFinger;
    eulerAngles[globalIndex] = { ...eulerAngles[globalIndex], [axis]: degrees };
    applyToBones();
    saveToSession();
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

    // Propagate bone transforms down hierarchy — SkeletonUpdater handles skeleton.update() per frame
    const root = skeleton.getRoot();
    if (root) root.updateMatrixWorld(true);
  }

  function handleCameraChange() {
    saveToSession();
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
    saveToSession();
  }
</script>

<div class="editor-layout">
  <div class="viewport">
    <Canvas>
      <T.PerspectiveCamera
        makeDefault
        bind:ref={cameraRef}
        position={[0.8, 1.4, 0.3]}
        fov={40}
      >
        <OrbitControls
          bind:ref={controlsRef}
          onchange={handleCameraChange}
        />
      </T.PerspectiveCamera>

      <T.AmbientLight intensity={0.6} />
      <T.DirectionalLight position={[2, 3, 1]} intensity={1} />

      <!-- Staff reference cylinder at hand position -->
      <T.Mesh position={staffPos} rotation={[0, 0, Math.PI / 2]}>
        <T.CylinderGeometry args={[0.008, 0.008, 0.3, 8]} />
        <T.MeshStandardMaterial color="#aaaaaa" />
      </T.Mesh>

      {#if cachedRoot}
        <T is={cachedRoot} />
      {/if}

      {#if skinnedMeshes.length > 0}
        <SkeletonUpdater meshes={skinnedMeshes} />
      {/if}
    </Canvas>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="controls"
    onpointerdown={(e) => e.stopPropagation()}
    onpointermove={(e) => e.stopPropagation()}
    onpointerup={(e) => e.stopPropagation()}
  >
    {#if loadError}
      <div class="status-error">{loadError}</div>
    {:else if !skeleton}
      <div class="status-loading">Loading model...</div>
    {:else}
      <div class="status-ok">
        Finger bones: {hasFingerChains ? "found" : "not found"}
      </div>
    {/if}

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
    overflow-x: hidden;
    padding: 12px;
    box-sizing: border-box;
    min-width: 0;
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

  .status-error {
    padding: 8px;
    margin-bottom: 8px;
    border-radius: 6px;
    background: rgba(239, 68, 68, 0.15);
    color: var(--semantic-error, #ef4444);
    font-size: var(--font-size-min, 14px);
  }

  .status-loading {
    padding: 8px;
    margin-bottom: 8px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
  }

  .status-ok {
    padding: 8px;
    margin-bottom: 8px;
    color: var(--semantic-success, #22c55e);
    font-size: var(--font-size-compact, 12px);
  }
</style>
