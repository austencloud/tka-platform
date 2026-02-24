<!--
  BentoPropGrid.svelte - Bento-box style prop selection grid

  Shows ALL prop types organized by family in a modern bento-box layout.
  No version switcher needed - everything is visible at once.
-->
<script lang="ts">
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import PropTypeButton from "./PropTypeButton.svelte";

  let {
    selectedPropType,
    color = "blue",
    title = "Select Prop",
    onSelect,
  } = $props<{
    selectedPropType: PropType;
    color?: "blue" | "red";
    title?: string;
    onSelect: (propType: PropType) => void;
  }>();

  // Define prop families - each family is a visual group
  const PROP_FAMILIES: { name: string; props: PropType[] }[] = [
    {
      name: "Staffs",
      props: [PropType.STAFF, PropType.SIMPLESTAFF, PropType.BIGSTAFF, PropType.STAFF2],
    },
    {
      name: "Clubs",
      props: [PropType.CLUB, PropType.BIGCLUB],
    },
    {
      name: "Fans",
      props: [PropType.FAN, PropType.BIGFAN],
    },
    {
      name: "Buugengs",
      props: [PropType.BUUGENG, PropType.BIGBUUGENG, PropType.TRIGENG],
    },
    {
      name: "Hoops",
      props: [PropType.MINIHOOP, PropType.BIGHOOP],
    },
    {
      name: "Triads",
      props: [PropType.TRIAD, PropType.BIGTRIAD],
    },
    {
      name: "Triquetras",
      props: [PropType.TRIQUETRA, PropType.TRIQUETRA2],
    },
    {
      name: "Chickens",
      props: [PropType.CHICKEN, PropType.BIGCHICKEN],
    },
    {
      name: "Guitars",
      props: [PropType.GUITAR, PropType.UKULELE],
    },
    {
      name: "Stars",
      props: [PropType.DOUBLESTAR, PropType.BIGDOUBLESTAR],
    },
    {
      name: "Rings",
      props: [PropType.EIGHTRINGS, PropType.BIGEIGHTRINGS],
    },
    {
      name: "Torches",
      props: [PropType.TORCH, PropType.BIGTORCH],
    },
    {
      name: "Singles",
      props: [PropType.HAND, PropType.SWORD, PropType.QUIAD],
      // Note: POI removed until fully implemented
    },
  ];

  function handlePropSelect(propType: PropType) {
    onSelect(propType);
  }
</script>

<div class="bento-prop-grid">
  <!-- Header -->
  <header class="grid-header">
    <h4 class="grid-title">{title}</h4>
  </header>

  <!-- Scrollable content -->
  <div class="bento-scroll themed-scrollbar">
    <div class="bento-content">
      {#each PROP_FAMILIES as family}
        <section class="prop-family" class:large={family.props.length >= 4}>
          <h5 class="family-name">{family.name}</h5>
          <div class="family-props">
            {#each family.props as propType}
              <PropTypeButton
                {propType}
                selected={selectedPropType === propType}
                {color}
                onSelect={handlePropSelect}
              />
            {/each}
          </div>
        </section>
      {/each}
    </div>
  </div>
</div>

<style>
  .bento-prop-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    width: 100%;
    height: 100%;
    min-height: 0;
    flex: 1;
    container-type: inline-size;
    container-name: bento-grid;
  }

  /* Header */
  .grid-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 12px 0;
    flex-shrink: 0;
  }

  .grid-title {
    margin: 0;
    font-size: var(--font-size-xs, 11px);
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Scrollable area */
  .bento-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 8px;
    scrollbar-width: thin;
  }

  /* Bento grid layout */
  .bento-content {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 8px;
    align-content: start;
  }

  /* Family section - a bento "cell" */
  .prop-family {
    background: color-mix(in srgb, var(--theme-card-bg) 80%, var(--theme-stroke) 20%);
    border: 1px solid var(--theme-stroke);
    border-radius: 10px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  /* Large families span more columns */
  .prop-family.large {
    grid-column: span 2;
  }

  .family-name {
    margin: 0;
    font-size: var(--font-size-compact, 10px);
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.3px;
    opacity: 0.8;
  }

  /* Props within a family - horizontal row */
  .family-props {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  /* Prop buttons within family - flex to fill available space */
  .family-props :global(.prop-button) {
    /* Flex basis with min/max for responsive sizing */
    flex: 1 1 60px;
    min-width: 55px;
    max-width: 90px;
  }

  /* Larger prop buttons at wider containers */
  @container bento-grid (min-width: 300px) {
    .bento-content {
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
    }

    .family-props {
      gap: 8px;
    }

    .family-props :global(.prop-button) {
      flex: 1 1 65px;
      min-width: 60px;
      max-width: 100px;
    }

    .prop-family {
      padding: 10px;
      gap: 8px;
    }
  }

  @container bento-grid (min-width: 450px) {
    .bento-content {
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
    }

    .family-props :global(.prop-button) {
      flex: 1 1 70px;
      min-width: 65px;
      max-width: 110px;
    }

    .prop-family {
      padding: 12px;
    }

    .family-name {
      font-size: var(--font-size-xs, 11px);
    }
  }

  @container bento-grid (min-width: 600px) {
    .bento-content {
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    }

    .family-props :global(.prop-button) {
      flex: 1 1 75px;
      min-width: 70px;
      max-width: 120px;
    }
  }

  /* Focus states */
  .prop-family:focus-within {
    border-color: var(--theme-stroke-strong);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .bento-scroll {
      scroll-behavior: auto;
    }
  }
</style>
