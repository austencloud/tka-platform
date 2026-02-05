/**
 * Attribution Persister Service Contract
 *
 * Responsible for storing and retrieving attribution data:
 * - localStorage for anonymous sessions
 * - Firestore for authenticated users
 */

import type {
  AnonymousAttributionSession,
  UserAttribution,
  TouchData,
  SelfReportedAttribution,
  SignupContext,
} from "../../domain/types";

export interface IAttributionPersister {
  /**
   * Get or create an anonymous session for tracking before signup
   * Returns existing session if one exists, otherwise creates new
   */
  getOrCreateSession(): AnonymousAttributionSession;

  /**
   * Get the current anonymous session if it exists
   */
  getSession(): AnonymousAttributionSession | null;

  /**
   * Record a new touch to the current session
   * Only adds if it's meaningfully different from the last touch
   */
  recordTouch(touch: TouchData): void;

  /**
   * Add self-reported attribution to the session
   */
  recordSelfReported(data: SelfReportedAttribution): void;

  /**
   * Finalize attribution on signup
   * Converts anonymous session to user attribution and persists to Firestore
   */
  finalizeForUser(
    userId: string,
    signupContext: SignupContext
  ): Promise<UserAttribution>;

  /**
   * Get attribution data for a user from Firestore
   */
  getUserAttribution(userId: string): Promise<UserAttribution | null>;

  /**
   * Update self-reported attribution for an existing user
   * (if they skipped during onboarding but want to provide later)
   */
  updateSelfReported(
    userId: string,
    data: SelfReportedAttribution
  ): Promise<void>;

  /**
   * Add self-reported data - auto-routes to session or Firestore based on auth state
   * This is the primary method for the deferred attribution prompt
   */
  addSelfReportedData(data: SelfReportedAttribution): Promise<void>;

  /**
   * Clear the anonymous session (after successful signup)
   */
  clearSession(): void;

  /**
   * Check if we have an existing session
   */
  hasSession(): boolean;
}
