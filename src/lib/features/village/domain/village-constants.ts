import type { EffectAffinity, Season, WearProfile } from './village-types';
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

// Prop system
export const VILLAGE_PROP_TYPES = ["staff", "fan", "club", "poi", "torch"];
export const PROP_PREFERENCE_TRANSFER_CHANCE = 0.3;
export const PROP_WEAR_LIFESPAN = 500;
export const PROP_WEAR_VISUAL_THRESHOLD = 0.8;

export const PROP_WEAR_PROFILES: Record<
	string,
	WearProfile
> = {
	staff: { wearRate: 0.0005, failureMode: "crack", repairTicks: 20 },
	fan: { wearRate: 0.0008, failureMode: "fabric-tear", repairTicks: 30 },
	poi: { wearRate: 0.0003, failureMode: "tangle", repairTicks: 5 },
	torch: { wearRate: 0.001, failureMode: "fuel-depleted", repairTicks: 10 },
	club: { wearRate: 0.0004, failureMode: "grip-worn", repairTicks: 15 },
};

// Per-prop-type display color, shared by the prop wall and dropped-prop meshes.
export const PROP_COLORS: Record<string, string> = {
	staff: "#8B4513",
	fan: "#FF69B4",
	club: "#4169E1",
	poi: "#32CD32",
	torch: "#FF4500",
};

// Prop maker
export const MAKER_CRAFT_DURATION = 30;
export const MAKER_POSITION_ANGLE = Math.PI;
export const PROP_WALL_MAX_DISPLAY = 12;

// Style drift
export const STYLE_MUTATION_STDDEV = 0.02;
export const STYLE_SIMILARITY_THRESHOLD = 0.08;
export const STYLE_SCHOOL_MIN_MEMBERS = 3;
export const STYLE_INCOMPATIBILITY_REFUSE_CHANCE = 0.1;
export const STYLE_INCOMPATIBILITY_THRESHOLD = 0.3;

// Effect circles
export const EFFECT_AFFINITIES: EffectAffinity[] = ["fire", "led", "charcoal", "trails", "pure"];
export const CIRCLE_RADIUS = 4;
export const CIRCLE_MIN_MEMBERS = 3;
export const AFFINITY_TRANSFER_STRENGTH = 0.6;
export const AFFINITY_EXPOSURE_THRESHOLD = 5;

export const CIRCLE_COLORS: Record<EffectAffinity, string> = {
	fire: "#f97316",
	led: "#3b82f6",
	charcoal: "#6b7280",
	trails: "#a855f7",
	pure: "#f8fafc",
};

// Seasons
export const SEASON_DURATION = 300;
export const SEASON_CYCLE: Season[] = ["normal", "festival", "normal", "winter", "normal", "migration"];
