/**
 * AUTO-WRITTEN by /test/prop-3d-studio/sprites. Do not edit by hand.
 *
 * Every prop whose 2D "3D model" look has a captured sprite pair under
 * static/images/props/appearances/model/<prop>-{blue,red}.svg. The box is the
 * same pictograph box PROP_DIMENSIONS already uses for that prop, so tip
 * points, trails, and mandala reach are unchanged by the look.
 */
export interface PropModelSpriteEntry {
  readonly width: number;
  readonly height: number;
  /** Uniform scale (2D units per meter) that fit the 3D model into the box. */
  readonly fit: number;
  /** ISO timestamp of the capture that wrote the sprite pair. */
  readonly capturedAt: string;
}

export const PROP_MODEL_SPRITES: Readonly<
  Record<string, PropModelSpriteEntry>
> = {
  "bigbuugeng": { width: 600, height: 293.1, fit: 516.351, capturedAt: "2026-09-06T06:25:29.965Z" },
  "bigchicken": { width: 252.8, height: 44.4, fit: 251.44, capturedAt: "2026-09-06T06:25:37.671Z" },
  "bigclub": { width: 252, height: 65, fit: 178.774, capturedAt: "2026-09-06T06:25:23.636Z" },
  "bigcontactball": { width: 600, height: 300, fit: 2142.857, capturedAt: "2026-09-06T06:25:46.203Z" },
  "bigdoublecontactball": { width: 600, height: 300, fit: 1863.354, capturedAt: "2026-09-06T06:25:48.388Z" },
  "bigdoublestar": { width: 600, height: 300, fit: 418.134, capturedAt: "2026-09-06T06:25:42.021Z" },
  "bigeightrings": { width: 600, height: 309.5, fit: 459.71, capturedAt: "2026-09-06T06:25:44.174Z" },
  "bighoop": { width: 600, height: 300, fit: 456.024, capturedAt: "2026-09-06T06:25:27.900Z" },
  "bigstaff": { width: 600, height: 54.5, fit: 245.605, capturedAt: "2026-09-06T06:25:18.661Z" },
  "bigtorch": { width: 402, height: 57.3, fit: 280.185, capturedAt: "2026-09-06T06:25:51.572Z" },
  "bigtriad": { width: 600, height: 523.5, fit: 494.087, capturedAt: "2026-09-06T06:25:25.814Z" },
  "buugeng": { width: 262.6, height: 135.9, fit: 316.386, capturedAt: "2026-09-06T06:25:28.917Z" },
  "capsule_baton": { width: 252.8, height: 40, fit: 292.728, capturedAt: "2026-09-06T06:25:20.582Z" },
  "chicken": { width: 325, height: 30.3, fit: 284.973, capturedAt: "2026-09-06T06:25:36.530Z" },
  "club": { width: 258.67, height: 34.17, fit: 256.908, capturedAt: "2026-09-06T06:25:22.616Z" },
  "contactball": { width: 300, height: 150, fit: 1500, capturedAt: "2026-09-06T06:25:45.191Z" },
  "doublecontactball": { width: 300, height: 150, fit: 1304.348, capturedAt: "2026-09-06T06:25:47.308Z" },
  "doublestar": { width: 300, height: 150, fit: 292.693, capturedAt: "2026-09-06T06:25:40.921Z" },
  "eightrings": { width: 257.3, height: 137.1, fit: 285.095, capturedAt: "2026-09-06T06:25:43.099Z" },
  "fire_double_staff": { width: 252.8, height: 24, fit: 280.889, capturedAt: "2026-09-06T06:25:21.614Z" },
  "guitar": { width: 595, height: 170, fit: 535.318, capturedAt: "2026-09-06T06:25:38.744Z" },
  "minihoop": { width: 257.9, height: 138.2, fit: 279.135, capturedAt: "2026-09-06T06:25:26.873Z" },
  "poi": { width: 291.67, height: 38, fit: 297.357, capturedAt: "2026-09-06T06:25:52.543Z" },
  "quiad": { width: 250, height: 250, fit: 303.476, capturedAt: "2026-09-06T06:25:49.486Z" },
  "simple_staff": { width: 252.8, height: 77.8, fit: 284.492, capturedAt: "2026-09-06T06:25:17.723Z" },
  "staff": { width: 252.8, height: 77.8, fit: 284.492, capturedAt: "2026-09-06T06:25:16.755Z" },
  "staff_v2": { width: 250, height: 40.5, fit: 182.514, capturedAt: "2026-09-06T06:25:19.598Z" },
  "sword": { width: 572.3, height: 64, fit: 414.915, capturedAt: "2026-09-06T06:25:34.298Z" },
  "torch": { width: 360, height: 35.7, fit: 351.276, capturedAt: "2026-09-06T06:25:50.531Z" },
  "triad": { width: 258.67, height: 227.818, fit: 301.025, capturedAt: "2026-09-06T06:25:24.719Z" },
  "trigeng": { width: 250, height: 236.7, fit: 413.476, capturedAt: "2026-09-06T06:25:31.089Z" },
  "triquetra": { width: 290.3, height: 169.6, fit: 285.474, capturedAt: "2026-09-06T06:25:32.189Z" },
  "triquetra2": { width: 300, height: 175.32, fit: 279.826, capturedAt: "2026-09-06T06:25:33.288Z" },
  "ukulele": { width: 350, height: 71.5, fit: 339.657, capturedAt: "2026-09-06T06:25:39.840Z" },
};
