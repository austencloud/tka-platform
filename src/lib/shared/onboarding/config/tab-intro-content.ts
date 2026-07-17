/**
 * Tab Intro Content - Definitions for all tab introductions
 *
 * Each tab's intro content is defined here. Most tabs need just one page,
 * but some benefit from a second page to show additional features.
 *
 * Page content can be:
 * - A simple string for basic descriptions
 * - An object with heading + bullet points for structured content
 */

export interface TabIntroPage {
  /** Optional heading for this page (uses main title if omitted) */
  heading?: string;
  /** Main content - string or structured with bullets */
  content: string | { text?: string; points: string[] };
  /** Optional tip shown at bottom of page */
  tip?: string;
}

export interface TabIntroContent {
  icon: string;
  color: string;
  title: string;
  /** Single page or array of pages (max 2-3 recommended) */
  pages: TabIntroPage[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Module Tabs
// ─────────────────────────────────────────────────────────────────────────────

export const CREATE_TAB_INTROS: Record<string, TabIntroContent> = {
  construct: {
    icon: "fa-cubes",
    color: "#3b82f6",
    title: "Constructor",
    pages: [
      {
        content: {
          text: "Build sequences one step at a time:",
          points: [
            "Start by picking a position from the grid",
            "Browse available options for the next step",
            "Tap an option to add it to your sequence",
          ],
        },
        tip: "Tap a step in your sequence to edit or remove it",
      },
    ],
  },

  generate: {
    icon: "fa-wand-magic-sparkles",
    color: "#8b5cf6",
    title: "Generator",
    pages: [
      {
        content: {
          text: "Generate random sequences based on your settings:",
          points: [
            "Set filters for length, prop type, and difficulty",
            "Tap Generate to create a new sequence",
            "Keep generating until you find one you like",
          ],
        },
        tip: "Edit generated sequences in Constructor if you want to tweak them",
      },
    ],
  },

  assemble: {
    icon: "fa-route",
    color: "#06b6d4",
    title: "Assembler",
    pages: [
      {
        content: {
          text: "Create sequences by drawing hand paths:",
          points: [
            "Trace the path you want each hand to follow",
            "The system converts your drawing into steps",
            "Adjust timing and transitions as needed",
          ],
        },
      },
    ],
  },

  fuse: {
    icon: "fa-fire",
    color: "#f97316",
    title: "Fuse",
    pages: [
      {
        content: {
          text: "Combine two prop paths into one sequence:",
          points: [
            "Each side shows a random blue or red prop path",
            "Tap the shuffle button to cycle through options",
            "Hit Fuse to merge them into a full sequence",
          ],
        },
        tip: "Use the beat length selector at the bottom to match your target length",
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Learn Module Tabs
// ─────────────────────────────────────────────────────────────────────────────

export const LEARN_TAB_INTROS: Record<string, TabIntroContent> = {
  concepts: {
    icon: "fa-lightbulb",
    color: "#f59e0b",
    title: "Learning Path",
    pages: [
      {
        content: {
          text: "Interactive lessons from basics to advanced:",
          points: [
            "Work through concepts at your own pace",
            "Complete quizzes to test your understanding",
            "Track your progress as you go",
          ],
        },
      },
    ],
  },

  codex: {
    icon: "fa-book",
    color: "#10b981",
    title: "Codex",
    pages: [
      {
        content:
          "Reference for all letters and pictographs. Tap any symbol to see how it works.",
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Browse Module Tabs
// ─────────────────────────────────────────────────────────────────────────────

export const BROWSE_TAB_INTROS: Record<string, TabIntroContent> = {
  sequences: {
    icon: "fa-compass",
    color: "#a855f7",
    title: "Browse",
    pages: [
      {
        content: {
          text: "Browse community sequences:",
          points: [
            "Scroll through the gallery or use filters",
            "Tap a sequence to preview it",
            "Save favorites to your library",
          ],
        },
      },
    ],
  },

  creators: {
    icon: "fa-users",
    color: "#ec4899",
    title: "Creators",
    pages: [
      {
        content:
          "See who's creating sequences. Follow people and check out their work.",
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Library Module Tabs
// ─────────────────────────────────────────────────────────────────────────────

export const LIBRARY_TAB_INTROS: Record<string, TabIntroContent> = {
  sequences: {
    icon: "fa-folder",
    color: "#6366f1",
    title: "Your Sequences",
    pages: [
      {
        content:
          "Sequences you've created or saved. Organize them into collections if you want.",
      },
    ],
  },

  favorites: {
    icon: "fa-heart",
    color: "#ef4444",
    title: "Favorites",
    pages: [
      {
        content: "Sequences you've favorited for quick access.",
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Compose Module Tabs
// ─────────────────────────────────────────────────────────────────────────────

export const COMPOSE_TAB_INTROS: Record<string, TabIntroContent> = {
  playback: {
    icon: "fa-play",
    color: "#22c55e",
    title: "Playback",
    pages: [
      {
        content: {
          text: "Watch your sequences animate:",
          points: [
            "Use play/pause and speed controls",
            "Step through beat by beat",
            "Loop sections for practice",
          ],
        },
      },
    ],
  },

  timeline: {
    icon: "fa-film",
    color: "#f97316",
    title: "Timeline",
    pages: [
      {
        content: {
          text: "Arrange and export your choreography:",
          points: [
            "Drag sequences onto the timeline",
            "Sync to music if you want",
            "Export as video when you're done",
          ],
        },
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper to get intro content
// ─────────────────────────────────────────────────────────────────────────────

const ALL_INTROS: Record<string, Record<string, TabIntroContent>> = {
  create: CREATE_TAB_INTROS,
  learn: LEARN_TAB_INTROS,
  browse: BROWSE_TAB_INTROS,
  library: LIBRARY_TAB_INTROS,
  compose: COMPOSE_TAB_INTROS,
};

/**
 * Get intro content for a specific tab
 */
export function getTabIntroContent(
  moduleId: string,
  tabId: string
): TabIntroContent | undefined {
  return ALL_INTROS[moduleId]?.[tabId];
}

/**
 * Check if a tab has intro content defined
 */
export function hasTabIntroContent(moduleId: string, tabId: string): boolean {
  return !!getTabIntroContent(moduleId, tabId);
}
