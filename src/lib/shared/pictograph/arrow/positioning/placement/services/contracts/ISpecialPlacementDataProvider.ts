/**
 * Special Placement Data Provider Contract
 *
 * Handles loading and caching of special placement JSON data.
 */

export interface ISpecialPlacementDataProvider {
  /**
   * Get special placement data for a specific letter.
   * Returns cached data if available, otherwise loads from JSON.
   *
   * @param gridMode Grid mode ('diamond' or 'box')
   * @param oriKey Orientation key (e.g., 'from_layer1', 'from_radial')
   * @param letter Letter to load data for
   * @returns Letter-specific placement data or empty object if not found
   */
  getLetterData(
    gridMode: string,
    oriKey: string,
    letter: string
  ): Promise<Record<string, unknown>>;
}
