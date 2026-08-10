/**
 * Atmosphere along the Water Traverse.
 *
 * The three landscapes are not three scenes. They are one continuous field of
 * atmospheric values sampled by where the visitor is standing, so a transition
 * is never an event that fires — it is the middle of an interpolation the
 * visitor is walking through. Nothing can trigger twice, nothing can trigger
 * early, and both sides of every crossing are alive the whole way across,
 * which is the design's one expensive requirement met by construction.
 *
 * Two independent axes:
 *
 *   ALONG the route  — the surface palette, sampled by world Z. Snowfield to
 *                      cold coast to geothermal plain.
 *   ACROSS the line  — submersion, sampled by the visitor's EYE height against
 *                      the waterline, and blended toward a depth palette.
 *
 * Deriving submersion from the eye rather than from a Z range is what makes the
 * sea-to-steam rise land honestly: the world brightens at the exact instant the
 * visitor's head leaves the water, wherever on the ramp that happens, and it
 * would still be correct if the ramp moved.
 */

import { waterLevelAt } from "./water-traverse-terrain";

export interface AtmosphereSample {
  /** Sky / clear colour, hex. */
  background: number;
  fogColor: number;
  fogDensity: number;
  sunColor: number;
  sunIntensity: number;
  skyColor: number;
  groundColor: number;
  hemiIntensity: number;
  /** 0 fully above the waterline, 1 fully under it. */
  submersion: number;
}

type Palette = Omit<AtmosphereSample, "submersion">;
interface Stop extends Palette {
  at: number;
}

/**
 * The surface palette, by world Z. Snow fog is deliberately thin: the steam
 * plume at the far end has to read from the first step of the walk, and fog is
 * the only thing that could hide it.
 */
const SURFACE_STOPS: Stop[] = [
  {
    at: 0,
    background: 0xb7d2e6,
    fogColor: 0xcfe2ee,
    fogDensity: 0.0035,
    sunColor: 0xfff2e0,
    sunIntensity: 2.4,
    skyColor: 0xd2e8f6,
    groundColor: 0xe9f3fa,
    hemiIntensity: 0.95,
  },
  {
    at: 92,
    background: 0x9dc3d8,
    fogColor: 0xb6d3e2,
    fogDensity: 0.005,
    sunColor: 0xf4f0e4,
    sunIntensity: 2.1,
    skyColor: 0xbcdcee,
    groundColor: 0xd6ebf6,
    hemiIntensity: 0.9,
  },
  {
    at: 178,
    background: 0xa8c2c0,
    fogColor: 0xc2d1c8,
    fogDensity: 0.010,
    sunColor: 0xffe9cd,
    sunIntensity: 2.1,
    skyColor: 0xdde7dc,
    groundColor: 0x8a8471,
    hemiIntensity: 0.95,
  },
  {
    at: 206,
    background: 0xcfc9ba,
    fogColor: 0xcac2b1,
    fogDensity: 0.018,
    sunColor: 0xffe0b2,
    sunIntensity: 2.2,
    skyColor: 0xeadfcb,
    groundColor: 0x7a6650,
    hemiIntensity: 1.05,
  },
  {
    at: 244,
    background: 0xdcd3c0,
    fogColor: 0xd6ccb8,
    fogDensity: 0.024,
    sunColor: 0xffd9a0,
    sunIntensity: 2.1,
    skyColor: 0xf0e5cf,
    groundColor: 0x86705a,
    hemiIntensity: 1.1,
  },
];

/**
 * The depth palette, by metres below the waterline. Red goes first in water,
 * then green, so the ramp down is a slow desaturation into blue rather than a
 * dimmer switch.
 *
 * `groundColor` is the one value here that is not a mood dial. The chamber has
 * exactly two lights, so the hemisphere's ground half IS the fill: every face
 * that turns away from the sun is lit by it and nothing else. It used to be
 * 0x0b2b36 at the trench floor, which is near black, and the result was that
 * the largest reef specimens — the basalt pinnacle and the coral citadel on the
 * east verge — rendered as flat black cutouts with lit caps. They read as holes
 * punched in the picture rather than as rock.
 *
 * A seabed is the brightest surface in a trench. Eighteen metres of water over
 * pale sand bounces a real, measurable amount of light back up; the shaded side
 * of a boulder down there is dim blue-green, never black. These values are that
 * upwelling light, so they track the sand rather than the water above it.
 */
const DEPTH_STOPS: Stop[] = [
  {
    at: 0,
    background: 0x3d94a4,
    fogColor: 0x3a8798,
    fogDensity: 0.016,
    sunColor: 0xcaf1f7,
    sunIntensity: 1.9,
    skyColor: 0x74c2d4,
    groundColor: 0x4a8b90,
    hemiIntensity: 0.9,
  },
  {
    at: 8,
    background: 0x14657e,
    fogColor: 0x125266,
    fogDensity: 0.024,
    sunColor: 0x9adcec,
    sunIntensity: 1.6,
    skyColor: 0x4fa8bf,
    groundColor: 0x3d7b84,
    hemiIntensity: 0.95,
  },
  {
    // The floor of the trench. Dark enough to feel like eighteen metres of
    // water overhead, but the fog still has to clear far enough to SEE the
    // route: the first pass was honest about depth and unwalkable, which is
    // the wrong trade for a piece whose whole promise is a path you never
    // have to search for.
    at: 19,
    background: 0x0a4257,
    fogColor: 0x0a3b4e,
    fogDensity: 0.031,
    sunColor: 0x7fd2e8,
    sunIntensity: 1.35,
    skyColor: 0x35899f,
    groundColor: 0x336d78,
    hemiIntensity: 1.05,
  },
];

function mixHex(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const r = Math.round(ar + (((b >> 16) & 0xff) - ar) * t);
  const g = Math.round(ag + (((b >> 8) & 0xff) - ag) * t);
  const bl = Math.round(ab + ((b & 0xff) - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smoothstep, so no stop boundary reads as a seam in the gradient. */
function ease(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

function samplePalette(stops: Stop[], at: number): Palette {
  if (at <= stops[0].at) return stops[0];
  const last = stops[stops.length - 1];
  if (at >= last.at) return last;

  let index = 0;
  while (index < stops.length - 2 && at > stops[index + 1].at) index += 1;

  const from = stops[index];
  const to = stops[index + 1];
  const t = ease((at - from.at) / (to.at - from.at));

  return {
    background: mixHex(from.background, to.background, t),
    fogColor: mixHex(from.fogColor, to.fogColor, t),
    fogDensity: mix(from.fogDensity, to.fogDensity, t),
    sunColor: mixHex(from.sunColor, to.sunColor, t),
    sunIntensity: mix(from.sunIntensity, to.sunIntensity, t),
    skyColor: mixHex(from.skyColor, to.skyColor, t),
    groundColor: mixHex(from.groundColor, to.groundColor, t),
    hemiIntensity: mix(from.hemiIntensity, to.hemiIntensity, t),
  };
}

/**
 * How submerged the view is. The blend spans a metre either side of the
 * surface rather than switching at it: a hard cut at eye level flickers every
 * time the walk cycle bobs, and a real head breaking a surface takes about that
 * long anyway.
 *
 * Measured against `waterLevelAt(z)`, not against WATERLINE_Y. The piece has two
 * surfaces 23 m apart, and keyed to the sea alone this function would report the
 * springs chamber as 27 m under water for every metre of it — including the last
 * twelve, which the visitor walks in air, on rock, having just climbed out of a
 * pool. That is the difference between an ending and a corridor.
 */
export function submersionAt(eyeY: number, z: number): number {
  return 1 - ease((eyeY - (waterLevelAt(z) - 0.55)) / 1.1);
}

export function sampleAtmosphere(z: number, eyeY: number): AtmosphereSample {
  const surface = samplePalette(SURFACE_STOPS, z);
  const depth = samplePalette(DEPTH_STOPS, Math.max(0, waterLevelAt(z) - eyeY));
  const submersion = submersionAt(eyeY, z);

  return {
    background: mixHex(surface.background, depth.background, submersion),
    fogColor: mixHex(surface.fogColor, depth.fogColor, submersion),
    fogDensity: mix(surface.fogDensity, depth.fogDensity, submersion),
    sunColor: mixHex(surface.sunColor, depth.sunColor, submersion),
    sunIntensity: mix(surface.sunIntensity, depth.sunIntensity, submersion),
    skyColor: mixHex(surface.skyColor, depth.skyColor, submersion),
    groundColor: mixHex(surface.groundColor, depth.groundColor, submersion),
    hemiIntensity: mix(
      surface.hemiIntensity,
      depth.hemiIntensity,
      submersion
    ),
    submersion,
  };
}
