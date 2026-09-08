import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type {
  CollaborativeVideo,
  StepMap,
} from "$lib/shared/video-collaboration/domain/collaborative-video";
import type { SequenceVideosStore } from "$lib/shared/video-collaboration/state/sequence-videos-store.svelte";
import type { VideoPlayheadBridge } from "$lib/shared/sequence-viewer/context/video-playhead-context";
import {
  createPerformanceWorkspaceState,
  type PerformanceWorkspaceState,
} from "$lib/shared/sequence-viewer/components/sequence-videos/state/performance-workspace-state.svelte";

const sequence = {
  id: "performance-sequence",
  word: "TEST",
  steps: [],
} as unknown as SequenceData;

export function createPerformanceWorkspaceHarness(
  initialVideos: CollaborativeVideo[]
): {
  state: PerformanceWorkspaceState;
  setActive: (active: boolean) => void;
  setUploadRequested: (requested: boolean) => void;
  openChanges: boolean[];
  attachedMaps: Array<StepMap | null>;
  timingSaved: string[];
  dispose: () => void;
} {
  let active = $state(true);
  let uploadRequested = $state(false);
  let videos = $state([...initialVideos]);
  const openChanges: boolean[] = [];
  const attachedMaps: Array<StepMap | null> = [];
  const timingSaved: string[] = [];

  const store: SequenceVideosStore = {
    sequenceId: sequence.id!,
    get videos() {
      return videos;
    },
    loading: false,
    error: "",
    load: async () => {},
    reload: async () => {},
    add: (video) => {
      videos = [video, ...videos];
    },
    remove: async (videoId) => {
      videos = videos.filter((video) => video.id !== videoId);
    },
    applyStepMap: async (videoId, stepMap) => {
      videos = videos.map((video) =>
        video.id === videoId ? { ...video, beatMap: stepMap } : video
      );
    },
  };

  const playhead: VideoPlayheadBridge = {
    attach: (map) => attachedMaps.push(map),
    reportTime: () => {},
    registerSeek: () => {},
    seekToStep: () => false,
  };

  let state!: PerformanceWorkspaceState;
  const dispose = $effect.root(() => {
    state = createPerformanceWorkspaceState(
      {
        getSequence: () => sequence,
        getActive: () => active,
        getUploadRequested: () => uploadRequested,
        onWorkOpenChange: (open) => openChanges.push(open),
      },
      {
        getStore: () => store,
        playhead,
        onTimingSaved: () => timingSaved.push("saved"),
      }
    );
  });

  return {
    state,
    setActive: (next) => {
      active = next;
    },
    setUploadRequested: (next) => {
      uploadRequested = next;
    },
    openChanges,
    attachedMaps,
    timingSaved,
    dispose,
  };
}
