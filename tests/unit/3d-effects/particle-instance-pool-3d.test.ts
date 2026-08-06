import { describe, expect, it } from "vitest";
import { Object3D, PlaneGeometry } from "three";
import { ParticleInstancePool3D } from "$lib/shared/3d/effects/instancing/particle-instance-pool-3d";

describe("ParticleInstancePool3D", () => {
  it("packs visible particles into stable instance attributes", () => {
    const parent = new Object3D();
    const pool = new ParticleInstancePool3D({
      capacity: 2,
      geometry: new PlaneGeometry(1, 1),
    });
    pool.initialize(parent);

    pool.beginFrame();
    expect(
      pool.write({
        x: 1,
        y: 2,
        z: 3,
        scaleX: 4,
        scaleY: 5,
        scaleZ: 6,
        red: 0.25,
        green: 0.5,
        blue: 0.75,
        alpha: 0.8,
      })
    ).toBe(true);
    pool.commit();

    expect(pool.mesh.count).toBe(1);
    expect(parent.children).toContain(pool.mesh);
    expect(
      Array.from(pool.mesh.geometry.getAttribute("aCenter").array).slice(0, 3)
    ).toEqual([1, 2, 3]);
    expect(
      Array.from(pool.mesh.geometry.getAttribute("aScale").array).slice(0, 3)
    ).toEqual([4, 5, 6]);
    expect(
      Array.from(pool.mesh.geometry.getAttribute("aColor").array).slice(0, 3)
    ).toEqual([0.25, 0.5, 0.75]);
    expect(pool.mesh.geometry.getAttribute("aAlpha").getX(0)).toBeCloseTo(0.8);
    expect(pool.mesh.geometry.getAttribute("aCenter").updateRanges).toEqual([
      { start: 0, count: 3 },
    ]);
  });

  it("refuses writes beyond capacity and disposes its scene object", () => {
    const parent = new Object3D();
    const pool = new ParticleInstancePool3D({
      capacity: 1,
      geometry: new PlaneGeometry(1, 1),
      billboard: true,
    });
    pool.initialize(parent);
    const particle = {
      x: 0,
      y: 0,
      z: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
      red: 1,
      green: 1,
      blue: 1,
      alpha: 1,
    };

    pool.beginFrame();
    expect(pool.write(particle)).toBe(true);
    expect(pool.write(particle)).toBe(false);
    pool.commit();
    expect(pool.mesh.count).toBe(1);

    pool.dispose();
    expect(parent.children).not.toContain(pool.mesh);
  });

  it("does not upload instance attributes for an empty material variant", () => {
    const pool = new ParticleInstancePool3D({
      capacity: 8,
      geometry: new PlaneGeometry(1, 1),
    });
    const center = pool.mesh.geometry.getAttribute("aCenter");
    const initialVersion = center.version;
    pool.beginFrame();
    pool.commit();
    expect(center.version).toBe(initialVersion);
    expect(pool.mesh.count).toBe(0);
  });
});
