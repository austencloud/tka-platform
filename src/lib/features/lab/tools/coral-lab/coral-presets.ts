/**
 * EZ-Tree parameter presets tuned to produce coral morphologies.
 *
 * Key differences from tree parameters (research-backed):
 * - Length:radius ratio ~2:1 (trees are ~13:1)
 * - Taper 0.3-0.4 (trees 0.7) — coral stays thick to tips
 * - Children 10-15 (trees 5-7) — dense colony packing
 * - Branch start 0.1-0.2 (trees 0.3-0.5) — branches from near base
 * - Gnarliness 0.3-0.5 (trees 0.15) — organic irregularity
 * - Segments 8-12 (trees 6-8) — rounder cross-sections
 *
 * Reference: Pocillopora verrucosa morphometry (PLOS Comp Bio),
 * coral branch diameter 10-20mm with 2:1 to 5:1 length:diameter.
 */

export interface CoralPreset {
  name: string;
  description: string;
  color: number;
  params: Record<string, unknown>;
}

const NO_LEAVES = {
  type: "oak",
  billboard: "single",
  angle: 0,
  count: 0,
  start: 1,
  size: 0,
  sizeVariance: 0,
  tint: 0x000000,
  alphaTest: 1,
};

const NO_TRELLIS = { enabled: false };

export const CORAL_PRESETS: CoralPreset[] = [
  {
    name: "Cauliflower Coral",
    description: "Pocillopora — dense, compact hemisphere with stubby tips",
    color: 0xe88b6e,
    params: {
      seed: 101,
      type: "deciduous",
      bark: {
        type: "oak",
        tint: 0xe88b6e,
        flatShading: false,
        textured: false,
        textureScale: { x: 1, y: 1 },
      },
      branch: {
        levels: 3,
        angle: { 1: 55, 2: 65, 3: 55 },
        children: { 0: 12, 1: 10, 2: 7 },
        force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.03 },
        gnarliness: { 0: 0.4, 1: 0.35, 2: 0.3, 3: 0.15 },
        length: { 0: 3, 1: 4, 2: 2.5, 3: 1.5 },
        radius: { 0: 2.5, 1: 1.5, 2: 1.0, 3: 0.7 },
        sections: { 0: 8, 1: 8, 2: 6, 3: 4 },
        segments: { 0: 10, 1: 8, 2: 6, 3: 5 },
        start: { 1: 0.15, 2: 0.1, 3: 0.1 },
        taper: { 0: 0.4, 1: 0.35, 2: 0.3, 3: 0.25 },
        twist: { 0: 0.1, 1: 0.15, 2: 0.1, 3: 0 },
      },
      leaves: NO_LEAVES,
      trellis: NO_TRELLIS,
    },
  },
  {
    name: "Branching Coral",
    description: "Acropora — open branching with thick arms",
    color: 0xff7b5a,
    params: {
      seed: 202,
      type: "deciduous",
      bark: {
        type: "oak",
        tint: 0xff7b5a,
        flatShading: false,
        textured: false,
        textureScale: { x: 1, y: 1 },
      },
      branch: {
        levels: 3,
        angle: { 1: 45, 2: 55, 3: 45 },
        children: { 0: 8, 1: 7, 2: 5 },
        force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.035 },
        gnarliness: { 0: 0.35, 1: 0.3, 2: 0.25, 3: 0.1 },
        length: { 0: 4, 1: 5, 2: 3, 3: 2 },
        radius: { 0: 2.0, 1: 1.3, 2: 0.9, 3: 0.6 },
        sections: { 0: 8, 1: 7, 2: 5, 3: 4 },
        segments: { 0: 10, 1: 8, 2: 6, 3: 5 },
        start: { 1: 0.2, 2: 0.15, 3: 0.1 },
        taper: { 0: 0.35, 1: 0.3, 2: 0.3, 3: 0.25 },
        twist: { 0: 0.15, 1: 0.2, 2: 0.1, 3: 0 },
      },
      leaves: NO_LEAVES,
      trellis: NO_TRELLIS,
    },
  },
  {
    name: "Cluster Coral",
    description: "Stylophora — tight rounded clusters with blunt tips",
    color: 0xd4518a,
    params: {
      seed: 303,
      type: "deciduous",
      bark: {
        type: "oak",
        tint: 0xd4518a,
        flatShading: false,
        textured: false,
        textureScale: { x: 1, y: 1 },
      },
      branch: {
        levels: 4,
        angle: { 1: 60, 2: 70, 3: 60 },
        children: { 0: 14, 1: 10, 2: 6 },
        force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.02 },
        gnarliness: { 0: 0.45, 1: 0.4, 2: 0.35, 3: 0.2 },
        length: { 0: 2, 1: 2.5, 2: 1.8, 3: 1.0 },
        radius: { 0: 2.8, 1: 1.8, 2: 1.2, 3: 0.8 },
        sections: { 0: 8, 1: 7, 2: 5, 3: 3 },
        segments: { 0: 12, 1: 10, 2: 8, 3: 6 },
        start: { 1: 0.1, 2: 0.08, 3: 0.08 },
        taper: { 0: 0.3, 1: 0.25, 2: 0.25, 3: 0.2 },
        twist: { 0: 0.2, 1: 0.25, 2: 0.15, 3: 0 },
      },
      leaves: NO_LEAVES,
      trellis: NO_TRELLIS,
    },
  },
  {
    name: "Pillar Coral",
    description: "Dendrogyra — thick upright columns, minimal forking",
    color: 0xc4956a,
    params: {
      seed: 404,
      type: "deciduous",
      bark: {
        type: "oak",
        tint: 0xc4956a,
        flatShading: false,
        textured: false,
        textureScale: { x: 1, y: 1 },
      },
      branch: {
        levels: 2,
        angle: { 1: 20, 2: 25, 3: 0 },
        children: { 0: 5, 1: 3, 2: 0 },
        force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.06 },
        gnarliness: { 0: 0.5, 1: 0.4, 2: 0.2, 3: 0 },
        length: { 0: 6, 1: 4, 2: 2, 3: 0 },
        radius: { 0: 3.0, 1: 2.2, 2: 1.5, 3: 0 },
        sections: { 0: 10, 1: 8, 2: 5, 3: 3 },
        segments: { 0: 12, 1: 10, 2: 8, 3: 5 },
        start: { 1: 0.5, 2: 0.4, 3: 0 },
        taper: { 0: 0.25, 1: 0.2, 2: 0.2, 3: 0 },
        twist: { 0: 0.25, 1: 0.15, 2: 0, 3: 0 },
      },
      leaves: NO_LEAVES,
      trellis: NO_TRELLIS,
    },
  },
  {
    name: "Elkhorn Coral",
    description: "Acropora palmata — broad, flat antler-like branches",
    color: 0xd4b896,
    params: {
      seed: 505,
      type: "deciduous",
      bark: {
        type: "oak",
        tint: 0xd4b896,
        flatShading: false,
        textured: false,
        textureScale: { x: 1, y: 1 },
      },
      branch: {
        levels: 2,
        angle: { 1: 50, 2: 45, 3: 0 },
        children: { 0: 6, 1: 4, 2: 0 },
        force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.02 },
        gnarliness: { 0: 0.3, 1: 0.35, 2: 0.2, 3: 0 },
        length: { 0: 4, 1: 5, 2: 3, 3: 0 },
        radius: { 0: 2.5, 1: 1.8, 2: 1.2, 3: 0 },
        sections: { 0: 8, 1: 7, 2: 5, 3: 3 },
        segments: { 0: 10, 1: 8, 2: 6, 3: 5 },
        start: { 1: 0.3, 2: 0.2, 3: 0 },
        taper: { 0: 0.3, 1: 0.25, 2: 0.2, 3: 0 },
        twist: { 0: 0.3, 1: 0.2, 2: 0, 3: 0 },
      },
      leaves: NO_LEAVES,
      trellis: NO_TRELLIS,
    },
  },
  {
    name: "Finger Coral",
    description: "Porites — stubby upright fingers, very dense",
    color: 0x8eb89e,
    params: {
      seed: 606,
      type: "deciduous",
      bark: {
        type: "oak",
        tint: 0x8eb89e,
        flatShading: false,
        textured: false,
        textureScale: { x: 1, y: 1 },
      },
      branch: {
        levels: 3,
        angle: { 1: 30, 2: 35, 3: 30 },
        children: { 0: 15, 1: 8, 2: 4 },
        force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.05 },
        gnarliness: { 0: 0.5, 1: 0.4, 2: 0.3, 3: 0.15 },
        length: { 0: 2, 1: 3, 2: 2, 3: 1.2 },
        radius: { 0: 2.0, 1: 1.4, 2: 1.0, 3: 0.7 },
        sections: { 0: 6, 1: 5, 2: 4, 3: 3 },
        segments: { 0: 10, 1: 8, 2: 6, 3: 5 },
        start: { 1: 0.1, 2: 0.1, 3: 0.1 },
        taper: { 0: 0.3, 1: 0.25, 2: 0.25, 3: 0.2 },
        twist: { 0: 0.15, 1: 0.2, 2: 0.1, 3: 0 },
      },
      leaves: NO_LEAVES,
      trellis: NO_TRELLIS,
    },
  },
];
