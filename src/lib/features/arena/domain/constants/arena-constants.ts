/**
 * Arena Constants
 *
 * Glicko-2 defaults and matchmaking parameters.
 */

/** Default Glicko-2 rating mean for new entries */
export const INITIAL_MU = 1500;

/** Default Glicko-2 rating deviation (high uncertainty) */
export const INITIAL_PHI = 350;

/** Default Glicko-2 volatility */
export const INITIAL_SIGMA = 0.06;

/** Matchups needed before an entry's rating is considered stable */
export const COLD_START_THRESHOLD = 10;

/** Phi below this means the rating has converged */
export const STABLE_PHI_THRESHOLD = 75;

/** How many candidate pairs the matchmaker samples before picking the best */
export const MATCHMAKING_SAMPLE_SIZE = 80;

/** Fraction of matchups that are fully random (exploration) */
export const RANDOM_MATCHUP_RATE = 0.1;

/** Minimum milliseconds between votes from the same user (spam prevention) */
export const MIN_VOTE_INTERVAL_MS = 2000;

/** How many recent matchup pairs to track per voter for dedup */
export const RECENT_MATCHUP_BUFFER_SIZE = 200;

/** Glicko-2 system constant (tau). Controls volatility change rate. */
export const GLICKO2_TAU = 0.5;

/** Convergence epsilon for Glicko-2 volatility iteration */
export const GLICKO2_EPSILON = 0.000001;

/** Arena module accent color */
export const ARENA_COLOR = "#e11d48";
