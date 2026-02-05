/**
 * Attribution System - Domain Types
 *
 * Comprehensive attribution tracking for understanding user acquisition.
 * Captures both automatic (UTM, referrer, click IDs) and self-reported sources.
 *
 * Designed for decade-scale data collection and analysis.
 */

/**
 * Categories for referrer sources based on domain analysis
 */
export type ReferrerCategory =
  | "search" // Google, Bing, DuckDuckGo
  | "social" // Facebook, Instagram, TikTok, Reddit
  | "video" // YouTube, Vimeo, Twitch
  | "email" // Gmail, Outlook webmail
  | "referral" // Other websites linking to us
  | "direct"; // No referrer (typed URL, bookmark, dark social)

/**
 * Self-reported attribution sources
 * These capture the "why" that automatic tracking can't see
 */
export type SelfReportedSource =
  | "search_engine"
  | "social_media"
  | "youtube_video"
  | "friend_or_colleague"
  | "flow_event_or_festival"
  | "online_community" // Reddit, Discord, forums
  | "other";

/**
 * Device categories for attribution context
 */
export type DeviceCategory = "mobile" | "tablet" | "desktop";

/**
 * Authentication methods for signup context
 */
export type SignupMethod = "google" | "apple" | "email";

/**
 * UTM parameters from marketing links
 */
export interface UtmParameters {
  /** Traffic source: google, facebook, newsletter, etc. */
  source?: string;
  /** Marketing medium: cpc, social, email, organic */
  medium?: string;
  /** Campaign name: beta_launch, flow_fest_2026 */
  campaign?: string;
  /** Content variant for A/B testing */
  content?: string;
  /** Paid search keywords */
  term?: string;
}

/**
 * Platform-specific click IDs added by ad platforms
 * More reliable than UTM since they're auto-generated
 */
export interface ClickIds {
  /** Facebook Click ID */
  fbclid?: string;
  /** Google Ads Click ID */
  gclid?: string;
  /** TikTok Click ID */
  ttclid?: string;
  /** Twitter/X Click ID */
  twclid?: string;
  /** Microsoft/Bing Click ID */
  msclkid?: string;
  /** LinkedIn Click ID */
  li_fat_id?: string;
}

/**
 * Analyzed referrer information
 */
export interface ReferrerInfo {
  /** Raw referrer URL */
  raw: string;
  /** Extracted domain (e.g., google.com, facebook.com) */
  domain?: string;
  /** Categorized source type */
  category: ReferrerCategory;
}

/**
 * Device and browser information
 * Kept minimal for privacy - no fingerprinting
 */
export interface DeviceInfo {
  /** Device category */
  type: DeviceCategory;
  /** Browser language */
  language: string;
  /** Platform (Windows, macOS, iOS, Android, etc.) */
  platform: string;
  /** Viewport size category */
  screenCategory: "small" | "medium" | "large";
}

/**
 * A single attribution touch point
 * Captured on first visit and any subsequent visit with new attribution data
 */
export interface TouchData {
  /** When this touch occurred */
  timestamp: string;
  /** UTM parameters if present */
  utm: UtmParameters;
  /** Platform click IDs if present */
  clickIds: ClickIds;
  /** Referrer analysis */
  referrer: ReferrerInfo;
  /** Which page they landed on */
  landingPage: string;
  /** Browser locale */
  locale: string;
  /** Device information */
  device: DeviceInfo;
}

/**
 * Self-reported attribution data
 * Collected during onboarding, captures "dark social" and word-of-mouth
 */
export interface SelfReportedAttribution {
  /** When they answered the question */
  timestamp: string;
  /** Selected source category */
  source: SelfReportedSource;
  /** Optional: event name for flow_event_or_festival */
  eventName?: string;
  /** Optional: person's name for friend_or_colleague */
  personName?: string;
  /** Optional: free text for "other" or additional context */
  details?: string;
}

/**
 * Context about the signup itself
 */
export interface SignupContext {
  /** When they signed up */
  timestamp: string;
  /** How they authenticated */
  method: SignupMethod;
  /** Device used for signup */
  device: DeviceCategory;
}

/**
 * Complete user attribution record
 * Attached to user document on signup
 */
export interface UserAttribution {
  /** First touch - initial discovery */
  firstTouch: TouchData;
  /** Last touch - final visit before signup */
  lastTouch: TouchData;
  /** All touches for multi-touch analysis (capped at 20) */
  touches: TouchData[];
  /** Total visits before signing up */
  sessionCount: number;
  /** Days between first visit and signup */
  daysSinceFirstVisit: number;
  /** Self-reported source (if provided) */
  selfReported?: SelfReportedAttribution;
  /** Signup context */
  signup: SignupContext;
}

/**
 * Anonymous attribution session
 * Stored in localStorage and optionally Firestore before signup
 */
export interface AnonymousAttributionSession {
  /** Unique session identifier */
  sessionId: string;
  /** First touch data */
  firstTouch: TouchData;
  /** Most recent touch */
  lastTouch: TouchData;
  /** All touches (capped at 20) */
  touches: TouchData[];
  /** Visit count */
  sessionCount: number;
  /** Session creation time */
  createdAt: string;
  /** Last activity time */
  updatedAt: string;
}

/**
 * Data structure for the attribution question UI
 */
export interface AttributionQuestionOption {
  id: SelfReportedSource;
  icon: string;
  labelKey: string; // i18n key
  /** Whether to show follow-up input */
  hasFollowUp: boolean;
  /** Placeholder for follow-up input */
  followUpPlaceholderKey?: string;
}

/**
 * Attribution analytics summary (for admin dashboard)
 */
export interface AttributionSummary {
  /** Breakdown by automatic source */
  byAutoSource: Record<string, number>;
  /** Breakdown by automatic medium */
  byAutoMedium: Record<string, number>;
  /** Breakdown by self-reported source */
  bySelfReported: Record<SelfReportedSource, number>;
  /** Breakdown by signup method */
  bySignupMethod: Record<SignupMethod, number>;
  /** Average days to convert */
  avgDaysToConvert: number;
  /** Average sessions before signup */
  avgSessionsToConvert: number;
}
