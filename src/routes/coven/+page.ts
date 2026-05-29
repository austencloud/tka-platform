// The coven hub mounts a Threlte WebGL scene and creates viewer-3d state on
// init, which is browser-only. Disable SSR so the page renders client-side,
// matching every other 3D/canvas route (endless-spinner, sequence, card-back).
export const ssr = false;
