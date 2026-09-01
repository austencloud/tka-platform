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

const gripTestStage = readFileSync(
  resolve(process.cwd(), "src/routes/test/staff-grip/StaffGripStage.svelte"),
  "utf8"
);

const liveSequencePerformer = readFileSync(
  resolve(
    process.cwd(),
    "src/lib/shared/3d/performers/LiveSequencePerformer3D.svelte"
  ),
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

  it("plays checked-in sequence data through the shared live performer", () => {
    expect(gripTestPage).toContain(
      'import { FALG } from "$lib/shared/combination/domain/demo-fixtures"'
    );
    expect(gripTestPage).toContain("const sequence = FALG;");
    expect(gripTestPage).toContain(
      'data-sequence-source="validated-production-fixture"'
    );
    expect(gripTestStage).toContain("<LiveSequencePerformer3D");
    expect(gripTestStage).toContain("weldGrip={true}");
    expect(gripTestStage).toContain("enableLocomotion={false}");
    expect(gripTestStage).toContain("enableFootPlanting={false}");
    expect(gripTestStage).toContain("phaseOffsetSteps={phase}");
    expect(gripTestStage).toContain("active={false}");
    expect(gripTestStage).not.toContain("useTask");
    expect(gripTestStage).not.toContain("Math.sin");
  });

  it("freezes one shared sequence phase across four inspectable camera views", () => {
    expect(gripTestPage).toContain("const VIEWS: CameraView[]");
    expect(gripTestPage).toContain("{#each VIEWS as view, index (view.id)}");
    expect(gripTestPage).toContain("{phase}");
    expect(gripTestPage).toContain('type="range"');
    expect(gripTestPage).toContain('rightDragAction="rotate"');
  });

  it("publishes measured shaft-axis and palm-contact errors", () => {
    expect(gripTestPage).toContain("diagnostics.leftGripAxis");
    expect(gripTestPage).toContain("diagnostics.rightGripAxis");
    expect(gripTestPage).toContain("data-left-axis-error-deg");
    expect(gripTestPage).toContain("data-right-axis-error-deg");
    expect(liveSequencePerformer).toContain(
      "onCollisionEvents={props.onCollisionEvents}"
    );
  });

  it("maps sequence hands into the rig's blue and red prop inputs", () => {
    expect(liveSequencePerformer).toContain(
      "bluePropState={performerState.leftPropState}"
    );
    expect(liveSequencePerformer).toContain(
      "redPropState={performerState.rightPropState}"
    );
    expect(liveSequencePerformer).toContain(
      "bluePropType={toScenePropType(props.propType)}"
    );
    expect(liveSequencePerformer).toContain(
      "redPropType={toScenePropType(props.propType)}"
    );
    expect(liveSequencePerformer).toContain("groundOffset={rigGroundOffset}");
  });

  it("does not cover the test scene with explanatory copy", () => {
    expect(gripTestPage).not.toContain("scene-label");
    expect(gripTestPage).not.toContain("Production grip test");
    expect(gripTestPage).not.toContain("Two staffs. One real rig.");
  });
});
