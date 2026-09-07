import { DEFAULT_CHARCOAL_PARAMS } from "../domain/types/charcoal-spark-types";
import { validatePreset } from "../domain/types/led-color-presets";

export function migrateStoredSettings(parsed: Record<string, unknown>): Record<string, unknown> {
  if (parsed.propGlow !== undefined) {
    delete parsed.propGlow;
  }

  parsed.stepNumbers = true;

  if ("flameColorMode" in parsed && !("fireColorBlend" in parsed)) {
    parsed.fireColorBlend = parsed.flameColorMode === "natural" ? 0 : 1.0;
    delete parsed.flameColorMode;
  }
  if ("coloredFlames" in parsed && !("fireColorBlend" in parsed)) {
    parsed.fireColorBlend = parsed.coloredFlames ? 1.0 : 0;
    delete parsed.coloredFlames;
  }

  if ("fuelSourceId" in parsed && !("charcoalEffect" in parsed)) {
    parsed.charcoalEffect = parsed.fuelSourceId === "charcoal";
    if (parsed.charcoalEffect) parsed.fireEffect = false;
    delete parsed.fuelSourceId;
  }

  if ("firePreset" in parsed && !("fireIntensity" in parsed)) {
    const tierToIntensity: Record<string, number> = {
      small: 0.3, medium: 0.5, large: 0.8,
      candlewick: 0.3, "fire-spin": 0.5, torch: 0.8,
    };
    parsed.fireIntensity = tierToIntensity[parsed.firePreset as string] ?? 0.7;
    delete parsed.firePreset;
  }

  if ("fireIntensity" in parsed && (parsed.fireIntensity as number) > 1.0) {
    parsed.fireIntensity = Math.min(1.0, (parsed.fireIntensity as number) / 3.0);
  }

  if (!("fireColorBlend" in parsed)) parsed.fireColorBlend = 0.5;
  if ("fireSmokeLevel" in parsed) delete parsed.fireSmokeLevel;

  if ("fireUseCharcoal" in parsed && !("charcoalEffect" in parsed)) {
    if (parsed.fireUseCharcoal && parsed.fireEffect) {
      parsed.charcoalEffect = true;
      parsed.fireEffect = false;
    } else {
      parsed.charcoalEffect = false;
    }
    delete parsed.fireUseCharcoal;
  }
  if (!("charcoalEffect" in parsed)) parsed.charcoalEffect = false;

  if ("charcoalPresetId" in parsed) {
    delete parsed.charcoalPresetId;
  }
  if (!("charcoalParams" in parsed)) {
    parsed.charcoalParams = { ...DEFAULT_CHARCOAL_PARAMS };
  } else if ("tangentialBias" in (parsed.charcoalParams as Record<string, unknown>)) {
    parsed.charcoalParams = { ...DEFAULT_CHARCOAL_PARAMS };
  }
  if (!("fireIntensity" in parsed)) parsed.fireIntensity = 0.7;
  if (!("fireTurbulence" in parsed)) parsed.fireTurbulence = 0.5;

  delete parsed.fuelSourceId;
  delete parsed.flameColorMode;
  delete parsed.fireUseCharcoal;

  if (parsed.charcoalParams) {
    parsed.charcoalParams = { ...DEFAULT_CHARCOAL_PARAMS, ...parsed.charcoalParams };
  }

  if (!("pathShape" in parsed)) parsed.pathShape = "arc";
  if (!("motionAwarePaths" in parsed)) parsed.motionAwarePaths = false;
  // Per-hand path lines, split from the legacy single `pathLines` flag.
  if (!("leftPathLines" in parsed)) {
    parsed.leftPathLines = parsed.bluePathLines ?? parsed.pathLines ?? false;
  }
  if (!("rightPathLines" in parsed)) {
    parsed.rightPathLines = parsed.redPathLines ?? parsed.pathLines ?? false;
  }
  delete parsed.bluePathLines;
  delete parsed.redPathLines;
  delete parsed.pathLines;

  if (parsed.gridMode === "diamond" || parsed.gridMode === "box") {
    parsed.gridMode = "8point";
  }

  if (!parsed.tipEffectMap || Object.keys(parsed.tipEffectMap).length === 0) {
    if (parsed.fireEffect) parsed.tipEffectMap = { "*": { effect: "fire" } };
    else if (parsed.charcoalEffect) parsed.tipEffectMap = { "*": { effect: "charcoal" } };
    else if (parsed.ledEffect) parsed.tipEffectMap = { "*": { effect: "led" } };
    else if (parsed.trailStyle === "on") parsed.tipEffectMap = { "*": { effect: "trails" } };
    else parsed.tipEffectMap = {};
  }

  delete parsed.fireEffect;
  delete parsed.charcoalEffect;
  delete parsed.ledEffect;
  delete parsed.trailStyle;

  if (!parsed.tipEffortMap) {
    parsed.tipEffortMap = {};
    if (parsed.effortPreset && parsed.effortPreset !== "linear") {
      parsed.tipEffortMap = { "*": { effort: parsed.effortPreset } };
    }
  }

  if (Array.isArray(parsed.ledUserPresets)) {
    parsed.ledUserPresets = parsed.ledUserPresets.filter(validatePreset);
  }

  if (!parsed.effectLayerOverrides || typeof parsed.effectLayerOverrides !== "object") {
    parsed.effectLayerOverrides = {};
  }

  return parsed;
}
