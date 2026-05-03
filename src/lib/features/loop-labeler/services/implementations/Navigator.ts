import {
  pushState as svelteKitPushState,
  replaceState as svelteKitReplaceState,
} from "$app/navigation";
import type { LabeledSequence } from "../contracts/ILOOPLabelsFirebaseRepository";

/**
 * Service for navigation and utility functions
 */
export class Navigator {
  getNextIndex(currentIndex: number, totalSequences: number): number {
    if (currentIndex < totalSequences - 1) {
      return currentIndex + 1;
    }
    return currentIndex;
  }

  getPreviousIndex(currentIndex: number): number {
    if (currentIndex > 0) {
      return currentIndex - 1;
    }
    return currentIndex;
  }

  updateUrlWithSequence(
    sequenceId: string | null,
    filterMode?: string,
    addToHistory: boolean = true
  ): void {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    if (sequenceId) {
      url.searchParams.set("seq", sequenceId);
    } else {
      url.searchParams.delete("seq");
    }

    if (filterMode) {
      url.searchParams.set("filter", filterMode);
    }

    // Store sequence ID in history state for popstate handling
    const state = { sequenceId, filterMode };

    if (addToHistory) {
      // Use pushState to enable browser back/forward navigation
      svelteKitPushState(url.toString(), state);
    } else {
      // Use replaceState when we don't want to add a history entry
      svelteKitReplaceState(url.toString(), state);
    }
  }

  getSequenceFromUrl(): string | null {
    if (typeof window === "undefined") return null;

    const url = new URL(window.location.href);
    return url.searchParams.get("seq");
  }

  getFilterFromUrl(): string | null {
    if (typeof window === "undefined") return null;

    const url = new URL(window.location.href);
    return url.searchParams.get("filter");
  }

  updateUrlWithFilter(filterMode: string): void {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    url.searchParams.set("filter", filterMode);
    svelteKitReplaceState(url.toString(), {});
  }

  exportLabelsAsJson(labels: Map<string, LabeledSequence>): void {
    const data = Object.fromEntries(labels);
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `loop-labels-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async importLabelsFromJson(
    file: File
  ): Promise<Map<string, LabeledSequence>> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string) as Record<
            string,
            LabeledSequence
          >;
          const labels = new Map(Object.entries(data));
          resolve(labels);
        } catch (error) {
          console.error("Failed to import labels:", error);
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error("Failed to read file"));
      };

      reader.readAsText(file);
    });
  }
}
