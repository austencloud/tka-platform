export type HandPosition = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
export type MotionType = "pro" | "anti" | "hybrid";

export interface LetterDefinition {
  letter: string;
  startLeft: HandPosition;
  startRight: HandPosition;
  endLeft: HandPosition;
  endRight: HandPosition;
  leftMotion: MotionType;
  rightMotion: MotionType;
  description?: string;
}
