<!--
  CardBackDecorations.svelte - Theme-specific SVG decorations

  Renders inline SVG elements positioned behind card text.
  Uses actual shapes from the background package: real leaf SVG paths,
  proper fish body curves, crystalline snowflakes, cherry blossom
  petals, etc. Each theme's signature elements at visible opacity.
-->
<script lang="ts">
  interface Props { theme: string; }
  let { theme }: Props = $props();
</script>

<svg class="decorations" viewBox="0 0 500 700" preserveAspectRatio="none">
  {#if theme === "cosmic"}
    <defs>
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
      <!-- Aurora ray gradient: atmospheric emission colors -->
      <linearGradient id="aurora-ray" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ff6490" stop-opacity="0.3"/>
        <stop offset="12%" stop-color="#c878ff" stop-opacity="0.5"/>
        <stop offset="28%" stop-color="#78ffa0" stop-opacity="0.9"/>
        <stop offset="50%" stop-color="#78ffa0" stop-opacity="1"/>
        <stop offset="70%" stop-color="#50dcb4" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="#50dcb4" stop-opacity="0"/>
      </linearGradient>
    </defs>

    <!-- AURORA CURTAIN 1: prominent, left-center area -->
    <!-- Vertical rays with atmospheric color gradient, blurred for ethereal glow -->
    <g filter="url(#aurora-blur)">
      {#each Array(18) as _, i}
        {@const progress = i / 18}
        {@const x = 40 + progress * 180}
        {@const edge = Math.min(progress, 1 - progress) * 2}
        {@const fade = Math.pow(Math.min(1, edge * 1.8), 0.6)}
        {@const wave = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(progress * Math.PI * 4.5 + 1.2))}
        {@const rayAlpha = 0.14 * wave * fade}
        {@const topY = 10 + Math.sin(i * 3.7 + 42) * 18}
        {@const bottomY = 450 + Math.sin(i * 7.3 + 21) * 35}
        {@const w = 6 + wave * 6}
        <rect
          x={x - w/2} y={topY}
          width={w} height={bottomY - topY}
          rx="2"
          fill="url(#aurora-ray)"
          opacity={rayAlpha}
        />
      {/each}
    </g>

    <!-- AURORA CURTAIN 2: softer, right side -->
    <g filter="url(#aurora-blur)">
      {#each Array(12) as _, i}
        {@const progress = i / 12}
        {@const x = 290 + progress * 150}
        {@const edge = Math.min(progress, 1 - progress) * 2}
        {@const fade = Math.pow(Math.min(1, edge * 1.8), 0.6)}
        {@const wave = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(progress * Math.PI * 3.5 + 2.8))}
        {@const rayAlpha = 0.09 * wave * fade}
        {@const topY = 25 + Math.sin(i * 4.1 + 17) * 22}
        {@const bottomY = 380 + Math.sin(i * 6.9 + 33) * 30}
        {@const w = 5 + wave * 5}
        <rect
          x={x - w/2} y={topY}
          width={w} height={bottomY - topY}
          rx="2"
          fill="url(#aurora-ray)"
          opacity={rayAlpha}
        />
      {/each}
    </g>

    <!-- Horizon glow: atmospheric wash at the base of the auroras -->
    <ellipse cx="130" cy="460" rx="120" ry="30" fill="#50dcb4" opacity="0.04" filter="url(#aurora-blur)"/>
    <ellipse cx="360" cy="390" rx="100" ry="25" fill="#50dcb4" opacity="0.03" filter="url(#aurora-blur)"/>

    <!-- COMET: modeled on the actual CometSystem - nucleus, coma, dual tails, debris -->
    <!-- Positioned in upper-right empty area, arcing across -->
    <g transform="translate(410, 105)" opacity="0.45">
      <defs>
        <!-- Coma: multi-layer radial glow around nucleus -->
        <radialGradient id="coma-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.8"/>
          <stop offset="25%" stop-color="#e0f2fe" stop-opacity="0.4"/>
          <stop offset="50%" stop-color="#bfdbfe" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="#7dd3fc" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <!-- Dust tail: curved, white/yellow, wider, trails behind (toward upper-left) -->
      <!-- Teardrop shape tapering from nucleus -->
      <path d="M0,0 Q-30,-8 -70,-5 Q-100,0 -120,8" stroke="#fef3c7" stroke-width="3" fill="none" opacity="0.15" filter="url(#comet-glow)"/>
      <path d="M0,0 Q-25,-12 -60,-15 Q-90,-10 -115,2" stroke="#fffbeb" stroke-width="5" fill="none" opacity="0.08" filter="url(#comet-glow)"/>
      <path d="M0,0 Q-20,-4 -50,-2 Q-80,2 -110,10" stroke="#fde68a" stroke-width="2" fill="none" opacity="0.12"/>
      <!-- Ion tail: straighter, blue, narrower -->
      <path d="M0,0 Q-35,-15 -80,-22 Q-110,-25 -140,-20" stroke="#7dd3fc" stroke-width="1.5" fill="none" opacity="0.2" filter="url(#comet-glow)"/>
      <path d="M0,0 Q-30,-18 -70,-28 Q-100,-30 -130,-25" stroke="#bae6fd" stroke-width="0.8" fill="none" opacity="0.12"/>
      <!-- Debris particles trailing behind -->
      <circle cx="-25" cy="-6" r="0.8" fill="#ffffff" opacity="0.3"/>
      <circle cx="-40" cy="-10" r="0.6" fill="#e0f2fe" opacity="0.25"/>
      <circle cx="-55" cy="-8" r="0.5" fill="#ffffff" opacity="0.2"/>
      <circle cx="-35" cy="-2" r="0.7" fill="#fef3c7" opacity="0.2"/>
      <circle cx="-65" cy="-14" r="0.5" fill="#bfdbfe" opacity="0.15"/>
      <circle cx="-50" cy="0" r="0.6" fill="#ffffff" opacity="0.15"/>
      <circle cx="-80" cy="-5" r="0.4" fill="#e0f2fe" opacity="0.12"/>
      <!-- Coma: fuzzy multi-layer glow around nucleus -->
      <circle cx="0" cy="0" r="12" fill="url(#coma-glow)"/>
      <!-- Nucleus: bright intense center -->
      <circle cx="0" cy="0" r="2.5" fill="#ffffff" opacity="0.95"/>
      <circle cx="0" cy="0" r="1.2" fill="#ffffff"/>
    </g>

    <!-- STARS: rich field with color variation matching the actual background -->
    <!-- Warm golden stars (like the real background's warm-toned ones) -->
    {#each Array(20) as _, i}
      {@const s = ((i * 48271 + 73) % 2147483647) / 2147483647}
      {@const s2 = ((i * 16807 + 73) % 2147483647) / 2147483647}
      {@const x = s * 500}
      {@const y = s2 * 700}
      {@const r = 0.8 + s * 1.2}
      <circle cx={x} cy={y} r={r * 2.5} fill="#fbbf24" opacity={0.03 + s2 * 0.04} filter="url(#star-glow)"/>
      <circle cx={x} cy={y} r={r} fill="#fde68a" opacity={0.4 + s2 * 0.4}/>
    {/each}
    <!-- Cool blue/white stars -->
    {#each Array(50) as _, i}
      {@const s = ((i * 16807 + 42) % 2147483647) / 2147483647}
      {@const s2 = ((i * 48271 + 42) % 2147483647) / 2147483647}
      {@const x = s * 500}
      {@const y = s2 * 700}
      {@const r = 0.3 + s * 1.5}
      <circle cx={x} cy={y} r={r} fill="#ffffff" opacity={0.25 + s2 * 0.55}/>
    {/each}
    <!-- Brighter prominent stars with glow halos -->
    {#each Array(8) as _, i}
      {@const s = ((i * 48271 + 17) % 2147483647) / 2147483647}
      {@const s2 = ((i * 16807 + 17) % 2147483647) / 2147483647}
      {@const x = 40 + s * 420}
      {@const y = 40 + s2 * 620}
      {@const r = 1.5 + s * 1}
      <circle cx={x} cy={y} r={r * 3} fill={s > 0.5 ? "#c4b5fd" : "#bfdbfe"} opacity="0.06" filter="url(#star-glow)"/>
      <circle cx={x} cy={y} r={r} fill="#ffffff" opacity={0.6 + s * 0.3}/>
    {/each}

    <!-- Depth-of-field stars: larger, blurred, creating bokeh-like depth -->
    {#each [
      { x: 160, y: 130, r: 4, o: 0.06 },
      { x: 420, y: 420, r: 5, o: 0.05 },
      { x: 70, y: 520, r: 3.5, o: 0.07 },
      { x: 340, y: 280, r: 3, o: 0.05 },
      { x: 460, y: 600, r: 4, o: 0.04 },
    ] as dof}
      <circle cx={dof.x} cy={dof.y} r={dof.r * 3} fill="#bfdbfe" opacity={dof.o * 0.4} filter="url(#star-glow)"/>
      <circle cx={dof.x} cy={dof.y} r={dof.r} fill="#e0f2fe" opacity={dof.o * 2}/>
    {/each}

    <!-- Nebula-like soft color patches (very subtle) -->
    <ellipse cx="120" cy="200" rx="60" ry="40" fill="#c878ff" opacity="0.015" filter="url(#aurora-blur)"/>
    <ellipse cx="400" cy="500" rx="50" ry="35" fill="#ff6490" opacity="0.01" filter="url(#aurora-blur)"/>

  {:else if theme === "ocean"}
    <defs>
      <!-- Fish body gradients: many soft stops for prismatic rainbow effect -->
      <linearGradient id="f1-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#67e8f9" stop-opacity="0.85"/>
        <stop offset="12%" stop-color="#22d3ee" stop-opacity="0.8"/>
        <stop offset="24%" stop-color="#f97316" stop-opacity="0.65"/>
        <stop offset="36%" stop-color="#fb923c" stop-opacity="0.55"/>
        <stop offset="48%" stop-color="#34d399" stop-opacity="0.5"/>
        <stop offset="60%" stop-color="#22c55e" stop-opacity="0.55"/>
        <stop offset="72%" stop-color="#f472b6" stop-opacity="0.45"/>
        <stop offset="84%" stop-color="#22d3ee" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="#0891b2" stop-opacity="0.75"/>
      </linearGradient>
      <linearGradient id="f2-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0ea5e9" stop-opacity="0.8"/>
        <stop offset="18%" stop-color="#f59e0b" stop-opacity="0.55"/>
        <stop offset="35%" stop-color="#fbbf24" stop-opacity="0.45"/>
        <stop offset="52%" stop-color="#22d3ee" stop-opacity="0.6"/>
        <stop offset="70%" stop-color="#10b981" stop-opacity="0.5"/>
        <stop offset="85%" stop-color="#06b6d4" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#0891b2" stop-opacity="0.7"/>
      </linearGradient>
      <!-- Body shimmer overlay: horizontal iridescence -->
      <linearGradient id="f-shimmer" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>
        <stop offset="30%" stop-color="#ffffff" stop-opacity="0.08"/>
        <stop offset="50%" stop-color="#ffffff" stop-opacity="0.12"/>
        <stop offset="70%" stop-color="#ffffff" stop-opacity="0.06"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>
      <!-- Luminous body glow filter -->
      <filter id="fish-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <!-- Jellyfish bell glow -->
      <radialGradient id="jelly-glow" cx="0.5" cy="0.35" r="0.55">
        <stop offset="0%" stop-color="#e0f2fe" stop-opacity="0.6"/>
        <stop offset="30%" stop-color="#bae6fd" stop-opacity="0.35"/>
        <stop offset="60%" stop-color="#7dd3fc" stop-opacity="0.15"/>
        <stop offset="100%" stop-color="#0c4a6e" stop-opacity="0"/>
      </radialGradient>
      <filter id="jelly-blur" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2"/>
      </filter>
    </defs>

    <!-- Light beams from surface -->
    <path d="M120,0 L80,480 L160,480Z" fill="#22d3ee" opacity="0.03"/>
    <path d="M290,0 L250,380 L330,380Z" fill="#22d3ee" opacity="0.02"/>
    <path d="M420,0 L400,300 L450,300Z" fill="#0891b2" opacity="0.015"/>

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- TROPICAL FISH 1 - large, lower right area                     -->
    <!-- Rounder body, luminous rainbow gradient, gossamer fins        -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <g transform="translate(370,555) scale(-1,1)" opacity="0.22" filter="url(#fish-glow)">
      <!-- Body: rounder, more organic tropical shape -->
      <path d="M-30,0 C-28,-18 -18,-28 -6,-30 C6,-30 18,-26 26,-18 C32,-10 34,-4 34,0 C34,5 32,12 26,20 C18,28 6,30 -6,30 C-18,28 -28,16 -30,0Z" fill="url(#f1-body)"/>
      <!-- Iridescent shimmer across body -->
      <path d="M-30,0 C-28,-18 -18,-28 -6,-30 C6,-30 18,-26 26,-18 C32,-10 34,-4 34,0 C34,5 32,12 26,20 C18,28 6,30 -6,30 C-18,28 -28,16 -30,0Z" fill="url(#f-shimmer)"/>
      <!-- Translucent color band overlays for depth -->
      <path d="M-24,-12 C-18,-24 -4,-30 10,-28 C22,-24 30,-14 32,-4 L32,0 C30,4 26,8 20,10 C10,12 -6,8 -16,2Z" fill="#67e8f9" opacity="0.12"/>
      <path d="M-20,6 C-14,18 0,26 12,26 C22,24 30,16 32,8 L32,0 C30,-4 26,-8 20,-10 C12,-8 2,0 -10,4Z" fill="#f97316" opacity="0.08"/>
      <path d="M-8,-4 C-2,-14 10,-18 20,-14 C28,-10 32,-4 32,0 C32,4 28,10 20,14 C10,16 -2,10 -8,4Z" fill="#34d399" opacity="0.06"/>
      <!-- Dorsal fin: tall, gossamer, many rays -->
      <path d="M-8,-28 Q-2,-48 8,-42 Q14,-38 18,-30 Q12,-28 4,-28Z" fill="#22d3ee" opacity="0.3"/>
      <line x1="-4" y1="-28" x2="0" y2="-44" stroke="#0891b2" stroke-width="0.3" opacity="0.5"/>
      <line x1="-1" y1="-28" x2="3" y2="-43" stroke="#0891b2" stroke-width="0.3" opacity="0.45"/>
      <line x1="2" y1="-28" x2="6" y2="-42" stroke="#0891b2" stroke-width="0.3" opacity="0.4"/>
      <line x1="5" y1="-28" x2="9" y2="-40" stroke="#0891b2" stroke-width="0.3" opacity="0.35"/>
      <line x1="8" y1="-28" x2="12" y2="-38" stroke="#0891b2" stroke-width="0.3" opacity="0.3"/>
      <line x1="11" y1="-28" x2="14" y2="-36" stroke="#0891b2" stroke-width="0.3" opacity="0.25"/>
      <!-- Pectoral fin: delicate fan -->
      <path d="M-12,4 Q-24,12 -20,22 Q-14,20 -10,14 Q-8,10 -8,6Z" fill="#22d3ee" opacity="0.22"/>
      <line x1="-11" y1="5" x2="-20" y2="14" stroke="#0891b2" stroke-width="0.25" opacity="0.4"/>
      <line x1="-10" y1="7" x2="-18" y2="17" stroke="#0891b2" stroke-width="0.25" opacity="0.35"/>
      <line x1="-9" y1="9" x2="-16" y2="19" stroke="#0891b2" stroke-width="0.25" opacity="0.3"/>
      <!-- Pelvic fin -->
      <path d="M4,26 Q8,36 14,34 Q12,28 8,24Z" fill="#10b981" opacity="0.2"/>
      <line x1="5" y1="27" x2="9" y2="34" stroke="#0891b2" stroke-width="0.2" opacity="0.3"/>
      <!-- Anal fin -->
      <path d="M16,26 Q22,34 28,30 Q24,24 20,22Z" fill="#22d3ee" opacity="0.2"/>
      <line x1="18" y1="25" x2="23" y2="32" stroke="#0891b2" stroke-width="0.2" opacity="0.3"/>
      <line x1="20" y1="24" x2="25" y2="31" stroke="#0891b2" stroke-width="0.2" opacity="0.25"/>
      <!-- Forked tail: elegant spread with many rays -->
      <path d="M32,-2 Q38,-10 42,-18 Q44,-20 46,-18 Q42,-8 38,0 Q42,10 46,20 Q44,22 42,20 Q38,12 32,4Z" fill="#0891b2" opacity="0.45"/>
      <path d="M32,-2 Q38,-10 42,-18 Q44,-20 46,-18 Q42,-8 38,0 Q42,10 46,20 Q44,22 42,20 Q38,12 32,4Z" fill="url(#f1-body)" opacity="0.2"/>
      <line x1="34" y1="0" x2="43" y2="-16" stroke="#065f82" stroke-width="0.25" opacity="0.5"/>
      <line x1="34" y1="0" x2="44" y2="-12" stroke="#065f82" stroke-width="0.25" opacity="0.4"/>
      <line x1="34" y1="0" x2="44" y2="-8" stroke="#065f82" stroke-width="0.25" opacity="0.35"/>
      <line x1="34" y1="1" x2="44" y2="10" stroke="#065f82" stroke-width="0.25" opacity="0.35"/>
      <line x1="34" y1="1" x2="44" y2="14" stroke="#065f82" stroke-width="0.25" opacity="0.4"/>
      <line x1="34" y1="1" x2="43" y2="18" stroke="#065f82" stroke-width="0.25" opacity="0.5"/>
      <!-- Eye: layered for depth - sclera, iris, pupil, highlight -->
      <circle cx="-20" cy="-8" r="5" fill="#0a1628" opacity="0.8"/>
      <circle cx="-20" cy="-8" r="4" fill="#164e63" opacity="0.6"/>
      <circle cx="-20" cy="-8" r="2.5" fill="#001122" opacity="0.8"/>
      <circle cx="-21" cy="-9" r="1.2" fill="#e0f2fe" opacity="0.7"/>
      <!-- Lateral line -->
      <path d="M-24,0 Q0,-2 30,0" stroke="#0891b2" stroke-width="0.3" fill="none" opacity="0.15"/>
    </g>

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- TROPICAL FISH 2 - smaller, upper area                        -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <g transform="translate(400,185) scale(0.65)" opacity="0.17" filter="url(#fish-glow)">
      <path d="M-26,0 C-24,-15 -14,-24 -4,-25 C8,-25 18,-20 24,-12 C28,-6 30,-2 30,0 C30,3 28,8 24,14 C18,22 8,25 -4,25 C-14,24 -24,14 -26,0Z" fill="url(#f2-body)"/>
      <path d="M-26,0 C-24,-15 -14,-24 -4,-25 C8,-25 18,-20 24,-12 C28,-6 30,-2 30,0 C30,3 28,8 24,14 C18,22 8,25 -4,25 C-14,24 -24,14 -26,0Z" fill="url(#f-shimmer)"/>
      <path d="M-18,-8 C-12,-18 0,-24 10,-20 C18,-16 26,-8 28,-2 L28,0 C26,3 22,6 16,7Z" fill="#0ea5e9" opacity="0.1"/>
      <path d="M-14,6 C-8,16 4,22 14,20 C22,16 28,8 28,2 L28,0 C24,-2 18,-2 10,0Z" fill="#fbbf24" opacity="0.07"/>
      <!-- Dorsal fin -->
      <path d="M-6,-22 Q0,-36 8,-30 Q12,-26 6,-22Z" fill="#0891b2" opacity="0.28"/>
      <line x1="-3" y1="-22" x2="1" y2="-32" stroke="#065f82" stroke-width="0.25" opacity="0.4"/>
      <line x1="0" y1="-22" x2="4" y2="-31" stroke="#065f82" stroke-width="0.25" opacity="0.35"/>
      <line x1="3" y1="-22" x2="7" y2="-29" stroke="#065f82" stroke-width="0.25" opacity="0.3"/>
      <!-- Pectoral fin -->
      <path d="M-8,3 Q-18,10 -14,16 Q-8,14 -6,8Z" fill="#22d3ee" opacity="0.2"/>
      <line x1="-7" y1="4" x2="-14" y2="11" stroke="#0891b2" stroke-width="0.2" opacity="0.35"/>
      <line x1="-6" y1="6" x2="-12" y2="13" stroke="#0891b2" stroke-width="0.2" opacity="0.3"/>
      <!-- Forked tail -->
      <path d="M28,-1 Q34,-10 38,-14 Q36,-4 34,0 Q36,6 38,16 Q34,12 28,3Z" fill="#0891b2" opacity="0.4"/>
      <line x1="30" y1="0" x2="36" y2="-11" stroke="#065f82" stroke-width="0.2" opacity="0.4"/>
      <line x1="30" y1="1" x2="36" y2="12" stroke="#065f82" stroke-width="0.2" opacity="0.4"/>
      <!-- Eye -->
      <circle cx="-16" cy="-5" r="4" fill="#0a1628" opacity="0.7"/>
      <circle cx="-16" cy="-5" r="3" fill="#164e63" opacity="0.5"/>
      <circle cx="-16" cy="-5" r="1.8" fill="#001122" opacity="0.7"/>
      <circle cx="-17" cy="-6" r="0.9" fill="#e0f2fe" opacity="0.6"/>
      <path d="M-20,0 Q0,-1 26,0" stroke="#0891b2" stroke-width="0.25" fill="none" opacity="0.12"/>
    </g>

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- JELLYFISH - luminous translucent bell, flowing tentacles      -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <g transform="translate(95,345)" opacity="0.2">
      <!-- Ambient glow (blurred) -->
      <ellipse cx="0" cy="-5" rx="38" ry="28" fill="url(#jelly-glow)" filter="url(#jelly-blur)"/>
      <!-- Bell dome: layered translucency -->
      <path d="M-24,6 C-24,-10 -16,-22 0,-22 C16,-22 24,-10 24,6 Q16,10 0,10 Q-16,10 -24,6Z" fill="#bae6fd" opacity="0.2"/>
      <path d="M-20,4 C-20,-8 -12,-18 0,-18 C12,-18 20,-8 20,4 Q12,7 0,7 Q-12,7 -20,4Z" fill="#e0f2fe" opacity="0.18"/>
      <!-- Inner organs visible through bell -->
      <ellipse cx="0" cy="-4" rx="8" ry="6" fill="#bae6fd" opacity="0.12"/>
      <ellipse cx="0" cy="-2" rx="5" ry="3" fill="#e0f2fe" opacity="0.1"/>
      <!-- Bell rim with scalloped edge -->
      <path d="M-24,6 Q-20,12 -14,10 Q-8,14 0,10 Q8,14 14,10 Q20,12 24,6" stroke="#7dd3fc" stroke-width="0.6" fill="none" opacity="0.25"/>
      <!-- Tentacles: varying thickness, graceful S-curves -->
      <path d="M-18,9 Q-20,28 -16,48 Q-14,62 -18,78 Q-16,88 -18,95" stroke="#bae6fd" stroke-width="0.6" fill="none" opacity="0.18"/>
      <path d="M-12,10 Q-10,32 -14,55 Q-16,70 -12,85 Q-10,92 -12,98" stroke="#bae6fd" stroke-width="0.5" fill="none" opacity="0.15"/>
      <path d="M-6,11 Q-4,36 -8,60 Q-10,76 -6,90 Q-4,96 -6,102" stroke="#e0f2fe" stroke-width="0.5" fill="none" opacity="0.12"/>
      <path d="M0,11 Q2,38 -2,62 Q-4,78 0,92 Q2,98 0,104" stroke="#e0f2fe" stroke-width="0.5" fill="none" opacity="0.12"/>
      <path d="M6,11 Q8,34 4,58 Q2,72 6,86 Q8,94 6,100" stroke="#e0f2fe" stroke-width="0.5" fill="none" opacity="0.12"/>
      <path d="M12,10 Q14,30 10,52 Q8,66 12,80 Q14,90 12,96" stroke="#bae6fd" stroke-width="0.5" fill="none" opacity="0.15"/>
      <path d="M18,9 Q20,26 16,46 Q14,58 18,72 Q20,82 18,90" stroke="#bae6fd" stroke-width="0.6" fill="none" opacity="0.18"/>
      <!-- Oral arms: frilly, thicker central tentacles -->
      <path d="M-8,10 Q-10,24 -6,36 Q-4,44 -8,52" stroke="#7dd3fc" stroke-width="1.4" fill="none" opacity="0.1"/>
      <path d="M-2,11 Q0,26 -4,38 Q-6,48 -2,56" stroke="#7dd3fc" stroke-width="1.4" fill="none" opacity="0.08"/>
      <path d="M4,11 Q6,24 2,36 Q0,46 4,54" stroke="#7dd3fc" stroke-width="1.4" fill="none" opacity="0.1"/>
      <path d="M10,10 Q12,22 8,34 Q6,42 10,50" stroke="#7dd3fc" stroke-width="1.2" fill="none" opacity="0.08"/>
    </g>

    <!-- Bubbles -->
    <circle cx="145" cy="445" r="5" fill="none" stroke="#22d3ee" stroke-width="0.5" opacity="0.08"/>
    <circle cx="160" cy="425" r="3" fill="none" stroke="#22d3ee" stroke-width="0.4" opacity="0.06"/>
    <circle cx="135" cy="470" r="4" fill="none" stroke="#22d3ee" stroke-width="0.4" opacity="0.05"/>
    <circle cx="375" cy="490" r="3.5" fill="none" stroke="#22d3ee" stroke-width="0.4" opacity="0.05"/>

  {:else if theme === "winter"}
    <!-- Crystalline 6-pointed snowflakes with side branches -->
    {#each [
      { x: 80, y: 80, s: 18 }, { x: 420, y: 55, s: 14 }, { x: 300, y: 160, s: 11 },
      { x: 50, y: 300, s: 20 }, { x: 440, y: 340, s: 16 }, { x: 170, y: 460, s: 13 },
      { x: 390, y: 520, s: 18 }, { x: 60, y: 600, s: 14 }, { x: 250, y: 70, s: 10 },
      { x: 460, y: 220, s: 9 }, { x: 130, y: 380, s: 8 }, { x: 350, y: 640, s: 12 },
    ] as flake}
      <g transform="translate({flake.x},{flake.y})" opacity="0.15" stroke="white" fill="none">
        {#each Array(6) as _, i}
          {@const a = i * 60 * Math.PI / 180}
          <!-- Main branch -->
          <line x1="0" y1="0" x2={Math.cos(a) * flake.s} y2={Math.sin(a) * flake.s} stroke-width="0.8"/>
          <!-- Side branches at 1/3 -->
          {@const bx1 = Math.cos(a) * flake.s / 3}
          {@const by1 = Math.sin(a) * flake.s / 3}
          {@const slen1 = flake.s * 0.3}
          <line x1={bx1} y1={by1} x2={bx1 + Math.cos(a - Math.PI/4) * slen1} y2={by1 + Math.sin(a - Math.PI/4) * slen1} stroke-width="0.5"/>
          <line x1={bx1} y1={by1} x2={bx1 + Math.cos(a + Math.PI/4) * slen1} y2={by1 + Math.sin(a + Math.PI/4) * slen1} stroke-width="0.5"/>
          <!-- Side branches at 2/3 -->
          {@const bx2 = Math.cos(a) * flake.s * 2/3}
          {@const by2 = Math.sin(a) * flake.s * 2/3}
          {@const slen2 = flake.s * 0.2}
          <line x1={bx2} y1={by2} x2={bx2 + Math.cos(a - Math.PI/4) * slen2} y2={by2 + Math.sin(a - Math.PI/4) * slen2} stroke-width="0.4"/>
          <line x1={bx2} y1={by2} x2={bx2 + Math.cos(a + Math.PI/4) * slen2} y2={by2 + Math.sin(a + Math.PI/4) * slen2} stroke-width="0.4"/>
        {/each}
      </g>
    {/each}

  {:else if theme === "ember"}
    <!-- Coal bed glow at bottom -->
    <ellipse cx="250" cy="680" rx="300" ry="100" fill="#ea580c" opacity="0.06"/>
    <ellipse cx="180" cy="690" rx="150" ry="60" fill="#dc2626" opacity="0.04"/>
    <ellipse cx="350" cy="685" rx="120" ry="50" fill="#fbbf24" opacity="0.03"/>
    <!-- Rising embers with glow halos -->
    {#each Array(30) as _, i}
      {@const s = ((i * 16807 + 17) % 2147483647) / 2147483647}
      {@const s2 = ((i * 48271 + 17) % 2147483647) / 2147483647}
      {@const x = 30 + s * 440}
      {@const y = 150 + s2 * 520}
      {@const r = 1.5 + s * 2.5}
      {@const color = s > 0.6 ? "#fbbf24" : s > 0.3 ? "#fb923c" : "#ea580c"}
      <circle cx={x} cy={y} r={r * 4} fill={color} opacity={0.03 + s2 * 0.04}/>
      <circle cx={x} cy={y} r={r} fill={color} opacity={0.08 + s * 0.1}/>
    {/each}

  {:else if theme === "blossom"}
    <!-- Blossom petals using dual-ellipse shape from actual renderer -->
    {#each Array(20) as _, i}
      {@const s = ((i * 16807 + 31) % 2147483647) / 2147483647}
      {@const s2 = ((i * 48271 + 31) % 2147483647) / 2147483647}
      {@const x = 15 + s * 470}
      {@const y = 20 + s2 * 660}
      {@const size = 6 + s * 10}
      {@const rot = s2 * 360}
      {@const color = s > 0.5 ? "#f9a8d4" : "#f472b6"}
      <g transform="translate({x},{y}) rotate({rot})">
        <ellipse cx="0" cy="0" rx={size * 0.6} ry={size} fill={color} opacity={0.06 + s * 0.06}/>
        <ellipse cx="0" cy="0" rx={size * 0.4} ry={size * 0.8} fill={color} opacity={0.04 + s * 0.04} transform="rotate(45)"/>
      </g>
    {/each}
    <!-- Full 5-petal flowers -->
    {#each [{ x: 410, y: 100, s: 18 }, { x: 80, y: 540, s: 15 }, { x: 320, y: 610, s: 13 }] as f}
      <g transform="translate({f.x},{f.y})">
        {#each Array(5) as _, i}
          {@const a = (i * 72 - 90) * Math.PI / 180}
          {@const px = Math.cos(a) * f.s * 0.35}
          {@const py = Math.sin(a) * f.s * 0.35}
          <ellipse cx={px} cy={py} rx={f.s * 0.35} ry={f.s * 0.5} fill="#f9a8d4" opacity="0.08" transform="rotate({i * 72 - 90} {px} {py})"/>
        {/each}
        <circle cx="0" cy="0" r={f.s * 0.12} fill="#fbbf24" opacity="0.1"/>
      </g>
    {/each}

  {:else if theme === "forest"}
    <!-- Stars in upper sky -->
    {#each Array(25) as _, i}
      {@const s = ((i * 16807 + 53) % 2147483647) / 2147483647}
      {@const s2 = ((i * 48271 + 53) % 2147483647) / 2147483647}
      <circle cx={s * 500} cy={s2 * 250} r={0.4 + s * 1} fill="#bfdbfe" opacity={0.2 + s2 * 0.3}/>
    {/each}
    <!-- Tree branching up from bottom -->
    <g opacity="0.15">
      <!-- Trunk -->
      <path d="M250,700 L250,500 Q248,480 240,460" stroke="#0d3320" stroke-width="8" fill="none"/>
      <path d="M250,700 L250,500 Q252,480 260,460" stroke="#0d3320" stroke-width="8" fill="none"/>
      <!-- Main branches -->
      <path d="M245,540 Q200,500 160,480 Q140,470 120,475" stroke="#0d3320" stroke-width="4" fill="none"/>
      <path d="M255,540 Q300,500 340,480 Q360,470 380,475" stroke="#0d3320" stroke-width="4" fill="none"/>
      <path d="M242,500 Q210,460 180,440" stroke="#0d3320" stroke-width="3" fill="none"/>
      <path d="M258,500 Q290,460 320,440" stroke="#0d3320" stroke-width="3" fill="none"/>
      <!-- Smaller branches -->
      <path d="M240,470 Q220,440 200,420" stroke="#0d3320" stroke-width="2" fill="none"/>
      <path d="M260,470 Q280,440 300,420" stroke="#0d3320" stroke-width="2" fill="none"/>
      <path d="M170,475 Q150,460 140,440" stroke="#0d3320" stroke-width="2" fill="none"/>
      <path d="M330,475 Q350,460 360,440" stroke="#0d3320" stroke-width="2" fill="none"/>
      <!-- Leaf canopy clusters -->
      <circle cx="120" cy="470" r="25" fill="#166534" opacity="0.3"/>
      <circle cx="160" cy="445" r="20" fill="#0d3320" opacity="0.25"/>
      <circle cx="180" cy="435" r="22" fill="#166534" opacity="0.2"/>
      <circle cx="200" cy="415" r="18" fill="#0d3320" opacity="0.25"/>
      <circle cx="380" cy="470" r="25" fill="#166534" opacity="0.3"/>
      <circle cx="340" cy="445" r="20" fill="#0d3320" opacity="0.25"/>
      <circle cx="320" cy="435" r="22" fill="#166534" opacity="0.2"/>
      <circle cx="300" cy="415" r="18" fill="#0d3320" opacity="0.25"/>
      <circle cx="240" cy="450" r="24" fill="#166534" opacity="0.2"/>
      <circle cx="260" cy="450" r="24" fill="#166534" opacity="0.2"/>
    </g>
    <!-- Ground -->
    <path d="M0,660 Q100,640 200,650 Q300,640 400,650 Q450,645 500,655 L500,700 L0,700Z" fill="#0a1810" opacity="0.2"/>
    <!-- Fireflies with prominent glow -->
    {#each Array(14) as _, i}
      {@const s = ((i * 16807 + 53) % 2147483647) / 2147483647}
      {@const s2 = ((i * 48271 + 53) % 2147483647) / 2147483647}
      {@const x = 30 + s * 440}
      {@const y = 80 + s2 * 520}
      {@const color = s > 0.5 ? "#bef264" : s > 0.2 ? "#22c55e" : "#fbbf24"}
      <circle cx={x} cy={y} r="10" fill={color} opacity="0.04"/>
      <circle cx={x} cy={y} r="2.5" fill={color} opacity={0.12 + s * 0.1}/>
    {/each}

  {:else if theme === "autumn"}
    <!-- Real leaf shapes from the background package -->
    {#each [
      { x: 400, y: 120, r: 45, s: 0.18, c: "#D4A017" },
      { x: 80, y: 200, r: 120, s: 0.15, c: "#CC5500" },
      { x: 350, y: 350, r: 200, s: 0.14, c: "#8B0000" },
      { x: 60, y: 480, r: 310, s: 0.16, c: "#DAA520" },
      { x: 420, y: 550, r: 150, s: 0.13, c: "#CD5C5C" },
      { x: 180, y: 600, r: 80, s: 0.17, c: "#D2691E" },
      { x: 300, y: 80, r: 260, s: 0.12, c: "#6B4423" },
      { x: 440, y: 400, r: 30, s: 0.11, c: "#CC5500" },
    ] as leaf, i}
      <g transform="translate({leaf.x},{leaf.y}) rotate({leaf.r}) scale({leaf.s})" opacity="0.1">
        {#if i % 3 === 0}
          <!-- Actual maple leaf path -->
          <path d="M55.15,85.62c1.73,11.9-0.93,21.51-8.05,31.37c-1.6,2.21-3.29,3.99-5.25,5.89c-0.01-2.63-1.69-3.76-4.22-4.34C48.04,108.25,52.33,96.9,53.7,85.62h-2.36c-7.79-0.77-16.33,12.35-26.35,15.92c4.77-9.16-0.56-10.4-12.66-6.33c9.05-10.8,9.93-14.79,0-13.35c5.13-3.88,9.9-6.11,14.38-7.02c-9.33-2.97-17.63-7.97-24.64-15.57c13.16-0.48,9.93-9.37-2.05-22.76c15.93,8.01,24.33,9.02,21.73-0.17c4.71,3.18,10.75,9.27,17.11,16.09c-2.45-12.5-4.29-24.34-3.42-33.2C41.63,28.56,48.3,19.12,54.84,0c5.51,17.44,11.43,27.12,18.92,20.08c0.97,7.76-0.07,16.06-2.74,24.81l-0.17,6.67c6.21-6.7,12.31-13.03,17.22-15.44c-3.05,10.09,7.63,6.57,21.28,0.38c-12.92,14.44-13.94,22.06-2.57,22.59c-4.73,7.36-13.07,11.84-22.76,15.23c4.22,1.21,8.44,3.49,12.66,7.02c-8.73-0.72-6.9,5,0.25,14.2c-10.92-3.2-16.49-2.33-13.04,6C70.98,90.74,61.77,85.51,56.13,85.62H55.15Z" fill={leaf.c} transform="translate(-55,-61)"/>
        {:else if i % 3 === 1}
          <!-- Actual curved leaf path -->
          <path d="M104.38,97.86c5.03,6.72,9.37,12.3,11.72,18.72c2.29,6.26,3.22,9.11-1.98,2.63c-4.84-6.04-9.36-11.91-15.98-17.48c-0.47,0.11-0.96,0.21-1.49,0.32C36.81,113.93-6.78,87.01,0.87,0c46.1,15.96,111.38,9.48,104.62,91.25C105.25,94.29,105.02,96.37,104.38,97.86zM88.32,84.78c-15.04-32.4-53.68-43.51-72.85-65.67C36.28,59.7,47.63,57.91,88.32,84.78z" fill={leaf.c} transform="translate(-59,-61)"/>
        {:else}
          <!-- Actual oak leaf path -->
          <path d="M120.96,113.47l-11.6-10.88c12.55-18.33,15.86-36.43,11.45-54.03c-3.26-9.99-9.58-17.97-17.83-24.33l-1.06,70.41l-5.18-5.09L69.34,8.35c-7.1-4.6-15.3-8.22-24.05-11.05l4.26,61.34l-5.18-5.09L37.16,2.16C23.82,0.6,10.93,0.14,0.18,0.17L0,0v8.84c38.3,38.3,75.14,75.14,112.8,112.8C119.93,126.02,124.49,117.75,120.96,113.47zM0.36,15.78c0.3,6.98,0.84,14.42,1.74,21.99l21.5,1.25zM2.71,42.57c1.27,9.21,3.1,18.52,5.67,27.39l49.54,3.38L28.75,44.17zM9.87,74.82c2.87,8.74,6.53,16.92,11.18,23.99l61-1.34L63.09,78.51zM24.45,103.54c6.3,8.04,14.18,14.18,23.99,17.39c16.01,4.01,32.29,1.72,48.9-8.17L87.18,102.6z" fill={leaf.c} transform="translate(-62,-63)"/>
        {/if}
      </g>
    {/each}

  {:else if theme === "pride"}
    <!-- Pride: no extra decorations. The rainbow border IS the decoration. -->
  {/if}
</svg>

<style>
  .decorations {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
</style>
