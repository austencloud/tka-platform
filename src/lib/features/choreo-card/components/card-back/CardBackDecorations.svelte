<!--
  CardBackDecorations.svelte — Theme-specific SVG decorations

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
  {#if theme === "nightSky"}
    <!-- Stars: scattered white/blue dots -->
    {#each Array(80) as _, i}
      {@const s = ((i * 16807 + 42) % 2147483647) / 2147483647}
      {@const s2 = ((i * 16807 + 99) % 2147483647) / 2147483647}
      <circle
        cx={s * 500}
        cy={s2 * 700}
        r={0.5 + s * 1.5}
        fill={s > 0.7 ? "#c4b5fd" : "#ffffff"}
        opacity={0.3 + s2 * 0.5}
      />
    {/each}
    <!-- Moon glow upper right -->
    <circle cx="415" cy="85" r="60" fill="#f5f5dc" opacity="0.04"/>
    <circle cx="415" cy="85" r="20" fill="#f5f5dc" opacity="0.12"/>
    <!-- Aurora bands -->
    <path d="M0,100 Q125,50 250,110 Q375,170 500,70 L500,180 Q375,250 250,190 Q125,130 0,210Z" fill="#22c55e" opacity="0.04"/>
    <path d="M0,130 Q150,190 300,120 Q400,80 500,140 L500,200 Q400,140 300,180 Q150,250 0,180Z" fill="#818cf8" opacity="0.035"/>

  {:else if theme === "deepOcean"}
    <defs>
      <!-- Gradient for tropical fish body: rainbow bands like the generative version -->
      <linearGradient id="fish1-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.9"/>
        <stop offset="20%" stop-color="#f97316" stop-opacity="0.7"/>
        <stop offset="40%" stop-color="#22c55e" stop-opacity="0.6"/>
        <stop offset="60%" stop-color="#f472b6" stop-opacity="0.5"/>
        <stop offset="80%" stop-color="#22d3ee" stop-opacity="0.7"/>
        <stop offset="100%" stop-color="#0891b2" stop-opacity="0.8"/>
      </linearGradient>
      <linearGradient id="fish2-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0891b2" stop-opacity="0.8"/>
        <stop offset="25%" stop-color="#f59e0b" stop-opacity="0.5"/>
        <stop offset="50%" stop-color="#22d3ee" stop-opacity="0.6"/>
        <stop offset="75%" stop-color="#10b981" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="#0891b2" stop-opacity="0.7"/>
      </linearGradient>
      <!-- Jellyfish bell glow -->
      <radialGradient id="jelly-glow" cx="0.5" cy="0.4" r="0.6">
        <stop offset="0%" stop-color="#e0f2fe" stop-opacity="0.5"/>
        <stop offset="40%" stop-color="#bae6fd" stop-opacity="0.3"/>
        <stop offset="70%" stop-color="#7dd3fc" stop-opacity="0.15"/>
        <stop offset="100%" stop-color="#0c4a6e" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <!-- Light beams from surface -->
    <path d="M130,0 L90,450 L170,450Z" fill="#22d3ee" opacity="0.03"/>
    <path d="M300,0 L260,350 L340,350Z" fill="#22d3ee" opacity="0.02"/>
    <path d="M430,0 L410,280 L460,280Z" fill="#0891b2" opacity="0.015"/>

    <!-- TROPICAL FISH 1 — large, lower right, swimming left -->
    <!-- Rainbow gradient body with translucent color bands, dorsal fin, forked tail -->
    <g transform="translate(370,560) scale(-1,1)" opacity="0.18">
      <!-- Body: plump tropical shape with dorsal hump -->
      <path d="M-28,0 C-24,-20 -10,-28 4,-26 C16,-22 26,-14 30,-4 L32,0 L30,5 C26,16 16,24 4,26 C-10,27 -24,18 -28,0Z" fill="url(#fish1-body)"/>
      <!-- Translucent overlay bands for that rainbow shimmer -->
      <path d="M-20,-8 C-14,-20 0,-26 12,-22 C20,-18 26,-10 28,-4 L28,0 C26,4 22,8 16,10 C6,12 -8,8 -16,2Z" fill="#22d3ee" opacity="0.15"/>
      <path d="M-10,8 C-4,16 6,20 14,18 C20,16 26,10 28,4 L28,0 C26,-2 24,-4 20,-4 C12,-2 0,4 -10,8Z" fill="#f97316" opacity="0.1"/>
      <!-- Dorsal fin with rays -->
      <path d="M-6,-24 Q0,-38 10,-30 Q14,-26 8,-22Z" fill="#22d3ee" opacity="0.4"/>
      <line x1="-2" y1="-24" x2="4" y2="-32" stroke="#0891b2" stroke-width="0.4" opacity="0.5"/>
      <line x1="2" y1="-24" x2="7" y2="-31" stroke="#0891b2" stroke-width="0.4" opacity="0.4"/>
      <line x1="6" y1="-23" x2="9" y2="-29" stroke="#0891b2" stroke-width="0.4" opacity="0.3"/>
      <!-- Pectoral fin -->
      <path d="M-8,4 Q-16,14 -10,18 Q-4,16 -4,8Z" fill="#22d3ee" opacity="0.3"/>
      <line x1="-7" y1="6" x2="-12" y2="14" stroke="#0891b2" stroke-width="0.3" opacity="0.4"/>
      <line x1="-5" y1="7" x2="-9" y2="15" stroke="#0891b2" stroke-width="0.3" opacity="0.3"/>
      <!-- Anal fin -->
      <path d="M12,22 Q16,30 22,26 Q20,22 16,20Z" fill="#10b981" opacity="0.3"/>
      <!-- Forked tail -->
      <path d="M28,-2 Q34,-14 40,-18 Q36,-6 34,0 Q36,8 40,20 Q34,16 28,4Z" fill="#0891b2" opacity="0.5"/>
      <line x1="30" y1="0" x2="37" y2="-14" stroke="#065f82" stroke-width="0.3" opacity="0.5"/>
      <line x1="30" y1="0" x2="38" y2="-10" stroke="#065f82" stroke-width="0.3" opacity="0.4"/>
      <line x1="30" y1="1" x2="37" y2="14" stroke="#065f82" stroke-width="0.3" opacity="0.5"/>
      <line x1="30" y1="1" x2="38" y2="10" stroke="#065f82" stroke-width="0.3" opacity="0.4"/>
      <!-- Eye: dark pupil with light iris ring -->
      <circle cx="-18" cy="-6" r="4" fill="#001122" opacity="0.7"/>
      <circle cx="-18" cy="-6" r="3" fill="#0c4a6e" opacity="0.5"/>
      <circle cx="-19" cy="-7" r="1" fill="#e0f2fe" opacity="0.6"/>
    </g>

    <!-- TROPICAL FISH 2 — smaller, upper area near the word -->
    <g transform="translate(410,190) scale(0.7)" opacity="0.14">
      <path d="M-24,0 C-20,-16 -8,-22 4,-20 C14,-17 22,-10 26,-2 L28,0 L26,3 C22,12 14,18 4,20 C-8,21 -20,14 -24,0Z" fill="url(#fish2-body)"/>
      <path d="M-16,-6 C-10,-16 2,-20 10,-17 C16,-14 22,-8 24,-2 L24,0 C22,2 18,5 12,6 C4,7 -6,4 -12,0Z" fill="#f59e0b" opacity="0.1"/>
      <!-- Dorsal fin -->
      <path d="M-4,-18 Q2,-30 10,-24 Q12,-20 6,-17Z" fill="#0891b2" opacity="0.35"/>
      <line x1="-1" y1="-18" x2="4" y2="-26" stroke="#065f82" stroke-width="0.3" opacity="0.4"/>
      <line x1="3" y1="-18" x2="7" y2="-25" stroke="#065f82" stroke-width="0.3" opacity="0.3"/>
      <!-- Pectoral fin -->
      <path d="M-6,3 Q-12,10 -8,14 Q-2,12 -2,6Z" fill="#22d3ee" opacity="0.25"/>
      <!-- Forked tail -->
      <path d="M24,-1 Q30,-12 36,-14 Q32,-4 30,0 Q32,6 36,16 Q30,14 24,3Z" fill="#0891b2" opacity="0.4"/>
      <!-- Eye -->
      <circle cx="-14" cy="-4" r="3" fill="#001122" opacity="0.6"/>
      <circle cx="-14" cy="-4" r="2.2" fill="#0c4a6e" opacity="0.4"/>
      <circle cx="-15" cy="-5" r="0.8" fill="#e0f2fe" opacity="0.5"/>
    </g>

    <!-- JELLYFISH — translucent bell with glowing interior and flowing tentacles -->
    <g transform="translate(100,340)" opacity="0.16">
      <!-- Outer glow -->
      <ellipse cx="0" cy="0" rx="32" ry="22" fill="url(#jelly-glow)"/>
      <!-- Bell dome -->
      <path d="M-22,4 C-22,-12 -12,-20 0,-20 C12,-20 22,-12 22,4 Q16,8 0,8 Q-16,8 -22,4Z" fill="#bae6fd" opacity="0.25"/>
      <!-- Inner bell highlight -->
      <path d="M-14,0 C-14,-8 -6,-14 0,-14 C6,-14 14,-8 14,0 Q8,3 0,3 Q-8,3 -14,0Z" fill="#e0f2fe" opacity="0.2"/>
      <!-- Bell rim -->
      <path d="M-22,4 Q-16,10 0,10 Q16,10 22,4" stroke="#7dd3fc" stroke-width="0.8" fill="none" opacity="0.3"/>
      <!-- Tentacles: flowing, varying lengths, slight curves -->
      <path d="M-16,8 Q-18,30 -14,55 Q-12,65 -16,75" stroke="#bae6fd" stroke-width="0.7" fill="none" opacity="0.2"/>
      <path d="M-10,9 Q-8,35 -12,60 Q-14,72 -10,82" stroke="#bae6fd" stroke-width="0.6" fill="none" opacity="0.18"/>
      <path d="M-4,10 Q-2,40 -6,65 Q-8,78 -4,88" stroke="#e0f2fe" stroke-width="0.6" fill="none" opacity="0.15"/>
      <path d="M2,10 Q4,38 0,62 Q-2,75 2,85" stroke="#e0f2fe" stroke-width="0.6" fill="none" opacity="0.15"/>
      <path d="M8,9 Q10,35 6,58 Q4,70 8,80" stroke="#bae6fd" stroke-width="0.6" fill="none" opacity="0.18"/>
      <path d="M14,8 Q16,30 12,52 Q10,62 14,72" stroke="#bae6fd" stroke-width="0.7" fill="none" opacity="0.2"/>
      <!-- Oral arms: thicker, shorter central tentacles -->
      <path d="M-6,10 Q-8,28 -4,40" stroke="#7dd3fc" stroke-width="1.2" fill="none" opacity="0.12"/>
      <path d="M0,10 Q2,30 -2,42" stroke="#7dd3fc" stroke-width="1.2" fill="none" opacity="0.1"/>
      <path d="M6,10 Q8,26 4,38" stroke="#7dd3fc" stroke-width="1.2" fill="none" opacity="0.12"/>
    </g>

    <!-- Bubbles -->
    <circle cx="150" cy="430" r="5" fill="none" stroke="#22d3ee" stroke-width="0.5" opacity="0.08"/>
    <circle cx="165" cy="410" r="3" fill="none" stroke="#22d3ee" stroke-width="0.4" opacity="0.06"/>
    <circle cx="140" cy="455" r="4" fill="none" stroke="#22d3ee" stroke-width="0.4" opacity="0.05"/>
    <circle cx="380" cy="480" r="3.5" fill="none" stroke="#22d3ee" stroke-width="0.4" opacity="0.05"/>

  {:else if theme === "snowfall"}
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

  {:else if theme === "emberGlow"}
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

  {:else if theme === "sakuraDrift"}
    <!-- Cherry blossom petals using dual-ellipse shape from actual renderer -->
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

  {:else if theme === "fireflyForest"}
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

  {:else if theme === "autumnDrift"}
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
