import { describe, expect, it } from "vitest";
import { PropType } from "../enums/prop-type";
import {
  DEACTIVATED_PROP_TYPES,
  PROP_PICKER_SECTIONS,
  isPropActive,
} from "../prop-type-display-registry";

describe("prop picker catalog", () => {
  it("hides nothing", () => {
    expect(DEACTIVATED_PROP_TYPES.size).toBe(0);
    for (const prop of Object.values(PropType)) {
      expect(isPropActive(prop), prop).toBe(true);
    }
  });

  it("lists every prop with artwork except the scene-only hand", () => {
    const listed = new Set(PROP_PICKER_SECTIONS.flatMap((s) => s.props));
    const expected = (Object.values(PropType) as PropType[]).filter(
      (prop) => prop !== PropType.HAND
    );
    const missing = expected.filter((prop) => !listed.has(prop));
    expect(missing).toEqual([]);
  });
});
