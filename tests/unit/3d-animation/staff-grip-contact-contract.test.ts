import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageRoot = resolve(
  process.cwd(),
  "node_modules/@austencloud/scene-3d"
);

const staffSource = readFileSync(
  resolve(packageRoot, "src/lib/components/Staff3D.svelte"),
  "utf8"
);

const staffRuntime = readFileSync(
  resolve(packageRoot, "dist/lib/components/Staff3D.svelte"),
  "utf8"
);

const orbitControlsSource = readFileSync(
  resolve(process.cwd(), "src/lib/shared/3d/components/OrbitControls.svelte"),
  "utf8"
);

const gripTestPage = readFileSync(
  resolve(process.cwd(), "src/routes/test/staff-grip/+page.svelte"),
  "utf8"
);

describe("staff grip contact contract", () => {
  it.each([
    ["source", staffSource],
    ["runtime", staffRuntime],
  ])(
    "passes the canonical staff radius directly to the %s geometry",
    (_label, component) => {
      expect(component).toContain(
        "thickness ?? userProportionsState.dimensions.staffRadius"
      );
      expect(component).not.toContain(
        "userProportionsState.dimensions.staffRadius * 2"
      );
    }
  );

  it("keeps right-drag orbit as an explicit shared control action", () => {
    expect(orbitControlsSource).toContain(
      'rightDragAction === "rotate"\n        ? CameraControls.ACTION.ROTATE'
    );
    expect(gripTestPage).toContain('rightDragAction="rotate"');
  });
});
