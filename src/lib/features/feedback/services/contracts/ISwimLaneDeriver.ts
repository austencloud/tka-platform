import type { FeedbackItem } from "../../domain/models/feedback-models";

export type SwimLane = 'critical' | 'normal' | 'internal' | 'backlog';

export interface ISwimLaneDeriver {
  deriveLane(item: FeedbackItem): SwimLane;
  groupByLane(items: FeedbackItem[]): Record<SwimLane, FeedbackItem[]>;
}
