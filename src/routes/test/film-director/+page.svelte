<script lang="ts">
  import { onMount } from "svelte";

  type WorkbenchComponent =
    typeof import("./_components/FilmDirectorWorkbench.svelte").default;

  let Workbench = $state<WorkbenchComponent | null>(null);
  let loadError = $state<string | null>(null);

  onMount(() => {
    let active = true;
    void import("./_components/FilmDirectorWorkbench.svelte")
      .then(({ default: component }) => {
        if (active) Workbench = component;
      })
      .catch((error: unknown) => {
        if (!active) return;
        loadError = error instanceof Error ? error.message : String(error);
      });

    return () => {
      active = false;
    };
  });
</script>

<svelte:head>
  <title>3D Film Director</title>
  <meta
    name="description"
    content="Private workbench for directing repeatable TKA 3D showcase films."
  />
</svelte:head>

{#if Workbench}
  <Workbench />
{:else}
  <main class="loading-shell">
    <section
      class:error={Boolean(loadError)}
      class="loading-card"
      role={loadError ? "alert" : "status"}
    >
      <i
        class="fas {loadError ? 'fa-triangle-exclamation' : 'fa-clapperboard'}"
        aria-hidden="true"
      ></i>
      <div>
        <span>3D Film Director</span>
        <h1>{loadError ?? "Preparing the first scene"}</h1>
      </div>
    </section>
  </main>
{/if}

<style>
  :global(body) {
    margin: 0;
    overflow: hidden;
    background: #070812;
  }

  .loading-shell {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 1rem;
    color: var(--theme-text, #fff);
    background:
      radial-gradient(
        circle at 50% 40%,
        rgba(110, 91, 220, 0.22),
        transparent 34%
      ),
      #070812;
  }

  .loading-card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 1rem;
    width: min(31rem, 100%);
    padding: 1.2rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 1rem;
    background: var(--theme-panel-bg, #10111b);
    box-shadow: 0 1.5rem 5rem rgba(0, 0, 0, 0.44);
  }

  .loading-card > i {
    display: grid;
    place-items: center;
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 0.9rem;
    color: var(--theme-accent, #b0a4ff);
    background: color-mix(
      in srgb,
      var(--theme-accent, #7869eb) 18%,
      transparent
    );
    font-size: 1.25rem;
  }

  .loading-card.error > i {
    color: var(--semantic-error, #ff9393);
  }

  span,
  h1 {
    margin: 0;
  }

  span {
    color: var(--theme-accent, #b0a4ff);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  h1 {
    margin-top: 0.25rem;
    font-size: 1.15rem;
    line-height: 1.25;
  }
</style>
