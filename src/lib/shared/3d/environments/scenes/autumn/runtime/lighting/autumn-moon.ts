/**
 * The one direction the Autumn moon and its key light both use.
 *
 * Magnitude is ignored by the moon billboard and normalised by the light, so
 * only the ratio matters. Two constraints shaped it:
 *
 *   - Azimuth stays behind and slightly left of the hero camera, which is the
 *     gap the Blender tree belt deliberately leaves open for the moon.
 *   - Elevation is about 25 degrees, raised from the original 18.7. Two forces
 *     pull against each other here. Lower keeps the moon inside the frame of a
 *     downward-pitched performance camera, which is the only place it is ever
 *     seen; higher shortens shadows. 34 degrees was tried and rejected: it
 *     bought little shadow quality that `shadow.intensity` does not buy more
 *     cheaply, and it pushed the moon well above the top of frame. At 25
 *     degrees a 12m tree throws a ~26m shadow, which the +/-20 shadow camera
 *     still covers.
 */
export const AUTUMN_MOON_DIRECTION: [number, number, number] = [-6, 26, -56];

/**
 * Art-directed disk placement for performance cameras.
 *
 * The physical key above keeps enough elevation for useful shadows. The disk
 * shares its azimuth but sits on the visible horizon band, where downward-
 * pitched stage cameras can actually include it. Horizontal agreement carries
 * the readable shadow direction; separating elevation prevents the moon from
 * disappearing above five of the seven review framings.
 */
export const AUTUMN_MOON_VISUAL_DIRECTION: [number, number, number] = [
  -13, -3, -56,
];
