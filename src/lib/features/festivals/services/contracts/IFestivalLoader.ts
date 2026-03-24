import type { Festival, FestivalRegion } from "../../domain/models/festival";
import type { TrackerStatus } from "../../domain/models/festival-tracker";

export interface FestivalFilters {
  region?: FestivalRegion;
  timeWindow?: "upcoming" | "3months" | "6months" | "year";
  seeking?: "instructors" | "performers" | "applications-open";
  trackerStatus?: TrackerStatus;
}

export interface IFestivalLoader {
  loadFestivals(filters: FestivalFilters, pageSize?: number, cursor?: unknown): Promise<{
    festivals: Festival[];
    nextCursor: unknown | null;
  }>;
  getByIds(ids: string[]): Promise<Festival[]>;
}
