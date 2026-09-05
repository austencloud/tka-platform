/**
 * The parked-car catalog: measured bodies, their paint seams and attribution.
 *
 * Pure data with no three.js import so the car driving model in
 * `src/lib/features/flow-fest-sim/domain/flow-fest-car.ts` can read the
 * measured wheel contacts. The instancer in `flow-fest-parked-cars.ts`
 * re-exports everything here.
 */

/**
 * The parked-car lineup for the lower campground. Each catalogue body is
 * instanced across every stall it was assigned, so the field reads as one
 * fleet rather than a handful of identical cars.
 *
 * The footprint drives the walk-up collider and the stall arithmetic; the
 * rendered body is normalised to `lengthMeters` when its GLB loads, so an
 * export at an arbitrary unit scale still parks inside its stall.
 * `sourceYawRadians` turns the export so its nose points along local +X, the
 * convention every placement rotation assumes.
 *
 * `paint` lets one body wear several colours across the lot. The named
 * materials are the painted panels; every other material (glass, chrome,
 * tyres, interior) is left alone. In `recolor` mode the panel albedo map is
 * dropped and the per-instance colour becomes the paint, which keeps the
 * normal, roughness and metalness maps so the panel still reads as painted
 * steel. `tint` mode keeps the albedo and multiplies it, which only works
 * when the source paint is pale.
 */
export interface FlowFestParkedCarPaint {
  materialNames: readonly string[];
  variants: readonly string[];
  mode: "recolor" | "tint";
}

export interface FlowFestParkedCarAttribution {
  title: string;
  author: string;
  url: string;
  license: string;
}

/**
 * Where the tyres actually touch, in body metres after the GLB is normalised
 * to `lengthMeters`. `+along` is the nose, and the two axles are measured
 * separately because a body's wheels are not centred on its bounding box: an
 * '80 sedan carries more overhang behind the rear axle than ahead of the front
 * one. Grounding a car on its bounding box instead of these patches sampled
 * the field a metre past each bumper, so a body bridging a hollow hovered on
 * its own wheels.
 *
 * Measured from the shipped GLBs by clustering the lowest 4 cm of tyre
 * geometry into four corners; `tests/unit/flow-fest-parked-cars.test.ts`
 * guards the values that grounding depends on.
 */
export interface FlowFestParkedCarWheelContacts {
  frontAlongMeters: number;
  rearAlongMeters: number;
  halfTrackMeters: number;
}

export interface FlowFestParkedCarModel {
  id: string;
  label: string;
  url: string;
  lengthMeters: number;
  widthMeters: number;
  heightMeters: number;
  sourceYawRadians: number;
  wheels: FlowFestParkedCarWheelContacts;
  paint?: FlowFestParkedCarPaint;
  attribution?: FlowFestParkedCarAttribution;
}

const ZHABOTINSKY = {
  author: "Daniel Zhabotinsky",
  license: "CC BY 4.0",
} as const;

/**
 * Five generic bodies by one artist so the lot reads as one style, plus a
 * classic camper. All CC Attribution; credits are repeated in
 * `static/models/flow-fest/cars/CREDITS.md`. Dimensions are the measured
 * source bounds in metres (length x width x height).
 */
export const FLOW_FEST_PARKED_CAR_MODELS: readonly FlowFestParkedCarModel[] =
  Object.freeze([
    {
      id: "fairheaven-sedan",
      label: "'80 sedan",
      url: "/models/flow-fest/cars/fairheaven-sedan.glb",
      lengthMeters: 5.0,
      widthMeters: 1.83,
      heightMeters: 1.35,
      sourceYawRadians: 0,
      wheels: {
        frontAlongMeters: 1.433,
        rearAlongMeters: -1.218,
        halfTrackMeters: 0.749,
      },
      paint: {
        materialNames: ["Fairheaven_LT80_Bodymat"],
        variants: ["#641c26", "#c9c5bb", "#2c3d5e", "#8a8f93"],
        mode: "recolor",
      },
      attribution: {
        ...ZHABOTINSKY,
        title: "Fairheaven LT '80",
        url: "https://sketchfab.com/3d-models/e2678da920cc4be68dbc193727919ffb",
      },
    },
    {
      id: "fairheaven-wagon",
      label: "'84 wagon",
      url: "/models/flow-fest/cars/fairheaven-wagon.glb",
      lengthMeters: 5.03,
      widthMeters: 1.86,
      heightMeters: 1.4,
      sourceYawRadians: 0,
      wheels: {
        frontAlongMeters: 1.443,
        rearAlongMeters: -1.21,
        halfTrackMeters: 0.749,
      },
      paint: {
        materialNames: ["Fairheaven_LT80_Bodymat"],
        variants: ["#33505a", "#d8d3c4", "#4a5a2f", "#1f2530"],
        mode: "recolor",
      },
      attribution: {
        ...ZHABOTINSKY,
        title: "Fairheaven SW '84",
        url: "https://sketchfab.com/3d-models/aa0becb6e854422596cac6b21bf79787",
      },
    },
    {
      id: "lightbody-pickup",
      label: "lifted '85 pickup",
      url: "/models/flow-fest/cars/lightbody-pickup.glb",
      lengthMeters: 4.93,
      widthMeters: 2.14,
      heightMeters: 1.92,
      sourceYawRadians: 0,
      wheels: {
        frontAlongMeters: 1.587,
        rearAlongMeters: -1.316,
        halfTrackMeters: 0.781,
      },
      paint: {
        materialNames: ["krmlgtbdy85_Bodymat"],
        variants: ["#14121f", "#b7b2a8", "#7a1e1e", "#3b4a3a"],
        mode: "recolor",
      },
      attribution: {
        ...ZHABOTINSKY,
        title: "Lightbody Lifted '85",
        url: "https://sketchfab.com/3d-models/67beae18c3d24be68f9c8f0ec382d8e3",
      },
    },
    {
      id: "bokaroo-suv",
      label: "'67 SUV",
      url: "/models/flow-fest/cars/bokaroo-suv.glb",
      lengthMeters: 4.59,
      widthMeters: 2.21,
      heightMeters: 1.96,
      sourceYawRadians: 0,
      wheels: {
        frontAlongMeters: 1.425,
        rearAlongMeters: -1.189,
        halfTrackMeters: 0.794,
      },
      paint: {
        materialNames: ["BUCKAROO_67_Bodymat"],
        variants: ["#348bb0", "#e6e1d3", "#b8482c", "#6f7a52"],
        mode: "recolor",
      },
      attribution: {
        ...ZHABOTINSKY,
        title: "Bokaroo '67",
        url: "https://sketchfab.com/3d-models/22015d1863d6455aa31cfd738b972c50",
      },
    },
    {
      id: "ace-hatchback",
      label: "'11 hatchback",
      url: "/models/flow-fest/cars/ace-hatchback.glb",
      lengthMeters: 3.84,
      widthMeters: 1.83,
      heightMeters: 1.45,
      sourceYawRadians: 0,
      wheels: {
        frontAlongMeters: 1.101,
        rearAlongMeters: -1.302,
        halfTrackMeters: 0.721,
      },
      paint: {
        materialNames: ["Ace11_Bodymat"],
        variants: ["#cf9a24", "#e8e6e1", "#1e2a44", "#a13a3a"],
        mode: "recolor",
      },
      attribution: {
        ...ZHABOTINSKY,
        title: "Ace '11",
        url: "https://sketchfab.com/3d-models/055ff8a21b8d4d279debca089e2fafcd",
      },
    },
    {
      id: "t2-camper",
      label: "classic campervan",
      url: "/models/flow-fest/cars/t2-camper.glb",
      lengthMeters: 4.28,
      widthMeters: 1.97,
      heightMeters: 1.93,
      sourceYawRadians: Math.PI / 2,
      wheels: {
        frontAlongMeters: 1.132,
        rearAlongMeters: -1.247,
        halfTrackMeters: 0.706,
      },
      attribution: {
        title: "Volkswagen T2 Campervan",
        author: "TheoClarke",
        license: "CC BY 4.0",
        url: "https://sketchfab.com/3d-models/96ec638bcdbd44a08be3197d9dece5d5",
      },
    },
  ]);

export function flowFestParkedCarModel(id: string): FlowFestParkedCarModel {
  const model = FLOW_FEST_PARKED_CAR_MODELS.find((entry) => entry.id === id);
  if (!model) throw new Error(`Unknown Flow Fest parked-car model "${id}"`);
  return model;
}

/** How many paint variants a body offers; a body without a paint seam has one. */
export function flowFestParkedCarPaintCount(
  model: Pick<FlowFestParkedCarModel, "paint">
): number {
  return Math.max(1, model.paint?.variants.length ?? 1);
}
