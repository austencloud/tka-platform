import type { UserFestivalTracker } from "../../domain/models/festival-tracker";

export interface IFestivalTrackerRepository {
  get(userId: string, festivalId: string): Promise<UserFestivalTracker | null>;
  getAllForUser(userId: string): Promise<Map<string, UserFestivalTracker>>;
  set(userId: string, festivalId: string, data: Partial<UserFestivalTracker>): Promise<void>;
  delete(userId: string, festivalId: string): Promise<void>;
}
