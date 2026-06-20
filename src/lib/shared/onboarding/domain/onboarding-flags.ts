/**
 * Onboarding Flags
 *
 * Auto-popping tours (the post-signup create tutorial prompt, the step editor
 * coach marks, and the Fuse walkthrough) are unfinished, so they stay off for
 * now — a new user goes straight to the app with zero interruptions.
 *
 * Flip this to true when the tours are polished. Manual entry points are NOT
 * gated by this flag: every help button still replays its tour via restart(),
 * and the Settings "replay tutorial" path (appEntryState.replay) still works.
 */
export const AUTO_TOURS_ENABLED = false;

/**
 * The guided-build "Create tutorial" is finished and ship-ready, unlike the
 * fuse-tour and step-editor coach marks still gated by AUTO_TOURS_ENABLED.
 * This flag enables ONLY the create-tutorial offer (guest first-touch in Create
 * + Settings replay), independent of the other two tours.
 */
export const CREATE_TUTORIAL_ENABLED = true;
