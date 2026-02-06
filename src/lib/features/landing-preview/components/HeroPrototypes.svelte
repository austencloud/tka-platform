<!--
  HeroPrototypes.svelte

  Four hero layout concepts for landing page redesign.
  Rendered inside the Landing Preview "Hero Lab" tab.

  Variant B renders real pictographs from Firestore.
  Variant C renders real video in a wide 16:9 panel.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import type { IBrowseLoader } from "$lib/features/browse/sequences/display/services/contracts/IBrowseLoader";
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import EndlessVideoPlayer from "./EndlessVideoPlayer.svelte";
  import VideoShowcaseSection from "../../../../routes/landing/components/VideoShowcaseSection.svelte";
  import { getFirestoreInstance } from "$lib/shared/auth/firebase";

  type VariantId = "aha" | "notation" | "immersive" | "dense" | "reveal";

  let active = $state<VariantId>("reveal");

  const VARIANTS: { id: VariantId; label: string }[] = [
    { id: "reveal", label: "E: Watch then Read" },
    { id: "notation", label: "B: Notation Hero" },
    { id: "immersive", label: "C: Immersive Wide" },
    { id: "aha", label: "A: Video + Notation" },
    { id: "dense", label: "D: Dense Split" },
  ];

  // ── Sequence data for variant B ──
  let sequenceSteps = $state<StepData[]>([]);
  let sequenceWord = $state("");
  let loadingSequence = $state(true);

  // ── Video data for variant C ──
  let wideVideos = $state<Array<{ src: string; title?: string; description?: string }>>([]);
  let loadingVideos = $state(true);

  // ── Reveal state for variant E ──
  // Notation slides in after a delay once both data sources load
  let notationRevealed = $state(false);
  let revealTimer: ReturnType<typeof setTimeout> | null = null;

  function triggerRevealIfReady() {
    if (!loadingSequence && !loadingVideos && sequenceSteps.length > 0 && !notationRevealed) {
      // Wait 2 seconds after data loads before revealing notation
      revealTimer = setTimeout(() => {
        notationRevealed = true;
      }, 2000);
    }
  }

  // Watch for data loading completion to trigger reveal
  $effect(() => {
    // Track these to re-run when they change
    void loadingSequence;
    void loadingVideos;
    void sequenceSteps.length;
    triggerRevealIfReady();
  });

  // Reset reveal when switching away and back
  $effect(() => {
    if (active !== "reveal") {
      notationRevealed = false;
      if (revealTimer) {
        clearTimeout(revealTimer);
        revealTimer = null;
      }
    } else {
      triggerRevealIfReady();
    }
  });

  // Mock data for variants A and D (unchanged - these are layout-only prototypes)
  const MOCK_BEATS = [
    { letter: "E", bx: 50, by: 5, rx: 50, ry: 95 },
    { letter: "C", bx: 95, by: 50, rx: 5, ry: 50 },
    { letter: "K", bx: 50, by: 5, rx: 95, ry: 50 },
    { letter: "\u03A8-", bx: 5, by: 50, rx: 50, ry: 95 },
  ];

  function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffled[i] as T;
      shuffled[i] = shuffled[j] as T;
      shuffled[j] = temp;
    }
    return shuffled;
  }

  onMount(async () => {
    // Load real sequence for variant B
    loadSequenceData();

    // Load real videos for variant C
    loadVideoData();
  });

  async function loadSequenceData() {
    try {
      const browseLoader = container.items.browseLoader as IBrowseLoader;
      const allSequences = await browseLoader.loadSequenceMetadata();

      // Pick candidates with 4-8 letter words (likely 4-8 beats)
      const candidates = allSequences.filter(
        (s) => s.word && s.word.length >= 4 && s.word.length <= 8
      );

      // Try to load a few until we find one with good step data
      const shuffled = shuffleArray(candidates).slice(0, 5);

      for (const candidate of shuffled) {
        const fullData = await browseLoader.loadFullSequenceData(candidate.word);
        if (fullData && fullData.steps.length >= 4 && fullData.steps.length <= 10) {
          sequenceSteps = fullData.steps as StepData[];
          sequenceWord = fullData.word;
          break;
        }
      }
    } catch (e) {
      console.error("[HeroPrototypes] Failed to load sequence:", e);
    } finally {
      loadingSequence = false;
    }
  }

  async function loadVideoData() {
    try {
      const { collection, getDocs, query, where, orderBy, limit } = await import(
        "firebase/firestore"
      );
      const db = await getFirestoreInstance();
      const q = query(
        collection(db, "showcaseVideos"),
        where("featured", "==", true),
        where("approved", "==", true),
        orderBy("instagramDate", "desc"),
        limit(20)
      );

      const snapshot = await getDocs(q);
      const loaded: Array<{ src: string; title?: string; description?: string }> = [];
      for (const d of snapshot.docs) {
        const data = d.data();
        if (data.excluded || !data.videoUrl) continue;
        loaded.push({
          src: data.videoUrl as string,
          title: data.title || data.performers?.[0]?.displayName || undefined,
          description: data.linkedSequences?.[0]?.word || undefined,
        });
      }

      wideVideos = shuffleArray(loaded);
    } catch (e) {
      console.error("[HeroPrototypes] Failed to load videos:", e);
    } finally {
      loadingVideos = false;
    }
  }
</script>

<!-- Sticky variant selector -->
<div class="variant-bar">
  {#each VARIANTS as v}
    <button
      class="vbtn"
      class:active={active === v.id}
      onclick={() => (active = v.id)}
    >
      {v.label}
    </button>
  {/each}
</div>

<div class="stage">

  <!-- ═══════════════════════════════════════════
       A: AHA MOMENT
       Video + notation side by side in one card.
       (Placeholder - needs video/notation timing sync)
       ═══════════════════════════════════════════ -->
  {#if active === "aha"}
    <section class="hero hero-aha">
      <div class="aha-inner">
        <div class="aha-text">
          <h1>The Kinetic<br />Alphabet</h1>
          <p class="tagline">
            Read choreography like sheet music. Each pictograph captures one
            beat: hand positions, prop rotation, direction of travel.
          </p>
          <div class="ctas">
            <button class="cta-primary">Open TKA Scribe &rarr;</button>
            <button class="cta-secondary">See how it works</button>
          </div>
        </div>

        <div class="aha-card">
          <div class="aha-video">
            <VideoShowcaseSection compact />
          </div>
          <div class="aha-notation">
            <div class="aha-word">ECK&Psi;-</div>
            <div class="aha-grid">
              {#each MOCK_BEATS as beat, i}
                <div class="pcell">
                  <span class="pnum">{i + 1}</span>
                  <svg viewBox="0 0 100 100">
                    <polygon
                      points="50,5 95,50 50,95 5,50"
                      fill="none"
                      stroke="rgba(255,255,255,0.1)"
                      stroke-width="0.75"
                    />
                    <circle cx="50" cy="5" r="2" fill="rgba(255,255,255,0.15)" />
                    <circle cx="95" cy="50" r="2" fill="rgba(255,255,255,0.15)" />
                    <circle cx="50" cy="95" r="2" fill="rgba(255,255,255,0.15)" />
                    <circle cx="5" cy="50" r="2" fill="rgba(255,255,255,0.15)" />
                    <circle cx={beat.bx} cy={beat.by} r="7" fill="#3b82f6" />
                    <circle cx={beat.rx} cy={beat.ry} r="7" fill="#ef4444" />
                  </svg>
                  <span class="pletter">{beat.letter}</span>
                </div>
              {/each}
            </div>
          </div>
        </div>
      </div>
    </section>

  <!-- ═══════════════════════════════════════════
       B: NOTATION HERO
       Real pictograph sequence as the visual centerpiece.
       Full-width row of beats, title above, CTAs below.
       ═══════════════════════════════════════════ -->
  {:else if active === "notation"}
    <section class="hero hero-notation">
      <div class="notation-inner">
        <h1>The Kinetic Alphabet</h1>
        <p class="tagline">Notation for flow arts</p>

        {#if loadingSequence}
          <div class="sequence-loading">
            <div class="spinner"></div>
            <span>Loading sequence...</span>
          </div>
        {:else if sequenceSteps.length > 0}
          <div class="sequence-strip">
            {#each sequenceSteps as step, i}
              <div class="strip-cell" style="animation-delay: {i * 0.08}s">
                <div class="strip-picto">
                  <PictographContainer
                    pictographData={step}
                    darkMode={true}
                    disableTransitions
                    showVTG={false}
                    showElemental={false}
                    showPositions={false}
                  />
                </div>
              </div>
            {/each}
          </div>

          <p class="sequence-word">{sequenceWord}</p>
        {:else}
          <div class="sequence-loading">
            <span>No sequences available</span>
          </div>
        {/if}

        <div class="ctas ctas-center">
          <button class="cta-primary">Open TKA Scribe &rarr;</button>
          <button class="cta-secondary">See how it works</button>
        </div>
      </div>
    </section>

  <!-- ═══════════════════════════════════════════
       C: IMMERSIVE WIDE
       Full-width 16:9 panel with real video.
       Title and CTAs overlaid on left via gradient.
       ═══════════════════════════════════════════ -->
  {:else if active === "immersive"}
    <section class="hero hero-immersive">
      <div class="immersive-panel">
        <div class="immersive-overlay">
          <h1>The Kinetic<br />Alphabet</h1>
          <p class="tagline">Notation for flow arts</p>
          <div class="ctas">
            <button class="cta-primary">Open TKA Scribe &rarr;</button>
            <button class="cta-secondary cta-ghost">See how it works</button>
          </div>
        </div>

        <div class="immersive-video">
          {#if loadingVideos}
            <div class="video-loading">
              <div class="spinner"></div>
            </div>
          {:else if wideVideos.length > 0}
            <EndlessVideoPlayer videos={wideVideos} crossfadeDuration={1000} showInfo={false} />
          {:else}
            <div class="video-loading">
              <span>No videos available</span>
            </div>
          {/if}
        </div>
      </div>
    </section>

  <!-- ═══════════════════════════════════════════
       E: WATCH THEN READ
       Video plays center-stage, then after a beat
       the notation strip slides up beneath it.
       "See the movement, then read the notation."
       ═══════════════════════════════════════════ -->
  {:else if active === "reveal"}
    <section class="hero hero-reveal">
      <div class="reveal-inner">
        <h1>The Kinetic Alphabet</h1>
        <p class="tagline reveal-tagline">Notation for flow arts</p>

        <!-- Video takes center stage first -->
        <div class="reveal-video-wrap">
          <VideoShowcaseSection compact />
        </div>

        <!-- Notation strip slides up after delay -->
        <div class="reveal-notation" class:visible={notationRevealed}>
          <p class="reveal-label">That sequence, written down:</p>

          {#if loadingSequence}
            <div class="sequence-loading">
              <div class="spinner"></div>
            </div>
          {:else if sequenceSteps.length > 0}
            <div class="reveal-strip">
              {#each sequenceSteps as step, i}
                <div
                  class="reveal-cell"
                  class:animate={notationRevealed}
                  style="animation-delay: {0.3 + i * 0.1}s"
                >
                  <div class="strip-picto">
                    <PictographContainer
                      pictographData={step}
                      darkMode={true}
                      disableTransitions
                      showVTG={false}
                      showElemental={false}
                      showPositions={false}
                    />
                  </div>
                </div>
              {/each}
            </div>

            <p class="reveal-word" class:visible={notationRevealed}>{sequenceWord}</p>
          {/if}
        </div>

        <div class="ctas ctas-center" class:visible={notationRevealed}>
          <button class="cta-primary">Open TKA Scribe &rarr;</button>
          <button class="cta-secondary">See how it works</button>
        </div>
      </div>
    </section>

  <!-- ═══════════════════════════════════════════
       D: DENSE SPLIT
       Current layout + mini-pictographs, stats,
       and a better tagline. Fills the empty space.
       ═══════════════════════════════════════════ -->
  {:else if active === "dense"}
    <section class="hero hero-dense">
      <div class="dense-inner">
        <div class="dense-text">
          <h1>The Kinetic<br />Alphabet</h1>
          <p class="tagline">
            Read choreography like sheet music. String beats into words.
            Words become sequences you can share without video.
          </p>

          <!-- Position previews -->
          <div class="pos-row">
            {#each [
              { label: "Alpha", desc: "Hands opposite", bx: 50, by: 5, rx: 50, ry: 95 },
              { label: "Beta", desc: "Hands together", bx: 55, by: 8, rx: 45, ry: 8 },
              { label: "Gamma", desc: "Right angle", bx: 50, by: 5, rx: 95, ry: 50 },
            ] as pos}
              <div class="pos-card">
                <svg viewBox="0 0 100 100" class="pos-svg">
                  <polygon
                    points="50,5 95,50 50,95 5,50"
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    stroke-width="0.75"
                  />
                  <circle cx={pos.bx} cy={pos.by} r="8" fill="#3b82f6" />
                  <circle cx={pos.rx} cy={pos.ry} r="8" fill="#ef4444" />
                </svg>
                <strong>{pos.label}</strong>
                <span>{pos.desc}</span>
              </div>
            {/each}
          </div>

          <!-- Stats -->
          <div class="stats-row">
            <div class="stat"><strong>22</strong><span>letters</span></div>
            <div class="stat"><strong>6</strong><span>types</span></div>
            <div class="stat"><strong>3</strong><span>levels</span></div>
          </div>

          <div class="ctas">
            <button class="cta-primary">Open TKA Scribe &rarr;</button>
            <button class="cta-secondary">See how it works</button>
          </div>
        </div>

        <div class="dense-video">
          <VideoShowcaseSection compact />
        </div>
      </div>
    </section>
  {/if}
</div>

<style>
  /* ═══════ Variant selector ═══════ */
  .variant-bar {
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    gap: 6px;
    padding: 12px 16px;
    background: rgba(10, 10, 20, 0.95);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .vbtn {
    padding: 8px 16px;
    border: 1.5px solid rgba(255, 255, 255, 0.15);
    border-radius: 100px;
    background: transparent;
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .vbtn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: white;
  }

  .vbtn.active {
    background: rgba(99, 102, 241, 0.2);
    border-color: rgba(99, 102, 241, 0.5);
    color: #c7d2fe;
  }

  /* ═══════ Shared hero base ═══════ */
  .stage {
    background: linear-gradient(
      180deg,
      #070714 0%,
      #0d0d2b 40%,
      #111133 70%,
      #0a0a1e 100%
    );
  }

  .hero {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 80px 32px;
    color: white;
  }

  h1 {
    font-size: clamp(2.25rem, 5vw, 3.5rem);
    font-weight: 700;
    line-height: 1.12;
    margin-bottom: 16px;
    background: linear-gradient(
      135deg,
      #fff 0%,
      rgba(255, 255, 255, 0.72) 100%
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .tagline {
    font-size: clamp(1rem, 1.5vw, 1.25rem);
    color: rgba(255, 255, 255, 0.55);
    line-height: 1.7;
    margin-bottom: 32px;
    max-width: 480px;
  }

  .ctas {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .ctas-center {
    justify-content: center;
  }

  .cta-primary {
    padding: 14px 28px;
    border: none;
    border-radius: 12px;
    background: #6366f1;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .cta-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
  }

  .cta-secondary {
    padding: 14px 28px;
    border: 1.5px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    background: transparent;
    color: rgba(255, 255, 255, 0.8);
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: border-color 0.2s ease, background 0.2s ease;
  }

  .cta-secondary:hover {
    border-color: rgba(255, 255, 255, 0.4);
    background: rgba(255, 255, 255, 0.05);
  }

  .cta-ghost {
    border-color: rgba(255, 255, 255, 0.3);
    color: rgba(255, 255, 255, 0.9);
  }

  /* Shared loading / spinner */
  .spinner {
    width: 28px;
    height: 28px;
    border: 3px solid rgba(255, 255, 255, 0.15);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Shared pictograph cell (used by variant A mock only) */
  .pcell {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    padding: 6px;
    text-align: center;
  }

  .pcell svg {
    width: 100%;
    display: block;
  }

  .pnum {
    font-size: 0.625rem;
    color: rgba(255, 255, 255, 0.3);
  }

  .pletter {
    font-size: 0.8125rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.75);
    display: block;
    margin-top: 2px;
  }

  /* ═══════ A: Aha Moment ═══════ */
  .aha-inner {
    display: flex;
    align-items: center;
    gap: clamp(32px, 5vw, 72px);
    max-width: 1200px;
    width: 100%;
  }

  .aha-text {
    flex: 1;
    max-width: 420px;
  }

  .aha-card {
    display: flex;
    gap: 0;
    border-radius: 20px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.08);
    flex: 0 0 auto;
    width: clamp(480px, 50vw, 620px);
  }

  .aha-video {
    flex: 0 0 55%;
  }

  .aha-notation {
    flex: 1;
    padding: 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow: hidden;
  }

  .aha-word {
    font-size: 1.25rem;
    font-weight: 700;
    text-align: center;
    letter-spacing: 2px;
    padding-bottom: 4px;
  }

  .aha-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }

  /* ═══════ B: Notation Hero ═══════ */
  .notation-inner {
    text-align: center;
    max-width: 1100px;
    width: 100%;
  }

  .hero-notation .tagline {
    margin: 0 auto 48px;
  }

  .sequence-strip {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  .strip-cell {
    width: 110px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: 6px;
    animation: fadeUp 0.4s ease both;
  }

  @keyframes fadeUp {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .strip-picto {
    width: 100%;
    aspect-ratio: 1;
    position: relative;
  }

  .sequence-word {
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: 4px;
    color: rgba(255, 255, 255, 0.35);
    margin-bottom: 40px;
  }

  .sequence-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 60px 0;
    color: rgba(255, 255, 255, 0.4);
  }

  /* ═══════ C: Immersive Wide ═══════ */
  .hero-immersive {
    padding: 80px 48px;
  }

  .immersive-panel {
    position: relative;
    width: 100%;
    max-width: 1100px;
    aspect-ratio: 16 / 9;
    border-radius: 24px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .immersive-overlay {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 60px;
    background: linear-gradient(
      90deg,
      rgba(0, 0, 0, 0.75) 0%,
      rgba(0, 0, 0, 0.3) 50%,
      transparent 80%
    );
    pointer-events: none;
  }

  .immersive-overlay .ctas {
    pointer-events: auto;
  }

  .immersive-video {
    position: absolute;
    inset: 0;
    z-index: 1;
    background: #000;
  }

  /* Override EndlessVideoPlayer styles for wide layout */
  .immersive-video :global(.endless-video-player) {
    aspect-ratio: unset;
    max-height: unset;
    height: 100%;
    border-radius: 0;
  }

  .video-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: rgba(255, 255, 255, 0.4);
  }

  /* ═══════ E: Watch then Read ═══════ */
  .reveal-inner {
    text-align: center;
    max-width: 1000px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .reveal-tagline {
    margin: 0 auto 32px;
  }

  .reveal-video-wrap {
    width: 100%;
    max-width: 320px;
    margin-bottom: 32px;
  }

  .reveal-notation {
    width: 100%;
    opacity: 0;
    transform: translateY(24px);
    transition: opacity 0.6s ease, transform 0.6s ease;
    pointer-events: none;
  }

  .reveal-notation.visible {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }

  .reveal-label {
    font-size: 0.9375rem;
    color: rgba(255, 255, 255, 0.4);
    margin-bottom: 16px;
    font-style: italic;
  }

  .reveal-strip {
    display: flex;
    gap: 10px;
    justify-content: center;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  .reveal-cell {
    width: 100px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: 5px;
    opacity: 0;
    transform: translateY(16px);
  }

  .reveal-cell.animate {
    animation: fadeUp 0.4s ease both;
  }

  .reveal-word {
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: 4px;
    color: rgba(255, 255, 255, 0.3);
    margin-bottom: 32px;
    opacity: 0;
    transition: opacity 0.5s ease 0.8s;
  }

  .reveal-word.visible {
    opacity: 1;
  }

  .hero-reveal .ctas {
    opacity: 0;
    transition: opacity 0.5s ease 1s;
  }

  .hero-reveal .ctas.visible {
    opacity: 1;
  }

  /* ═══════ D: Dense Split ═══════ */
  .dense-inner {
    display: flex;
    align-items: center;
    gap: clamp(32px, 5vw, 72px);
    max-width: 1200px;
    width: 100%;
  }

  .dense-text {
    flex: 1;
    max-width: 540px;
  }

  .dense-video {
    flex: 0 0 auto;
    width: clamp(280px, 30vw, 360px);
  }

  /* Position preview cards */
  .pos-row {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
  }

  .pos-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 8px 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
  }

  .pos-svg {
    width: 56px;
    height: 56px;
  }

  .pos-card strong {
    font-size: 0.8125rem;
    color: rgba(255, 255, 255, 0.85);
  }

  .pos-card span {
    font-size: 0.6875rem;
    color: rgba(255, 255, 255, 0.4);
  }

  /* Stats */
  .stats-row {
    display: flex;
    gap: 28px;
    margin-bottom: 32px;
  }

  .stat {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .stat strong {
    font-size: 1.75rem;
    font-weight: 700;
    color: #818cf8;
  }

  .stat span {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.45);
  }

  /* ═══════ Reduced motion ═══════ */
  @media (prefers-reduced-motion: reduce) {
    .strip-cell,
    .reveal-cell {
      animation: none;
      opacity: 1;
      transform: none;
    }

    .reveal-notation,
    .reveal-word,
    .hero-reveal .ctas {
      transition: none;
      opacity: 1;
      transform: none;
    }

    .spinner {
      animation: none;
    }

    .cta-primary,
    .cta-secondary,
    .vbtn {
      transition: none;
    }
  }
</style>
