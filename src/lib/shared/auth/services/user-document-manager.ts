/**
 * UserDocumentManager
 *
 * Manages user document creation and updates in Firestore.
 * Ensures every authenticated user has a Firestore profile document.
 */

import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { type User } from "firebase/auth";
import { getFirestoreInstance } from "../firebase";
import { getProviderIds } from "./profile-picture-manager";
import { generateUniqueUsername, claimUsername } from "./username-validator";
import { formatUsername } from "../domain/models/username-validation";
import { retryAuthenticatedFirestoreOperation } from "./retry-authenticated-firestore-operation";

import { generateAvatarUrl } from "$lib/shared/foundation/utils/avatar-generator";
import { PUBLIC_PROFILE_VERSION } from "$lib/shared/community/domain/models/public-profile-contract";
import { captureWhenReady } from "$lib/shared/analytics/services/posthog";
import { reportErrorTelemetry } from "$lib/shared/error/services/error-telemetry-reporter";

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
      ).catch(async (error: unknown) => {
        const reportedError =
          error instanceof Error ? error : new Error(String(error));
        await reportErrorTelemetry({
          message: "Could not read the signed-in user's profile document",
          error: reportedError,
          context: {
            module: "firestore",
            action: "get",
            additionalData: { path: `users/${user.uid}` },
          },
        });
        throw error;
      });

      // This event is the denominator for the autonomous production review.
      // It proves the exact owner-scoped read ran under deployed rules; generic
      // pageviews cannot distinguish real exposure from an untouched code path.
      captureWhenReady("profile_document_read_completed", {
        telemetry_schema_version: 2,
        telemetry_path_shape: "users/{id}",
        profile_document_exists: userDoc.exists(),
      });

      // Determine display name and auto-capitalize.
      //
      // providerData comes BEFORE the email local-part: Google sign-ins
      // routinely land with an empty top-level displayName and the real name
      // only on the provider record. Reading the email first is what stored two
      // real people as "Jasminehartart" and "Hairbykevin127".
      // Same order as provisionUserProfile.ts server-side — keep them in step.
      const providerName = user.providerData.find(
        (p) => p?.displayName
      )?.displayName;
      const rawName =
        user.displayName ||
        providerName ||
        user.email?.split("@")[0] ||
        "Anonymous User";
      const displayName = capitalizeName(rawName);
      /** Did Auth actually give us a name, or did we fall back to the email? */
      const hasRealAuthName = Boolean(user.displayName || providerName);

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
            publicProfileVersion: PUBLIC_PROFILE_VERSION,
            displayName,
            username,
            usernameLowercase,
            photoURL: user.photoURL || fallbackAvatar,
            avatar: user.photoURL || fallbackAvatar,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastActivityDate: serverTimestamp(),
            // Cloud Functions reconcile these from the actual subcollections,
            // including guest saves that predate this full profile document.
            sequenceCount: 0,
            collectionCount: 0,
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

        await setDoc(
          doc(firestore, "userPrivateProfiles", user.uid),
          {
            email: user.email ?? null,
            googleId: providerIds.googleId || null,
            googlePhotoURL,
            facebookId: providerIds.facebookId || null,
          },
          { merge: true }
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
          updatedAt: serverTimestamp(),
          lastActivityDate: serverTimestamp(),
          // Keep the guest flag current. onAuthStateChanged doesn't reliably
          // fire on in-place link, so anonymous-upgrade.ts also clears this
          // explicitly — this just keeps it correct on any later auth refresh.
          isAnonymous: user.isAnonymous,
        };

        // Same rule the avatar below follows: only overwrite the stored name
        // when Auth actually has one. This branch runs on EVERY sign-in, so
        // writing the email-derived fallback unconditionally re-mangled a
        // repaired name (and clobbered a name the user had set themselves) the
        // next time they logged in.
        if (hasRealAuthName || !existingData?.displayName) {
          updateData.displayName = displayName;
        }

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
        await setDoc(
          doc(firestore, "userPrivateProfiles", user.uid),
          {
            email: user.email ?? null,
            googleId: providerIds.googleId || null,
            facebookId: providerIds.facebookId || null,
            ...(googlePhotoURL ? { googlePhotoURL } : {}),
          },
          { merge: true }
        );

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
