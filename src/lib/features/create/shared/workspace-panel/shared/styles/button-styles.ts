/**
 * button-styles.ts
 *
 * Shared button style constants for unified design system across the application.
 * Defines consistent colors, transitions, and styling patterns for all interactive buttons.
 */

export const BUTTON_STYLES = {
  // Transition timing - use CSS variables for consistency
  transitions: {
    normal: "all var(--transition-normal, 0.3s cubic-bezier(0.4, 0, 0.2, 1))",
    fast: "all var(--transition-fast, 0.15s cubic-bezier(0.4, 0, 0.2, 1))",
    active: "all 0.1s ease",
  },

  // Focus outline - consistent across all buttons
  focus: {
    outline: "2px solid var(--primary-light, #818cf8)",
    outlineOffset: "2px",
  },

  // Base button specifications
  base: {
    size: "48px",
    borderRadius: "50%",
    iconSize: "18px",
  },

  // Color schemes by button function
  colors: {
    // Neutral/Navigation - for system-level actions
    neutral: {
      background: "rgba(100, 116, 139, 0.8)",
      border: "1px solid rgba(148, 163, 184, 0.3)",
      hover: {
        background: "rgba(100, 116, 139, 0.9)",
        border: "rgba(148, 163, 184, 0.4)",
      },
    },

    // Primary action - main interactive element
    primary: {
      background: "rgba(59, 130, 246, 0.2)",
      backdropFilter: "blur(10px)",
      hover: {
        background: "rgba(59, 130, 246, 0.3)",
      },
    },

    // Edit/Create - modification actions
    edit: {
      background:
        "linear-gradient(135deg, #8b5cf6 0%, var(--theme-accent, #6366f1) 100%)",
      border: "1px solid rgba(139, 92, 246, 0.3)",
      boxShadow: "0 4px 12px rgba(139, 92, 246, 0.4)",
      hover: {
        background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
        boxShadow: "0 6px 16px rgba(139, 92, 246, 0.6)",
      },
    },

    // Share/Social - sharing actions
    share: {
      background:
        "linear-gradient(135deg, rgba(139, 92, 246, 0.9), rgba(236, 72, 153, 0.9))",
      border: "1px solid rgba(255, 255, 255, 0.25)",
      boxShadow:
        "0 2px 8px rgba(79, 70, 229, 0.35), 0 6px 18px rgba(236, 72, 153, 0.25)",
      hover: {
        boxShadow:
          "0 4px 12px rgba(79, 70, 229, 0.45), 0 8px 22px rgba(236, 72, 153, 0.35)",
      },
    },

    // Tools/Actions - sequence manipulation actions (cyan-teal accent)
    tools: {
      background: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
      border: "1px solid rgba(6, 182, 212, 0.3)",
      boxShadow: "0 4px 12px rgba(6, 182, 212, 0.4)",
      hover: {
        background: "linear-gradient(135deg, #0891b2 0%, #0e7490 100%)",
        boxShadow: "0 6px 16px rgba(6, 182, 212, 0.6)",
      },
    },

    // Warning - potentially destructive but reversible
    warning: {
      background: "linear-gradient(135deg, #ff9800 0%, #ff6b00 100%)",
      border: "1px solid rgba(255, 152, 0, 0.3)",
      boxShadow: "0 4px 12px rgba(255, 152, 0, 0.4)",
      hover: {
        background: "linear-gradient(135deg, #ff6b00 0%, #ff5500 100%)",
        boxShadow: "0 6px 16px rgba(255, 152, 0, 0.6)",
      },
    },

    // Destructive - permanent or highly impactful actions
    destructive: {
      background: "rgba(239, 68, 68, 0.8)",
      border: "1px solid rgba(248, 113, 113, 0.3)",
      boxShadow: "0 4px 12px rgba(239, 68, 68, 0.4)",
      hover: {
        background: "rgba(239, 68, 68, 0.9)",
        boxShadow: "0 6px 16px rgba(239, 68, 68, 0.6)",
      },
    },
  },

  // Transform animations
  transforms: {
    hover: "scale(1.05)",
    active: "scale(0.95)",
    // For rectangular buttons (nav bar)
    hoverNav: "translateY(-1px)",
  },

  // Shadow system
  shadows: {
    base: "0 2px 8px rgba(0, 0, 0, 0.2)",
    hover: "0 4px 12px rgba(0, 0, 0, 0.3)",
  },
} as const;
