<!--
PositionIntroCard - Intro card for a position type
-->
<script lang="ts">
  import type { PositionInfo } from "../../../../domain/constants/positions-experience-data";

  let {
    type,
    info,
  }: {
    type: "alpha" | "beta" | "gamma";
    info: PositionInfo;
  } = $props();
</script>

<div class="position-intro {type}">
  <div class="position-icon">
    <i class="fa-solid {info.icon}" aria-hidden="true"></i>
  </div>
  <p class="position-summary">
    {@html info.summary.replace(
      /(opposite|same|right angles)/gi,
      "<strong>$1</strong>"
    )}
  </p>
</div>

<style>
  .position-intro {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 1.5rem;
    border-radius: 16px;
  }

  .position-intro.alpha {
    background: linear-gradient(
      135deg,
      rgba(255, 107, 107, 0.1) 0%,
      rgba(255, 107, 107, 0.02) 100%
    );
    border: 1px solid rgba(255, 107, 107, 0.2);
  }

  .position-intro.beta {
    background: linear-gradient(
      135deg,
      rgba(78, 205, 196, 0.1) 0%,
      rgba(78, 205, 196, 0.02) 100%
    );
    border: 1px solid rgba(78, 205, 196, 0.2);
  }

  .position-intro.gamma {
    background: linear-gradient(
      135deg,
      rgba(255, 230, 109, 0.1) 0%,
      rgba(255, 230, 109, 0.02) 100%
    );
    border: 1px solid rgba(255, 230, 109, 0.2);
  }

  .position-icon {
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  }

  .position-intro.alpha .position-icon {
    background: rgba(255, 107, 107, 0.2);
    color: #ff6b6b;
  }

  .position-intro.beta .position-icon {
    background: rgba(78, 205, 196, 0.2);
    color: #4ecdc4;
  }

  .position-intro.gamma .position-icon {
    background: rgba(255, 230, 109, 0.2);
    color: #ffe66d;
  }

  .position-icon i {
    font-size: 1.5rem;
  }

  .position-summary {
    font-size: 1.25rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.85);
    margin: 0;
    text-align: center;
  }
</style>
