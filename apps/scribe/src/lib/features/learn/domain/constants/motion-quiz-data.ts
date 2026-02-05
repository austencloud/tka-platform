/**
 * Motion Identification Quiz data constants
 */

export type HandPosition = "N" | "E" | "S" | "W";
export type MotionType = "shift" | "dash" | "static";
export type MotionTypeNumber = 1 | 2 | 3 | 4 | 5 | 6;

export interface MotionQuizQuestion {
  leftStart: HandPosition;
  leftEnd: HandPosition;
  rightStart: HandPosition;
  rightEnd: HandPosition;
  leftMotion: MotionType;
  rightMotion: MotionType;
  correctAnswer: MotionTypeNumber;
}

export interface MotionTypeInfo {
  num: MotionTypeNumber;
  name: string;
  color: string;
}

export const MOTION_QUIZ_QUESTIONS: MotionQuizQuestion[] = [
  // Type 1: Dual-Shift
  {
    leftStart: "N",
    leftEnd: "E",
    rightStart: "S",
    rightEnd: "W",
    leftMotion: "shift",
    rightMotion: "shift",
    correctAnswer: 1,
  },
  {
    leftStart: "E",
    leftEnd: "S",
    rightStart: "W",
    rightEnd: "N",
    leftMotion: "shift",
    rightMotion: "shift",
    correctAnswer: 1,
  },
  // Type 2: Shift
  {
    leftStart: "N",
    leftEnd: "E",
    rightStart: "S",
    rightEnd: "S",
    leftMotion: "shift",
    rightMotion: "static",
    correctAnswer: 2,
  },
  {
    leftStart: "W",
    leftEnd: "W",
    rightStart: "E",
    rightEnd: "S",
    leftMotion: "static",
    rightMotion: "shift",
    correctAnswer: 2,
  },
  // Type 3: Cross-Shift
  {
    leftStart: "N",
    leftEnd: "E",
    rightStart: "S",
    rightEnd: "N",
    leftMotion: "shift",
    rightMotion: "dash",
    correctAnswer: 3,
  },
  {
    leftStart: "E",
    leftEnd: "W",
    rightStart: "S",
    rightEnd: "E",
    leftMotion: "dash",
    rightMotion: "shift",
    correctAnswer: 3,
  },
  // Type 4: Dash
  {
    leftStart: "N",
    leftEnd: "S",
    rightStart: "E",
    rightEnd: "E",
    leftMotion: "dash",
    rightMotion: "static",
    correctAnswer: 4,
  },
  {
    leftStart: "W",
    leftEnd: "W",
    rightStart: "S",
    rightEnd: "N",
    leftMotion: "static",
    rightMotion: "dash",
    correctAnswer: 4,
  },
  // Type 5: Dual-Dash
  {
    leftStart: "N",
    leftEnd: "S",
    rightStart: "S",
    rightEnd: "N",
    leftMotion: "dash",
    rightMotion: "dash",
    correctAnswer: 5,
  },
  {
    leftStart: "E",
    leftEnd: "W",
    rightStart: "W",
    rightEnd: "E",
    leftMotion: "dash",
    rightMotion: "dash",
    correctAnswer: 5,
  },
  // Type 6: Static
  {
    leftStart: "N",
    leftEnd: "N",
    rightStart: "S",
    rightEnd: "S",
    leftMotion: "static",
    rightMotion: "static",
    correctAnswer: 6,
  },
  {
    leftStart: "E",
    leftEnd: "E",
    rightStart: "W",
    rightEnd: "W",
    leftMotion: "static",
    rightMotion: "static",
    correctAnswer: 6,
  },
];

export const MOTION_TYPE_INFO: MotionTypeInfo[] = [
  { num: 1, name: "Dual-Shift", color: "#22D3EE" },
  { num: 2, name: "Shift", color: "#4ADE80" },
  { num: 3, name: "Cross-Shift", color: "#F472B6" },
  { num: 4, name: "Dash", color: "#FB923C" },
  { num: 5, name: "Dual-Dash", color: "#A78BFA" },
  { num: 6, name: "Static", color: "#94A3B8" },
];
