<script lang="ts">
  /**
   * GaitProbe
   *
   * Drop this inside any Threlte scene that has rigged avatars in it and it
   * records what their legs are actually doing. It renders nothing.
   *
   * It samples in the RENDER stage, not the main stage. The main stage is
   * where LocomotionAnimator writes clip rotations, FootPlanter overwrites
   * some of them with IK, and AvatarAnimator solves the arms — sampling
   * anywhere inside that ordering measures a pose halfway through being
   * built. By the render stage the frame is settled, which is the pose the
   * eye is complaining about.
   *
   * The scene is re-scanned on a slow interval rather than every frame: bone
   * lookups walk the whole subtree, and a cast does not gain legs mid-stride.
   */

  import { useTask, useThrelte } from "@threlte/core";
  import type { Object3D } from "three";

  import {
    analyzeGait,
    DEFAULT_THRESHOLDS,
    type GaitReport,
    type GaitThresholds,
  } from "./gait-analysis";
  import { gaitProbeState } from "./gait-probe-state.svelte";
  import {
    collectRiggedAvatars,
    GaitRecorder,
    sampleRig,
    type RiggedAvatar,
  } from "./gait-rig-sampler";

  interface Props {
    /** Stop recording without unmounting, so a paused scene keeps its buffer. */
    recording?: boolean;
    /** How many frames to keep per avatar. 900 is 15 seconds at 60fps. */
    capacity?: number;
    /** How often the report is recomputed, in seconds. */
    reportInterval?: number;
    /** How often the scene is re-scanned for rigs, in seconds. */
    rescanInterval?: number;
    thresholds?: GaitThresholds;
    /** Called with a fresh report per avatar every reportInterval. */
    onReport?: (reports: Map<string, GaitReport>) => void;
    /**
     * Publish the live recorder on `window.__gaitProbe` so a measurement pass
     * can pull the raw frames out of the page without a UI.
     */
    exposeOnWindow?: boolean;
  }

  let {
    recording = true,
    capacity = 900,
    reportInterval = 0.5,
    rescanInterval = 2,
    thresholds = DEFAULT_THRESHOLDS,
    onReport,
    exposeOnWindow = true,
  }: Props = $props();

  const { camera, renderStage } = useThrelte();

  /**
   * The scene, reached by climbing out of the camera.
   *
   * `useThrelte().scene.current` is null inside a useTask callback: the
   * reference only resolves in Svelte's reactive contexts, and the frame loop
   * is not one. `camera.current` does resolve there, and the camera is in the
   * scene, so the top of its parent chain is the scene.
   */
  function sceneRoot(): Object3D | null {
    let node: Object3D | null = camera.current ?? null;
    while (node?.parent) node = node.parent;
    return node;
  }

  const recorder = new GaitRecorder(capacity);
  let avatars: RiggedAvatar[] = [];
  let elapsed = 0;
  let sinceRescan = Infinity;
  let sinceReport = 0;

  function rescan(): void {
    const root = sceneRoot();
    if (!root) return;
    avatars = collectRiggedAvatars(root);
    recorder.retain(avatars.map((avatar) => avatar.id));
  }

  function buildReports(): Map<string, GaitReport> {
    const reports = new Map<string, GaitReport>();
    for (const avatar of avatars) {
      reports.set(
        avatar.id,
        analyzeGait(recorder.frames(avatar.id), thresholds)
      );
    }
    return reports;
  }

  if (exposeOnWindow && typeof window !== "undefined") {
    (
      window as unknown as {
        __gaitProbe?: {
          frames: (id: string) => unknown;
          ids: () => string[];
          report: () => Record<string, GaitReport>;
        };
      }
    ).__gaitProbe = {
      frames: (id: string) => recorder.frames(id),
      ids: () => recorder.ids(),
      report: () => Object.fromEntries(buildReports()),
      // A buffer that spans a stand and a walk averages the two together, and
      // the stand wins on frame count. Windowing is how you ask about the walk.
      reportWindow: (from: number, to: number) =>
        Object.fromEntries(
          avatars.map((avatar) => [
            avatar.id,
            analyzeGait(
              recorder
                .frames(avatar.id)
                .filter((f) => f.t >= from && f.t <= to),
              thresholds
            ),
          ])
        ),
      // Where the character was actually moving, so a window can be chosen
      // without guessing at the transport's timing.
      travelSpans: (id: string, minSpeed = 0.15) => {
        const frames = recorder.frames(id);
        const spans: { from: number; to: number; peak: number }[] = [];
        let open: { from: number; to: number; peak: number } | null = null;
        for (let i = 1; i < frames.length; i++) {
          const a = frames[i - 1]!;
          const b = frames[i]!;
          const speed =
            Math.hypot(b.root.x - a.root.x, b.root.z - a.root.z) /
            Math.max(b.dt, 1e-6);
          if (speed >= minSpeed) {
            if (open) {
              open.to = b.t;
              open.peak = Math.max(open.peak, speed);
            } else open = { from: b.t, to: b.t, peak: speed };
          } else if (open) {
            spans.push(open);
            open = null;
          }
        }
        if (open) spans.push(open);
        return spans.filter((span) => span.to - span.from > 0.5);
      },
      // Answers "why did it find nothing" without a rebuild: an empty scene, a
      // scene with no bones, and a rig whose bones are named something the
      // alias table has never heard of are three different problems.
      debug: () => {
        const root = sceneRoot();
        if (!root) return { scene: null };
        let objects = 0;
        let bones = 0;
        const boneNames: string[] = [];
        root.traverse((node) => {
          objects += 1;
          if (!(node as { isBone?: boolean }).isBone) return;
          bones += 1;
          if (boneNames.length < 40) boneNames.push(node.name);
        });
        const chains = avatars.map((avatar) => {
          const chain: {
            name: string;
            type: string;
            performerIndex: unknown;
            localPos: [number, number, number];
            worldPos: [number, number, number];
          }[] = [];
          for (
            let node: Object3D | null = avatar.hips;
            node;
            node = node.parent
          ) {
            node.updateWorldMatrix(true, false);
            chain.push({
              name: node.name || "(unnamed)",
              type: node.type,
              performerIndex: node.userData?.performerIndex,
              localPos: [node.position.x, node.position.y, node.position.z],
              worldPos: [
                node.matrixWorld.elements[12]!,
                node.matrixWorld.elements[13]!,
                node.matrixWorld.elements[14]!,
              ],
            });
          }
          return {
            id: avatar.id,
            rootIs: avatar.root.name || avatar.root.type,
            chain,
          };
        });
        return { objects, bones, boneNames, avatars: avatars.length, chains };
      },
    };
  }

  useTask(
    (delta) => {
      if (!recording) return;

      sinceRescan += delta;
      if (sinceRescan >= rescanInterval) {
        sinceRescan = 0;
        rescan();
      }
      if (avatars.length === 0) return;

      // A frame long enough to have been a stall says nothing about gait, and
      // dividing by it manufactures jerk that nobody saw.
      if (delta > 0.2) return;
      elapsed += delta;

      for (const avatar of avatars) {
        const frame = sampleRig(avatar, { t: elapsed, dt: delta });
        recorder.push(avatar.id, frame);
        gaitProbeState.pushTrail(avatar.id, frame.root);
      }

      sinceReport += delta;
      if (sinceReport >= reportInterval) {
        sinceReport = 0;
        const reports = buildReports();
        gaitProbeState.publish(reports);
        onReport?.(reports);
      }
    },
    { stage: renderStage }
  );
</script>
