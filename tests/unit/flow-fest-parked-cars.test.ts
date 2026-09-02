import { describe, expect, it } from "vitest";
import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Texture,
  Vector3,
} from "three";
import {
  createFlowFestParkedCarInstances,
  flowFestParkedCarPlacementMatrix,
  settleFlowFestParkedCarOnGround,
  type FlowFestParkedCarModel,
} from "../../src/routes/test/flow-fest-sim/flow-fest-parked-cars";

const model: FlowFestParkedCarModel = {
  id: "test-sedan",
  label: "test sedan",
  url: "/models/test.glb",
  lengthMeters: 4.8,
  widthMeters: 2,
  heightMeters: 1.5,
  sourceYawRadians: 0,
  paint: {
    materialNames: ["Paint"],
    variants: ["#ff0000", "#0000ff"],
    mode: "recolor",
  },
};

function buildSource(): Group {
  const source = new Group();
  const paint = new MeshStandardMaterial({ name: "Paint", color: "#888888" });
  paint.map = new Texture();
  const glass = new MeshStandardMaterial({ name: "Glass" });
  const body = new Mesh(new BoxGeometry(4.8, 1.2, 2), paint);
  body.name = "Body";
  body.position.y = 0.6;
  const windows = new Mesh(new BoxGeometry(2, 0.3, 1.8), glass);
  windows.name = "Windows";
  windows.position.y = 1.35;
  source.add(body, windows);
  return source;
}

describe("Flow Fest parked cars", () => {
  it("settles a car on a slope with pitch and roll instead of hovering", () => {
    // Ground rises 0.1 per metre toward +x; the nose points along +x.
    const settled = settleFlowFestParkedCarOnGround(
      model,
      { x: 0, z: 0, rotation: 0 },
      (x) => 0.1 * x
    );
    expect(settled.y).toBeCloseTo(-0.03, 5);
    expect(settled.pitch).toBeCloseTo(Math.atan(0.1), 5);
    expect(settled.roll).toBeCloseTo(0, 5);

    // Ground rises toward +z (the car's right side); the body rolls left-up.
    const rolled = settleFlowFestParkedCarOnGround(
      model,
      { x: 0, z: 0, rotation: 0 },
      (_x, z) => 0.1 * z
    );
    expect(rolled.pitch).toBeCloseTo(0, 5);
    expect(rolled.roll).toBeCloseTo(-Math.atan(0.1), 5);
    // The matrix lifts the right-hand wheels to meet the higher ground.
    const matrix = flowFestParkedCarPlacementMatrix({
      x: 0,
      y: rolled.y,
      z: 0,
      rotation: 0,
      pitch: rolled.pitch,
      roll: rolled.roll,
    });
    const rightWheel = new Vector3(0, 0, 0.84).applyMatrix4(matrix);
    expect(rightWheel.y).toBeGreaterThan(rolled.y);
    const nose = new Vector3(1, 0, 0).applyMatrix4(
      flowFestParkedCarPlacementMatrix({
        x: 0,
        y: 0,
        z: 0,
        rotation: 0,
        pitch: settled.pitch,
        roll: 0,
      })
    );
    expect(nose.y).toBeGreaterThan(0);
  });

  it("paints only the named panels, per instance, and keeps the rest untouched", () => {
    const placements = [
      {
        x: 0,
        y: 0,
        z: 0,
        rotation: 0,
        pitch: 0,
        roll: 0,
        modelId: model.id,
        paintIndex: 0,
      },
      {
        x: 10,
        y: 0,
        z: 0,
        rotation: Math.PI / 2,
        pitch: 0,
        roll: 0,
        modelId: model.id,
        paintIndex: 1,
      },
    ];
    const root = createFlowFestParkedCarInstances(
      buildSource(),
      model,
      placements
    );
    const instanced = root.children as InstancedMesh[];
    expect(instanced).toHaveLength(2);
    const body = instanced.find((mesh) => mesh.name.endsWith("_Body"))!;
    const windows = instanced.find((mesh) => mesh.name.endsWith("_Windows"))!;
    expect(body.userData.flowFestPainted).toBe(true);
    expect(windows.userData.flowFestPainted).toBe(false);
    expect(body.instanceColor).not.toBeNull();
    expect(windows.instanceColor).toBeNull();
    const bodyMaterial = body.material as MeshStandardMaterial;
    expect(bodyMaterial.map).toBeNull();
    expect(bodyMaterial.color.getHexString()).toBe("ffffff");
    const first = new Color();
    const second = new Color();
    body.getColorAt(0, first);
    body.getColorAt(1, second);
    expect(first.getHexString()).toBe("ff0000");
    expect(second.getHexString()).toBe("0000ff");
    const matrix = new Matrix4();
    body.getMatrixAt(1, matrix);
    const position = new Vector3().setFromMatrixPosition(matrix);
    expect(position.x).toBeCloseTo(10, 5);
    expect(position.y).toBeCloseTo(0.6, 5);
  });
});
