/**
 * Collaborative Video Domain Model
 *
 * Instagram-style video collaboration where multiple users can co-own
 * a performance video of a sequence. The sequence itself has one owner,
 * but the video recording can have multiple collaborators.
 *
 * Firestore collection: videos/{videoId}
 *
 * Use cases:
 * - User A creates sequence, User B films themselves performing it
 * - User B uploads video and invites User A as collaborator
 * - Both users can now feature this video in their library
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Visibility settings for collaborative videos
 */
export type VideoVisibility = "public" | "private" | "collaborators-only";

/**
 * Status of a collaboration invite
 */
export type InviteStatus = "pending" | "accepted" | "declined" | "expired";

/**
 * A pending collaboration invite
 */
export interface CollaborationInvite {
  /** User being invited */
  readonly userId: string;
  /** Display name at time of invite (for UI) */
  readonly displayName?: string;
  /** Optional invite message */
  readonly message?: string;
  /** When the invite was sent */
  readonly invitedAt: Date;
  /** Who sent the invite */
  readonly invitedBy: string;
  /** Current status */
  readonly status: InviteStatus;
  /** When status was last updated */
  readonly respondedAt?: Date;
}

/**
 * A confirmed collaborator on a video
 */
export interface VideoCollaborator {
  /** User ID */
  readonly userId: string;
  /** Display name (cached for quick display) */
  readonly displayName?: string;
  /** Avatar URL (cached for quick display) */
  readonly avatarUrl?: string;
  /** When they accepted the collaboration */
  readonly joinedAt: Date;
  /** Role in this collaboration */
  readonly role: "creator" | "collaborator";
}

// ============================================================================
// MAIN MODEL
// ============================================================================

/**
 * A collaborative video that can be co-owned by multiple users
 */
export interface CollaborativeVideo {
  /** Unique video ID */
  readonly id: string;

  // ---- Video data ----
  /** Firebase Storage URL for the video */
  readonly videoUrl: string;
  /** Storage path for deletion */
  readonly storagePath: string;
  /** Preview thumbnail URL */
  readonly thumbnailUrl?: string;
  /** Video duration in seconds */
  readonly duration: number;
  /** File size in bytes */
  readonly fileSize: number;
  /** MIME type (e.g., "video/mp4") */
  readonly mimeType: string;

  // ---- Sequence reference ----
  /** The sequence this video performs */
  readonly sequenceId: string;
  /** Sequence name at time of upload (cached) */
  readonly sequenceName?: string;
  /** Original sequence creator's user ID */
  readonly sequenceOwnerId?: string;

  // ---- Collaboration structure ----
  /** User who uploaded this video (always a collaborator with role "creator") */
  readonly creatorId: string;
  /** All collaborators including creator */
  readonly collaborators: readonly VideoCollaborator[];
  /** Pending invites not yet accepted/declined */
  readonly pendingInvites: readonly CollaborationInvite[];

  // ---- Settings ----
  /** Who can see this video */
  readonly visibility: VideoVisibility;
  /** Optional description/notes */
  readonly description?: string;

  // ---- Timestamps ----
  /** When video was uploaded */
  readonly createdAt: Date;
  /** Last modification */
  readonly updatedAt: Date;
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Required fields when creating a new collaborative video
 */
export interface CreateCollaborativeVideoInput {
  videoUrl: string;
  storagePath: string;
  duration: number;
  fileSize: number;
  mimeType: string;
  sequenceId: string;
  creatorId: string;
  // Optional fields
  id?: string;
  thumbnailUrl?: string;
  sequenceName?: string;
  sequenceOwnerId?: string;
  visibility?: VideoVisibility;
  description?: string;
}

/**
 * Create a new collaborative video
 * Creator is automatically added as the first collaborator
 */
export function createCollaborativeVideo(
  input: CreateCollaborativeVideoInput,
  creatorDisplayName?: string,
  creatorAvatarUrl?: string
): CollaborativeVideo {
  const now = new Date();

  return {
    id: input.id ?? crypto.randomUUID(),
    videoUrl: input.videoUrl,
    storagePath: input.storagePath,
    thumbnailUrl: input.thumbnailUrl,
    duration: input.duration,
    fileSize: input.fileSize,
    mimeType: input.mimeType,
    sequenceId: input.sequenceId,
    sequenceName: input.sequenceName,
    sequenceOwnerId: input.sequenceOwnerId,
    creatorId: input.creatorId,
    collaborators: [
      {
        userId: input.creatorId,
        displayName: creatorDisplayName,
        avatarUrl: creatorAvatarUrl,
        joinedAt: now,
        role: "creator",
      },
    ],
    pendingInvites: [],
    visibility: input.visibility ?? "public",
    description: input.description,
    createdAt: now,
    updatedAt: now,
  };
}

// ============================================================================
// UPDATE HELPERS
// ============================================================================

/**
 * Add a pending invite to a video
 */
export function addCollaborationInvite(
  video: CollaborativeVideo,
  userId: string,
  invitedBy: string,
  displayName?: string,
  message?: string
): CollaborativeVideo {
  // Don't invite if already a collaborator
  if (video.collaborators.some((c) => c.userId === userId)) {
    return video;
  }

  // Don't invite if already has pending invite
  if (
    video.pendingInvites.some(
      (i) => i.userId === userId && i.status === "pending"
    )
  ) {
    return video;
  }

  const invite: CollaborationInvite = {
    userId,
    displayName,
    message,
    invitedAt: new Date(),
    invitedBy,
    status: "pending",
  };

  return {
    ...video,
    pendingInvites: [...video.pendingInvites, invite],
    updatedAt: new Date(),
  };
}

/**
 * Accept a collaboration invite
 */
export function acceptCollaborationInvite(
  video: CollaborativeVideo,
  userId: string,
  displayName?: string,
  avatarUrl?: string
): CollaborativeVideo {
  const inviteIndex = video.pendingInvites.findIndex(
    (i) => i.userId === userId && i.status === "pending"
  );

  if (inviteIndex === -1) {
    return video;
  }

  const now = new Date();

  // Update invite status
  const updatedInvites = video.pendingInvites.map((invite, index) =>
    index === inviteIndex
      ? { ...invite, status: "accepted" as const, respondedAt: now }
      : invite
  );

  // Add as collaborator
  const newCollaborator: VideoCollaborator = {
    userId,
    displayName,
    avatarUrl,
    joinedAt: now,
    role: "collaborator",
  };

  return {
    ...video,
    collaborators: [...video.collaborators, newCollaborator],
    pendingInvites: updatedInvites,
    updatedAt: now,
  };
}

/**
 * Decline a collaboration invite
 */
export function declineCollaborationInvite(
  video: CollaborativeVideo,
  userId: string
): CollaborativeVideo {
  const inviteIndex = video.pendingInvites.findIndex(
    (i) => i.userId === userId && i.status === "pending"
  );

  if (inviteIndex === -1) {
    return video;
  }

  const updatedInvites = video.pendingInvites.map((invite, index) =>
    index === inviteIndex
      ? { ...invite, status: "declined" as const, respondedAt: new Date() }
      : invite
  );

  return {
    ...video,
    pendingInvites: updatedInvites,
    updatedAt: new Date(),
  };
}

/**
 * Remove a collaborator from a video (self-removal or creator removal)
 * Note: Creator cannot be removed
 */
export function removeCollaborator(
  video: CollaborativeVideo,
  userId: string
): CollaborativeVideo {
  // Cannot remove the creator
  if (userId === video.creatorId) {
    return video;
  }

  return {
    ...video,
    collaborators: video.collaborators.filter((c) => c.userId !== userId),
    updatedAt: new Date(),
  };
}

/**
 * Update video visibility
 */
export function updateVideoVisibility(
  video: CollaborativeVideo,
  visibility: VideoVisibility
): CollaborativeVideo {
  return {
    ...video,
    visibility,
    updatedAt: new Date(),
  };
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Check if a user is a collaborator on this video
 */
export function isCollaborator(
  video: CollaborativeVideo,
  userId: string
): boolean {
  return video.collaborators.some((c) => c.userId === userId);
}

/**
 * Check if a user has a pending invite
 */
export function hasPendingInvite(
  video: CollaborativeVideo,
  userId: string
): boolean {
  return video.pendingInvites.some(
    (i) => i.userId === userId && i.status === "pending"
  );
}

/**
 * Check if a user can view this video
 */
export function canViewVideo(
  video: CollaborativeVideo,
  userId?: string
): boolean {
  if (video.visibility === "public") return true;
  if (!userId) return false;
  if (video.visibility === "private") return video.creatorId === userId;
  // collaborators-only
  return isCollaborator(video, userId);
}

/**
 * Get all user IDs who should see this video in their library
 */
export function getLibraryUserIds(video: CollaborativeVideo): string[] {
  return video.collaborators.map((c) => c.userId);
}
