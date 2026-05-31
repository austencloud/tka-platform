/**
 * User Preview State
 *
 * Comprehensive read-only preview of another user's data for admin debugging.
 * Uses direct Firestore queries - no server endpoints needed.
 */
import { browser } from "$app/environment";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  type Timestamp,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { AppSettings } from "$lib/shared/settings/domain/app-settings";
import type { NotificationPreferences } from "$lib/shared/notifications/domain/models/notification-models";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "$lib/shared/notifications/domain/models/notification-models";

// ============================================================================
// Types
// ============================================================================

export interface PreviewUserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  username?: string;
  role?: string;
  createdAt?: string;
  lastActivityDate?: string;
}

export interface PreviewGamification {
  totalXP: number;
  currentLevel: number;
  achievementCount: number;
  currentStreak: number;
  longestStreak: number;
}

export interface PreviewSequence {
  id: string;
  name: string;
  word?: string;
  thumbnailUrl?: string;
  createdAt?: string;
  isPublic?: boolean;
  favoriteCount?: number;
}

export interface PreviewCollection {
  id: string;
  name: string;
  description?: string;
  sequenceCount: number;
  isSystem?: boolean;
  createdAt?: string;
}

export interface PreviewAchievement {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  unlockedAt?: string;
}

export interface PreviewNotification {
  id: string;
  type: string;
  title?: string;
  message?: string;
  read?: boolean;
  createdAt?: string;
}

export interface PreviewAuthProvider {
  providerId: string;
  uid: string;
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null;
  photoURL: string | null;
}

export interface PreviewMFAFactor {
  uid: string;
  displayName: string | null;
  factorId: string;
  enrollmentTime: string | undefined;
}

export interface PreviewAuthData {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  photoURL: string | null;
  phoneNumber: string | null;
  disabled: boolean;
  providers: PreviewAuthProvider[];
  metadata: {
    creationTime: string | undefined;
    lastSignInTime: string | undefined;
  };
  multiFactor: {
    enrolledFactors: PreviewMFAFactor[];
  } | null;
}

export interface UserPreviewData {
  profile: PreviewUserProfile | null;
  gamification: PreviewGamification | null;
  sequences: PreviewSequence[];
  collections: PreviewCollection[];
  achievements: PreviewAchievement[];
  notifications: PreviewNotification[];
  settings: AppSettings | null;
  authData: PreviewAuthData | null;
  notificationPreferences: NotificationPreferences | null;
}

export type LazySection =
  | "sequences"
  | "collections"
  | "achievements"
  | "notifications"
  | "authData"
  | "notificationPreferences";

interface UserPreviewState {
  isActive: boolean;
  isLoading: boolean;
  loadingSection: string | null;
  error: string | null;
  data: UserPreviewData;
  loadedSections: Set<LazySection>;
}

// ============================================================================
// Helpers
// ============================================================================

function formatTimestamp(
  ts: Timestamp | Date | string | null | undefined
): string | null {
  if (!ts) return null;
  if (typeof ts === "string") return ts;
  if (ts instanceof Date) return ts.toISOString();
  if (typeof ts === "object" && "toDate" in ts) {
    return (ts as Timestamp).toDate().toISOString();
  }
  return null;
}

// ============================================================================
// Persistence
// ============================================================================

const PREVIEW_USER_ID_KEY = "tka-admin-preview-uid";

function savePreviewUserId(userId: string): void {
  if (!browser) return;
  try {
    localStorage.setItem(PREVIEW_USER_ID_KEY, userId);
  } catch {
    // localStorage may be unavailable
  }
}

function clearPreviewUserId(): void {
  if (!browser) return;
  try {
    localStorage.removeItem(PREVIEW_USER_ID_KEY);
  } catch {
    // localStorage may be unavailable
  }
}

function getSavedPreviewUserId(): string | null {
  if (!browser) return null;
  try {
    return localStorage.getItem(PREVIEW_USER_ID_KEY);
  } catch {
    return null;
  }
}

// ============================================================================
// State
// ============================================================================

const initialData: UserPreviewData = {
  profile: null,
  gamification: null,
  sequences: [],
  collections: [],
  achievements: [],
  notifications: [],
  settings: null,
  authData: null,
  notificationPreferences: null,
};

export const userPreviewState = $state<UserPreviewState>({
  isActive: false,
  isLoading: false,
  loadingSection: null,
  error: null,
  data: { ...initialData },
  loadedSections: new Set(),
});

// ============================================================================
// Direct Firestore Fetchers
// ============================================================================

async function fetchProfile(
  userId: string
): Promise<PreviewUserProfile | null> {
  try {
    const firestore = await getFirestoreInstance();
    const userDoc = await getDoc(doc(firestore, "users", userId));

    if (!userDoc.exists()) {
      // Return minimal profile with just the UID
      return {
        uid: userId,
        email: null,
        displayName: null,
        photoURL: null,
        role: "user",
      };
    }

    const data = userDoc.data();
    return {
      uid: userId,
      email: data.email || null,
      displayName: data.displayName || null,
      photoURL: data.photoURL || data.avatar || null,
      username: data.username || null,
      role: data.role || (data.isAdmin ? "admin" : "user"),
      createdAt: formatTimestamp(data.createdAt) || undefined,
      lastActivityDate: formatTimestamp(data.lastActivityDate) || undefined,
    };
  } catch (err) {
    console.error("[UserPreview] Failed to fetch profile:", err);
    return null;
  }
}

async function fetchGamification(
  userId: string
): Promise<PreviewGamification | null> {
  try {
    const firestore = await getFirestoreInstance();
    const userDoc = await getDoc(doc(firestore, "users", userId));

    if (!userDoc.exists()) return null;

    const data = userDoc.data();
    return {
      totalXP: data.totalXP || 0,
      currentLevel: data.currentLevel || 1,
      achievementCount: data.achievementCount || 0,
      currentStreak: data.currentStreak || 0,
      longestStreak: data.longestStreak || 0,
    };
  } catch (err) {
    console.error("[UserPreview] Failed to fetch gamification:", err);
    return null;
  }
}

async function fetchSequences(userId: string): Promise<PreviewSequence[]> {
  try {
    const firestore = await getFirestoreInstance();
    const q = query(
      collection(firestore, "sequences"),
      where("createdBy", "==", userId),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const snap = await getDocs(q);

    return snap.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        name: data.name || "Untitled",
        word: data.word || undefined,
        thumbnailUrl: data.thumbnailUrl || undefined,
        createdAt: formatTimestamp(data.createdAt) || undefined,
        isPublic: data.isPublic || false,
        favoriteCount: data.favoriteCount || 0,
      };
    });
  } catch (err) {
    console.error("[UserPreview] Failed to fetch sequences:", err);
    return [];
  }
}

async function fetchCollections(userId: string): Promise<PreviewCollection[]> {
  try {
    const firestore = await getFirestoreInstance();
    const q = query(
      collection(firestore, `users/${userId}/collections`),
      orderBy("createdAt", "desc"),
      limit(30)
    );
    const snap = await getDocs(q);

    return snap.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        name: data.name || "Untitled",
        description: data.description || undefined,
        sequenceCount: data.sequenceCount || 0,
        isSystem: data.isSystem || false,
        createdAt: formatTimestamp(data.createdAt) || undefined,
      };
    });
  } catch (err) {
    console.error("[UserPreview] Failed to fetch collections:", err);
    return [];
  }
}

async function fetchAchievements(
  userId: string
): Promise<PreviewAchievement[]> {
  try {
    const firestore = await getFirestoreInstance();
    const q = query(
      collection(firestore, `users/${userId}/achievements`),
      orderBy("unlockedAt", "desc"),
      limit(50)
    );
    const snap = await getDocs(q);

    return snap.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        name: data.name || data.achievementId || docSnap.id,
        description: data.description || undefined,
        icon: data.icon || undefined,
        unlockedAt: formatTimestamp(data.unlockedAt) || undefined,
      };
    });
  } catch (err) {
    console.error("[UserPreview] Failed to fetch achievements:", err);
    return [];
  }
}

async function fetchNotifications(
  userId: string
): Promise<PreviewNotification[]> {
  try {
    const firestore = await getFirestoreInstance();
    const q = query(
      collection(firestore, `users/${userId}/notifications`),
      orderBy("createdAt", "desc"),
      limit(30)
    );
    const snap = await getDocs(q);

    return snap.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        type: data.type || "general",
        title: data.title || undefined,
        message: data.message || undefined,
        read: data.read || false,
        createdAt: formatTimestamp(data.createdAt) || undefined,
      };
    });
  } catch (err) {
    console.error("[UserPreview] Failed to fetch notifications:", err);
    return [];
  }
}

async function fetchSettings(userId: string): Promise<AppSettings | null> {
  try {
    const firestore = await getFirestoreInstance();
    const settingsDoc = await getDoc(
      doc(firestore, `users/${userId}/settings/preferences`)
    );

    if (!settingsDoc.exists()) {
      return null;
    }

    const data = settingsDoc.data();
    // Remove Firestore metadata fields
    const { updatedAt: _u, createdAt: _c, clearedAt: _cl, ...settings } = data;
    return settings as AppSettings;
  } catch (err) {
    console.error("[UserPreview] Failed to fetch settings:", err);
    return null;
  }
}

async function fetchNotificationPreferences(
  userId: string
): Promise<NotificationPreferences | null> {
  try {
    const firestore = await getFirestoreInstance();
    const prefsDoc = await getDoc(
      doc(firestore, `users/${userId}/settings/notificationPreferences`)
    );

    if (!prefsDoc.exists()) {
      // Return defaults if no preferences doc exists
      return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    }

    const data = prefsDoc.data();
    // Merge with defaults to ensure all fields are present
    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...data,
    } as NotificationPreferences;
  } catch (err) {
    console.error(
      "[UserPreview] Failed to fetch notification preferences:",
      err
    );
    return null;
  }
}

/**
 * Fetch user's Firebase Auth data via admin endpoint.
 * Requires the caller to be an admin.
 */
async function fetchAuthData(userId: string): Promise<PreviewAuthData | null> {
  try {
    // Get the current user's ID token for auth
    // Use getAuthInstance() to ensure Firebase is properly initialized
    const { getAuthInstance } = await import("$lib/shared/auth/firebase");
    const auth = await getAuthInstance();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.warn("[UserPreview] Cannot fetch auth data - not signed in");
      return null;
    }

    const idToken = await currentUser.getIdToken();
    const response = await fetch(`/api/admin/user-auth/${userId}`, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error("[UserPreview] Failed to fetch auth data:", error);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error("[UserPreview] Failed to fetch auth data:", err);
    return null;
  }
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Load user preview - initially only loads profile + gamification (lightweight).
 * Other sections are lazy-loaded on demand via loadPreviewSection.
 */
export async function loadUserPreview(
  userId: string,
  eager = false
): Promise<void> {
  if (!browser) return;

  userPreviewState.isLoading = true;
  userPreviewState.loadingSection = "profile";
  userPreviewState.error = null;
  userPreviewState.loadedSections = new Set();

  // Persist the preview user ID for page refresh
  savePreviewUserId(userId);

  try {
    if (eager) {
      // Load all data in parallel
      const [
        profile,
        gamification,
        sequences,
        collections,
        achievements,
        notifications,
        settings,
        authData,
        notificationPreferences,
      ] = await Promise.all([
        fetchProfile(userId),
        fetchGamification(userId),
        fetchSequences(userId),
        fetchCollections(userId),
        fetchAchievements(userId),
        fetchNotifications(userId),
        fetchSettings(userId),
        fetchAuthData(userId),
        fetchNotificationPreferences(userId),
      ]);

      userPreviewState.data = {
        profile,
        gamification,
        sequences,
        collections,
        achievements,
        notifications,
        settings,
        authData,
        notificationPreferences,
      };
      userPreviewState.loadedSections = new Set([
        "sequences",
        "collections",
        "achievements",
        "notifications",
        "authData",
        "notificationPreferences",
      ]);
    } else {
      // Lazy mode: fetch profile, gamification, settings, and notification preferences initially
      // These are needed immediately for ProfileTab
      const [profile, gamification, settings, notificationPreferences] =
        await Promise.all([
          fetchProfile(userId),
          fetchGamification(userId),
          fetchSettings(userId),
          fetchNotificationPreferences(userId),
        ]);

      userPreviewState.data = {
        profile,
        gamification,
        sequences: [],
        collections: [],
        achievements: [],
        notifications: [],
        settings,
        authData: null,
        notificationPreferences,
      };
    }

    userPreviewState.isActive = true;
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to load user preview";
    userPreviewState.error = message;
    userPreviewState.isActive = false;
    userPreviewState.data = { ...initialData };
  } finally {
    userPreviewState.isLoading = false;
    userPreviewState.loadingSection = null;
  }
}

/**
 * Lazy-load a specific section of preview data.
 */
export async function loadPreviewSection(section: LazySection): Promise<void> {
  if (!browser || !userPreviewState.isActive || !userPreviewState.data.profile)
    return;
  if (userPreviewState.loadedSections.has(section)) return;

  const userId = userPreviewState.data.profile.uid;
  userPreviewState.loadingSection = section;

  try {
    switch (section) {
      case "sequences":
        userPreviewState.data.sequences = await fetchSequences(userId);
        break;
      case "collections":
        userPreviewState.data.collections = await fetchCollections(userId);
        break;
      case "achievements":
        userPreviewState.data.achievements = await fetchAchievements(userId);
        break;
      case "notifications":
        userPreviewState.data.notifications = await fetchNotifications(userId);
        break;
      case "authData":
        userPreviewState.data.authData = await fetchAuthData(userId);
        break;
      case "notificationPreferences":
        userPreviewState.data.notificationPreferences =
          await fetchNotificationPreferences(userId);
        break;
    }

    userPreviewState.loadedSections.add(section);
  } catch (err) {
    console.error(`[UserPreview] Failed to load ${section}:`, err);
  } finally {
    userPreviewState.loadingSection = null;
  }
}

/**
 * Refresh a specific section of the preview data
 */
export async function refreshPreviewSection(
  section: LazySection
): Promise<void> {
  if (!browser || !userPreviewState.isActive || !userPreviewState.data.profile)
    return;

  const userId = userPreviewState.data.profile.uid;
  userPreviewState.loadingSection = section;

  try {
    switch (section) {
      case "sequences":
        userPreviewState.data.sequences = await fetchSequences(userId);
        break;
      case "collections":
        userPreviewState.data.collections = await fetchCollections(userId);
        break;
      case "achievements":
        userPreviewState.data.achievements = await fetchAchievements(userId);
        break;
      case "notifications":
        userPreviewState.data.notifications = await fetchNotifications(userId);
        break;
      case "authData":
        userPreviewState.data.authData = await fetchAuthData(userId);
        break;
      case "notificationPreferences":
        userPreviewState.data.notificationPreferences =
          await fetchNotificationPreferences(userId);
        break;
    }
  } catch (err) {
    console.error(`[UserPreview] Failed to refresh ${section}:`, err);
  } finally {
    userPreviewState.loadingSection = null;
  }
}

/**
 * Clear the user preview
 */
export function clearUserPreview(): void {
  clearPreviewUserId();
  userPreviewState.isActive = false;
  userPreviewState.isLoading = false;
  userPreviewState.loadingSection = null;
  userPreviewState.error = null;
  userPreviewState.data = { ...initialData };
  userPreviewState.loadedSections = new Set();
}

/**
 * Check if a section has been loaded
 */
export function isSectionLoaded(section: LazySection): boolean {
  return userPreviewState.loadedSections.has(section);
}

// ============================================================================
// Derived Helpers
// ============================================================================

/**
 * Get the effective user ID (previewed or actual)
 */
export function getEffectiveUserId(actualUserId: string | null): string | null {
  if (userPreviewState.isActive && userPreviewState.data.profile) {
    return userPreviewState.data.profile.uid;
  }
  return actualUserId;
}

/**
 * Get the effective display name
 */
export function getEffectiveDisplayName(
  actualDisplayName: string | null
): string | null {
  if (userPreviewState.isActive && userPreviewState.data.profile) {
    return userPreviewState.data.profile.displayName;
  }
  return actualDisplayName;
}

/**
 * Get the effective photo URL
 */
export function getEffectivePhotoURL(
  actualPhotoURL: string | null
): string | null {
  if (userPreviewState.isActive && userPreviewState.data.profile) {
    return userPreviewState.data.profile.photoURL;
  }
  return actualPhotoURL;
}

/**
 * Check if the app is in read-only preview mode.
 */
export function isPreviewReadOnly(): boolean {
  return userPreviewState.isActive;
}

/**
 * Get the previewed user's settings (or null if not in preview mode)
 */
export function getPreviewSettings(): AppSettings | null {
  if (!userPreviewState.isActive) return null;
  return userPreviewState.data.settings;
}

/**
 * Get the previewed user's notification preferences (or null if not in preview mode)
 */
export function getPreviewNotificationPreferences(): NotificationPreferences | null {
  if (!userPreviewState.isActive) return null;
  return userPreviewState.data.notificationPreferences;
}

/**
 * Initialize user preview from persisted state (call on app mount).
 * Restores preview if one was active before page refresh.
 */
export async function initUserPreview(): Promise<void> {
  if (!browser) return;

  const savedUserId = getSavedPreviewUserId();
  if (savedUserId && !userPreviewState.isActive) {
    await loadUserPreview(savedUserId, true);
  }
}
