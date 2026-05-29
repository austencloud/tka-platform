/**
 * Throwaway spike helper.
 * Ports the COSMIC branch of CardBackDecorations.svelte into a plain-TS
 * function so it can be serialised and sent to a Web Worker as a string.
 *
 * Faithfulness is the goal: same loop counts, same seed arithmetic, same
 * coordinates and attributes.  The filters (feGaussianBlur, feMerge) are
 * intentionally preserved — they are the point of the probe.
 */

function f(n: number, decimals = 4): string {
  return parseFloat(n.toFixed(decimals)).toString();
}

export function buildDecorationsSVGInline(): string {
  const parts: string[] = [];

  // ─── <defs> ──────────────────────────────────────────────────────────────
  parts.push(`<defs>
    <filter id="aurora-blur" x="-30%" y="-20%" width="160%" height="140%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="4"/>
    </filter>
    <filter id="star-glow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="1.5"/>
    </filter>
    <filter id="comet-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <linearGradient id="aurora-ray" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#ff6490" stop-opacity="0.3"/>
      <stop offset="12%"  stop-color="#c878ff" stop-opacity="0.5"/>
      <stop offset="28%"  stop-color="#78ffa0" stop-opacity="0.9"/>
      <stop offset="50%"  stop-color="#78ffa0" stop-opacity="1"/>
      <stop offset="70%"  stop-color="#50dcb4" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#50dcb4" stop-opacity="0"/>
    </linearGradient>
  </defs>`);

  // ─── AURORA CURTAIN 1: 18 rays, left-centre ─────────────────────────────
  parts.push(`<g filter="url(#aurora-blur)">`);
  for (let i = 0; i < 18; i++) {
    const progress = i / 18;
    const x = 40 + progress * 180;
    const edge = Math.min(progress, 1 - progress) * 2;
    const fade = Math.pow(Math.min(1, edge * 1.8), 0.6);
    const wave = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(progress * Math.PI * 4.5 + 1.2));
    const rayAlpha = 0.14 * wave * fade;
    const topY = 120 + Math.sin(i * 3.7 + 42) * 25;
    const bottomY = 580 + Math.sin(i * 7.3 + 21) * 35;
    const w = 6 + wave * 6;
    parts.push(
      `<rect x="${f(x - w / 2)}" y="${f(topY)}" width="${f(w)}" height="${f(bottomY - topY)}" rx="2" fill="url(#aurora-ray)" opacity="${f(rayAlpha)}"/>`
    );
  }
  parts.push(`</g>`);

  // ─── AURORA CURTAIN 2: 12 rays, right side ──────────────────────────────
  parts.push(`<g filter="url(#aurora-blur)">`);
  for (let i = 0; i < 12; i++) {
    const progress = i / 12;
    const x = 290 + progress * 150;
    const edge = Math.min(progress, 1 - progress) * 2;
    const fade = Math.pow(Math.min(1, edge * 1.8), 0.6);
    const wave = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(progress * Math.PI * 3.5 + 2.8));
    const rayAlpha = 0.09 * wave * fade;
    const topY = 140 + Math.sin(i * 4.1 + 17) * 25;
    const bottomY = 560 + Math.sin(i * 6.9 + 33) * 30;
    const w = 5 + wave * 5;
    parts.push(
      `<rect x="${f(x - w / 2)}" y="${f(topY)}" width="${f(w)}" height="${f(bottomY - topY)}" rx="2" fill="url(#aurora-ray)" opacity="${f(rayAlpha)}"/>`
    );
  }
  parts.push(`</g>`);

  // ─── COMET ───────────────────────────────────────────────────────────────
  parts.push(`<g transform="translate(410, 105)" opacity="0.45">
    <defs>
      <radialGradient id="coma-glow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%"   stop-color="#ffffff" stop-opacity="0.8"/>
        <stop offset="25%"  stop-color="#e0f2fe" stop-opacity="0.4"/>
        <stop offset="50%"  stop-color="#bfdbfe" stop-opacity="0.15"/>
        <stop offset="100%" stop-color="#7dd3fc" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <path d="M0,0 Q-30,-8 -70,-5 Q-100,0 -120,8" stroke="#fef3c7" stroke-width="3" fill="none" opacity="0.15" filter="url(#comet-glow)"/>
    <path d="M0,0 Q-25,-12 -60,-15 Q-90,-10 -115,2" stroke="#fffbeb" stroke-width="5" fill="none" opacity="0.08" filter="url(#comet-glow)"/>
    <path d="M0,0 Q-20,-4 -50,-2 Q-80,2 -110,10" stroke="#fde68a" stroke-width="2" fill="none" opacity="0.12"/>
    <path d="M0,0 Q-35,-15 -80,-22 Q-110,-25 -140,-20" stroke="#7dd3fc" stroke-width="1.5" fill="none" opacity="0.2" filter="url(#comet-glow)"/>
    <path d="M0,0 Q-30,-18 -70,-28 Q-100,-30 -130,-25" stroke="#bae6fd" stroke-width="0.8" fill="none" opacity="0.12"/>
    <circle cx="-25" cy="-6"  r="0.8" fill="#ffffff" opacity="0.3"/>
    <circle cx="-40" cy="-10" r="0.6" fill="#e0f2fe" opacity="0.25"/>
    <circle cx="-55" cy="-8"  r="0.5" fill="#ffffff" opacity="0.2"/>
    <circle cx="-35" cy="-2"  r="0.7" fill="#fef3c7" opacity="0.2"/>
    <circle cx="-65" cy="-14" r="0.5" fill="#bfdbfe" opacity="0.15"/>
    <circle cx="-50" cy="0"   r="0.6" fill="#ffffff" opacity="0.15"/>
    <circle cx="-80" cy="-5"  r="0.4" fill="#e0f2fe" opacity="0.12"/>
    <circle cx="0" cy="0" r="12" fill="url(#coma-glow)"/>
    <circle cx="0" cy="0" r="2.5" fill="#ffffff" opacity="0.95"/>
    <circle cx="0" cy="0" r="1.2" fill="#ffffff"/>
  </g>`);

  // ─── WARM GOLDEN STARS: Array(20) ────────────────────────────────────────
  for (let i = 0; i < 20; i++) {
    const s  = ((i * 48271 + 73) % 2147483647) / 2147483647;
    const s2 = ((i * 16807 + 73) % 2147483647) / 2147483647;
    const x  = s * 500;
    const y  = s2 * 700;
    const r  = 0.8 + s * 1.2;
    parts.push(
      `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 2.5)}" fill="#fbbf24" opacity="${f(0.03 + s2 * 0.04)}" filter="url(#star-glow)"/>`
    );
    parts.push(
      `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#fde68a" opacity="${f(0.4 + s2 * 0.4)}"/>`
    );
  }

  // ─── COOL BLUE/WHITE STARS: Array(50) ────────────────────────────────────
  for (let i = 0; i < 50; i++) {
    const s  = ((i * 16807 + 42) % 2147483647) / 2147483647;
    const s2 = ((i * 48271 + 42) % 2147483647) / 2147483647;
    const x  = s * 500;
    const y  = s2 * 700;
    const r  = 0.3 + s * 1.5;
    parts.push(
      `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#ffffff" opacity="${f(0.25 + s2 * 0.55)}"/>`
    );
  }

  // ─── PROMINENT GLOW STARS: Array(8) ──────────────────────────────────────
  for (let i = 0; i < 8; i++) {
    const s  = ((i * 48271 + 17) % 2147483647) / 2147483647;
    const s2 = ((i * 16807 + 17) % 2147483647) / 2147483647;
    const x  = 40 + s * 420;
    const y  = 40 + s2 * 620;
    const r  = 1.5 + s * 1;
    const glowColor = s > 0.5 ? "#c4b5fd" : "#bfdbfe";
    parts.push(
      `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 3)}" fill="${glowColor}" opacity="0.06" filter="url(#star-glow)"/>`
    );
    parts.push(
      `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#ffffff" opacity="${f(0.6 + s * 0.3)}"/>`
    );
  }

  // ─── DEPTH-OF-FIELD (bokeh) STARS ────────────────────────────────────────
  const dofStars = [
    { x: 160, y: 130, r: 4,   o: 0.06 },
    { x: 420, y: 420, r: 5,   o: 0.05 },
    { x: 70,  y: 520, r: 3.5, o: 0.07 },
    { x: 340, y: 280, r: 3,   o: 0.05 },
    { x: 460, y: 600, r: 4,   o: 0.04 },
  ];
  for (const dof of dofStars) {
    parts.push(
      `<circle cx="${dof.x}" cy="${dof.y}" r="${f(dof.r * 3)}" fill="#bfdbfe" opacity="${f(dof.o * 0.4)}" filter="url(#star-glow)"/>`
    );
    parts.push(
      `<circle cx="${dof.x}" cy="${dof.y}" r="${dof.r}" fill="#e0f2fe" opacity="${f(dof.o * 2)}"/>`
    );
  }

  // ─── NEBULA PATCHES ───────────────────────────────────────────────────────
  parts.push(`<ellipse cx="120" cy="200" rx="60" ry="40" fill="#c878ff" opacity="0.015" filter="url(#aurora-blur)"/>`);
  parts.push(`<ellipse cx="400" cy="500" rx="50" ry="35" fill="#ff6490" opacity="0.01"  filter="url(#aurora-blur)"/>`);

  // ─── Assemble ─────────────────────────────────────────────────────────────
  const body = parts.join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1644" height="2244" viewBox="0 0 500 700" preserveAspectRatio="none">\n${body}\n</svg>`;
}
