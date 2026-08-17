import { describe, expect, it } from "vitest";
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from "three";

import { PropType } from "../../../node_modules/@austencloud/scene-3d/src/lib/domain/enums/PropType";
import { recolorPropModel } from "../../../node_modules/@austencloud/scene-3d/src/lib/components/props/prop-model-recolor";
import {
  BIG_VARIANT_MAP,
  PROP_MODEL_REGISTRY,
  resolvePropModel,
} from "../../../node_modules/@austencloud/scene-3d/src/lib/components/props/prop-model-registry";

describe("prop model materials", () => {
  it("recolors only explicitly marked materials on a multi-material prop", () => {
    const scene = new Group();
    const body = new MeshStandardMaterial({ color: 0xf1b81c });
    body.name = "TKA_Body_Recolor";
    const accent = new MeshStandardMaterial({ color: 0xc31218 });
    accent.name = "TKA_Chicken_Red";
    const mesh = new Mesh(new BoxGeometry(), [body, accent]);
    scene.add(mesh);

    recolorPropModel(scene, "blue");

    expect(Array.isArray(mesh.material)).toBe(true);
    const [recoloredBody, preservedAccent] =
      mesh.material as MeshStandardMaterial[];
    expect(recoloredBody).not.toBe(body);
    expect(recoloredBody.color.getHex()).not.toBe(body.color.getHex());
    expect(
      recoloredBody.color.getHSL({ h: 0, s: 0, l: 0 }).l
    ).toBeGreaterThanOrEqual(0.55);
    expect(recoloredBody.roughness).toBeGreaterThanOrEqual(0.62);
    expect(recoloredBody.metalness).toBe(0);
    expect(recoloredBody.emissive.getHex()).toBe(0x3b82f6);
    expect(recoloredBody.emissiveIntensity).toBe(0.08);
    expect(preservedAccent).toBe(accent);
    expect(preservedAccent.color.getHex()).toBe(0xc31218);
  });

  it("keeps legacy models recolorable when they have no explicit marker", () => {
    const scene = new Group();
    const legacy = new MeshStandardMaterial({ color: 0x737373 });
    legacy.name = "Legacy_Prop_Material";
    const mesh = new Mesh(new BoxGeometry(), legacy);
    scene.add(mesh);

    recolorPropModel(scene, "red");

    expect(mesh.material).toBeInstanceOf(MeshStandardMaterial);
    expect(mesh.material).not.toBe(legacy);
    expect((mesh.material as MeshStandardMaterial).color.getHex()).not.toBe(
      legacy.color.getHex()
    );
  });

  it("keeps explicitly marked red props visible against the performer", () => {
    const scene = new Group();
    const body = new MeshStandardMaterial({ color: 0x9a5202 });
    body.name = "TKA_Body_Recolor";
    const mesh = new Mesh(new BoxGeometry(), body);
    scene.add(mesh);

    recolorPropModel(scene, "red");

    const recoloredBody = mesh.material as MeshStandardMaterial;
    const hsl = recoloredBody.color.getHSL({ h: 0, s: 0, l: 0 });
    expect(hsl.l).toBeGreaterThanOrEqual(0.6);
    expect(hsl.s).toBeGreaterThan(0.8);
    expect(recoloredBody.emissiveIntensity).toBe(0.18);
  });

  it("does not replace non-standard materials in a mixed array", () => {
    const scene = new Group();
    const body = new MeshStandardMaterial({ color: 0xf1b81c });
    body.name = "TKA_Body_Recolor";
    const unlit = new MeshBasicMaterial({ color: 0xffffff });
    const mesh = new Mesh(new BoxGeometry(), [body, unlit]);
    scene.add(mesh);

    recolorPropModel(scene, "blue");

    const materials = mesh.material as [
      MeshStandardMaterial,
      MeshBasicMaterial,
    ];
    expect(materials[0]).not.toBe(body);
    expect(materials[1]).toBe(unlit);
  });
});

describe("Chicken GLB registry", () => {
  /** Measured world length of chicken.glb along its +Y long axis. */
  const AUTHORED_LENGTH_M = 0.7779893;
  const CLUB_LENGTH_M = 0.52;
  const STAFF_LENGTH_M = 0.8636;

  it("sizes small chicken like a club and big chicken like a staff", () => {
    const chicken = resolvePropModel(PropType.CHICKEN);
    const bigChicken = resolvePropModel(PropType.BIGCHICKEN);

    expect(chicken?.entry.modelUrl).toBe("/models/props/chicken.glb");
    expect(bigChicken?.entry.modelUrl).toBe("/models/props/chicken.glb");

    expect(AUTHORED_LENGTH_M * chicken!.scale).toBeCloseTo(CLUB_LENGTH_M, 3);
    expect(AUTHORED_LENGTH_M * bigChicken!.scale).toBeCloseTo(
      STAFF_LENGTH_M,
      3
    );
  });

  it("holds the small bird by the head and the big one through the middle", () => {
    const chicken = resolvePropModel(PropType.CHICKEN)!;
    const bigChicken = resolvePropModel(PropType.BIGCHICKEN)!;

    // chicken.glb authors the head at +Y, and props sweep along +Y, so a
    // head grip only works if the model is turned end over end first.
    expect(chicken.entry.flipLongAxis).toBe(true);
    expect(chicken.entry.gripOffsetY).toBeGreaterThan(0);

    // Big chicken keeps the authored center grip, so both ends stay live.
    expect(bigChicken.entry.flipLongAxis).toBeFalsy();
    expect(bigChicken.entry.gripOffsetY).toBe(0);
  });

  it("gives big chicken its own entry instead of a flat multiplier", () => {
    // A scale multiplier off the small bird cannot express a different grip,
    // which is what BIG_VARIANT_MAP would have applied.
    expect(BIG_VARIANT_MAP[PropType.BIGCHICKEN]).toBeUndefined();
    expect(PROP_MODEL_REGISTRY[PropType.BIGCHICKEN]).toBeDefined();
  });
});

describe("Sword GLB registry", () => {
  it("needs no scale or grip correction", () => {
    // sword.glb is authored at the 34in staff length with its origin already on
    // the cross-guard, where sword.svg's viewBox center falls.
    expect(resolvePropModel(PropType.SWORD)).toMatchObject({
      entry: {
        modelUrl: "/models/props/sword.glb",
        scale: 1,
        gripOffsetY: 0,
      },
      scale: 1,
    });
    // The blade already points at +Y; flipping would bury it in the arm.
    expect(
      resolvePropModel(PropType.SWORD)!.entry.flipLongAxis
    ).toBeFalsy();
  });

  it("recolors the hilt hardware and preserves the gold kevlar wick", () => {
    // This is the defect the rebuild fixed: the procedural sword used fixed
    // metal colors, so it was the one prop that ignored blue/red identity.
    // sword.svg's own comment splits it -- hardware recolors, blade preserved.
    const scene = new Group();
    const hardware = new MeshStandardMaterial({ color: 0x504b50 });
    hardware.name = "TKA_Sword_Hardware_Recolor";
    const wick = new MeshStandardMaterial({ color: 0xd17d0a });
    wick.name = "TKA_Sword_Wick";
    const hilt = new Mesh(new BoxGeometry(), hardware);
    const blade = new Mesh(new BoxGeometry(), wick);
    scene.add(hilt, blade);

    recolorPropModel(scene, "red");

    expect(hilt.material).not.toBe(hardware);
    expect((hilt.material as MeshStandardMaterial).color.getHex()).not.toBe(
      hardware.color.getHex()
    );
    // Polished steel would survive the recolor as metal; the shared path
    // forces a matte finish so the prop color actually reads.
    expect((hilt.material as MeshStandardMaterial).metalness).toBe(0);
    expect(blade.material).toBe(wick);
    expect((blade.material as MeshStandardMaterial).color.getHex()).toBe(
      0xd17d0a
    );
  });
});

describe("Guitar GLB registry", () => {
  it("resolves Guitar and reuses the model at Ukulele scale", () => {
    const guitar = resolvePropModel(PropType.GUITAR);
    const ukulele = resolvePropModel(PropType.UKULELE);

    expect(guitar).toMatchObject({
      entry: {
        modelUrl: "/models/props/guitar.glb",
        scale: 1,
        gripOffsetY: 0,
      },
      scale: 1,
    });
    expect(ukulele).toMatchObject({
      entry: {
        modelUrl: "/models/props/guitar.glb",
        scale: 1,
        gripOffsetY: 0,
      },
      scale: 0.75,
    });
  });
});

describe("Trigeng GLB registry", () => {
  it("resolves Trigeng to its own production model", () => {
    expect(resolvePropModel(PropType.TRIGENG)).toMatchObject({
      entry: {
        modelUrl: "/models/props/trigeng.glb",
        scale: 1,
        gripOffsetY: 0,
      },
      scale: 1,
    });
  });
});

describe("Double Contact Ball GLB registry", () => {
  it("resolves the pair to its own model and reuses it at big scale", () => {
    const standard = resolvePropModel(PropType.DOUBLECONTACTBALL);
    const big = resolvePropModel(PropType.BIGDOUBLECONTACTBALL);

    expect(standard).toMatchObject({
      entry: {
        modelUrl: "/models/props/double-contact-ball.glb",
        scale: 1,
        gripOffsetY: 0,
      },
      scale: 1,
    });
    expect(big).toMatchObject({
      entry: {
        modelUrl: "/models/props/double-contact-ball.glb",
        scale: 1,
        gripOffsetY: 0,
      },
      scale: 1.4,
    });
  });
});
