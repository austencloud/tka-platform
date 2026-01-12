<script lang="ts">
  import { POSITION_TYPES, LETTER_TYPES } from "../landing-content";
</script>

<section class="notation" id="notation">
  <div class="container">
    <h2>Flow Arts Notation</h2>
    <p class="section-intro">
      A notation system for poi, staff, hoop, club, and fan choreography. Every beat of movement becomes a <strong>pictograph</strong> — a visual diagram
      showing exactly where your hands are and how they move.
    </p>

    <div class="notation-grid">
      <div class="notation-card">
        <h3>What a Pictograph Captures</h3>
        <ul>
          <li>Hand positions on a grid (Diamond or Box mode)</li>
          <li>Motion type (Prospin, Antispin, Float, Dash, Static)</li>
          <li>Direction (Clockwise or Counter-clockwise)</li>
          <li>Number of turns (0.5, 1, 1.5, 2, etc.)</li>
          <li>Reversals and variations</li>
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

      <div class="notation-card wide">
        <h3>The Letter System</h3>
        <p>
          Each fundamental motion has a letter. Combine letters into "words" —
          multi-beat patterns that become your choreographic vocabulary.
        </p>
        <div class="letter-types">
          {#each LETTER_TYPES as letterType}
            <div class="letter-type">
              <span class="range">{letterType.range}</span>
              <span class="label">{letterType.label}</span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
</section>

<style>
  .notation {
    padding: 120px 24px;
    background: linear-gradient(
      180deg,
      transparent 0%,
      rgba(236, 72, 153, 0.05) 100%
    );
  }

  .container {
    max-width: 1200px;
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
    color: var(--text-muted, rgba(255, 255, 255, 0.6));
    max-width: 700px;
    margin: 0 auto 3rem;
  }

  .notation-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 24px;
  }

  .notation-card {
    background: var(--bg-card, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    padding: 28px;
  }

  .notation-card.wide {
    grid-column: 1 / -1;
  }

  .notation-card h3 {
    font-size: 1.125rem;
    margin-bottom: 16px;
    color: var(--primary-light, #818cf8);
  }

  .notation-card ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .notation-card li {
    padding: 8px 0;
    border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.1));
    color: var(--text-muted, rgba(255, 255, 255, 0.6));
  }

  .notation-card li:last-child {
    border-bottom: none;
  }

  .position-types {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .position {
    display: grid;
    grid-template-columns: 40px 80px 1fr;
    align-items: center;
    gap: 12px;
  }

  .greek {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--primary-light, #818cf8);
  }

  .name {
    font-weight: 500;
  }

  .desc {
    color: var(--text-muted, rgba(255, 255, 255, 0.6));
    font-size: 0.875rem;
  }

  .letter-types {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin-top: 16px;
  }

  .letter-type {
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(99, 102, 241, 0.1);
    padding: 12px 20px;
    border-radius: 8px;
  }

  .range {
    font-weight: 700;
    font-size: 1.125rem;
    color: var(--primary-light, #818cf8);
  }

  .label {
    color: var(--text-muted, rgba(255, 255, 255, 0.6));
    font-size: 0.875rem;
  }

  @media (max-width: 768px) {
    .position {
      grid-template-columns: 40px 1fr;
    }

    .desc {
      grid-column: 1 / -1;
    }
  }
</style>
