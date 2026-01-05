/**
 * UserDocumentManager
 *
 * Manages user document creation and updates in Firestore.
 * Ensures every authenticated user has a Firestore profile document.
 */

import { injectable, inject } from "inversify";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { type User } from "firebase/auth";
import { getFirestoreInstance } from "../../firebase";
import type { IUserDocumentManager } from "../contracts/IUserDocumentManager";
import type { IProfilePictureManager } from "../contracts/IProfilePictureManager";
import type { IUsernameValidator } from "../contracts/IUsernameValidator";
import { formatUsername } from "../../domain/models/UsernameValidation";
import { TYPES } from "../../../inversify/types";

@injectable()
export class UserDocumentManager implements IUserDocumentManager {
  constructor(
    @inject(TYPES.IProfilePictureManager)
    private readonly profilePictureService: IProfilePictureManager,
    @inject(TYPES.IUsernameValidator)
    private readonly usernameValidator: IUsernameValidator
  ) {}

  /**
   * Create or update a user document in Firestore.
   *
   * This ensures every authenticated user has a corresponding Firestore document
   * that can be displayed in the users explore panel.
   *
   * Creates new document with initial fields if doesn't exist.
   * Updates existing document with latest auth data if exists.
   */
  async createOrUpdateUserDocument(user: User): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const userDocRef = doc(firestore, `users/${user.uid}`);
      const userDoc = await getDoc(userDocRef);

      // Determine display name
      const displayName =
        user.displayName || user.email?.split("@")[0] || "Anonymous User";

      // Get provider IDs for reliable profile picture URLs
      const providerIds = this.profilePictureService.getProviderIds(user);

      if (!userDoc.exists()) {
        // NEW USER: Generate unique username and claim it
        const baseUsername = user.email?.split("@")[0] || user.uid.substring(0, 8);
        const username = await this.usernameValidator.generateUniqueUsername(baseUsername);
        const usernameLowercase = formatUsername(username);

        // Create user document first
        await setDoc(userDocRef, {
          email: user.email,
          displayName,
          username,
          usernameLowercase,
          photoURL: user.photoURL || null,
          avatar: user.photoURL || null,
          // Store provider IDs for reliable profile picture construction
          googleId: providerIds.googleId || null,
          facebookId: providerIds.facebookId || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastActivityDate: serverTimestamp(),
          // Initialize counts
          sequenceCount: 0,
          collectionCount: 0,
          followerCount: 0,
          // Initialize gamification fields (denormalized for leaderboards)
          totalXP: 0,
          currentLevel: 1,
          achievementCount: 0,
          currentStreak: 0,
          longestStreak: 0,
          // Admin status (default false)
          isAdmin: false,
        });

        // Claim username in /usernames collection (non-blocking)
        void this.usernameValidator.claimUsername(user.uid, username).catch((err) => {
          console.warn(`[UserDocumentManager] Failed to claim username: ${err.message}`);
        });

        // Notify admins of new user signup (async, non-blocking)
        void import("$lib/features/admin/services/implementations/AdminNotifier").then(
          ({ adminNotificationService }) => {
            void adminNotificationService.notifyNewUserSignup(
              user.uid,
              user.email,
              displayName
            );
          }
        );
      } else {
        // EXISTING USER: Preserve username, update other fields
        const existingData = userDoc.data();
        const existingUsername = existingData?.username;

        // Build update object - don't overwrite username
        const updateData: Record<string, unknown> = {
          email: user.email,
          displayName,
          photoURL: user.photoURL || null,
          avatar: user.photoURL || null,
          googleId: providerIds.googleId || null,
          facebookId: providerIds.facebookId || null,
          updatedAt: serverTimestamp(),
          lastActivityDate: serverTimestamp(),
        };

        // Add usernameLowercase if missing (backfill for existing users)
        if (existingUsername && !existingData?.usernameLowercase) {
          updateData.usernameLowercase = formatUsername(existingUsername);
        }

        await setDoc(userDocRef, updateData, { merge: true });
      }
    } catch (error) {
      console.error(
        `❌ [UserDocumentManager] Failed to create/update user document:`,
        error
      );
      // Don't throw - this shouldn't block authentication
    }
  }
}
