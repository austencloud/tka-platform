/**
 * Card Back Theme Visuals
 *
 * Produces the full visual treatment for each background theme on
 * choreo card backs. Uses the ACTUAL shapes from the background
 * package: real leaf SVG paths, proper snowflake geometry, fish
 * body curves, cherry blossom petal shapes, etc.
 *
 * Returns CSS background layers and border gradients. Decorative
 * elements use low opacity so card text remains readable.
 */

export interface CardBackThemeVisuals {
  /** CSS gradient for the border frame background */
  borderGradient: string;
  /** CSS background property for the inner card — multiple layers */
  background: string;
  /** Accent color for LOOP title, badges, etc. */
  accentColor: string;
}

// ============================================================================
// SVG HELPERS
// ============================================================================

function svgUri(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function svgWrap(w: number, h: number, content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${content}</svg>`;
}

/** Deterministic pseudo-random number generator */
function prng(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
}

// ============================================================================
// NIGHT SKY — Stars, moon, aurora
// ============================================================================

function nightSkySvg(): string {
  const rand = prng(42);
  const stars: string[] = [];

  // Star field: many small dots with varying brightness
  for (let i = 0; i < 150; i++) {
    const x = rand() * 500;
    const y = rand() * 700;
    const r = 0.3 + rand() * 1.8;
    const opacity = 0.2 + rand() * 0.6;
    const color = rand() > 0.8 ? "#c4b5fd" : rand() > 0.5 ? "#bfdbfe" : "#ffffff";
    stars.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${color}" opacity="${opacity.toFixed(2)}"/>`);
  }

  // Moon glow — upper right
  const moon = `
    <defs><radialGradient id="mg" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="#f5f5dc" stop-opacity="0.12"/>
      <stop offset="50%" stop-color="#f5f5dc" stop-opacity="0.04"/>
      <stop offset="100%" stop-color="#f5f5dc" stop-opacity="0"/>
    </radialGradient></defs>
    <circle cx="415" cy="85" r="70" fill="url(#mg)"/>
    <circle cx="415" cy="85" r="18" fill="#f5f5dc" opacity="0.1"/>`;

  // Aurora bands — translucent wavy gradient
  const aurora = `
    <defs><linearGradient id="au" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#22c55e" stop-opacity="0"/>
      <stop offset="25%" stop-color="#22c55e" stop-opacity="0.05"/>
      <stop offset="50%" stop-color="#818cf8" stop-opacity="0.07"/>
      <stop offset="75%" stop-color="#22d3ee" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="M0,100 Q125,60 250,110 Q375,160 500,80 L500,180 Q375,240 250,190 Q125,140 0,200Z" fill="url(#au)"/>
    <path d="M0,140 Q125,180 250,130 Q375,80 500,150 L500,210 Q375,150 250,200 Q125,250 0,180Z" fill="url(#au)" opacity="0.5"/>`;

  return svgWrap(500, 700, moon + aurora + stars.join(""));
}

// ============================================================================
// DEEP OCEAN — Fish with actual body curves, jellyfish, light beams, bubbles
// ============================================================================

function deepOceanSvg(): string {
  // Fish using actual bezier body shape from FishBodyRenderer
  function fish(cx: number, cy: number, size: number, opacity: number, flip: boolean): string {
    const s = size;
    const dir = flip ? -1 : 1;
    // Body: dorsal + ventral bezier curves from the actual background code
    return `<g transform="translate(${cx},${cy}) scale(${dir * s / 40},${s / 40})" fill="#22d3ee" opacity="${opacity}">
      <path d="M-20,0 C-12,-16 0,-20 8,-18 C14,-16 18,-8 20,-4 L22,0 L20,4 C18,8 14,16 8,16 C0,18 -12,14 -20,0Z"/>
      <path d="M18,0 L28,-8 Q24,0 28,8Z" fill="#0891b2" opacity="${opacity * 0.8}"/>
      <circle cx="-12" cy="-4" r="1.5" fill="#000c1e" opacity="${opacity * 0.7}"/>
      <path d="M-2,-16 Q2,-24 6,-16" stroke="#0891b2" stroke-width="0.8" fill="none" opacity="${opacity * 0.6}"/>
      <path d="M4,14 Q6,20 2,18" stroke="#0891b2" stroke-width="0.6" fill="none" opacity="${opacity * 0.4}"/>
    </g>`;
  }

  // Jellyfish with tentacles
  function jellyfish(cx: number, cy: number, size: number, opacity: number): string {
    const s = size;
    const tentacles: string[] = [];
    for (let i = -3; i <= 3; i++) {
      const tx = cx + i * s * 0.15;
      const sway = Math.sin(i * 1.2) * s * 0.3;
      tentacles.push(`<path d="M${tx},${cy + s * 0.3} Q${tx + sway},${cy + s * 0.8} ${tx + sway * 0.5},${cy + s * 1.2}" stroke="#818cf8" stroke-width="0.6" fill="none" opacity="${(opacity * 0.5).toFixed(3)}"/>`);
    }
    return `<ellipse cx="${cx}" cy="${cy}" rx="${s * 0.5}" ry="${s * 0.35}" fill="#818cf8" opacity="${opacity.toFixed(3)}"/>
      <ellipse cx="${cx}" cy="${cy + s * 0.1}" rx="${s * 0.4}" ry="${s * 0.15}" fill="#a5b4fc" opacity="${(opacity * 0.5).toFixed(3)}"/>
      ${tentacles.join("")}`;
  }

  const elements: string[] = [];

  // Light beams from surface
  elements.push(`<defs><linearGradient id="lb" x1="0.5" y1="0" x2="0.5" y2="1">
    <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.06"/>
    <stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/>
  </linearGradient></defs>`);
  elements.push(`<path d="M150,0 L120,350 L180,350Z" fill="url(#lb)"/>`);
  elements.push(`<path d="M320,0 L290,280 L360,280Z" fill="url(#lb)" opacity="0.7"/>`);
  elements.push(`<path d="M430,0 L410,200 L460,200Z" fill="url(#lb)" opacity="0.5"/>`);

  // Fish at various depths
  elements.push(fish(380, 160, 28, 0.07, false));
  elements.push(fish(350, 190, 22, 0.05, false));
  elements.push(fish(400, 175, 20, 0.04, false));
  elements.push(fish(90, 380, 40, 0.08, true));
  elements.push(fish(300, 500, 32, 0.06, false));
  elements.push(fish(440, 420, 24, 0.05, true));

  // Jellyfish
  elements.push(jellyfish(400, 530, 22, 0.05));
  elements.push(jellyfish(120, 280, 16, 0.04));

  // Bubbles
  const rand = prng(77);
  for (let i = 0; i < 12; i++) {
    const x = 50 + rand() * 400;
    const y = 100 + rand() * 550;
    const r = 2 + rand() * 5;
    elements.push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="none" stroke="#22d3ee" stroke-width="0.5" opacity="${(0.03 + rand() * 0.04).toFixed(3)}"/>`);
  }

  return svgWrap(500, 700, elements.join(""));
}

// ============================================================================
// SNOWFALL — Proper 6-pointed crystalline snowflakes with side branches
// ============================================================================

function snowfallSvg(): string {
  // Snowflake using actual algorithm from SnowflakeSystem.js:
  // 6 main branches with side branches at 1/3 and 2/3 positions
  function snowflake(cx: number, cy: number, size: number, opacity: number, detailed: boolean): string {
    const lines: string[] = [];
    const branches = 6;
    const branchLen = size;

    for (let i = 0; i < branches; i++) {
      const angle = (i * Math.PI * 2) / branches;
      const ex = cx + Math.cos(angle) * branchLen;
      const ey = cy + Math.sin(angle) * branchLen;
      lines.push(`<line x1="${cx}" y1="${cy}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="white" stroke-width="0.8" opacity="${opacity}"/>`);

      // Side branches at 1/3 and 2/3 of main branch
      if (detailed) {
        for (let j = 1; j <= 2; j++) {
          const frac = j / 3;
          const bx = cx + Math.cos(angle) * branchLen * frac;
          const by = cy + Math.sin(angle) * branchLen * frac;
          const sideLen = size * 0.35 * (1 - frac * 0.5);

          // Left side branch at -45 degrees
          const la = angle - Math.PI / 4;
          lines.push(`<line x1="${bx.toFixed(1)}" y1="${by.toFixed(1)}" x2="${(bx + Math.cos(la) * sideLen).toFixed(1)}" y2="${(by + Math.sin(la) * sideLen).toFixed(1)}" stroke="white" stroke-width="0.5" opacity="${(opacity * 0.7).toFixed(3)}"/>`);

          // Right side branch at +45 degrees
          const ra = angle + Math.PI / 4;
          lines.push(`<line x1="${bx.toFixed(1)}" y1="${by.toFixed(1)}" x2="${(bx + Math.cos(ra) * sideLen).toFixed(1)}" y2="${(by + Math.sin(ra) * sideLen).toFixed(1)}" stroke="white" stroke-width="0.5" opacity="${(opacity * 0.7).toFixed(3)}"/>`);
        }
      }
    }

    return lines.join("");
  }

  const flakes = [
    snowflake(80, 80, 16, 0.08, true),
    snowflake(420, 55, 13, 0.06, true),
    snowflake(300, 150, 10, 0.07, true),
    snowflake(50, 280, 18, 0.05, true),
    snowflake(440, 320, 14, 0.06, true),
    snowflake(170, 430, 12, 0.07, true),
    snowflake(380, 500, 16, 0.05, true),
    snowflake(60, 580, 13, 0.06, true),
    snowflake(250, 60, 9, 0.05, false),
    snowflake(460, 200, 8, 0.04, false),
    snowflake(130, 350, 7, 0.05, false),
    snowflake(350, 620, 11, 0.04, true),
    snowflake(200, 550, 8, 0.05, false),
    snowflake(470, 650, 10, 0.04, true),
  ];

  // Frost edge glow
  const frost = `<defs><radialGradient id="fr" cx="0.5" cy="0.5" r="0.7">
    <stop offset="60%" stop-color="white" stop-opacity="0"/>
    <stop offset="100%" stop-color="white" stop-opacity="0.03"/>
  </radialGradient></defs>
  <rect x="0" y="0" width="500" height="700" fill="url(#fr)"/>`;

  return svgWrap(500, 700, frost + flakes.join(""));
}

// ============================================================================
// EMBER GLOW — Rising embers, coal bed, smoke wisps
// ============================================================================

function emberGlowSvg(): string {
  const rand = prng(17);
  const elements: string[] = [];

  // Coal bed glow at bottom — multiple overlapping radial gradients for depth
  elements.push(`<defs>
    <radialGradient id="c1" cx="0.3" cy="0.9" r="0.5">
      <stop offset="0%" stop-color="#ea580c" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="#ea580c" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="c2" cx="0.7" cy="0.95" r="0.4">
      <stop offset="0%" stop-color="#dc2626" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#dc2626" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="c3" cx="0.5" cy="0.85" r="0.3">
      <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#fbbf24" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="500" height="700" fill="url(#c1)"/>
  <rect x="0" y="0" width="500" height="700" fill="url(#c2)"/>
  <rect x="0" y="0" width="500" height="700" fill="url(#c3)"/>`);

  // Rising embers with glow halos
  for (let i = 0; i < 40; i++) {
    const x = 30 + rand() * 440;
    const y = 150 + rand() * 530;
    const r = 1 + rand() * 3;
    const colors = ["#fb923c", "#ea580c", "#fbbf24", "#f97316"];
    const color = colors[Math.floor(rand() * colors.length)]!;
    const opacity = 0.05 + rand() * 0.1;
    // Outer glow
    elements.push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(r * 4).toFixed(1)}" fill="${color}" opacity="${(opacity * 0.2).toFixed(3)}"/>`);
    // Core
    elements.push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="${color}" opacity="${opacity.toFixed(3)}"/>`);
  }

  // Smoke wisps — large semi-transparent ellipses
  elements.push(`<ellipse cx="150" cy="300" rx="60" ry="100" fill="#1a0a0a" opacity="0.06" transform="rotate(-10 150 300)"/>`);
  elements.push(`<ellipse cx="380" cy="200" rx="50" ry="80" fill="#1a0a0a" opacity="0.05" transform="rotate(8 380 200)"/>`);

  return svgWrap(500, 700, elements.join(""));
}

// ============================================================================
// SAKURA — Real cherry blossom petals (dual ellipse) and 5-petal flowers
// ============================================================================

function sakuraSvg(): string {
  const rand = prng(31);
  const elements: string[] = [];

  // Single petals using actual dual-ellipse shape from CherryBlossomPetalSystem
  for (let i = 0; i < 25; i++) {
    const x = 15 + rand() * 470;
    const y = 20 + rand() * 660;
    const size = 5 + rand() * 10;
    const rotation = rand() * 360;
    const opacity = 0.04 + rand() * 0.07;
    const colors = ["#f9a8d4", "#db2777", "#fce7f3", "#f472b6"];
    const color = colors[Math.floor(rand() * colors.length)]!;

    // Dual ellipse petal: primary 60%×100%, secondary 40%×80% at 45°
    elements.push(`<g transform="translate(${x.toFixed(0)},${y.toFixed(0)}) rotate(${rotation.toFixed(0)})">
      <ellipse cx="0" cy="0" rx="${(size * 0.6).toFixed(1)}" ry="${size.toFixed(1)}" fill="${color}" opacity="${opacity.toFixed(3)}"/>
      <ellipse cx="0" cy="0" rx="${(size * 0.4).toFixed(1)}" ry="${(size * 0.8).toFixed(1)}" fill="${color}" opacity="${(opacity * 0.7).toFixed(3)}" transform="rotate(45)"/>
    </g>`);
  }

  // Full 5-petal flowers using heart-shaped petal beziers from the actual code
  function flower(cx: number, cy: number, size: number, opacity: number): string {
    const petals: string[] = [];
    for (let i = 0; i < 5; i++) {
      const angle = (i * 72 - 90) * Math.PI / 180;
      const px = cx + Math.cos(angle) * size * 0.35;
      const py = cy + Math.sin(angle) * size * 0.35;
      const rot = (i * 72 - 90);
      // Heart-shaped petal using quadratic beziers from actual background code
      petals.push(`<path d="M0,0 Q${(size * 0.3).toFixed(1)},${(size * 0.2).toFixed(1)} ${(size * 0.3).toFixed(1)},${(size * 0.5).toFixed(1)} Q${(size * 0.3).toFixed(1)},${(size * 0.7).toFixed(1)} 0,${(size * 0.6).toFixed(1)} Q${(-size * 0.3).toFixed(1)},${(size * 0.7).toFixed(1)} ${(-size * 0.3).toFixed(1)},${(size * 0.5).toFixed(1)} Q${(-size * 0.3).toFixed(1)},${(size * 0.2).toFixed(1)} 0,0Z" fill="#f9a8d4" opacity="${opacity.toFixed(3)}" transform="translate(${px.toFixed(1)},${py.toFixed(1)}) rotate(${rot})"/>`);
    }
    // Yellow center
    petals.push(`<circle cx="${cx}" cy="${cy}" r="${(size * 0.12).toFixed(1)}" fill="#fbbf24" opacity="${(opacity * 0.8).toFixed(3)}"/>`);
    return petals.join("");
  }

  elements.push(flower(410, 100, 18, 0.06));
  elements.push(flower(80, 520, 15, 0.05));
  elements.push(flower(330, 600, 13, 0.04));
  elements.push(flower(200, 200, 11, 0.04));

  return svgWrap(500, 700, elements.join(""));
}

// ============================================================================
// FIREFLY FOREST — Glowing fireflies, star field, tree silhouettes
// ============================================================================

function fireflyForestSvg(): string {
  const rand = prng(53);
  const elements: string[] = [];

  // Stars in upper portion
  for (let i = 0; i < 30; i++) {
    const x = rand() * 500;
    const y = rand() * 280;
    const r = 0.3 + rand() * 1.2;
    elements.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#bfdbfe" opacity="${(0.15 + rand() * 0.25).toFixed(2)}"/>`);
  }

  // Fireflies with glow halos
  for (let i = 0; i < 18; i++) {
    const x = 25 + rand() * 450;
    const y = 60 + rand() * 560;
    const r = 1.5 + rand() * 2;
    const colors = ["#bef264", "#22c55e", "#fbbf24"];
    const color = colors[Math.floor(rand() * colors.length)]!;
    const opacity = 0.07 + rand() * 0.1;
    // Outer glow
    elements.push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(r * 6).toFixed(1)}" fill="${color}" opacity="${(opacity * 0.15).toFixed(3)}"/>`);
    // Core
    elements.push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="${color}" opacity="${opacity.toFixed(3)}"/>`);
  }

  // Tree silhouettes at bottom — layered for depth
  elements.push(`<path d="M0,660 L0,700 L500,700 L500,660 Q470,630 440,650 Q410,620 380,645 Q350,610 320,640 Q290,620 260,645 Q230,615 200,640 Q170,625 140,650 Q110,630 80,648 Q50,625 20,650 Q10,640 0,660Z" fill="#071510" opacity="0.2"/>`);
  elements.push(`<path d="M0,675 L0,700 L500,700 L500,675 Q480,660 460,670 Q430,650 400,665 Q370,645 340,660 Q310,650 280,665 Q250,648 220,662 Q190,650 160,665 Q130,652 100,668 Q70,655 40,670 Q20,660 0,675Z" fill="#050f0a" opacity="0.15"/>`);

  return svgWrap(500, 700, elements.join(""));
}

// ============================================================================
// AUTUMN DRIFT — ACTUAL leaf SVG paths from autumn-constants.js
// ============================================================================

function autumnDriftSvg(): string {
  const rand = prng(67);
  const elements: string[] = [];

  // Real maple leaf path from the background package
  const maplePath = "M55.15,85.62c1.73,11.9-0.93,21.51-8.05,31.37c-1.6,2.21-3.29,3.99-5.25,5.89c-0.01-2.63-1.69-3.76-4.22-4.34C48.04,108.25,52.33,96.9,53.7,85.62h-2.36c-7.79-0.77-16.33,12.35-26.35,15.92c4.77-9.16-0.56-10.4-12.66-6.33c9.05-10.8,9.93-14.79,0-13.35c5.13-3.88,9.9-6.11,14.38-7.02c-9.33-2.97-17.63-7.97-24.64-15.57c13.16-0.48,9.93-9.37-2.05-22.76c15.93,8.01,24.33,9.02,21.73-0.17c4.71,3.18,10.75,9.27,17.11,16.09c-2.45-12.5-4.29-24.34-3.42-33.2C41.63,28.56,48.3,19.12,54.84,0c5.51,17.44,11.43,27.12,18.92,20.08c0.97,7.76-0.07,16.06-2.74,24.81l-0.17,6.67c6.21-6.7,12.31-13.03,17.22-15.44c-3.05,10.09,7.63,6.57,21.28,0.38c-12.92,14.44-13.94,22.06-2.57,22.59c-4.73,7.36-13.07,11.84-22.76,15.23c4.22,1.21,8.44,3.49,12.66,7.02c-8.73-0.72-6.9,5,0.25,14.2c-10.92-3.2-16.49-2.33-13.04,6C70.98,90.74,61.77,85.51,56.13,85.62H55.15Z";

  // Real curved leaf path
  const curvedPath = "M104.38,97.86c5.03,6.72,9.37,12.3,11.72,18.72c2.29,6.26,3.22,9.11-1.98,2.63c-4.84-6.04-9.36-11.91-15.98-17.48c-0.47,0.11-0.96,0.21-1.49,0.32C36.81,113.93-6.78,87.01,0.87,0c46.1,15.96,111.38,9.48,104.62,91.25C105.25,94.29,105.02,96.37,104.38,97.86zM88.32,84.78c-15.04-32.4-53.68-43.51-72.85-65.67C36.28,59.7,47.63,57.91,88.32,84.78z";

  // Real oak leaf path
  const oakPath = "M120.96,113.47l-11.6-10.88c12.55-18.33,15.86-36.43,11.45-54.03c-3.26-9.99-9.58-17.97-17.83-24.33l-1.06,70.41l-5.18-5.09L69.34,8.35c-7.1-4.6-15.3-8.22-24.05-11.05l4.26,61.34l-5.18-5.09L37.16,2.16C23.82,0.6,10.93,0.14,0.18,0.17L0,0v8.84c38.3,38.3,75.14,75.14,112.8,112.8C119.93,126.02,124.49,117.75,120.96,113.47zM0.36,15.78c0.3,6.98,0.84,14.42,1.74,21.99l21.5,1.25zM2.71,42.57c1.27,9.21,3.1,18.52,5.67,27.39l49.54,3.38L28.75,44.17zM9.87,74.82c2.87,8.74,6.53,16.92,11.18,23.99l61-1.34L63.09,78.51zM24.45,103.54c6.3,8.04,14.18,14.18,23.99,17.39c16.01,4.01,32.29,1.72,48.9-8.17L87.18,102.6z";

  const leafPaths = [
    { path: maplePath, vw: 109.35, vh: 122.88 },
    { path: curvedPath, vw: 117.93, vh: 122.88 },
    { path: oakPath, vw: 124.49, vh: 126.02 },
  ];

  const leafColors = ["#D4A017", "#CC5500", "#8B0000", "#CD5C5C", "#DAA520", "#6B4423", "#D2691E"];

  for (let i = 0; i < 15; i++) {
    const x = 10 + rand() * 480;
    const y = 20 + rand() * 660;
    const leaf = leafPaths[Math.floor(rand() * leafPaths.length)]!;
    const scale = (0.1 + rand() * 0.15);
    const rotation = rand() * 360;
    const color = leafColors[Math.floor(rand() * leafColors.length)]!;
    const opacity = 0.04 + rand() * 0.06;

    elements.push(`<g transform="translate(${x.toFixed(0)},${y.toFixed(0)}) rotate(${rotation.toFixed(0)}) scale(${scale.toFixed(3)}) translate(${(-leaf.vw / 2).toFixed(0)},${(-leaf.vh / 2).toFixed(0)})" fill="${color}" opacity="${opacity.toFixed(3)}"><path d="${leaf.path}"/></g>`);
  }

  return svgWrap(500, 700, elements.join(""));
}

// ============================================================================
// PRIDE — Original diagonal rainbow gradient (NOT bokeh dots)
// ============================================================================

// Pride uses the original rainbow border + dark background. No bokeh needed.

// ============================================================================
// THEME DEFINITIONS
// ============================================================================

const THEMES: Record<string, CardBackThemeVisuals> = {
  nightSky: {
    borderGradient: "linear-gradient(135deg, #1e1b4b, #4338ca, #818cf8, #4338ca, #1e1b4b)",
    accentColor: "#818cf8",
    background: [
      svgUri(nightSkySvg()),
      "linear-gradient(180deg, #0a0e2c 0%, #1a2040 40%, #0a0e2c 100%)",
    ].join(", "),
  },
  deepOcean: {
    borderGradient: "linear-gradient(135deg, #0c4a6e, #0891b2, #22d3ee, #0891b2, #0c4a6e)",
    accentColor: "#22d3ee",
    background: [
      svgUri(deepOceanSvg()),
      "linear-gradient(180deg, #001a2e 0%, #000c1e 40%, #001122 70%, #000511 100%)",
    ].join(", "),
  },
  snowfall: {
    borderGradient: "linear-gradient(135deg, #1e3a5f, #3b82f6, #93c5fd, #3b82f6, #1e3a5f)",
    accentColor: "#93c5fd",
    background: [
      svgUri(snowfallSvg()),
      "linear-gradient(180deg, #0a0e1a 0%, #16213e 40%, #0f3460 70%, #041426 100%)",
    ].join(", "),
  },
  emberGlow: {
    borderGradient: "linear-gradient(135deg, #7c2d12, #ea580c, #fb923c, #ea580c, #7c2d12)",
    accentColor: "#fb923c",
    background: [
      svgUri(emberGlowSvg()),
      "linear-gradient(180deg, #0f0505 0%, #1a0a0a 30%, #2d1410 60%, #1a0a0a 100%)",
    ].join(", "),
  },
  sakuraDrift: {
    borderGradient: "linear-gradient(135deg, #831843, #db2777, #f9a8d4, #db2777, #831843)",
    accentColor: "#f9a8d4",
    background: [
      svgUri(sakuraSvg()),
      "radial-gradient(ellipse at 70% 20%, rgba(219,39,119,0.04) 0%, transparent 50%)",
      "linear-gradient(180deg, #1a0a14 0%, #2a1520 40%, #1a0a14 100%)",
    ].join(", "),
  },
  fireflyForest: {
    borderGradient: "linear-gradient(135deg, #0d3320, #166534, #22c55e, #166534, #0d3320)",
    accentColor: "#22c55e",
    background: [
      svgUri(fireflyForestSvg()),
      "linear-gradient(180deg, #0a0e18 0%, #0a1612 50%, #0c1a14 80%, #0a1810 100%)",
    ].join(", "),
  },
  autumnDrift: {
    borderGradient: "linear-gradient(135deg, #78350f, #d97706, #dc2626, #d97706, #78350f)",
    accentColor: "#d97706",
    background: [
      svgUri(autumnDriftSvg()),
      "radial-gradient(ellipse at 50% 90%, rgba(217,119,6,0.05) 0%, transparent 50%)",
      "linear-gradient(180deg, #1a1520 0%, #2d1f28 30%, #3d2a1f 60%, #2a1810 100%)",
    ].join(", "),
  },
  pride: {
    // Original rainbow diagonal — the one the user loved
    borderGradient: "linear-gradient(135deg, #ff0000, #ff8000, #ffff00, #00ff00, #0080ff, #8000ff, #ff0080, #ff0000)",
    accentColor: "#f43f5e",
    background: "linear-gradient(180deg, #0a0a15 0%, #12121f 50%, #0d0d18 100%)",
  },
  solidColor: {
    borderGradient: "linear-gradient(135deg, var(--theme-accent, #6366f1), var(--theme-stroke-strong, #444), var(--theme-accent, #6366f1))",
    accentColor: "var(--theme-accent, #6366f1)",
    background: "var(--theme-panel-bg, #18181b)",
  },
  linearGradient: {
    borderGradient: "linear-gradient(135deg, var(--theme-accent, #6366f1), var(--theme-stroke-strong, #444), var(--theme-accent, #6366f1))",
    accentColor: "var(--theme-accent, #6366f1)",
    background: "var(--theme-panel-bg, #18181b)",
  },
};

/**
 * Get the full visual treatment for a background theme.
 * Falls back to Night Sky if the theme is unknown.
 */
export function getCardBackThemeVisuals(backgroundType: string): CardBackThemeVisuals {
  return THEMES[backgroundType] ?? THEMES.nightSky!;
}
