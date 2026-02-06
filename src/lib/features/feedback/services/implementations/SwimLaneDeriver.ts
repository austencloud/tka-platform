import type { FeedbackItem } from "../../domain/models/feedback-models";
import type { ISwimLaneDeriver, SwimLane } from "../contracts/ISwimLaneDeriver";

export class SwimLaneDeriver implements ISwimLaneDeriver {
  deriveLane(item: FeedbackItem): SwimLane {
    // Critical: High-priority bugs that need immediate attention
    if (item.priority === 'critical' && item.type === 'bug') {
      return 'critical';
    }

    // Internal: Dev work from terminal (CLI/dev log)
    if (item.source === 'terminal') {
      return 'internal';
    }

    // Backlog: Low priority or deferred items
    if (item.priority === 'low' || item.deferredUntil) {
      return 'backlog';
    }

    // Everything else is normal
    return 'normal';
  }

  groupByLane(items: FeedbackItem[]): Record<SwimLane, FeedbackItem[]> {
    const result: Record<SwimLane, FeedbackItem[]> = {
      critical: [],
      normal: [],
      internal: [],
      backlog: [],
    };

    for (const item of items) {
      const lane = this.deriveLane(item);
      result[lane].push(item);
    }

    return result;
  }
}
