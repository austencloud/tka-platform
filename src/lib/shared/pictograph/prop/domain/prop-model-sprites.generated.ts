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
  "bigbuugeng": { width: 600, height: 293.1, fit: 516.351, capturedAt: "2026-09-06T05:22:01.491Z" },
  "bigchicken": { width: 252.8, height: 44.4, fit: 258.353, capturedAt: "2026-09-06T05:22:09.095Z" },
  "bigclub": { width: 252, height: 65, fit: 346.154, capturedAt: "2026-09-06T05:21:55.112Z" },
  "bigcontactball": { width: 600, height: 300, fit: 2142.857, capturedAt: "2026-09-06T05:22:17.529Z" },
  "bigdoublecontactball": { width: 600, height: 300, fit: 1863.354, capturedAt: "2026-09-06T05:22:19.779Z" },
  "bigdoublestar": { width: 600, height: 300, fit: 418.134, capturedAt: "2026-09-06T05:22:13.392Z" },
  "bigeightrings": { width: 600, height: 309.5, fit: 459.71, capturedAt: "2026-09-06T05:22:15.529Z" },
  "bighoop": { width: 600, height: 300, fit: 456.024, capturedAt: "2026-09-06T05:21:59.343Z" },
  "bigstaff": { width: 600, height: 54.5, fit: 245.605, capturedAt: "2026-09-06T05:21:50.186Z" },
  "bigtorch": { width: 402, height: 57.3, fit: 546.876, capturedAt: "2026-09-06T05:22:23.419Z" },
  "bigtriad": { width: 600, height: 523.5, fit: 494.087, capturedAt: "2026-09-06T05:21:57.262Z" },
  "buugeng": { width: 262.6, height: 135.9, fit: 316.386, capturedAt: "2026-09-06T05:22:00.398Z" },
  "capsule_baton": { width: 252.8, height: 40, fit: 292.728, capturedAt: "2026-09-06T05:21:52.072Z" },
  "chicken": { width: 325, height: 30.3, fit: 292.808, capturedAt: "2026-09-06T05:22:07.970Z" },
  "club": { width: 258.67, height: 34.17, fit: 427.125, capturedAt: "2026-09-06T05:21:54.106Z" },
  "contactball": { width: 300, height: 150, fit: 1500, capturedAt: "2026-09-06T05:22:16.527Z" },
  "doublecontactball": { width: 300, height: 150, fit: 1304.348, capturedAt: "2026-09-06T05:22:18.637Z" },
  "doublestar": { width: 300, height: 150, fit: 292.693, capturedAt: "2026-09-06T05:22:12.330Z" },
  "eightrings": { width: 257.3, height: 137.1, fit: 285.095, capturedAt: "2026-09-06T05:22:14.465Z" },
  "fire_double_staff": { width: 252.8, height: 24, fit: 280.889, capturedAt: "2026-09-06T05:21:53.103Z" },
  "guitar": { width: 595, height: 170, fit: 535.318, capturedAt: "2026-09-06T05:22:10.184Z" },
  "minihoop": { width: 257.9, height: 138.2, fit: 294.105, capturedAt: "2026-09-06T05:21:58.310Z" },
  "poi": { width: 291.67, height: 38, fit: 434.286, capturedAt: "2026-09-06T05:22:24.556Z" },
  "quiad": { width: 250, height: 250, fit: 303.476, capturedAt: "2026-09-06T05:22:21.052Z" },
  "sickles": { width: 440, height: 260, fit: 996.911, capturedAt: "2026-09-06T05:22:06.863Z" },
  "simple_staff": { width: 252.8, height: 77.8, fit: 284.492, capturedAt: "2026-09-06T05:21:49.262Z" },
  "staff": { width: 252.8, height: 77.8, fit: 284.492, capturedAt: "2026-09-06T05:21:48.311Z" },
  "staff_v2": { width: 250, height: 40.5, fit: 182.514, capturedAt: "2026-09-06T05:21:51.122Z" },
  "sword": { width: 572.3, height: 64, fit: 414.915, capturedAt: "2026-09-06T05:22:05.772Z" },
  "torch": { width: 360, height: 35.7, fit: 682.572, capturedAt: "2026-09-06T05:22:22.277Z" },
  "triad": { width: 258.67, height: 227.818, fit: 301.025, capturedAt: "2026-09-06T05:21:56.186Z" },
  "trigeng": { width: 250, height: 236.7, fit: 422.692, capturedAt: "2026-09-06T05:22:02.612Z" },
  "triquetra": { width: 290.3, height: 169.6, fit: 285.486, capturedAt: "2026-09-06T05:22:03.679Z" },
  "triquetra2": { width: 300, height: 175.32, fit: 295.114, capturedAt: "2026-09-06T05:22:04.763Z" },
  "ukulele": { width: 350, height: 71.5, fit: 416.942, capturedAt: "2026-09-06T05:22:11.246Z" },
};
