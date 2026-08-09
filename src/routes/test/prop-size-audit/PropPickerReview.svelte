<script lang="ts">
  import MyPropsDrawer from "$lib/shared/navigation/components/account/MyPropsDrawer.svelte";
  import type { PropPreferenceState } from "$lib/shared/community/state/prop-preference-state.svelte";
  import type { CatdogCombo } from "$lib/shared/community/services/types";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  let isOpen = $state(true);
  let selectedProps = $state<PropType[]>([
    PropType.STAFF,
    PropType.FAN,
    PropType.CLUB,
  ]);
  let favoriteProp = $state<PropType | null>(PropType.STAFF);
  let favoriteCatdog = $state<CatdogCombo | null>(null);

  // Review-only adapter for the production drawer. It keeps the real component
  // and state transitions while replacing Firebase writes with local state.
  const propState = {
    get propsISpinWith() {
      return selectedProps;
    },
    get favoriteProp() {
      return favoriteProp;
    },
    get favoriteCatdog() {
      return favoriteCatdog;
    },
    get loading() {
      return false;
    },
    get saving() {
      return false;
    },
    async toggleProp(prop: PropType) {
      if (selectedProps.includes(prop)) {
        selectedProps = selectedProps.filter((selected) => selected !== prop);
        if (favoriteProp === prop) favoriteProp = null;
      } else {
        selectedProps = [...selectedProps, prop];
      }
    },
    async setFavorite(prop: PropType) {
      if (!selectedProps.includes(prop)) {
        selectedProps = [...selectedProps, prop];
      }
      favoriteProp = prop;
    },
    async setCatdogFavorite(combo: CatdogCombo | null) {
      favoriteCatdog = combo;
    },
    async reload() {},
  } satisfies PropPreferenceState;

  // Keep the review target visible while DevTools changes viewport dimensions.
  $effect(() => {
    if (!isOpen) isOpen = true;
  });
</script>

<main class="review-page">
  <section class="review-card">
    <p class="kicker">Production component review</p>
    <h1>Prop picker, isolated</h1>
    <p>
      This is the real My Props drawer with disposable data. Nothing selected
      here reaches Firebase or changes the signed-in account.
    </p>
    <dl>
      <div>
        <dt>Selected</dt>
        <dd>{selectedProps.length}</dd>
      </div>
      <div>
        <dt>Favorite</dt>
        <dd>{favoriteProp ?? "None"}</dd>
      </div>
    </dl>
    <button class="open-button" onclick={() => (isOpen = true)}>
      Open prop picker
    </button>
  </section>
</main>

<MyPropsDrawer
  bind:isOpen
  {propState}
  onclose={() => {
    isOpen = false;
  }}
/>

<style>
  .review-page {
    display: grid;
    min-height: 100dvh;
    place-items: center;
    padding: clamp(1rem, 4vw, 4rem);
    color: var(--theme-text, #f8fafc);
    background:
      radial-gradient(
        circle at 18% 12%,
        color-mix(in srgb, var(--prop-blue, #3b82f6) 18%, transparent),
        transparent 32%
      ),
      #080a0f;
  }

  .review-card {
    width: min(100%, 36rem);
    padding: clamp(1.25rem, 3vw, 2rem);
    background: var(--theme-panel-bg, #11141c);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: var(--radius-xl, 1.25rem);
  }

  .kicker,
  h1,
  p,
  dl {
    margin: 0;
  }

  .kicker {
    color: color-mix(in srgb, var(--prop-blue, #3b82f6) 72%, white);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1 {
    margin-top: 0.35rem;
    font-size: clamp(1.75rem, 5vw, 2.75rem);
    line-height: 1.05;
  }

  p:not(.kicker) {
    margin-top: 0.85rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.6;
  }

  dl {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
    margin-top: 1.25rem;
  }

  dl div {
    padding: 0.85rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-md, 0.75rem);
  }

  dt {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
    font-size: var(--font-size-compact, 0.75rem);
  }

  dd {
    margin: 0.25rem 0 0;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 700;
  }

  .open-button {
    min-height: var(--min-touch-target, 44px);
    margin-top: 1.25rem;
    padding: 0.75rem 1rem;
    color: white;
    background: var(--theme-accent, #6366f1);
    border: 0;
    border-radius: 999px;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .open-button:focus-visible {
    outline: 3px solid white;
    outline-offset: 3px;
  }
</style>
