/**
 * landing-videos.ts
 *
 * Static video entries for the hero carousel. These are shown when Firestore
 * videos aren't available, or used as overrides/supplements for the live feed.
 *
 * To add a video, append to LANDING_VIDEOS. The component picks up changes here
 * without any other edits needed.
 */

export interface LandingVideo {
  /** Direct video URL (Firebase Storage or CDN) */
  src: string;
  /** Performer credit, e.g. "Kai M." */
  performer: string;
  /** Prop type displayed in the credit line, e.g. "double staves" */
  prop: string;
}

/**
 * Fallback/featured video list used when Firestore returns nothing.
 * In practice, the HeroCarouselSection queries Firestore first and only
 * falls back to these if the query fails or returns an empty result.
 */
export const LANDING_VIDEOS: LandingVideo[] = [
  // Add cherry-picked performance videos here.
  // Example entry (replace with real URLs):
  // {
  //   src: "https://firebasestorage.googleapis.com/...",
  //   performer: "Austen C.",
  //   prop: "double staves",
  // },
];
