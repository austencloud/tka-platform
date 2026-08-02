"use strict";

/* global __dirname, process, require */
/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
const { dirname, join, resolve } = require("node:path");
const { test } = require("node:test");

const launchersDirectory = resolve(__dirname, "..");
const guardSourcePath = join(
  launchersDirectory,
  "bootstrap-assets",
  "preserve-node-console-title.cjs"
);
const installerPath = join(
  launchersDirectory,
  "install-terminal-title-guard.mjs"
);

test("the preload absorbs process.title writes without calling the native setter", () => {
  const { preserveNodeConsoleTitle } = require(guardSourcePath);
  const nativeWrites = [];
  const fakeProcess = {};
  Object.defineProperty(fakeProcess, "title", {
    configurable: true,
    enumerable: true,
    get: () => "Intentional Session Name",
    set(value) {
      nativeWrites.push(value);
    },
  });

  assert.equal(preserveNodeConsoleTitle(fakeProcess), true);
  fakeProcess.title = "chrome-devtools-mcp";

  assert.deepEqual(nativeWrites, []);
  assert.equal(fakeProcess.title, "chrome-devtools-mcp");
  assert.equal(preserveNodeConsoleTitle(fakeProcess), false);
});

test("NODE_OPTIONS loads the title guard before application code", () => {
  const result = spawnSync(
    process.execPath,
    [
      "-e",
      [
        'const marker = Symbol.for("tka.chrome-devtools-mcp.process-title-shield");',
        'if (!process[marker]) throw new Error("preload did not run");',
        'process.title = "chrome-devtools-mcp";',
        "process.stdout.write(process.title);",
      ].join(""),
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_OPTIONS: `--require="${guardSourcePath.replaceAll("\\", "/")}"`,
      },
    }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "chrome-devtools-mcp");
});

test("the installer updates both MCP configs without rewriting unrelated settings", () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "tka-terminal-title-"));
  try {
    const codexConfigPath = join(temporaryRoot, ".codex", "config.toml");
    const claudeConfigPath = join(temporaryRoot, ".claude.json");
    const installDirectory = join(
      temporaryRoot,
      "Local App Data",
      "TKA",
      "terminal-title"
    );
    const codexFixture = [
      'model = "gpt-5.6-sol"',
      "",
      "[mcp_servers.chrome-devtools]",
      'command = "cmd"',
      'args = ["/c", "npx", "-y", "chrome-devtools-mcp@latest"]',
      "env = { SystemRoot = 'C:\\Windows', PROGRAMFILES = 'C:\\Program Files' }",
      "startup_timeout_ms = 20_000",
      "",
      "[hooks.state]",
      "enabled = true",
      "",
    ].join("\r\n");
    const claudeFixture = `${JSON.stringify(
      {
        mcpServers: {
          "chrome-devtools": {
            args: ["-y", "chrome-devtools-mcp@latest"],
            command: "npx.cmd",
            env: {
              KEEP: "yes",
              NODE_OPTIONS:
                '--max-old-space-size=256 --require="C:\\old\\preserve-node-console-title.cjs"',
            },
            type: "stdio",
          },
        },
        unrelated: { keep: true },
      },
      null,
      2
    )}\n`;

    mkdirSync(dirname(codexConfigPath), { recursive: true });
    writeFileSync(codexConfigPath, codexFixture, "utf8");
    writeFileSync(claudeConfigPath, claudeFixture, "utf8");

    const argumentsList = [
      installerPath,
      "--codex-config",
      codexConfigPath,
      "--claude-config",
      claudeConfigPath,
      "--install-dir",
      installDirectory,
    ];
    const firstRun = spawnSync(process.execPath, argumentsList, {
      encoding: "utf8",
    });
    assert.equal(firstRun.status, 0, firstRun.stderr);

    const firstCodexResult = readFileSync(codexConfigPath, "utf8");
    const firstClaudeResult = readFileSync(claudeConfigPath, "utf8");
    const installedGuardPath = join(
      installDirectory,
      "preserve-node-console-title.cjs"
    );
    const expectedGuardOption = `--require="${installedGuardPath.replaceAll("\\", "/")}"`;

    assert.equal(
      readFileSync(installedGuardPath, "utf8"),
      readFileSync(guardSourcePath, "utf8")
    );
    assert.equal((firstCodexResult.match(/NODE_OPTIONS/gu) ?? []).length, 1);
    assert.match(firstCodexResult, /SystemRoot = 'C:\\Windows'/u);
    assert.match(firstCodexResult, /\[hooks\.state\]\r\nenabled = true/u);
    assert.ok(firstCodexResult.includes(JSON.stringify(expectedGuardOption)));

    const parsedClaude = JSON.parse(firstClaudeResult);
    assert.equal(parsedClaude.unrelated.keep, true);
    assert.equal(parsedClaude.mcpServers["chrome-devtools"].env.KEEP, "yes");
    assert.equal(
      parsedClaude.mcpServers["chrome-devtools"].env.NODE_OPTIONS,
      `--max-old-space-size=256 ${expectedGuardOption}`
    );

    const installedPreload = spawnSync(
      process.execPath,
      [
        "-e",
        'if (!process[Symbol.for("tka.chrome-devtools-mcp.process-title-shield")]) process.exit(2);',
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          NODE_OPTIONS:
            parsedClaude.mcpServers["chrome-devtools"].env.NODE_OPTIONS,
        },
      }
    );
    assert.equal(installedPreload.status, 0, installedPreload.stderr);

    const secondRun = spawnSync(process.execPath, argumentsList, {
      encoding: "utf8",
    });
    assert.equal(secondRun.status, 0, secondRun.stderr);
    assert.equal(readFileSync(codexConfigPath, "utf8"), firstCodexResult);
    assert.equal(readFileSync(claudeConfigPath, "utf8"), firstClaudeResult);
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true });
  }
});
