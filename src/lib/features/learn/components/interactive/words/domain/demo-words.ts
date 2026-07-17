import type { LetterDefinition } from "./types";

// Single letter A demo (Split-Same, Pro)
export const singleA: LetterDefinition[] = [
  {
    letter: "A",
    startLeft: "N",
    startRight: "S",
    endLeft: "E",
    endRight: "W",
    leftMotion: "pro",
    rightMotion: "pro",
    description: "Split-Same, Prospin",
  },
];

// Single letter B demo (Split-Same, Anti)
export const singleB: LetterDefinition[] = [
  {
    letter: "B",
    startLeft: "N",
    startRight: "S",
    endLeft: "W",
    endRight: "E",
    leftMotion: "anti",
    rightMotion: "anti",
    description: "Split-Same, Antispin",
  },
];

// AABB word (4 steps)
export const wordAABB: LetterDefinition[] = [
  {
    letter: "A",
    startLeft: "N",
    startRight: "S",
    endLeft: "E",
    endRight: "W",
    leftMotion: "pro",
    rightMotion: "pro",
    description: "Step 1",
  },
  {
    letter: "A",
    startLeft: "E",
    startRight: "W",
    endLeft: "S",
    endRight: "N",
    leftMotion: "pro",
    rightMotion: "pro",
    description: "Step 2",
  },
  {
    letter: "B",
    startLeft: "S",
    startRight: "N",
    endLeft: "E",
    endRight: "W",
    leftMotion: "anti",
    rightMotion: "anti",
    description: "Step 3",
  },
  {
    letter: "B",
    startLeft: "E",
    startRight: "W",
    endLeft: "N",
    endRight: "S",
    leftMotion: "anti",
    rightMotion: "anti",
    description: "Step 4",
  },
];

// GGGG word (Tog-Same, 4 steps)
export const wordGGGG: LetterDefinition[] = [
  {
    letter: "G",
    startLeft: "S",
    startRight: "S",
    endLeft: "W",
    endRight: "W",
    leftMotion: "pro",
    rightMotion: "pro",
    description: "Beta to Beta",
  },
  {
    letter: "G",
    startLeft: "W",
    startRight: "W",
    endLeft: "N",
    endRight: "N",
    leftMotion: "pro",
    rightMotion: "pro",
    description: "Beta to Beta",
  },
  {
    letter: "G",
    startLeft: "N",
    startRight: "N",
    endLeft: "E",
    endRight: "E",
    leftMotion: "pro",
    rightMotion: "pro",
    description: "Beta to Beta",
  },
  {
    letter: "G",
    startLeft: "E",
    startRight: "E",
    endLeft: "S",
    endRight: "S",
    leftMotion: "pro",
    rightMotion: "pro",
    description: "Returns home!",
  },
];

// CCCC word (Hybrid)
export const wordCCCC: LetterDefinition[] = [
  {
    letter: "C",
    startLeft: "N",
    startRight: "S",
    endLeft: "E",
    endRight: "W",
    leftMotion: "pro",
    rightMotion: "anti",
    description: "Hybrid motion",
  },
  {
    letter: "C",
    startLeft: "E",
    startRight: "W",
    endLeft: "S",
    endRight: "N",
    leftMotion: "pro",
    rightMotion: "anti",
    description: "Hybrid motion",
  },
  {
    letter: "C",
    startLeft: "S",
    startRight: "N",
    endLeft: "W",
    endRight: "E",
    leftMotion: "pro",
    rightMotion: "anti",
    description: "Hybrid motion",
  },
  {
    letter: "C",
    startLeft: "W",
    startRight: "E",
    endLeft: "N",
    endRight: "S",
    leftMotion: "pro",
    rightMotion: "anti",
    description: "Returns home!",
  },
];
