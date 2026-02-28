/**
 * TKA Supported Prop Types
 *
 * TKA supports both STATIC PROPS (staff, fans, clubs) and MOMENTUM-BASED PROPS (poi).
 * Momentum-based props use physics constraints to limit valid motions and transitions.
 *
 * Static props are held and manipulated directly by the performer.
 * Momentum props swing freely and are affected by gravity.
 *
 * This is the single source of truth for ALL prop types in the application.
 * Each enum value corresponds to an available prop SVG file in /images/props/
 */
export enum PropType {
  // === STAFF FAMILY ===
  STAFF = "staff",
  SIMPLESTAFF = "simple_staff",
  BIGSTAFF = "bigstaff",
  STAFF2 = "staff_v2",

  // === CLUB FAMILY ===
  CLUB = "club",
  BIGCLUB = "bigclub",

  // === FAN FAMILY ===
  FAN = "fan",
  BIGFAN = "bigfan",

  // === TRIAD FAMILY ===
  TRIAD = "triad",
  BIGTRIAD = "bigtriad",

  // === HOOP FAMILY ===
  MINIHOOP = "minihoop",
  BIGHOOP = "bighoop",

  // === BUUGENG FAMILY ===
  BUUGENG = "buugeng",
  BIGBUUGENG = "bigbuugeng",
  FRACTALGENG = "fractalgeng",

  // === TRIGENG FAMILY ===
  TRIGENG = "trigeng",

  // === HAND ===
  HAND = "hand",

  // === TRIQUETRA FAMILY ===
  TRIQUETRA = "triquetra",
  TRIQUETRA2 = "triquetra2",

  // === SWORD ===
  SWORD = "sword",

  // === CHICKEN FAMILY ===
  CHICKEN = "chicken",
  BIGCHICKEN = "bigchicken",

  // === GUITAR FAMILY ===
  GUITAR = "guitar",
  UKULELE = "ukulele",

  // === DOUBLESTAR FAMILY ===
  DOUBLESTAR = "doublestar",
  BIGDOUBLESTAR = "bigdoublestar",

  // === EIGHTRINGS FAMILY ===
  EIGHTRINGS = "eightrings",
  BIGEIGHTRINGS = "bigeightrings",

  // === CONTACT BALL FAMILY ===
  CONTACTBALL = "contactball",
  BIGCONTACTBALL = "bigcontactball",
  DOUBLECONTACTBALL = "doublecontactball",
  BIGDOUBLECONTACTBALL = "bigdoublecontactball",

  // === QUIAD ===
  QUIAD = "quiad",

  // === TORCH FAMILY ===
  TORCH = "torch",
  BIGTORCH = "bigtorch",

  // === POI FAMILY (Momentum-based) ===
  // Poi uses physics constraints - see PoiConstraintValidator
  // Uses club.svg as placeholder until proper poi SVG (~175px) is created
  POI = "poi",
}
