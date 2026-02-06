/**
 * Impersonation Service Interface
 *
 * Provides admin "View As" functionality for support/debugging.
 */

import type { UserRole } from "../../domain/models/UserRole";

export interface ImpersonatedUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
}

export interface IImpersonator {
  /**
   * Start impersonating a user (admin only).
   */
  startImpersonation(userId: string): Promise<ImpersonatedUser>;

  /**
   * Stop impersonating and return to actual user.
   */
  stopImpersonation(): void;

  /**
   * Get current impersonated user (or null if not impersonating).
   */
  getImpersonatedUser(): ImpersonatedUser | null;

  /**
   * Check if currently impersonating.
   */
  isImpersonating(): boolean;

  /**
   * Get the effective user ID (impersonated or actual).
   */
  getEffectiveUserId(actualUserId: string | null): string | null;
}
