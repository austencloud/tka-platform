/**
 * User Video Library State
 *
 * Reactive Svelte 5 state for the current user's video library.
 * Includes videos they created and collaborations they're part of.
 *
 * Usage:
 * ```svelte
 * <script>
 *   import { createUserVideoLibraryState } from '$lib/shared/video-collaboration';
 *   const library = createUserVideoLibraryState();
 * </script>
 *
 * {#if library.loading}
 *   <p>Loading...</p>
 * {:else}
 *   <p>You have {library.totalCount} videos</p>
 *   <Tabs>
 *     <Tab label="My Videos ({library.createdCount})">...</Tab>
 *     <Tab label="Collaborations ({library.collaborationsCount})">...</Tab>
 *   </Tabs>
 * {/if}
 * ```
 */

import { getContext } from "svelte";
import type { CollaborativeVideo } from "../domain/CollaborativeVideo";
import type { ICollaborativeVideoManager } from "../services/contracts/ICollaborativeVideoManager";
import { TYPES } from "$lib/shared/inversify/types";
import type { Container } from "inversify";

export type LibraryTab = "all" | "created" | "collaborations";

export interface UserVideoLibraryState {
  /** All videos (created + collaborations) */
  readonly allVideos: CollaborativeVideo[];
  /** Videos the user created */
  readonly created: CollaborativeVideo[];
  /** Videos where user is a collaborator (not creator) */
  readonly collaborations: CollaborativeVideo[];
  /** Pending collaboration invites */
  readonly pendingInvites: CollaborativeVideo[];

  /** Loading state */
  readonly loading: boolean;
  /** Error if fetch failed */
  readonly error: string | null;

  /** Counts */
  readonly totalCount: number;
  readonly createdCount: number;
  readonly collaborationsCount: number;
  readonly pendingCount: number;

  /** Current filter tab */
  readonly currentTab: LibraryTab;

  /** Filtered videos based on current tab */
  readonly filteredVideos: CollaborativeVideo[];

  /** Set the current tab */
  setTab(tab: LibraryTab): void;

  /** Refresh the library */
  refresh(): Promise<void>;
}

/**
 * Create reactive state for user's video library
 */
export function createUserVideoLibraryState(): UserVideoLibraryState {
  let created = $state<CollaborativeVideo[]>([]);
  let collaborations = $state<CollaborativeVideo[]>([]);
  let pendingInvites = $state<CollaborativeVideo[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let currentTab = $state<LibraryTab>("all");

  // Derived values
  const allVideos = $derived([...created, ...collaborations]);
  const totalCount = $derived(allVideos.length);
  const createdCount = $derived(created.length);
  const collaborationsCount = $derived(collaborations.length);
  const pendingCount = $derived(pendingInvites.length);

  const filteredVideos = $derived(() => {
    switch (currentTab) {
      case "created":
        return created;
      case "collaborations":
        return collaborations;
      case "all":
      default:
        return allVideos;
    }
  });

  // Get service from DI container
  const container = getContext<Container>("container");
  const videoService = container?.get<ICollaborativeVideoManager>(
    TYPES.ICollaborativeVideoManager
  );

  async function refresh(): Promise<void> {
    if (!videoService) {
      error = "Video service not available";
      loading = false;
      return;
    }

    loading = true;
    error = null;

    try {
      const library = await videoService.getUserVideoLibrary();
      created = library.created;
      collaborations = library.collaborations;
      pendingInvites = library.pendingInvites;
    } catch (e) {
      console.error("Failed to fetch video library:", e);
      error = e instanceof Error ? e.message : "Failed to load videos";
      created = [];
      collaborations = [];
      pendingInvites = [];
    } finally {
      loading = false;
    }
  }

  function setTab(tab: LibraryTab): void {
    currentTab = tab;
  }

  // Initial fetch
  refresh();

  return {
    get allVideos() {
      return allVideos;
    },
    get created() {
      return created;
    },
    get collaborations() {
      return collaborations;
    },
    get pendingInvites() {
      return pendingInvites;
    },
    get loading() {
      return loading;
    },
    get error() {
      return error;
    },
    get totalCount() {
      return totalCount;
    },
    get createdCount() {
      return createdCount;
    },
    get collaborationsCount() {
      return collaborationsCount;
    },
    get pendingCount() {
      return pendingCount;
    },
    get currentTab() {
      return currentTab;
    },
    get filteredVideos() {
      return filteredVideos();
    },
    setTab,
    refresh,
  };
}
