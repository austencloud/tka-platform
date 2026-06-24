import { describe, it, expect } from "vitest";
import {
  generateSpecialOverrideKey,
  parseSpecialOverrideKey,
} from "$lib/shared/pictograph/arrow/positioning/special-override/domain/special-arrow-placement";

/**
 * Regression: WASD-nudging one arrow's Special JSON override moved BOTH arrows.
 *
 * Root cause — the override key omitted the per-arrow discriminator. For any
 * letter whose two hands share a motion type (e.g. letter A: both Pro), the
 * blue and red arrows collapsed to an identical key, so an override written
 * for one was read back for both. The static special-placement JSON separates
 * the arrows by `attributeKey` (which is the color for non-hybrid letters);
 * the Firestore overlay key must carry that same discriminator so it is keyed
 * 1:1 with the static entry it shadows.
 */
describe("generateSpecialOverrideKey — per-arrow discriminator", () => {
  const shared = {
    gridMode: "box",
    oriFolder: "from_layer1",
    letter: "A",
    turnsTuple: "(0, 1.5)",
    motionType: "pro",
  };

  it("produces DIFFERENT keys for the two arrows of a same-motion-type letter", () => {
    const blueKey = generateSpecialOverrideKey({ ...shared, attributeKey: "blue" });
    const redKey = generateSpecialOverrideKey({ ...shared, attributeKey: "red" });
    expect(blueKey).not.toBe(redKey);
  });

  it("round-trips through parseSpecialOverrideKey including attributeKey", () => {
    const key = generateSpecialOverrideKey({ ...shared, attributeKey: "red" });
    const parsed = parseSpecialOverrideKey(key);
    expect(parsed).toEqual({ ...shared, attributeKey: "red" });
  });

  it("keeps hybrid-letter keys distinct via their attribute keys", () => {
    const proKey = generateSpecialOverrideKey({
      gridMode: "diamond",
      oriFolder: "from_layer1",
      letter: "C",
      turnsTuple: "(1, 1)",
      motionType: "pro",
      attributeKey: "pro_from_layer1",
    });
    const antiKey = generateSpecialOverrideKey({
      gridMode: "diamond",
      oriFolder: "from_layer1",
      letter: "C",
      turnsTuple: "(1, 1)",
      motionType: "anti",
      attributeKey: "anti_from_layer1",
    });
    expect(proKey).not.toBe(antiKey);
  });
});
