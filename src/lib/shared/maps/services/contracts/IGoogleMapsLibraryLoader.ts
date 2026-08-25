export interface IGoogleMapsLibraryLoader {
  /**
   * The map itself: `maps` and `marker`. Unchanged, and deliberately does not
   * include `places` — both consumers of this method mount a map without ever
   * opening a picker, and folding Places in would make every one of those
   * mounts download a library nothing on screen uses.
   */
  load(apiKey: string): Promise<void>;

  /**
   * Places, memoized separately from {@link load}. Either may be called first:
   * the picker can open before the map has ever intersected the viewport.
   */
  loadPlaces(apiKey: string): Promise<void>;
}
