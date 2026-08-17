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
  // An LED baton: braided shaft, clear tubes, and a frosted cap over the light
  // capsule at each end. Staff family — same reach, same two tracked ends — but
  // its tracked tips sit at the cap centers, where the light actually is, so the
  // LED/fire/trail emitters come out of the caps instead of off the rims.
  CAPSULE_BATON = "capsule_baton",

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

  // === TRIGENG FAMILY ===
  TRIGENG = "trigeng",

  // === HAND ===
  HAND = "hand",

  // === TRIQUETRA FAMILY ===
  TRIQUETRA = "triquetra",
  TRIQUETRA2 = "triquetra2",

  // === SWORD ===
  SWORD = "sword",

  // === ENERGY FAMILY (premium cosmetics) ===
  // Two paid prop styles that follow their physical parent in every registry:
  // Energy Saber spins exactly like a sword, Energy Staff exactly like a staff.
  // They are deliberately NOT variants of those parents — the variant cycle
  // (getNextVariation) has no access gate, so listing them there would hand a
  // paid prop out for free on any surface offering a variant toggle.
  // Access lives in PREMIUM_COSMETIC_PROP_TYPES (prop-type-display-registry.ts).
  ENERGY_SABER = "energy_saber",
  ENERGY_STAFF = "energy_staff",

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
  // Render asset: static/images/props/pictograph/poi.svg - knob gripped at
  // viewBox center, ball sticks out (club-style single-ended geometry).
  POI = "poi",
}
