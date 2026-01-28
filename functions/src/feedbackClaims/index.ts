/**
 * Feedback Claims Module
 *
 * Server-side operations for bulletproof feedback claim management.
 * All claim operations go through these Cloud Functions to prevent
 * race conditions and ensure tamper-proof audit trails.
 */

// Agent session management
export {
  cleanupStaleAgentSessions,
  registerAgentSession,
  heartbeatAgentSession,
} from "./cleanupStaleAgentSessions";

// Claim operations
export {
  claimFeedback,
  validateHeartbeat,
  unclaimFeedback,
  updateFeedbackStatus,
} from "./claimFeedback";

// File conflict detection
export {
  touchFile,
  checkFileConflicts,
  getActiveFileEdits,
  releaseFileEdit,
} from "./fileConflicts";

// Shared types
export * from "./types";
