/**
 * The one direction the Autumn moon and its key light both use.
 *
 * Magnitude is ignored by the moon billboard and normalised by the light, so
 * only the ratio matters. Two constraints shaped it:
 *
 *   - Azimuth stays behind and slightly left of the hero camera, which is the
 *     gap the Blender tree belt deliberately leaves open for the moon.
 *   - Elevation is about 25 degrees, raised from the original 18.7. Lower
 *     keeps the moon inside a downward-pitched performance camera; higher
 *     shortens the small prop and performer shadows. 34 degrees was tried and
 *     rejected because it pushed the disk above most review framings without
 *     materially improving those local contacts.
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
