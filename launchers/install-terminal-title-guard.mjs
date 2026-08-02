#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import console from "node:console";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import process from "node:process";
import { randomUUID } from "node:crypto";
import { fileURLToPath, URL } from "node:url";

const GUARD_FILE_NAME = "preserve-node-console-title.cjs";
const GUARD_SOURCE_PATH = fileURLToPath(
  new URL(`./bootstrap-assets/${GUARD_FILE_NAME}`, import.meta.url)
);

function parseArguments(argv) {
  const localAppData =
    process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
  const options = {
    client: "all",
    claudeConfigPath: join(homedir(), ".claude.json"),
    codexConfigPath: join(
      process.env.CODEX_HOME ?? join(homedir(), ".codex"),
      "config.toml"
    ),
    installDirectory: join(localAppData, "TKA", "terminal-title"),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    switch (argument) {
      case "--client":
        if (!value || !["all", "claude", "codex"].includes(value)) {
          throw new Error("--client must be all, claude, or codex.");
        }
        options.client = value;
        index += 1;
        break;
      case "--claude-config":
        if (!value) throw new Error("--claude-config requires a path.");
        options.claudeConfigPath = resolve(value);
        index += 1;
        break;
      case "--codex-config":
        if (!value) throw new Error("--codex-config requires a path.");
        options.codexConfigPath = resolve(value);
        index += 1;
        break;
      case "--install-dir":
        if (!value) throw new Error("--install-dir requires a path.");
        options.installDirectory = resolve(value);
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

function writeFileAtomicallyIfChanged(filePath, content) {
  if (existsSync(filePath) && readFileSync(filePath, "utf8") === content)
    return false;

  mkdirSync(dirname(filePath), { recursive: true });
  const temporaryPath = join(
    dirname(filePath),
    `.${basename(filePath)}.${process.pid}.${randomUUID()}.tmp`
  );
  try {
    writeFileSync(temporaryPath, content, "utf8");
    renameSync(temporaryPath, filePath);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
  return true;
}

function buildGuardedNodeOptions(existingValue, guardPath) {
  const existing = typeof existingValue === "string" ? existingValue : "";
  const withoutOldGuard = existing
    .replace(
      /(?:^|\s)(?:--require|-r)(?:=|\s+)(?:"[^"]*preserve-node-console-title\.cjs"|'[^']*preserve-node-console-title\.cjs'|[^\s]*preserve-node-console-title\.cjs)/giu,
      " "
    )
    .replace(/\s+/gu, " ")
    .trim();
  const nodeRequirePath = guardPath.replaceAll("\\", "/");
  const guardOption = `--require="${nodeRequirePath}"`;
  return withoutOldGuard ? `${withoutOldGuard} ${guardOption}` : guardOption;
}

function encodeTomlString(value) {
  return JSON.stringify(value);
}

function decodeTomlString(literal) {
  if (literal.startsWith("'")) return literal.slice(1, -1);
  return JSON.parse(literal);
}

function findTomlSection(content, sectionName) {
  const escapedName = sectionName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const headerPattern = new RegExp(
    `^[ \\t]*\\[${escapedName}\\][ \\t]*(?:#[^\\r\\n]*)?(?:\\r?\\n|$)`,
    "gmu"
  );
  const headerMatch = headerPattern.exec(content);
  if (!headerMatch) return null;

  const bodyStart = headerMatch.index + headerMatch[0].length;
  const nextHeaderPattern =
    /^[ \t]*\[[^\r\n]+\][ \t]*(?:#[^\r\n]*)?(?:\r?\n|$)/gmu;
  nextHeaderPattern.lastIndex = bodyStart;
  const nextHeader = nextHeaderPattern.exec(content);
  return {
    bodyEnd: nextHeader?.index ?? content.length,
    bodyStart,
  };
}

function replaceRange(content, start, end, replacement) {
  return content.slice(0, start) + replacement + content.slice(end);
}

function insertTomlLine(body, line, newline) {
  const trailingWhitespace = body.match(/\s*$/u)?.[0] ?? "";
  const core = body.slice(0, body.length - trailingWhitespace.length);
  const separator = core.length > 0 && !core.endsWith("\n") ? newline : "";
  return `${core}${separator}${line}${trailingWhitespace || newline}`;
}

function updateTomlEnvTable(content, section, nodeOptions, newline) {
  const body = content.slice(section.bodyStart, section.bodyEnd);
  const settingPattern =
    /^([ \t]*NODE_OPTIONS[ \t]*=[ \t]*)("(?:\\.|[^"\\])*"|'[^']*')([ \t]*(?:#[^\r\n]*)?)$/mu;
  const settingMatch = settingPattern.exec(body);
  let updatedBody;

  if (settingMatch) {
    const merged = buildGuardedNodeOptions(
      decodeTomlString(settingMatch[2]),
      nodeOptions.guardPath
    );
    const literalStart = settingMatch.index + settingMatch[1].length;
    updatedBody = replaceRange(
      body,
      literalStart,
      literalStart + settingMatch[2].length,
      encodeTomlString(merged)
    );
  } else {
    updatedBody = insertTomlLine(
      body,
      `NODE_OPTIONS = ${encodeTomlString(nodeOptions.value)}`,
      newline
    );
  }

  return replaceRange(content, section.bodyStart, section.bodyEnd, updatedBody);
}

function updateCodexConfig(content, guardPath) {
  const chromeSection = findTomlSection(content, "mcp_servers.chrome-devtools");
  if (!chromeSection) return { configured: false, content };

  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const nodeOptions = {
    guardPath,
    value: buildGuardedNodeOptions("", guardPath),
  };
  const envTable = findTomlSection(content, "mcp_servers.chrome-devtools.env");
  if (envTable) {
    return {
      configured: true,
      content: updateTomlEnvTable(content, envTable, nodeOptions, newline),
    };
  }

  const body = content.slice(chromeSection.bodyStart, chromeSection.bodyEnd);
  const envPattern =
    /^([ \t]*env[ \t]*=[ \t]*\{)([^\r\n}]*)(\}[ \t]*(?:#[^\r\n]*)?)$/mu;
  const envMatch = envPattern.exec(body);
  let updatedBody;

  if (!envMatch) {
    updatedBody = insertTomlLine(
      body,
      `env = { NODE_OPTIONS = ${encodeTomlString(nodeOptions.value)} }`,
      newline
    );
  } else {
    const entries = envMatch[2];
    const nodeOptionsPattern =
      /(^|,)([ \t]*NODE_OPTIONS[ \t]*=[ \t]*)("(?:\\.|[^"\\])*"|'[^']*')/u;
    const nodeOptionsMatch = nodeOptionsPattern.exec(entries);
    let updatedEntries;

    if (nodeOptionsMatch) {
      const merged = buildGuardedNodeOptions(
        decodeTomlString(nodeOptionsMatch[3]),
        guardPath
      );
      const literalStart =
        nodeOptionsMatch.index +
        nodeOptionsMatch[1].length +
        nodeOptionsMatch[2].length;
      updatedEntries = replaceRange(
        entries,
        literalStart,
        literalStart + nodeOptionsMatch[3].length,
        encodeTomlString(merged)
      );
    } else {
      const leadingWhitespace = entries.match(/^\s*/u)?.[0] ?? "";
      const trailingWhitespace = entries.match(/\s*$/u)?.[0] ?? "";
      const existingEntries = entries.trim();
      updatedEntries = existingEntries
        ? `${leadingWhitespace}${existingEntries}, NODE_OPTIONS = ${encodeTomlString(nodeOptions.value)}${trailingWhitespace || " "}`
        : ` NODE_OPTIONS = ${encodeTomlString(nodeOptions.value)} `;
    }

    const entriesStart = envMatch.index + envMatch[1].length;
    updatedBody = replaceRange(
      body,
      entriesStart,
      entriesStart + entries.length,
      updatedEntries
    );
  }

  return {
    configured: true,
    content: replaceRange(
      content,
      chromeSection.bodyStart,
      chromeSection.bodyEnd,
      updatedBody
    ),
  };
}

function skipJsonWhitespace(content, start) {
  let index = start;
  while (index < content.length && /\s/u.test(content[index])) index += 1;
  return index;
}

function scanJsonString(content, start) {
  if (content[start] !== '"')
    throw new Error(`Expected a JSON string at offset ${start}.`);
  let index = start + 1;
  while (index < content.length) {
    if (content[index] === "\\") {
      index += 2;
      continue;
    }
    if (content[index] === '"') return index + 1;
    index += 1;
  }
  throw new Error(`Unterminated JSON string at offset ${start}.`);
}

function scanJsonComposite(content, start) {
  const closingFor = { "{": "}", "[": "]" };
  const firstClosing = closingFor[content[start]];
  if (!firstClosing)
    throw new Error(`Expected a JSON object or array at offset ${start}.`);

  const stack = [firstClosing];
  let index = start + 1;
  while (index < content.length) {
    if (content[index] === '"') {
      index = scanJsonString(content, index);
      continue;
    }
    if (closingFor[content[index]]) {
      stack.push(closingFor[content[index]]);
    } else if (content[index] === stack.at(-1)) {
      stack.pop();
      if (stack.length === 0) return index + 1;
    }
    index += 1;
  }
  throw new Error(`Unterminated JSON object or array at offset ${start}.`);
}

function scanJsonValue(content, start) {
  if (content[start] === '"') return scanJsonString(content, start);
  if (content[start] === "{" || content[start] === "[") {
    return scanJsonComposite(content, start);
  }

  let index = start;
  while (index < content.length && ![",", "}", "]"].includes(content[index]))
    index += 1;
  while (index > start && /\s/u.test(content[index - 1])) index -= 1;
  return index;
}

function findDirectJsonProperty(content, objectStart, propertyName) {
  const objectEnd = scanJsonComposite(content, objectStart) - 1;
  let index = objectStart + 1;

  while (index < objectEnd) {
    index = skipJsonWhitespace(content, index);
    if (content[index] === ",") {
      index += 1;
      continue;
    }
    if (index >= objectEnd) return null;

    const nameStart = index;
    const nameEnd = scanJsonString(content, nameStart);
    const name = JSON.parse(content.slice(nameStart, nameEnd));
    index = skipJsonWhitespace(content, nameEnd);
    if (content[index] !== ":")
      throw new Error(`Expected ':' after JSON property ${name}.`);
    const valueStart = skipJsonWhitespace(content, index + 1);
    const valueEnd = scanJsonValue(content, valueStart);
    if (name === propertyName) return { nameStart, valueEnd, valueStart };
    index = valueEnd;
  }

  return null;
}

function insertJsonProperty(content, objectStart, propertyName, encodedValue) {
  const objectEnd = scanJsonComposite(content, objectStart) - 1;
  const body = content.slice(objectStart + 1, objectEnd);
  const entry = `${JSON.stringify(propertyName)}: ${encodedValue}`;
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  let updatedBody;

  if (body.trim().length === 0) {
    if (body.includes("\n")) {
      const closingLineStart = content.lastIndexOf("\n", objectEnd - 1);
      const closingIndent = content.slice(closingLineStart + 1, objectEnd);
      updatedBody = `${newline}${closingIndent}  ${entry}${newline}${closingIndent}`;
    } else {
      updatedBody = ` ${entry} `;
    }
  } else if (body.includes("\n")) {
    const trailingWhitespace = body.match(/\s*$/u)?.[0] ?? "";
    const core = body.slice(0, body.length - trailingWhitespace.length);
    const closingLineStart = content.lastIndexOf("\n", objectEnd - 1);
    const closingIndent = content.slice(closingLineStart + 1, objectEnd);
    updatedBody = `${core},${newline}${closingIndent}  ${entry}${trailingWhitespace}`;
  } else {
    const trailingWhitespace = body.match(/\s*$/u)?.[0] ?? "";
    const core = body.slice(0, body.length - trailingWhitespace.length);
    updatedBody = `${core}, ${entry}${trailingWhitespace}`;
  }

  return replaceRange(content, objectStart + 1, objectEnd, updatedBody);
}

function updateClaudeConfig(content, guardPath) {
  JSON.parse(content);
  const rootStart = skipJsonWhitespace(content, 0);
  if (content[rootStart] !== "{")
    throw new Error("Claude config must contain a JSON object.");

  const mcpServers = findDirectJsonProperty(content, rootStart, "mcpServers");
  if (!mcpServers || content[mcpServers.valueStart] !== "{") {
    return { configured: false, content };
  }
  const chromeServer = findDirectJsonProperty(
    content,
    mcpServers.valueStart,
    "chrome-devtools"
  );
  if (!chromeServer) return { configured: false, content };
  if (content[chromeServer.valueStart] !== "{") {
    throw new Error(
      "Claude's chrome-devtools MCP entry must be a JSON object."
    );
  }

  const environment = findDirectJsonProperty(
    content,
    chromeServer.valueStart,
    "env"
  );
  let updated;
  if (!environment) {
    updated = insertJsonProperty(
      content,
      chromeServer.valueStart,
      "env",
      `{ "NODE_OPTIONS": ${JSON.stringify(buildGuardedNodeOptions("", guardPath))} }`
    );
  } else {
    if (content[environment.valueStart] !== "{") {
      throw new Error(
        "Claude's chrome-devtools MCP env value must be a JSON object."
      );
    }
    const nodeOptions = findDirectJsonProperty(
      content,
      environment.valueStart,
      "NODE_OPTIONS"
    );
    if (!nodeOptions) {
      updated = insertJsonProperty(
        content,
        environment.valueStart,
        "NODE_OPTIONS",
        JSON.stringify(buildGuardedNodeOptions("", guardPath))
      );
    } else {
      if (content[nodeOptions.valueStart] !== '"') {
        throw new Error(
          "Claude's chrome-devtools MCP NODE_OPTIONS value must be a string."
        );
      }
      const existingValue = JSON.parse(
        content.slice(nodeOptions.valueStart, nodeOptions.valueEnd)
      );
      updated = replaceRange(
        content,
        nodeOptions.valueStart,
        nodeOptions.valueEnd,
        JSON.stringify(buildGuardedNodeOptions(existingValue, guardPath))
      );
    }
  }

  JSON.parse(updated);
  return { configured: true, content: updated };
}

function configureFile(filePath, label, updater, guardPath) {
  if (!existsSync(filePath)) {
    console.log(`Skipped ${label}: config does not exist at ${filePath}`);
    return;
  }

  const original = readFileSync(filePath, "utf8");
  const result = updater(original, guardPath);
  if (!result.configured) {
    console.log(
      `Skipped ${label}: no chrome-devtools MCP entry in ${filePath}`
    );
    return;
  }

  const changed = writeFileAtomicallyIfChanged(filePath, result.content);
  console.log(`${changed ? "Configured" : "Verified"} ${label}: ${filePath}`);
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const guardPath = join(options.installDirectory, GUARD_FILE_NAME);
  const guardChanged = writeFileAtomicallyIfChanged(
    guardPath,
    readFileSync(GUARD_SOURCE_PATH, "utf8")
  );
  console.log(
    `${guardChanged ? "Installed" : "Verified"} terminal title guard: ${guardPath}`
  );

  if (options.client === "all" || options.client === "codex") {
    configureFile(
      options.codexConfigPath,
      "Codex Chrome DevTools MCP",
      updateCodexConfig,
      guardPath
    );
  }
  if (options.client === "all" || options.client === "claude") {
    configureFile(
      options.claudeConfigPath,
      "Claude Chrome DevTools MCP",
      updateClaudeConfig,
      guardPath
    );
  }
}

try {
  main();
} catch (error) {
  console.error(`Terminal title guard installation failed: ${error.message}`);
  process.exitCode = 1;
}
