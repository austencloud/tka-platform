import type { AnimationMixer, Object3D } from "three";
import type { IAvatarSkeletonBuilder } from "../services/contracts/IAvatarSkeletonBuilder";

interface MocapDebugHooks {
  __playMocap?: (url?: string) => Promise<string>;
  __stopMocap?: () => void;
  __getMocapMixer?: () => AnimationMixer | null;
}

export interface MocapDebugHandle {
  getMixer: () => AnimationMixer | null;
  dispose: () => void;
}

/**
 * FBX mocap playback hooks exposed on window for manual retargeting tests.
 * Avatar3D's frame loop calls `getMixer()` each tick so clip playback stays
 * in sync with the render loop.
 */
export function installMocapDebugHooks(args: {
  getSkeletonService: () => IAvatarSkeletonBuilder | null;
}): MocapDebugHandle {
  const { getSkeletonService } = args;
  const w = window as typeof window & MocapDebugHooks;

  let mixer: AnimationMixer | null = null;

  w.__playMocap = async (url = "/animations/mocap-test.fbx") => {
    const skeletonService = getSkeletonService();
    if (!skeletonService) return "Skeleton not loaded";
    const root = skeletonService.getRoot();
    if (!root) return "No root object";

    const { FBXLoader } = await import(
      "three/examples/jsm/loaders/FBXLoader.js"
    );
    const { AnimationMixer, AnimationClip, LoopRepeat } = await import("three");

    const avatarPrefix = detectBonePrefix(root);
    console.log(`[Mocap] Avatar bone prefix: "${avatarPrefix}"`);

    const avatarBoneNames = new Set<string>();
    root.traverse((obj) => {
      if ((obj as { isBone?: boolean }).isBone) avatarBoneNames.add(obj.name);
    });

    console.log("[Mocap] Loading FBX:", url);
    const loader = new FBXLoader();

    return new Promise<string>((resolve, reject) => {
      loader.load(
        url,
        (fbx) => {
          console.log(
            "[Mocap] FBX loaded. Animations:",
            fbx.animations.length,
          );
          if (fbx.animations.length === 0) {
            resolve("No animations found in FBX");
            return;
          }

          const fbxPrefix = detectBonePrefix(fbx);
          console.log(`[Mocap] FBX bone prefix: "${fbxPrefix}"`);

          mixer = new AnimationMixer(root);

          for (const clip of fbx.animations) {
            console.log(
              `[Mocap] Clip: "${clip.name}" duration=${clip.duration.toFixed(2)}s tracks=${clip.tracks.length}`,
            );

            let mapped = 0;
            let skipped = 0;
            const retargetedTracks = clip.tracks.map((track) => {
              const [boneName, ...rest] = track.name.split(".");
              const property = rest.join(".");

              let coreName = boneName || "";
              if (fbxPrefix && coreName.startsWith(fbxPrefix)) {
                coreName = coreName.slice(fbxPrefix.length);
              }

              const avatarBoneName = avatarPrefix + coreName;
              const newTrackName = `${avatarBoneName}.${property}`;

              if (avatarBoneNames.has(avatarBoneName)) {
                mapped++;
              } else {
                skipped++;
              }

              const cloned = track.clone();
              cloned.name = newTrackName;
              return cloned;
            });

            console.log(
              `[Mocap] Retargeted ${mapped} tracks, ${skipped} bones not found in avatar`,
            );

            const retargetedClip = new AnimationClip(
              clip.name + "_retargeted",
              clip.duration,
              retargetedTracks,
            );

            const action = mixer.clipAction(retargetedClip);
            action.setLoop(LoopRepeat, Infinity);
            action.play();
          }

          console.log("[Mocap] Playing! Call __stopMocap() to stop.");
          resolve("Mocap playing");
        },
        (progress) => {
          if (progress.total) {
            console.log(
              `[Mocap] Loading: ${((progress.loaded / progress.total) * 100).toFixed(0)}%`,
            );
          }
        },
        (error) => {
          console.error("[Mocap] Failed to load:", error);
          reject(error);
        },
      );
    });
  };

  w.__stopMocap = () => {
    if (mixer) {
      mixer.stopAllAction();
      mixer = null;
    }
    console.log("[Mocap] Stopped.");
  };

  w.__getMocapMixer = () => mixer;

  return {
    getMixer: () => mixer,
    dispose: () => {
      if (mixer) {
        mixer.stopAllAction();
        mixer = null;
      }
      delete w.__playMocap;
      delete w.__stopMocap;
      delete w.__getMocapMixer;
    },
  };
}

function detectBonePrefix(root: Object3D): string {
  let prefix = "";
  root.traverse((obj) => {
    if (prefix) return;
    if ((obj as { isBone?: boolean }).isBone && obj.name.includes("Hips")) {
      const idx = obj.name.indexOf("Hips");
      prefix = obj.name.slice(0, idx);
    }
  });
  return prefix;
}
