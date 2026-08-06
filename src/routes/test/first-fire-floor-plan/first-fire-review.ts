export type ReviewStage =
  | "overview"
  | "threshold"
  | "dj"
  | "ek"
  | "fl"
  | "earth";

export interface StageDefinition {
  value: ReviewStage;
  label: string;
  shortLabel: string;
  heading: string;
  description: string;
  readout: string;
}

export const FIRST_FIRE_REVIEW_STAGES: StageDefinition[] = [
  {
    value: "overview",
    label: "Full plan",
    shortLabel: "Plan",
    heading: "One room, three separate reveals",
    description:
      "The S-turn uses alternating rock ribs to hide the next performer. The visitor follows one clear route, but each shrine arrives as its own encounter.",
    readout: "No sampled route point sees two performer anchors.",
  },
  {
    value: "threshold",
    label: "Water to Fire",
    shortLabel: "Entry",
    heading: "Water becomes heat before fire appears",
    description:
      "The west door enters a four-metre steam threshold, then narrows to a short ember bridge. The torch field is the first large Fire reveal.",
    readout: "Steam threshold: 4 m clear. Ember bridge: 3 m clear.",
  },
  {
    value: "dj",
    label: "DJ shrine",
    shortLabel: "DJ",
    heading: "The first orbit teaches the room's rule",
    description:
      "DJ stays inside a recessed habitat and fire trench. Ordinary forward movement carries the visitor through a 240-degree horseshoe orbit and opens the next passage.",
    readout:
      "Four overlapping activation zones remove the missed-trigger trap.",
  },
  {
    value: "ek",
    label: "EK shrine",
    shortLabel: "EK",
    heading: "The route remembers where the visitor has been",
    description:
      "DJ's tall flame has collapsed to low coals. A blind transfer turns south toward EK, while rock keeps DJ and FL out of the encounter.",
    readout: "Completed performers keep moving after their shrine cools.",
  },
  {
    value: "fl",
    label: "FL shrine",
    shortLabel: "FL",
    heading: "The last shrine spends the room's red",
    description:
      "DJ and EK remain as coal history while FL carries the final detailed fire. Completing this orbit triggers the room-wide extinction event.",
    readout: "Only one shrine may use detailed fire at a time.",
  },
  {
    value: "earth",
    label: "Fire to Earth",
    shortLabel: "Earth",
    heading: "Green becomes the only remaining direction",
    description:
      "Every flame and coal is gone before moss reaches the final trench. The growth circles FL in green, stays connected to the Earth gully, and becomes the exit cue.",
    readout: "Red and green never overlap during the transition.",
  },
];
