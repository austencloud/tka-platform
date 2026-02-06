// Props to cycle through in the animation demo
export const DEMO_PROP_TYPES = [
  "staff",
  "buugeng",
  "fan",
  "triad",
  "club",
  "minihoop",
];

export const DEMO_PROP_LABELS: Record<string, string> = {
  staff: "Staff",
  buugeng: "Buugeng",
  fan: "Fan",
  triad: "Triad",
  club: "Club",
  minihoop: "Mini Hoop",
};

export interface FeatureCard {
  icon: string;
  title: string;
  description: string;
  color: string;
}

export const FEATURES: FeatureCard[] = [
  {
    icon: "\u270F\uFE0F",
    title: "Create",
    description:
      "Build sequences by hand or let the app generate them.",
    color: "#6366f1",
  },
  {
    icon: "\uD83C\uDFAC",
    title: "Animate",
    description:
      "See your sequences in motion with 2D visualization, trails, and video export.",
    color: "#ec4899",
  },
  {
    icon: "\uD83D\uDD0D",
    title: "Browse",
    description:
      "Browse community sequences, follow creators, and share your work.",
    color: "#14b8a6",
  },
  {
    icon: "\uD83D\uDCDA",
    title: "Learn",
    description:
      "Progressive lessons from basics to advanced, with interactive quizzes.",
    color: "#f59e0b",
  },
  {
    icon: "\uD83C\uDFAF",
    title: "Train",
    description:
      "Practice with real-time feedback, daily challenges, and multiple training modes.",
    color: "#ef4444",
  },
  {
    icon: "\uD83D\uDCE4",
    title: "Share",
    description:
      "Export to PNG, PDF, GIF, or video. Share links directly to Instagram.",
    color: "#8b5cf6",
  },
];
