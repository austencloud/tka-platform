export const AVATAR_NAMES = [
	"Ember",
	"Soot",
	"Birch",
	"Flint",
	"Reed",
	"Cinder",
	"Moss",
	"Basalt",
	"Sage",
	"Dune",
	"Rill",
	"Briar",
	"Slate",
	"Pyre",
	"Glen",
	"Thistle",
	"Ash",
	"Wren",
	"Pike",
	"Fern",
	"Rust",
	"Tarn",
	"Opal",
	"Quill",
	"Brine",
	"Hazel",
	"Frost",
	"Lark",
	"Coral",
	"Rune",
	"Cedar",
	"Storm",
];

export const DEFAULT_ARENA_RADIUS = 8;

export const IDLE_THRESHOLD_BASE = 30;
export const INTERACTION_COOLDOWN_BASE = 20;
export const TEACHING_SPEED_TICKS_PER_BEAT = 10;
export const PROFICIENCY_THRESHOLD = 0.7;
export const FUMBLE_BASE_PROBABILITY = 0.3;
export const FRUSTRATION_DECAY_RATE = 0.05;
export const FRUSTRATION_GIVE_UP_THRESHOLD = 0.8;
export const LOSSY_TRANSMISSION_BASE = 0.1;
export const INVENTION_BASE_PROBABILITY = 0.005;
export const PASSING_DURATION_TICKS = 15;

export const WALK_SPEED_YOUTH = 1.0;
export const WALK_SPEED_ADULT = 0.8;
export const WALK_SPEED_ELDER = 0.5;

export const COLLISION_AVOIDANCE_RADIUS = 2.0;
export const COLLISION_REPULSION_STRENGTH = 1.5;
export const PERSONAL_SPACE_RADIUS = 1.5; // stop approaching at this distance
export const ARRIVAL_THRESHOLD = 0.3;

// Decay system
export const DECAY_GRACE_PERIOD = 200;
export const DECAY_PER_TICK = 0.001;
export const FORGET_THRESHOLD = 0.1;

// Performance & jams
export const PERFORMANCE_ATTRACTION_RADIUS = 6;
export const JAM_WATCHER_THRESHOLD = 3;
export const CREATIVITY_JAM_BOOST = 0.2;

// Funerals
export const FUNERAL_RADIUS = 5;
export const MOURNING_DURATION = 30;

// Monuments
export const MONUMENT_GENERATION_THRESHOLD = 3;

// Proximity learning (youth)
export const PROXIMITY_LEARNING_RADIUS = 5;
export const YOUTH_ABSORPTION_RATE = 0.005;
export const YOUTH_ABSORPTION_THRESHOLD = 0.3;

// Reincarnation
export const REINCARNATION_PROBABILITY = 0.3;
export const REINCARNATION_AFFINITY_BOOST = 3.0;

// Style drift
export const STYLE_MUTATION_STDDEV = 0.02;
export const STYLE_SIMILARITY_THRESHOLD = 0.08;
export const STYLE_SCHOOL_MIN_MEMBERS = 3;
export const STYLE_INCOMPATIBILITY_REFUSE_CHANCE = 0.1;
export const STYLE_INCOMPATIBILITY_THRESHOLD = 0.3;
