import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assembleConstraintOptions,
  type EngineGenerationParams,
} from "../src/core/engine-generation-adapter.js";

function params(
  overrides: Partial<EngineGenerationParams>
): EngineGenerationParams {
  return {
    length: 8,
    gridMode: "diamond",
    level: 2,
    ...overrides,
  };
}

describe("engine generation constraint composition", () => {
  it("merges no-static preset with the explicit no-dash axis", () => {
    const options = assembleConstraintOptions(
      params({
        constraintPreset: "no-static",
        motionTypeFilter: "no-dash",
      })
    );

    assert.deepEqual(options.motionFamily, {
      exclude: ["static", "dash"],
    });
  });

  it("lets explicit prefer-dash override a no-dash preset", () => {
    const options = assembleConstraintOptions(
      params({
        constraintPreset: "no-dash",
        motionTypeFilter: "prefer-dash",
      })
    );

    assert.equal(options.motionFamily?.exclude, undefined);
    assert.equal(options.dashPreference, "maximize");
  });

  it("lets explicit no-dash override a maximize-dash preset", () => {
    const options = assembleConstraintOptions(
      params({
        constraintPreset: "maximize-dash",
        motionTypeFilter: "no-dash",
      })
    );

    assert.deepEqual(options.motionFamily, { exclude: ["dash"] });
  });
});
