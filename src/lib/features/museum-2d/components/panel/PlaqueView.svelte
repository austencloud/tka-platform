<script lang="ts">
  interface Props {
    title: string;
    subtitle?: string;
    body: string;
    footer?: string;
  }

  let { title, subtitle, body, footer }: Props = $props();
</script>

<article class="plaque">
  <header class="plaque-header">
    <h2 class="plaque-title">{title}</h2>
    {#if subtitle}
      <p class="plaque-subtitle">{subtitle}</p>
    {/if}
  </header>

  <div class="plaque-divider"></div>

  <div class="plaque-body">
    <p>{body}</p>
  </div>

  {#if footer}
    <footer class="plaque-footer">
      <p>{footer}</p>
    </footer>
  {/if}
</article>

<style>
  .plaque {
    padding: 24px;
    background: linear-gradient(
      180deg,
      rgba(200, 180, 140, 0.06) 0%,
      rgba(200, 180, 140, 0.02) 100%
    );
    border: 1px solid rgba(200, 180, 140, 0.15);
    border-radius: 8px;
    max-width: 100%;
  }

  .plaque-header {
    text-align: center;
    margin-bottom: 16px;
  }

  .plaque-title {
    margin: 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 1.4rem;
    font-weight: 600;
    color: #c8b890;
    letter-spacing: 0.02em;
  }

  .plaque-subtitle {
    margin: 6px 0 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: var(--font-size-min, 14px);
    color: rgba(200, 180, 140, 0.6);
    font-style: italic;
  }

  .plaque-divider {
    width: 60px;
    height: 1px;
    background: rgba(200, 180, 140, 0.25);
    margin: 0 auto 16px;
  }

  .plaque-body {
    font-family: Georgia, "Times New Roman", serif;
    font-size: var(--font-size-min, 14px);
    line-height: 1.7;
    color: rgba(200, 180, 140, 0.75);
  }

  .plaque-body p {
    margin: 0;
  }

  .plaque-footer {
    margin-top: 20px;
    padding-top: 12px;
    border-top: 1px solid rgba(200, 180, 140, 0.1);
  }

  .plaque-footer p {
    margin: 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: var(--font-size-compact, 12px);
    color: rgba(200, 180, 140, 0.4);
    text-align: center;
    font-style: italic;
  }
</style>
