#!/usr/bin/env node
/**
 * Frame-budget audit — proves a route holds the display's refresh rate.
 *
 * The bar is not "feels okay". It is: every frame lands inside the display's
 * own frame interval, and no task blocks the main thread long enough to be
 * seen. The budget is derived from the display rather than hardcoded to 60fps,
 * so the same command demands 8.3ms frames on a 120Hz panel and 16.7ms on a
 * 60Hz one without being edited.
 *
 * What it measures, per route:
 *   cold        — long tasks and frame times from navigation through a scripted
 *                 scroll that activates every lazily-mounted section
 *   idle        — several scroll stops, sitting still, doing nothing; this is
 *                 the one that catches animation loops nobody turned off
 *   interaction — frames for 2.5s after a scripted click, which is where a
 *                 stutter is actually felt
 *
 * It also counts requestAnimationFrame callbacks per frame. That number is the
 * single most diagnostic reading on this page: N loops running while the user
 * looks at one section means N-1 of them are burning the budget unseen.
 *
 * Usage:
 *   node scripts/audit-frame-budget.mjs --route /composer
 *   node scripts/audit-frame-budget.mjs --route /composer --cpu 4
 *   node scripts/audit-frame-budget.mjs --route /composer --json out.json
 *
 * Requires the shared agent Chrome to be listening on --cdp (default 9222):
 *   pwsh -NoProfile -File scripts/launch-chrome-debug.ps1 -Url about:blank
 *
 * It opens its own tab, activates it (a background tab has rAF throttled and
 * every fps reading from one is fiction), and closes only that tab when done.
 */

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const a = process.argv[i];
  if (a.startsWith("--")) args.set(a.slice(2), process.argv[i + 1] ?? "true");
}

/**
 * Git Bash on Windows rewrites a leading-slash argument into an absolute
 * Windows path before Node ever sees it: `--route /composer` arrives as
 * `C:/Program Files/Git/composer`. Recover the route rather than failing with
 * an opaque "Cannot navigate to invalid URL", because everyone hits this once.
 */
function normalizeRoute(raw) {
  let r = raw ?? "/composer";
  const mangled = r.match(/^[A-Za-z]:[\\/].*?[\\/]Git[\\/](.*)$/);
  if (mangled) r = "/" + mangled[1].split("\\").join("/");
  return r.startsWith("/") ? r : `/${r}`;
}

const ROUTE = normalizeRoute(args.get("route"));
const ORIGIN = args.get("origin") ?? "https://localhost:5173";
const CDP_PORT = Number(args.get("cdp") ?? 9222);
const CPU_THROTTLE = Number(args.get("cpu") ?? 1);
const JSON_OUT = args.get("json") ?? null;
const VIEWPORT = (args.get("viewport") ?? "1920x1080").split("x").map(Number);

/** Interaction probes, per route. A route with no entry runs cold + idle only. */
const INTERACTIONS = {
  "/composer": [
    {
      name: "pick an option card",
      selector:
        '.construct-surface [data-testid="option-card"], .construct-surface [data-testid="option-item"]',
      scrollTo: ".construct-surface",
    },
  ],
};

// ---------------------------------------------------------------- CDP client

let nextId = 1;
const pending = new Map();
const pendingMethod = new Map();

async function connect() {
  const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
  if (!res.ok) throw new Error(`Chrome not reachable on :${CDP_PORT}`);
  const { webSocketDebuggerUrl } = await res.json();
  const ws = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} [${pendingMethod.get(msg.id) ?? "?"}]`));
      else resolve(msg.result);
    }
  });
  return ws;
}

function send(ws, method, params = {}, sessionId) {
  const id = nextId++;
  const payload = { id, method, params };
  if (sessionId) payload.sessionId = sessionId;
  pendingMethod.set(id, method);
  ws.send(JSON.stringify(payload));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }
    }, 180_000);
  });
}

/** Runs `fn` (an async arrow, as a source string) in the page and returns its value. */
async function run(ws, sessionId, source) {
  const { result, exceptionDetails } = await send(
    ws,
    "Runtime.evaluate",
    {
      expression: `(${source})()`,
      awaitPromise: true,
      returnByValue: true,
    },
    sessionId
  );
  if (exceptionDetails) {
    throw new Error(
      exceptionDetails.exception?.description ?? exceptionDetails.text
    );
  }
  return result.value;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------- in-page probe source

/**
 * Records frame deltas, rAF callbacks per frame, and long tasks for `ms`.
 * Patches requestAnimationFrame for the duration so every loop on the page is
 * counted, then restores the original — an unrestored patch would poison every
 * later pass in the same tab.
 */
const RECORDER = `async ({ ms, scrollTo, click, scrollSweep }) => {
  const nativeRaf = window.requestAnimationFrame.bind(window);
  if (scrollTo) {
    document.querySelector(scrollTo)?.scrollIntoView({ behavior: 'instant', block: 'center' });
    await new Promise((r) => setTimeout(r, 400));
  }

  const longTasks = [];
  let po = null;
  if (typeof PerformanceObserver !== 'undefined'
      && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
    po = new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        longTasks.push({ start: Math.round(e.startTime), duration: Math.round(e.duration) });
      }
    });
    po.observe({ type: 'longtask', buffered: false });
  }

  let rafCount = 0;
  window.requestAnimationFrame = function (cb) { rafCount += 1; return nativeRaf(cb); };

  const frames = [];
  const perFrameRaf = [];
  let last = performance.now();
  let handle = 0;
  let stopped = false;
  const tick = () => {
    const now = performance.now();
    frames.push(now - last);
    last = now;
    perFrameRaf.push(rafCount);
    rafCount = 0;
    if (!stopped) handle = nativeRaf(tick);
  };
  handle = nativeRaf(tick);

  let clicked = false;
  if (click) {
    await new Promise((r) => setTimeout(r, 250));
    const el = document.querySelector(click);
    if (el) { el.click(); clicked = true; }
  }

  if (scrollSweep) {
    const total = document.documentElement.scrollHeight - innerHeight;
    const steps = 10;
    for (let i = 1; i <= steps; i += 1) {
      scrollTo === undefined;
      window.scrollTo({ top: (total * i) / steps, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, ms / steps));
    }
  } else {
    await new Promise((r) => setTimeout(r, ms));
  }

  stopped = true;
  cancelAnimationFrame(handle);
  window.requestAnimationFrame = nativeRaf;
  po?.disconnect();

  // Drop the first two frames: the first delta spans the setup gap and the
  // second often carries the scroll's own paint. Neither describes the loop.
  const f = frames.slice(2);
  const r = perFrameRaf.slice(2);
  const sorted = f.slice().sort((a, b) => a - b);
  const q = (p) => sorted.length ? +sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))].toFixed(1) : 0;
  const rs = r.slice().sort((a, b) => a - b);

  return {
    frameCount: f.length,
    min: q(0),
    median: q(0.5),
    p95: q(0.95),
    worst: Math.round(sorted[sorted.length - 1] ?? 0),
    worstFive: sorted.slice(-5).map((v) => Math.round(v)).reverse(),
    rafPerFrame: {
      median: rs.length ? rs[Math.floor(rs.length / 2)] : 0,
      max: rs.length ? rs[rs.length - 1] : 0
    },
    longTasks: longTasks.sort((a, b) => b.duration - a.duration).slice(0, 8),
    longTaskCount: longTasks.length,
    longTaskTotalMs: longTasks.reduce((a, b) => a + b.duration, 0),
    clicked
  };
}`;

// ------------------------------------------------------------------ reporting

/**
 * The display's frame interval, inferred from the fastest frame observed across
 * every pass. rAF cannot beat the refresh rate, so the minimum delta is the
 * interval. Snapped to a known rate so one anomalous sub-millisecond delta
 * cannot invent an impossible budget.
 */
function inferFrameInterval(passes) {
  const mins = passes.map((p) => p.result.min).filter((v) => v > 1);
  const fastest = Math.min(...mins);
  const known = [1000 / 240, 1000 / 165, 1000 / 144, 1000 / 120, 1000 / 90, 1000 / 60];
  let best = 1000 / 60;
  let bestErr = Infinity;
  for (const k of known) {
    const err = Math.abs(fastest - k);
    if (err < bestErr) { bestErr = err; best = k; }
  }
  return best;
}

function grade(pass, interval) {
  const budget = interval * 1.05; // one frame, plus scheduling noise
  const dropped = interval * 2;   // a frame the user actually loses
  const fails = [];
  if (pass.result.median > budget) {
    fails.push(`median ${pass.result.median}ms over ${budget.toFixed(1)}ms budget`);
  }
  if (pass.result.p95 > dropped) {
    fails.push(`p95 ${pass.result.p95}ms drops a frame`);
  }
  const bigTask = pass.result.longTasks.find((t) => t.duration > 50);
  if (bigTask) fails.push(`${bigTask.duration}ms long task blocks the thread`);
  return fails;
}

function fmt(pass, interval) {
  const r = pass.result;
  const fps = r.median > 0 ? Math.round(1000 / r.median) : 0;
  const fails = grade(pass, interval);
  const mark = fails.length ? "FAIL" : "pass";
  return [
    `  ${mark}  ${pass.name}`,
    `        ${fps} fps · median ${r.median}ms · p95 ${r.p95}ms · worst ${r.worst}ms`,
    `        rAF loops/frame ${r.rafPerFrame.median} (max ${r.rafPerFrame.max}) · ` +
      `long tasks ${r.longTaskCount} totalling ${r.longTaskTotalMs}ms`,
    r.longTasks.length
      ? `        worst tasks ${r.longTasks.slice(0, 4).map((t) => `${t.duration}ms`).join(", ")}`
      : null,
    ...fails.map((f) => `        -> ${f}`),
  ]
    .filter(Boolean)
    .join("\n");
}

// ----------------------------------------------------------------------- main

async function main() {
  const ws = await connect();
  const url = `${ORIGIN}${ROUTE}`;
  const { targetId } = await send(ws, "Target.createTarget", { url: "about:blank" });
  let sessionId;

  try {
    ({ sessionId } = await send(ws, "Target.attachToTarget", {
      targetId,
      flatten: true,
    }));
    // A background tab has rAF throttled; every fps number from one is fiction.
    await send(ws, "Target.activateTarget", { targetId });
    await send(ws, "Page.enable", {}, sessionId);
    await send(ws, "Runtime.enable", {}, sessionId);
    await send(
      ws,
      "Emulation.setDeviceMetricsOverride",
      { width: VIEWPORT[0], height: VIEWPORT[1], deviceScaleFactor: 1, mobile: false },
      sessionId
    );
    if (CPU_THROTTLE > 1) {
      await send(ws, "Emulation.setCPUThrottlingRate", { rate: CPU_THROTTLE }, sessionId);
    }

    await send(ws, "Page.navigate", { url }, sessionId);
    await sleep(1500);

    const passes = [];

    // Cold: from navigation through a full scroll sweep, so every lazily
    // mounted section activates while the recorder is watching.
    passes.push({
      name: "cold load + scroll sweep",
      result: await run(
        ws,
        sessionId,
        `() => (${RECORDER})({ ms: 10000, scrollSweep: true })`
      ),
    });

    // Idle: sitting still at three depths, doing nothing at all.
    const stops = [
      { name: "idle at hero", scrollTo: "main, body" },
      { name: "idle at construct", scrollTo: ".construct-surface, .making" },
      { name: "idle at outputs", scrollTo: ".changing, .keeping" },
    ];
    for (const stop of stops) {
      passes.push({
        name: stop.name,
        result: await run(
          ws,
          sessionId,
          `() => (${RECORDER})({ ms: 4000, scrollTo: ${JSON.stringify(stop.scrollTo)} })`
        ),
      });
    }

    for (const probe of INTERACTIONS[ROUTE] ?? []) {
      passes.push({
        name: `interaction: ${probe.name}`,
        result: await run(
          ws,
          sessionId,
          `() => (${RECORDER})({ ms: 2500, scrollTo: ${JSON.stringify(probe.scrollTo)}, click: ${JSON.stringify(probe.selector)} })`
        ),
      });
    }

    const interval = inferFrameInterval(passes);
    const failing = passes.filter((p) => grade(p, interval).length > 0);

    console.log(`\nFrame budget — ${url}`);
    console.log(
      `  display ${Math.round(1000 / interval)}Hz (${interval.toFixed(1)}ms/frame)` +
        `  viewport ${VIEWPORT[0]}x${VIEWPORT[1]}` +
        (CPU_THROTTLE > 1 ? `  CPU ${CPU_THROTTLE}x slowdown` : "")
    );
    console.log("");
    for (const pass of passes) console.log(fmt(pass, interval), "\n");

    const verdict = failing.length
      ? `${failing.length} of ${passes.length} passes miss the budget`
      : `all ${passes.length} passes hold ${Math.round(1000 / interval)}fps`;
    console.log(`${failing.length ? "FAIL" : "PASS"}  ${verdict}\n`);

    if (JSON_OUT) {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(
        JSON_OUT,
        JSON.stringify({ url, interval, cpuThrottle: CPU_THROTTLE, passes }, null, 2)
      );
      console.log(`wrote ${JSON_OUT}\n`);
    }

    process.exitCode = failing.length ? 1 : 0;
  } finally {
    await send(ws, "Target.closeTarget", { targetId }).catch(() => {});
    ws.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
