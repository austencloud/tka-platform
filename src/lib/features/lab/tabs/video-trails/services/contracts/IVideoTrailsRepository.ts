import type { VideoTrailsProject } from "../../domain/types";

export interface IVideoTrailsRepository {
  save(project: VideoTrailsProject): Promise<void>;
  load(id: string): Promise<VideoTrailsProject | null>;
  list(): Promise<VideoTrailsProject[]>;
  delete(id: string): Promise<void>;
}
