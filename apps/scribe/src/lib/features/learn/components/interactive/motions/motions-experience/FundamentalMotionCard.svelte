<!--
FundamentalMotionCard - Displays a fundamental motion type (shift/dash/static)
-->
<script lang="ts">
  let {
    type,
    icon,
    title,
    description,
  }: {
    type: "shift" | "dash" | "static";
    icon: string;
    title: string;
    description: string;
  } = $props();
</script>

<div class="fundamental-card {type}">
  <div class="motion-icon">
    <i class="fa-solid {icon}" aria-hidden="true"></i>
  </div>
  <h4>{title}</h4>
  <p>{@html description}</p>
</div>

<style>
  .fundamental-card {
    flex: 1;
    min-width: 140px;
    max-width: 180px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1.25rem 1rem;
    border-radius: 12px;
    text-align: center;
  }

  .fundamental-card.shift {
    background: rgba(74, 222, 128, 0.1);
    border: 1px solid rgba(74, 222, 128, 0.25);
  }

  .fundamental-card.dash {
    background: rgba(251, 146, 60, 0.1);
    border: 1px solid rgba(251, 146, 60, 0.25);
  }

  .fundamental-card.static {
    background: rgba(148, 163, 184, 0.1);
    border: 1px solid rgba(148, 163, 184, 0.25);
  }

  .motion-icon {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 1.25rem;
  }

  .fundamental-card.shift .motion-icon {
    background: rgba(74, 222, 128, 0.2);
    color: #4ade80;
  }

  .fundamental-card.dash .motion-icon {
    background: rgba(251, 146, 60, 0.2);
    color: #fb923c;
  }

  .fundamental-card.static .motion-icon {
    background: rgba(148, 163, 184, 0.2);
    color: #94a3b8;
  }

  h4 {
    font-size: 1rem;
    font-weight: 700;
    margin: 0;
  }

  .fundamental-card.shift h4 {
    color: #4ade80;
  }
  .fundamental-card.dash h4 {
    color: #fb923c;
  }
  .fundamental-card.static h4 {
    color: #94a3b8;
  }

  p {
    font-size: 0.8125rem;
    color: rgba(255, 255, 255, 0.65);
    margin: 0;
  }

  @media (max-width: 600px) {
    .fundamental-card {
      max-width: 100%;
      width: 100%;
    }
  }
</style>
