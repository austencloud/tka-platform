/**
 * VersionService
 *
 * Firestore operations for app versioning and release tracking.
 */

import type { Timestamp } from "firebase/firestore";
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  where,
  serverTimestamp,
  writeBatch,
  limit,
  getDoc,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";

import type {
  AppVersion,
  VersionFeedbackItem,
  FeedbackSummary,
  ChangelogEntry,
} from "../../domain/models/version-models";
import { PRE_RELEASE_VERSION } from "../../domain/models/version-models";
import { isFeedbackType } from "../../domain/models/feedback-models";

const VERSIONS_COLLECTION = "versions";
const FEEDBACK_COLLECTION = "feedback";

export class VersionService {
  async getVersions(): Promise<AppVersion[]> {
    const firestore = await getFirestoreInstance();
    const q = query(
      collection(firestore, VERSIONS_COLLECTION),
      orderBy("releasedAt", "desc")
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return this.mapDocToAppVersion(data);
    });
  }

  async getVersionFeedback(version: string): Promise<VersionFeedbackItem[]> {
    const firestore = await getFirestoreInstance();
    // Simple query - items with fixedInVersion are already archived
    const q = query(
      collection(firestore, FEEDBACK_COLLECTION),
      where("fixedInVersion", "==", version)
    );

    const snapshot = await getDocs(q);

    // Sort in memory to avoid needing a composite index
    const items = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        type: isFeedbackType(data["type"]) ? data["type"] : "general",
        title: data["title"] as string,
        description: this.truncateDescription(data["description"] as string),
        createdAt: data["createdAt"],
      };
    });

    // Sort by createdAt descending and strip the extra field
    items.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });

    return items.map(({ createdAt: _createdAt, ...rest }) => rest);
  }

  async getLatestVersion(): Promise<string | null> {
    const firestore = await getFirestoreInstance();
    const q = query(
      collection(firestore, VERSIONS_COLLECTION),
      orderBy("releasedAt", "desc"),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const firstDoc = snapshot.docs[0];
    return firstDoc ? (firstDoc.data()["version"] as string) : null;
  }

  async prepareRelease(
    version: string,
    changelogEntries?: ChangelogEntry[]
  ): Promise<void> {
    const firestore = await getFirestoreInstance();
    // 1. Get all completed feedback (ready for release)
    const q2 = query(
      collection(firestore, FEEDBACK_COLLECTION),
      where("status", "==", "completed")
    );

    const snapshot = await getDocs(q2);
    const completedDocs = snapshot.docs;

    // 2. Calculate summary counts
    const summary: FeedbackSummary = { bugs: 0, features: 0, general: 0 };

    completedDocs.forEach((docSnap) => {
      const type = isFeedbackType(docSnap.data()["type"])
        ? docSnap.data()["type"]
        : "general";
      if (type === "bug") summary.bugs++;
      else if (type === "feature") summary.features++;
      else summary.general++;
    });

    // 3. Batch update all feedback items: set version and move to archived
    const batch = writeBatch(firestore);

    completedDocs.forEach((docSnap) => {
      batch.update(docSnap.ref, {
        fixedInVersion: version,
        status: "archived",
        archivedAt: serverTimestamp(),
      });
    });

    // 4. Create version document with changelog entries
    const versionDoc: Record<string, unknown> = {
      version,
      feedbackCount: completedDocs.length,
      feedbackSummary: summary,
      releasedAt: serverTimestamp(),
    };

    // Only add changelog entries if provided
    if (changelogEntries && changelogEntries.length > 0) {
      versionDoc.changelogEntries = changelogEntries;
    }

    const versionRef = doc(firestore, VERSIONS_COLLECTION, version);
    batch.set(versionRef, versionDoc);

    // 5. Commit the batch
    try {
      await batch.commit();
    } catch (error) {
      console.error("[VersionManager] Failed to prepare release:", error);
      toast.error("Failed to prepare release. Please try again.");
      throw error;
    }
  }

  async updateReleaseNotes(
    version: string,
    releaseNotes: string
  ): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const versionRef = doc(firestore, VERSIONS_COLLECTION, version);
      await updateDoc(versionRef, { releaseNotes });
    } catch (error) {
      console.error("[VersionManager] Failed to update release notes:", error);
      toast.error("Failed to update release notes. Please try again.");
      throw error;
    }
  }

  async updateChangelogEntries(
    version: string,
    changelogEntries: ChangelogEntry[]
  ): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const versionRef = doc(firestore, VERSIONS_COLLECTION, version);
      await updateDoc(versionRef, { changelogEntries });
    } catch (error) {
      console.error(
        "[VersionManager] Failed to update changelog entries:",
        error
      );
      toast.error("Failed to update changelog. Please try again.");
      throw error;
    }
  }

  async updateChangelogEntry(
    version: string,
    index: number,
    updatedEntry: ChangelogEntry
  ): Promise<void> {
    const firestore = await getFirestoreInstance();
    const versionRef = doc(firestore, VERSIONS_COLLECTION, version);
    const versionDoc = await getDoc(versionRef);

    if (!versionDoc.exists()) {
      throw new Error(`Version ${version} not found`);
    }

    const data = versionDoc.data();
    const changelogEntries =
      (data["changelogEntries"] as ChangelogEntry[]) || [];

    if (index < 0 || index >= changelogEntries.length) {
      throw new Error(`Invalid changelog entry index: ${index}`);
    }

    // Update the specific entry
    changelogEntries[index] = updatedEntry;

    try {
      await updateDoc(versionRef, { changelogEntries });
    } catch (error) {
      console.error(
        "[VersionManager] Failed to update changelog entry:",
        error
      );
      toast.error("Failed to update changelog entry. Please try again.");
      throw error;
    }
  }

  async addChangelogEntry(
    version: string,
    entry: ChangelogEntry
  ): Promise<void> {
    const firestore = await getFirestoreInstance();
    const versionRef = doc(firestore, VERSIONS_COLLECTION, version);
    const versionDoc = await getDoc(versionRef);

    if (!versionDoc.exists()) {
      throw new Error(`Version ${version} not found`);
    }

    const data = versionDoc.data();
    const changelogEntries =
      (data["changelogEntries"] as ChangelogEntry[]) || [];

    changelogEntries.push(entry);

    try {
      await updateDoc(versionRef, { changelogEntries });
    } catch (error) {
      console.error("[VersionManager] Failed to add changelog entry:", error);
      toast.error("Failed to add changelog entry. Please try again.");
      throw error;
    }
  }

  async updateEntryContributors(
    version: string,
    index: number,
    contributorIds: string[]
  ): Promise<void> {
    const firestore = await getFirestoreInstance();
    const versionRef = doc(firestore, VERSIONS_COLLECTION, version);
    const versionDoc = await getDoc(versionRef);

    if (!versionDoc.exists()) {
      throw new Error(`Version ${version} not found`);
    }

    const data = versionDoc.data();
    const changelogEntries =
      (data["changelogEntries"] as ChangelogEntry[]) || [];

    if (index < 0 || index >= changelogEntries.length) {
      throw new Error(`Invalid changelog entry index: ${index}`);
    }

    // Update the specific entry's contributor list
    const existing = changelogEntries[index]!;
    changelogEntries[index] = {
      ...existing,
      contributorIds: contributorIds.length > 0 ? contributorIds : undefined,
    };

    // Recompute the version-level contributor list as the union of all entries
    const allContributorIds = new Set<string>();
    for (const entry of changelogEntries) {
      if (entry.contributorIds) {
        for (const id of entry.contributorIds) {
          allContributorIds.add(id);
        }
      }
    }

    const versionContributorIds =
      allContributorIds.size > 0 ? [...allContributorIds] : undefined;

    try {
      await updateDoc(versionRef, {
        changelogEntries,
        ...(versionContributorIds
          ? { contributorIds: versionContributorIds }
          : { contributorIds: [] }),
      });
    } catch (error) {
      console.error(
        "[VersionManager] Failed to update entry contributors:",
        error
      );
      toast.error("Failed to update contributors. Please try again.");
      throw error;
    }
  }

  async deleteChangelogEntry(version: string, index: number): Promise<void> {
    const firestore = await getFirestoreInstance();
    const versionRef = doc(firestore, VERSIONS_COLLECTION, version);
    const versionDoc = await getDoc(versionRef);

    if (!versionDoc.exists()) {
      throw new Error(`Version ${version} not found`);
    }

    const data = versionDoc.data();
    const changelogEntries =
      (data["changelogEntries"] as ChangelogEntry[]) || [];

    if (index < 0 || index >= changelogEntries.length) {
      throw new Error(`Invalid changelog entry index: ${index}`);
    }

    changelogEntries.splice(index, 1);

    try {
      await updateDoc(versionRef, { changelogEntries });
    } catch (error) {
      console.error(
        "[VersionManager] Failed to delete changelog entry:",
        error
      );
      toast.error("Failed to delete changelog entry. Please try again.");
      throw error;
    }
  }

  /**
   * Seed v0.1.0 with human-readable changelog entries
   * Call this once to populate the initial changelog
   */
  async seedV010Changelog(): Promise<void> {
    const firestore = await getFirestoreInstance();
    const changelogEntries: ChangelogEntry[] = [
      // Bug Fixes
      {
        category: "fixed",
        text: "Sequences now load correctly when you open them from the gallery",
      },
      {
        category: "fixed",
        text: "The app no longer freezes when switching between modules",
      },
      {
        category: "fixed",
        text: "Your progress is now saved properly when you close the app",
      },
      // New Features
      {
        category: "added",
        text: "You can now see version history and release notes right here!",
      },
      {
        category: "added",
        text: "Submit feedback directly from the app - tap the Feedback tab",
      },
      {
        category: "added",
        text: "Track the status of your submitted feedback",
      },
      {
        category: "added",
        text: "Get notified when your reported issues are fixed",
      },
      // Improvements
      {
        category: "improved",
        text: "Navigation is smoother and more responsive",
      },
      { category: "improved", text: "The app loads faster on first visit" },
      {
        category: "improved",
        text: "Better error messages when something goes wrong",
      },
    ];

    const versionRef = doc(firestore, VERSIONS_COLLECTION, "0.1.0");
    try {
      await updateDoc(versionRef, {
        changelogEntries,
        releaseNotes:
          "The first official beta release! This version introduces the feedback system so you can help us make the app better.",
      });
    } catch (error) {
      console.error("[VersionManager] Failed to seed changelog:", error);
      toast.error("Failed to seed changelog. Please try again.");
      throw error;
    }
  }

  async getCompletedCount(): Promise<number> {
    const firestore = await getFirestoreInstance();
    const q = query(
      collection(firestore, FEEDBACK_COLLECTION),
      where("status", "==", "completed")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.length;
  }

  async getCompletedFeedback(): Promise<VersionFeedbackItem[]> {
    const firestore = await getFirestoreInstance();
    const q = query(
      collection(firestore, FEEDBACK_COLLECTION),
      where("status", "==", "completed")
    );

    const snapshot = await getDocs(q);

    const items = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        type: isFeedbackType(data["type"]) ? data["type"] : "general",
        title: data["title"] as string,
        description: this.truncateDescription(data["description"] as string),
        createdAt: data["createdAt"],
      };
    });

    // Sort by createdAt descending
    items.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });

    return items.map(({ createdAt: _createdAt, ...rest }) => rest);
  }

  // Legacy alias
  async getUnversionedArchivedCount(): Promise<number> {
    return this.getCompletedCount();
  }

  async tagExistingAsPreRelease(): Promise<number> {
    const firestore = await getFirestoreInstance();
    // Get all archived feedback without a version
    const q = query(
      collection(firestore, FEEDBACK_COLLECTION),
      where("status", "==", "archived")
    );

    const snapshot = await getDocs(q);

    // Filter to unversioned items
    const unversionedDocs = snapshot.docs.filter((docSnap) => {
      const data = docSnap.data();
      return !data["fixedInVersion"];
    });

    if (unversionedDocs.length === 0) {
      return 0;
    }

    // Calculate summary
    const summary: FeedbackSummary = { bugs: 0, features: 0, general: 0 };

    unversionedDocs.forEach((docSnap) => {
      const type = isFeedbackType(docSnap.data()["type"])
        ? docSnap.data()["type"]
        : "general";
      if (type === "bug") summary.bugs++;
      else if (type === "feature") summary.features++;
      else summary.general++;
    });

    // Batch update
    const batch = writeBatch(firestore);

    unversionedDocs.forEach((docSnap) => {
      batch.update(docSnap.ref, {
        fixedInVersion: PRE_RELEASE_VERSION,
      });
    });

    // Create pre-release version document
    const versionRef = doc(firestore, VERSIONS_COLLECTION, PRE_RELEASE_VERSION);
    batch.set(versionRef, {
      version: PRE_RELEASE_VERSION,
      releaseNotes: "Initial feedback collected during early development.",
      feedbackCount: unversionedDocs.length,
      feedbackSummary: summary,
      releasedAt: serverTimestamp(),
    });

    try {
      await batch.commit();
    } catch (error) {
      console.error("[VersionManager] Failed to tag pre-release items:", error);
      toast.error("Failed to tag pre-release items. Please try again.");
      throw error;
    }

    return unversionedDocs.length;
  }

  private truncateDescription(
    description: string,
    maxLength: number = 100
  ): string {
    if (description.length <= maxLength) {
      return description;
    }

    const truncated = description.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(" ");

    if (lastSpace > maxLength * 0.7) {
      return truncated.substring(0, lastSpace) + "...";
    }

    return truncated + "...";
  }

  private mapDocToAppVersion(data: Record<string, unknown>): AppVersion {
    const summaryData = data["feedbackSummary"] as
      | Record<string, number>
      | undefined;
    const changelogData = data["changelogEntries"] as
      | ChangelogEntry[]
      | undefined;
    const contributorIds = data["contributorIds"] as string[] | undefined;
    const releaseNotes = data["releaseNotes"] as string | undefined;
    const highlightsData = data["highlights"] as string[] | undefined;

    return {
      version: data["version"] as string,
      releasedAt: (data["releasedAt"] as Timestamp)?.toDate() || new Date(),
      releaseNotes: releaseNotes || undefined,
      feedbackCount: data["feedbackCount"] as number,
      feedbackSummary: summaryData
        ? {
            bugs: summaryData["bugs"] || 0,
            features: summaryData["features"] || 0,
            general: summaryData["general"] || 0,
          }
        : { bugs: 0, features: 0, general: 0 },
      changelogEntries: changelogData,
      contributorIds: contributorIds || undefined,
      highlights: highlightsData,
    };
  }
}

// Export singleton instance
export const versionService = new VersionService();
