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

describe("performer-relative character hand assignment", () => {
  it.each([
    ["source", avatarSource],
    ["runtime", avatarRuntime],
  ])(
    "keeps blue on anatomical left and red on anatomical right in the %s build",
    (_label, component) => {
      expect(component).toMatch(
        /setPropsAndBlend\(\s*blueVisible \? blueWorldProp : null,\s*redVisible \? redWorldProp : null/
      );
      expect(component).toMatch(
        /applyContactLock\(\s*"left",\s*bluePropAnchorRef,\s*bluePropCorrectionRef/
      );
      expect(component).toMatch(
        /applyContactLock\(\s*"right",\s*redPropAnchorRef,\s*redPropCorrectionRef/
      );
    }
  );

  it.each([
    ["source", avatarSource],
    ["runtime", avatarRuntime],
  ])(
    "keeps finger poses attached to the canonical arms in the %s build",
    (_label, component) => {
      expect(component).toContain(
        "const leftGrip = bluePropState ? GripType.SQUARE : GripType.IDLE"
      );
      expect(component).toContain(
        "const rightGrip = redPropState ? GripType.SQUARE : GripType.IDLE"
      );
    }
  );
});
