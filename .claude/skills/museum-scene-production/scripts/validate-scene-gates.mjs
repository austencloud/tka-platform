#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const GATES = [
  {
    id: "evidence-preflight",
    human: false,
    evidence: ["canon-audit", "room-shell"],
    checks: ["canon-conflicts", "source-digests"],
  },
  {
    id: "measured-plan",
    human: true,
    evidence: ["floor-plan", "vertical-section", "route-storyboard", "sightline-study"],
    checks: ["walkability", "clearance", "sightlines", "final-view"],
  },
  {
    id: "playable-graybox",
    human: true,
    evidence: ["blender-source", "coordinate-manifest", "graybox-glb", "first-person-walk", "review-contact-sheet"],
    checks: ["artifact-digest", "collision", "route-duration", "sequence-parity"],
  },
  {
    id: "registered-visual-target",
    human: true,
    evidence: ["locked-camera-set", "visual-target-board", "material-lighting-brief"],
    checks: ["camera-registration", "silhouette-read"],
  },
  {
    id: "production-slice",
    human: true,
    evidence: ["vertical-slice-build", "interaction-capture", "performance-report"],
    checks: ["interaction-state", "runtime-console", "performance"],
  },
  {
    id: "integrated-room",
    human: true,
    evidence: ["integrated-walk", "transition-captures", "audio-review", "performance-report"],
    checks: ["museum-connectivity", "backtracking", "state-persistence", "runtime-console", "performance"],
  },
  {
    id: "final-acceptance",
    human: true,
    evidence: ["acceptance-walk", "viewport-evidence", "regression-report"],
    checks: ["focused-tests", "typecheck", "runtime-console", "performance"],
  },
];

const STATUSES = new Set([
  "pending",
  "in-progress",
  "ready-for-review",
  "approved",
  "verified",
  "rejected",
]);
const CHECK_STATUSES = new Set(["pending", "passed", "failed", "skipped"]);
const CLAIM_CLASSES = new Set(["literal", "metaphor", "invention"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const SHA256 = /^[a-f0-9]{64}$/i;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function add(errors, condition, message) {
  if (!condition) errors.push(message);
}

function exemptionKey(gateId, type, name) {
  return `${gateId}:${type}:${name}`;
}

function validateApproval(errors, approval, gateId) {
  add(errors, isObject(approval), `${gateId}: approved gate needs an approval record`);
  if (!isObject(approval)) return;
  add(errors, isNonEmptyString(approval.approvedBy), `${gateId}: approval.approvedBy is required`);
  add(errors, ISO_DATE.test(approval.approvedAt ?? ""), `${gateId}: approval.approvedAt must be an ISO UTC timestamp`);
  add(errors, isNonEmptyString(approval.quote), `${gateId}: approval.quote is required`);
  add(errors, isNonEmptyString(approval.museumTrackerItem), `${gateId}: approval.museumTrackerItem is required`);
  add(errors, approval.visualComprehensionConfirmed === true, `${gateId}: approval must confirm visual comprehension`);
}

function validateExemptions(errors, exemptions) {
  const keys = new Set();
  for (const [index, item] of exemptions.entries()) {
    const prefix = `exemptions[${index}]`;
    add(errors, isObject(item), `${prefix} must be an object`);
    if (!isObject(item)) continue;
    add(errors, GATES.some((gate) => gate.id === item.gateId), `${prefix}.gateId is invalid`);
    add(errors, item.type === "evidence" || item.type === "check", `${prefix}.type must be evidence or check`);
    add(errors, isNonEmptyString(item.name), `${prefix}.name is required`);
    add(errors, isNonEmptyString(item.rationale), `${prefix}.rationale is required`);
    add(errors, isNonEmptyString(item.approvedBy), `${prefix}.approvedBy is required`);
    add(errors, ISO_DATE.test(item.approvedAt ?? ""), `${prefix}.approvedAt must be an ISO UTC timestamp`);
    add(errors, isNonEmptyString(item.museumTrackerItem), `${prefix}.museumTrackerItem is required`);
    const key = exemptionKey(item.gateId, item.type, item.name);
    add(errors, !keys.has(key), `${prefix} duplicates ${key}`);
    keys.add(key);
  }
  return keys;
}

function resolveArtifactPath(root, artifactPath) {
  return isAbsolute(artifactPath) ? artifactPath : resolve(root, artifactPath);
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function validateManifest(manifest, options = {}) {
  const errors = [];
  const root = options.root ?? process.cwd();
  const checkFiles = options.checkFiles !== false;

  add(errors, isObject(manifest), "manifest must be a JSON object");
  if (!isObject(manifest)) return errors;

  add(errors, manifest.schemaVersion === 1, "schemaVersion must be 1");
  add(errors, /^[a-z0-9-]+$/.test(manifest.sceneId ?? ""), "sceneId must use lowercase letters, digits, and hyphens");
  add(errors, isNonEmptyString(manifest.title), "title is required");
  add(errors, typeof manifest.domainProofRequired === "boolean", "domainProofRequired must be boolean");
  add(errors, Number.isInteger(manifest.currentGate) && manifest.currentGate >= 0 && manifest.currentGate < GATES.length, "currentGate must be an integer from 0 through 6");
  add(errors, isObject(manifest.authority), "authority is required");
  add(errors, Array.isArray(manifest.sequenceFingerprints), "sequenceFingerprints must be an array");
  add(errors, Array.isArray(manifest.claims), "claims must be an array");
  add(errors, Array.isArray(manifest.exemptions), "exemptions must be an array");
  add(errors, Array.isArray(manifest.gates) && manifest.gates.length === GATES.length, "gates must contain exactly seven entries");

  const exemptionKeys = validateExemptions(errors, Array.isArray(manifest.exemptions) ? manifest.exemptions : []);

  if (Array.isArray(manifest.claims)) {
    const claimIds = new Set();
    for (const [index, claim] of manifest.claims.entries()) {
      const prefix = `claims[${index}]`;
      add(errors, isObject(claim), `${prefix} must be an object`);
      if (!isObject(claim)) continue;
      add(errors, isNonEmptyString(claim.id), `${prefix}.id is required`);
      add(errors, !claimIds.has(claim.id), `${prefix}.id must be unique`);
      claimIds.add(claim.id);
      add(errors, CLAIM_CLASSES.has(claim.class), `${prefix}.class must be literal, metaphor, or invention`);
      add(errors, isNonEmptyString(claim.statement), `${prefix}.statement is required`);
      add(errors, Array.isArray(claim.evidence), `${prefix}.evidence must be an array`);
      if (claim.class === "literal") add(errors, claim.evidence?.length > 0, `${prefix}: literal claims require evidence`);
    }
  }

  if (Array.isArray(manifest.sequenceFingerprints)) {
    for (const [index, item] of manifest.sequenceFingerprints.entries()) {
      const prefix = `sequenceFingerprints[${index}]`;
      add(errors, isObject(item), `${prefix} must be an object`);
      if (!isObject(item)) continue;
      add(errors, isNonEmptyString(item.performerId), `${prefix}.performerId is required`);
      add(errors, isNonEmptyString(item.sequenceId), `${prefix}.sequenceId is required`);
      add(errors, isNonEmptyString(item.sourcePath), `${prefix}.sourcePath is required`);
      add(errors, SHA256.test(item.sourceSha256 ?? ""), `${prefix}.sourceSha256 must be a SHA-256 digest`);
      add(errors, isNonEmptyString(item.fingerprint), `${prefix}.fingerprint is required`);
      if (checkFiles && isNonEmptyString(item.sourcePath)) {
        const sourcePath = resolveArtifactPath(root, item.sourcePath);
        add(errors, existsSync(sourcePath), `${prefix}.sourcePath does not exist: ${item.sourcePath}`);
        if (existsSync(sourcePath) && SHA256.test(item.sourceSha256 ?? "")) {
          add(errors, sha256(sourcePath) === item.sourceSha256.toLowerCase(), `${prefix}.sourceSha256 does not match ${item.sourcePath}`);
        }
      }
    }
  }

  const gates = Array.isArray(manifest.gates) ? manifest.gates : [];
  for (const [index, contract] of GATES.entries()) {
    const gate = gates[index];
    const prefix = `gates[${index}]`;
    add(errors, isObject(gate), `${prefix} must be an object`);
    if (!isObject(gate)) continue;
    add(errors, gate.id === contract.id, `${prefix}.id must be ${contract.id}`);
    add(errors, STATUSES.has(gate.status), `${contract.id}: invalid status`);
    add(errors, Array.isArray(gate.evidence), `${contract.id}: evidence must be an array`);
    add(errors, Array.isArray(gate.checks), `${contract.id}: checks must be an array`);

    if (index === 0) add(errors, gate.status !== "approved", `${contract.id}: use verified, not approved`);
    if (index > 0) add(errors, gate.status !== "verified", `${contract.id}: human gates use approved, not verified`);
    if (gate.status === "approved") validateApproval(errors, gate.approval, contract.id);
    if (gate.status !== "approved") add(errors, gate.approval == null, `${contract.id}: only approved gates may carry approval`);

    const evidence = Array.isArray(gate.evidence) ? gate.evidence : [];
    const evidenceKinds = new Set();
    for (const [evidenceIndex, item] of evidence.entries()) {
      const itemPrefix = `${contract.id}.evidence[${evidenceIndex}]`;
      add(errors, isObject(item), `${itemPrefix} must be an object`);
      if (!isObject(item)) continue;
      add(errors, isNonEmptyString(item.kind), `${itemPrefix}.kind is required`);
      add(errors, !evidenceKinds.has(item.kind), `${itemPrefix}.kind must be unique within the gate`);
      evidenceKinds.add(item.kind);
      add(errors, isNonEmptyString(item.path), `${itemPrefix}.path is required`);
      if (item.sha256 != null) add(errors, SHA256.test(item.sha256), `${itemPrefix}.sha256 must be a SHA-256 digest`);
      if (checkFiles && isNonEmptyString(item.path) && !/^https?:\/\//i.test(item.path)) {
        const artifactPath = resolveArtifactPath(root, item.path);
        add(errors, existsSync(artifactPath), `${itemPrefix}.path does not exist: ${item.path}`);
        if (existsSync(artifactPath) && SHA256.test(item.sha256 ?? "")) {
          add(errors, sha256(artifactPath) === item.sha256.toLowerCase(), `${itemPrefix}.sha256 does not match ${item.path}`);
        }
      }
    }

    const checks = Array.isArray(gate.checks) ? gate.checks : [];
    const checkMap = new Map();
    for (const [checkIndex, item] of checks.entries()) {
      const itemPrefix = `${contract.id}.checks[${checkIndex}]`;
      add(errors, isObject(item), `${itemPrefix} must be an object`);
      if (!isObject(item)) continue;
      add(errors, isNonEmptyString(item.name), `${itemPrefix}.name is required`);
      add(errors, !checkMap.has(item.name), `${itemPrefix}.name must be unique within the gate`);
      add(errors, CHECK_STATUSES.has(item.status), `${itemPrefix}.status is invalid`);
      if (item.status === "passed") add(errors, isNonEmptyString(item.evidence), `${itemPrefix}: passed checks need evidence`);
      checkMap.set(item.name, item.status);
    }

    const completionStatus = index === 0 ? "verified" : "approved";
    const readinessStatuses = new Set(["ready-for-review", completionStatus]);
    if (readinessStatuses.has(gate.status)) {
      const requiredEvidence = [...contract.evidence];
      const requiredChecks = [...contract.checks];
      if (index === 0 && manifest.domainProofRequired) {
        requiredEvidence.push("motion-proof");
        requiredChecks.push("sequence-fingerprints");
        add(errors, manifest.sequenceFingerprints?.length > 0, "evidence-preflight: domain proof requires sequence fingerprints");
      }
      for (const kind of requiredEvidence) {
        const exempt = exemptionKeys.has(exemptionKey(contract.id, "evidence", kind));
        add(errors, evidenceKinds.has(kind) || exempt, `${contract.id}: missing required evidence ${kind}`);
      }
      for (const name of requiredChecks) {
        const exempt = exemptionKeys.has(exemptionKey(contract.id, "check", name));
        add(errors, checkMap.get(name) === "passed" || exempt, `${contract.id}: required check ${name} has not passed`);
      }
    }

    if (index > manifest.currentGate) {
      add(errors, gate.status === "pending", `${contract.id}: later gates must remain pending`);
      add(errors, evidence.length === 0, `${contract.id}: later gates cannot contain evidence`);
      add(errors, checks.length === 0, `${contract.id}: later gates cannot contain checks`);
      add(errors, gate.approval == null, `${contract.id}: later gates cannot contain approval`);
    }
  }

  if (isObject(manifest.authority)) {
    const gate0Complete = gates[0]?.status === "verified";
    if (gate0Complete) {
      add(errors, isNonEmptyString(manifest.authority.experienceSpec), "authority.experienceSpec is required after Gate 0");
      add(errors, isNonEmptyString(manifest.authority.roomShellSource), "authority.roomShellSource is required after Gate 0");
      add(errors, Array.isArray(manifest.authority.museumTrackerItems) && manifest.authority.museumTrackerItems.length > 0, "authority.museumTrackerItems is required after Gate 0");
    }
  }

  const complete = (gate, index) => gate?.status === (index === 0 ? "verified" : "approved");
  let expectedCurrentGate = gates.findIndex((gate, index) => !complete(gate, index));
  if (expectedCurrentGate === -1) expectedCurrentGate = GATES.length - 1;
  add(errors, manifest.currentGate === expectedCurrentGate, `currentGate must be ${expectedCurrentGate} based on completed gates`);

  return errors;
}

function buildSelfTestManifest() {
  const manifest = {
    schemaVersion: 1,
    sceneId: "self-test",
    title: "Self test",
    domainProofRequired: false,
    currentGate: 1,
    authority: {
      experienceSpec: "docs/self-test.md",
      roomShellSource: "src/self-test.ts",
      planContract: null,
      museumTrackerItems: ["tracker-self-test"],
    },
    sequenceFingerprints: [],
    claims: [],
    exemptions: [],
    gates: GATES.map((gate) => ({ id: gate.id, status: "pending", evidence: [], checks: [], approval: null })),
  };
  manifest.gates[0] = {
    id: GATES[0].id,
    status: "verified",
    evidence: GATES[0].evidence.map((kind) => ({ kind, path: `https://example.invalid/${kind}` })),
    checks: GATES[0].checks.map((name) => ({ name, status: "passed", evidence: "self-test" })),
    approval: null,
  };
  return manifest;
}

function runSelfTest() {
  const valid = buildSelfTestManifest();
  const validErrors = validateManifest(valid, { checkFiles: false });
  if (validErrors.length > 0) throw new Error(`valid fixture failed:\n${validErrors.join("\n")}`);

  const invalid = structuredClone(valid);
  invalid.gates[2].status = "in-progress";
  invalid.gates[2].evidence.push({ kind: "graybox-glb", path: "future.glb" });
  const invalidErrors = validateManifest(invalid, { checkFiles: false });
  if (!invalidErrors.some((error) => error.includes("later gates must remain pending"))) {
    throw new Error("invalid fixture did not catch premature gate work");
  }

  const missingApproval = structuredClone(valid);
  missingApproval.gates[1] = {
    id: GATES[1].id,
    status: "approved",
    evidence: GATES[1].evidence.map((kind) => ({ kind, path: `https://example.invalid/${kind}` })),
    checks: GATES[1].checks.map((name) => ({ name, status: "passed", evidence: "self-test" })),
    approval: null,
  };
  missingApproval.currentGate = 2;
  const approvalErrors = validateManifest(missingApproval, { checkFiles: false });
  if (!approvalErrors.some((error) => error.includes("needs an approval record"))) {
    throw new Error("invalid fixture did not catch missing human approval");
  }

  const missingDomainProof = structuredClone(valid);
  missingDomainProof.domainProofRequired = true;
  const domainErrors = validateManifest(missingDomainProof, { checkFiles: false });
  if (!domainErrors.some((error) => error.includes("requires sequence fingerprints"))) {
    throw new Error("invalid fixture did not catch missing sequence fingerprints");
  }

  const sourcePath = fileURLToPath(import.meta.url);
  const validDomainProof = structuredClone(valid);
  validDomainProof.domainProofRequired = true;
  validDomainProof.sequenceFingerprints = [{
    performerId: "self-test-performer",
    sequenceId: "self-test-sequence",
    sourcePath,
    sourceSha256: sha256(sourcePath),
    fingerprint: "self-test-fingerprint",
  }];
  validDomainProof.gates[0].evidence.push({
    kind: "motion-proof",
    path: "https://example.invalid/motion-proof",
  });
  validDomainProof.gates[0].checks.push({
    name: "sequence-fingerprints",
    status: "passed",
    evidence: "self-test",
  });
  const validDomainErrors = validateManifest(validDomainProof);
  if (validDomainErrors.length > 0) {
    throw new Error(`valid domain fixture failed:\n${validDomainErrors.join("\n")}`);
  }

  const digestMismatch = structuredClone(validDomainProof);
  digestMismatch.sequenceFingerprints[0].sourceSha256 = "0".repeat(64);
  const digestErrors = validateManifest(digestMismatch);
  if (!digestErrors.some((error) => error.includes("sourceSha256 does not match"))) {
    throw new Error("invalid fixture did not catch a stale source digest");
  }

  process.stdout.write(
    "PASS: valid manifest accepted\n" +
    "PASS: premature later-gate work rejected\n" +
    "PASS: missing human approval rejected\n" +
    "PASS: missing domain fingerprint rejected\n" +
    "PASS: current domain fingerprint accepted\n" +
    "PASS: stale source digest rejected\n"
  );
}

function printUsage() {
  process.stderr.write("Usage: node validate-scene-gates.mjs <scene-gates.json> [--root <repo>]\n       node validate-scene-gates.mjs --self-test\n");
}

if (import.meta.url === `file:///${process.argv[1]?.replaceAll("\\", "/")}`) {
  const args = process.argv.slice(2);
  if (args[0] === "--self-test") {
    runSelfTest();
  } else {
    const manifestPath = args[0];
    if (!manifestPath) {
      printUsage();
      process.exitCode = 2;
    } else {
      const rootIndex = args.indexOf("--root");
      const root = rootIndex >= 0 ? resolve(args[rootIndex + 1]) : process.cwd();
      try {
        const manifest = JSON.parse(readFileSync(resolve(manifestPath), "utf8"));
        const errors = validateManifest(manifest, { root });
        if (errors.length > 0) {
          process.stderr.write(`FAIL: ${errors.length} gate contract error(s)\n`);
          for (const error of errors) process.stderr.write(`- ${error}\n`);
          process.exitCode = 1;
        } else {
          process.stdout.write(`PASS: ${manifest.sceneId} gate manifest is valid\n`);
        }
      } catch (error) {
        process.stderr.write(`FAIL: ${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
      }
    }
  }
}
