<!--
  PropChiralityRow.svelte

  Chirality picker for buugeng-family props, docked at the bottom of
  BentoPropGrid so every surface that mounts the picker inherits it.

  Chirality used to live on an unlabelled 36px icon button in two places only
  (the Create step-editor row and the Settings readout) while the picker itself
  — mounted in eleven surfaces — had no way to express it at all. Moving the
  control into the picker is what makes it reachable from the Animation Panel,
  the Arena drawer, My Props and Tunnel art settings without adding a twelfth
  copy of the button.

  Buugeng chirality is a statement about the PAIR: two of the same handedness
  stay apart, two of opposite handedness nest into one shape. So a host that
  sets both hands gets one control per hand rather than a single control
  writing both — the relationship is the whole point, and a shared control
  cannot express it. Prop type still travels together in those hosts.

  Exactly one of two states is always active per hand, so this routes to
  SegmentedControl per .claude/rules/chip-primitives.md. Each segment renders
  the selected prop's own art in its hand's colour — one upright, one mirrored
  — through the primitive's existing optionContent slot. Colour plus the
  control's aria-label carry which hand it is, so the words Blue and Red stay
  off the face (chip-primitives.md, Blue / Red Prop Identity).

  The two are named A and B, matching what pictograph-inspect already prints
  (sequence-actions/pictograph-inspect/formatters.ts). Neither handedness is
  the canonical one — which SVG happens to be the base asset is the only thing
  that would make one "standard" — so a neutral index tells the truth where
  Standard/Mirrored implied a deviation from a norm that does not exist.
-->
<script lang="ts">
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { getPropTypeDisplayInfo } from "./prop-type-registry";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import type {
    ChiralityHand,
    PropChiralityHandState,
  } from "./prop-chirality-seam";

  type Chirality = "a" | "b";

  let {
    propType,
    hands,
    onChange,
  }: {
    /** The prop whose art the segments preview. */
    propType: PropType;
    /** One entry per hand this picker governs, blue first. */
    hands: readonly PropChiralityHandState[];
    onChange: (hand: ChiralityHand, flipped: boolean) => void;
  } = $props();

  const displayInfo = $derived(getPropTypeDisplayInfo(propType));

  const options = [
    { value: "a" as const, label: "A" },
    { value: "b" as const, label: "B" },
  ];

  function valueFor(flipped: boolean): Chirality {
    return flipped ? "b" : "a";
  }
</script>

<div class="chirality-row">
  <span class="chirality-label">Chirality</span>
  <div class="chirality-controls">
    {#each hands as state (state.hand)}
      <div class="chirality-hand" class:red={state.hand === "red"}>
        <SegmentedControl
          {options}
          value={valueFor(state.flipped)}
          onchange={(next) => onChange(state.hand, next === "b")}
          color={state.hand}
          semantics="radiogroup"
          ariaLabel="{state.hand === 'red' ? 'Red' : 'Blue'} buugeng chirality"
        >
          {#snippet optionContent(option)}
            <img
              src={displayInfo.image}
              alt=""
              class="chirality-art"
              class:mirrored={option === "b"}
            />
            <span class="chirality-word">{option === "b" ? "B" : "A"}</span>
          {/snippet}
        </SegmentedControl>
      </div>
    {/each}
  </div>
</div>

<style>
  .chirality-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 10px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .chirality-label {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text-secondary, var(--theme-text));
    white-space: nowrap;
  }

  .chirality-controls {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    /* Wide enough that two controls read as two groups. At 10px the four
       segments ran together as one A/B/A/B bar. */
    gap: 20px;
    flex: 1;
    min-width: 0;
  }

  /* Each hand's control is a two-option selector, not a progress bar. Without
     a ceiling it stretches to whatever the host panel is wide — the exact
     failure .claude/rules/visual-verification-mandatory.md opens with. The
     ceiling is sized for a glyph and a letter: once the words became A and B
     the shape is what the segment is really showing, so the control hugs it
     instead of stranding 250px of empty track. The 11rem basis is what still
     wraps the pair one per line on the narrowest sheet. */
  .chirality-hand {
    flex: 0 1 11rem;
    min-width: 0;
    max-width: 13rem;
    padding: 4px;
    border-radius: 14px;
    /* The wash and ring make the whole control unmistakably one hand's, which
       is what lets the words Blue and Red stay off the face
       (chip-primitives.md, Blue / Red Prop Identity). */
    background: color-mix(
      in srgb,
      var(--dm-motion-blue, #3d44b8) 12%,
      transparent
    );
    box-shadow: inset 0 0 0 1px
      color-mix(in srgb, var(--dm-motion-blue, #3d44b8) 38%, transparent);
  }

  .chirality-hand.red {
    background: color-mix(
      in srgb,
      var(--dm-motion-red, #dc2626) 12%,
      transparent
    );
    box-shadow: inset 0 0 0 1px
      color-mix(in srgb, var(--dm-motion-red, #dc2626) 38%, transparent);
  }

  .chirality-row :global(.segment-label) {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .chirality-art {
    width: 34px;
    height: 34px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .chirality-art.mirrored {
    transform: scaleX(-1);
  }

  .chirality-word {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Tint the previews to the hand they belong to, matching CompactPropDisplay.
     With two controls side by side this is what tells them apart, so it is
     load-bearing rather than decorative. */
  .chirality-hand.red .chirality-art {
    filter: hue-rotate(125deg) saturate(1.2);
  }

  /* Narrow hosts stack the pair one per line, so the word moves above them
     instead of disappearing. Hiding it left two identical A/B pairs with
     nothing on screen saying what they set. */
  @container prop-grid (max-width: 340px) {
    .chirality-row {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }

    .chirality-label {
      text-align: center;
    }
  }
</style>
