/**
 * Sidebar Tour Content
 *
 * Defines the steps for the desktop sidebar tour.
 * Each step highlights a module and provides a brief description.
 */

export interface TourStep {
  /** Module ID to highlight (matches ModuleDefinition.id) */
  moduleId: string;
  /** Display heading (can differ from module label) */
  heading: string;
  /** Brief description (~25 words max) */
  description: string;
  /** FontAwesome icon class (without 'fa-' prefix) */
  icon: string;
  /** Module accent color (hex) */
  color: string;
}

/**
 * Tour steps in display order.
 * Only includes core user-facing modules.
 *
 * Updated Jan 2026: Removed dashboard (deleted) and library (merged into Browse).
 */
export const SIDEBAR_TOUR_STEPS: TourStep[] = [
  {
    moduleId: "create",
    heading: "Create",
    description:
      "Build sequences beat by beat, generate random ones, or draw hand paths. Your creative workshop.",
    icon: "tools",
    color: "#f59e0b",
  },
  {
    moduleId: "browse",
    heading: "Browse",
    description:
      "Browse sequences from the community or your own library. Find creators and get inspired.",
    icon: "compass",
    color: "#a855f7",
  },
  {
    moduleId: "learn",
    heading: "Learn",
    description:
      "Interactive lessons from basics to advanced. Master TKA at your own pace with quizzes and progress tracking.",
    icon: "graduation-cap",
    color: "#3b82f6",
  },
  {
    moduleId: "compose",
    heading: "Compose",
    description:
      "Arrange sequences on a timeline, sync to music, and export as video. Create complete choreography.",
    icon: "photo-film",
    color: "#ec4899",
  },
  {
    moduleId: "train",
    heading: "Train",
    description:
      "Practice with real-time camera detection and scoring. Track your progress as you master each sequence.",
    icon: "running",
    color: "#ef4444",
  },
  {
    moduleId: "feedback",
    heading: "Feedback",
    description:
      "Report bugs, suggest features, or share ideas. Your input shapes how TKA Scribe evolves.",
    icon: "comment-dots",
    color: "#14b8a6",
  },
];

/** Total number of tour steps */
export const TOUR_STEP_COUNT = SIDEBAR_TOUR_STEPS.length;
