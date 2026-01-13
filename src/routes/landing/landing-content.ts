import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

// Props to randomize between for the landing page demo
export const RANDOM_PROPS = [
  PropType.STAFF,
  PropType.BUUGENG,
  PropType.FAN,
  PropType.TRIAD,
  PropType.CLUB,
  PropType.MINIHOOP,
];

export interface FeatureCard {
  icon: string;
  title: string;
  description: string;
  color: string;
}

export const FEATURES: FeatureCard[] = [
  {
    icon: "✏️",
    title: "Create",
    description:
      "Build sequences three ways: Assemble for beginners, Construct for full control, or Generate with algorithmic LOOPs.",
    color: "#6366f1",
  },
  {
    icon: "🎬",
    title: "Animate",
    description:
      "Watch sequences come alive with real-time 2D visualization, motion trails, and video export.",
    color: "#ec4899",
  },
  {
    icon: "🔍",
    title: "Discover",
    description:
      "Browse thousands of community sequences, follow creators, and share your work.",
    color: "#14b8a6",
  },
  {
    icon: "📚",
    title: "Learn",
    description:
      "28 structured concepts from grid basics to advanced LOOPs, with interactive quizzes.",
    color: "#f59e0b",
  },
  {
    icon: "🎯",
    title: "Train",
    description:
      "Practice with ML-powered scoring, daily challenges, and three training modes.",
    color: "#ef4444",
  },
  {
    icon: "📤",
    title: "Share",
    description:
      "Export to PNG, PDF, GIF, or video. Share links directly to Instagram.",
    color: "#8b5cf6",
  },
];

export const PROPS_LIST = [
  "Staff",
  "Fan",
  "Hoop",
  "Buugeng",
  "Triad",
  "Club",
  "Sword",
  "Double Star",
  "Eight Rings",
  "Guitar",
  "Quiad",
];

export interface LoopType {
  name: string;
  desc: string;
}

export const LOOP_TYPES: LoopType[] = [
  { name: "Rotated", desc: "90° or 180° around grid" },
  { name: "Mirrored", desc: "Vertical reflection" },
  { name: "Swapped", desc: "Exchange hand roles" },
  { name: "Inverted", desc: "Opposite motion types" },
  { name: "Combinations", desc: "Stack transformations" },
];

export interface PositionType {
  greek: string;
  name: string;
  desc: string;
}

export const POSITION_TYPES: PositionType[] = [
  { greek: "α", name: "Alpha", desc: "Hands across from each other" },
  { greek: "β", name: "Beta", desc: "Hands at same point" },
  { greek: "γ", name: "Gamma", desc: "Hands form right angle" },
];

export interface LetterType {
  range: string;
  label: string;
}

export const LETTER_TYPES: LetterType[] = [
  { range: "A–V", label: "Type 1: Both hands shift together" },
  { range: "W–Ω", label: "Type 2: One shifts, one stays" },
  { range: "Φ Ψ Λ", label: "Type 3–6: Advanced combinations" },
];

export interface EducatorCard {
  icon: string;
  title: string;
  description: string;
}

export const EDUCATOR_CARDS: EducatorCard[] = [
  {
    icon: "📋",
    title: "Curriculum Structure",
    description:
      "Progress from Grid basics to advanced LOOPs with 28 concepts.",
  },
  {
    icon: "👁️",
    title: "Visual Learning",
    description: 'See exactly what "antispin flower" means — no guessing.',
  },
  {
    icon: "📝",
    title: "Assignments",
    description: "Assign sequences, track completion, give feedback.",
  },
  {
    icon: "🌍",
    title: "Remote Teaching",
    description: "Share notated sequences with students anywhere in the world.",
  },
];
