import type { Timestamp } from "firebase/firestore";

export type TrackerStatus = "interested" | "applying" | "applied" | "accepted" | "declined" | "attending";

export interface UserFestivalTracker {
  userId: string;
  festivalId: string;
  status: TrackerStatus;
  appliedAs: ("instructor" | "performer")[];
  workshopsSubmitted: string[];
  stipendRequested?: number;
  notes: string;
  applicationDate?: Timestamp;
  responseDate?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
