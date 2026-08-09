/**
 * Terrain + layout invariants for the Drowned Gallery route ("Three Channels").
 *
 * The coupling invariants from the design spec live here: one geometry source,
 * every walkable tile inside a rendered floor, no wall over a door, performer
 * anchors identical to layout anchors, bells that never share a sightline, and
 * a loud failure instead of a silent datum-0 when the layout and the walkable
 * grid disagree.
 */
import { describe, it, expect } from "vitest";
import { buildVulcanCaveFloorPlan } from "$lib/features/museum/data/vulcan-cave-floor-plan";
import {
  buildDrownedGalleryLayout,
  createDrownedGalleryTerrain,
  inRectClosed,
  segmentCrossesRects,
  bellViewingSamples,
  bellFloorSightlineMargin,
  type WorldRect,
  ALCOVE_X_FRACTIONS,
  tileCentredOffset,
  BELL_FLOOR_Y,
  BELL_CEILING_Y,
  CAUSEWAY_Y,
  EYE_ABOVE_FLOOR,
  GALLERY_FLOOR_Y,
  GALLERY_ROOF_Y,
  LANDING_Y,
  ROOF_HEADROOM,
  SHELF_Y,
  TILE_METRES,
  WATERLINE_Y,
} from "$lib/features/museum/data/drowned-gallery-terrain";
import { SOLID_TYPES } from "$lib/features/museum/services/museum-physics-provider";
import { tileKey } from "$lib/features/museum/domain/museum-grid-types";

const TILE = TILE_METRES;

const plan = buildVulcanCaveFloorPlan();
const grid = plan.grid;
const terrain = createDrownedGalleryTerrain(grid)!;
const layout = buildDrownedGalleryLayout(grid)!;

const wing = (id: string) => grid.wings.find((w) => w.id === id)!.bounds;
const centre = (b: { x: number; y: number; width: number; height: number }) => ({
  x: (b.x + b.width / 2) * TILE,
  z: (b.y + b.height / 2) * TILE,
});

/** Every tile whose world position lies inside the water bay. */
function bayTiles(): { tx: number; ty: number; x: number; z: number }[] {
  const out: { tx: number; ty: number; x: number; z: number }[] = [];
  for (const key of grid.tiles.keys()) {
    const [tx, ty] = key.split(",").map(Number);
    const x = tx! * TILE;
    const z = ty! * TILE;
    if (!inRectClosed(layout.bayBounds, x, z)) continue;
    out.push({ tx: tx!, ty: ty!, x, z });
  }
  return out;
}

function isWalkable(tx: number, ty: number): boolean {
  const tile = grid.tiles.get(tileKey(tx, ty));
  if (!tile || SOLID_TYPES.has(tile.type)) return false;
  return !terrain.blockedAt(tx * TILE, ty * TILE);
}

const walkableBayTiles = bayTiles().filter((t) => isWalkable(t.tx, t.ty));

describe("drowned gallery terrain", () => {
  it("exists for the cave plan and reports the waterline", () => {
    expect(terrain).toBeTruthy();
    expect(terrain.waterlineY).toBe(WATERLINE_Y);
  });

  it("keeps the museum datum outside the water bay", () => {
    const squeeze = centre(wing("cave-squeeze"));
    expect(terrain.elevationAt(squeeze.x, squeeze.z)).toBe(0);
  });

  it("descends monotonically through the approach (north = deeper)", () => {
    const a = layout.approach;
    const x = (a.minX + a.maxX) / 2;
    let prev = terrain.elevationAt(x, a.maxZ);
    expect(prev).toBeCloseTo(0, 5);
    for (let step = 1; step <= 8; step++) {
      const z = a.maxZ + (a.minZ - a.maxZ) * (step / 8);
      const e = terrain.elevationAt(x, z);
      expect(e).toBeLessThanOrEqual(prev + 1e-9);
      prev = e;
    }
    expect(prev).toBeLessThan(WATERLINE_Y);
  });

  it("puts the hub and every channel leg on the gallery floor, under a roof below the waterline", () => {
    const flats = [
      layout.hub,
      layout.returnLeg,
      ...layout.channels.flatMap((chan) => chan.legs),
      layout.shaftPassageLeg,
      layout.shaftPassageJog,
    ];
    for (const rect of flats) {
      const x = (rect.minX + rect.maxX) / 2;
      const z = (rect.minZ + rect.maxZ) / 2;
      expect(terrain.elevationAt(x, z)).toBeCloseTo(GALLERY_FLOOR_Y, 5);
    }
    expect(GALLERY_ROOF_Y).toBeLessThan(WATERLINE_Y);
    // and the roof always clears the walker's head
    for (const rect of layout.roofRects) {
      const x = (rect.minX + rect.maxX) / 2;
      for (const z of [rect.minZ + 0.05, (rect.minZ + rect.maxZ) / 2, rect.maxZ - 0.05]) {
        expect(GALLERY_ROOF_Y - terrain.elevationAt(x, z)).toBeGreaterThanOrEqual(
          ROOF_HEADROOM - 1e-6
        );
      }
    }
  });

  it("orders the three channel runs A < B < C at roughly 6 / 9 / 12 m", () => {
    const [a, b, c] = layout.channels;
    expect(a!.runMetres).toBeLessThan(b!.runMetres);
    expect(b!.runMetres).toBeLessThan(c!.runMetres);
    expect(a!.runMetres).toBeGreaterThanOrEqual(4.5);
    expect(a!.runMetres).toBeLessThanOrEqual(8);
    expect(b!.runMetres).toBeGreaterThanOrEqual(7.5);
    expect(b!.runMetres).toBeLessThanOrEqual(11);
    expect(c!.runMetres).toBeGreaterThanOrEqual(10.5);
    expect(c!.runMetres).toBeLessThanOrEqual(14.5);
  });

  it("breaks the surface on each bell's stair (first breath) and keeps the deck dry", () => {
    for (const chan of layout.channels) {
      const breath = chan.breathPoint;
      const elevation = terrain.elevationAt(breath.x, breath.z);
      expect(elevation).toBeCloseTo(LANDING_Y, 1);
      expect(elevation + EYE_ABOVE_FLOOR).toBeCloseTo(WATERLINE_Y, 1);
      const deck = layout.probes.bellDecks[chan.id];
      const deckElevation = terrain.elevationAt(deck.x, deck.z);
      expect(deckElevation).toBeCloseTo(BELL_FLOOR_Y, 5);
      // dry deck: the floor itself sits above the waterline
      expect(deckElevation).toBeGreaterThan(WATERLINE_Y);
      // held, not vaulted: ~3 m of air over the deck, air above the waterline
      expect(BELL_CEILING_Y - deckElevation).toBeGreaterThanOrEqual(2.9);
      expect(BELL_CEILING_Y).toBeGreaterThan(WATERLINE_Y);
      expect(terrain.blockedAt(deck.x, deck.z)).toBe(false);
    }
  });

  it("blocks each bell's water margin and performer shelf", () => {
    for (const chan of layout.channels) {
      const margin = chan.bell.margin;
      const shelf = chan.bell.shelf;
      expect(
        terrain.blockedAt((margin.minX + margin.maxX) / 2, (margin.minZ + margin.maxZ) / 2)
      ).toBe(true);
      expect(
        terrain.blockedAt((shelf.minX + shelf.maxX) / 2, (shelf.minZ + shelf.maxZ) / 2)
      ).toBe(true);
    }
  });

  it("keeps every pair of bells out of each other's sightlines (rock between)", () => {
    for (const from of layout.channels) {
      for (const to of layout.channels) {
        if (from.id === to.id) continue;
        const viewer = layout.probes.bellDecks[from.id];
        const performer = to.bell.shelfAnchor;
        expect(
          segmentCrossesRects(viewer, performer, layout.rockFill),
          `bell ${from.id} deck can see bell ${to.id} performer`
        ).toBe(true);
      }
    }
  });

  it("gives every bell a clear moving sightline window onto its own performer floor", () => {
    for (const chan of layout.channels) {
      const samples = bellViewingSamples(chan);
      for (const sample of samples) {
        expect(
          segmentCrossesRects(sample, chan.bell.shelfAnchor, layout.rockFill),
          `bell ${chan.id} sightline at fraction ${sample.fraction} crosses rock`
        ).toBe(false);
        const margin = bellFloorSightlineMargin(chan, sample);
        expect(
          margin,
          `bell ${chan.id} floor sightline at fraction ${sample.fraction}`
        ).toBeGreaterThan(0);
      }
      // close-read intimacy: deck centre to performer within 2.5–4.5 m
      const deck = layout.probes.bellDecks[chan.id];
      const d = Math.hypot(
        deck.x - chan.bell.shelfAnchor.x,
        deck.z - chan.bell.shelfAnchor.z
      );
      expect(d).toBeGreaterThanOrEqual(2.2);
      expect(d).toBeLessThanOrEqual(4.5);
    }
  });

  it("runs the drowned passage and the buoyant shaft at gallery depth into the apron", () => {
    const shaft = layout.probes.shaftBottom;
    expect(terrain.elevationAt(shaft.x, shaft.z)).toBeCloseTo(GALLERY_FLOOR_Y, 5);
    expect(terrain.blockedAt(shaft.x, shaft.z)).toBe(false);
    // the column footprint sits inside the grotto apron band
    expect(inRectClosed(layout.apron, shaft.x, shaft.z)).toBe(true);
    // the walkable apron surrounds the hole at causeway height
    const apron = layout.probes.apron;
    expect(terrain.elevationAt(apron.x, apron.z)).toBeCloseTo(CAUSEWAY_Y, 5);
    // and no apron piece covers the column (one 2-D height per point)
    for (const piece of layout.apronPieces) {
      expect(inRectClosed(piece, shaft.x, shaft.z)).toBe(false);
    }
  });

  it("runs the ring at causeway height and blocks the water and the shore", () => {
    for (const probe of [
      layout.probes.apron,
      layout.probes.procession,
      layout.probes.westWalkway,
      layout.probes.eastWalkway,
      layout.probes.thresholdOpening,
    ]) {
      expect(terrain.elevationAt(probe.x, probe.z)).toBeCloseTo(CAUSEWAY_Y, 5);
      expect(terrain.blockedAt(probe.x, probe.z)).toBe(false);
    }
    for (const probe of [
      layout.probes.pool,
      layout.probes.channel,
      layout.probes.shore,
      layout.probes.rock,
    ]) {
      expect(terrain.blockedAt(probe.x, probe.z)).toBe(true);
    }
  });

  it("blocks the pool, channel and shore at 0.25 m intervals along their walkway edges", () => {
    const PROBE = 0.25;
    const edges: [string, WorldRect, "north" | "south" | "west" | "east"][] = [
      ["pool", layout.pool, "north"],
      ["pool", layout.pool, "south"],
      ["pool", layout.pool, "west"],
      ["pool", layout.pool, "east"],
      ["channel", layout.channel, "south"],
      ["channel", layout.channel, "west"],
      ["channel", layout.channel, "east"],
      ["shore", layout.shore, "south"],
    ];
    for (const [name, rect, side] of edges) {
      const horizontal = side === "north" || side === "south";
      const from = horizontal ? rect.minX : rect.minZ;
      const to = horizontal ? rect.maxX : rect.maxZ;
      for (let v = from + PROBE; v < to - PROBE; v += PROBE) {
        const inside =
          side === "north"
            ? { x: v, z: rect.minZ + 0.05 }
            : side === "south"
              ? { x: v, z: rect.maxZ - 0.05 }
              : side === "west"
                ? { x: rect.minX + 0.05, z: v }
                : { x: rect.maxX - 0.05, z: v };
        const outside =
          side === "north"
            ? { x: v, z: rect.minZ - 0.15 }
            : side === "south"
              ? { x: v, z: rect.maxZ + 0.15 }
              : side === "west"
                ? { x: rect.minX - 0.15, z: v }
                : { x: rect.maxX + 0.15, z: v };
        expect(
          terrain.blockedAt(inside.x, inside.z),
          `${name} ${side} inside (${inside.x.toFixed(2)}, ${inside.z.toFixed(2)})`
        ).toBe(true);
        // The far side of a water edge is a walkway unless it is another
        // blocked band (the shore's south edge faces the channel).
        if (name === "shore") continue;
        if (terrain.blockedAt(outside.x, outside.z)) {
          // Legitimately blocked neighbours: another water band, or the carved
          // threshold's jambs standing on the east walkway.
          const accountedFor = [
            layout.shore,
            layout.channel,
            layout.pool,
            ...layout.thresholdJambs,
          ].some((r) => inRectClosed(r, outside.x, outside.z));
          expect(
            accountedFor,
            `${name} ${side} outside (${outside.x.toFixed(2)}, ${outside.z.toFixed(2)}) is blocked but is neither water nor a threshold jamb`
          ).toBe(true);
        }
      }
    }
  });

  it("keeps the three ring niches on the north shore at the shared fractions", () => {
    expect(layout.alcoves).toHaveLength(3);
    const width = layout.grotto.maxX - layout.grotto.minX;
    layout.alcoves.forEach((alcove, i) => {
      // Snapped to a tile centre so a finale restaging can land on it exactly.
      expect(alcove.x).toBeCloseTo(
        layout.grotto.minX + tileCentredOffset(width * ALCOVE_X_FRACTIONS[i]!),
        5
      );
      expect(Math.abs(alcove.x / TILE - Math.round(alcove.x / TILE))).toBeLessThan(1e-9);
      expect(alcove.z).toBeLessThan(layout.shore.maxZ);
      expect(alcove.z).toBeGreaterThan(layout.shore.minZ);
    });
  });

  it("stages each performer alone on exactly its bell's shelf anchor", () => {
    const performers = grid.performers
      .filter((p) => p.id.startsWith("cave-water-"))
      .sort((a, b) => a.id.localeCompare(b.id));
    expect(performers.map((p) => p.id)).toEqual([
      "cave-water-a",
      "cave-water-b",
      "cave-water-c",
    ]);
    performers.forEach((performer, i) => {
      const chan = layout.channels[i]!;
      const anchor = chan.bell.shelfAnchor;
      expect(Math.abs(performer.tileX * TILE - anchor.x)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(performer.tileY * TILE - anchor.z)).toBeLessThanOrEqual(0.05);
      expect(performer.elevation).toBe(SHELF_Y);
      // one performer per bell, and it stands inside that bell's shelf
      expect(
        inRectClosed(chan.bell.shelf, performer.tileX * TILE, performer.tileY * TILE)
      ).toBe(true);
    });
  });

  it("frames the Fire exit without blocking it", () => {
    expect(
      layout.thresholdOpening.maxX - layout.thresholdOpening.minX
    ).toBeGreaterThanOrEqual(2.2);
    for (const jamb of layout.thresholdJambs) {
      expect(
        terrain.blockedAt((jamb.minX + jamb.maxX) / 2, (jamb.minZ + jamb.maxZ) / 2)
      ).toBe(true);
    }
    expect(
      terrain.blockedAt(
        layout.probes.thresholdOpening.x,
        layout.probes.thresholdOpening.z
      )
    ).toBe(false);
  });

  it("covers every walkable water-bay tile with a rendered floor rect", () => {
    expect(walkableBayTiles.length).toBeGreaterThan(1000);
    const uncovered = walkableBayTiles.filter(
      (t) => !layout.floorRects.some((f) => inRectClosed(f.rect, t.x, t.z))
    );
    expect(
      uncovered.slice(0, 10).map((t) => `${t.x},${t.z}`),
      `${uncovered.length} walkable tiles have no rendered floor under them`
    ).toEqual([]);
  });

  it("never steps more than 0.6 m between neighbouring walkable tiles, except across the shaft rim", () => {
    const walkable = new Set(walkableBayTiles.map((t) => `${t.tx},${t.ty}`));
    const shaft = layout.buoyantShaft;
    const inShaft = (x: number, z: number) => inRectClosed(shaft, x, z);
    const offenders: string[] = [];
    let rimCrossings = 0;
    for (const tile of walkableBayTiles) {
      const here = terrain.elevationAt(tile.x, tile.z);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = tile.tx + dx;
        const ny = tile.ty + dy;
        if (!walkable.has(`${nx},${ny}`)) continue;
        const there = terrain.elevationAt(nx * TILE, ny * TILE);
        if (Math.abs(there - here) > 0.6) {
          // The buoyant shaft's rim is the one designed cliff: the column drops
          // to gallery depth beside the apron, and falling in is safe water
          // (design open question 4; the Gate 2 gravity seam floats the player).
          if (inShaft(tile.x, tile.z) !== inShaft(nx * TILE, ny * TILE)) {
            rimCrossings++;
            continue;
          }
          offenders.push(
            `(${tile.x},${tile.z})=${here.toFixed(2)} -> (${nx * TILE},${ny * TILE})=${there.toFixed(2)}`
          );
        }
      }
    }
    expect(offenders.slice(0, 6)).toEqual([]);
    // the rim exists — the shaft really is a hole in the apron
    expect(rimCrossings).toBeGreaterThan(0);
  });

  it("leaves every door tile clear of every rendered wall", () => {
    const doors: { id: string; rect: WorldRect }[] = [];
    for (const roomId of ["cave-water-approach", "cave-water-gallery", "cave-water"]) {
      const b = wing(roomId);
      for (let tx = b.x; tx < b.x + b.width; tx++) {
        for (const ty of [b.y, b.y + b.height - 1]) {
          if (grid.tiles.get(tileKey(tx, ty))?.type !== "door") continue;
          doors.push({
            id: `${roomId}:${tx},${ty}`,
            // A tile occupies the cell CENTRED on its world position — the
            // same convention the physics provider's Math.round lookup uses.
            rect: {
              minX: tx * TILE - TILE / 2,
              maxX: tx * TILE + TILE / 2,
              minZ: ty * TILE - TILE / 2,
              maxZ: ty * TILE + TILE / 2,
            },
          });
        }
      }
      for (let ty = b.y; ty < b.y + b.height; ty++) {
        for (const tx of [b.x, b.x + b.width - 1]) {
          if (grid.tiles.get(tileKey(tx, ty))?.type !== "door") continue;
          doors.push({
            id: `${roomId}:${tx},${ty}`,
            rect: {
              minX: tx * TILE - TILE / 2,
              maxX: tx * TILE + TILE / 2,
              minZ: ty * TILE - TILE / 2,
              maxZ: ty * TILE + TILE / 2,
            },
          });
        }
      }
    }
    expect(doors.length).toBeGreaterThanOrEqual(10);

    const EPS = 1e-6;
    const clashes: string[] = [];
    for (const door of doors) {
      for (const wall of layout.wallRects) {
        const overlaps =
          wall.rect.minX < door.rect.maxX - EPS &&
          wall.rect.maxX > door.rect.minX + EPS &&
          wall.rect.minZ < door.rect.maxZ - EPS &&
          wall.rect.maxZ > door.rect.minZ + EPS;
        if (overlaps) clashes.push(`${wall.id} over door ${door.id}`);
      }
    }
    expect(clashes.slice(0, 6)).toEqual([]);
  });

  it("throws instead of silently dropping to the datum inside the bay", () => {
    const rock = layout.probes.rock;
    expect(inRectClosed(layout.bayBounds, rock.x, rock.z)).toBe(true);
    expect(() => terrain.elevationAt(rock.x, rock.z)).toThrow(/no elevation zone/);
  });
});
