// Viewer feature flags — local kill-switches for viewer surfaces that are built
// but not ready to ship. Plain module consts (not PostHog): these gate our own
// unfinished UI, they are not A/B experiments.

// Performance-video upload + step mapping ("Upload Video" panel → Map Beats →
// StepMapEditor). The July kill-switch blockers are resolved: R2 video origins
// are allowed by media-src, and the editor opens beside the viewer canvas.
export const VIDEO_UPLOAD_ENABLED = true;
