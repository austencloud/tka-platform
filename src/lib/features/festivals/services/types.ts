/**
 * Co-exported types from retired interface contracts.
 */

import type { FestivalRegion } from "../domain/models/festival";
import type { TrackerStatus } from "../domain/models/festival-tracker";


export interface FestivalFilters {
  region?: FestivalRegion;
  timeWindow?: "upcoming" | "3months" | "6months" | "year";
  seeking?: "instructors" | "performers" | "applications-open";
  trackerStatus?: TrackerStatus;
}
