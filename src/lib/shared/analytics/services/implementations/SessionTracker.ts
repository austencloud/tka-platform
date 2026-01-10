/**
 * Session Tracking Service Implementation
 *
 * Manages user sessions for activity tracking.
 * Sessions persist to localStorage and resume within a timeout window.
 */

import type {
  ISessionTracker,
  SessionInfo,
} from "../contracts/ISessionTracker";
import { auth } from "../../../auth/firebase";

const STORAGE_KEY = "tka_session";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

interface StoredSession {
  sessionId: string;
  startedAt: string; // ISO string
  lastActivity: number; // timestamp
  userId: string | null;
  device: "desktop" | "mobile" | "tablet";
}

export class SessionTracker implements ISessionTracker {
  private sessionInfo: SessionInfo | null = null;
  private sessionEndCallback: (() => Promise<void>) | null = null;

  constructor() {
    // Try to resume existing session or start new one
    this.initializeSession();

    // Update last activity on user interaction
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        this.endSession();
      });

      // Update last activity periodically to extend session
      window.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          this.touchSession();
        }
      });
    }
  }

  /**
   * Initialize session - resume if recent, or create new
   */
  private initializeSession(): void {
    const stored = this.loadStoredSession();

    if (stored && this.isSessionFresh(stored.lastActivity)) {
      // Resume existing session
      this.sessionInfo = {
        sessionId: stored.sessionId,
        startedAt: new Date(stored.startedAt),
        userId: stored.userId,
        device: stored.device,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        screenWidth: typeof window !== "undefined" ? window.innerWidth : 0,
        screenHeight: typeof window !== "undefined" ? window.innerHeight : 0,
      };
      this.touchSession();
    } else {
      // Start fresh session
      this.startSession();
    }
  }

  /**
   * Check if session is still within timeout window
   */
  private isSessionFresh(lastActivity: number): boolean {
    return Date.now() - lastActivity < SESSION_TIMEOUT_MS;
  }

  /**
   * Load stored session from localStorage
   */
  private loadStoredSession(): StoredSession | null {
    if (typeof localStorage === "undefined") return null;

    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  /**
   * Persist current session to localStorage
   */
  private persistSession(): void {
    if (typeof localStorage === "undefined" || !this.sessionInfo) return;

    const stored: StoredSession = {
      sessionId: this.sessionInfo.sessionId,
      startedAt: this.sessionInfo.startedAt.toISOString(),
      lastActivity: Date.now(),
      userId: this.sessionInfo.userId,
      device: this.sessionInfo.device,
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Storage full or unavailable - continue without persistence
    }
  }

  /**
   * Update last activity timestamp
   */
  private touchSession(): void {
    this.persistSession();
  }

  /**
   * Generate a UUID v4
   */
  private generateSessionId(): string {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback for older browsers
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }

  /**
   * Detect device type from user agent and screen size
   */
  private detectDevice(): "desktop" | "mobile" | "tablet" {
    if (typeof window === "undefined") return "desktop";

    const userAgent = navigator.userAgent.toLowerCase();
    const screenWidth = window.innerWidth;

    // Check for mobile keywords
    const isMobileUA =
      /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(
        userAgent
      );
    const isTabletUA = /ipad|tablet|playbook|silk/i.test(userAgent);

    if (isTabletUA || (isMobileUA && screenWidth >= 768)) {
      return "tablet";
    }

    if (isMobileUA || screenWidth < 768) {
      return "mobile";
    }

    return "desktop";
  }

  getSessionId(): string {
    if (!this.sessionInfo) {
      this.startSession();
    }
    return this.sessionInfo!.sessionId;
  }

  getSessionInfo(): SessionInfo {
    if (!this.sessionInfo) {
      this.startSession();
    }
    return { ...this.sessionInfo! };
  }

  startSession(): void {
    const sessionId = this.generateSessionId();

    this.sessionInfo = {
      sessionId,
      startedAt: new Date(),
      userId: auth.currentUser?.uid ?? null,
      device: this.detectDevice(),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      screenWidth: typeof window !== "undefined" ? window.innerWidth : 0,
      screenHeight: typeof window !== "undefined" ? window.innerHeight : 0,
    };

    // Persist new session
    this.persistSession();
  }

  async endSession(): Promise<void> {
    if (!this.sessionInfo) return;

    // Call the callback if set (ActivityLogger sets this)
    if (this.sessionEndCallback) {
      await this.sessionEndCallback();
    }

    this.sessionInfo = null;
  }

  setUserId(userId: string): void {
    if (this.sessionInfo) {
      this.sessionInfo.userId = userId;
    }
  }

  isSessionActive(): boolean {
    return this.sessionInfo !== null;
  }

  getSessionDuration(): number {
    if (!this.sessionInfo) return 0;
    return Date.now() - this.sessionInfo.startedAt.getTime();
  }

  /**
   * Set callback for session end (used by ActivityLogger)
   * This avoids circular dependency
   */
  onSessionEnd(callback: () => Promise<void>): void {
    this.sessionEndCallback = callback;
  }
}
