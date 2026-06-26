// Dev-only live A/B toggles for ocean-scene effects. In-memory only — every flag
// resets to its shipped default (on) on reload. Written by the right-rail Dev
// Tools popover, read by FloraInstances/OceanScene (sway, caustics, fog, ibl),
// GodRayShafts (god-ray shafts), OceanRuntimeSystems (hemi light),
// AtmosphereSystem (particles), and ScenePostProcessing (underwater distortion,
// water tint, bloom). Lets a reviewer isolate exactly which effect is causing an
// observed change — e.g. which element washes the scene out.
let _sway = $state(true);
let _caustics = $state(true);
let _godRayShafts = $state(true);
let _underwaterDistortion = $state(true);
// Washout-suspect group: the elements that veil/flatten the scene.
let _fog = $state(true);
let _waterTint = $state(true);
let _hemiLight = $state(true);
let _ibl = $state(true);
let _particles = $state(true);
let _bloom = $state(true);

// Live-tunable strengths (dev sliders). caustic = raw uCausticStrength;
// waterTint = a 0..N multiplier on the base absorption coeffs + scatter veil.
// Defaults toned down (0.22→0.1, 1.0→0.5): caustics + tint together washed the
// seabed out. Slider headroom remains (caustics→0.6, tint→2.0) to push back up.
let _causticStrength = $state(0.1);
let _waterTintStrength = $state(0.5);

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
  get godRayShafts() {
    return _godRayShafts;
  },
  set godRayShafts(v: boolean) {
    _godRayShafts = v;
  },
  get underwaterDistortion() {
    return _underwaterDistortion;
  },
  set underwaterDistortion(v: boolean) {
    _underwaterDistortion = v;
  },
  get fog() {
    return _fog;
  },
  set fog(v: boolean) {
    _fog = v;
  },
  get waterTint() {
    return _waterTint;
  },
  set waterTint(v: boolean) {
    _waterTint = v;
  },
  get hemiLight() {
    return _hemiLight;
  },
  set hemiLight(v: boolean) {
    _hemiLight = v;
  },
  get ibl() {
    return _ibl;
  },
  set ibl(v: boolean) {
    _ibl = v;
  },
  get particles() {
    return _particles;
  },
  set particles(v: boolean) {
    _particles = v;
  },
  get bloom() {
    return _bloom;
  },
  set bloom(v: boolean) {
    _bloom = v;
  },
  get causticStrength() {
    return _causticStrength;
  },
  set causticStrength(v: number) {
    _causticStrength = v;
  },
  get waterTintStrength() {
    return _waterTintStrength;
  },
  set waterTintStrength(v: number) {
    _waterTintStrength = v;
  },
};
