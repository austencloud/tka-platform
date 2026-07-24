/**
 * UserDocumentManager
 *
 * Manages user document creation and updates in Firestore.
 * Ensures every authenticated user has a Firestore profile document.
 */

import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { type User } from "firebase/auth";
import { getFirestoreInstance } from "../firebase";
import { getProviderIds } from "./profile-picture-manager";
import { generateUniqueUsername, claimUsername } from "./username-validator";
import { formatUsername } from "../domain/models/username-validation";
import { retryAuthenticatedFirestoreOperation } from "./retry-authenticated-firestore-operation";

import { generateAvatarUrl } from "$lib/shared/foundation/utils/avatar-generator";

interface ExistingLibraryCounts {
  sequenceCount: number;
  collectionCount: number;
}

/**
 * Guest saves can create owner subcollections before the public profile
 * document exists. Count those documents when reconstructing the parent so a
 * later account upgrade cannot overwrite real library totals with zeroes.
 */
async function getExistingLibraryCounts(
  user: User
): Promise<ExistingLibraryCounts> {
  return retryAuthenticatedFirestoreOperation(user, async () => {
    const firestore = await getFirestoreInstance();
    const sequencesRef = collection(firestore, "users", user.uid, "sequences");
    const collectionsRef = collection(
      firestore,
      "users",
      user.uid,
      "collections"
    );
    const [sequencesSnapshot, collectionsSnapshot] = await Promise.all([
      getCountFromServer(sequencesRef),
      getDocs(collectionsRef),
    ]);

    return {
      sequenceCount: sequencesSnapshot.data().count,
      // Favorites and any future system collections do not count toward the
      // user-created collection total, even if their systemType is null.
      collectionCount: collectionsSnapshot.docs.filter(
        (collectionDoc) =>
          !Object.prototype.hasOwnProperty.call(
            collectionDoc.data(),
            "systemType"
          )
      ).length,
    };
  });
}

/**
 * Capitalize each word in a name (e.g., "brendan freaney" -> "Brendan Freaney")
 * Handles common edge cases like hyphenated names and apostrophes.
 */
function capitalizeName(name: string): string {
  if (!name) return name;

  return name
    .split(" ")
    .map((word) => {
      if (!word) return word;
      // Handle hyphenated names (e.g., "mary-jane" -> "Mary-Jane")
      if (word.includes("-")) {
        return word
          .split("-")
          .map(
            (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
          )
          .join("-");
      }
      // Handle names with apostrophes (e.g., "o'brien" -> "O'Brien")
      if (word.includes("'")) {
        const parts = word.split("'");
        return parts
          .map(
            (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
          )
          .join("'");
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export class UserDocumentManager {
  constructor() {}

  /**
   * Create or update a user document in Firestore.
   *
   * This ensures every authenticated user has a corresponding Firestore document
   * that can be displayed in the users browse panel.
   *
   * Creates new document with initial fields if doesn't exist.
   * Updates existing document with latest auth data if exists.
   */
  async createOrUpdateUserDocument(user: User): Promise<void> {
    try {
      // Dev guard: localhost writes straight to production Firestore (no
      // emulator wired). Skip minting a public profile doc for anonymous guest
      // sessions during development so dev reloads don't pollute the live
      // `users` collection. Real (linked) accounts still get their doc in dev.
      if (user.isAnonymous && !import.meta.env.PROD) return;

      const firestore = await getFirestoreInstance();
      const userDocRef = doc(firestore, `users/${user.uid}`);
      const userDoc = await retryAuthenticatedFirestoreOperation(user, () =>
        getDoc(userDocRef)
      );

      // Determine display name and auto-capitalize
      const rawName =
        user.displayName || user.email?.split("@")[0] || "Anonymous User";
      const displayName = capitalizeName(rawName);

      // Get provider IDs for reliable profile picture URLs
      const providerIds = getProviderIds(user);

      // Capture the Google provider's photo URL separately so we can
      // always offer "Use Google Photo" even after the user switches to
      // a generated avatar (which overwrites user.photoURL).
      const googleProvider = user.providerData.find(
        (p) => p.providerId === "google.com"
      );
      const googlePhotoURL = googleProvider?.photoURL || null;

      if (!userDoc.exists()) {
        const existingLibraryCounts = await getExistingLibraryCounts(user);

        // NEW USER: Generate unique username and claim it
        const baseUsername =
          user.email?.split("@")[0] || user.uid.substring(0, 8);
        const username = await generateUniqueUsername(baseUsername);
        const usernameLowercase = formatUsername(username);

        // Create user document first
        // NOTE: Email deliberately NOT stored here - user documents are publicly readable
        // Email is available via Firebase Auth for the user themselves
        const fallbackAvatar = generateAvatarUrl(displayName, 256);

        await retryAuthenticatedFirestoreOperation(user, () =>
          setDoc(userDocRef, {
            displayName,
            username,
            usernameLowercase,
            photoURL: user.photoURL || fallbackAvatar,
            avatar: user.photoURL || fallbackAvatar,
            // Store provider IDs and original photo URLs for reliable restoration
            googleId: providerIds.googleId || null,
            googlePhotoURL: googlePhotoURL,
            facebookId: providerIds.facebookId || null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastActivityDate: serverTimestamp(),
            sequenceCount: existingLibraryCounts.sequenceCount,
            collectionCount: existingLibraryCounts.collectionCount,
            followerCount: 0,
            // Initialize gamification fields (denormalized for leaderboards)
            totalXP: 0,
            currentLevel: 1,
            achievementCount: 0,
            currentStreak: 0,
            longestStreak: 0,
            // Optional profile fields
            pronouns: null,
            // Admin status (default false)
            isAdmin: false,
            // Guest flag — anonymous sessions are excluded from Browse Creators
            // until they upgrade to a full account (see anonymous-upgrade.ts).
            isAnonymous: user.isAnonymous,
          })
        );

        if (!user.isAnonymous) {
          await retryAuthenticatedFirestoreOperation(user, () =>
            claimUsername(user.uid, username)
          );
        }

        // Admin signup notifications are handled server-side by the
        // pulseUserActivity cloud function (fires on this doc create).
        // The old client-side notify call was always denied by Firestore
        // rules — a non-admin can't write another user's notifications —
        // and silently failed for every signup since launch.
      } else {
        // EXISTING USER: Preserve username, update other fields
        const existingData = userDoc.data();
        const existingUsername = existingData?.username;

        // Build update object - don't overwrite username
        // NOTE: Email deliberately NOT stored - user documents are publicly readable
        const updateData: Record<string, unknown> = {
          displayName,
          googleId: providerIds.googleId || null,
          facebookId: providerIds.facebookId || null,
          updatedAt: serverTimestamp(),
          lastActivityDate: serverTimestamp(),
          // Keep the guest flag current. onAuthStateChanged doesn't reliably
          // fire on in-place link, so anonymous-upgrade.ts also clears this
          // explicitly — this just keeps it correct on any later auth refresh.
          isAnonymous: user.isAnonymous,
        };

        // Only overwrite avatar fields when Auth provides a real URL.
        // Prevents nulling out a generated or custom avatar on re-login.
        if (user.photoURL) {
          updateData.photoURL = user.photoURL;
          updateData.avatar = user.photoURL;
        } else if (!existingData?.photoURL) {
          const fallback = generateAvatarUrl(displayName, 256);
          updateData.photoURL = fallback;
          updateData.avatar = fallback;
        }

        // Only update googlePhotoURL if we have a fresh one from the provider.
        // Don't null it out - the provider's photoURL becomes null after the
        // user switches to a generated avatar, but we want to keep the
        // original so "Use Google Photo" always works.
        if (googlePhotoURL) {
          updateData.googlePhotoURL = googlePhotoURL;
        }

        // Add usernameLowercase if missing (backfill for existing users)
        if (existingUsername && !existingData?.usernameLowercase) {
          updateData.usernameLowercase = formatUsername(existingUsername);
        }

        await retryAuthenticatedFirestoreOperation(user, () =>
          setDoc(userDocRef, updateData, { merge: true })
        );

        // Repair accounts whose parent profile was created while an anonymous
        // token was still being replaced and whose first username claim was
        // consequently denied.
        if (existingUsername && !user.isAnonymous) {
          await retryAuthenticatedFirestoreOperation(user, () =>
            claimUsername(user.uid, existingUsername)
          );
        }
      }
    } catch (error) {
      console.error(
        `❌ [UserDocumentManager] Failed to create/update user document:`,
        error
      );
      // Don't throw - this shouldn't block authentication
    }
  }

  /**
   * Detect the signup method from user provider data
   */
  private detectSignupMethod(user: User): "google" | "apple" | "email" {
    const providers = user.providerData.map((p) => p.providerId);
    if (providers.includes("google.com")) return "google";
    if (providers.includes("apple.com")) return "apple";
    return "email";
  }

  /**
   * Update only the photoURL field for a user's Firestore document.
   * Used when user changes their profile picture without a full auth refresh.
   */
  async updatePhotoURL(userId: string, photoURL: string): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const userDocRef = doc(firestore, `users/${userId}`);

      await setDoc(
        userDocRef,
        {
          photoURL,
          avatar: photoURL,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error(
        `❌ [UserDocumentManager] Failed to update photoURL:`,
        error
      );
      // Don't throw - this shouldn't block the main operation
    }
  }

  /**
   * Update the user's profile accent color in Firestore.
   * This color appears as the ring around the avatar and on profile cards.
   */
  async updateProfileColor(userId: string, color: string): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const userDocRef = doc(firestore, `users/${userId}`);

      await setDoc(
        userDocRef,
        {
          profileColor: color,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error(
        `❌ [UserDocumentManager] Failed to update profileColor:`,
        error
      );
    }
  }
}
