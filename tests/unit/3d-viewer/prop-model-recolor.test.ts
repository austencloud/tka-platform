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
import { resolvePropModel } from "../../../node_modules/@austencloud/scene-3d/src/lib/components/props/prop-model-registry";

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
  it("resolves Chicken and Big Chicken to the production model", () => {
    const chicken = resolvePropModel(PropType.CHICKEN);
    const bigChicken = resolvePropModel(PropType.BIGCHICKEN);

    expect(chicken).toMatchObject({
      entry: {
        modelUrl: "/models/props/chicken.glb",
        scale: 1,
        gripOffsetY: 0,
      },
      scale: 1,
    });
    expect(bigChicken).toMatchObject({
      entry: {
        modelUrl: "/models/props/chicken.glb",
        scale: 1,
        gripOffsetY: 0,
      },
      scale: 1.4,
    });
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
