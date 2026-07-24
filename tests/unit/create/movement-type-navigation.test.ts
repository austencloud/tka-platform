import { describe, expect, it } from "vitest";
import { buildMovementFamilyPanels } from "$lib/features/create/construct/option-picker/services/movement-type-navigation";
import {
  getMovementFamilyPresentation,
  MOVEMENT_FAMILY_DESCRIPTORS,
  MOVEMENT_TYPE_DESCRIPTORS,
} from "$lib/features/create/construct/option-picker/services/section-title-formatter";
import type { OrganizedSection } from "$lib/features/create/construct/option-picker/domain/option-picker-types";

function section(title: string, ids: string[]): OrganizedSection {
  return {
    title,
    pictographs: ids.map((id) => ({ id }) as never),
    type: "section",
  };
}

describe("movement type navigation", () => {
  it("always returns the four visible movement families in selector order", () => {
    const panels = buildMovementFamilyPanels([]);

    expect(panels.map((panel) => panel.title)).toEqual(
      MOVEMENT_FAMILY_DESCRIPTORS.map((family) => family.key)
    );
    expect(panels.every((panel) => panel.pictographs.length === 0)).toBe(true);
  });

  it("derives family presentation from resolved movement descriptions", () => {
    expect(MOVEMENT_TYPE_DESCRIPTORS.Type1).toMatchObject({
      key: "Type1",
      typeName: "Type 1",
      description: "Dual-Shift",
      translationKey: "create_type_dual_shift",
      coloredParts: [
        { text: "Dual", color: "#00b3ff" },
        { text: "-" },
        { text: "Shift", color: "#6F2DA8" },
      ],
    });

    const presentation = getMovementFamilyPresentation(
      MOVEMENT_FAMILY_DESCRIPTORS[3]!,
      (descriptor) => `Traduit-${descriptor.description}`
    );

    expect(presentation).toEqual({
      accessibleName:
        "Types 4-6: Traduit-Dash, Traduit-Dual-Dash, Traduit-Static",
      coloredParts: [
        { text: "Traduit", color: "currentColor" },
        { text: "-" },
        { text: "Dash", color: "#26e600" },
        { text: ", " },
        { text: "Traduit", color: "currentColor" },
        { text: "-" },
        { text: "Dual", color: "#00b3ff" },
        { text: "-" },
        { text: "Dash", color: "#26e600" },
        { text: ", " },
        { text: "Traduit", color: "currentColor" },
        { text: "-" },
        { text: "Static", color: "#eb7d00" },
      ],
      paletteColors: ["#26e600", "#00b3ff", "#eb7d00"],
    });
  });

  it("keeps an empty family in place after filtering", () => {
    const panels = buildMovementFamilyPanels([
      section("Type1", ["a"]),
      section("Type3", ["b"]),
    ]);

    expect(panels[1]).toMatchObject({
      title: "Type2",
      pictographs: [],
    });
  });

  it("combines Types 4, 5, and 6 without changing their order", () => {
    const panels = buildMovementFamilyPanels([
      section("Type4", ["dash"]),
      section("Type5", ["dual-dash"]),
      section("Type6", ["static"]),
    ]);

    expect(panels[3]?.pictographs.map((pictograph) => pictograph.id)).toEqual([
      "dash",
      "dual-dash",
      "static",
    ]);
  });
});
