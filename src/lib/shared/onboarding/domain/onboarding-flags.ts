/**
 * Onboarding Flags
 *
 * Two independent switches gate the post-signup entry experience:
 *
 * - AUTO_TOURS_ENABLED (off): the step-editor coach-mark walkthroughs that
 *   auto-pop while a user works. Unfinished, so they stay off — a new user
 *   never gets interrupted mid-task by one of these. (The Fuse walkthrough
 *   was deleted 2026-07-10.)
 * - CREATE_TUTORIAL_ENABLED (on): the ONE cold-start guided-build offer shown
 *   to a first-time guest landing on an empty Create (see
 *   appEntryState.offerCreateTutorial). Finished and ship-ready, independent
 *   of AUTO_TOURS_ENABLED.
 *
 * So the real behavior with today's flags is "zero auto-popping coach marks,
 * plus exactly one opt-in tutorial offer" — not "zero interruptions."
 *
 * Flip AUTO_TOURS_ENABLED to true when the coach marks are polished. The
 * Settings "replay tutorial" path (appEntryState.replay) remains available
 * regardless of these flags.
 */
export const AUTO_TOURS_ENABLED = false;

/**
 * The guided-build "Create tutorial" is finished and ship-ready, unlike the
 * step-editor coach marks still gated by AUTO_TOURS_ENABLED.
 * This flag enables ONLY the create-tutorial offer (guest first-touch in Create
 * + Settings replay), independent of the other two tours.
 */
export const CREATE_TUTORIAL_ENABLED = true;

/**
 * First-ever 3D-viewer open guided setup (scene → formation → presets).
 * Spec: docs/superpowers/specs/2026-08-23-viewer3d-intro-presets-design.md.
 * Independent of AUTO_TOURS_ENABLED — this is a one-shot overlay on the 3D
 * pane, not an auto-popping coach mark.
 */
export const VIEWER3D_INTRO_ENABLED = true;
