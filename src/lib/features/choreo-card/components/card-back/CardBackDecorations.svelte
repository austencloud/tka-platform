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
    <!-- Light beams from surface -->
    <path d="M140,0 L100,400 L180,400Z" fill="#22d3ee" opacity="0.035"/>
    <path d="M310,0 L270,320 L350,320Z" fill="#22d3ee" opacity="0.025"/>
    <path d="M440,0 L415,250 L465,250Z" fill="#0891b2" opacity="0.02"/>
    <!-- Fish: proper bezier body shapes -->
    <!-- Large tropical fish, mid-left — body with dorsal hump, forked tail -->
    <g transform="translate(80,400) scale(1.8)" opacity="0.12">
      <path d="M-20,0 C-14,-14 -2,-18 8,-15 C15,-12 19,-6 20,-2 L22,0 L20,3 C19,7 15,14 8,15 C-2,17 -14,12 -20,0Z" fill="#22d3ee"/>
      <path d="M18,0 L30,-10 Q25,0 30,10Z" fill="#0891b2"/>
      <path d="M-4,-14 Q1,-22 6,-14" stroke="#0891b2" stroke-width="1" fill="none"/>
      <circle cx="-12" cy="-4" r="1.8" fill="#001122"/>
    </g>
    <!-- School of small fish, upper right -->
    <g opacity="0.1">
      <g transform="translate(360,170) scale(0.9)">
        <path d="M-12,0 C-8,-8 0,-10 6,-8 C10,-6 12,-2 13,0 C12,2 10,6 6,8 C0,10 -8,8 -12,0Z" fill="#22d3ee"/>
        <path d="M11,0 L18,-5 Q15,0 18,5Z" fill="#0891b2"/>
      </g>
      <g transform="translate(340,195) scale(0.8)">
        <path d="M-12,0 C-8,-8 0,-10 6,-8 C10,-6 12,-2 13,0 C12,2 10,6 6,8 C0,10 -8,8 -12,0Z" fill="#22d3ee"/>
        <path d="M11,0 L18,-5 Q15,0 18,5Z" fill="#0891b2"/>
      </g>
      <g transform="translate(380,185) scale(0.7)">
        <path d="M-12,0 C-8,-8 0,-10 6,-8 C10,-6 12,-2 13,0 C12,2 10,6 6,8 C0,10 -8,8 -12,0Z" fill="#22d3ee"/>
        <path d="M11,0 L18,-5 Q15,0 18,5Z" fill="#0891b2"/>
      </g>
      <g transform="translate(355,210) scale(0.75)">
        <path d="M-12,0 C-8,-8 0,-10 6,-8 C10,-6 12,-2 13,0 C12,2 10,6 6,8 C0,10 -8,8 -12,0Z" fill="#22d3ee"/>
        <path d="M11,0 L18,-5 Q15,0 18,5Z" fill="#0891b2"/>
      </g>
    </g>
    <!-- Large fish swimming left, lower area -->
    <g transform="translate(400,530) scale(-2.2, 2.2)" opacity="0.09">
      <path d="M-20,0 C-14,-12 -4,-16 6,-14 C14,-11 18,-5 20,-1 L22,0 L20,2 C18,6 14,13 6,14 C-4,15 -14,10 -20,0Z" fill="#0891b2"/>
      <path d="M18,0 L28,-9 Q24,0 28,9Z" fill="#065f82"/>
      <path d="M-2,-13 Q2,-20 7,-13" stroke="#065f82" stroke-width="0.8" fill="none"/>
      <circle cx="-12" cy="-3" r="1.5" fill="#001122"/>
    </g>
    <!-- Jellyfish -->
    <g transform="translate(120,300)" opacity="0.07">
      <ellipse cx="0" cy="0" rx="18" ry="12" fill="#818cf8"/>
      <ellipse cx="0" cy="4" rx="14" ry="5" fill="#a5b4fc" opacity="0.5"/>
      <path d="M-12,10 Q-15,35 -10,50" stroke="#818cf8" stroke-width="0.8" fill="none"/>
      <path d="M-4,11 Q-2,40 -6,55" stroke="#818cf8" stroke-width="0.8" fill="none"/>
      <path d="M4,11 Q6,38 2,52" stroke="#818cf8" stroke-width="0.8" fill="none"/>
      <path d="M12,10 Q14,32 10,48" stroke="#818cf8" stroke-width="0.8" fill="none"/>
    </g>
    <!-- Bubbles -->
    <circle cx="200" cy="350" r="6" fill="none" stroke="#22d3ee" stroke-width="0.6" opacity="0.08"/>
    <circle cx="215" cy="325" r="3.5" fill="none" stroke="#22d3ee" stroke-width="0.5" opacity="0.06"/>
    <circle cx="190" cy="380" r="4.5" fill="none" stroke="#22d3ee" stroke-width="0.5" opacity="0.05"/>

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
