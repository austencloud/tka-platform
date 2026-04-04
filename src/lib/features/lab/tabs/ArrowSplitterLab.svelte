<!--
  ArrowSplitterLab.svelte — Split arrow SVGs into shaft and tip portions

  Click on path segments to paint them as "tip" (orange).
  Everything else is "shaft" (green). No cut-line math needed.
-->
<script lang="ts">
  // ============================================================
  // TYPES
  // ============================================================

  interface Segment {
    d: string; // SVG path fragment for this segment (e.g. "M10,20 C30,40 50,60 70,80")
    isTip: boolean;
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

  interface ViewBox {
    x: number;
    y: number;
    w: number;
    h: number;
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

  let loading = $state(false);
  let loadProgress = $state("");
  let currentIndex = $state(0);
  let svgTexts = $state<Record<string, string>>({});
  let manifest = $state<Manifest>({});
  let segments = $state<Segment[]>([]);
  let currentViewBox = $state<ViewBox | null>(null);
  let currentPathD = $state("");
  let statusMessage = $state("");
  let statusType = $state<"" | "saved" | "error">("");

  const currentFile = $derived(ARROW_FILES[currentIndex] ?? "");
  const arrowsLoaded = $derived(Object.keys(svgTexts).length > 0);
  const totalCount = $derived(ARROW_FILES.length);
  const splitCount = $derived(Object.keys(manifest).length);
  const hasTipSegments = $derived(segments.some(s => s.isTip));

  const paddedViewBox = $derived.by(() => {
    if (!currentViewBox) return "0 0 300 300";
    const pad = 20;
    return `${currentViewBox.x - pad} ${currentViewBox.y - pad} ${currentViewBox.w + pad * 2} ${currentViewBox.h + pad * 2}`;
  });

  // ============================================================
  // LOAD ARROWS
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
        // skip
      }
    }

    svgTexts = texts;
    loading = false;

    if (loaded === 0) {
      setStatus("No arrows found. Make sure dev server is running.", "error");
      return;
    }

    setStatus(`Loaded ${loaded}/${ARROW_FILES.length} arrows`, "saved");

    const firstUnsplit = ARROW_FILES.findIndex(f => svgTexts[f] && !manifest[f]);
    currentIndex = firstUnsplit === -1 ? 0 : firstUnsplit;
    loadCurrentArrow();
  }

  $effect(() => {
    loadArrows();
  });

  // ============================================================
  // PARSE ARROW INTO CLICKABLE SEGMENTS
  // ============================================================

  function loadCurrentArrow() {
    const file = ARROW_FILES[currentIndex]!;
    segments = [];
    currentPathD = "";
    currentViewBox = null;

    if (!svgTexts[file]) return;

    const svgText = svgTexts[file];
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const svgEl = doc.querySelector("svg");
    const pathEl = doc.querySelector("path");

    if (!svgEl || !pathEl) return;

    const vb = svgEl.getAttribute("viewBox");
    if (vb) {
      const parts = vb.split(/[\s,]+/).map(Number);
      currentViewBox = { x: parts[0]!, y: parts[1]!, w: parts[2]!, h: parts[3]! };
    } else {
      currentViewBox = { x: 0, y: 0, w: 300, h: 300 };
    }

    currentPathD = pathEl.getAttribute("d") ?? "";

    // Break the path into individual drawable segments.
    // Each segment is one command (line, curve) with its own M prefix so it renders standalone.
    segments = splitIntoSegments(currentPathD);
  }

  // Parse path d-string into individual segments, each with its own renderable d-string.
  // We tokenize the path, then for each drawing command (L, C, etc.) we emit a segment
  // that starts with M at the current point and includes just that one command.
  function splitIntoSegments(d: string): Segment[] {
    const result: Segment[] = [];

    // Tokenize: extract commands and numbers
    const tokenRe = /([MmCcLlHhVvSsQqTtAaZz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
    const tokens: { type: "cmd" | "num"; value: string | number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = tokenRe.exec(d)) !== null) {
      if (m[1]) tokens.push({ type: "cmd", value: m[1] });
      else tokens.push({ type: "num", value: parseFloat(m[2]!) });
    }

    let i = 0;
    let curX = 0, curY = 0;
    let startX = 0, startY = 0;
    let lastCmd = "";

    function num(): number {
      while (i < tokens.length && tokens[i]!.type === "cmd") i++;
      if (i >= tokens.length) return 0;
      return tokens[i++]!.value as number;
    }

    function hasNums(): boolean {
      return i < tokens.length && tokens[i]!.type === "num";
    }

    while (i < tokens.length) {
      let cmd = "";
      if (tokens[i]!.type === "cmd") {
        cmd = tokens[i]!.value as string;
        i++;
      } else {
        // Implicit repeat of last command
        cmd = lastCmd;
        // After M, implicit repeats become L
        if (cmd === "M") cmd = "L";
        if (cmd === "m") cmd = "l";
      }

      lastCmd = cmd;

      switch (cmd) {
        case "M":
          curX = num(); curY = num();
          startX = curX; startY = curY;
          // Process implicit L commands after M
          while (hasNums()) {
            const fromX = curX, fromY = curY;
            curX = num(); curY = num();
            result.push({ d: `M${fromX},${fromY} L${curX},${curY}`, isTip: false });
          }
          break;
        case "m":
          curX += num(); curY += num();
          startX = curX; startY = curY;
          while (hasNums()) {
            const fromX = curX, fromY = curY;
            curX += num(); curY += num();
            result.push({ d: `M${fromX},${fromY} L${curX},${curY}`, isTip: false });
          }
          break;
        case "L": {
          do {
            const fromX = curX, fromY = curY;
            curX = num(); curY = num();
            result.push({ d: `M${fromX},${fromY} L${curX},${curY}`, isTip: false });
          } while (hasNums());
          break;
        }
        case "l": {
          do {
            const fromX = curX, fromY = curY;
            curX += num(); curY += num();
            result.push({ d: `M${fromX},${fromY} L${curX},${curY}`, isTip: false });
          } while (hasNums());
          break;
        }
        case "H": {
          do {
            const fromX = curX;
            curX = num();
            result.push({ d: `M${fromX},${curY} L${curX},${curY}`, isTip: false });
          } while (hasNums());
          break;
        }
        case "h": {
          do {
            const fromX = curX;
            curX += num();
            result.push({ d: `M${fromX},${curY} L${curX},${curY}`, isTip: false });
          } while (hasNums());
          break;
        }
        case "V": {
          do {
            const fromY = curY;
            curY = num();
            result.push({ d: `M${curX},${fromY} L${curX},${curY}`, isTip: false });
          } while (hasNums());
          break;
        }
        case "v": {
          do {
            const fromY = curY;
            curY += num();
            result.push({ d: `M${curX},${fromY} L${curX},${curY}`, isTip: false });
          } while (hasNums());
          break;
        }
        case "C": {
          do {
            const fromX = curX, fromY = curY;
            const x1 = num(), y1 = num(), x2 = num(), y2 = num();
            curX = num(); curY = num();
            result.push({ d: `M${fromX},${fromY} C${x1},${y1} ${x2},${y2} ${curX},${curY}`, isTip: false });
          } while (hasNums());
          break;
        }
        case "c": {
          do {
            const fromX = curX, fromY = curY;
            const dx1 = num(), dy1 = num(), dx2 = num(), dy2 = num(), dx = num(), dy = num();
            const x1 = curX + dx1, y1 = curY + dy1, x2 = curX + dx2, y2 = curY + dy2;
            curX += dx; curY += dy;
            result.push({ d: `M${fromX},${fromY} C${x1},${y1} ${x2},${y2} ${curX},${curY}`, isTip: false });
          } while (hasNums());
          break;
        }
        case "S": {
          do {
            const fromX = curX, fromY = curY;
            const x2 = num(), y2 = num();
            curX = num(); curY = num();
            // Approximate smooth cubic as regular cubic with reflected control point
            result.push({ d: `M${fromX},${fromY} C${fromX},${fromY} ${x2},${y2} ${curX},${curY}`, isTip: false });
          } while (hasNums());
          break;
        }
        case "s": {
          do {
            const fromX = curX, fromY = curY;
            const dx2 = num(), dy2 = num(), dx = num(), dy = num();
            const x2 = curX + dx2, y2 = curY + dy2;
            curX += dx; curY += dy;
            result.push({ d: `M${fromX},${fromY} C${fromX},${fromY} ${x2},${y2} ${curX},${curY}`, isTip: false });
          } while (hasNums());
          break;
        }
        case "Q": {
          do {
            const fromX = curX, fromY = curY;
            const x1 = num(), y1 = num();
            curX = num(); curY = num();
            // Convert quadratic to cubic approximation
            const cx1 = fromX + 2/3 * (x1 - fromX), cy1 = fromY + 2/3 * (y1 - fromY);
            const cx2 = curX + 2/3 * (x1 - curX), cy2 = curY + 2/3 * (y1 - curY);
            result.push({ d: `M${fromX},${fromY} C${cx1},${cy1} ${cx2},${cy2} ${curX},${curY}`, isTip: false });
          } while (hasNums());
          break;
        }
        case "q": {
          do {
            const fromX = curX, fromY = curY;
            const dx1 = num(), dy1 = num(), dx = num(), dy = num();
            const x1 = curX + dx1, y1 = curY + dy1;
            curX += dx; curY += dy;
            const cx1 = fromX + 2/3 * (x1 - fromX), cy1 = fromY + 2/3 * (y1 - fromY);
            const cx2 = curX + 2/3 * (x1 - curX), cy2 = curY + 2/3 * (y1 - curY);
            result.push({ d: `M${fromX},${fromY} C${cx1},${cy1} ${cx2},${cy2} ${curX},${curY}`, isTip: false });
          } while (hasNums());
          break;
        }
        case "Z":
        case "z": {
          if (curX !== startX || curY !== startY) {
            result.push({ d: `M${curX},${curY} L${startX},${startY}`, isTip: false });
          }
          curX = startX; curY = startY;
          break;
        }
        default:
          // Skip unsupported (A/a, T/t) — consume their numbers
          while (hasNums()) num();
          break;
      }
    }

    return result;
  }

  // ============================================================
  // SEGMENT INTERACTION
  // ============================================================

  function toggleSegment(index: number) {
    segments[index] = { ...segments[index]!, isTip: !segments[index]!.isTip };
  }

  // ============================================================
  // SAVE / NAVIGATE
  // ============================================================

  function buildSplitResult(): SplitResult | null {
    const tipSegs = segments.filter(s => s.isTip);
    const shaftSegs = segments.filter(s => !s.isTip);

    if (tipSegs.length === 0 || shaftSegs.length === 0) return null;

    // Build combined d-strings wrapped in path elements
    const tipD = tipSegs.map(s => s.d).join(" ");
    const shaftD = shaftSegs.map(s => s.d).join(" ");

    // Compute tip bounding box from the tip path segments
    const tipBBox = computeBBoxFromD(tipD);

    return {
      shaftPath: `<path d="${shaftD}" style="fill:#2e3192"/>`,
      tipPath: `<path d="${tipD}" style="fill:#2e3192"/>`,
      tipBBox,
    };
  }

  function computeBBoxFromD(d: string): BBox {
    // Extract all numbers from M/L/C commands and find min/max
    const numRe = /[+-]?(?:\d+\.?\d*|\.\d+)/g;
    const nums: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = numRe.exec(d)) !== null) {
      nums.push(parseFloat(m[0]));
    }

    if (nums.length < 2) return { x: 0, y: 0, width: 0, height: 0 };

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < nums.length; i += 2) {
      const x = nums[i]!, y = nums[i + 1]!;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  function saveAndNext() {
    const result = buildSplitResult();
    if (!result) {
      setStatus("Select at least one segment as tip first.", "error");
      return;
    }

    manifest = { ...manifest, [currentFile]: result };
    setStatus(`Saved ${currentFile}`, "saved");
    goNext();
  }

  function goNext() {
    if (currentIndex < ARROW_FILES.length - 1) {
      currentIndex++;
      loadCurrentArrow();
    }
  }

  function goPrev() {
    if (currentIndex > 0) {
      currentIndex--;
      loadCurrentArrow();
    }
  }

  function clearSelection() {
    segments = segments.map(s => ({ ...s, isTip: false }));
  }

  function setStatus(msg: string, type: "" | "saved" | "error" = "") {
    statusMessage = msg;
    statusType = type;
  }

  // ============================================================
  // MANIFEST I/O
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
  }

  function triggerLoadManifest() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          manifest = JSON.parse(reader.result as string);
          setStatus(`Loaded manifest (${Object.keys(manifest).length} entries)`, "saved");
          // Jump to first unsplit
          const firstUnsplit = ARROW_FILES.findIndex(f => svgTexts[f] && !manifest[f]);
          if (firstUnsplit !== -1) {
            currentIndex = firstUnsplit;
            loadCurrentArrow();
          }
        } catch {
          setStatus("Invalid manifest JSON", "error");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // ============================================================
  // KEYBOARD SHORTCUTS
  // ============================================================

  function handleKeydown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === "Enter") { e.preventDefault(); saveAndNext(); }
    if (e.key === "s" || e.key === "S") { e.preventDefault(); goNext(); }
    if (e.key === "Backspace") { e.preventDefault(); goPrev(); }
    if (e.key === "Escape") { e.preventDefault(); clearSelection(); }
  }

  $effect(() => {
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });
</script>

<!-- TOP BAR -->
<div class="lab-container">
  <div class="top-bar">
    <span class="progress">{currentIndex + 1}/{totalCount}</span>
    <span class="filename">{currentFile}</span>
    <button class="bar-btn" onclick={triggerLoadManifest}>Load Manifest</button>
    <button class="bar-btn" onclick={downloadManifest}>Download Manifest</button>
  </div>

  <div class="instructions">
    Click segments to mark them as <strong style="color: #ff9800;">tip</strong> (orange). Unclicked segments stay as <strong style="color: #4caf50;">shaft</strong> (green). Then Save & Next.
  </div>

  <!-- MAIN LAYOUT -->
  <div class="main-layout">
    <!-- LEFT: SVG viewport with clickable segments -->
    <div class="left-panel">
      {#if !arrowsLoaded}
        <div class="no-arrows">
          {#if loading}Loading arrows...{:else}No arrows loaded{/if}
        </div>
      {:else if segments.length === 0}
        <div class="no-arrows">No path data for this arrow</div>
      {:else}
        <svg
          viewBox={paddedViewBox}
          preserveAspectRatio="xMidYMid meet"
          xmlns="http://www.w3.org/2000/svg"
        >
          <!-- Render each segment as a separate clickable path -->
          {#each segments as seg, idx}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <path
              d={seg.d}
              fill={seg.isTip ? "#ff9800" : "#4caf50"}
              stroke={seg.isTip ? "#ffcc80" : "#81c784"}
              stroke-width="2"
              class="segment"
              class:tip={seg.isTip}
              onclick={() => toggleSegment(idx)}
            />
          {/each}
        </svg>
      {/if}
    </div>

    <!-- RIGHT: controls -->
    <div class="right-panel">
      <h3>Preview</h3>
      {#if hasTipSegments && currentViewBox}
        <div class="preview-pair">
          <div>
            <div class="preview-box">
              <svg viewBox={paddedViewBox} preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
                {#each segments.filter(s => !s.isTip) as seg}
                  <path d={seg.d} fill="#4caf50" />
                {/each}
              </svg>
            </div>
            <div class="preview-label">Shaft</div>
          </div>
          <div>
            <div class="preview-box">
              <svg viewBox={paddedViewBox} preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
                {#each segments.filter(s => s.isTip) as seg}
                  <path d={seg.d} fill="#ff9800" />
                {/each}
              </svg>
            </div>
            <div class="preview-label">Tip</div>
          </div>
        </div>
      {:else}
        <div class="preview-box empty">Click segments to mark as tip</div>
      {/if}

      <h3>Actions</h3>
      <div class="button-row">
        <button class="btn primary" disabled={!hasTipSegments} onclick={saveAndNext}>Save & Next</button>
        <button class="btn" onclick={goNext}>Skip</button>
      </div>
      <div class="button-row">
        <button class="btn" onclick={goPrev}>Previous</button>
        <button class="btn danger" onclick={clearSelection}>Clear</button>
      </div>

      {#if statusMessage}
        <div class="status-text {statusType}">{statusMessage}</div>
      {/if}

      <h3>Manifest</h3>
      <div class="manifest-stats">
        <span class="count">{splitCount}</span> / {totalCount} arrows split
      </div>

      <h3>Keyboard</h3>
      <div class="kbd-hints">
        <kbd>Enter</kbd> Save & Next<br/>
        <kbd>S</kbd> Skip<br/>
        <kbd>Backspace</kbd> Previous<br/>
        <kbd>Escape</kbd> Clear
      </div>
    </div>
  </div>
</div>

<style>
  .lab-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  .top-bar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  .top-bar .progress {
    font-weight: 600;
    color: #64ffda;
    min-width: 50px;
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
  }

  .bar-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border-color: #64ffda;
  }

  .instructions {
    padding: 8px 16px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.02));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    flex-shrink: 0;
  }

  .main-layout {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .left-panel {
    flex: 1;
    display: flex;
    background: rgba(0, 0, 0, 0.2);
    overflow: hidden;
  }

  .left-panel svg {
    width: 100%;
    height: 100%;
  }

  .no-arrows {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
    font-size: 16px;
  }

  /* Clickable segments */
  .segment {
    cursor: pointer;
    transition: opacity 0.1s;
  }

  .segment:hover {
    opacity: 0.7;
    stroke-width: 4;
  }

  /* RIGHT PANEL */
  .right-panel {
    width: 300px;
    display: flex;
    flex-direction: column;
    padding: 16px;
    gap: 12px;
    overflow-y: auto;
    flex-shrink: 0;
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .right-panel h3 {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    text-transform: uppercase;
    letter-spacing: 1px;
    margin: 0;
  }

  .preview-pair {
    display: flex;
    gap: 8px;
  }

  .preview-pair > div {
    flex: 1;
  }

  .preview-box {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 6px;
    padding: 8px;
    min-height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preview-box.empty {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
    font-size: var(--font-size-compact, 12px);
  }

  .preview-box svg {
    max-width: 100%;
    max-height: 100px;
  }

  .preview-label {
    font-size: 11px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    margin-top: 4px;
    text-align: center;
  }

  .button-row {
    display: flex;
    gap: 8px;
  }

  .btn {
    padding: 8px 16px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
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
  }

  .btn.primary {
    background: #1b5e20;
    border-color: #4caf50;
    color: #fff;
  }

  .btn.primary:hover {
    background: #2e7d32;
  }

  .btn.primary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn.danger:hover {
    background: rgba(198, 40, 40, 0.3);
    border-color: #c62828;
  }

  .status-text {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    padding: 4px 0;
  }

  .status-text.saved {
    color: #4caf50;
  }

  .status-text.error {
    color: #f44336;
  }

  .manifest-stats {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    padding: 8px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
  }

  .manifest-stats .count {
    color: #64ffda;
    font-weight: 600;
  }

  .kbd-hints {
    font-size: 11px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
    line-height: 1.8;
  }

  .kbd-hints kbd {
    display: inline-block;
    padding: 1px 5px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    font-family: monospace;
    color: var(--theme-text-muted, #aaa);
  }
</style>
