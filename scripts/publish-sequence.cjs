#!/usr/bin/env node
/**
 * Promote one existing library sequence through the guarded Admin publisher.
 *
 * Usage:
 *   pnpm sequence:publish -- <sequenceId>
 *   pnpm sequence:publish -- <sequenceId> --owner <uid>
 *   pnpm sequence:publish -- <sequenceId> --dry-run
 */

const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");
const { AUSTEN_UID } = require("./import-sequence.cjs");

const USAGE = [
  "Usage: pnpm sequence:publish -- <sequenceId> [--owner <uid>] [--dry-run]",
  "",
  "Publishes the owner record, public projection, retained revision, and hash claim together.",
].join("\n");

function parseCliArgs(argv) {
  let sequenceId = null;
  let ownerId = AUSTEN_UID;
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--owner") {
      ownerId = argv[++index] ?? "";
      if (!ownerId) throw new Error("--owner requires a Firebase user id");
    } else if (argument === "--dry-run") {
      dryRun = true;
    } else if (argument === "--help" || argument === "-h") {
      return { help: true, sequenceId: "", ownerId, dryRun };
    } else if (argument.startsWith("--")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (sequenceId) {
      throw new Error("Only one sequence id can be published at a time");
    } else {
      sequenceId = argument;
    }
  }

  if (!sequenceId) throw new Error("A sequence id is required");
  if (ownerId.includes(":")) throw new Error("Owner ids cannot contain ':'");
  if (sequenceId.includes(":")) {
    throw new Error("Sequence ids cannot contain ':'");
  }

  return { help: false, sequenceId, ownerId, dryRun };
}

function buildPublisherArguments(options) {
  const migrationPath = resolve(
    __dirname,
    "migrations/publish-missing-public-mirrors.ts"
  );
  return [
    "--import",
    "tsx",
    migrationPath,
    "--target",
    `${options.ownerId}:${options.sequenceId}`,
    "--promote",
    "--strict",
    ...(!options.dryRun ? ["--apply"] : []),
  ];
}

function run(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseCliArgs(argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(`\n${USAGE}`);
    return 1;
  }

  if (options.help) {
    console.log(USAGE);
    return 0;
  }

  const result = spawnSync(process.execPath, buildPublisherArguments(options), {
    cwd: resolve(__dirname, ".."),
    env: { ...process.env, TKA_ADMIN: "1" },
    stdio: "inherit",
  });
  if (result.error) {
    console.error(result.error.message);
    return 1;
  }
  if (result.status !== 0) return result.status ?? 1;

  if (!options.dryRun) {
    console.log(
      `\nLive: https://tkaflowarts.com/sequence/${encodeURIComponent(options.sequenceId)}`
    );
  }
  return 0;
}

if (require.main === module) {
  process.exitCode = run();
}

module.exports = {
  USAGE,
  parseCliArgs,
  buildPublisherArguments,
  run,
};
