<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
</script>

<GuideSection id="codex-type-3-6" title="Codex — Types 3–6">
  <h3 class="type-cross-shift">Type 3 — Cross-Shift</h3>
  <div class="codex-grid">
    {#each ["W-", "X-", "Y-", "Z-", "Σ-", "Δ-", "θ-", "Ω-"] as letter}
      <figure class="codex-cell">
        <img
          src="/guide/level-1/images/double-staff-codex/{letter}.webp"
          alt="Letter {letter}"
          loading="lazy"
        />
        <figcaption>{letter}</figcaption>
      </figure>
    {/each}
  </div>

  <h3 class="type-dash">Type 4 — Dash</h3>
  <div class="codex-grid">
    {#each ["Φ", "Ψ", "Λ"] as letter}
      <figure class="codex-cell">
        <img
          src="/guide/level-1/images/double-staff-codex/{letter}.webp"
          alt="Letter {letter}"
          loading="lazy"
        />
        <figcaption>{letter}</figcaption>
      </figure>
    {/each}
  </div>

  <h3 class="type-dual-dash">Type 5 — Dual-Dash</h3>
  <div class="codex-grid">
    {#each ["Φ-", "Ψ-", "Λ-"] as letter}
      <figure class="codex-cell">
        <img
          src="/guide/level-1/images/double-staff-codex/{letter}.webp"
          alt="Letter {letter}"
          loading="lazy"
        />
        <figcaption>{letter}</figcaption>
      </figure>
    {/each}
  </div>

  <h3 class="type-static">Type 6 — Static</h3>
  <div class="codex-grid">
    {#each [{ file: "α", label: "α" }, { file: "β", label: "β" }, { file: "Γ", label: "Γ" }] as { file, label }}
      <figure class="codex-cell">
        <img
          src="/guide/level-1/images/double-staff-codex/{file}.webp"
          alt="Letter {label}"
          loading="lazy"
        />
        <figcaption>{label}</figcaption>
      </figure>
    {/each}
  </div>
</GuideSection>

<style>
  .codex-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
    gap: 0.75rem;
    margin: 1.5rem 0;
    justify-items: center;
  }

  .codex-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    margin: 0;
  }

  .codex-cell img {
    width: 90px;
    height: 90px;
    object-fit: contain;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    background: #fff;
  }

  .codex-cell figcaption {
    font-size: 0.85rem;
    font-weight: 600;
    color: #444;
    text-align: center;
  }

  @media (prefers-color-scheme: dark) {
    .codex-cell img {
      background: #1a1a1a;
      border-color: #333;
    }
  }
</style>
