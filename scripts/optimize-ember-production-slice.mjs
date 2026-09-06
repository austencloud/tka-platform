#!/usr/bin/env node

import { optimizeGltfKtx2 } from "./lib/optimize-gltf-ktx2.mjs";
import { copyFile } from "node:fs/promises";

const materialProfiles = [
  {
    prefix: "Ember_R9_fresh-rift-synthesis_roped-pahoehoe",
    tint: [0.9, 0.96, 0.96, 1.0],
    roughnessFloor: 0.52,
    roughnessCeiling: 0.8,
    metallicCeiling: 0.035,
    normalScale: 0.42,
  },
  {
    prefix: "Ember_R9_fresh-rift-synthesis_iron-contact-crust",
    tint: [0.96, 0.72, 0.6, 1.0],
    roughnessFloor: 0.72,
    roughnessCeiling: 0.94,
    metallicCeiling: 0.025,
    normalScale: 0.38,
  },
  {
    prefix: "Ember_R9_fresh-rift-synthesis_fractured-basalt",
    tint: [0.86, 0.93, 0.92, 1.0],
    roughnessFloor: 0.68,
    roughnessCeiling: 0.92,
    metallicCeiling: 0.02,
    normalScale: 0.48,
  },
  {
    prefix: "Ember_R9_fresh-rift-synthesis_windborne-ash",
    tint: [0.94, 0.93, 0.88, 1.0],
    roughnessFloor: 0.92,
    metallicCeiling: 0.005,
    normalScale: 0.2,
  },
  {
    prefix: "Ember_R9_fresh-rift-synthesis_Blended_Terrain",
    tint: [0.91, 0.94, 0.92, 1.0],
    roughnessFloor: 0.76,
    roughnessCeiling: 0.9,
    metallicCeiling: 0.025,
    normalScale: 0.34,
  },
];

function applyEmberMaterialProfile(document) {
  const matchCounts = new Map(
    materialProfiles.map((profile) => [profile.prefix, 0])
  );
  for (const material of document.getRoot().listMaterials()) {
    const profile = materialProfiles.find(({ prefix }) =>
      material.getName().startsWith(prefix)
    );
    if (!profile) continue;
    const base = material.getBaseColorFactor();
    material.setBaseColorFactor(
      base.map((channel, index) => Math.min(1, channel * profile.tint[index]))
    );
    const roughness = Math.max(
      profile.roughnessFloor,
      material.getRoughnessFactor()
    );
    material.setRoughnessFactor(
      profile.roughnessCeiling === undefined
        ? roughness
        : Math.min(profile.roughnessCeiling, roughness)
    );
    const metallic = Math.min(
      profile.metallicCeiling,
      material.getMetallicFactor()
    );
    material.setMetallicFactor(
      profile.metallicFloor === undefined
        ? metallic
        : Math.max(profile.metallicFloor, metallic)
    );
    if (material.getNormalTexture()) {
      material.setNormalScale(profile.normalScale);
    }
    matchCounts.set(profile.prefix, matchCounts.get(profile.prefix) + 1);
    console.log(`  profiled ${material.getName()}`);
  }

  const missing = [...matchCounts]
    .filter(([, count]) => count === 0)
    .map(([prefix]) => prefix);
  if (missing.length > 0) {
    throw new Error(
      `Ember material profiles matched no material: ${missing.join(", ")}`
    );
  }
}

const runtimeOutput = "static/models/ember/ember-production-slice.glb";
const valley = process.argv.includes("--distant-valley");
const geology = valley || process.argv.includes("--geology-stage");
const distant = geology || process.argv.includes("--distant");
const tributaries = distant || process.argv.includes("--tributaries");
const tributaryRevision = distant ? "r2" : "r1";
const flow = tributaries || process.argv.includes("--lava-flow");
const midflank = flow || process.argv.includes("--midflank-r5");
const versionedOutput = valley
  ? "static/models/ember/ember-distant-valley-r4.glb"
  : geology
    ? "static/models/ember/ember-geology-stage-r1.glb"
    : tributaries
      ? `static/models/ember/ember-mountain-tributaries-${tributaryRevision}.glb`
      : flow
        ? "static/models/ember/ember-midflank-lava-flow-r2.glb"
        : midflank
          ? "static/models/ember/ember-midflank-production-r5.glb"
          : "static/models/ember/ember-production-slice-r10.glb";

await optimizeGltfKtx2({
  input: valley
    ? "static/models/ember/ember-distant-valley-r4_raw.glb"
    : geology
      ? "static/models/ember/ember-geology-stage-r1_raw.glb"
      : tributaries
        ? `static/models/ember/ember-mountain-tributaries-${tributaryRevision}_raw.glb`
        : flow
          ? "static/models/ember/ember-midflank-lava-flow-r2_raw.glb"
          : midflank
            ? "static/models/ember/ember-midflank-production-r5_raw.glb"
            : "static/models/ember/ember-production-slice_raw.glb",
  output: runtimeOutput,
  temporaryStem: "ember-production-slice",
  label: midflank
    ? "Ember Mid-Flank Fire Pilgrimage R5"
    : "Ember Living Caldera and Fresh Rift surface ecology",
  textureSize: valley ? 2048 : 1024,
  materialTextureSize: 512,
  simplifyRatio: midflank ? 1 : 0.92,
  simplifyError: 0.001,
  materialTransform: midflank ? undefined : applyEmberMaterialProfile,
  encodeTextures: !midflank,
  palette: !midflank,
  keepAttributes: flow,
});

await copyFile(runtimeOutput, versionedOutput);
console.log(`  preserved reversible asset: ${versionedOutput}`);
