import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractPath = path.join(
  root,
  "scripts",
  "winter-fire-court-graybox-r1.json"
);
const glbPath = path.join(
  root,
  "static",
  "models",
  "winter",
  "review",
  "winter-fire-court-graybox-r1.glb"
);
const builderReportPath = path.join(
  root,
  "docs",
  "superpowers",
  "specs",
  "moonlit-winter-hollow",
  "evidence",
  "fire-court-graybox-r1",
  "winter-fire-court-graybox-r1-report.json"
);
const verificationPath = path.join(
  path.dirname(builderReportPath),
  "winter-fire-court-graybox-r1-verification.json"
);

const [contractBytes, glb, builderReportBytes] = await Promise.all([
  readFile(contractPath),
  readFile(glbPath),
  readFile(builderReportPath),
]);
const contract = JSON.parse(contractBytes);
const builderReport = JSON.parse(builderReportBytes);
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

assert.equal(glb.subarray(0, 4).toString("ascii"), "glTF");
assert.equal(glb.readUInt32LE(4), 2);
assert.equal(glb.readUInt32LE(8), glb.byteLength);
const jsonChunkLength = glb.readUInt32LE(12);
assert.equal(glb.readUInt32LE(16), 0x4e4f534a);
const document = JSON.parse(
  glb.subarray(20, 20 + jsonChunkLength).toString("utf8").trim()
);

const nodes = document.nodes ?? [];
const exportedNames = nodes.map(({ name }) => name).filter(Boolean);
const friendBodies = nodes.filter(
  ({ name }) => name?.startsWith("WF_Friend_") && name.endsWith("_Body")
);
const roleCounts = friendBodies.reduce((counts, node) => {
  const role = node.extras?.tka_friend_role;
  assert.ok(role, `${node.name} is missing tka_friend_role`);
  counts[role] = (counts[role] ?? 0) + 1;
  return counts;
}, {});

assert.equal(document.cameras, undefined, "A QA camera leaked into the GLB");
assert.ok(
  exportedNames.every((name) => !name.startsWith("QA_")),
  "QA-only context leaked into the GLB"
);
assert.equal(friendBodies.length, contract.requirements.friendCount);
assert.deepEqual(roleCounts, {
  spinner: contract.requirements.spinnerCount,
  seated: contract.requirements.seatedCount,
  standing: contract.requirements.standingCount,
  "rack-tender": contract.requirements.rackTenderCount,
});
assert.ok(
  exportedNames.includes("WF_Court_Surface"),
  "The fire-court surface is missing"
);
assert.ok(
  exportedNames.includes("WF_PracticeWing_Walls"),
  "The attached practice wing is missing"
);
assert.ok(glb.byteLength < 1_500_000, "The review GLB exceeds its 1.5 MB budget");
assert.equal(builderReport.sourceDigest, digest(contractBytes));
assert.equal(builderReport.exportedCameraCount, 0);
assert.equal(builderReport.exportedLightCount, 0);

const verification = {
  sceneId: contract.sceneId,
  revisionId: contract.revisionId,
  contractSha256: digest(contractBytes),
  glbSha256: digest(glb),
  glbBytes: glb.byteLength,
  glbVersion: 2,
  exportedNodeCount: nodes.length,
  exportedCameraCount: document.cameras?.length ?? 0,
  qaNodeCount: exportedNames.filter((name) => name.startsWith("QA_")).length,
  friendCount: friendBodies.length,
  friendRoleCounts: roleCounts,
  checks: {
    exactTenFriends: true,
    courtPresent: true,
    practiceWingPresent: true,
    noQaContextExported: true,
    noCameraExported: true,
    underReviewAssetBudget: true,
    sourceDigestMatchesBuilder: true,
  },
};

await writeFile(verificationPath, `${JSON.stringify(verification, null, 2)}\n`);
console.log(
  `PASS ${contract.revisionId}: ${friendBodies.length} friends, ${nodes.length} nodes, ${(glb.byteLength / 1024).toFixed(1)} KiB`
);
