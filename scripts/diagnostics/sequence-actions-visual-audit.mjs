import { spawn, spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";

const DEFAULT_STATES = [
  ["root-transform", "root", "transform"],
  ["root-patterns", "root", "patterns"],
  ["root-edit", "root", "edit"],
  ["root-first-step", "root", "first-step"],
  ["turn", "turn", "default"],
  ["direction-reversals", "direction", "reversals"],
  ["direction-apply", "direction", "apply"],
  ["direction-save", "direction", "save"],
  ["duration", "duration", "default"],
  ["extend-loop", "extend", "loop"],
  ["extend-repeat", "extend", "repeat"],
  ["help-direction", "help", "direction"],
];

function readOption(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

function parseViewport(value) {
  const match = /^(\d+)x(\d+)(?:x([\d.]+))?$/.exec(value);
  if (!match) {
    throw new Error(
      `Invalid viewport "${value}". Use WIDTHxHEIGHT or WIDTHxHEIGHTxDPR.`
    );
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  const isMobile = width < 900 || (width <= 960 && height <= 960);

  return {
    width,
    height,
    deviceScaleFactor: Number(match[3] ?? 1),
    isMobile,
    hasTouch: isMobile,
  };
}

const viewportLabel = readOption("viewport", "375x667");
const viewport = parseViewport(viewportLabel);
const stateFilter = readOption("states", "all")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const states = stateFilter.includes("all")
  ? DEFAULT_STATES
  : DEFAULT_STATES.filter(([name]) => stateFilter.includes(name));

if (states.length === 0) {
  throw new Error(`No known states matched: ${stateFilter.join(", ")}`);
}

const outputDirectory = path.resolve(
  readOption(
    "out",
    `artifacts/screenshots/sequence-actions/${viewport.width}x${viewport.height}`
  )
);
const routePath = readOption(
  "route",
  "/test/smart-collections?review=sequence-actions&"
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

  if (message.id !== undefined && pending.has(message.id)) {
    const { resolve, reject, timer } = pending.get(message.id);
    clearTimeout(timer);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
  }
});

function sendMessage(message) {
  mcpProcess.stdin.write(`${JSON.stringify(message)}\n`);
}

function request(method, params = {}) {
  const id = nextId++;
  sendMessage({ jsonrpc: "2.0", id, method, params });

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out waiting for ${method}`));
    }, 45_000);
    pending.set(id, { resolve, reject, timer });
  });
}

async function callTool(name, args = {}) {
  const result = await request("tools/call", { name, arguments: args });
  if (result?.isError) {
    const message = result.content
      ?.map((item) => item.text)
      .filter(Boolean)
      .join("\n");
    throw new Error(`${name} failed: ${message || "Unknown MCP error"}`);
  }
  return result;
}

function textContent(result) {
  return result?.content?.find((item) => item.type === "text")?.text ?? "";
}

function extractPageId(result) {
  const match = textContent(result).match(
    /(?:^|\n)(\d+):\s+.*\[selected\]\s*$/m
  );
  if (!match) {
    throw new Error(
      `Could not identify task page from:\n${textContent(result)}`
    );
  }
  return Number(match[1]);
}

const metricFunction = `() => {
  const round = (value) => Math.round(value * 10) / 10;
  const box = (element) => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      top: round(rect.top),
      bottom: round(rect.bottom),
      width: round(rect.width),
      height: round(rect.height)
    };
  };
  const label = (element) =>
    (element?.getAttribute('aria-label') || element?.textContent || element?.className || '')
      .replace(/\\s+/g, ' ')
      .trim()
      .slice(0, 80);
  const visible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  };
  const scrollables = [...document.querySelectorAll('*')]
    .filter((element) => {
      const style = getComputedStyle(element);
      return visible(element) && /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
    })
    .map((element) => ({
      label: label(element),
      className: typeof element.className === 'string' ? element.className.slice(0, 120) : '',
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight
    }));
  const controls = [...document.querySelectorAll('button, input, [role="button"], [role="tab"]')]
    .filter(visible)
    .map((element) => ({ label: label(element), box: box(element) }));
  const undersizedControls = controls.filter(({ box: rect }) => rect && (rect.height < 43.5 || rect.width < 43.5));
  const textElements = [...document.querySelectorAll('button, input, p, span, h1, h2, h3, label')]
    .filter((element) => visible(element) && label(element));
  const tinyText = textElements
    .map((element) => ({ label: label(element), size: parseFloat(getComputedStyle(element).fontSize) }))
    .filter(({ size }) => size < 12)
    .slice(0, 20);
  const title = document.querySelector('.panel-title');
  const workspace = document.querySelector('.workspace-preview');
  const panel = document.querySelector('.sequence-actions-panel-container') || document.querySelector('[aria-label="Sequence actions panel"]');
  return {
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    panel: box(panel),
    workspace: box(workspace),
    workspaceVisibleHeight: panel ? round(Math.max(0, panel.getBoundingClientRect().top)) : null,
    header: box(document.querySelector('.compact-header')),
    title: title ? { text: label(title), box: box(title), lines: title.getClientRects().length } : null,
    categoryTabs: box(document.querySelector('.category-tabs')),
    subview: box(document.querySelector('.sub-view-body')),
    scrollables,
    undersizedControls,
    tinyText
  };
}`;

let taskPageId;
const report = [];

try {
  await request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "sequence-actions-visual-audit", version: "1.0.0" },
  });
  sendMessage({
    jsonrpc: "2.0",
    method: "notifications/initialized",
    params: {},
  });

  const firstUrl = `https://localhost:5173${routePath}frame=1&surface=${states[0][1]}&variant=${states[0][2]}`;
  const newPageResult = await callTool("new_page", {
    url: firstUrl,
    background: true,
    timeout: 30_000,
  });
  taskPageId = extractPageId(newPageResult);
  process.stdout.write(`Task page ${taskPageId}: ${firstUrl}\n`);

  // Austen's persistent Chrome profile uses 110% per-site zoom on localhost.
  // Compensate so the CSS viewport, not the screenshot bitmap, matches the
  // requested desktop review size. Override when testing another profile.
  const desktopScale = viewport.isMobile
    ? 1
    : Number(readOption("page-zoom", "1.1"));
  const emulationWidth = Math.round(viewport.width * desktopScale);
  const emulationHeight = Math.round(viewport.height * desktopScale);
  const emulatedViewport = `${emulationWidth}x${emulationHeight}x${viewport.deviceScaleFactor}${viewport.isMobile ? ",mobile,touch" : ""}`;
  await callTool("emulate", { pageId: taskPageId, viewport: emulatedViewport });

  for (const [name, surface, variant] of states) {
    const url = `https://localhost:5173${routePath}frame=1&surface=${surface}&variant=${variant}`;
    await callTool("navigate_page", {
      pageId: taskPageId,
      type: "url",
      url,
      timeout: 30_000,
    });
    await callTool("evaluate_script", {
      pageId: taskPageId,
      function: `async () => {
        const deadline = Date.now() + 20000;
        while (Date.now() < deadline) {
          const panel = document.querySelector('.sequence-actions-panel-container');
          const surfaceReady = document.querySelector('.review-frame') && (document.querySelector('.compact-header') || document.querySelector('[role="dialog"]'));
          const panelSettled = !panel || panel.getBoundingClientRect().top < innerHeight - 100;
          if (surfaceReady && panelSettled) {
            await new Promise((resolve) => setTimeout(resolve, 450));
            return true;
          }
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        return { ready: false, title: document.title, bodyText: document.body?.innerText?.slice(0, 500) ?? '' };
      }`,
    });

    const metricResult = await callTool("evaluate_script", {
      pageId: taskPageId,
      function: metricFunction,
    });
    const screenshotPath = path.join(outputDirectory, `${name}.webp`);
    await callTool("take_screenshot", {
      pageId: taskPageId,
      filePath: screenshotPath,
      format: "webp",
      quality: 72,
    });
    const consoleResult = await callTool("list_console_messages", {
      pageId: taskPageId,
      types: ["error", "warn"],
    });

    const entry = {
      name,
      url,
      metrics: textContent(metricResult),
      console: textContent(consoleResult),
      screenshot: screenshotPath,
    };
    report.push(entry);
    process.stdout.write(`${name}: ${entry.metrics}\n`);
  }

  const reportPath = path.join(outputDirectory, "audit-report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`Report: ${reportPath}\n`);
} finally {
  if (taskPageId !== undefined) {
    await callTool("emulate", { pageId: taskPageId }).catch(() => {});
    await callTool("close_page", { pageId: taskPageId }).catch(() => {});
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
