// ocean-terrain-sampler.cjs
//
// Samples the baked ocean floor. The height function itself lives in
// scripts/ocean_terrain_profile.py and is baked by export-ocean-heightmap.py;
// this only interpolates. Keeping one implementation of the world's shape is
// the point -- a JS port would drift the first time the shelf is retuned, and
// the failure mode is silent (every object floating or buried).
//
// Coordinates are Blender's: x/y horizontal, z up, seabed top at z = 0, water
// plane at z = +12. The generator works in this space and the export applies
// Z-up -> Y-up at the end, exactly as the terrain build does.
//
// Design: docs/superpowers/specs/active/2026-08-09-ocean-composition-matrix-design.md

const path = require("path");
const fs = require("fs");

const HEIGHTMAP = path.join(__dirname, "ocean-terrain-heightmap.json");

// Slope past this reads as exposed rock: nothing soft stays on it, and the
// sand texture stretches visibly. Below it the shelf holds sediment.
const ROCK_SLOPE_DEGREES = 35;
// How far above the local mean counts as raised reef rather than flat sand.
const REEF_RELIEF_METRES = 0.12;
// Radius over which "local" is measured for that comparison. Wide enough to
// straddle the shelf relief's shortest wavelength, narrow enough that a single
// bommie still reads as raised.
const LOCAL_MEAN_RADIUS = 3.0;

function loadHeightmap(file = HEIGHTMAP) {
  if (!fs.existsSync(file)) {
    throw new Error(
      `Missing ${file}. Run: python scripts/export-ocean-heightmap.py`
    );
  }
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function createTerrainSampler(options = {}) {
  const map = options.heightmap || loadHeightmap(options.file);
  const { resolution, extent, step, heights } = map;

  if (heights.length !== resolution * resolution) {
    throw new Error(
      `Heightmap claims ${resolution}x${resolution} but holds ${heights.length} samples`
    );
  }

  /**
   * Refuses to run against a bake made from different terrain constants.
   * A stale heightmap does not throw on its own -- it quietly reports the old
   * world's elevations, and every placement lands wrong.
   */
  function assertProfile(expected) {
    for (const [key, value] of Object.entries(expected)) {
      if (map.profile[key] !== value) {
        throw new Error(
          `Stale heightmap: ${key} baked as ${map.profile[key]}, profile now ${value}. ` +
            `Re-run: python scripts/export-ocean-heightmap.py`
        );
      }
    }
  }

  function gridValue(column, row) {
    const c = Math.min(resolution - 1, Math.max(0, column));
    const r = Math.min(resolution - 1, Math.max(0, row));
    return heights[r * resolution + c];
  }

  /** Bilinear. Outside the baked square the edge value is held. */
  function heightAt(x, y) {
    const fx = (x + extent) / step;
    const fy = (y + extent) / step;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;

    const h00 = gridValue(x0, y0);
    const h10 = gridValue(x0 + 1, y0);
    const h01 = gridValue(x0, y0 + 1);
    const h11 = gridValue(x0 + 1, y0 + 1);

    const top = h00 + (h10 - h00) * tx;
    const bottom = h01 + (h11 - h01) * tx;
    return top + (bottom - top) * ty;
  }

  /**
   * Surface normal and slope, by central difference over one grid step. Using
   * the grid step rather than an arbitrary epsilon means the gradient reflects
   * the surface the mesh actually has, not the interpolation between samples.
   */
  function gradientAt(x, y) {
    const dzdx = (heightAt(x + step, y) - heightAt(x - step, y)) / (2 * step);
    const dzdy = (heightAt(x, y + step) - heightAt(x, y - step)) / (2 * step);
    const length = Math.hypot(dzdx, dzdy, 1);
    return {
      normal: [-dzdx / length, -dzdy / length, 1 / length],
      slopeDegrees: (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI,
    };
  }

  function localMean(x, y) {
    const r = LOCAL_MEAN_RADIUS;
    return (
      (heightAt(x + r, y) + heightAt(x - r, y) + heightAt(x, y + r) + heightAt(x, y - r)) / 4
    );
  }

  /**
   * Substrate is derived from the shape of the ground, never painted. That way
   * retuning the terrain moves the substrate with it and the two cannot
   * disagree.
   */
  function substrateAt(x, y, height, slopeDegrees) {
    if (slopeDegrees > ROCK_SLOPE_DEGREES) return "rock";
    if (Math.hypot(x, y) <= map.profile.CLEARING_RADIUS) return "sand";
    if (height > localMean(x, y) + REEF_RELIEF_METRES) return "reef";
    return "sand";
  }

  function sample(x, y) {
    const height = heightAt(x, y);
    const { normal, slopeDegrees } = gradientAt(x, y);
    return {
      height,
      normal,
      slopeDegrees,
      substrate: substrateAt(x, y, height, slopeDegrees),
      // Metres below the water plane. Ecology rules are written in depth
      // because that is how the biology is documented, not in world z.
      depth: map.profile.WATER_PLANE_Z - height,
    };
  }

  return {
    sample,
    heightAt,
    gradientAt,
    assertProfile,
    profile: map.profile,
    resolution,
    extent,
    step,
    ROCK_SLOPE_DEGREES,
    REEF_RELIEF_METRES,
  };
}

module.exports = { createTerrainSampler, loadHeightmap, HEIGHTMAP };
