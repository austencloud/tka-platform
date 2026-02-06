<!--
PositionSummaryCards - Summary cards showing all position types
-->
<script lang="ts">
  import { POSITION_INFO } from "../../../../domain/constants/positions-experience-data";
</script>

<div class="summary-section">
  <h3>Position Summary</h3>
  <div class="position-cards">
    {#each Object.entries(POSITION_INFO) as [type, info]}
      <div class="position-card {type}">
        <i class="fa-solid {info.icon}" aria-hidden="true"></i>
        <span>{info.name}</span>
        <small
          >{type === "alpha"
            ? "Opposite"
            : type === "beta"
              ? "Same"
              : "Right Angle"} ({info.angle})</small
        >
      </div>
    {/each}
  </div>
</div>

<style>
  .summary-section {
    padding: 1.25rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
  }

  h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: white;
    margin: 0;
  }

  .position-cards {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
    flex-wrap: wrap;
  }

  .position-card {
    flex: 1;
    min-width: 100px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    padding: 1rem;
    border-radius: 10px;
  }

  .position-card.alpha {
    background: rgba(255, 107, 107, 0.1);
    border: 1px solid rgba(255, 107, 107, 0.25);
    color: #ff6b6b;
  }

  .position-card.beta {
    background: rgba(78, 205, 196, 0.1);
    border: 1px solid rgba(78, 205, 196, 0.25);
    color: #4ecdc4;
  }

  .position-card.gamma {
    background: rgba(255, 230, 109, 0.1);
    border: 1px solid rgba(255, 230, 109, 0.25);
    color: #ffe66d;
  }

  .position-card i {
    font-size: 1.25rem;
  }

  .position-card span {
    font-weight: 600;
    font-size: 0.9375rem;
  }

  .position-card small {
    font-size: 0.75rem;
    opacity: 0.7;
  }

  @media (max-width: 600px) {
    .position-cards {
      flex-direction: column;
    }

    .position-card {
      min-width: auto;
    }
  }
</style>
