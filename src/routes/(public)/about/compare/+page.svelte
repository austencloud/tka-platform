<script lang="ts">
  import LightsToggleButton from "$lib/shared/ui/components/LightsToggleButton.svelte";

  type VersionKey = "original" | "firejam" | "grant";

  let positionLightsOn = $state(true);

  interface Section {
    title: string;
    icon: string;
    paragraphs: string[];
    hasPositionGrid?: boolean;
  }

  interface Version {
    id: VersionKey;
    label: string;
    subtitle: string;
    accent: string;
    accentDim: string;
    verdict: string;
    sections: Section[];
  }

  const versions: Version[] = [
    {
      id: "original",
      label: "Original",
      subtitle: "The AI draft",
      accent: "#f59e0b",
      accentDim: "rgba(245, 158, 11, 0.15)",
      verdict:
        "Too formal to be warm, too vague to be persuasive. Sits in a middle zone that serves neither audience.",
      sections: [
        {
          title: "What Is TKA",
          icon: "fa-seedling",
          paragraphs: [
            "The Kinetic Alphabet brings something novel to flow arts. Previous attempts to document flow arts patterns created valuable knowledge collections. TKA builds on that foundation.",
            "Flow arts needs a way to describe patterns that expands beyond videos across the Internet. Sheet music tells musicians what notes to play. Actors memorize their lines so they can act. TKA works the same way: it documents the physical movements so you can reliably reproduce them later.",
          ],
        },
        {
          title: "How It Works",
          icon: "fa-diagram-project",
          hasPositionGrid: true,
          paragraphs: [
            "Every step of movement becomes a pictograph showing where your hands are and how they move on a grid. The visual approach means you can read a sequence immediately without memorizing terminology. Positions describe where your hands are relative to each other: across from each other, at the same point, forming a right angle.",
            "Pictographs also capture motion types, direction, and rotation. The letter system is optional, but useful when you need to reference a single step in a specific sequence during choreography and rehearsal.",
          ],
        },
        {
          title: "Why This Matters",
          icon: "fa-globe",
          paragraphs: [
            "Flow arts is a very young art form. Many practitioners find it hard to collaborate with others due to physical distance or foundational differences in technique. Especially in the US, where TKA got its start, flow arts is a heavily solo-influenced art form.",
            "The Kinetic Alphabet does not rely on English terminology, instead embracing symbols and pictures for its communication, making it shareable across languages and distances. It exists in both physical form (pen and paper) and digital form.",
            "With documented patterns, choreographers can build on each other's work instead of recreating from scratch. You can archive your own material and revisit it months later.",
          ],
        },
        {
          title: "Who It's For",
          icon: "fa-users",
          paragraphs: [
            "The Kinetic Alphabet is designed for flow arts teachers, choreographers, and spinners. For beginners and veterans alike, TKA bridges theory and performance. It exists to make synchronized group choreography more achievable, and it is also a tool for self-directed progression.",
            "By tracking your individual parts, it makes choreography accessible even if you struggle with memory and executive function. It is split into multiple levels of increasing complexity and density, so you can learn at your own pace.",
            "For those who value theatrical performance more than technical patterns, TKA handles the groundwork so you can focus on expression. Once you internalize its framework, it can be a foundation for expressive creativity.",
          ],
        },
        {
          title: "The Vision",
          icon: "fa-rocket",
          paragraphs: [
            "TKA changes how you teach. Instead of demonstrating repeatedly, show them the pictograph. Share notated sequences with students anywhere in the world. The visual system works across languages.",
            "Once you internalize the pictographs and vocabulary, you gain building blocks for thinking about movement.",
            "TKA breaks prop movement into building blocks. Once you understand how pictographs work, you can create your own sequences with them and call them yours. The letter system shows you what you've already browsed and what's still unbrowsed, giving you a fountain of novelty to pull from.",
            "The goal is greater collaboration and more ambitious live performances. The Kinetic Alphabet has already gained momentum. The movement is growing.",
          ],
        },
      ],
    },
    {
      id: "firejam",
      label: "Fire Jam",
      subtitle: "How you'd actually say it",
      accent: "#22c55e",
      accentDim: "rgba(34, 197, 94, 0.15)",
      verdict:
        "Sounds like a person. No evidence or citations, but nobody at a fire jam wants those.",
      sections: [
        {
          title: "What Is TKA",
          icon: "fa-seedling",
          paragraphs: [
            "TKA is a notation system for flow arts. Other people have documented patterns before, and that work matters. TKA tries to take it further.",
            "Right now, flow arts knowledge lives mostly in videos scattered across the internet. Sheet music tells musicians what to play. Scripts tell actors what to say. TKA does that for prop movement: write it down, read it back, reproduce it later.",
          ],
        },
        {
          title: "How It Works",
          icon: "fa-diagram-project",
          hasPositionGrid: true,
          paragraphs: [
            "Each step of movement gets a pictograph. It shows where your hands are and how they move on a grid. You can read it without memorizing terminology. Positions are simple: hands across from each other, at the same point, or at a right angle.",
            "Pictographs also capture motion type, direction, and rotation. Letters are optional but handy when you need to talk about a specific step during rehearsal.",
          ],
        },
        {
          title: "Why This Matters",
          icon: "fa-globe",
          paragraphs: [
            "Flow arts is young. Most spinners learn alone, develop their own vocabulary, and have a hard time collaborating with people who learned differently. That's especially true in the US, where TKA started.",
            "TKA uses symbols and pictures instead of English terminology, so it works across languages. It works on paper and on screen.",
            "When patterns are written down, choreographers can share and build on each other's work. You can also archive your own material and actually find it again months later.",
          ],
        },
        {
          title: "Who It's For",
          icon: "fa-users",
          paragraphs: [
            "Teachers, choreographers, spinners. TKA is meant to make synchronized group choreography more realistic, but it's also useful for solo practice.",
            "It tracks individual parts, which helps if you struggle with memory or executive function. The level system starts simple and gets denser, so you set your own pace.",
            "If you care more about theatrical performance than technical patterns, that's fine. Learn the notation, then forget about it while you perform.",
          ],
        },
        {
          title: "The Vision",
          icon: "fa-rocket",
          paragraphs: [
            "If you teach, you can hand someone a pictograph instead of demonstrating the same thing over and over. Send notated sequences to students anywhere. No shared language required.",
            "Once the system clicks, you start thinking in it. Make your own sequences. The letter system shows you what you've explored and what you haven't, so there's always something new to try.",
            "The long-term goal is better collaboration and more ambitious group performances.",
          ],
        },
      ],
    },
    {
      id: "grant",
      label: "Grant",
      subtitle: "For funders and institutions",
      accent: "#06b6d4",
      accentDim: "rgba(6, 182, 212, 0.15)",
      verdict:
        "Evidence-backed, names prior art, gives hard numbers. Would bore a spinner in three seconds.",
      sections: [
        {
          title: "The Problem",
          icon: "fa-triangle-exclamation",
          paragraphs: [
            "Flow arts is a performance discipline practiced worldwide, but it has no standard notation system. Practitioners spin staffs, fans, clubs, and other props in patterns that can be as complex as any musical composition, but the knowledge exists almost entirely in video and oral tradition. There is no written form.",
            "This creates concrete problems. Choreographers cannot write down what they want performed. Teachers must demonstrate every movement in person. Collaboration between geographically separated performers requires video calls and screen recordings. Performers who develop original material have no way to document it except to film themselves, and no way to search or index what they've created.",
            'Several theoretical frameworks have emerged over the past two decades. The Vulcan Tech Gospel (VTG), developed by Noel Yee and Jordan Campbell in Oakland, CA, classifies timing and direction relationships between two spinning props. Charlie Cushing\'s 9-Square Theory quantizes the space around the performer\'s body into a navigable grid. Lorq Nichols\' P.H.A.T. Chart catalogs 64 pattern variations in a visual matrix.',
            "These systems are valuable and TKA builds on their ideas. Where they focus on classification and analysis, TKA focuses on a different problem: giving people a way to write movement down and share it.",
          ],
        },
        {
          title: "What TKA Is",
          icon: "fa-seedling",
          hasPositionGrid: true,
          paragraphs: [
            "The Kinetic Alphabet (TKA) is a notation system that encodes prop movement as pictographs and letters. Each step of a performance is represented as a pictograph: a grid-based diagram showing hand positions, prop orientations, motion types, direction, and rotation. Sequences of pictographs form words, and words spell out choreography that can be read, written, spoken, and reproduced.",
            'The system is visual-first. A pictograph can be read without terminology training. Positions are geometric: hands at opposite points (alpha), the same point (beta), or at a right angle (gamma).',
            '"CAKE" is not a metaphor. It is four specific steps of movement, each unambiguous, each reproducible. The notation does not depend on English or any natural language.',
          ],
        },
        {
          title: "Leveled Complexity",
          icon: "fa-layer-group",
          paragraphs: [
            "TKA is structured as a progressive system with nine levels. Levels 1-3 introduce turns on a four-point grid. Level 4 adds a center point. Level 5 expands to nine points with grid mode mixing. Level 6 completes two-dimensional movement with eight prop orientations. Level 7 introduces conjoined grids for dual performers. Levels 8-9 extend into three dimensions.",
            "A beginner at Level 1 works with 6 possible single-hand motions from any grid point. By Level 5, that number grows to 129. The ceiling reaches 237 distinct single-hand motions per grid point. The combinatorial space sustains years of practice without repetition, and every motion within it is documented and indexable.",
          ],
        },
        {
          title: "Accessibility",
          icon: "fa-universal-access",
          paragraphs: [
            "Many performers struggle with working memory and executive function demands of learning choreography by demonstration. TKA externalizes the memory requirement. The sequence exists on paper or screen. The performer references it rather than holding it in working memory. This parallels how sheet music supports musicians with memory difficulties, but no equivalent has existed for movement arts.",
            "A teacher in Portland can send a notated sequence to a student in Berlin. The student reads the pictographs and reproduces the movement. The pictograph system is non-verbal. A Japanese-speaking performer and an English-speaking performer read the same pictograph identically.",
            "The level system means no learner confronts the full complexity at once. Level 1 has six motions. Level 2 has thirty. The learner decides when to advance.",
          ],
        },
        {
          title: "What This Enables",
          icon: "fa-rocket",
          paragraphs: [
            "Archival. Original choreography can be stored, indexed, and retrieved. A performer's body of work becomes searchable.",
            "Attribution. When sequences are written down and shared, authorship is traceable. Originality is verifiable against the existing corpus.",
            "Curriculum development. Teaching progressions can be standardized, shared between instructors, and refined over time.",
            "Cross-group collaboration. Multiple performers or groups can rehearse from the same notation independently, then combine. This is standard practice in music and theater. It has not been possible in flow arts.",
          ],
        },
      ],
    },
  ];

  let activeVersion = $state<VersionKey>("firejam");
  let transitioning = $state(false);

  function switchVersion(id: VersionKey) {
    if (id === activeVersion) return;
    transitioning = true;
    setTimeout(() => {
      activeVersion = id;
      setTimeout(() => {
        transitioning = false;
      }, 30);
    }, 200);
  }

  const active = $derived(versions.find((v) => v.id === activeVersion)!);
</script>

<svelte:head>
  <title>Copy Comparison | TKA</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,600;1,8..60,400&family=DM+Sans:wght@400;500;600&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div class="compare-page" style="--v-accent: {active.accent}; --v-accent-dim: {active.accentDim};">
  <div class="compare-container">
    <header class="compare-header">
      <a href="/about" class="back-link">
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        <span>About page</span>
      </a>

      <div class="header-text">
        <h1>Same story, three voices</h1>
        <p class="header-sub">
          How tone changes what people hear
        </p>
      </div>
    </header>

    <!-- Version switcher -->
    <nav class="version-switcher" aria-label="Version selector">
      {#each versions as version}
        <button
          class="version-tab"
          class:active={activeVersion === version.id}
          style="--tab-accent: {version.accent}; --tab-accent-dim: {version.accentDim};"
          onclick={() => switchVersion(version.id)}
          aria-pressed={activeVersion === version.id}
        >
          <span class="tab-pip"></span>
          <div class="tab-text">
            <span class="tab-label">{version.label}</span>
            <span class="tab-sub">{version.subtitle}</span>
          </div>
        </button>
      {/each}
    </nav>

    <!-- Verdict bar -->
    <div class="verdict-bar" class:fading={transitioning}>
      <p>{active.verdict}</p>
    </div>

    <!-- Sections -->
    <div class="sections" class:fading={transitioning}>
      {#each active.sections as section, i}
        <article
          class="section-card"
          style="animation-delay: {i * 60}ms;"
        >
          <div class="section-header">
            <div class="section-header-left">
              <div class="section-icon">
                <i class="fas {section.icon}" aria-hidden="true"></i>
              </div>
              <h2>{section.title}</h2>
            </div>
            {#if section.hasPositionGrid}
              <LightsToggleButton
                lightsOn={positionLightsOn}
                onToggle={() => (positionLightsOn = !positionLightsOn)}
                size="small"
              />
            {/if}
          </div>
          <div class="section-body">
            {#if section.hasPositionGrid}
              <p>{section.paragraphs[0]}</p>

              <div class="position-grid" class:dark-mode={!positionLightsOn}>
                <div class="position-item">
                  <div class="position-image-container">
                    <img
                      src="/images/position_images/alpha.png"
                      alt="Alpha position: hands at opposite points on the grid"
                    />
                  </div>
                  <span class="position-name">Alpha</span>
                  <span class="position-desc">Opposite points</span>
                </div>
                <div class="position-item">
                  <div class="position-image-container">
                    <img
                      src="/images/position_images/beta.png"
                      alt="Beta position: hands at the same point on the grid"
                    />
                  </div>
                  <span class="position-name">Beta</span>
                  <span class="position-desc">Same point</span>
                </div>
                <div class="position-item">
                  <div class="position-image-container">
                    <img
                      src="/images/position_images/gamma.png"
                      alt="Gamma position: hands forming a right angle on the grid"
                    />
                  </div>
                  <span class="position-name">Gamma</span>
                  <span class="position-desc">Right angle</span>
                </div>
              </div>

              {#each section.paragraphs.slice(1) as p}
                <p>{p}</p>
              {/each}
            {:else}
              {#each section.paragraphs as p}
                <p>{p}</p>
              {/each}
            {/if}
          </div>
        </article>
      {/each}
    </div>

    <footer class="compare-footer">
      <p>V2 is on the website now. V3 lives in <code>docs/about-page-three-versions.md</code>.</p>
    </footer>
  </div>

</div>

<style>
  .compare-page {
    position: relative;
    min-height: 100vh;
    background: linear-gradient(145deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%);
    color: #fff;
    overflow-x: hidden;
    font-family: "DM Sans", sans-serif;
  }

  .compare-container {
    position: relative;
    z-index: 1;
    max-width: 760px;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
  }

  /* Header */
  .compare-header {
    margin-bottom: 2.5rem;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: rgba(255, 255, 255, 0.5);
    text-decoration: none;
    font-size: 0.8125rem;
    padding: 0.4rem 0.9rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 100px;
    margin-bottom: 2rem;
    transition: color 0.2s, border-color 0.2s;
  }

  .back-link:hover {
    color: #fff;
    border-color: rgba(255, 255, 255, 0.2);
  }

  .header-text {
    text-align: center;
  }

  h1 {
    font-family: "Source Serif 4", Georgia, serif;
    font-size: clamp(2rem, 5.5vw, 3rem);
    font-weight: 600;
    margin: 0 0 0.4rem;
    letter-spacing: -0.02em;
    line-height: 1.1;
    color: #fff;
  }

  .header-sub {
    font-size: 1.05rem;
    color: rgba(255, 255, 255, 0.5);
    margin: 0;
    font-weight: 400;
  }

  /* Version switcher */
  .version-switcher {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    padding: 0.375rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
  }

  .version-tab {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.7rem 1rem;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 10px;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.45);
    transition: all 0.2s ease;
    font-family: inherit;
  }

  .version-tab:hover:not(.active) {
    background: rgba(255, 255, 255, 0.03);
    color: #fff;
  }

  .version-tab.active {
    background: var(--tab-accent-dim);
    border-color: color-mix(in srgb, var(--tab-accent) 30%, transparent);
    color: #fff;
  }

  .tab-pip {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--tab-accent);
    opacity: 0.3;
    flex-shrink: 0;
    transition: opacity 0.2s;
  }

  .version-tab.active .tab-pip {
    opacity: 1;
  }

  .tab-text {
    display: flex;
    flex-direction: column;
    text-align: left;
    line-height: 1.2;
  }

  .tab-label {
    font-weight: 600;
    font-size: 0.875rem;
  }

  .tab-sub {
    font-size: 0.6875rem;
    opacity: 0.6;
  }

  /* Verdict */
  .verdict-bar {
    margin-bottom: 1.75rem;
    padding: 0.9rem 1.2rem;
    background: var(--v-accent-dim);
    border-left: 3px solid var(--v-accent);
    border-radius: 0 10px 10px 0;
    transition: opacity 0.15s ease, background 0.3s ease, border-color 0.3s ease;
  }

  .verdict-bar p {
    margin: 0;
    font-size: 0.9375rem;
    font-style: italic;
    color: #fff;
    opacity: 0.85;
    font-family: "Source Serif 4", Georgia, serif;
    line-height: 1.5;
  }

  .verdict-bar.fading {
    opacity: 0;
  }

  /* Sections */
  .sections {
    display: grid;
    gap: 1.25rem;
    transition: opacity 0.15s ease;
  }

  .sections.fading {
    opacity: 0;
  }

  .section-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 1.75rem;
    animation: card-in 0.3s ease both;
  }

  @keyframes card-in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .section-header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .section-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: var(--v-accent-dim);
    border-radius: 9px;
    color: var(--v-accent);
    font-size: 0.9rem;
    flex-shrink: 0;
    transition: background 0.3s, color 0.3s;
  }

  .section-card h2 {
    font-family: "DM Sans", sans-serif;
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0;
    color: #fff;
  }

  .section-body p {
    font-family: "Source Serif 4", Georgia, serif;
    font-optical-sizing: auto;
    font-size: 1.0625rem;
    line-height: 1.72;
    color: rgba(255, 255, 255, 0.65);
    margin: 0 0 0.9rem;
  }

  .section-body p:last-child {
    margin-bottom: 0;
  }

  /* Position pictographs grid */
  .position-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin: 1.5rem 0;
  }

  .position-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .position-image-container {
    width: 100%;
    max-width: 150px;
    aspect-ratio: 1;
    background: #ffffff;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.5rem;
    transition: filter 0.3s ease, background 0.3s ease;
  }

  .position-image-container img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .position-grid.dark-mode .position-image-container {
    background: #1a1a2e;
    filter: invert(1) hue-rotate(180deg);
  }

  .position-name {
    font-family: "DM Sans", sans-serif;
    font-weight: 600;
    font-size: 0.9375rem;
    color: #fff;
    margin-bottom: 0.125rem;
  }

  .position-desc {
    font-family: "DM Sans", sans-serif;
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.5);
  }

  /* Footer */
  .compare-footer {
    margin-top: 3rem;
    text-align: center;
  }

  .compare-footer p {
    font-size: 0.8125rem;
    color: rgba(255, 255, 255, 0.35);
  }

  .compare-footer code {
    font-size: 0.75rem;
    background: rgba(255, 255, 255, 0.06);
    padding: 0.15em 0.4em;
    border-radius: 4px;
  }

  /* Mobile */
  @media (max-width: 640px) {
    .compare-container {
      padding: 1.25rem 1rem 3rem;
    }

    .version-switcher {
      flex-direction: column;
      gap: 0.375rem;
    }

    .version-tab {
      padding: 0.6rem 0.9rem;
    }

    .section-card {
      padding: 1.25rem;
    }

    .section-body p {
      font-size: 1rem;
    }

    .section-header {
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .position-grid {
      gap: 0.75rem;
    }

    .position-image-container {
      max-width: 100px;
    }

    .position-name {
      font-size: 0.8125rem;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .section-card {
      animation: none;
    }

    .sections,
    .verdict-bar,
    .version-tab,
    .back-link,
    .position-image-container {
      transition: none;
    }
  }
</style>
