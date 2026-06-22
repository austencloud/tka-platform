// Dev-only live A/B toggles for ocean-scene effects. In-memory only — every flag
// resets to its shipped default (on) on reload. Written by the right-rail Dev
// Tools popover, read by FloraInstances (sway) and ScenePostProcessing
// (god rays / caustics / underwater distortion). Lets a reviewer isolate exactly
// which effect is causing an observed change, instead of guessing.
let _sway = $state(true);
let _caustics = $state(true);
let _underwaterDistortion = $state(true);

export const oceanDebugToggles = {
  get sway() {
    return _sway;
  },
  set sway(v: boolean) {
    _sway = v;
  },
  get caustics() {
    return _caustics;
  },
  set caustics(v: boolean) {
    _caustics = v;
  },
  get underwaterDistortion() {
    return _underwaterDistortion;
  },
  set underwaterDistortion(v: boolean) {
    _underwaterDistortion = v;
  },
};
