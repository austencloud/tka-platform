import type { FestivalSubmission } from "../../domain/models/festival";

export interface IFestivalSubmissionReviewer {
  getPending(): Promise<FestivalSubmission[]>;
  approve(submissionId: string): Promise<string>;
  reject(submissionId: string): Promise<void>;
  submit(submission: Omit<FestivalSubmission, "id" | "submittedAt" | "moderationStatus">): Promise<string>;
}
