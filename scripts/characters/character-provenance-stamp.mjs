import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { validateCharacterProvenance } from "./character-provenance.mjs";
import { PROJECT_ROOT } from "./character-tools.mjs";

export const MIXAMO_SOURCE_URL = "https://www.mixamo.com/";
export const MIXAMO_TERMS_URL =
  "https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html";
export const DEFAULT_QUEUE_FILE =
  "docs/research/mixamo-character-curation-queue-2026-08-31.json";

const RIGHTS_VALUES = ["allowed", "forbidden", "unknown", "not-addressed"];
const VALUE_ARGUMENTS = [
  "--source",
  "--id",
  "--name",
  "--asset",
  "--description",
  "--slot",
  "--queue",
  "--commercial-use",
  "--runtime-distribution",
  "--evidence-url",
  "--evidence-note",
  "--retrieved-at",
  "--acquired-at",
];
const FLAG_ARGUMENTS = ["--replace"];

/** "Paladin J Nordstrom" -> "paladin-j-nordstrom" */
export function kebabCase(text) {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function readQueueSlot(queue, priority) {
  const slot = (queue?.slots ?? []).find(
    (entry) => entry.priority === priority
  );
  if (!slot) throw new Error(`Queue slot ${priority} does not exist`);
  return slot;
}

/**
 * Assemble a Mixamo provenance record.
 *
 * Every field that describes Adobe's catalog is fixed here. The two rights
 * decisions are deliberately not defaulted: the intake gate treats them as a
 * human assertion made from the cited terms, so the person stamping the record
 * has to type them.
 */
export function buildMixamoProvenance({
  id,
  displayName,
  assetName,
  description = "",
  commercialUse,
  applicationRuntimeDistribution,
  evidenceUrl = MIXAMO_TERMS_URL,
  evidenceNote,
  retrievedAt,
  acquiredAt,
  restrictions = [],
}) {
  return {
    schemaVersion: 1,
    id,
    displayName,
    description,
    source: {
      provider: "Adobe Mixamo",
      assetName,
      creator: "Adobe Mixamo",
      url: MIXAMO_SOURCE_URL,
    },
    license: {
      name: "Adobe Mixamo terms",
      url: MIXAMO_TERMS_URL,
    },
    rights: {
      commercialUse,
      applicationRuntimeDistribution,
      rawSourceRedistribution: "forbidden",
      attributionRequired: false,
      restrictions: [
        "Do not offer the source FBX or prepared GLB as a standalone download.",
        ...restrictions,
      ],
    },
    evidence: [{ url: evidenceUrl, retrievedAt, note: evidenceNote }],
    acquiredAt,
  };
}

export function provenancePathForSource(sourcePath) {
  const absolute = resolve(sourcePath);
  const stem = basename(absolute, extname(absolute));
  return resolve(dirname(absolute), `${stem}.provenance.json`);
}

export function parseStampArguments(args) {
  const values = {};
  const flags = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (FLAG_ARGUMENTS.includes(argument)) {
      flags.add(argument);
      continue;
    }
    if (!VALUE_ARGUMENTS.includes(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`${argument} requires a value`);
    }
    values[argument] = value;
    index += 1;
  }
  for (const required of [
    "--source",
    "--commercial-use",
    "--runtime-distribution",
    "--evidence-note",
  ]) {
    if (!values[required]) throw new Error(`${required} is required`);
  }
  for (const rightsArgument of ["--commercial-use", "--runtime-distribution"]) {
    if (!RIGHTS_VALUES.includes(values[rightsArgument])) {
      throw new Error(
        `${rightsArgument} must be one of ${RIGHTS_VALUES.join(", ")}`
      );
    }
  }
  const slot = values["--slot"] === undefined ? null : Number(values["--slot"]);
  if (slot !== null && (!Number.isInteger(slot) || slot < 1)) {
    throw new Error("--slot must be a positive integer");
  }
  if (slot === null) {
    for (const required of ["--id", "--name", "--asset"]) {
      if (!values[required]) {
        throw new Error(`${required} is required when --slot is not given`);
      }
    }
  }
  return {
    source: values["--source"],
    id: values["--id"] ?? null,
    displayName: values["--name"] ?? null,
    assetName: values["--asset"] ?? null,
    description: values["--description"] ?? null,
    slot,
    queueFile: values["--queue"] ?? null,
    commercialUse: values["--commercial-use"],
    applicationRuntimeDistribution: values["--runtime-distribution"],
    evidenceUrl: values["--evidence-url"] ?? MIXAMO_TERMS_URL,
    evidenceNote: values["--evidence-note"],
    retrievedAt: values["--retrieved-at"] ?? null,
    acquiredAt: values["--acquired-at"] ?? null,
    replace: flags.has("--replace"),
  };
}

/**
 * Write the sidecar next to a downloaded character and run it through the
 * same gate the intake command applies, so a record that would be refused is
 * reported now rather than after Blender has spent minutes on the file.
 */
export function stampProvenance(options, { now = () => new Date() } = {}) {
  const sourcePath = resolve(options.source);
  if (!existsSync(sourcePath)) {
    throw new Error(`Source model not found: ${sourcePath}`);
  }
  const outputPath = provenancePathForSource(sourcePath);
  if (existsSync(outputPath) && !options.replace) {
    throw new Error(
      `Provenance already exists: ${outputPath} (use --replace to rewrite it)`
    );
  }

  let id = options.id;
  let displayName = options.displayName;
  let assetName = options.assetName;
  let description = options.description ?? "";
  if (options.slot !== null) {
    const queuePath = resolve(
      PROJECT_ROOT,
      options.queueFile ?? DEFAULT_QUEUE_FILE
    );
    const queue = JSON.parse(readFileSync(queuePath, "utf8"));
    const slot = readQueueSlot(queue, options.slot);
    id = id ?? kebabCase(slot.suggestedName);
    displayName = displayName ?? slot.suggestedName;
    assetName = assetName ?? slot.suggestedName;
    if (!options.description) description = slot.role;
  }

  const today = now().toISOString().slice(0, 10);
  const provenance = buildMixamoProvenance({
    id,
    displayName,
    assetName,
    description,
    commercialUse: options.commercialUse,
    applicationRuntimeDistribution: options.applicationRuntimeDistribution,
    evidenceUrl: options.evidenceUrl,
    evidenceNote: options.evidenceNote,
    retrievedAt: options.retrievedAt ?? today,
    acquiredAt: options.acquiredAt ?? statSync(sourcePath).mtime.toISOString(),
  });
  writeFileSync(outputPath, `${JSON.stringify(provenance, null, 2)}\n`, "utf8");
  return {
    outputPath,
    provenance,
    validation: validateCharacterProvenance(provenance),
  };
}

function main() {
  try {
    const options = parseStampArguments(process.argv.slice(2));
    const result = stampProvenance(options);
    console.log(`Provenance written: ${result.outputPath}`);
    console.log(`Character id: ${result.provenance.id}`);
    if (result.validation.ok) {
      console.log("Intake gate: pass");
    } else {
      console.error("Intake gate: fail");
      for (const error of result.validation.errors) console.error(`- ${error}`);
      process.exitCode = 2;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  main();
}
