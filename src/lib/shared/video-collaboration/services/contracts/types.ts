// --- From CollaborativeVideoManager ---
/**
 * Collaborative Video Service Contract
 *
 * Manages CRUD operations for collaborative videos in Firestore.
 * Collection path: videos/{videoId}
 */

import type {
  CollaborativeVideo,
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

