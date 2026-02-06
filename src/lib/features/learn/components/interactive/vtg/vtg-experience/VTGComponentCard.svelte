<!--
VTGComponentCard - Shows direction or timing component explanation
-->
<script lang="ts">
  let {
    type,
    icon,
    title,
    options,
    subtitle,
  }: {
    type: "direction" | "timing";
    icon: string;
    title: string;
    options: string;
    subtitle: string;
  } = $props();
</script>

<div
  class="component-card"
  class:direction={type === "direction"}
  class:timing={type === "timing"}
>
  <div class="component-icon">
    <i class="fa-solid {icon}" aria-hidden="true"></i>
  </div>
  <h4>{title}</h4>
  <p>{@html options}</p>
  <small>{subtitle}</small>
</div>

<style>
  .component-card {
    flex: 1;
    min-width: 200px;
    max-width: 280px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1.25rem;
    border-radius: 12px;
    text-align: center;
  }

  .component-card.direction {
    background: rgba(34, 211, 238, 0.1);
    border: 1px solid rgba(34, 211, 238, 0.25);
  }

  .component-card.timing {
    background: rgba(167, 139, 250, 0.1);
    border: 1px solid rgba(167, 139, 250, 0.25);
  }

  .component-icon {
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 1.25rem;
  }

  .component-card.direction .component-icon {
    background: rgba(34, 211, 238, 0.2);
    color: #22d3ee;
  }

  .component-card.timing .component-icon {
    background: rgba(167, 139, 250, 0.2);
    color: #a78bfa;
  }

  h4 {
    font-size: 1rem;
    font-weight: 700;
    margin: 0;
  }

  .component-card.direction h4 {
    color: #22d3ee;
  }

  .component-card.timing h4 {
    color: #a78bfa;
  }

  p {
    font-size: 0.9375rem;
    color: rgba(255, 255, 255, 0.85);
    margin: 0;
  }

  small {
    font-size: 0.75rem;
    color: var(--theme-text-dim);
  }

  @media (max-width: 600px) {
    .component-card {
      max-width: 100%;
      width: 100%;
    }
  }
</style>
