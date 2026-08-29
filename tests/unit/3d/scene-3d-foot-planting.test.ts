import { describe, expect, it } from "vitest";
import { Bone, Object3D, Quaternion, Vector3 } from "three";
import {
  ContactCurveCache,
  FootPlanter,
  HingeConstrainedLegIKSolver,
  LocomotionState,
  type IAvatarSkeletonBuilder,
  type ILegIKSolver,
  type LegIKInput,
} from "@austencloud/scene-3d";

type LegChain = NonNullable<
  ReturnType<IAvatarSkeletonBuilder["getLeftLegChain"]>
>;

function makeLeg(prefix: "Left" | "Right"): {
  chain: LegChain;
  toe: Bone;
} {
  const hip = new Bone();
  const knee = new Bone();
  const ankle = new Bone();
  const toe = new Bone();
  hip.name = `${prefix}UpLeg`;
  knee.name = `${prefix}Leg`;
  ankle.name = `${prefix}Foot`;
  toe.name = `${prefix}ToeBase`;
  knee.position.set(0, -1, 0);
  ankle.position.set(0, -1, 0);
  toe.position.set(0, 0, 0.3);
  hip.add(knee);
  knee.add(ankle);
  ankle.add(toe);
  return {
    chain: {
      root: hip,
      middle: knee,
      effector: ankle,
      upperLength: 1,
      lowerLength: 1,
      totalLength: 2,
      rootRestDir: new Vector3(0, -1, 0),
      middleRestDir: new Vector3(0, -1, 0),
    },
    toe,
  };
}

function solvedAnkleAngle(toeWeight: number, weight = 1): number {
  const rig = new Object3D();
  const hip = new Bone();
  const knee = new Bone();
  const ankle = new Bone();
  const toe = new Bone();

  knee.position.set(0, -1, 0);
  ankle.position.set(0, -1, 0);
  toe.position.set(0, 0, 0.3);
  rig.add(hip);
  hip.add(knee);
  knee.add(ankle);
  ankle.add(toe);
  rig.updateMatrixWorld(true);

  const footTarget = new Vector3(0.35, -1.5, 0.8);
  const toeTarget = footTarget.clone().add(new Vector3(0, 0.2, 0.3));

  new HingeConstrainedLegIKSolver().solve({
    chain: {
      root: hip,
      middle: knee,
      effector: ankle,
      upperLength: 1,
      lowerLength: 1,
      totalLength: 2,
      rootRestDir: new Vector3(0, -1, 0),
      middleRestDir: new Vector3(0, -1, 0),
    },
    footTarget,
    toe,
    toeTarget,
    kneeHingeAxis: new Vector3(1, 0, 0),
    poleDirection: new Vector3(0, 0, 1),
    bendSign: 1,
    weight,
    toeWeight,
  });

  return new Quaternion().angleTo(ankle.getWorldQuaternion(new Quaternion()));
}

describe("scene-3d foot planting", () => {
  it("eases the ankle onto a new plant independently of the leg solve", () => {
    const off = solvedAnkleAngle(0);
    const halfway = solvedAnkleAngle(0.5);
    const planted = solvedAnkleAngle(1);

    // Stride warping can keep the leg solve fully engaged before contact. The
    // ankle still needs its own ramp or heel strike becomes a one-frame flap.
    expect(off).toBeCloseTo(0, 6);
    expect(planted).toBeGreaterThan(0.1);
    expect(halfway).toBeCloseTo(planted / 2, 5);
  });

  it("preserves the animated ankle in world space during a partial leg blend", () => {
    // Blending the ankle's local quaternion is not enough: the partially
    // solved hip and knee still rotate its parent frame. A zero toe weight
    // means zero world-space ankle correction at every leg-solve weight.
    expect(solvedAnkleAngle(0, 0.5)).toBeCloseTo(0, 6);
  });

  it("preserves the animation's foot roll while planting", () => {
    const root = new Object3D();
    const hips = new Bone();
    hips.name = "Hips";
    root.add(hips);
    const left = makeLeg("Left");
    const right = makeLeg("Right");
    hips.add(left.chain.root, right.chain.root);
    root.updateMatrixWorld(true);

    const byName = new Map([
      ["Hips", hips],
      ["LeftToeBase", left.toe],
      ["RightToeBase", right.toe],
    ]);
    const skeleton = {
      getBone: (name: string) => byName.get(name) ?? null,
      getLeftLegChain: () => left.chain,
      getRightLegChain: () => right.chain,
    } as unknown as IAvatarSkeletonBuilder;

    const solves: LegIKInput[] = [];
    const solver: ILegIKSolver = {
      solve(input) {
        solves.push({ ...input });
        return { bendSign: input.bendSign ?? 1, reliable: false };
      },
    };
    const planter = new FootPlanter();
    planter.initialize(skeleton, solver, new ContactCurveCache());

    const frame = (contact: number) =>
      planter.update(0.04, {
        groundY: 0,
        locomotionState: LocomotionState.WALKING,
        isMoving: true,
        contactLeft: contact,
        contactRight: contact,
      });

    frame(0); // seed velocity history
    frame(1); // enter contact and build a non-zero blend
    frame(0); // release while that blend is still fading

    // The ankle target already carries the animation's ankle-to-toe offset.
    // Asking the solver to point at the same toe target again creates a
    // temporary rotation during the position blend: the visible foot flap.
    expect(solves).not.toHaveLength(0);
    expect(solves.every((input) => input.toe === undefined)).toBe(true);
    expect(solves.every((input) => input.toeTarget === undefined)).toBe(true);
    expect(solves.every((input) => input.toeWeight === undefined)).toBe(true);
  });

  it("keeps applying a fading plant during the first idle frame", () => {
    const root = new Object3D();
    const hips = new Bone();
    hips.name = "Hips";
    root.add(hips);
    const left = makeLeg("Left");
    const right = makeLeg("Right");
    hips.add(left.chain.root, right.chain.root);
    root.updateMatrixWorld(true);

    const byName = new Map([
      ["Hips", hips],
      ["LeftToeBase", left.toe],
      ["RightToeBase", right.toe],
    ]);
    const skeleton = {
      getBone: (name: string) => byName.get(name) ?? null,
      getLeftLegChain: () => left.chain,
      getRightLegChain: () => right.chain,
    } as unknown as IAvatarSkeletonBuilder;

    const solves: LegIKInput[] = [];
    const solver: ILegIKSolver = {
      solve(input) {
        solves.push({ ...input });
        return { bendSign: input.bendSign ?? 1, reliable: false };
      },
    };
    const planter = new FootPlanter();
    planter.initialize(skeleton, solver, new ContactCurveCache());

    planter.update(0.04, {
      groundY: 0,
      locomotionState: LocomotionState.WALKING,
      isMoving: true,
      contactLeft: 0,
      contactRight: 0,
    });
    planter.update(0.04, {
      groundY: 0,
      locomotionState: LocomotionState.WALKING,
      isMoving: true,
      contactLeft: 1,
      contactRight: 1,
    });
    const beforeIdle = solves.length;

    planter.update(0.04, {
      groundY: 0,
      locomotionState: LocomotionState.IDLE,
      isMoving: false,
    });

    expect(beforeIdle).toBeGreaterThan(0);
    expect(solves.length).toBeGreaterThan(beforeIdle);
    expect(solves.slice(beforeIdle).every((input) => input.weight < 1)).toBe(
      true
    );
  });

  it("lets an authored maneuver own contact over the gait underneath it", () => {
    const root = new Object3D();
    const hips = new Bone();
    hips.name = "Hips";
    root.add(hips);
    const left = makeLeg("Left");
    const right = makeLeg("Right");
    hips.add(left.chain.root, right.chain.root);
    root.updateMatrixWorld(true);

    const byName = new Map([
      ["Hips", hips],
      ["LeftToeBase", left.toe],
      ["RightToeBase", right.toe],
    ]);
    const skeleton = {
      getBone: (name: string) => byName.get(name) ?? null,
      getLeftLegChain: () => left.chain,
      getRightLegChain: () => right.chain,
    } as unknown as IAvatarSkeletonBuilder;

    const solvedRoots: Bone[] = [];
    const solver: ILegIKSolver = {
      solve(input) {
        solvedRoots.push(input.chain.root as Bone);
        return { bendSign: input.bendSign ?? 1, reliable: false };
      },
    };
    const curves = new ContactCurveCache();
    curves.register({
      clipName: "turn-right-90",
      frameRate: 30,
      frameCount: 2,
      leftFoot: [0, 0],
      rightFoot: [1, 1],
    });
    const planter = new FootPlanter();
    planter.initialize(skeleton, solver, curves);

    const input = {
      groundY: 0,
      locomotionState: LocomotionState.IDLE,
      isMoving: true,
      currentClipName: "turn-right-90",
      currentClipPhase: 0.5,
      // Deliberately contradict the authored maneuver. The overlay on screen
      // says right support, so the frozen loop underneath cannot take it back.
      contactLeft: 1,
      contactRight: 0,
    };
    planter.update(0.04, input); // seed velocity history
    planter.update(0.04, input);

    expect(solvedRoots).toContain(right.chain.root);
    expect(solvedRoots).not.toContain(left.chain.root);
  });

  it("leaves authored motion alone when its hard-lock confidence is zero", () => {
    const root = new Object3D();
    const hips = new Bone();
    hips.name = "Hips";
    root.add(hips);
    const left = makeLeg("Left");
    const right = makeLeg("Right");
    hips.add(left.chain.root, right.chain.root);
    root.updateMatrixWorld(true);
    const byName = new Map([
      ["Hips", hips],
      ["LeftToeBase", left.toe],
      ["RightToeBase", right.toe],
    ]);
    const skeleton = {
      getBone: (name: string) => byName.get(name) ?? null,
      getLeftLegChain: () => left.chain,
      getRightLegChain: () => right.chain,
    } as unknown as IAvatarSkeletonBuilder;
    let solveCount = 0;
    const solver: ILegIKSolver = {
      solve(input) {
        solveCount += 1;
        return { bendSign: input.bendSign ?? 1, reliable: false };
      },
    };
    const planter = new FootPlanter();
    planter.initialize(skeleton, solver, new ContactCurveCache());
    const input = {
      groundY: 0,
      locomotionState: LocomotionState.WALKING,
      isMoving: true,
      contactLeft: 1,
      contactRight: 1,
      lockConfidence: 0,
      strideScale: 1.4,
      travelDirection: { x: 1, z: 0 },
    };

    planter.update(0.04, input);

    expect(solveCount).toBe(0);
  });

});
