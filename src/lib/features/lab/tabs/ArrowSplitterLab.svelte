<!--
  ArrowSplitterLab.svelte — Split arrow SVGs into shaft and tip portions

  Port of tools/arrow-splitter.html into a Svelte 5 lab tab.
  Loads arrow SVGs from Vite's dev server (/images/arrows/...),
  lets the user draw a cut line, splits the path using De Casteljau
  subdivision, and exports a manifest JSON.
-->
<script lang="ts">
  // ============================================================
  // TYPES
  // ============================================================

  interface Point {
    x: number;
    y: number;
  }

  interface ViewBox {
    x: number;
    y: number;
    w: number;
    h: number;
  }

  interface ParsedMove {
    type: "M";
    x: number;
    y: number;
  }

  interface ParsedLine {
    type: "L";
    x: number;
    y: number;
    fromX: number;
    fromY: number;
  }

  interface ParsedCubic {
    type: "C";
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    x: number;
    y: number;
    fromX: number;
    fromY: number;
  }

  interface ParsedClose {
    type: "Z";
    x: number;
    y: number;
    fromX: number;
    fromY: number;
  }

  type ParsedCommand = ParsedMove | ParsedLine | ParsedCubic | ParsedClose;

  interface Segment {
    type: "L" | "C";
    fromX: number;
    fromY: number;
    x: number;
    y: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  }

  interface BBox {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  interface SplitResult {
    shaftPath: string;
    tipPath: string;
    tipBBox: BBox;
  }

  type Manifest = Record<string, SplitResult>;

  // ============================================================
  // ARROW FILE LIST
  // ============================================================

  const ARROW_FILES: string[] = [
    "pro/from_radial/pro_0.0.svg",
    "pro/from_radial/pro_0.0_skew+.svg",
    "pro/from_radial/pro_0.0_skew-.svg",
    "pro/from_radial/pro_0.5.svg",
    "pro/from_radial/pro_1.0.svg",
    "pro/from_radial/pro_1.5.svg",
    "pro/from_radial/pro_2.0.svg",
    "pro/from_radial/pro_2.5.svg",
    "pro/from_radial/pro_3.0.svg",
    "pro/from_nonradial/pro_0.0.svg",
    "pro/from_nonradial/pro_0.5.svg",
    "pro/from_nonradial/pro_1.0.svg",
    "pro/from_nonradial/pro_1.5.svg",
    "pro/from_nonradial/pro_2.0.svg",
    "pro/from_nonradial/pro_2.5.svg",
    "pro/from_nonradial/pro_3.0.svg",
    "anti/from_radial/anti_0.0.svg",
    "anti/from_radial/anti_0.0_skew-.svg",
    "anti/from_radial/anti_0.5.svg",
    "anti/from_radial/anti_1.0.svg",
    "anti/from_radial/anti_1.5.svg",
    "anti/from_radial/anti_2.0.svg",
    "anti/from_radial/anti_2.5.svg",
    "anti/from_radial/anti_3.0.svg",
    "anti/from_nonradial/anti_0.0.svg",
    "anti/from_nonradial/anti_0.0_skew+.svg",
    "anti/from_nonradial/anti_0.5.svg",
    "anti/from_nonradial/anti_1.0.svg",
    "anti/from_nonradial/anti_1.5.svg",
    "anti/from_nonradial/anti_2.0.svg",
    "anti/from_nonradial/anti_2.5.svg",
    "anti/from_nonradial/anti_3.0.svg",
    "dash/from_radial/dash_0.0.svg",
    "dash/from_radial/dash_0.5.svg",
    "dash/from_radial/dash_1.0.svg",
    "dash/from_radial/dash_1.5.svg",
    "dash/from_radial/dash_2.0.svg",
    "dash/from_radial/dash_2.5.svg",
    "dash/from_radial/dash_3.0.svg",
    "dash/from_nonradial/dash_0.0.svg",
    "dash/from_nonradial/dash_0.5.svg",
    "dash/from_nonradial/dash_1.0.svg",
    "dash/from_nonradial/dash_1.5.svg",
    "dash/from_nonradial/dash_2.0.svg",
    "dash/from_nonradial/dash_2.5.svg",
    "dash/from_nonradial/dash_3.0.svg",
    "dash.svg",
    "float.svg",
    "static/from_radial/static_0.5.svg",
    "static/from_radial/static_1.0.svg",
    "static/from_radial/static_1.5.svg",
    "static/from_radial/static_2.0.svg",
    "static/from_radial/static_2.5.svg",
    "static/from_radial/static_3.0.svg",
    "static/from_nonradial/static_0.5.svg",
    "static/from_nonradial/static_1.0.svg",
    "static/from_nonradial/static_1.5.svg",
    "static/from_nonradial/static_2.0.svg",
    "static/from_nonradial/static_2.5.svg",
    "static/from_nonradial/static_3.0.svg",
  ];

  // ============================================================
  // STATE
  // ============================================================

  let svgTexts = $state<Record<string, string>>({});
  let manifest = $state<Manifest>({});
  let currentIndex = $state(0);
  let cutPoints = $state<Point[]>([]);
  let currentViewBox = $state<ViewBox | null>(null);
  let currentPathD = $state("");
  let currentParsed = $state<ParsedCommand[]>([]);
  let currentSplitResult = $state<SplitResult | null>(null);
  let overlapMargin = $state(8);
  let statusMessage = $state("");
  let statusType = $state<"" | "saved" | "error">("");
  let loading = $state(true);
  let loadProgress = $state("");

  // Hidden file input ref
  let manifestFileInput: HTMLInputElement | undefined = $state(undefined);
  let svgViewportEl: HTMLDivElement | undefined = $state(undefined);

  const arrowsLoaded = $derived(Object.keys(svgTexts).length > 0);
  const currentFile = $derived(ARROW_FILES[currentIndex] ?? "");
  const progressLabel = $derived(
    arrowsLoaded ? `${currentIndex + 1}/${ARROW_FILES.length}` : "0/0"
  );
  const hasSavedSplit = $derived(!!manifest[currentFile]);
  const manifestCount = $derived(Object.keys(manifest).length);

  const canSave = $derived(currentSplitResult !== null);
  const canNavigate = $derived(arrowsLoaded);

  // Compute the padded viewBox string for the main viewport and cut overlay
  const paddedViewBox = $derived.by(() => {
    if (!currentViewBox) return "0 0 300 300";
    const pad = 20;
    return `${currentViewBox.x - pad} ${currentViewBox.y - pad} ${currentViewBox.w + pad * 2} ${currentViewBox.h + pad * 2}`;
  });

  // Preview viewBox (less padding)
  const previewViewBox = $derived.by(() => {
    if (!currentViewBox) return "0 0 300 300";
    const pad = 10;
    return `${currentViewBox.x - pad} ${currentViewBox.y - pad} ${currentViewBox.w + pad * 2} ${currentViewBox.h + pad * 2}`;
  });

  // Cut overlay SVG content
  const cutOverlayContent = $derived.by(() => {
    let html = "";
    for (const p of cutPoints) {
      html += `<circle cx="${p.x}" cy="${p.y}" r="4" class="cut-point"/>`;
    }
    if (cutPoints.length === 2) {
      const cp0 = cutPoints[0]!;
      const cp1 = cutPoints[1]!;
      const dx = cp1.x - cp0.x;
      const dy = cp1.y - cp0.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        const extend = 2000;
        const nx = dx / len;
        const ny = dy / len;
        const x1 = cp0.x - nx * extend;
        const y1 = cp0.y - ny * extend;
        const x2 = cp1.x + nx * extend;
        const y2 = cp1.y + ny * extend;
        html += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="cut-line-visual"/>`;
      }
    }
    return html;
  });

  // Instruction text
  const instructionText = $derived.by(() => {
    if (!arrowsLoaded) return "Loading arrows...";
    if (hasSavedSplit && !currentSplitResult)
      return "This arrow has a saved split. Re-draw to change, or press Skip/Enter.";
    if (currentSplitResult)
      return "Split preview shown. Press Save & Next to confirm, or re-draw.";
    return "Click two points to draw a cut line separating shaft from tip.";
  });

  // Saved preview path d-strings (extracted from manifest entry)
  const savedShaftD = $derived.by(() => {
    const entry = manifest[currentFile];
    if (!entry) return null;
    const match = entry.shaftPath.match(/d="([^"]+)"/);
    return match ? match[1] : null;
  });

  const savedTipD = $derived.by(() => {
    const entry = manifest[currentFile];
    if (!entry) return null;
    const match = entry.tipPath.match(/d="([^"]+)"/);
    return match ? match[1] : null;
  });

  // ============================================================
  // LOAD ARROWS FROM DEV SERVER
  // ============================================================

  async function loadArrows() {
    loading = true;
    loadProgress = "Loading arrows...";
    const prefix = "/images/arrows/";
    let loaded = 0;
    const texts: Record<string, string> = {};

    for (const file of ARROW_FILES) {
      try {
        const resp = await fetch(prefix + file);
        if (resp.ok) {
          texts[file] = await resp.text();
          loaded++;
        }
      } catch {
        // skip unavailable files
      }
    }

    svgTexts = texts;
    loading = false;

    if (loaded === 0) {
      setStatus("No arrows found. Make sure dev server is running.", "error");
      return;
    }

    setStatus(`Loaded ${loaded}/${ARROW_FILES.length} arrows`, "saved");

    // Jump to first unsplit arrow
    const firstUnsplit = ARROW_FILES.findIndex(
      (f) => svgTexts[f] && !manifest[f]
    );
    currentIndex = firstUnsplit === -1 ? 0 : firstUnsplit;
    loadCurrentArrow();
  }

  // ============================================================
  // ARROW DISPLAY
  // ============================================================

  function loadCurrentArrow() {
    const file = ARROW_FILES[currentIndex]!;
    cutPoints = [];
    currentSplitResult = null;

    if (!svgTexts[file]) {
      currentPathD = "";
      currentParsed = [];
      currentViewBox = null;
      return;
    }

    const svgText = svgTexts[file];
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const svgEl = doc.querySelector("svg");
    const pathEl = doc.querySelector("path");

    if (!svgEl || !pathEl) {
      currentPathD = "";
      currentParsed = [];
      currentViewBox = null;
      return;
    }

    const vb = svgEl.getAttribute("viewBox");
    if (vb) {
      const parts = vb.split(/[\s,]+/).map(Number);
      currentViewBox = { x: parts[0]!, y: parts[1]!, w: parts[2]!, h: parts[3]! };
    } else {
      currentViewBox = { x: 0, y: 0, w: 300, h: 300 };
    }

    currentPathD = pathEl.getAttribute("d") ?? "";
    currentParsed = parsePathD(currentPathD);
  }

  // ============================================================
  // CUT LINE INTERACTION
  // ============================================================

  function handleViewportClick(e: MouseEvent) {
    if (!currentPathD || !svgViewportEl) return;
    const svgEl = svgViewportEl.querySelector("svg");
    if (!svgEl) return;

    const pt = (svgEl as SVGSVGElement).createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = (svgEl as SVGSVGElement).getScreenCTM();
    if (!ctm) return;
    const svgPt = pt.matrixTransform(ctm.inverse());

    if (cutPoints.length >= 2) {
      cutPoints = [];
    }
    cutPoints = [...cutPoints, { x: svgPt.x, y: svgPt.y }];

    if (cutPoints.length === 2) {
      performSplit();
    }
  }

  // ============================================================
  // PATH PARSING
  // ============================================================

  interface Token {
    type: "cmd" | "num";
    value: string | number;
  }

  function parsePathD(d: string): ParsedCommand[] {
    const tokens: Token[] = [];
    const re =
      /([MmCcLlHhVvSsQqTtAaZz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(d)) !== null) {
      if (m[1]) tokens.push({ type: "cmd", value: m[1]! });
      else tokens.push({ type: "num", value: parseFloat(m[2]!) });
    }

    const commands: ParsedCommand[] = [];
    let i = 0;
    let curX = 0;
    let curY = 0;
    let startX = 0;
    let startY = 0;
    let lastCmd: string | null = null;
    let lastCX = 0;
    let lastCY = 0;

    function readNum(): number {
      if (i < tokens.length && tokens[i]!.type === "num")
        return tokens[i++]!.value as number;
      return 0;
    }

    function hasMoreNums(): boolean {
      return i < tokens.length && tokens[i]!.type === "num";
    }

    while (i < tokens.length) {
      let cmd: string;
      if (tokens[i]!.type === "cmd") {
        cmd = tokens[i++]!.value as string;
      } else {
        if (lastCmd === "M") cmd = "L";
        else if (lastCmd === "m") cmd = "l";
        else cmd = lastCmd ?? "L";
      }

      const isRelative = cmd === cmd.toLowerCase() && cmd !== "z" && cmd !== "Z";
      const absCmd = cmd.toUpperCase();

      switch (absCmd) {
        case "M": {
          let x = readNum();
          let y = readNum();
          if (isRelative) {
            x += curX;
            y += curY;
          }
          commands.push({ type: "M", x, y });
          curX = x;
          curY = y;
          startX = x;
          startY = y;
          while (hasMoreNums()) {
            let lx = readNum();
            let ly = readNum();
            if (isRelative) {
              lx += curX;
              ly += curY;
            }
            commands.push({ type: "L", x: lx, y: ly, fromX: curX, fromY: curY });
            curX = lx;
            curY = ly;
          }
          break;
        }
        case "L": {
          do {
            let x = readNum();
            let y = readNum();
            if (isRelative) {
              x += curX;
              y += curY;
            }
            commands.push({ type: "L", x, y, fromX: curX, fromY: curY });
            curX = x;
            curY = y;
          } while (hasMoreNums());
          break;
        }
        case "H": {
          do {
            let x = readNum();
            if (isRelative) x += curX;
            commands.push({
              type: "L",
              x,
              y: curY,
              fromX: curX,
              fromY: curY,
            });
            curX = x;
          } while (hasMoreNums());
          break;
        }
        case "V": {
          do {
            let y = readNum();
            if (isRelative) y += curY;
            commands.push({
              type: "L",
              x: curX,
              y,
              fromX: curX,
              fromY: curY,
            });
            curY = y;
          } while (hasMoreNums());
          break;
        }
        case "C": {
          do {
            let x1 = readNum();
            let y1 = readNum();
            let x2 = readNum();
            let y2 = readNum();
            let x = readNum();
            let y = readNum();
            if (isRelative) {
              x1 += curX;
              y1 += curY;
              x2 += curX;
              y2 += curY;
              x += curX;
              y += curY;
            }
            commands.push({
              type: "C",
              x1,
              y1,
              x2,
              y2,
              x,
              y,
              fromX: curX,
              fromY: curY,
            });
            lastCX = x2;
            lastCY = y2;
            curX = x;
            curY = y;
          } while (hasMoreNums());
          break;
        }
        case "S": {
          do {
            let x2 = readNum();
            let y2 = readNum();
            let x = readNum();
            let y = readNum();
            if (isRelative) {
              x2 += curX;
              y2 += curY;
              x += curX;
              y += curY;
            }
            let x1 = curX * 2 - lastCX;
            let y1 = curY * 2 - lastCY;
            if (
              lastCmd !== "C" &&
              lastCmd !== "S" &&
              lastCmd !== "c" &&
              lastCmd !== "s"
            ) {
              x1 = curX;
              y1 = curY;
            }
            commands.push({
              type: "C",
              x1,
              y1,
              x2,
              y2,
              x,
              y,
              fromX: curX,
              fromY: curY,
            });
            lastCX = x2;
            lastCY = y2;
            curX = x;
            curY = y;
          } while (hasMoreNums());
          break;
        }
        case "Q": {
          do {
            let qx1 = readNum();
            let qy1 = readNum();
            let x = readNum();
            let y = readNum();
            if (isRelative) {
              qx1 += curX;
              qy1 += curY;
              x += curX;
              y += curY;
            }
            const cx1 = curX + (2 / 3) * (qx1 - curX);
            const cy1 = curY + (2 / 3) * (qy1 - curY);
            const cx2 = x + (2 / 3) * (qx1 - x);
            const cy2 = y + (2 / 3) * (qy1 - y);
            commands.push({
              type: "C",
              x1: cx1,
              y1: cy1,
              x2: cx2,
              y2: cy2,
              x,
              y,
              fromX: curX,
              fromY: curY,
            });
            lastCX = cx2;
            lastCY = cy2;
            curX = x;
            curY = y;
          } while (hasMoreNums());
          break;
        }
        case "T": {
          do {
            let x = readNum();
            let y = readNum();
            if (isRelative) {
              x += curX;
              y += curY;
            }
            const qx = curX * 2 - lastCX;
            const qy = curY * 2 - lastCY;
            const cx1 = curX + (2 / 3) * (qx - curX);
            const cy1 = curY + (2 / 3) * (qy - curY);
            const cx2 = x + (2 / 3) * (qx - x);
            const cy2 = y + (2 / 3) * (qy - y);
            commands.push({
              type: "C",
              x1: cx1,
              y1: cy1,
              x2: cx2,
              y2: cy2,
              x,
              y,
              fromX: curX,
              fromY: curY,
            });
            lastCX = cx2;
            lastCY = cy2;
            curX = x;
            curY = y;
          } while (hasMoreNums());
          break;
        }
        case "A": {
          // Arcs: approximate as line (rare in these arrow files)
          do {
            readNum(); // rx
            readNum(); // ry
            readNum(); // rotation
            readNum(); // large-arc
            readNum(); // sweep
            let x = readNum();
            let y = readNum();
            if (isRelative) {
              x += curX;
              y += curY;
            }
            commands.push({ type: "L", x, y, fromX: curX, fromY: curY });
            curX = x;
            curY = y;
          } while (hasMoreNums());
          break;
        }
        case "Z": {
          commands.push({
            type: "Z",
            x: startX,
            y: startY,
            fromX: curX,
            fromY: curY,
          });
          curX = startX;
          curY = startY;
          break;
        }
      }
      lastCmd = cmd;
    }

    return commands;
  }

  // ============================================================
  // GEOMETRY UTILITIES
  // ============================================================

  function crossSign(lineP1: Point, lineP2: Point, point: Point): number {
    return (
      (lineP2.x - lineP1.x) * (point.y - lineP1.y) -
      (lineP2.y - lineP1.y) * (point.x - lineP1.x)
    );
  }

  function sideOfLine(lineP1: Point, lineP2: Point, point: Point): number {
    const c = crossSign(lineP1, lineP2, point);
    if (Math.abs(c) < 0.001) return 0;
    return c > 0 ? 1 : -1;
  }

  function cubicAt(
    p0x: number,
    p0y: number,
    p1x: number,
    p1y: number,
    p2x: number,
    p2y: number,
    p3x: number,
    p3y: number,
    t: number
  ): Point {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;
    return {
      x: mt3 * p0x + 3 * mt2 * t * p1x + 3 * mt * t2 * p2x + t3 * p3x,
      y: mt3 * p0y + 3 * mt2 * t * p1y + 3 * mt * t2 * p2y + t3 * p3y,
    };
  }

  // De Casteljau split: returns left and right sub-curves as 4 control points each
  function splitCubic(
    p0: Point,
    p1: Point,
    p2: Point,
    p3: Point,
    t: number
  ): { left: [Point, Point, Point, Point]; right: [Point, Point, Point, Point] } {
    const lerp = (a: Point, b: Point, t: number): Point => ({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    });

    const q0 = lerp(p0, p1, t);
    const q1 = lerp(p1, p2, t);
    const q2 = lerp(p2, p3, t);
    const r0 = lerp(q0, q1, t);
    const r1 = lerp(q1, q2, t);
    const s = lerp(r0, r1, t);

    return {
      left: [p0, q0, r0, s],
      right: [s, r1, q2, p3],
    };
  }

  // Find t-values where a cubic bezier crosses a line, using sampling + bisection
  function findCubicLineIntersections(
    p0: Point,
    p1: Point,
    p2: Point,
    p3: Point,
    lineP1: Point,
    lineP2: Point
  ): number[] {
    const intersections: number[] = [];
    const samples = 200;
    let prevVal = crossSign(lineP1, lineP2, p0);

    for (let i = 1; i <= samples; i++) {
      const t = i / samples;
      const pt = cubicAt(
        p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, t
      );
      const val = crossSign(lineP1, lineP2, pt);

      if ((prevVal > 0 && val < 0) || (prevVal < 0 && val > 0)) {
        let lo = (i - 1) / samples;
        let hi = t;
        for (let j = 0; j < 30; j++) {
          const mid = (lo + hi) / 2;
          const midPt = cubicAt(
            p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, mid
          );
          const midVal = crossSign(lineP1, lineP2, midPt);
          if ((prevVal > 0 && midVal > 0) || (prevVal < 0 && midVal < 0)) {
            lo = mid;
          } else {
            hi = mid;
          }
        }
        intersections.push((lo + hi) / 2);
      }
      prevVal = val;
    }

    return intersections;
  }

  // Find intersection t-value of a line segment with the cut line
  function findLineLineIntersection(
    p0: Point,
    p1: Point,
    lineP1: Point,
    lineP2: Point
  ): number[] {
    const s1 = sideOfLine(lineP1, lineP2, p0);
    const s2 = sideOfLine(lineP1, lineP2, p1);
    if (s1 !== 0 && s2 !== 0 && s1 !== s2) {
      const d1 = Math.abs(crossSign(lineP1, lineP2, p0));
      const d2 = Math.abs(crossSign(lineP1, lineP2, p1));
      return [d1 / (d1 + d2)];
    }
    return [];
  }

  function computeOverlapT_line(from: Point, to: Point, overlapUnits: number): number {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return 0;
    return overlapUnits / len;
  }

  function computeOverlapT_cubic(
    p0: Point,
    p1: Point,
    p2: Point,
    p3: Point,
    overlapUnits: number
  ): number {
    let totalLen = 0;
    let prev = p0;
    const steps = 50;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const pt = cubicAt(
        p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, t
      );
      const dx = pt.x - prev.x;
      const dy = pt.y - prev.y;
      totalLen += Math.sqrt(dx * dx + dy * dy);
      prev = pt;
    }
    if (totalLen === 0) return 0;
    return overlapUnits / totalLen;
  }

  // ============================================================
  // PATH SPLITTING
  // ============================================================

  function performSplit() {
    if (cutPoints.length !== 2 || currentParsed.length === 0) return;

    const lineP1 = cutPoints[0]!;
    const lineP2 = cutPoints[1]!;
    const overlap = overlapMargin;

    const sideA: Segment[] = [];
    const sideB: Segment[] = [];

    for (const cmd of currentParsed) {
      if (cmd.type === "M") continue;

      if (cmd.type === "Z") {
        const fromSide = sideOfLine(lineP1, lineP2, {
          x: cmd.fromX,
          y: cmd.fromY,
        });
        const toSide = sideOfLine(lineP1, lineP2, { x: cmd.x, y: cmd.y });

        if (fromSide === toSide || fromSide === 0 || toSide === 0) {
          const seg: Segment = {
            type: "L",
            fromX: cmd.fromX,
            fromY: cmd.fromY,
            x: cmd.x,
            y: cmd.y,
          };
          const side = (fromSide || toSide) >= 0 ? sideA : sideB;
          side.push(seg);
        } else {
          const ts = findLineLineIntersection(
            { x: cmd.fromX, y: cmd.fromY },
            { x: cmd.x, y: cmd.y },
            lineP1,
            lineP2
          );
          if (ts.length > 0) {
            const t = ts[0]!;
            const mx = cmd.fromX + (cmd.x - cmd.fromX) * t;
            const my = cmd.fromY + (cmd.y - cmd.fromY) * t;
            const seg1: Segment = {
              type: "L",
              fromX: cmd.fromX,
              fromY: cmd.fromY,
              x: mx,
              y: my,
            };
            const seg2: Segment = {
              type: "L",
              fromX: mx,
              fromY: my,
              x: cmd.x,
              y: cmd.y,
            };
            if (fromSide >= 0) {
              sideA.push(seg1);
              sideB.push(seg2);
            } else {
              sideB.push(seg1);
              sideA.push(seg2);
            }
          }
        }
        continue;
      }

      if (cmd.type === "L") {
        const from: Point = { x: cmd.fromX, y: cmd.fromY };
        const to: Point = { x: cmd.x, y: cmd.y };
        const fromSide = sideOfLine(lineP1, lineP2, from);
        const toSide = sideOfLine(lineP1, lineP2, to);

        if (fromSide === toSide || fromSide === 0 || toSide === 0) {
          const side = (fromSide || toSide) >= 0 ? sideA : sideB;
          side.push({
            type: "L",
            fromX: from.x,
            fromY: from.y,
            x: to.x,
            y: to.y,
          });
        } else {
          const ts = findLineLineIntersection(from, to, lineP1, lineP2);
          if (ts.length > 0) {
            const t = ts[0]!;
            const overlapT = computeOverlapT_line(from, to, overlap);
            const t1 = Math.min(1, t + overlapT);
            const t2 = Math.max(0, t - overlapT);

            const mx1 = from.x + (to.x - from.x) * t1;
            const my1 = from.y + (to.y - from.y) * t1;
            const mx2 = from.x + (to.x - from.x) * t2;
            const my2 = from.y + (to.y - from.y) * t2;

            const seg1: Segment = {
              type: "L",
              fromX: from.x,
              fromY: from.y,
              x: mx1,
              y: my1,
            };
            const seg2: Segment = {
              type: "L",
              fromX: mx2,
              fromY: my2,
              x: to.x,
              y: to.y,
            };

            if (fromSide >= 0) {
              sideA.push(seg1);
              sideB.push(seg2);
            } else {
              sideB.push(seg1);
              sideA.push(seg2);
            }
          } else {
            const mid: Point = {
              x: (from.x + to.x) / 2,
              y: (from.y + to.y) / 2,
            };
            const side = sideOfLine(lineP1, lineP2, mid) >= 0 ? sideA : sideB;
            side.push({
              type: "L",
              fromX: from.x,
              fromY: from.y,
              x: to.x,
              y: to.y,
            });
          }
        }
        continue;
      }

      if (cmd.type === "C") {
        const p0: Point = { x: cmd.fromX, y: cmd.fromY };
        const p1: Point = { x: cmd.x1, y: cmd.y1 };
        const p2: Point = { x: cmd.x2, y: cmd.y2 };
        const p3: Point = { x: cmd.x, y: cmd.y };

        const intersections = findCubicLineIntersections(
          p0, p1, p2, p3, lineP1, lineP2
        );

        if (intersections.length === 0) {
          const mid = cubicAt(
            p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, 0.5
          );
          const side = sideOfLine(lineP1, lineP2, mid) >= 0 ? sideA : sideB;
          side.push({
            type: "C",
            fromX: p0.x,
            fromY: p0.y,
            x1: p1.x,
            y1: p1.y,
            x2: p2.x,
            y2: p2.y,
            x: p3.x,
            y: p3.y,
          });
        } else {
          const sorted = [...intersections].sort((a, b) => a - b);
          let remaining: [Point, Point, Point, Point] = [p0, p1, p2, p3];
          let tOffset = 0;
          const pieces: { curve: [Point, Point, Point, Point]; side: number }[] = [];

          for (const t of sorted) {
            const localT = (t - tOffset) / (1 - tOffset);
            const clamped = Math.max(0.001, Math.min(0.999, localT));

            const [rp0, rp1, rp2, rp3] = remaining;
            const split = splitCubic(rp0, rp1, rp2, rp3, clamped);

            const overlapT = computeOverlapT_cubic(
              rp0, rp1, rp2, rp3, overlap
            );
            const clampedOverlapPlus = Math.min(0.999, clamped + overlapT);

            const splitForA = splitCubic(
              rp0, rp1, rp2, rp3, clampedOverlapPlus
            );

            pieces.push({
              curve: splitForA.left,
              side: sideOfLine(
                lineP1,
                lineP2,
                cubicAt(
                  rp0.x, rp0.y, rp1.x, rp1.y,
                  rp2.x, rp2.y, rp3.x, rp3.y,
                  clamped / 2
                )
              ),
            });

            remaining = split.right;
            tOffset = t;
          }

          const [fp0, fp1, fp2, fp3] = remaining;
          pieces.push({
            curve: remaining,
            side: sideOfLine(
              lineP1,
              lineP2,
              cubicAt(
                fp0.x, fp0.y, fp1.x, fp1.y,
                fp2.x, fp2.y, fp3.x, fp3.y,
                0.5
              )
            ),
          });

          for (const piece of pieces) {
            const [cp0, cp1, cp2, cp3] = piece.curve;
            const seg: Segment = {
              type: "C",
              fromX: cp0.x,
              fromY: cp0.y,
              x1: cp1.x,
              y1: cp1.y,
              x2: cp2.x,
              y2: cp2.y,
              x: cp3.x,
              y: cp3.y,
            };
            if (piece.side >= 0) sideA.push(seg);
            else sideB.push(seg);
          }
        }
      }
    }

    // The side with fewer segments is the tip
    let tipSegs: Segment[];
    let shaftSegs: Segment[];
    if (sideA.length <= sideB.length) {
      tipSegs = sideA;
      shaftSegs = sideB;
    } else {
      tipSegs = sideB;
      shaftSegs = sideA;
    }

    const shaftD = buildPathFromSegments(shaftSegs);
    const tipD = buildPathFromSegments(tipSegs);

    if (!shaftD || !tipD) {
      setStatus("Could not split at this line. Try a different position.", "error");
      return;
    }

    const tipBBox = computeBBox(tipSegs);

    currentSplitResult = {
      shaftPath: `<path d="${shaftD}" style="fill:#2e3192"/>`,
      tipPath: `<path d="${tipD}" style="fill:#2e3192"/>`,
      tipBBox,
    };

    // Store the d-strings for preview rendering (avoids regex extraction)
    previewShaftD = shaftD;
    previewTipD = tipD;
  }

  // Temporary preview d-strings (set by performSplit, cleared on navigation)
  let previewShaftD = $state<string | null>(null);
  let previewTipD = $state<string | null>(null);

  // The d-strings to actually show in preview boxes
  const displayShaftD = $derived(previewShaftD ?? savedShaftD);
  const displayTipD = $derived(previewTipD ?? savedTipD);
  const showPreview = $derived(displayShaftD !== null && displayTipD !== null);

  // ============================================================
  // SEGMENT ORDERING & PATH BUILDING
  // ============================================================

  function pointDist(a: Point, b: Point): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function flipSegment(seg: Segment): Segment {
    if (seg.type === "L") {
      return { type: "L", fromX: seg.x, fromY: seg.y, x: seg.fromX, y: seg.fromY };
    }
    if (seg.type === "C") {
      return {
        type: "C",
        fromX: seg.x,
        fromY: seg.y,
        x1: seg.x2!,
        y1: seg.y2!,
        x2: seg.x1!,
        y2: seg.y1!,
        x: seg.fromX,
        y: seg.fromY,
      };
    }
    return seg;
  }

  function orderSegments(segs: Segment[]): Segment[] {
    if (segs.length === 0) return [];

    const used = new Set<number>();
    const result: Segment[] = [];

    result.push(segs[0]!);
    used.add(0);
    let curEnd: Point = { x: segs[0]!.x, y: segs[0]!.y };

    while (used.size < segs.length) {
      let bestIdx = -1;
      let bestDist = Infinity;
      let bestFlip = false;

      for (let i = 0; i < segs.length; i++) {
        if (used.has(i)) continue;
        const s = segs[i]!;

        const d1 = pointDist(curEnd, { x: s.fromX, y: s.fromY });
        const d2 = pointDist(curEnd, { x: s.x, y: s.y });

        if (d1 < bestDist) {
          bestDist = d1;
          bestIdx = i;
          bestFlip = false;
        }
        if (d2 < bestDist) {
          bestDist = d2;
          bestIdx = i;
          bestFlip = true;
        }
      }

      if (bestIdx === -1) break;
      used.add(bestIdx);

      let seg: Segment = { ...segs[bestIdx]! };
      if (bestFlip) seg = flipSegment(seg);

      result.push(seg);
      curEnd = { x: seg.x, y: seg.y };
    }

    return result;
  }

  function fmt(n: number): number {
    return Math.round(n * 100) / 100;
  }

  function buildPathFromSegments(segs: Segment[]): string {
    if (segs.length === 0) return "";

    const ordered = orderSegments(segs);
    if (ordered.length === 0) return "";

    let d = `M${fmt(ordered[0]!.fromX)} ${fmt(ordered[0]!.fromY)}`;
    for (const seg of ordered) {
      if (seg.type === "L") {
        d += ` L${fmt(seg.x)} ${fmt(seg.y)}`;
      } else if (seg.type === "C") {
        d += ` C${fmt(seg.x1!)} ${fmt(seg.y1!)} ${fmt(seg.x2!)} ${fmt(seg.y2!)} ${fmt(seg.x)} ${fmt(seg.y)}`;
      }
    }

    return d;
  }

  function computeBBox(segs: Segment[]): BBox {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    function update(x: number, y: number) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }

    for (const seg of segs) {
      update(seg.fromX, seg.fromY);
      update(seg.x, seg.y);
      if (seg.type === "C") {
        for (let t = 0; t <= 1; t += 0.05) {
          const pt = cubicAt(
            seg.fromX, seg.fromY,
            seg.x1!, seg.y1!,
            seg.x2!, seg.y2!,
            seg.x, seg.y,
            t
          );
          update(pt.x, pt.y);
        }
      }
    }

    return {
      x: Math.round(minX),
      y: Math.round(minY),
      width: Math.round(maxX - minX),
      height: Math.round(maxY - minY),
    };
  }

  // ============================================================
  // NAVIGATION & ACTIONS
  // ============================================================

  function saveAndNext() {
    if (!currentSplitResult) return;
    const file = ARROW_FILES[currentIndex]!;
    manifest = { ...manifest, [file]: currentSplitResult };
    setStatus(`Saved: ${file}`, "saved");
    goNext();
  }

  function goNext() {
    if (currentIndex < ARROW_FILES.length - 1) {
      currentIndex++;
      previewShaftD = null;
      previewTipD = null;
      loadCurrentArrow();
    } else {
      setStatus("All arrows processed!", "saved");
    }
  }

  function goPrev() {
    if (currentIndex > 0) {
      currentIndex--;
      previewShaftD = null;
      previewTipD = null;
      loadCurrentArrow();
    }
  }

  function clearCut() {
    cutPoints = [];
    currentSplitResult = null;
    previewShaftD = null;
    previewTipD = null;
  }

  function setStatus(msg: string, type: "" | "saved" | "error" = "") {
    statusMessage = msg;
    statusType = type;
  }

  // ============================================================
  // MANIFEST LOAD / DOWNLOAD
  // ============================================================

  function downloadManifest() {
    const json = JSON.stringify(manifest, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "arrow-split-manifest.json";
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Manifest downloaded", "saved");
  }

  function triggerLoadManifest() {
    manifestFileInput?.click();
  }

  async function handleManifestLoad(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const loaded = JSON.parse(text) as Manifest;
      manifest = { ...manifest, ...loaded };
      setStatus(
        `Manifest loaded: ${Object.keys(loaded).length} entries`,
        "saved"
      );
      if (arrowsLoaded) loadCurrentArrow();
    } catch (err) {
      setStatus(
        `Failed to parse manifest: ${err instanceof Error ? err.message : String(err)}`,
        "error"
      );
    }
    input.value = "";
  }

  // ============================================================
  // KEYBOARD SHORTCUTS
  // ============================================================

  function handleKeydown(e: KeyboardEvent) {
    if (
      (e.target as HTMLElement).tagName === "INPUT" ||
      (e.target as HTMLElement).tagName === "TEXTAREA"
    )
      return;

    switch (e.key) {
      case "Enter":
        if (canSave) saveAndNext();
        break;
      case "s":
      case "S":
        if (canNavigate) goNext();
        break;
      case "Backspace":
        e.preventDefault();
        if (canNavigate) goPrev();
        break;
      case "Escape":
        clearCut();
        break;
    }
  }

  // ============================================================
  // OVERLAP SLIDER RE-SPLIT
  // ============================================================

  function handleOverlapChange() {
    if (cutPoints.length === 2 && currentParsed.length > 0) {
      performSplit();
    }
  }

  // ============================================================
  // LIFECYCLE
  // ============================================================

  $effect(() => {
    loadArrows();
  });
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="lab-container">
  <!-- TOP BAR -->
  <div class="top-bar">
    <span class="progress">{progressLabel}</span>
    <span class="filename">{currentFile || "No arrow loaded"}</span>
    <button class="bar-btn" onclick={triggerLoadManifest}>Load Manifest</button>
    <button class="bar-btn" onclick={downloadManifest}>Download Manifest</button>
  </div>

  <!-- MAIN LAYOUT -->
  <div class="main-layout">
    <!-- LEFT: SVG viewport -->
    <div class="left-panel">
      <div class="instructions">{instructionText}</div>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="svg-viewport"
        bind:this={svgViewportEl}
        onclick={handleViewportClick}
      >
        {#if !arrowsLoaded}
          <div class="no-arrows">
            {#if loading}
              Loading arrows...
            {:else}
              No arrows loaded
            {/if}
          </div>
        {:else if !currentPathD}
          <div class="no-arrows">SVG not loaded for this arrow</div>
        {:else}
          <svg
            viewBox={paddedViewBox}
            preserveAspectRatio="xMidYMid meet"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d={currentPathD} fill="#4a8cff" stroke="#6ab0ff" stroke-width="1" />
          </svg>
        {/if}
      </div>
      <!-- Cut line overlay -->
      {#if currentPathD && cutPoints.length > 0}
        <svg
          class="cut-line-overlay"
          viewBox={paddedViewBox}
          preserveAspectRatio="none"
        >
          {@html cutOverlayContent}
        </svg>
      {/if}
    </div>

    <!-- RIGHT: controls -->
    <div class="right-panel">
      <h3>Preview</h3>
      {#if showPreview}
        <div class="preview-pair">
          <div>
            <div class="preview-box">
              <svg
                viewBox={previewViewBox}
                preserveAspectRatio="xMidYMid meet"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d={displayShaftD} fill="#4caf50" stroke="#81c784" stroke-width="1" />
              </svg>
            </div>
            <div class="preview-label">Shaft</div>
          </div>
          <div>
            <div class="preview-box">
              <svg
                viewBox={previewViewBox}
                preserveAspectRatio="xMidYMid meet"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d={displayTipD} fill="#ff9800" stroke="#ffb74d" stroke-width="1" />
              </svg>
            </div>
            <div class="preview-label">Tip</div>
          </div>
        </div>
      {:else}
        <div class="preview-box empty">Draw a cut line to see preview</div>
      {/if}

      <h3>Overlap Margin</h3>
      <div class="slider-row">
        <input
          type="range"
          min="0"
          max="20"
          step="1"
          bind:value={overlapMargin}
          oninput={handleOverlapChange}
        />
        <span class="slider-value">{overlapMargin}</span>
        <span class="slider-unit">SVG units</span>
      </div>

      <h3>Actions</h3>
      <div class="button-row">
        <button class="btn primary" disabled={!canSave} onclick={saveAndNext}>
          Save &amp; Next
        </button>
        <button class="btn" disabled={!canNavigate} onclick={() => goNext()}>
          Skip
        </button>
      </div>
      <div class="button-row">
        <button class="btn" disabled={!canNavigate} onclick={() => goPrev()}>
          Previous
        </button>
        <button
          class="btn danger"
          disabled={cutPoints.length === 0 && !currentSplitResult}
          onclick={clearCut}
        >
          Clear Cut
        </button>
      </div>

      {#if statusMessage}
        <div class="status-text {statusType}">{statusMessage}</div>
      {/if}

      <h3>Manifest</h3>
      <div class="manifest-stats">
        <span class="count">{manifestCount}</span> / {ARROW_FILES.length} arrows split
      </div>

      <h3>Keyboard</h3>
      <div class="kbd-hints">
        <kbd>Enter</kbd> Save &amp; Next<br />
        <kbd>S</kbd> Skip<br />
        <kbd>Backspace</kbd> Previous<br />
        <kbd>Escape</kbd> Clear cut
      </div>
    </div>
  </div>

  <!-- Hidden file input for manifest loading -->
  <input
    type="file"
    accept=".json"
    style="display:none"
    bind:this={manifestFileInput}
    onchange={handleManifestLoad}
  />
</div>

<style>
  .lab-container {
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    color: var(--theme-text, #e0e0e0);
  }

  /* TOP BAR */
  .top-bar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 20px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  .top-bar .progress {
    font-weight: 600;
    color: #64ffda;
    min-width: 60px;
  }

  .top-bar .filename {
    flex: 1;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bar-btn {
    padding: 6px 14px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: transparent;
    color: var(--theme-text-muted, #ccc);
    border-radius: 4px;
    cursor: pointer;
    font-size: var(--font-size-compact, 13px);
    white-space: nowrap;
  }

  .bar-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border-color: #64ffda;
    color: var(--theme-text, #fff);
  }

  /* MAIN LAYOUT */
  .main-layout {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  /* LEFT PANEL */
  .left-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    position: relative;
  }

  .instructions {
    padding: 8px 16px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.02));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  .svg-viewport {
    flex: 1;
    position: relative;
    cursor: crosshair;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.2);
  }

  .svg-viewport svg {
    width: 100%;
    height: 100%;
  }

  .no-arrows {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
    font-size: 16px;
  }

  /* Cut line overlay */
  .cut-line-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
  }

  .cut-line-overlay :global(.cut-point) {
    fill: #ff4444;
    stroke: #fff;
    stroke-width: 2;
  }

  .cut-line-overlay :global(.cut-line-visual) {
    stroke: #ff4444;
    stroke-width: 2;
    stroke-dasharray: 6 4;
  }

  /* RIGHT PANEL */
  .right-panel {
    width: 380px;
    display: flex;
    flex-direction: column;
    padding: 16px;
    gap: 12px;
    overflow-y: auto;
    flex-shrink: 0;
  }

  .right-panel h3 {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 1px;
    margin: 0;
  }

  /* Preview */
  .preview-pair {
    display: flex;
    gap: 8px;
  }

  .preview-pair > div {
    flex: 1;
  }

  .preview-box {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    padding: 8px;
    min-height: 160px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preview-box.empty {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
    font-size: var(--font-size-compact, 13px);
  }

  .preview-box svg {
    max-width: 100%;
    max-height: 150px;
  }

  .preview-label {
    font-size: var(--font-size-compact, 11px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    margin-top: 4px;
    text-align: center;
  }

  /* Slider */
  .slider-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: var(--font-size-compact, 13px);
  }

  .slider-row input[type="range"] {
    flex: 1;
  }

  .slider-value {
    min-width: 30px;
    text-align: right;
    color: #64ffda;
  }

  .slider-unit {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    font-size: var(--font-size-compact, 12px);
  }

  /* Buttons */
  .button-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .btn {
    padding: 8px 16px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    background: transparent;
    color: var(--theme-text-muted, #ccc);
    border-radius: 4px;
    cursor: pointer;
    font-size: var(--font-size-compact, 13px);
    flex: 1;
    text-align: center;
  }

  .btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border-color: #64ffda;
    color: var(--theme-text, #fff);
  }

  .btn.primary {
    background: #1b5e20;
    border-color: #4caf50;
    color: #fff;
  }

  .btn.primary:hover {
    background: #2e7d32;
  }

  .btn.danger {
    border-color: #c62828;
  }

  .btn.danger:hover {
    background: #b71c1c;
    color: #fff;
  }

  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn:disabled:hover {
    background: transparent;
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.15));
    color: var(--theme-text-muted, #ccc);
  }

  .btn.primary:disabled:hover {
    background: #1b5e20;
    border-color: #4caf50;
  }

  /* Status */
  .status-text {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    padding: 4px 0;
  }

  .status-text.saved {
    color: #4caf50;
  }

  .status-text.error {
    color: var(--semantic-error, #f44336);
  }

  /* Manifest stats */
  .manifest-stats {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    padding: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.02));
    border-radius: 4px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  .manifest-stats .count {
    color: #64ffda;
    font-weight: 600;
  }

  /* Keyboard hints */
  .kbd-hints {
    font-size: var(--font-size-compact, 11px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
    line-height: 1.6;
  }

  .kbd-hints kbd {
    display: inline-block;
    padding: 1px 5px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 3px;
    font-family: monospace;
    color: var(--theme-text-muted, #aaa);
  }
</style>
