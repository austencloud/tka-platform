<script lang="ts">
</script>

<svelte:head>
  <title>About The Kinetic Alphabet | TKA Scribe</title>
  <meta
    name="description"
    content="The Kinetic Alphabet is to flow arts what musical notation is to music. Learn about the origin, mission, and vision behind TKA."
  />
</svelte:head>

<div class="about-page">
  <div class="about-container">
    <header class="about-header">
      <a href="/" class="back-link">
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        Back to Home
      </a>
      <h1>About The Kinetic Alphabet</h1>
      <p class="tagline">The visual language for flow arts</p>
    </header>

    <div class="about-content">
      <section>
        <h2>The Origin</h2>
        <p>
          The seed that planted this idea was a real problem. I was creating
          choreography with my circus troupe, Cirque Aflame, and needed an
          effective way to remember and communicate sequences. After using an
          early version to build an act, I became obsessed with exploring its
          limits.
        </p>
        <p>
          It began as an experiment in notation and quickly grew as the system
          expanded in scale. Once it passed a tipping point and I realized it
          was covering new ground, I shifted my focus intensely toward its
          development.
        </p>
      </section>

      <section>
        <h2>What TKA Does</h2>
        <p>
          The Kinetic Alphabet functions like music theory—it can be drawn or
          written on paper and communicated across languages. Just like music
          has sheet music and dance has Labanotation, flow arts needs a system
          for describing patterns and techniques in a way that expands beyond
          videos on the Internet.
        </p>
        <p>
          It provides a shared understanding of technique and language that can
          be drawn, written, or spoken, making it ideal for creating complex
          synchronized choreography.
        </p>
      </section>

      <section>
        <h2>Why This Matters</h2>
        <p>
          Flow arts is a very young art form. Many practitioners find it hard
          to collaborate with others due to physical distance or foundational
          differences in technique. Especially in the US, it's a heavily
          solo-influenced art form.
        </p>
        <p>
          The Kinetic Alphabet bridges these gaps. It doesn't rely on English
          terminology, instead embracing symbols and pictures for its
          communication—making it shareable with people from any cultural
          background and across any distance.
        </p>
      </section>

      <section>
        <h2>Who It's For</h2>
        <p>
          TKA is designed to be an effective tool for teachers, choreographers,
          and practitioners of all levels. It bridges the gap between
          understanding theory and performing choreography. It exists to make
          synchronized group choreography more achievable, and it is also a
          tool for self-directed progression.
        </p>
        <p>
          Because it allows performers to keep track of their individual parts,
          it opens the door to people who struggle with memory and executive
          function to engage with complex and intricate choreography. It is
          split into multiple levels of increasing complexity, so a beginner
          can learn at their own pace on the level that suits them, or it can
          be used as a structured curriculum for exploring movement.
        </p>
      </section>

      <section>
        <h2>Creative Ownership</h2>
        <p>
          The Kinetic Alphabet breaks down sequences into their constituent
          parts, allowing practitioners to reassemble them and create their own
          unique sequences. This means people feel creative ownership over
          their own designs, making the process of creative expression through
          patterns accessible earlier in the learning process.
        </p>
      </section>

      <section>
        <h2>The Vision</h2>
        <p>
          I hope to influence the field toward greater collaboration and a
          higher standard for professional performances. The Kinetic Alphabet
          has already gained international traction—flow artists across the
          world are spreading it in their own communities.
        </p>
      </section>
    </div>

    <footer class="about-footer">
      <a href="https://tkascribe.com" class="cta-button">
        Try TKA Scribe
        <i class="fas fa-arrow-right" aria-hidden="true"></i>
      </a>
    </footer>
  </div>
</div>

<style>
  .about-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
    color: #ffffff;
    padding: 2rem 1rem;
  }

  .about-container {
    max-width: 800px;
    margin: 0 auto;
  }

  .about-header {
    margin-bottom: 2rem;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: rgba(255, 255, 255, 0.7);
    text-decoration: none;
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
    transition: color 0.2s ease;
  }

  .back-link:hover {
    color: #ffffff;
  }

  h1 {
    font-size: clamp(2rem, 5vw, 2.5rem);
    font-weight: 700;
    margin: 0 0 0.5rem 0;
  }

  .tagline {
    color: #6366f1;
    font-size: 1.125rem;
    font-weight: 500;
    margin: 0;
  }

  .about-content {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 2rem;
  }

  section {
    margin-bottom: 2rem;
  }

  section:last-child {
    margin-bottom: 0;
  }

  h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 0.75rem 0;
    color: #ffffff;
  }

  p {
    color: rgba(255, 255, 255, 0.8);
    line-height: 1.7;
    margin: 0 0 0.75rem 0;
  }

  p:last-child {
    margin-bottom: 0;
  }

  .about-footer {
    margin-top: 2rem;
    text-align: center;
  }

  .cta-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: #6366f1;
    color: #ffffff;
    text-decoration: none;
    padding: 0.875rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 1rem;
    transition:
      background 0.2s ease,
      transform 0.2s ease;
  }

  .cta-button:hover {
    background: #4f46e5;
    transform: translateY(-1px);
  }

  .cta-button:active {
    transform: translateY(0);
  }

  @media (max-width: 640px) {
    .about-content {
      padding: 1.5rem;
    }

    h2 {
      font-size: 1.125rem;
    }
  }
</style>
