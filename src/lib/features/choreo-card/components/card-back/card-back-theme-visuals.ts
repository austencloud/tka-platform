/**
 * Card Back Theme Visuals
 *
 * Produces the full visual treatment for each background theme on
 * choreo card backs. Each theme gets its actual visual identity:
 * stars for Night Sky, fish for Deep Ocean, petals for Sakura, etc.
 *
 * Returns CSS background layers and border gradients. Decorative
 * elements use low opacity so card text remains readable.
 */

export interface CardBackThemeVisuals {
  /** CSS border-image or gradient for the 3px themed border */
  borderGradient: string;
  /** CSS background property — multiple layers composited together */
  background: string;
  /** Accent color for LOOP title, badges, etc. */
  accentColor: string;
}

// ============================================================================
// SVG HELPERS — encode inline SVGs as CSS background data URIs
// ============================================================================

function svgDataUri(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Star field: scattered white dots of varying sizes */
function starFieldSvg(count: number, w: number, h: number, seed: number = 42): string {
  // Deterministic pseudo-random using a simple hash
  let s = seed;
  const rand = () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };

  const stars: string[] = [];
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 0.5 + rand() * 1.5;
    const opacity = 0.3 + rand() * 0.7;
    stars.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="white" opacity="${opacity.toFixed(2)}"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${stars.join("")}</svg>`;
}

/** Moon: glowing circle with soft halo */
function moonSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="700">
    <defs>
      <radialGradient id="mg" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stop-color="#f5f5dc" stop-opacity="0.15"/>
        <stop offset="60%" stop-color="#f5f5dc" stop-opacity="0.05"/>
        <stop offset="100%" stop-color="#f5f5dc" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="420" cy="90" r="80" fill="url(#mg)"/>
    <circle cx="420" cy="90" r="22" fill="#f5f5dc" opacity="0.12"/>
  </svg>`;
}

/** Aurora: wavy gradient bands */
function auroraSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="700">
    <defs>
      <linearGradient id="a1" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#22c55e" stop-opacity="0"/>
        <stop offset="30%" stop-color="#22c55e" stop-opacity="0.06"/>
        <stop offset="50%" stop-color="#818cf8" stop-opacity="0.08"/>
        <stop offset="70%" stop-color="#22d3ee" stop-opacity="0.06"/>
        <stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="M0,120 Q125,80 250,130 Q375,180 500,100 L500,200 Q375,260 250,210 Q125,160 0,220Z" fill="url(#a1)"/>
    <path d="M0,160 Q125,200 250,150 Q375,100 500,170 L500,230 Q375,170 250,220 Q125,270 0,200Z" fill="url(#a1)" opacity="0.6"/>
  </svg>`;
}

/** Fish silhouettes for Deep Ocean */
function fishSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="700">
    <!-- Small schooling fish, upper right -->
    <g fill="#22d3ee" opacity="0.06">
      <path d="M380,150 Q395,145 405,150 Q395,155 380,150Z M400,150 L410,145 L410,155Z"/>
      <path d="M360,165 Q375,160 385,165 Q375,170 360,165Z M380,165 L390,160 L390,170Z"/>
      <path d="M370,140 Q385,135 395,140 Q385,145 370,140Z M390,140 L400,135 L400,145Z"/>
      <path d="M350,155 Q365,150 375,155 Q365,160 350,155Z M370,155 L380,150 L380,160Z"/>
    </g>
    <!-- Larger fish, mid-left -->
    <g fill="#0891b2" opacity="0.07">
      <path d="M60,380 Q100,360 130,380 Q100,400 60,380Z M125,380 L150,365 L150,395Z"/>
      <circle cx="85" cy="377" r="2" fill="#22d3ee" opacity="0.15"/>
    </g>
    <!-- Jellyfish, lower right -->
    <g fill="#818cf8" opacity="0.05">
      <ellipse cx="400" cy="520" rx="20" ry="14"/>
      <path d="M385,532 Q387,555 383,570" stroke="#818cf8" stroke-width="1" fill="none" opacity="0.04"/>
      <path d="M395,534 Q393,560 397,575" stroke="#818cf8" stroke-width="1" fill="none" opacity="0.04"/>
      <path d="M405,532 Q408,555 404,568" stroke="#818cf8" stroke-width="1" fill="none" opacity="0.04"/>
      <path d="M415,530 Q418,550 414,565" stroke="#818cf8" stroke-width="1" fill="none" opacity="0.04"/>
    </g>
    <!-- Bubbles -->
    <circle cx="120" cy="250" r="5" fill="none" stroke="#22d3ee" stroke-width="0.5" opacity="0.06"/>
    <circle cx="135" cy="230" r="3" fill="none" stroke="#22d3ee" stroke-width="0.5" opacity="0.05"/>
    <circle cx="110" cy="270" r="4" fill="none" stroke="#22d3ee" stroke-width="0.5" opacity="0.04"/>
    <circle cx="350" cy="450" r="6" fill="none" stroke="#22d3ee" stroke-width="0.5" opacity="0.05"/>
    <circle cx="370" cy="430" r="3" fill="none" stroke="#22d3ee" stroke-width="0.5" opacity="0.04"/>
  </svg>`;
}

/** Snowflakes: 6-pointed crystals */
function snowflakeSvg(): string {
  // Each snowflake is a 6-armed crystal
  function flake(cx: number, cy: number, size: number, opacity: number): string {
    const arms: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i * 60) * Math.PI / 180;
      const x2 = cx + Math.cos(angle) * size;
      const y2 = cy + Math.sin(angle) * size;
      arms.push(`<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="white" stroke-width="0.8" opacity="${opacity}"/>`);
      // Side branches at 60% length
      if (size > 5) {
        const bx = cx + Math.cos(angle) * size * 0.6;
        const by = cy + Math.sin(angle) * size * 0.6;
        for (const offset of [-30, 30]) {
          const ba = (i * 60 + offset) * Math.PI / 180;
          const bx2 = bx + Math.cos(ba) * size * 0.3;
          const by2 = by + Math.sin(ba) * size * 0.3;
          arms.push(`<line x1="${bx.toFixed(1)}" y1="${by.toFixed(1)}" x2="${bx2.toFixed(1)}" y2="${by2.toFixed(1)}" stroke="white" stroke-width="0.5" opacity="${opacity * 0.7}"/>`);
        }
      }
    }
    return arms.join("");
  }

  const flakes = [
    flake(80, 100, 12, 0.08), flake(420, 60, 10, 0.06),
    flake(350, 180, 8, 0.07), flake(50, 300, 14, 0.05),
    flake(440, 350, 11, 0.06), flake(150, 500, 9, 0.07),
    flake(400, 550, 13, 0.05), flake(70, 600, 10, 0.06),
    flake(250, 80, 7, 0.05), flake(300, 450, 12, 0.04),
    flake(180, 200, 6, 0.06), flake(460, 480, 8, 0.05),
  ];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="700">${flakes.join("")}</svg>`;
}

/** Ember particles: glowing orange/yellow dots rising */
function emberSvg(): string {
  const embers: string[] = [];
  let s = 17;
  const rand = () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };

  for (let i = 0; i < 35; i++) {
    const x = 40 + rand() * 420;
    const y = 200 + rand() * 480;
    const r = 1 + rand() * 3;
    const colors = ["#fb923c", "#ea580c", "#fbbf24"];
    const color = colors[Math.floor(rand() * colors.length)]!;
    const opacity = 0.04 + rand() * 0.08;
    embers.push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="${color}" opacity="${opacity.toFixed(2)}"/>`);
    // Glow halo
    embers.push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(r * 3).toFixed(1)}" fill="${color}" opacity="${(opacity * 0.3).toFixed(3)}"/>`);
  }

  // Coal glow at bottom
  embers.push(`<rect x="0" y="620" width="500" height="80" fill="url(#cg)"/>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="700">
    <defs>
      <radialGradient id="cg" cx="0.5" cy="0" r="1">
        <stop offset="0%" stop-color="#ea580c" stop-opacity="0.08"/>
        <stop offset="100%" stop-color="#ea580c" stop-opacity="0"/>
      </radialGradient>
    </defs>
    ${embers.join("")}
  </svg>`;
}

/** Cherry blossom petals scattered */
function sakuraSvg(): string {
  const petals: string[] = [];
  let s = 31;
  const rand = () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };

  for (let i = 0; i < 20; i++) {
    const x = 20 + rand() * 460;
    const y = 30 + rand() * 640;
    const size = 4 + rand() * 8;
    const rotation = rand() * 360;
    const opacity = 0.04 + rand() * 0.06;
    const colors = ["#f9a8d4", "#db2777", "#fce7f3"];
    const color = colors[Math.floor(rand() * colors.length)]!;

    // Simple petal shape: elongated ellipse
    petals.push(`<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${size.toFixed(1)}" ry="${(size * 0.5).toFixed(1)}" fill="${color}" opacity="${opacity.toFixed(2)}" transform="rotate(${rotation.toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})"/>`);
  }

  // A few full 5-petal flowers
  function flower(cx: number, cy: number, size: number, opacity: number): string {
    const ps: string[] = [];
    for (let i = 0; i < 5; i++) {
      const angle = i * 72 - 90;
      const px = cx + Math.cos(angle * Math.PI / 180) * size * 0.6;
      const py = cy + Math.sin(angle * Math.PI / 180) * size * 0.6;
      ps.push(`<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${(size * 0.5).toFixed(1)}" ry="${(size * 0.35).toFixed(1)}" fill="#f9a8d4" opacity="${opacity}" transform="rotate(${angle} ${px.toFixed(1)} ${py.toFixed(1)})"/>`);
    }
    ps.push(`<circle cx="${cx}" cy="${cy}" r="${(size * 0.15).toFixed(1)}" fill="#fbbf24" opacity="${opacity * 0.8}"/>`);
    return ps.join("");
  }

  petals.push(flower(420, 120, 16, 0.06));
  petals.push(flower(80, 550, 14, 0.05));
  petals.push(flower(350, 600, 12, 0.04));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="700">${petals.join("")}</svg>`;
}

/** Firefly dots with glow */
function fireflySvg(): string {
  const flies: string[] = [];
  let s = 53;
  const rand = () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };

  for (let i = 0; i < 15; i++) {
    const x = 30 + rand() * 440;
    const y = 80 + rand() * 550;
    const r = 1.5 + rand() * 2;
    const colors = ["#bef264", "#22c55e", "#fbbf24"];
    const color = colors[Math.floor(rand() * colors.length)]!;
    const opacity = 0.06 + rand() * 0.08;
    // Glow halo
    flies.push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(r * 5).toFixed(1)}" fill="${color}" opacity="${(opacity * 0.25).toFixed(3)}"/>`);
    // Core dot
    flies.push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="${color}" opacity="${opacity.toFixed(2)}"/>`);
  }

  // Tree silhouettes at bottom
  flies.push(`<path d="M0,650 L0,700 L500,700 L500,650 Q450,620 400,640 Q350,600 300,630 Q250,610 200,640 Q150,620 100,645 Q50,625 0,650Z" fill="#0a1810" opacity="0.15"/>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="700">${flies.join("")}</svg>`;
}

/** Autumn leaves: SVG leaf silhouettes */
function autumnLeavesSvg(): string {
  const leaves: string[] = [];
  let s = 67;
  const rand = () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };

  // Simple maple leaf path (normalized to ~20px)
  const maplePath = "M0,-10 L-3,-4 L-8,-6 L-5,-1 L-10,2 L-5,2 L-4,5 L-2,3 L0,10 L2,3 L4,5 L5,2 L10,2 L5,-1 L8,-6 L3,-4Z";
  // Simple oak-ish leaf
  const oakPath = "M0,-8 Q-4,-6 -5,-3 Q-6,0 -4,3 Q-3,5 -2,7 L0,9 L2,7 Q3,5 4,3 Q6,0 5,-3 Q4,-6 0,-8Z";

  const leafColors = ["#D4A017", "#CC5500", "#8B0000", "#CD5C5C", "#DAA520", "#6B4423"];

  for (let i = 0; i < 18; i++) {
    const x = 20 + rand() * 460;
    const y = 30 + rand() * 640;
    const scale = 0.6 + rand() * 0.8;
    const rotation = rand() * 360;
    const color = leafColors[Math.floor(rand() * leafColors.length)]!;
    const opacity = 0.04 + rand() * 0.06;
    const path = rand() > 0.5 ? maplePath : oakPath;

    leaves.push(`<g transform="translate(${x.toFixed(0)},${y.toFixed(0)}) rotate(${rotation.toFixed(0)}) scale(${scale.toFixed(2)})" fill="${color}" opacity="${opacity.toFixed(2)}"><path d="${path}"/></g>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="700">${leaves.join("")}</svg>`;
}

/** Pride: rainbow bokeh dots */
function prideSvg(): string {
  const dots: string[] = [];
  const colors = ["#ff0000", "#ff8000", "#ffff00", "#00ff00", "#0080ff", "#8000ff", "#ff0080"];
  let s = 73;
  const rand = () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };

  for (let i = 0; i < 12; i++) {
    const x = 30 + rand() * 440;
    const y = 30 + rand() * 640;
    const r = 15 + rand() * 30;
    const color = colors[Math.floor(rand() * colors.length)]!;
    const opacity = 0.03 + rand() * 0.04;
    dots.push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(0)}" fill="${color}" opacity="${opacity.toFixed(3)}"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="700">${dots.join("")}</svg>`;
}

// ============================================================================
// THEME DEFINITIONS
// ============================================================================

const THEMES: Record<string, CardBackThemeVisuals> = {
  nightSky: {
    borderGradient: "linear-gradient(135deg, #1e1b4b, #4338ca, #818cf8, #4338ca, #1e1b4b)",
    accentColor: "#818cf8",
    background: [
      svgDataUri(auroraSvg()),
      svgDataUri(moonSvg()),
      svgDataUri(starFieldSvg(120, 500, 700)),
      "linear-gradient(180deg, #0a0e2c 0%, #1a2040 40%, #0a0e2c 100%)",
    ].join(", "),
  },
  deepOcean: {
    borderGradient: "linear-gradient(135deg, #0c4a6e, #0891b2, #22d3ee, #0891b2, #0c4a6e)",
    accentColor: "#22d3ee",
    background: [
      svgDataUri(fishSvg()),
      // Light rays from surface
      "linear-gradient(175deg, rgba(34,211,238,0.04) 0%, transparent 30%)",
      "linear-gradient(185deg, rgba(8,145,178,0.03) 0%, transparent 25%)",
      "linear-gradient(180deg, #001122 0%, #000c1e 40%, #001a2e 70%, #000511 100%)",
    ].join(", "),
  },
  snowfall: {
    borderGradient: "linear-gradient(135deg, #1e3a5f, #3b82f6, #93c5fd, #3b82f6, #1e3a5f)",
    accentColor: "#93c5fd",
    background: [
      svgDataUri(snowflakeSvg()),
      svgDataUri(starFieldSvg(40, 500, 700, 99)),
      "linear-gradient(180deg, #0a0e1a 0%, #16213e 40%, #0f3460 70%, #041426 100%)",
    ].join(", "),
  },
  emberGlow: {
    borderGradient: "linear-gradient(135deg, #7c2d12, #ea580c, #fb923c, #ea580c, #7c2d12)",
    accentColor: "#fb923c",
    background: [
      svgDataUri(emberSvg()),
      // Warm ambient glow from bottom
      "radial-gradient(ellipse at 50% 95%, rgba(234,88,12,0.08) 0%, transparent 60%)",
      "linear-gradient(180deg, #1a0a0a 0%, #2d1410 40%, #3d1814 70%, #1a0a0a 100%)",
    ].join(", "),
  },
  sakuraDrift: {
    borderGradient: "linear-gradient(135deg, #831843, #db2777, #f9a8d4, #db2777, #831843)",
    accentColor: "#f9a8d4",
    background: [
      svgDataUri(sakuraSvg()),
      // Soft pink ambient glow
      "radial-gradient(ellipse at 70% 20%, rgba(219,39,119,0.04) 0%, transparent 50%)",
      "linear-gradient(180deg, #1a0a14 0%, #2a1520 40%, #1a0a14 100%)",
    ].join(", "),
  },
  fireflyForest: {
    borderGradient: "linear-gradient(135deg, #0d3320, #166534, #22c55e, #166534, #0d3320)",
    accentColor: "#22c55e",
    background: [
      svgDataUri(fireflySvg()),
      svgDataUri(starFieldSvg(30, 500, 280, 37)),
      "linear-gradient(180deg, #0a0e18 0%, #0a1612 50%, #0c1a14 80%, #0a1810 100%)",
    ].join(", "),
  },
  autumnDrift: {
    borderGradient: "linear-gradient(135deg, #78350f, #d97706, #dc2626, #d97706, #78350f)",
    accentColor: "#d97706",
    background: [
      svgDataUri(autumnLeavesSvg()),
      "radial-gradient(ellipse at 50% 90%, rgba(217,119,6,0.05) 0%, transparent 50%)",
      "linear-gradient(180deg, #1a1520 0%, #2d1f28 30%, #3d2a1f 60%, #2a1810 100%)",
    ].join(", "),
  },
  pride: {
    borderGradient: "linear-gradient(135deg, #ff0000, #ff8000, #ffff00, #00ff00, #0080ff, #8000ff, #ff0080, #ff0000)",
    accentColor: "#f43f5e",
    background: [
      svgDataUri(prideSvg()),
      "linear-gradient(180deg, #0a0a15 0%, #12121f 50%, #0d0d18 100%)",
    ].join(", "),
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
