<!--
  Landing redesign test variant — "A Specimen of the Kinetic Alphabet"

  Design test only; the live landing page at / is untouched. The page is set
  like a type-specimen sheet for a new writing system: plate numbers, figure
  captions, mono annotations, hairline rules, and the TKA grid as the ground
  texture. Real components throughout (PictographContainer, ChoreoCard,
  HowTkaAnimationCard, PlayWithItSection) — no mockups.

  Sequence-data derivation mirrors HowTkaWorksSection.svelte (same public
  sequence, same hydrate path). If this direction is adopted, that derivation
  should be lifted into a shared module instead of living in two places.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { hydrate } from "$lib/shared/foundation/services/sequence-hydrator";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  // NOTE: ChoreoCard and PlayWithItSection are deliberately absent. Both
  // transitively import $lib/shared/auth/firebase, whose auth listener pulls
  // in module-state — and module-state rewrites any URL whose first segment
  // isn't a module ID (so /test/* becomes /create/construct). The word is
  // typeset as a score line of PictographContainers instead, and the live
  // element is HowTkaAnimationCard (animation engine only, auth-free).
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
  import { Letter } from "$lib/shared/foundation/domain/models/letter";
  import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/start-position-deriver";
  import type { PublicSequenceIndex } from "$lib/shared/foundation/domain/models/public-sequence-index";
  import { LOOPType } from "$lib/shared/foundation/domain/models/generation/circular-models";
  import { LEVEL_METADATA, type LevelNumber } from "$lib/shared/domain/curriculum/level-metadata";
  import HowTkaAnimationCard from "../../landing/components/HowTkaAnimationCard.svelte";

  const propType = PropType.STAFF;
  const LANDING_SEQUENCE_ID = "3b7882d6-a87d-4b57-bbfe-8eacb9e39f04";

  let sequence = $state<SequenceData | null>(null);
  let loaded = $state(false);

  // Specimen figures, derived from the loaded sequence
  let emptyGridData = $state<PictographData | null>(null);
  let handsData = $state<PictographData | null>(null);
  let propsData = $state<PictographData | null>(null);
  let motionData = $state<PictographData | null>(null);

  // The word written out: start position + every step, one pictograph per beat
  let scoreLine = $state<{ label: string; data: PictographData }[]>([]);

  function forceProps(motion: MotionData | undefined | null): MotionData | undefined {
    if (!motion) return undefined;
    return { ...motion, propType };
  }

  function setupFromSequence(full: SequenceData) {
    sequence = full;
    const firstStep = full.steps[0] ?? null;
    const startPos = startPositionDeriver.getOrDeriveStartPosition(full) as StartPositionData | null;

    emptyGridData = {
      id: "specimen-empty-grid",
      letter: undefined,
      startPosition: null,
      endPosition: null,
      motions: {},
    };

    if (startPos) {
      handsData = {
        id: "specimen-hands",
        letter: Letter.ALPHA,
        startPosition: startPos.startPosition,
        endPosition: startPos.endPosition,
        motions: {
          blue: startPos.motions?.blue ? { ...startPos.motions.blue, propType: PropType.HAND } : undefined,
          red: startPos.motions?.red ? { ...startPos.motions.red, propType: PropType.HAND } : undefined,
        },
      };

      propsData = {
        id: startPos.id ?? "specimen-props",
        letter: Letter.ALPHA,
        stepNumber: 0,
        startPosition: startPos.startPosition,
        endPosition: startPos.endPosition,
        motions: {
          blue: forceProps(startPos.motions?.blue),
          red: forceProps(startPos.motions?.red),
        },
      } as PictographData;
    }

    if (firstStep) {
      motionData = {
        id: firstStep.id ?? "specimen-motion",
        letter: (firstStep.letter || undefined) as Letter | undefined,
        stepNumber: 1,
        startPosition: firstStep.startPosition,
        endPosition: firstStep.endPosition,
        motions: {
          blue: forceProps(firstStep.motions?.blue),
          red: forceProps(firstStep.motions?.red),
        },
      } as PictographData;
    }

    const line: { label: string; data: PictographData }[] = [];
    if (propsData) line.push({ label: "start", data: propsData });
    full.steps.forEach((step, i) => {
      line.push({
        label: String(i + 1),
        data: {
          id: step.id ?? `specimen-beat-${i}`,
          letter: (step.letter || undefined) as Letter | undefined,
          stepNumber: i + 1,
          startPosition: step.startPosition,
          endPosition: step.endPosition,
          motions: {
            blue: forceProps(step.motions?.blue),
            red: forceProps(step.motions?.red),
          },
        } as PictographData,
      });
    });
    scoreLine = line;
  }

  // Firestore REST value decoder. The page deliberately reads the public
  // sequence over plain fetch instead of the Firebase SDK: importing the SDK
  // boots the auth listener, which transitively pulls in module-state and
  // rewrites any URL whose first segment isn't a module ID (/test/* included)
  // to /create/construct. See session notes — candidate platform fix.
  function fromFirestoreValue(v: Record<string, unknown>): unknown {
    if ("stringValue" in v) return v.stringValue;
    if ("integerValue" in v) return Number(v.integerValue);
    if ("doubleValue" in v) return v.doubleValue;
    if ("booleanValue" in v) return v.booleanValue;
    if ("nullValue" in v) return null;
    if ("timestampValue" in v) return v.timestampValue;
    if ("arrayValue" in v) {
      const arr = (v.arrayValue as { values?: Record<string, unknown>[] }).values ?? [];
      return arr.map(fromFirestoreValue);
    }
    if ("mapValue" in v) {
      return decodeFields((v.mapValue as { fields?: Record<string, Record<string, unknown>> }).fields ?? {});
    }
    return undefined;
  }

  function decodeFields(fields: Record<string, Record<string, unknown>>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) out[k] = fromFirestoreValue(v);
    return out;
  }

  onMount(() => {
    (async () => {
      try {
        const res = await fetch(
          `https://firestore.googleapis.com/v1/projects/the-kinetic-alphabet/databases/(default)/documents/publicSequences/${LANDING_SEQUENCE_ID}`
        );
        if (!res.ok) return;
        const body = (await res.json()) as { fields?: Record<string, Record<string, unknown>> };
        if (!body.fields) return;

        const data = decodeFields(body.fields) as unknown as PublicSequenceIndex;
        const seq: SequenceData = {
          id: LANDING_SEQUENCE_ID,
          name: data.name,
          word: data.word,
          steps: [],
          thumbnails: [...data.thumbnails],
          sequenceLength: data.sequenceLength,
          level: data.level,
          isFavorite: false,
          isCircular: !!data.loopType,
          loopType: (data.loopType as LOOPType) ?? null,
          tags: [...data.tags],
          metadata: {},
          ownerId: data.ownerId,
          blueSoloProp: data.blueSoloProp,
          redSoloProp: data.redSoloProp,
          stepPairings: data.stepPairings,
          bluePathHash: data.bluePathHash,
          redPathHash: data.redPathHash,
          blueSoloHash: data.blueSoloHash,
          redSoloHash: data.redSoloHash,
        };

        if (data.blueSoloProp && data.redSoloProp && data.stepPairings) {
          const hydrated = hydrate(seq);
          if (hydrated.steps && hydrated.steps.length > 0) {
            setupFromSequence({ ...hydrated, sequenceLength: hydrated.steps.length });
          }
        }
      } catch (e) {
        console.error("[LandingRedesign] Failed to load specimen sequence:", e);
      } finally {
        loaded = true;
      }
    })();

    // Scroll-triggered reveals, same pattern as the live landing page
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    requestAnimationFrame(() => {
      document.querySelectorAll(".sp-reveal").forEach((el) => observer.observe(el));
    });
    return () => observer.disconnect();
  });

  const guides = ([1, 2, 3] as LevelNumber[]).map((level) => ({
    level,
    title: LEVEL_METADATA[level].name,
    description: LEVEL_METADATA[level].blurb,
    image: LEVEL_METADATA[level].image,
    href: `/guides/level-${level}.pdf`,
  }));

  const beatTicks = ["01", "02", "03", "04", "05", "06", "07", "08"];

  const figures = $derived([
    { n: "1a", data: emptyGridData, caption: "The grid. Eight points, one center.", hands: false, motion: false, tka: false, positions: false },
    { n: "1b", data: handsData, caption: "Two hands take their positions.", hands: true, motion: false, tka: true, positions: false, handProps: true },
    { n: "1c", data: propsData, caption: "Each hand grips a prop.", hands: true, motion: false, tka: true, positions: false },
    { n: "1d", data: motionData, caption: "Arrows write the motion. This is one letter.", hands: true, motion: true, tka: true, positions: true },
  ]);
</script>

<svelte:head>
  <title>Specimen — The Kinetic Alphabet (redesign test)</title>
  <meta name="robots" content="noindex" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,300;1,9..144,400&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div class="specimen">
  <!-- ── Masthead ruler ─────────────────────────────────────────────── -->
  <header class="ruler" aria-hidden="true">
    <span class="ruler-label">TKA · The Kinetic Alphabet</span>
    <span class="ruler-ticks">
      {#each beatTicks as t}
        <span class="tick"><i></i>{t}</span>
      {/each}
    </span>
    <span class="ruler-label right">Field specimen · no. 1</span>
  </header>

  <!-- ── Hero ───────────────────────────────────────────────────────── -->
  <section class="hero">
    <div class="hero-copy">
      <p class="overline rise" style="--d: 0ms">A writing system for flow arts</p>
      <h1>
        <span class="rise" style="--d: 60ms">The</span>
        <span class="rise kinetic" style="--d: 140ms">Kinetic</span>
        <span class="rise" style="--d: 220ms">Alphabet<em class="period">.</em></span>
      </h1>
      <p class="lede rise" style="--d: 320ms">
        Sheet music exists so musicians can write music down.
        TKA does the same for spinning staff, fans, clubs, and buugeng —
        read a move, write a move, hand it to a friend.
      </p>
      <div class="cta-row rise" style="--d: 420ms">
        <a class="cta solid" href="/create">Open the composer</a>
        <a class="cta ghost" href="#plate-1">Read the specimen</a>
      </div>
      <p class="hero-footnote rise" style="--d: 500ms">
        Free · runs in the browser · built for double staves, works for every gripped prop
      </p>
    </div>

    <figure class="hero-plate rise" style="--d: 260ms">
      <div class="plate-surface">
        {#if motionData}
          <PictographContainer
            pictographData={motionData}
            gridMode={GridMode.DIAMOND}
            bluePropTypeOverride={propType}
            redPropTypeOverride={propType}
            showGrid={true}
            showTKA={true}
            showReversals={false}
            showPositions={true}
            showHandPoints={true}
            showBlueMotion={true}
            showRedMotion={true}
            darkMode={false}
            disableTransitions={true}
          />
        {:else}
          <div class="plate-loading" class:settled={loaded}></div>
        {/if}
      </div>
      <span class="annot annot-blue">blue hand<i></i></span>
      <span class="annot annot-red">red hand<i></i></span>
      <span class="annot annot-letter">the letter<i></i></span>
      <figcaption>fig. 1 — one beat of movement, written down</figcaption>
    </figure>
  </section>

  <!-- ── Plate I: the notation, built in four figures ───────────────── -->
  <section class="plate" id="plate-1">
    <header class="plate-head sp-reveal">
      <span class="plate-no">Plate Ⅰ</span>
      <h2>Four marks, one alphabet</h2>
      <p>Every letter of TKA is drawn the same way. Watch one assemble.</p>
    </header>

    <div class="figure-row sp-reveal">
      {#each figures as fig, i}
        <figure class="spec-figure" style="--d: {i * 90}ms">
          <div class="spec-frame">
            {#if fig.data}
              <PictographContainer
                pictographData={fig.data}
                gridMode={GridMode.DIAMOND}
                bluePropTypeOverride={fig.handProps ? PropType.HAND : propType}
                redPropTypeOverride={fig.handProps ? PropType.HAND : propType}
                showGrid={true}
                showTKA={fig.tka}
                showReversals={false}
                showPositions={fig.positions}
                showHandPoints={fig.hands}
                showBlueMotion={fig.motion}
                showRedMotion={fig.motion}
                darkMode={true}
                disableTransitions={true}
              />
            {:else}
              <div class="spec-skeleton" class:settled={loaded}></div>
            {/if}
          </div>
          <figcaption><b>fig. {fig.n}</b> {fig.caption}</figcaption>
        </figure>
        {#if i < figures.length - 1}
          <span class="figure-joint" aria-hidden="true">→</span>
        {/if}
      {/each}
    </div>

    <figure class="score-figure sp-reveal">
      <div class="score-line">
        {#if scoreLine.length > 0}
          {#each scoreLine as beat (beat.data.id)}
            <div class="score-beat">
              <div class="score-frame" class:start={beat.label === "start"}>
                <PictographContainer
                  pictographData={beat.data}
                  gridMode={GridMode.DIAMOND}
                  bluePropTypeOverride={propType}
                  redPropTypeOverride={propType}
                  showGrid={true}
                  showTKA={true}
                  showReversals={false}
                  showPositions={false}
                  showHandPoints={true}
                  showBlueMotion={beat.label !== "start"}
                  showRedMotion={beat.label !== "start"}
                  darkMode={true}
                  disableTransitions={true}
                />
              </div>
              <span class="score-label">{beat.label}</span>
            </div>
          {/each}
        {:else}
          {#each ["start", "1", "2", "3", "4"] as label}
            <div class="score-beat">
              <div class="score-frame"><div class="spec-skeleton" class:settled={loaded}></div></div>
              <span class="score-label">{label}</span>
            </div>
          {/each}
        {/if}
      </div>
      <figcaption>
        <b>fig. 2</b> Letters in a row spell a word{sequence?.word ? ` — this one reads "${sequence.word}"` : ""}.
        A word is a phrase of choreography you can hand to anyone who reads the notation.
      </figcaption>
    </figure>
  </section>

  <!-- ── Plate II: read it back ─────────────────────────────────────── -->
  <section class="plate" id="plate-2">
    <header class="plate-head sp-reveal">
      <span class="plate-no">Plate Ⅱ</span>
      <h2>Reading it back</h2>
      <p>Notation you can only write is half a system. The app plays any word back as motion — this is fig. 2, read aloud by the animation engine.</p>
    </header>
    <figure class="readback sp-reveal">
      <div class="readback-frame">
        {#if sequence}
          <HowTkaAnimationCard {sequence} {propType} />
        {:else}
          <div class="spec-skeleton tall" class:settled={loaded}></div>
        {/if}
      </div>
      <figcaption><b>fig. 3</b> The word from fig. 2, performed by the engine that powers the app.</figcaption>
    </figure>
  </section>

  <!-- ── Plate III: printable guides ────────────────────────────────── -->
  <section class="plate" id="plate-3">
    <header class="plate-head sp-reveal">
      <span class="plate-no">Plate Ⅲ</span>
      <h2>Offprints for the wall</h2>
      <p>The notation on paper. Print them, stick them up, bring them to jams.</p>
    </header>

    <div class="offprint-row sp-reveal">
      {#each guides as guide, i}
        <a class="offprint" href={guide.href} download style="--d: {i * 90}ms" aria-label="Download Level {guide.level} guide: {guide.title}">
          <span class="offprint-pin" aria-hidden="true"></span>
          <div class="offprint-image">
            <img src={guide.image} alt="Level {guide.level} pictograph examples" loading="lazy" />
          </div>
          <div class="offprint-meta">
            <span class="offprint-level">Level {guide.level}</span>
            <h3>{guide.title}</h3>
            <p>{guide.description}</p>
            <span class="offprint-dl">Download PDF ↓</span>
          </div>
        </a>
      {/each}
    </div>
    <p class="plate-closing sp-reveal">Start with Level 1. Grab a pair of staves and follow along.</p>
  </section>

  <!-- ── Colophon ───────────────────────────────────────────────────── -->
  <footer class="colophon">
    <div class="colophon-rule" aria-hidden="true"></div>
    <nav>
      <a href="/about">About</a>
      <a href="/roots">Roots</a>
      <a href="/create">Open the app</a>
      <a href="/terms">Terms</a>
      <a href="/privacy">Privacy</a>
    </nav>
    <p>Made by Austen Cloud · Set in Fraunces &amp; IBM Plex Mono</p>
  </footer>
</div>

<style>
  /* ── Ground ─────────────────────────────────────────────────────── */
  .specimen {
    --ink: #0a0c11;
    --ink-2: #0e1118;
    --bone: #e9e3d6;
    --bone-dim: #cfc8b8;
    --hair: rgba(233, 227, 214, 0.13);
    --hair-strong: rgba(233, 227, 214, 0.28);
    --blue: #3575e2;
    --red: #ed1c24;
    --mono: "IBM Plex Mono", ui-monospace, monospace;
    --serif: "Fraunces", Georgia, serif;
    --sans: "IBM Plex Sans", system-ui, sans-serif;

    position: relative;
    min-height: 100vh;
    background:
      radial-gradient(1100px 500px at 75% -5%, rgba(53, 117, 226, 0.09), transparent 60%),
      radial-gradient(900px 600px at 8% 100%, rgba(237, 28, 36, 0.05), transparent 55%),
      linear-gradient(var(--ink-2), var(--ink));
    color: var(--bone);
    font-family: var(--sans);
    line-height: 1.6;
    overflow-x: hidden;
  }

  /* The TKA grid as ground texture: diamond lattice of hairlines */
  .specimen::before {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    background-image:
      repeating-linear-gradient(45deg, var(--hair) 0 1px, transparent 1px 96px),
      repeating-linear-gradient(-45deg, var(--hair) 0 1px, transparent 1px 96px);
    opacity: 0.35;
    z-index: 0;
  }

  .specimen > * {
    position: relative;
    z-index: 1;
  }

  /* ── Masthead ruler ─────────────────────────────────────────────── */
  .ruler {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
    padding: 18px 32px 0;
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--bone-dim);
    border-bottom: 1px solid var(--hair-strong);
    padding-bottom: 10px;
  }

  .ruler-ticks {
    display: flex;
    gap: clamp(12px, 4vw, 48px);
  }

  .tick {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    font-size: 10px;
  }

  .tick i {
    display: block;
    width: 1px;
    height: 10px;
    background: var(--hair-strong);
  }

  @media (max-width: 720px) {
    .ruler-ticks { display: none; }
  }

  /* ── Hero ───────────────────────────────────────────────────────── */
  .hero {
    display: grid;
    grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
    gap: clamp(32px, 6vw, 96px);
    align-items: center;
    max-width: 1280px;
    margin: 0 auto;
    padding: clamp(56px, 9vh, 120px) 32px clamp(64px, 10vh, 140px);
  }

  .overline {
    font-family: var(--mono);
    font-size: 12px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--blue);
    margin: 0 0 20px;
  }

  h1 {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(3.2rem, 8.5vw, 7.5rem);
    line-height: 0.98;
    letter-spacing: -0.015em;
    margin: 0 0 28px;
    color: var(--bone);
  }

  h1 span {
    display: block;
  }

  h1 .kinetic {
    font-style: italic;
    font-weight: 400;
    margin-left: 0.6em;
    background: linear-gradient(100deg, var(--blue), #7aa6ef 55%, var(--bone) 95%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  h1 .period {
    font-style: normal;
    color: var(--red);
  }

  .lede {
    max-width: 46ch;
    font-size: clamp(1rem, 1.4vw, 1.15rem);
    color: rgba(233, 227, 214, 0.78);
    margin: 0 0 36px;
  }

  .cta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    margin-bottom: 22px;
  }

  .cta {
    font-family: var(--mono);
    font-size: 13px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-decoration: none;
    padding: 14px 26px;
    border-radius: 4px;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
  }

  .cta.solid {
    background: var(--blue);
    color: #fff;
    box-shadow: 0 10px 30px rgba(53, 117, 226, 0.35);
  }

  .cta.solid:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 38px rgba(53, 117, 226, 0.45);
  }

  .cta.ghost {
    border: 1px solid var(--hair-strong);
    color: var(--bone);
  }

  .cta.ghost:hover {
    background: rgba(233, 227, 214, 0.07);
  }

  .hero-footnote {
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.06em;
    color: rgba(233, 227, 214, 0.45);
    margin: 0;
  }

  /* Hero plate: pictograph as a museum specimen */
  .hero-plate {
    position: relative;
    margin: 0;
    transform: rotate(-1.6deg);
  }

  .plate-surface {
    background: var(--bone);
    border-radius: 6px;
    padding: clamp(16px, 2.5vw, 28px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.25) inset,
      0 30px 80px rgba(0, 0, 0, 0.55),
      0 4px 16px rgba(0, 0, 0, 0.4);
  }

  .plate-surface :global(> *) {
    display: block;
  }

  .plate-loading {
    aspect-ratio: 1;
    border-radius: 4px;
    background: rgba(10, 12, 17, 0.08);
    animation: pulse 1.6s ease-in-out infinite;
  }

  .plate-loading.settled { animation: none; }

  .hero-plate figcaption {
    margin-top: 14px;
    font-family: var(--mono);
    font-size: 11.5px;
    letter-spacing: 0.05em;
    color: var(--bone-dim);
    text-align: center;
  }

  /* Annotation callouts */
  .annot {
    position: absolute;
    font-family: var(--mono);
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .annot i {
    display: block;
    width: 42px;
    height: 1px;
    background: currentColor;
    opacity: 0.65;
  }

  /* blue arrow lives bottom-left of the pictograph; label sits outside-left
     (toward the page gutter, where there is room) pointing in */
  .annot-blue {
    color: var(--blue);
    left: -16px;
    top: 58%;
    transform: translateX(-100%);
  }

  /* red arrow lives top-right; label floats above the plate with a vertical
     drop line (the right edge is the viewport edge — no room to hang off) */
  .annot-red {
    color: var(--red);
    top: -14px;
    right: 12%;
    transform: translateY(-100%);
    flex-direction: column;
    align-items: flex-end;
  }

  .annot-red i {
    width: 1px;
    height: 22px;
  }

  .annot-letter {
    color: var(--bone-dim);
    left: -16px;
    bottom: 10%;
    transform: translateX(-100%);
  }

  @media (max-width: 1100px) {
    .annot { display: none; }
  }

  @media (max-width: 900px) {
    .hero {
      grid-template-columns: 1fr;
      padding-top: 48px;
    }

    .hero-plate {
      max-width: 420px;
      margin: 0 auto;
      transform: rotate(-1.2deg);
    }
  }

  /* ── Plates ─────────────────────────────────────────────────────── */
  .plate {
    max-width: 1280px;
    margin: 0 auto;
    padding: clamp(56px, 9vh, 110px) 32px;
    border-top: 1px solid var(--hair);
  }

  .plate-head {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 28px;
    row-gap: 6px;
    align-items: baseline;
    margin-bottom: clamp(36px, 5vh, 56px);
  }

  .plate-no {
    font-family: var(--mono);
    font-size: 12px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--red);
    border: 1px solid rgba(237, 28, 36, 0.35);
    border-radius: 3px;
    padding: 5px 10px;
  }

  .plate-head h2 {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(2rem, 4.5vw, 3.4rem);
    line-height: 1.05;
    margin: 0;
  }

  .plate-head p {
    grid-column: 2;
    margin: 6px 0 0;
    max-width: 56ch;
    color: rgba(233, 227, 214, 0.65);
    font-size: 0.98rem;
  }

  /* Plate I figures */
  .figure-row {
    display: flex;
    align-items: stretch;
    gap: clamp(8px, 1.6vw, 20px);
    margin-bottom: clamp(40px, 6vh, 64px);
  }

  .spec-figure {
    flex: 1 1 0;
    min-width: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .spec-frame {
    border: 1px solid var(--hair-strong);
    border-radius: 6px;
    padding: 10px;
    background: rgba(0, 0, 0, 0.32);
    aspect-ratio: 1;
  }

  .spec-frame :global(> *) {
    width: 100%;
    height: 100%;
  }

  .spec-skeleton {
    width: 100%;
    height: 100%;
    border-radius: 4px;
    background: rgba(233, 227, 214, 0.05);
    animation: pulse 1.6s ease-in-out infinite;
  }

  .spec-skeleton.tall { min-height: 360px; }
  .spec-skeleton.settled { animation: none; }

  .spec-figure figcaption {
    font-family: var(--mono);
    font-size: 11.5px;
    line-height: 1.55;
    color: var(--bone-dim);
  }

  .spec-figure figcaption b {
    color: var(--bone);
    font-weight: 500;
  }

  .figure-joint {
    align-self: center;
    font-family: var(--mono);
    color: var(--blue);
    font-size: 18px;
    flex: 0 0 auto;
    padding-bottom: 40px;
  }

  @media (max-width: 860px) {
    .figure-row {
      flex-wrap: wrap;
    }

    .spec-figure {
      flex: 1 1 calc(50% - 24px);
    }

    .figure-joint { display: none; }
  }

  /* Plate I score line — the word typeset like a line of music */
  .score-figure {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .score-line {
    display: flex;
    align-items: flex-start;
    gap: clamp(10px, 1.6vw, 18px);
    padding: clamp(16px, 2.5vw, 28px);
    border: 1px solid var(--hair-strong);
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.32);
    overflow-x: auto;
  }

  .score-beat {
    flex: 1 1 0;
    min-width: 96px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .score-frame {
    width: 100%;
    aspect-ratio: 1;
  }

  .score-frame.start {
    opacity: 0.82;
  }

  .score-frame :global(> *) {
    width: 100%;
    height: 100%;
  }

  .score-label {
    font-family: var(--mono);
    font-size: 10.5px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--bone-dim);
  }

  .score-figure figcaption {
    font-family: var(--mono);
    font-size: 11.5px;
    line-height: 1.55;
    color: var(--bone-dim);
    max-width: 72ch;
  }

  .score-figure figcaption b { color: var(--bone); font-weight: 500; }

  /* Plate II readback */
  .readback {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-width: 660px;
    margin-inline: auto;
  }

  .readback-frame {
    border: 1px solid var(--hair-strong);
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.32);
    padding: 14px;
    aspect-ratio: 1;
    display: flex;
  }

  .readback-frame :global(> *) {
    width: 100%;
    height: 100%;
  }

  .readback figcaption {
    font-family: var(--mono);
    font-size: 11.5px;
    line-height: 1.55;
    color: var(--bone-dim);
    text-align: center;
  }

  .readback figcaption b { color: var(--bone); font-weight: 500; }

  /* Plate III offprints */
  .offprint-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: clamp(20px, 3vw, 36px);
  }

  .offprint {
    position: relative;
    display: flex;
    flex-direction: column;
    background: var(--bone);
    color: #181410;
    border-radius: 5px;
    text-decoration: none;
    padding: 14px 14px 20px;
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .offprint:nth-child(1) { transform: rotate(-0.8deg); }
  .offprint:nth-child(2) { transform: rotate(0.5deg); }
  .offprint:nth-child(3) { transform: rotate(-0.4deg); }

  .offprint:hover {
    transform: rotate(0deg) translateY(-6px);
    box-shadow: 0 26px 60px rgba(0, 0, 0, 0.55);
  }

  .offprint-pin {
    position: absolute;
    top: -7px;
    left: 50%;
    transform: translateX(-50%);
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #f3f0e8, #8d8676 70%);
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5);
  }

  .offprint-image {
    background: #fff;
    border: 1px solid rgba(24, 20, 16, 0.12);
    border-radius: 3px;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
  }

  .offprint-image img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .offprint-meta {
    padding: 16px 6px 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
  }

  .offprint-level {
    font-family: var(--mono);
    font-size: 10.5px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--blue);
  }

  .offprint h3 {
    font-family: var(--serif);
    font-weight: 500;
    font-size: 1.35rem;
    margin: 0;
    color: #181410;
  }

  .offprint-meta p {
    font-size: 0.86rem;
    color: rgba(24, 20, 16, 0.65);
    margin: 0;
    flex: 1;
  }

  .offprint-dl {
    font-family: var(--mono);
    font-size: 11.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #181410;
    border-bottom: 1px solid rgba(24, 20, 16, 0.4);
    align-self: flex-start;
    padding: 8px 0 2px;
    transition: color 0.18s ease, border-color 0.18s ease;
  }

  .offprint:hover .offprint-dl {
    color: var(--blue);
    border-color: var(--blue);
  }

  .plate-closing {
    text-align: center;
    font-family: var(--serif);
    font-style: italic;
    font-size: 1.2rem;
    color: rgba(233, 227, 214, 0.7);
    margin: clamp(40px, 6vh, 56px) 0 0;
  }

  /* ── Colophon ───────────────────────────────────────────────────── */
  .colophon {
    max-width: 1280px;
    margin: 0 auto;
    padding: 48px 32px 56px;
    text-align: center;
  }

  .colophon-rule {
    height: 1px;
    background: var(--hair-strong);
    margin-bottom: 32px;
  }

  .colophon nav {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px 28px;
    margin-bottom: 16px;
  }

  .colophon a {
    font-family: var(--mono);
    font-size: 12px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--bone-dim);
    text-decoration: none;
    padding: 8px 0;
  }

  .colophon a:hover { color: var(--bone); }

  .colophon p {
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.06em;
    color: rgba(233, 227, 214, 0.4);
    margin: 0;
  }

  /* ── Motion ─────────────────────────────────────────────────────── */
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.45; }
  }

  .rise {
    opacity: 0;
    transform: translateY(22px);
    animation: rise 0.8s cubic-bezier(0.2, 0.65, 0.25, 1) forwards;
    animation-delay: var(--d, 0ms);
  }

  @keyframes rise {
    to { opacity: 1; transform: translateY(0); }
  }

  :global(.sp-reveal) {
    opacity: 0;
    transform: translateY(28px);
    transition: opacity 0.7s ease, transform 0.7s ease;
  }

  :global(.sp-reveal.revealed) {
    opacity: 1;
    transform: translateY(0);
  }

  @media (prefers-reduced-motion: reduce) {
    .rise {
      animation: none;
      opacity: 1;
      transform: none;
    }

    :global(.sp-reveal) {
      opacity: 1;
      transform: none;
      transition: none;
    }

    .cta, .offprint { transition: none; }
    .plate-loading, .spec-skeleton { animation: none; }
  }
</style>
