/**
 * Tree Feedback Persister Implementation
 *
 * Manages localStorage persistence for tree approval/rejection feedback.
 */

import type { TreeType } from "$lib/shared/background/firefly-forest/services/TreeSilhouetteSystem";
import type {
  ITreeFeedbackPersister,
  TreeFeedback,
  TreeSample,
  TreeSampleStatus,
} from "../contracts/ITreeFeedbackPersister";

const STORAGE_KEY = "tka-tree-lab-feedback";

export class TreeFeedbackPersister implements ITreeFeedbackPersister {
  load(): TreeFeedback {
    if (typeof localStorage === "undefined") return {};
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  }

  save(feedback: TreeFeedback): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(feedback));
  }

  getStatus(feedback: TreeFeedback, treeType: TreeType, seed: number): TreeSampleStatus {
    const typeData = feedback[treeType];
    if (!typeData) return "pending";

    if (typeData.approved.includes(seed)) return "approved";
    if (typeData.rejected.includes(seed)) return "rejected";
    return "pending";
  }

  cycleStatus(feedback: TreeFeedback, treeType: TreeType, seed: number): TreeFeedback {
    const currentStatus = this.getStatus(feedback, treeType, seed);

    // Determine next status: pending -> approved -> rejected -> pending
    const nextStatus: Record<TreeSampleStatus, TreeSampleStatus> = {
      pending: "approved",
      approved: "rejected",
      rejected: "pending",
    };
    const newStatus = nextStatus[currentStatus];

    // Ensure the type data exists
    if (!feedback[treeType]) {
      feedback[treeType] = { approved: [], rejected: [] };
    }
    const typeData = feedback[treeType]!;

    // Remove from both lists first
    typeData.approved = typeData.approved.filter((s) => s !== seed);
    typeData.rejected = typeData.rejected.filter((s) => s !== seed);

    // Add to appropriate list
    if (newStatus === "approved") {
      typeData.approved.push(seed);
    } else if (newStatus === "rejected") {
      typeData.rejected.push(seed);
    }

    return { ...feedback };
  }

  getStats(feedback: TreeFeedback, treeType: TreeType): { approved: number; rejected: number } {
    const typeData = feedback[treeType];
    return {
      approved: typeData?.approved.length ?? 0,
      rejected: typeData?.rejected.length ?? 0,
    };
  }

  generateSamples(feedback: TreeFeedback, treeType: TreeType, count: number): TreeSample[] {
    const samples: TreeSample[] = [];

    for (let i = 0; i < count; i++) {
      const seed = Math.floor(Math.random() * 1000000);
      const status = this.getStatus(feedback, treeType, seed);
      samples.push({ seed, status });
    }

    return samples;
  }
}
