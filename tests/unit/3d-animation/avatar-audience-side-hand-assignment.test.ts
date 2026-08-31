import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageRoot = resolve(
  process.cwd(),
  "node_modules/@austencloud/scene-3d"
);

const avatarSource = readFileSync(
  resolve(packageRoot, "src/lib/components/Avatar3D.svelte"),
  "utf8"
);

const avatarRuntime = readFileSync(
  resolve(packageRoot, "dist/lib/components/Avatar3D.svelte"),
  "utf8"
);

describe("viewer-facing character hand assignment", () => {
  it.each([
    ["source", avatarSource],
    ["runtime", avatarRuntime],
  ])(
    "keeps each prop on its audience-side arm in the %s build",
    (_label, component) => {
      expect(component).toMatch(
        /setPropsAndBlend\(\s*redVisible \? redWorldProp : null,\s*blueVisible \? blueWorldProp : null/
      );
      expect(component).toMatch(
        /applyContactLock\(\s*"right",\s*bluePropAnchorRef,\s*bluePropCorrectionRef/
      );
      expect(component).toMatch(
        /applyContactLock\(\s*"left",\s*redPropAnchorRef,\s*redPropCorrectionRef/
      );
    }
  );

  it.each([
    ["source", avatarSource],
    ["runtime", avatarRuntime],
  ])(
    "keeps finger poses attached to the reassigned arms in the %s build",
    (_label, component) => {
      expect(component).toContain(
        "const leftGrip = redPropState ? GripType.SQUARE : GripType.IDLE"
      );
      expect(component).toContain(
        "const rightGrip = bluePropState ? GripType.SQUARE : GripType.IDLE"
      );
    }
  );
});
