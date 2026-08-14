import { describe, expect, it } from "vitest";

import { CHARCOAL_PRESETS } from "$lib/shared/animation-engine/components/effects-panel/presets/charcoal-presets";

describe("Charcoal motion profiles", () => {
  it("keeps the review profiles physically distinct", () => {
    const byId = new Map(CHARCOAL_PRESETS.map((preset) => [preset.id, preset]));

    expect(byId.get("charcoal-steel-wool")?.patch).toMatchObject({
      intensity: 0.98,
      spread: 0.14,
      glow: 0.96,
      emissionStyle: "steel-wool",
    });
    expect(byId.get("charcoal-forge-cinder")?.patch).toMatchObject({
      intensity: 0.9,
      spread: 0.42,
      glow: 0.8,
      emissionStyle: "forge-burst",
    });
    expect(byId.get("charcoal-cinder-fan")?.patch).toMatchObject({
      intensity: 1,
      spread: 1,
      glow: 0.68,
      emissionStyle: "cinder-fan",
    });
    expect(byId.get("charcoal-banked-ember")?.patch).toMatchObject({
      intensity: 0.62,
      spread: 0.25,
      glow: 0.56,
      emissionStyle: "banked-ember",
    });

    const reviewStyles = [
      "charcoal-steel-wool",
      "charcoal-forge-cinder",
      "charcoal-cinder-fan",
      "charcoal-banked-ember",
    ].map((id) => byId.get(id)?.patch.emissionStyle);
    expect(new Set(reviewStyles)).toHaveLength(4);
  });
});
