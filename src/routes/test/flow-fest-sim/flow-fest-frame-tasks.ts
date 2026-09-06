/**
 * Keys for the Flow Fest sim's tasks on Threlte's main stage.
 *
 * A task registered without a key is an isolated vertex in Threlte's
 * scheduler: it runs in registration order, after every task that carries an
 * `after`/`before` edge. A key is what lets another task name it, and that
 * edge is the only ordering Threlte promises. The scene's world step owns the
 * physics step and, with it, where the player's car is this frame; anything
 * that paints from that pose orders itself after the step so it draws the
 * body where physics just put it rather than where it was a frame ago.
 */
export const FLOW_FEST_WORLD_STEP_TASK = "flow-fest:world-step";
export const FLOW_FEST_DRIVEN_CAR_POSE_TASK = "flow-fest:driven-car-pose";
