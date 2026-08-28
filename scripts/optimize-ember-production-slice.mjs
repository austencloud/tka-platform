#!/usr/bin/env node

import { optimizeGltfKtx2 } from "./lib/optimize-gltf-ktx2.mjs";
import { copyFile } from "node:fs/promises";

const materialProfiles = [
  {
    prefix: "Ember_Columnar_Basalt_PBR",
    tint: [0.86, 0.92, 0.9, 1.0],
    roughnessFloor: 0.72,
    metallicCeiling: 0.05,
    normalScale: 0.34,
  },
  {
    prefix: "Ember_Ground_Blackglass_PBR",
    tint: [0.38, 0.48, 0.56, 1.0],
    roughnessFloor: 0.5,
    roughnessCeiling: 0.68,
    metallicFloor: 0.09,
    metallicCeiling: 0.14,
    normalScale: 0.2,
  },
  {
    prefix: "Ember_Near_Caldera_PBR",
    tint: [0.58, 0.64, 0.62, 1.0],
    roughnessFloor: 0.86,
    metallicCeiling: 0.02,
    normalScale: 0.3,
  },
  {
    prefix: "Ember_Middle_Caldera_PBR",
    tint: [0.68, 0.72, 0.69, 1.0],
    roughnessFloor: 0.9,
    metallicCeiling: 0.01,
    normalScale: 0.2,
  },
  {
    prefix: "Ember_Far_Caldera_PBR",
    tint: [0.78, 0.8, 0.75, 1.0],
    roughnessFloor: 0.94,
    metallicCeiling: 0.0,
    normalScale: 0.12,
  },
  {
    prefix: "Ember_Meshy_Geology_PBR",
    tint: [0.58, 0.64, 0.62, 1.0],
    roughnessFloor: 0.84,
    metallicCeiling: 0.025,
    normalScale: 0.46,
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
const versionedOutput = "static/models/ember/ember-production-slice-r7.glb";

await optimizeGltfKtx2({
  input: "static/models/ember/ember-production-slice_raw.glb",
  output: runtimeOutput,
  temporaryStem: "ember-production-slice",
  label: "Ember volcanic world, Meshy geology ensemble, and blackglass shelf",
  textureSize: 1024,
  materialTextureSize: 512,
  simplifyRatio: 0.92,
  simplifyError: 0.001,
  materialTransform: applyEmberMaterialProfile,
});

await copyFile(runtimeOutput, versionedOutput);
console.log(`  preserved reversible R7 asset: ${versionedOutput}`);
