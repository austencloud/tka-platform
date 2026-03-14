import { getContext, setContext } from "svelte";
import type { VideoTrailsState } from "../state/video-trails-state.svelte";

const VIDEO_TRAILS_CTX_KEY = Symbol("video-trails");

export interface VideoTrailsContext {
  state: VideoTrailsState;
}

export function setVideoTrailsContext(ctx: VideoTrailsContext): void {
  setContext(VIDEO_TRAILS_CTX_KEY, ctx);
}

export function getVideoTrailsContext(): VideoTrailsContext {
  return getContext<VideoTrailsContext>(VIDEO_TRAILS_CTX_KEY);
}
