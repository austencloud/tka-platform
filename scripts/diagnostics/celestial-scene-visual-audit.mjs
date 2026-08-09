import { spawn, spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";

const ALL_DETAIL_VIEWS = ["hero", "aisle", "stage", "profile", "world"];
const ALL_VIEWPORTS = [
  "1920x1080",
  "2560x1440",
  "3840x2160",
  "1440x900",
  "820x1180",
  "960x412",
  "375x667",
];
const fastAudit = process.env.CELESTIAL_AUDIT_FAST === "1";
const DETAIL_VIEWS = fastAudit ? ["hero"] : ALL_DETAIL_VIEWS;
const VIEWPORTS = fastAudit ? [ALL_VIEWPORTS[0]] : ALL_VIEWPORTS;
const outputDirectory = path.join(
  os.tmpdir(),
  "tka-celestial-evidence",
  "runtime"
);
await mkdir(outputDirectory, { recursive: true });

const mcpProcess = spawn(
  "cmd.exe",
  [
    "/d",
    "/s",
    "/c",
    "npx -y chrome-devtools-mcp@latest --browser-url=http://127.0.0.1:9222 --experimentalPageIdRouting --allow-unrestricted-paths",
  ],
  {
    cwd: process.cwd(),
    stdio: ["pipe", "pipe", "inherit"],
    windowsHide: true,
  }
);

const stdout = readline.createInterface({ input: mcpProcess.stdout });
const pending = new Map();
let nextId = 1;

stdout.on("line", (line) => {
  if (!line.trim()) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  if (message.id === undefined || !pending.has(message.id)) return;
  const { resolve, reject, timer } = pending.get(message.id);
  clearTimeout(timer);
  pending.delete(message.id);
  if (message.error) reject(new Error(JSON.stringify(message.error)));
  else resolve(message.result);
});

function sendMessage(message) {
  mcpProcess.stdin.write(`${JSON.stringify(message)}\n`);
}

function request(method, params = {}, timeoutMs = 25_000) {
  const id = nextId++;
  sendMessage({ jsonrpc: "2.0", id, method, params });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out waiting for ${method}`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
  });
}

async function callTool(name, args = {}, timeoutMs = 25_000) {
  const result = await request(
    "tools/call",
    { name, arguments: args },
    timeoutMs
  );
  if (result?.isError) {
    const message = result.content
      ?.map((item) => item.text)
      .filter(Boolean)
      .join("\n");
    throw new Error(`${name} failed: ${message || "Unknown MCP error"}`);
  }
  return result;
}

async function callToolAfterReload(name, args, timeoutMs) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await callTool(name, args, timeoutMs);
    } catch (error) {
      const pageReloaded = String(error).includes(
        "Execution context was destroyed"
      );
      if (!pageReloaded || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    }
  }
  throw new Error(`${name} did not settle after a page reload`);
}

function textContent(result) {
  return result?.content?.find((item) => item.type === "text")?.text ?? "";
}

function extractPageId(result) {
  const match = textContent(result).match(
    /(?:^|\n)(\d+):\s+.*\[selected\]\s*$/m
  );
  if (!match) {
    throw new Error(`Could not identify task page:\n${textContent(result)}`);
  }
  return Number(match[1]);
}

const report = [];
let pageId;

async function persistReport() {
  const reportPath = path.join(outputDirectory, "audit-report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

try {
  await request(
    "initialize",
    {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "celestial-scene-visual-audit", version: "1.0.0" },
    },
    120_000
  );
  sendMessage({
    jsonrpc: "2.0",
    method: "notifications/initialized",
    params: {},
  });

  pageId = extractPageId(
    await callTool(
      "new_page",
      {
        url: "https://localhost:5178/test/celestial-scene?view=hero",
        background: true,
        timeout: 45_000,
      },
      60_000
    )
  );

  for (const viewport of VIEWPORTS) {
    const [width, height] = viewport.split("x").map(Number);
    const isMobile = width < 900 || (width <= 960 && height <= 960);
    const emulatedViewport = `${width}x${height}x1${isMobile ? ",mobile,touch" : ""}`;
    await callTool("emulate", { pageId, viewport: emulatedViewport });

    const views = viewport === "1920x1080" ? DETAIL_VIEWS : ["hero"];
    for (const view of views) {
      const url = `https://localhost:5178/test/celestial-scene?view=${view}`;
      await callTool(
        "navigate_page",
        { pageId, type: "url", url, timeout: 60_000 },
        70_000
      );
      const ready = await callToolAfterReload(
        "evaluate_script",
        {
          pageId,
          function: `async () => {
            const deadline = Date.now() + 30000;
            while (Date.now() < deadline) {
              const canvas = document.querySelector('canvas');
              const visibleText = document.body?.innerText.trim() ?? '';
              if (
                canvas &&
                canvas.width > 0 &&
                canvas.height > 0 &&
                visibleText === '' &&
                document.title === 'Seraphic Vault verification'
              ) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                return {
                  ready: true,
                  width: canvas.width,
                  height: canvas.height,
                };
              }
              await new Promise((resolve) => setTimeout(resolve, 200));
            }
            return {
              ready: false,
              title: document.title,
              body: document.body?.innerText.slice(0, 200),
            };
          }`,
        },
        45_000
      );
      const screenshotPath = path.join(
        outputDirectory,
        `${viewport}-${view}.webp`
      );
      await callTool(
        "take_screenshot",
        {
          pageId,
          filePath: screenshotPath,
          format: "webp",
          quality: 70,
        },
        60_000
      );
      report.push({
        viewport,
        view,
        url,
        ready: textContent(ready),
        screenshot: screenshotPath,
      });
      await persistReport();
      process.stdout.write(`${viewport} ${view}: ${screenshotPath}\n`);
    }
  }

  const consoleResult = await callTool("list_console_messages", {
    pageId,
    types: ["error", "warn"],
  });
  report.push({ console: textContent(consoleResult) });
  const reportPath = await persistReport();
  process.stdout.write(`Report: ${reportPath}\n`);
} finally {
  if (pageId !== undefined) {
    await request(
      "tools/call",
      { name: "emulate", arguments: { pageId } },
      5_000
    ).catch(() => {});
    await request(
      "tools/call",
      { name: "close_page", arguments: { pageId } },
      5_000
    ).catch(() => {});
  }
  stdout.close();
  mcpProcess.stdin.end();
  if (mcpProcess.pid) {
    spawnSync("taskkill.exe", ["/PID", String(mcpProcess.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
  }
}
