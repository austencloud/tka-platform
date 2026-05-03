/**
 * Announcement Service Implementation
 *
 * Handles CRUD operations for system announcements.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
import type { Announcement } from "../../domain/models/announcement-models";

export class AnnouncementManager {
  private readonly ANNOUNCEMENTS_COLLECTION = "announcements";

  /**
   * Convert Firestore timestamp to Date
   */
  private firestoreToDate(timestamp: unknown): Date {
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate();
    }
    if (timestamp instanceof Date) {
      return timestamp;
    }
    return new Date();
  }

  /**
   * Convert announcement from Firestore format
   */
  private fromFirestore(data: unknown, id: string): Announcement {
    const doc = data as Record<string, unknown>;
    return {
      id,
      title: doc.title as string,
      message: doc.message as string,
      severity: doc.severity as Announcement["severity"],
      targetAudience: doc.targetAudience as Announcement["targetAudience"],
      showAsModal: doc.showAsModal as boolean,
      createdAt: this.firestoreToDate(doc.createdAt),
      createdBy: doc.createdBy as string,
      expiresAt: doc.expiresAt
        ? this.firestoreToDate(doc.expiresAt)
        : undefined,
      targetUserId: doc.targetUserId as string | undefined,
      actionUrl: doc.actionUrl as string | undefined,
      actionLabel: doc.actionLabel as string | undefined,
    };
  }

  /**
   * Create a new announcement
   */
  async createAnnouncement(
    announcement: Omit<Announcement, "id" | "createdAt">
  ): Promise<string> {
    try {
      const firestore = await getFirestoreInstance();
      const announcementsRef = collection(
        firestore,
        this.ANNOUNCEMENTS_COLLECTION
      );
      const newDoc = doc(announcementsRef);

      // Build data object, excluding undefined fields (Firestore doesn't accept undefined)
      const announcementData: Record<string, unknown> = {
        title: announcement.title,
        message: announcement.message,
        severity: announcement.severity,
        targetAudience: announcement.targetAudience,
        showAsModal: announcement.showAsModal,
        createdBy: announcement.createdBy,
        createdAt: Timestamp.now(),
      };

      // Add optional fields only if defined
      if (announcement.expiresAt) {
        announcementData.expiresAt = Timestamp.fromDate(announcement.expiresAt);
      }
      if (announcement.targetUserId) {
        announcementData.targetUserId = announcement.targetUserId;
      }
      if (announcement.actionUrl) {
        announcementData.actionUrl = announcement.actionUrl;
      }
      if (announcement.actionLabel) {
        announcementData.actionLabel = announcement.actionLabel;
      }

      await setDoc(newDoc, announcementData);
      return newDoc.id;
    } catch (error) {
      console.error(
        "[AnnouncementManager] Failed to create announcement:",
        error
      );
      toast.error("Failed to create announcement. Please try again.");
      throw error;
    }
  }

  /**
   * Update an existing announcement
   */
  async updateAnnouncement(
    id: string,
    updates: Partial<Announcement>
  ): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const docRef = doc(firestore, this.ANNOUNCEMENTS_COLLECTION, id);

      // Build update data, excluding undefined fields
      const updateData: Record<string, unknown> = {};

      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.message !== undefined) updateData.message = updates.message;
      if (updates.severity !== undefined)
        updateData.severity = updates.severity;
      if (updates.targetAudience !== undefined)
        updateData.targetAudience = updates.targetAudience;
      if (updates.showAsModal !== undefined)
        updateData.showAsModal = updates.showAsModal;
      if (updates.targetUserId !== undefined)
        updateData.targetUserId = updates.targetUserId;
      if (updates.actionUrl !== undefined)
        updateData.actionUrl = updates.actionUrl;
      if (updates.actionLabel !== undefined)
        updateData.actionLabel = updates.actionLabel;

      if (updates.expiresAt !== undefined) {
        updateData.expiresAt = updates.expiresAt
          ? Timestamp.fromDate(updates.expiresAt)
          : null;
      }

      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error(
        "[AnnouncementManager] Failed to update announcement:",
        error
      );
      toast.error("Failed to update announcement. Please try again.");
      throw error;
    }
  }

  /**
   * Delete an announcement
   */
  async deleteAnnouncement(id: string): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const docRef = doc(firestore, this.ANNOUNCEMENTS_COLLECTION, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(
        "[AnnouncementManager] Failed to delete announcement:",
        error
      );
      toast.error("Failed to delete announcement. Please try again.");
      throw error;
    }
  }

  /**
   * Get all announcements (admin view)
   */
  async getAllAnnouncements(): Promise<Announcement[]> {
    try {
      const firestore = await getFirestoreInstance();
      const announcementsRef = collection(
        firestore,
        this.ANNOUNCEMENTS_COLLECTION
      );
      const q = query(announcementsRef, orderBy("createdAt", "desc"));

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => this.fromFirestore(doc.data(), doc.id));
    } catch (error) {
      console.error(
        "[AnnouncementManager] Failed to get announcements:",
        error
      );
      toast.error("Failed to load announcements.");
      return [];
    }
  }

  /**
   * Get active announcements for a user (excludes expired, applies targeting)
   */
  async getActiveAnnouncementsForUser(userId: string): Promise<Announcement[]> {
    try {
      const firestore = await getFirestoreInstance();
      const _now = Timestamp.now();
      const announcementsRef = collection(
        firestore,
        this.ANNOUNCEMENTS_COLLECTION
      );

      // Get user document to check admin status
      const userDoc = await getDoc(doc(firestore, `users/${userId}`));
      const isAdmin = userDoc.exists()
        ? (userDoc.data()?.isAdmin as boolean)
        : false;

      // Get all announcements (we'll filter targeting client-side)
      const snapshot = await getDocs(
        query(announcementsRef, orderBy("createdAt", "desc"))
      );

      const announcements = snapshot.docs
        .map((doc) => this.fromFirestore(doc.data(), doc.id))
        .filter((announcement) => {
          // Filter out expired announcements
          if (announcement.expiresAt && announcement.expiresAt < new Date()) {
            return false;
          }

          // Apply audience targeting
          switch (announcement.targetAudience) {
            case "all":
              return true;
            case "admins":
              return isAdmin;
            case "specific-user":
              return announcement.targetUserId === userId;
            case "beta":
            case "new":
            case "active":
            case "creators":
              // TODO: Implement user targeting logic when user metadata is available
              return true;
            default:
              return true;
          }
        });

      return announcements;
    } catch (error) {
      console.error(
        "[AnnouncementManager] Failed to get active announcements:",
        error
      );
      toast.error("Failed to load announcements.");
      return [];
    }
  }

  /**
   * Check if user has dismissed an announcement
   */
  async hasUserDismissed(
    userId: string,
    announcementId: string
  ): Promise<boolean> {
    try {
      const firestore = await getFirestoreInstance();
      const dismissalRef = doc(
        firestore,
        `users/${userId}/dismissedAnnouncements/${announcementId}`
      );
      const dismissalDoc = await getDoc(dismissalRef);
      return dismissalDoc.exists();
    } catch (error) {
      console.error(
        "[AnnouncementManager] Failed to check dismissal status:",
        error
      );
      // Default to true (dismissed) on error to avoid showing broken announcements
      return true;
    }
  }

  /**
   * Mark announcement as dismissed for a user
   */
  async dismissAnnouncement(
    userId: string,
    announcementId: string
  ): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const dismissalRef = doc(
        firestore,
        `users/${userId}/dismissedAnnouncements/${announcementId}`
      );

      await setDoc(dismissalRef, {
        announcementId,
        dismissedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error(
        "[AnnouncementManager] Failed to dismiss announcement:",
        error
      );
      toast.error("Failed to dismiss announcement.");
      throw error;
    }
  }

  /**
   * Get undismissed modal announcements for a user
   */
  async getUndismissedModalAnnouncements(
    userId: string
  ): Promise<Announcement[]> {
    const activeAnnouncements =
      await this.getActiveAnnouncementsForUser(userId);

    // Filter for modal-only and check dismissal status
    const modalAnnouncements = activeAnnouncements.filter((a) => a.showAsModal);

    const undismissed: Announcement[] = [];
    for (const announcement of modalAnnouncements) {
      const dismissed = await this.hasUserDismissed(userId, announcement.id);
      if (!dismissed) {
        undismissed.push(announcement);
      }
    }

    return undismissed;
  }
}
