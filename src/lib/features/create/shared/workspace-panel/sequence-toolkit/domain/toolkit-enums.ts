/**
 * Types of operations available in the sequence toolkit
 */
export enum ToolOperationType {
  // Transform operations
  MIRROR = "mirror",
  FLIP = "flip",
  INVERT = "invert",
  ROTATE_CLOCKWISE = "rotate_clockwise",
  ROTATE_COUNTERCLOCKWISE = "rotate_counterclockwise",
  SWAP_COLORS = "swap_colors",
  REWIND = "rewind",
  CLEAR = "clear",
  DUPLICATE = "duplicate",

  // Delete operations
  DELETE_SEQUENCE = "delete_sequence",
  DELETE_BEAT = "delete_beat",
  DELETE_BEATS = "delete_beats",
  DELETE_BEAT_AND_FOLLOWING = "delete_beat_and_following",
  CLEAR_BEATS = "clear_beats",

  // Export operations
  EXPORT_JSON = "export_json",
  COPY_JSON = "copy_json",
  ADD_TO_DICTIONARY = "add_to_dictionary",
  EXPORT_FULLSCREEN = "export_fullscreen",
}
