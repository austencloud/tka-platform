/**
 * Collaborative Video Service Contract
 *
 * Manages CRUD operations for collaborative videos in Firestore.
 * Collection path: videos/{videoId}
 */

import type {
  CollaborativeVideo,
  StepMap,
} from "../../domain/CollaborativeVideo";

/**
 * Result of querying videos for a user's library
 */
export interface UserVideoLibrary {
  /** Videos where user is the creator */
  created: CollaborativeVideo[];
  /** Videos where user is a collaborator (not creator) */
  collaborations: CollaborativeVideo[];
  /** Pending invites waiting for user's response */
  pendingInvites: CollaborativeVideo[];
}

export interface ICollaborativeVideoManager {
  // ---- CRUD Operations ----

  /**
   * Save a new collaborative video to Firestore
   */
  saveVideo(video: CollaborativeVideo): Promise<void>;

  /**
   * Get a video by ID
   */
  getVideo(videoId: string): Promise<CollaborativeVideo | null>;

  /**
   * Delete a video (only creator can delete)
   */
  deleteVideo(videoId: string): Promise<void>;

  /**
   * Update video metadata (visibility, description)
   */
  updateVideo(
    videoId: string,
    updates: Partial<Pick<CollaborativeVideo, "visibility" | "description">>
  ): Promise<void>;

  // ---- Beat Mapping ----

  /**
   * Save or update the beat-to-timestamp mapping for a video.
   * Any collaborator on the video can update the beat map.
   */
  updateStepMap(videoId: string, beatMap: StepMap): Promise<void>;

  // ---- Collaboration Management ----

  /**
   * Invite a user to collaborate on a video
   */
  inviteCollaborator(
    videoId: string,
    userId: string,
    displayName?: string,
    message?: string
  ): Promise<void>;

  /**
   * Accept a collaboration invite
   */
  acceptInvite(videoId: string): Promise<void>;

  /**
   * Decline a collaboration invite
   */
  declineInvite(videoId: string): Promise<void>;

  /**
   * Remove a collaborator from a video (self-removal or creator removal)
   */
  removeCollaborator(videoId: string, userId: string): Promise<void>;

  // ---- Query Operations ----

  /**
   * Get all videos for a sequence
   */
  getVideosForSequence(sequenceId: string): Promise<CollaborativeVideo[]>;

  /**
   * Get user's video library (created, collaborations, pending)
   */
  getUserVideoLibrary(): Promise<UserVideoLibrary>;

  /**
   * Get videos where user has pending invites
   */
  getPendingInvites(): Promise<CollaborativeVideo[]>;

  /**
   * Get public videos (for discovery)
   */
  getPublicVideos(limit?: number): Promise<CollaborativeVideo[]>;
}
