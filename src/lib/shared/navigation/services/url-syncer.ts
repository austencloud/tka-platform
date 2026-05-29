/**
 * URL Sync Service Implementation
 *
 * Handles keeping the browser URL in sync with the current sequence
 * so users can share by simply copying the URL bar at any time.
 *
 * Uses replaceState to avoid filling browser history with edits.
 * Debounces updates to avoid constant URL changes while editing.
 *
 * Domain: Navigation - Live URL Synchronization
 */

import { browser } from "$app/environment";
import { replaceState } from "$app/navigation";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { URLSyncOptions } from "./types";
import { generateShareURL } from "./sequence-encoder";

export class URLSyncer {
  private pendingUpdate: ReturnType<typeof setTimeout> | null = null;

  syncURLWithSequence(
    sequence: SequenceData | null,
    module: string,
    options: URLSyncOptions = {}
  ): void {
    if (!browser) return;

    const { debounce = 500, immediate = false, allowClear = true } = options;

    // Clear any pending update
    this.cancelPendingUpdates();

    // If no sequence, only clear if explicitly allowed
    if (!sequence?.steps || sequence.steps.length === 0) {
      if (allowClear) {
        this.clearSequenceFromURL();
      }
      return;
    }

    const updateURL = () => {
      try {
        const { url } = generateShareURL(
          sequence,
          module,
          { compress: true }
        );

        // Extract just the search params
        const urlObj = new URL(url);
        const newSearch = urlObj.search;

        // Only update if the URL actually changed
        if (window.location.search !== newSearch) {
          // Use replaceState to avoid creating history entries
          const newURL = `${window.location.pathname}${newSearch}`;
          replaceState(newURL, {});
        }
      } catch (error) {
        console.error("Failed to sync URL with sequence:", error);
      }
    };

    // Immediate update or debounce
    if (immediate) {
      updateURL();
    } else {
      // Debounce to avoid constant updates while editing
      this.pendingUpdate = setTimeout(updateURL, debounce);
    }
  }

  clearSequenceFromURL(): void {
    if (!browser) return;

    const urlObj = new URL(window.location.href);
    const hasOpenParam = urlObj.searchParams.has("open");

    if (hasOpenParam) {
      urlObj.searchParams.delete("open");
      replaceState(urlObj.toString(), {});
    }
  }

  hasSequenceInURL(): boolean {
    if (!browser) return false;
    const params = new URLSearchParams(window.location.search);
    return params.has("open");
  }

  createDebouncedSync(
    module: string,
    debounceMs = 500
  ): (sequence: SequenceData | null) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    return (sequence: SequenceData | null) => {
      if (timeout) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(() => {
        this.syncURLWithSequence(sequence, module, { immediate: true });
        timeout = null;
      }, debounceMs);
    };
  }

  cancelPendingUpdates(): void {
    if (this.pendingUpdate) {
      clearTimeout(this.pendingUpdate);
      this.pendingUpdate = null;
    }
  }
}
