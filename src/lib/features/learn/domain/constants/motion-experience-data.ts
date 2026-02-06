/**
 * Motion Experience Data - Constants for motion types learning flow
 */

export type HandPosition = "N" | "E" | "S" | "W";
export type MotionType = "shift" | "dash" | "static";

export interface MotionExample {
  leftStart: HandPosition;
  leftEnd: HandPosition;
  rightStart: HandPosition;
  rightEnd: HandPosition;
  leftMotion: MotionType;
  rightMotion: MotionType;
}

export interface MotionInfo {
  name: string;
  color: string;
  icon: string;
  description: string;
  key: string;
}

/**
 * Examples for each motion type (types 1-6)
 */
export const TYPE_EXAMPLES: Record<number, MotionExample[]> = {
  1: [
    // Dual-Shift
    {
      leftStart: "N",
      leftEnd: "E",
      rightStart: "S",
      rightEnd: "W",
      leftMotion: "shift",
      rightMotion: "shift",
    },
    {
      leftStart: "E",
      leftEnd: "S",
      rightStart: "W",
      rightEnd: "N",
      leftMotion: "shift",
      rightMotion: "shift",
    },
    {
      leftStart: "W",
      leftEnd: "N",
      rightStart: "E",
      rightEnd: "S",
      leftMotion: "shift",
      rightMotion: "shift",
    },
  ],
  2: [
    // Shift (one shifts, one static)
    {
      leftStart: "N",
      leftEnd: "E",
      rightStart: "S",
      rightEnd: "S",
      leftMotion: "shift",
      rightMotion: "static",
    },
    {
      leftStart: "W",
      leftEnd: "W",
      rightStart: "E",
      rightEnd: "S",
      leftMotion: "static",
      rightMotion: "shift",
    },
    {
      leftStart: "S",
      leftEnd: "W",
      rightStart: "N",
      rightEnd: "N",
      leftMotion: "shift",
      rightMotion: "static",
    },
  ],
  3: [
    // Cross-Shift (one shifts, one dashes)
    {
      leftStart: "N",
      leftEnd: "E",
      rightStart: "S",
      rightEnd: "N",
      leftMotion: "shift",
      rightMotion: "dash",
    },
    {
      leftStart: "E",
      leftEnd: "W",
      rightStart: "S",
      rightEnd: "W",
      leftMotion: "dash",
      rightMotion: "shift",
    },
    {
      leftStart: "W",
      leftEnd: "N",
      rightStart: "E",
      rightEnd: "W",
      leftMotion: "shift",
      rightMotion: "dash",
    },
  ],
  4: [
    // Dash (one dashes, one static)
    {
      leftStart: "N",
      leftEnd: "S",
      rightStart: "E",
      rightEnd: "E",
      leftMotion: "dash",
      rightMotion: "static",
    },
    {
      leftStart: "W",
      leftEnd: "W",
      rightStart: "S",
      rightEnd: "N",
      leftMotion: "static",
      rightMotion: "dash",
    },
    {
      leftStart: "E",
      leftEnd: "W",
      rightStart: "N",
      rightEnd: "N",
      leftMotion: "dash",
      rightMotion: "static",
    },
  ],
  5: [
    // Dual-Dash
    {
      leftStart: "N",
      leftEnd: "S",
      rightStart: "S",
      rightEnd: "N",
      leftMotion: "dash",
      rightMotion: "dash",
    },
    {
      leftStart: "E",
      leftEnd: "W",
      rightStart: "W",
      rightEnd: "E",
      leftMotion: "dash",
      rightMotion: "dash",
    },
    {
      leftStart: "N",
      leftEnd: "S",
      rightStart: "E",
      rightEnd: "W",
      leftMotion: "dash",
      rightMotion: "dash",
    },
  ],
  6: [
    // Static
    {
      leftStart: "N",
      leftEnd: "N",
      rightStart: "S",
      rightEnd: "S",
      leftMotion: "static",
      rightMotion: "static",
    },
    {
      leftStart: "E",
      leftEnd: "E",
      rightStart: "W",
      rightEnd: "W",
      leftMotion: "static",
      rightMotion: "static",
    },
    {
      leftStart: "N",
      leftEnd: "N",
      rightStart: "E",
      rightEnd: "E",
      leftMotion: "static",
      rightMotion: "static",
    },
  ],
};

/**
 * Motion type information
 */
export const MOTION_INFO: Record<number, MotionInfo> = {
  1: {
    name: "Dual-Shift",
    color: "#22D3EE",
    icon: "fa-arrows-rotate",
    description: "Both hands shift to adjacent points",
    key: "Both hands move 90° around the grid",
  },
  2: {
    name: "Shift",
    color: "#4ADE80",
    icon: "fa-arrow-right",
    description: "One hand shifts, the other stays still",
    key: "Single hand moves to adjacent point",
  },
  3: {
    name: "Cross-Shift",
    color: "#F472B6",
    icon: "fa-shuffle",
    description: "One hand shifts while the other dashes",
    key: "Combination: 90° shift + 180° dash",
  },
  4: {
    name: "Dash",
    color: "#FB923C",
    icon: "fa-bolt",
    description: "One hand dashes, the other stays still",
    key: "Single hand jumps to opposite point",
  },
  5: {
    name: "Dual-Dash",
    color: "#A78BFA",
    icon: "fa-arrows-left-right-to-line",
    description: "Both hands dash to opposite points",
    key: "Both hands jump 180° across the grid",
  },
  6: {
    name: "Static",
    color: "#94A3B8",
    icon: "fa-pause",
    description: "Both hands remain still",
    key: "No movement - a pause in the sequence",
  },
};
