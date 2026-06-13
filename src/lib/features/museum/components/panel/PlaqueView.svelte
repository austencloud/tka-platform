<script lang="ts">
  interface Props {
    title: string;
    subtitle?: string;
    body: string;
    footer?: string;
  }

  import "../museum-theme.css";
  let { title, subtitle, body, footer }: Props = $props();
</script>

<article class="plaque museum-gold-scope">
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
      var(--museum-gold-06) 0%,
      color-mix(in srgb, var(--museum-gold) 2%, transparent) 100%
    );
    border: 1px solid var(--museum-gold-15);
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
    color: var(--museum-gold-60);
    font-style: italic;
  }

  .plaque-divider {
    width: 60px;
    height: 1px;
    background: var(--museum-gold-25);
    margin: 0 auto 16px;
  }

  .plaque-body {
    font-family: Georgia, "Times New Roman", serif;
    font-size: var(--font-size-min, 14px);
    line-height: 1.7;
    color: var(--museum-gold-75);
  }

  .plaque-body p {
    margin: 0;
  }

  .plaque-footer {
    margin-top: 20px;
    padding-top: 12px;
    border-top: 1px solid var(--museum-gold-10);
  }

  .plaque-footer p {
    margin: 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: var(--font-size-compact, 12px);
    color: var(--museum-gold-40);
    text-align: center;
    font-style: italic;
  }
</style>
