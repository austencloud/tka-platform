// Viewer feature flags — local kill-switches for viewer surfaces that are built
// but not ready to ship. Plain module consts (not PostHog): these gate our own
// unfinished UI, they are not A/B experiments.

// Performance-video upload + beat-mapping ("Upload Video" panel → Map Beats →
// StepMapEditor). Turned OFF (2026-07-06) because the surface has two open bugs:
//   1. Uploaded videos live in R2 (pub-*.r2.dev), which is trusted in the CSP
//      connect-src but MISSING from media-src (hooks.server.ts) — so gallery +
//      editor playback is CSP-blocked and renders a dead <video>.
//   2. The upload panel swaps out the viewer canvas, so grid/props vanish.
// The feature code is intact; flip this back to true when video production
// resumes and the two bugs above are fixed.
export const VIDEO_UPLOAD_ENABLED = false;
