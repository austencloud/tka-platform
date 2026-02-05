/**
 * Type1 Page Configuration
 * Data-driven configuration for the Type1 letter lesson pages
 */

import type { Type1LetterData } from "../Type1LetterData";
import {
  PROSPIN_LETTERS,
  ANTISPIN_LETTERS,
  HYBRID_LETTERS,
} from "./type1-letter-data";

export type MotionTheme = "pro" | "anti" | "hybrid";

export interface MotionExplanation {
  title: string;
  points: string[];
}

export interface Type1PageConfig {
  id: string;
  title: string;
  theme: MotionTheme;
  icon: string;
  motionSummary: string;
  badge: string;
  explanation: MotionExplanation;
  letters: Type1LetterData[];
  nextButtonText: string;
  nextButtonIcon: string;
  ariaLabelPrefix: string;
}

export const PROSPIN_PAGE_CONFIG: Type1PageConfig = {
  id: "prospin",
  title: "Prospin Letters",
  theme: "pro",
  icon: "fa-rotate-right",
  motionSummary: "Both hands perform <strong>prospin</strong> motion",
  badge: "Pro-Pro Pattern",
  explanation: {
    title: "What is Prospin?",
    points: [
      "The prop spins <strong>in the same direction</strong> as the hand's movement",
      "Think: spinning <strong>with</strong> the flow of motion",
      "Creates smooth, continuous visual patterns",
    ],
  },
  letters: PROSPIN_LETTERS,
  nextButtonText: "Learn Antispin Letters",
  nextButtonIcon: "fa-arrow-right",
  ariaLabelPrefix: "prospin",
};

export const ANTISPIN_PAGE_CONFIG: Type1PageConfig = {
  id: "antispin",
  title: "Antispin Letters",
  theme: "anti",
  icon: "fa-rotate-left",
  motionSummary: "Both hands perform <strong>antispin</strong> motion",
  badge: "Anti-Anti Pattern",
  explanation: {
    title: "What is Antispin?",
    points: [
      "The prop spins <strong>opposite</strong> to the hand's movement",
      "Think: spinning <strong>against</strong> the flow of motion",
      'Creates the distinctive "flower" patterns',
    ],
  },
  letters: ANTISPIN_LETTERS,
  nextButtonText: "Learn Hybrid Letters",
  nextButtonIcon: "fa-arrow-right",
  ariaLabelPrefix: "antispin",
};

export const HYBRID_PAGE_CONFIG: Type1PageConfig = {
  id: "hybrid",
  title: "Hybrid Letters",
  theme: "hybrid",
  icon: "fa-shuffle",
  motionSummary:
    "Hands perform <strong>different</strong> motions (one pro, one anti)",
  badge: "Hybrid Pattern",
  explanation: {
    title: "What Makes Hybrids Special?",
    points: [
      "One hand does <strong>prospin</strong>, the other does <strong>antispin</strong>",
      "Creates more complex, asymmetrical patterns",
      "Most hybrids: blue antispin + red prospin",
      "<strong>V</strong> is special: blue prospin + red antispin (reverse hybrid)",
    ],
  },
  letters: HYBRID_LETTERS,
  nextButtonText: "Take the Quiz",
  nextButtonIcon: "fa-graduation-cap",
  ariaLabelPrefix: "hybrid",
};
