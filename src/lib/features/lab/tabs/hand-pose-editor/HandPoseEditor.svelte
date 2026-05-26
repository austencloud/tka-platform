<!--
  HandPoseEditor.svelte - Debug tool for authoring finger grip poses.
  Two-tab layout: Browse (taxonomy gallery) and Edit (sliders).
  Uses the standard Mixamo avatar with a clipping plane at the wrist
  to show only the hand. Lab tab only.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { Canvas, T } from "@threlte/core";
  import type CameraControls from "camera-controls";
  import OrbitControls from "$lib/shared/3d/components/OrbitControls.svelte";
  import {
    Euler,
    Quaternion,
    Vector3,
    PerspectiveCamera,
    Mesh,
    CylinderGeometry,
    MeshStandardMaterial,
  } from "three";
  import type { Bone } from "three";
  import { AvatarSkeletonBuilder } from "@austencloud/scene-3d";
  import { FINGER_BONES, GripType } from "@austencloud/scene-3d";
  import { solveCylinderGrasp } from "@austencloud/scene-3d";
  import { STAFF_GRIP_POSES } from "@austencloud/scene-3d";
  import FingerSliderGroup from "./FingerSliderGroup.svelte";
  import SkeletonUpdater from "./SkeletonUpdater.svelte";
  import TaxonomyGallery from "./TaxonomyGallery.svelte";
  import { AVATAR_DEFINITIONS } from "@austencloud/scene-3d";
  import { cmToUnits } from "@austencloud/scene-3d";

  type TabMode = "browse" | "edit";
  const FINGERS = ["Thumb", "Index", "Middle", "Ring", "Pinky"] as const;
  const SESSION_KEY = "hand-pose-editor";

  interface PersistedState {
    selectedPreset: GripType;
    eulerAngles: { x: number; y: number; z: number }[];
    camera: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
    activeTab: TabMode;
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

  const _scratchTarget = new Vector3();
  function saveToSession() {
    try {
      const camera = cameraRef
        ? { x: cameraRef.position.x, y: cameraRef.position.y, z: cameraRef.position.z }
        : { x: 0, y: 0, z: 0 };
      let target = { x: 0, y: 0, z: 0 };
      if (controlsRef) {
        controlsRef.getTarget(_scratchTarget);
        target = { x: _scratchTarget.x, y: _scratchTarget.y, z: _scratchTarget.z };
      }
      const data: PersistedState = {
        selectedPreset,
        eulerAngles,
        camera,
        target,
        activeTab,
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch {
      // sessionStorage unavailable
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
  let activeTaxonomyPose = $state("");
  let loadError = $state<string | null>(null);
  let cameraRef: PerspectiveCamera | undefined = $state();
  let controlsRef = $state<CameraControls | null>(null);
  let activeTab = $state<TabMode>("browse");

  // Clipping plane to isolate the hand (normal + constant)
  let clipNormal = $state<[number, number, number]>([1, 0, 0]);
  let clipConstant = $state(0);

  // Meshes for SkeletonUpdater
  let skinnedMeshes = $state<any[]>([]);

  // Staff radius (scene units) - the cylinder the hand wraps around
  const STAFF_RADIUS = 0.008;

  // Grip tightness: 1 = full geometric wrap, lower = more relaxed
  let gripTightness = $state(1.0);

  // Staff mesh ref so we can update its position/rotation from sliders
  let staffMesh: Mesh | null = null;

  // Staff offset in hand bone local space - tweakable via Edit tab
  let staffOffsetX = $state(0.023);
  let staffOffsetY = $state(0.075);
  let staffOffsetZ = $state(0.031);
  let staffRotX = $state(-101 * Math.PI / 180);
  let staffRotY = $state(17 * Math.PI / 180);
  let staffRotZ = $state(-87 * Math.PI / 180);

  function attachStaffToHand() {
    if (!skeleton) return;
    const leftHand = skeleton.getBone("LeftHand");
    if (!leftHand) return;

    const staffGeom = new CylinderGeometry(0.008, 0.008, 0.4, 8);
    const staffMat = new MeshStandardMaterial({ color: 0xaaaaaa });
    staffMesh = new Mesh(staffGeom, staffMat);

    // Mixamo LeftHand local Y = toward fingertips
    // Cylinder default axis = Y, so no rotation needed for staff along fingers
    // Staff across the palm (perpendicular to fingers) needs 90° rotation
    updateStaffTransform();
    leftHand.add(staffMesh);
  }

  function updateStaffTransform() {
    if (!staffMesh) return;
    staffMesh.position.set(staffOffsetX, staffOffsetY, staffOffsetZ);
    staffMesh.rotation.set(staffRotX, staffRotY, staffRotZ);
  }

  function focusCameraOnHand() {
    if (!skeleton) return;
    const leftHand = skeleton.getBone("LeftHand");
    if (!leftHand) return;

    skeleton.updateMatrices();
    const handPos = new Vector3();
    leftHand.getWorldPosition(handPos);

    if (cameraRef) {
      cameraRef.position.set(handPos.x + 0.1, handPos.y + 0.05, handPos.z + 0.3);
    }
    if (controlsRef) {
      // Re-aim the orbit around the hand. Animated transition so
      // switching presets doesn't snap the camera.
      controlsRef.setLookAt(
        handPos.x + 0.1,
        handPos.y + 0.05,
        handPos.z + 0.3,
        handPos.x,
        handPos.y,
        handPos.z,
        true,
      );
    }
  }

  function computeClipPlane() {
    if (!skeleton) return;
    const foreArm = skeleton.getBone("LeftForeArm");
    const hand = skeleton.getBone("LeftHand");
    if (!foreArm || !hand) return;

    skeleton.updateMatrices();
    const elbowPos = new Vector3();
    const handPos = new Vector3();
    foreArm.getWorldPosition(elbowPos);
    hand.getWorldPosition(handPos);

    // Normal points from elbow toward hand - keeps everything on the hand side
    const normal = handPos.clone().sub(elbowPos).normalize();

    // Cut just above the wrist: 80% along forearm from elbow to hand
    const cutPoint = elbowPos.clone().lerp(handPos, 0.8);
    const constant = -normal.dot(cutPoint);

    clipNormal = [normal.x, normal.y, normal.z];
    clipConstant = constant;
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

      skinnedMeshes = state.meshes;
      computeClipPlane();
      attachStaffToHand();

      const persisted = loadFromSession();
      if (persisted) {
        selectedPreset = persisted.selectedPreset;
        eulerAngles = persisted.eulerAngles;
        activeTab = persisted.activeTab ?? "browse";
        applyToBones();

        setTimeout(() => {
          if (controlsRef) {
            // Restore both pose + target in one call so camera-controls
            // converges on the saved snapshot without an animated lerp.
            controlsRef.setLookAt(
              persisted.camera.x,
              persisted.camera.y,
              persisted.camera.z,
              persisted.target.x,
              persisted.target.y,
              persisted.target.z,
              false,
            );
          } else if (cameraRef) {
            cameraRef.position.set(persisted.camera.x, persisted.camera.y, persisted.camera.z);
          }
        }, 100);
      } else {
        loadPreset(GripType.IDLE);
        setTimeout(() => focusCameraOnHand(), 100);
      }
    } catch (err) {
      loadError = `Failed to load model: ${err instanceof Error ? err.message : String(err)}`;
      console.error("[HandPoseEditor]", err);
    }
  });

  function loadPreset(type: GripType) {
    selectedPreset = type;
    activeTaxonomyPose = "";
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
    const current = eulerAngles[globalIndex] ?? { x: 0, y: 0, z: 0 };
    eulerAngles[globalIndex] = { ...current, [axis]: degrees };
    applyToBones();
    saveToSession();
  }

  function applyToBones() {
    if (!skeleton) return;
    const state = skeleton.getState();
    if (!state.fingerChains) return;

    for (let i = 0; i < FINGER_BONES.length; i++) {
      const boneName = FINGER_BONES[i];
      if (!boneName) continue;
      const bone = state.fingerChains.left.get(boneName);
      if (!bone) continue;

      const angles = eulerAngles[i];
      if (!angles) continue;
      const euler = new Euler(
        (angles.x * Math.PI) / 180,
        (angles.y * Math.PI) / 180,
        (angles.z * Math.PI) / 180
      );
      bone.quaternion.setFromEuler(euler);
    }

    const root = skeleton.getRoot();
    if (root) root.updateMatrixWorld(true);
  }

  function loadTaxonomyPose(grasp: { name: string; rotations: [number, number, number, number][] }) {
    activeTaxonomyPose = grasp.name;

    eulerAngles = grasp.rotations.map(([x, y, z, w]) => {
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

  function autoGrasp() {
    if (!skeleton) return;
    const state = skeleton.getState();
    if (!state.fingerChains) return;

    const result = solveCylinderGrasp(state.fingerChains.left, STAFF_RADIUS, gripTightness);
    eulerAngles = result.eulerAngles;
    activeTaxonomyPose = "";
    selectedPreset = GripType.SQUARE;

    applyToBones();
    saveToSession();
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

  function switchTab(tab: TabMode) {
    activeTab = tab;
    saveToSession();
  }
</script>

<div class="editor-layout">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="viewport" onclick={(e) => e.stopPropagation()}>
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

      {#if cachedRoot}
        <T is={cachedRoot} />
      {/if}

      {#if skinnedMeshes.length > 0}
        <SkeletonUpdater
          meshes={skinnedMeshes}
          clipEnabled
          {clipNormal}
          {clipConstant}
        />
      {/if}
    </Canvas>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="controls"
    onclick={(e) => e.stopPropagation()}
    onpointerdown={(e) => e.stopPropagation()}
    onpointermove={(e) => e.stopPropagation()}
    onpointerup={(e) => e.stopPropagation()}
  >
    {#if loadError}
      <div class="status-error">{loadError}</div>
    {:else if !skeleton}
      <div class="status-loading">Loading model...</div>
    {:else}
      <!-- Tab bar -->
      <div class="tab-bar">
        <button
          class="tab-btn"
          class:active={activeTab === "browse"}
          onclick={() => switchTab("browse")}
        >
          Browse
        </button>
        <button
          class="tab-btn"
          class:active={activeTab === "edit"}
          onclick={() => switchTab("edit")}
        >
          Edit
        </button>
      </div>

      <!-- Active pose indicator -->
      {#if activeTaxonomyPose}
        <div class="active-pose">
          <span class="active-pose-label">Active:</span>
          <span class="active-pose-name">{activeTaxonomyPose}</span>
        </div>
      {:else}
        <div class="active-pose">
          <span class="active-pose-label">Preset:</span>
          <span class="active-pose-name">{STAFF_GRIP_POSES[selectedPreset].name}</span>
        </div>
      {/if}

      <!-- Browse tab: taxonomy gallery fills the panel -->
      {#if activeTab === "browse"}
        <TaxonomyGallery
          activePoseName={activeTaxonomyPose}
          onselect={loadTaxonomyPose}
        />

      <!-- Edit tab: auto grasp + presets + sliders + export -->
      {:else}
        <!-- Auto Grasp controls -->
        <div class="grasp-controls">
          <button class="grasp-btn" onclick={autoGrasp}>
            Auto Grasp
          </button>
          <label class="tightness-slider">
            <span>Tightness</span>
            <input type="range" min="0" max="1" step="0.05"
              value={gripTightness}
              oninput={(e) => { gripTightness = Number(e.currentTarget.value); autoGrasp(); }}
            />
            <span class="tightness-value">{Math.round(gripTightness * 100)}%</span>
          </label>
        </div>

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

        <!-- Staff position/rotation controls -->
        <div class="staff-controls">
          <div class="section-label">Staff Position (local)</div>
          {#each [
            { label: "X", get: () => staffOffsetX, set: (v: number) => { staffOffsetX = v; updateStaffTransform(); } },
            { label: "Y (fingers)", get: () => staffOffsetY, set: (v: number) => { staffOffsetY = v; updateStaffTransform(); } },
            { label: "Z", get: () => staffOffsetZ, set: (v: number) => { staffOffsetZ = v; updateStaffTransform(); } },
          ] as ctrl}
            <label class="staff-slider">
              <span class="staff-axis">{ctrl.label}</span>
              <input type="range" min="-0.1" max="0.1" step="0.001"
                value={ctrl.get()}
                oninput={(e) => ctrl.set(Number(e.currentTarget.value))}
              />
              <span class="staff-value">{ctrl.get().toFixed(3)}</span>
            </label>
          {/each}

          <div class="section-label">Staff Rotation</div>
          {#each [
            { label: "Rx", get: () => staffRotX, set: (v: number) => { staffRotX = v; updateStaffTransform(); } },
            { label: "Ry", get: () => staffRotY, set: (v: number) => { staffRotY = v; updateStaffTransform(); } },
            { label: "Rz", get: () => staffRotZ, set: (v: number) => { staffRotZ = v; updateStaffTransform(); } },
          ] as ctrl}
            <label class="staff-slider">
              <span class="staff-axis">{ctrl.label}</span>
              <input type="range" min={-Math.PI} max={Math.PI} step="0.01"
                value={ctrl.get()}
                oninput={(e) => ctrl.set(Number(e.currentTarget.value))}
              />
              <span class="staff-value">{(ctrl.get() * 180 / Math.PI).toFixed(0)}°</span>
            </label>
          {/each}
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
      {/if}
    {/if}
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
    position: relative;
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

  .tab-bar {
    display: flex;
    gap: 0;
    margin-bottom: 10px;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
  }

  .tab-btn {
    flex: 1;
    min-height: 44px;
    padding: 10px 0;
    border: none;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .tab-btn:first-child {
    border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
  }

  .tab-btn.active {
    background: rgba(139, 92, 246, 0.15);
    color: var(--theme-text, #fff);
  }

  .tab-btn:hover:not(.active) {
    background: rgba(255, 255, 255, 0.04);
    color: var(--theme-text, #fff);
  }

  .active-pose {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    margin-bottom: 10px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.03);
    font-size: var(--font-size-compact, 12px);
  }

  .active-pose-label {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .active-pose-name {
    color: var(--theme-text, #fff);
    font-weight: 600;
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

  .grasp-controls {
    margin-bottom: 12px;
    padding: 10px;
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 6px;
    background: rgba(139, 92, 246, 0.05);
  }

  .grasp-btn {
    width: 100%;
    min-height: 44px;
    padding: 10px;
    border-radius: 6px;
    border: 1px solid rgba(139, 92, 246, 0.4);
    background: rgba(139, 92, 246, 0.15);
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    margin-bottom: 8px;
  }

  .grasp-btn:hover {
    background: rgba(139, 92, 246, 0.25);
    border-color: rgba(139, 92, 246, 0.6);
  }

  .tightness-slider {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .tightness-slider input[type="range"] {
    flex: 1;
    min-width: 0;
    height: 4px;
    accent-color: rgba(139, 92, 246, 0.8);
  }

  .tightness-value {
    width: 32px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .staff-controls {
    margin-bottom: 12px;
    padding: 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
  }

  .section-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    margin-bottom: 4px;
    margin-top: 6px;
  }

  .section-label:first-child {
    margin-top: 0;
  }

  .staff-slider {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .staff-axis {
    width: 55px;
    flex-shrink: 0;
  }

  .staff-slider input[type="range"] {
    flex: 1;
    min-width: 0;
    height: 4px;
    accent-color: var(--theme-accent, #8b5cf6);
  }

  .staff-value {
    width: 40px;
    flex-shrink: 0;
    text-align: right;
    font-variant-numeric: tabular-nums;
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
</style>
