<script lang="ts">
  import { POSITION_TYPES } from "../landing-content";
</script>

<section class="notation" id="notation">
  <div class="container">
    <h2>Flow Arts Notation</h2>
    <p class="section-intro">
      A grid-based notation system. Every step of movement becomes a
      <strong>pictograph</strong> showing where your hands are and how they move.
    </p>

    <div class="notation-grid">
      <div class="notation-card">
        <h3>What a Pictograph Captures</h3>
        <ul>
          <li>Hand positions on a grid (Diamond or Box mode)</li>
          <li>Five motion types: Prospin, Antispin, Float, Dash, Static</li>
          <li>Direction (Clockwise or Counter-clockwise)</li>
          <li>Rotation variations</li>
        </ul>
      </div>

      <div class="notation-card">
        <h3>Position Types</h3>
        <div class="position-types">
          {#each POSITION_TYPES as position}
            <div class="position">
              <span class="greek">{position.greek}</span>
              <span class="name">{position.name}</span>
              <span class="desc">{position.desc}</span>
            </div>
          {/each}
        </div>
      </div>

      <div class="notation-card">
        <h3>Immediate Accessibility</h3>
        <p>
          Pictographs are readable without memorization. An arrow on a diagram
          tells you where hands go and how they move. The letter system is
          optional for those who want to verbalize and reference sequences by name.
        </p>
      </div>

      <div class="notation-card">
        <h3>The Letter System</h3>
        <p>
          Each motion combination has a letter. Combine letters into words,
          which are multi-step patterns that form a shared choreographic vocabulary.
        </p>
      </div>
    </div>

    <p class="heritage">
      TKA builds on ideas from Vulcan Tech Gospel (VTG) and other community
      efforts to systematize flow arts knowledge.
    </p>
  </div>
</section>

<style>
  .notation {
    padding: 120px 24px;
  }

  .container {
    max-width: 1000px;
    margin: 0 auto;
  }

  h2 {
    font-size: clamp(2rem, 5vw, 3rem);
    margin-bottom: 1rem;
    text-align: center;
    font-weight: 600;
    line-height: 1.2;
  }

  .section-intro {
    text-align: center;
    font-size: 1.125rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    max-width: 600px;
    margin: 0 auto 3rem;
  }

  .notation-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
  }

  .notation-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    padding: 24px;
  }

  .notation-card h3 {
    font-size: 1rem;
    margin-bottom: 12px;
    color: var(--theme-accent-strong, #818cf8);
  }

  .notation-card p {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 0.9375rem;
    margin: 0;
    line-height: 1.5;
  }

  .notation-card ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .notation-card li {
    padding: 6px 0;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 0.9375rem;
  }

  .notation-card li:last-child {
    border-bottom: none;
  }

  .position-types {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .position {
    display: grid;
    grid-template-columns: 32px 70px 1fr;
    align-items: center;
    gap: 8px;
  }

  .greek {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--theme-accent-strong, #818cf8);
  }

  .name {
    font-weight: 500;
    font-size: 0.9375rem;
  }

  .desc {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 0.8125rem;
  }

  .heritage {
    text-align: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: 0.875rem;
    margin-top: 2.5rem;
    max-width: 500px;
    margin-left: auto;
    margin-right: auto;
  }

  @media (max-width: 700px) {
    .notation-grid {
      grid-template-columns: 1fr;
    }

    .position {
      grid-template-columns: 32px 1fr;
    }

    .desc {
      grid-column: 1 / -1;
    }
  }
</style>
