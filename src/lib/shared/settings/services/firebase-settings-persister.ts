/**
 * Firebase Settings Persistence Service
 *
 * Persists user settings to Firestore for authenticated users.
 * Provides real-time sync across devices and tabs.
 *
 * Storage structure:
 * - users/{uid}/settings (document containing all app settings)
 */

import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, getFirestoreInstance } from "../../auth/firebase";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
import { isPermissionDeniedError } from "$lib/shared/auth/utils/isPermissionDeniedError";
import { trackWrite } from "$lib/shared/offline/state/sync-status-state.svelte";
import type { AppSettings } from "../domain/AppSettings";

export class FirebaseSettingsPersister {
  private unsubscribe: Unsubscribe | null = null;

  /**
   * Get the Firestore document reference for user settings
   * Note: Uses actual user ID, not effective (preview) user ID
   */
  private async getSettingsDocRef() {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      return null;
    }
    const firestore = await getFirestoreInstance();
    return doc(firestore, `users/${userId}/settings/preferences`);
  }

  /**
   * Load settings from Firestore
   */
  async loadSettings(): Promise<AppSettings | null> {
    const docRef = await this.getSettingsDocRef();
    if (!docRef) {
      return null;
    }

    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Remove Firestore metadata fields
         
        const {
          updatedAt: _updatedAt,
          createdAt: _createdAt,
          ...settings
        } = data;
        return settings as AppSettings;
      }
      return null;
    } catch (error) {
      console.error(
        "❌ [FirebaseSettingsPersister] Failed to load settings:",
        error
      );
      return null;
    }
  }

  /**
   * Save settings to Firestore
   */
  async saveSettings(settings: AppSettings): Promise<void> {
    const docRef = await this.getSettingsDocRef();
    if (!docRef) {
      console.warn(
        "⚠️ [FirebaseSettingsPersister] Cannot save: No authenticated user"
      );
      return;
    }

    try {
      await trackWrite(() =>
        setDoc(
          docRef,
          {
            ...settings,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )
      );
    } catch (error) {
      console.error(
        "❌ [FirebaseSettingsPersister] Failed to save settings:",
        error
      );
      toast.error("Failed to save settings.");
      throw error;
    }
  }

  /**
   * Clear settings from Firestore
   */
  async clearSettings(): Promise<void> {
    const docRef = await this.getSettingsDocRef();
    if (!docRef) {
      return;
    }

    try {
      // Set to empty object with timestamp to preserve document
      await trackWrite(() =>
        setDoc(docRef, {
          clearedAt: serverTimestamp(),
        })
      );
    } catch (error) {
      console.error(
        "❌ [FirebaseSettingsPersister] Failed to clear settings:",
        error
      );
      toast.error("Failed to clear settings.");
      throw error;
    }
  }

  /**
   * Check if settings exist in Firestore
   */
  async hasSettings(): Promise<boolean> {
    const docRef = await this.getSettingsDocRef();
    if (!docRef) {
      return false;
    }

    try {
      const docSnap = await getDoc(docRef);
      return docSnap.exists() && Object.keys(docSnap.data() || {}).length > 1; // More than just timestamps
    } catch (error) {
      console.error(
        "❌ [FirebaseSettingsPersister] Failed to check settings:",
        error
      );
      return false;
    }
  }

  /**
   * Subscribe to real-time settings changes from Firestore
   * This enables cross-device sync
   */
  onSettingsChange(callback: (settings: AppSettings) => void): () => void {
    // Clean up any existing subscription
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    // Start async subscription setup
    this.getSettingsDocRef()
      .then((docRef) => {
        if (!docRef) {
          return; // No user, no subscription
        }

        this.unsubscribe = onSnapshot(
          docRef,
          (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data();
              // Remove Firestore metadata fields
               
              const {
                updatedAt: _updatedAt,
                createdAt: _createdAt,
                clearedAt: _clearedAt,
                ...settings
              } = data;
              if (Object.keys(settings).length > 0) {
                callback(settings as AppSettings);
              }
            }
          },
          (error) => {
            // Expected on sign-out - user settings are no longer readable.
            if (isPermissionDeniedError(error)) return;
            console.error(
              "❌ [FirebaseSettingsPersister] Subscription error:",
              error
            );
            toast.error("Lost connection to settings. Please refresh.");
          }
        );
      })
      .catch((error) => {
        console.error(
          "❌ [FirebaseSettingsPersister] Failed to initialize settings subscription:",
          error
        );
        toast.error("Failed to connect to settings.");
      });

    return () => {
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
    };
  }
}
