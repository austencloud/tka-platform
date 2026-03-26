import type { Timestamp } from "firebase/firestore";

export type FestivalRegion = "north-america" | "europe" | "oceania" | "asia" | "south-america" | "africa";
export type FestivalSize = "intimate" | "medium" | "large";
export type FestivalSource = "scraped" | "user-submitted" | "curated";
export type ModerationStatus = "pending" | "approved";
export type FestivalStatus = "upcoming" | "past";

export interface FestivalLocation {
  venue?: string;
  city: string;
  state?: string;
  country: string;
  coordinates: { lat: number; lng: number };
}

export interface Festival {
  id: string;
  name: string;
  organizationId: string;
  organization: string;
  location: FestivalLocation;
  dates: { start: Timestamp; end: Timestamp };
  applicationDeadline?: Timestamp;
  applicationUrl?: string;
  applicationContact?: string;
  seekingInstructors: boolean;
  seekingPerformers: boolean;
  description: string;
  websiteUrl?: string;
  imageUrl?: string;
  socialLinks?: { instagram?: string; facebook?: string };
  estimatedSize?: FestivalSize;
  region: FestivalRegion;
  status: FestivalStatus;
  tags: string[];
  source: FestivalSource;
  moderationStatus: ModerationStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type AttendanceStatus = "interested" | "going";
export type AttendanceRole = "attendee" | "instructor" | "performer";

export interface FestivalAttendance {
  festivalId: string;
  userId: string;
  status: AttendanceStatus;
  role?: AttendanceRole;
  createdAt: Timestamp;
}

export interface FestivalSubmission {
  id: string;
  name: string;
  city: string;
  country: string;
  venue?: string;
  dates: { start: Timestamp; end: Timestamp };
  websiteUrl: string;
  applicationUrl?: string;
  description?: string;
  seekingInstructors: boolean;
  seekingPerformers: boolean;
  tags: string[];
  submittedBy: string;
  moderationStatus: ModerationStatus;
  submittedAt: Timestamp;
}
