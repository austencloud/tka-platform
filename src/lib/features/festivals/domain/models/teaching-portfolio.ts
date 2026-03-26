import type { Timestamp } from "firebase/firestore";

export type WorkshopLevel = "introductory" | "beginner" | "intermediate" | "advanced" | "mixed";

export interface WorkshopTemplate {
  id: string;
  title: string;
  level: WorkshopLevel;
  props: string[];
  description: string;
  themes: string[];
  solo: boolean;
  imageUrl?: string;
}

export interface BioVersion {
  id: string;
  label: string;
  text: string;
}

export interface ActTemplate {
  id: string;
  title: string;
  description: string;
  duration: string;
  performerCount: number;
  solo: boolean;
  props: string[];
  fire: boolean;
  requirements: string;
  videoUrl?: string;
  imageUrl?: string;
}

export interface TeachingPortfolio {
  userId: string;
  classes: WorkshopTemplate[];
  acts: ActTemplate[];
  bios: BioVersion[];
  performanceCredits: string[];
  performanceVideos: string[];
  socialLinks: {
    website?: string;
    instagram?: string;
    facebook?: string;
    youtube?: string;
    tiktok?: string;
  };
  insuranceInfo?: {
    provider: string;
    policyExpiration?: Timestamp;
  };
  homeCity: string;
  homeCountry: string;
  yearsTeaching: number;
  yearsPerforming: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
