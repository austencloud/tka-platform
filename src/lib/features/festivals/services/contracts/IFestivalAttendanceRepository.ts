import type { FestivalAttendance } from "../../domain/models/festival";

export interface IFestivalAttendanceRepository {
  getCount(festivalId: string): Promise<number>;
  getAttendees(festivalId: string): Promise<FestivalAttendance[]>;
  setAttendance(festivalId: string, userId: string, data: Omit<FestivalAttendance, "festivalId" | "userId">): Promise<void>;
  removeAttendance(festivalId: string, userId: string): Promise<void>;
}
