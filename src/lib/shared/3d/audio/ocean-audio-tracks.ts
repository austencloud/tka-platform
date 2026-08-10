import type { OceanVariant } from "../environments/domain/enums/environment-enums";

export type SceneAudioVariant = OceanVariant | "celestial";

export type NoiseType = "brown" | "pink" | "white";
export type FilterType = "lowpass" | "bandpass";
export type DetailEventType =
  | "metallic-ping"
  | "bubble-cluster"
  | "shimmer-tone"
  | "water-movement"
  | "none";

export interface TrackParams {
  droneFreq: number;
  droneDetune: number;
  droneGain: number;
  noiseType: NoiseType;
  noiseFilterType: FilterType;
  noiseFilterFreq: number;
  noiseFilterQ: number;
  noiseGain: number;
  lfoRate: number;
  lfoDepth: number;
  subFreq: number;
  subGain: number;
  detailEvent: DetailEventType;
  detailMinInterval: number;
  detailMaxInterval: number;
  detailGain: number;
}

export interface AudioTrack {
  id: string;
  name: string;
  type: "procedural" | "file";
  src?: string;
  variant: SceneAudioVariant;
  params: TrackParams;
}

export const OCEAN_TRACKS: AudioTrack[] = [
  {
    id: "abyss-deep",
    name: "The Deep",
    type: "procedural",
    variant: "abyss",
    params: {
      droneFreq: 55,
      droneDetune: -10,
      droneGain: 0.12,
      noiseType: "brown",
      noiseFilterType: "lowpass",
      noiseFilterFreq: 150,
      noiseFilterQ: 2,
      noiseGain: 0.06,
      lfoRate: 0.08,
      lfoDepth: 20,
      subFreq: 30,
      subGain: 0.08,
      detailEvent: "metallic-ping",
      detailMinInterval: 8,
      detailMaxInterval: 20,
      detailGain: 0.04,
    },
  },
  {
    id: "abyss-bio",
    name: "Bioluminescence",
    type: "procedural",
    variant: "abyss",
    params: {
      droneFreq: 82,
      droneDetune: 3,
      droneGain: 0.08,
      noiseType: "pink",
      noiseFilterType: "bandpass",
      noiseFilterFreq: 300,
      noiseFilterQ: 3,
      noiseGain: 0.04,
      lfoRate: 0.04,
      lfoDepth: 15,
      subFreq: 41,
      subGain: 0.05,
      detailEvent: "shimmer-tone",
      detailMinInterval: 6,
      detailMaxInterval: 14,
      detailGain: 0.03,
    },
  },
  {
    id: "reef-sunlit",
    name: "Sunlit Shallows",
    type: "procedural",
    variant: "reef",
    params: {
      droneFreq: 110,
      droneDetune: 5,
      droneGain: 0.06,
      noiseType: "white",
      noiseFilterType: "lowpass",
      noiseFilterFreq: 2500,
      noiseFilterQ: 0.8,
      noiseGain: 0.1,
      lfoRate: 0.15,
      lfoDepth: 40,
      subFreq: 55,
      subGain: 0.04,
      detailEvent: "bubble-cluster",
      detailMinInterval: 4,
      detailMaxInterval: 10,
      detailGain: 0.05,
    },
  },
  {
    id: "reef-coral",
    name: "Coral Garden",
    type: "procedural",
    variant: "reef",
    params: {
      droneFreq: 95,
      droneDetune: 0,
      droneGain: 0.05,
      noiseType: "brown",
      noiseFilterType: "lowpass",
      noiseFilterFreq: 1000,
      noiseFilterQ: 1.2,
      noiseGain: 0.07,
      lfoRate: 0.1,
      lfoDepth: 25,
      subFreq: 48,
      subGain: 0.03,
      detailEvent: "bubble-cluster",
      detailMinInterval: 6,
      detailMaxInterval: 14,
      detailGain: 0.03,
    },
  },
  {
    id: "mystical-aurora",
    name: "Aurora Depths",
    type: "procedural",
    variant: "mystical",
    params: {
      droneFreq: 82,
      droneDetune: -5,
      droneGain: 0.08,
      noiseType: "pink",
      noiseFilterType: "bandpass",
      noiseFilterFreq: 400,
      noiseFilterQ: 4,
      noiseGain: 0.05,
      lfoRate: 0.05,
      lfoDepth: 30,
      subFreq: 41,
      subGain: 0.06,
      detailEvent: "shimmer-tone",
      detailMinInterval: 6,
      detailMaxInterval: 15,
      detailGain: 0.04,
    },
  },
  {
    id: "mystical-crystal",
    name: "Crystal Cavern",
    type: "procedural",
    variant: "mystical",
    params: {
      droneFreq: 73,
      droneDetune: 7,
      droneGain: 0.07,
      noiseType: "pink",
      noiseFilterType: "bandpass",
      noiseFilterFreq: 550,
      noiseFilterQ: 6,
      noiseGain: 0.03,
      lfoRate: 0.03,
      lfoDepth: 18,
      subFreq: 36,
      subGain: 0.05,
      detailEvent: "shimmer-tone",
      detailMinInterval: 8,
      detailMaxInterval: 18,
      detailGain: 0.05,
    },
  },
  {
    id: "cinematic-blue",
    name: "Blue Planet",
    type: "procedural",
    variant: "cinematic",
    params: {
      droneFreq: 65,
      droneDetune: 0,
      droneGain: 0.1,
      noiseType: "brown",
      noiseFilterType: "lowpass",
      noiseFilterFreq: 350,
      noiseFilterQ: 1.2,
      noiseGain: 0.08,
      lfoRate: 0.1,
      lfoDepth: 25,
      subFreq: 35,
      subGain: 0.07,
      detailEvent: "water-movement",
      detailMinInterval: 5,
      detailMaxInterval: 12,
      detailGain: 0.04,
    },
  },
  {
    id: "cinematic-still",
    name: "Still Waters",
    type: "procedural",
    variant: "cinematic",
    params: {
      droneFreq: 50,
      droneDetune: -3,
      droneGain: 0.05,
      noiseType: "brown",
      noiseFilterType: "lowpass",
      noiseFilterFreq: 200,
      noiseFilterQ: 1.5,
      noiseGain: 0.04,
      lfoRate: 0.06,
      lfoDepth: 10,
      subFreq: 28,
      subGain: 0.04,
      detailEvent: "water-movement",
      detailMinInterval: 10,
      detailMaxInterval: 25,
      detailGain: 0.02,
    },
  },
];

export const CELESTIAL_TRACK: AudioTrack = {
  id: "seraphic-choir-of-air",
  name: "High Air",
  type: "procedural",
  variant: "celestial",
  params: {
    droneFreq: 130.81,
    droneDetune: 3,
    droneGain: 0.035,
    noiseType: "pink",
    noiseFilterType: "bandpass",
    noiseFilterFreq: 920,
    noiseFilterQ: 0.75,
    noiseGain: 0.018,
    lfoRate: 0.035,
    lfoDepth: 4,
    subFreq: 65.41,
    subGain: 0.018,
    detailEvent: "shimmer-tone",
    detailMinInterval: 11,
    detailMaxInterval: 19,
    detailGain: 0.014,
  },
};

const SCENE_AUDIO_TRACKS = [...OCEAN_TRACKS, CELESTIAL_TRACK];

export function getTracksForVariant(variant: SceneAudioVariant): AudioTrack[] {
  return SCENE_AUDIO_TRACKS.filter((track) => track.variant === variant);
}

export function getTrackById(id: string): AudioTrack | undefined {
  return SCENE_AUDIO_TRACKS.find((track) => track.id === id);
}

export function getDefaultTrackForVariant(
  variant: SceneAudioVariant
): AudioTrack {
  return SCENE_AUDIO_TRACKS.find((track) => track.variant === variant)!;
}
