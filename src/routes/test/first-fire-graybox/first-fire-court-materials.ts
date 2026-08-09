/**
 * Runtime material identity for The Cinder Court.
 *
 * The Gate 2 GLB is digest-locked evidence, so nothing here writes to it. This
 * re-materialises the loaded scene graph in memory, keyed off the mesh names
 * the Blender contract already guarantees (FF_Court_*, FF_PerformerPad_*,
 * FF_Trench_*, FF_Basalt_*).
 *
 * glTF shares one material instance across every mesh that references it, so
 * FF_Court_dj and FF_Court_fl arrive pointing at the SAME "FF Court Stone".
 * Every assignment below clones first: without that, colouring one court
 * recolours all three and the rooms stay identical - which is the exact bug
 * this layer exists to fix.
 */

import { Mesh, MeshStandardMaterial, type Object3D } from "three";
import {
  FIRST_FIRE_BASALT_COLOR,
  firstFireCourtIdentity,
  firstFireCourtOfMesh,
} from "./first-fire-court-identity";

export interface FirstFireMaterialReport {
  /** Meshes re-materialised, by role. Used as verification evidence. */
  courtFloors: number;
  performerPads: number;
  trenches: number;
  basalt: number;
  routes: number;
}

function standardClone(mesh: Mesh): MeshStandardMaterial | null {
  const source = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (!source) return null;
  const clone = (source as MeshStandardMaterial).clone();
  mesh.material = clone;
  return clone;
}

/**
 * Apply per-court identity to a freshly loaded graybox scene.
 * Safe to call again after a reload; every call re-clones from what is there.
 */
export function applyFirstFireCourtMaterials(
  scene: Object3D
): FirstFireMaterialReport {
  const report: FirstFireMaterialReport = {
    courtFloors: 0,
    performerPads: 0,
    trenches: 0,
    basalt: 0,
    routes: 0,
  };

  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const name = object.name;
    const identity = firstFireCourtIdentity(firstFireCourtOfMesh(name));

    if (/^FF_PerformerPad_/i.test(name) && identity) {
      const material = standardClone(object);
      if (!material) return;
      // The board's top finding: the pad was the brightest shape in every
      // court frame, so the performer read as a detail on top of it. The pad
      // is now the darkest thing in its own court.
      material.color.set(identity.padColor);
      material.emissive.set("#000000");
      material.emissiveIntensity = 0;
      material.roughness = 0.95;
      material.metalness = 0;
      report.performerPads += 1;
      return;
    }

    if (/^FF_Trench_/i.test(name) && identity) {
      const material = standardClone(object);
      if (!material) return;
      // The molten channel the room already shipped geometry for. An earlier
      // pass hand-rolled a RingGeometry instead of using these meshes; this is
      // the authored trench doing the job.
      material.color.set("#0a0504");
      material.emissive.set(identity.trenchColor);
      material.emissiveIntensity = identity.trenchEmissiveIntensity;
      material.roughness = 0.55;
      material.metalness = 0;
      // Tone-mapped: unmapped emissive clips to flat saturated colour across
      // the whole disc instead of rolling off.
      material.toneMapped = true;
      report.trenches += 1;
      return;
    }

    if (/^FF_(Court|Orbit)_/i.test(name) && identity) {
      const material = standardClone(object);
      if (!material) return;
      material.color.set(identity.floorColor);
      material.roughness = 0.9;
      material.metalness = 0;
      report.courtFloors += 1;
      return;
    }

    if (/^FF_(Route|Steam)_/i.test(name)) {
      const material = standardClone(object);
      if (!material) return;
      // The safe route ships as #906c52 light tan, which makes 24 path slabs
      // the brightest surfaces in a black basalt cave - pale shapes competing
      // with the performer. Darkened to scorched ground that still reads as a
      // walkable path against the basalt around it.
      material.color.set("#3b2118");
      material.roughness = 0.95;
      material.metalness = 0;
      report.routes += 1;
      return;
    }

    if (/^FF_(Basalt|Shell)_/i.test(name)) {
      const material = standardClone(object);
      if (!material) return;
      // One rock for the whole room. The element changes between courts; the
      // stone they are cut from does not.
      material.color.set(FIRST_FIRE_BASALT_COLOR);
      material.roughness = 0.95;
      material.metalness = 0;
      report.basalt += 1;
    }
  });

  return report;
}
