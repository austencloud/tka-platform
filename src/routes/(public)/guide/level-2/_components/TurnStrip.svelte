<script lang="ts" module>
  import type { HalfwayMotion } from "../_data/halfway-pose";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";

  /**
   * One reflowable lesson strip: start pose → (poses/half) → end pose → an
   * optional trailing full-motion, click-to-animate pictograph — the mobile
   * article-lane form of the print artboards' turn-breakdown strips (see
   * TwoTurnsDashStaticPage.svelte / TwoTurnsShiftsPage.svelte's `FrameRender`
   * union, which this mirrors kind-for-kind):
   *
   *   - "start" / "end": a real single-staff pose (no arrow — it's a hold, not
   *     a motion slice).
   *   - "half": the real halved pictograph at the motion's midpoint
   *     (`buildHalvedStep(step, 0.5)`), when the pipeline can represent it.
   *     `step: null` falls back to the runtime PoseFrame pose (same visual as
   *     "pose", fixed at t=0.5) for the null contract.
   *   - "pose": an off-lattice fraction (quarters/thirds) that has a legal
   *     45deg orientation but no legal named grid location — rendered via the
   *     visual-only PoseFrame path (poseAt + Austen's own end-direction glyphs).
   *   - "combined": the real full-motion pictograph, the click-to-animate
   *     target. Selection highlighting / click-to-animate degrade to a plain
   *     static pictograph when no selection context is provided (both
   *     `getSequenceSelection` and `getGuideSequenceClick` return null off any
   *     host that doesn't set one — see SelectionHit.svelte — so no guard is
   *     needed beyond the same optional chaining the artboards already use).
   */
  export type TurnStripFrame =
    | { kind: "start" | "end"; step: StepData; frameLabel?: string; thumbLabel?: string }
    | {
        kind: "half";
        step: StepData | null;
        fallbackMotion: HalfwayMotion;
        frameLabel?: string;
        thumbLabel?: string;
      }
    | {
        kind: "pose";
        motion: HalfwayMotion;
        t: number;
        arrowStart: number;
        frameLabel?: string;
        thumbLabel?: string;
      }
    | {
        kind: "combined";
        step: StepData;
        /** Selection/animation identity — must be unique across the page. */
        animKey: string;
        /** Spoken/derived word for the click-to-animate label. */
        word: string;
        /** Full strip (start + baked reversal steps) the animation companion plays. */
        rowSteps: StepData[];
        frameLabel?: string;
        thumbLabel?: string;
      }
    | {
        /**
         * Both-hands-turning halfway pose — for 1|1 hybrids (OneOneTurns,
         * S/T, Lam opening/closing) where BOTH staves are mid-turn at once,
         * unlike every other frame kind here (single moving hand). Renders
         * one PoseFrame per entry grid-stacked in the same cell (same
         * technique as Crossfade — see crossfade-primitive.md), so both
         * staves draw over one shared 5-dot grid with no layout cost.
         */
        kind: "dual-pose";
        poses: { motion: HalfwayMotion; color: MotionColor; t: number }[];
        frameLabel?: string;
        thumbLabel?: string;
      };
</script>

<script lang="ts">
  import GuidePictograph from "../../level-1/_components/GuidePictograph.svelte";
  import PoseFrame from "./PoseFrame.svelte";
  import SelectionHit from "$lib/shared/selection/SelectionHit.svelte";
  import "$lib/shared/selection/selection.css";
  import { getSequenceSelection } from "$lib/shared/selection/sequence-selection.svelte";
  import { getGuideSequenceClick } from "../../level-1/_data/guide-data-context";
  import { getGuideActiveStep } from "../../level-1/_data/guide-active-step.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { MotionType, MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

  let {
    frames,
    picTheme = "light",
    caption,
  }: {
    frames: TurnStripFrame[];
    picTheme?: "light" | "dark";
    caption?: string;
  } = $props();

  const selection = getSequenceSelection();
  const activeStep = getGuideActiveStep();
  const emitSequence = getGuideSequenceClick();

  // ── Pose-frame accessibility text ───────────────────────────────────────
  // "pose" and the null-fallback "half" frames aren't real StepData, so they
  // don't get GuidePictograph's synchronous describePictograph aria-label —
  // this builds the equivalent sentence from the HalfwayMotion + fraction.
  const MOTION_WORD: Partial<Record<MotionType, string>> = {
    [MotionType.PRO]: "pro-spin shift",
    [MotionType.ANTI]: "anti-spin shift",
    [MotionType.DASH]: "dash",
    [MotionType.STATIC]: "static hold",
  };
  const LOC_NAME: Record<string, string> = {
    n: "north",
    e: "east",
    s: "south",
    w: "west",
    ne: "northeast",
    se: "southeast",
    sw: "southwest",
    nw: "northwest",
  };
  const locName = (l: string): string => LOC_NAME[l] ?? l;
  const fractionWord = (t: number): string => {
    if (Math.abs(t - 0.25) < 1e-6) return "quarter";
    if (Math.abs(t - 0.75) < 1e-6) return "three-quarter";
    if (Math.abs(t - 1 / 3) < 1e-6) return "one-third";
    if (Math.abs(t - 2 / 3) < 1e-6) return "two-thirds";
    if (Math.abs(t - 0.5) < 1e-6) return "halfway";
    return `${Math.round(t * 100)}%`;
  };
  const poseAriaLabel = (motion: HalfwayMotion, t: number): string => {
    const verb = MOTION_WORD[motion.type] ?? String(motion.type);
    const from = locName(motion.from);
    const to = locName(motion.to);
    const where = from === to ? `at ${from}` : `from ${from} to ${to}`;
    return `Staff pose at the ${fractionWord(t)} point of the ${verb} motion ${where}.`;
  };
  const dualPoseAriaLabel = (poses: { motion: HalfwayMotion; color: MotionColor; t: number }[]): string =>
    poses
      .map((p) => `${p.color === MotionColor.BLUE ? "Blue" : "Red"} ${poseAriaLabel(p.motion, p.t).charAt(0).toLowerCase()}${poseAriaLabel(p.motion, p.t).slice(1)}`)
      .join(" ");
</script>

<div class="turn-strip" role="group" aria-label={caption ?? "Turn breakdown diagram"}>
  {#each frames as frame, i (i)}
    <div class="turn-frame">
      <span class="frame-cap top">{frame.frameLabel ?? ""}</span>
      <div class="frame-box">
        {#if frame.kind === "pose"}
          <div class="pose-box" role="img" aria-label={poseAriaLabel(frame.motion, frame.t)}>
            <PoseFrame motion={frame.motion} t={frame.t} arrow={{ tStart: frame.arrowStart, tEnd: frame.t }} />
          </div>
        {:else if frame.kind === "dual-pose"}
          <div class="pose-box dual" role="img" aria-label={dualPoseAriaLabel(frame.poses)}>
            {#each frame.poses as p, pi (pi)}
              <div class="pose-layer">
                <PoseFrame motion={p.motion} t={p.t} color={p.color} />
              </div>
            {/each}
          </div>
        {:else if frame.kind === "half" && !frame.step}
          <div class="pose-box" role="img" aria-label={poseAriaLabel(frame.fallbackMotion, 0.5)}>
            <PoseFrame motion={frame.fallbackMotion} t={0.5} arrow={{ tStart: 0, tEnd: 0.5 }} />
          </div>
        {:else if frame.kind === "combined"}
          <div
            class="tka-seq-cell combined-cell"
            class:is-hovered={selection?.isHovered(frame.animKey)}
            class:is-selected={selection?.isSelected(frame.animKey)}
            class:guide-step-active={activeStep?.key === frame.animKey}
          >
            <GuidePictograph data={frame.step} size="md" eager forceTheme={picTheme} propType={PropType.STAFF} />
            <SelectionHit
              groupId={frame.animKey}
              isGroupStart
              label={`Animate: ${frame.word}`}
              onselect={() =>
                emitSequence?.({
                  strip: frame.rowSteps,
                  word: frame.word,
                  key: frame.animKey,
                  propType: "staff",
                })}
            />
          </div>
        {:else}
          <GuidePictograph
            data={frame.step}
            size="md"
            eager
            forceTheme={picTheme}
            propType={PropType.STAFF}
            showArrows={frame.kind === "half"}
          />
        {/if}
      </div>
      <span class="frame-cap bottom">{frame.thumbLabel ?? ""}</span>
    </div>
    {#if i < frames.length - 1}
      <div class="connector" aria-hidden="true">
        <span class="cap-spacer"></span>
        <span class="arrow-slot">
          {#if i === frames.length - 2}
            <span class="equals">=</span>
          {:else}
            <svg class="flow-arrow" viewBox="0 0 14.5 10">
              <line x1="0" y1="5" x2="7.5" y2="5" stroke="currentColor" stroke-width="2" />
              <polygon points="6.5,1.3 14.5,5 6.5,8.7" fill="currentColor" />
            </svg>
          {/if}
        </span>
        <span class="cap-spacer"></span>
      </div>
    {/if}
  {/each}
</div>
{#if caption}<p class="turn-strip-caption">{caption}</p>{/if}

<style>
  /* Palette follows FlowFrame's contract: --ink/--ink-dim come from the host
     (guide article column), never declared locally here. */
  .turn-strip {
    --frame-size: clamp(4.2rem, 20cqw, 7.25rem);
    container-type: inline-size;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: center;
    gap: 0.6rem 0.5rem;
    margin: 1.75rem auto;
    max-width: 48rem;
  }

  .turn-frame {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
  }

  /* Reserved-height caption slots — always rendered (empty string when a frame
     carries no label) so every frame's box lands at the same vertical offset
     regardless of which frames have labels, and so the connector's own
     matching spacers line its arrow up with the frame boxes' centers without
     runtime measurement (no-layout-shift rule: reserve space for the widest/
     tallest case up front). */
  .frame-cap {
    display: block;
    min-height: 1.1rem;
    font-family: "Cormorant Garamond", Georgia, serif;
    font-style: italic;
    font-size: 0.85rem;
    line-height: 1.1;
    text-align: center;
  }
  .frame-cap.top {
    font-weight: 600;
    color: var(--ink, #1a1a1a);
  }
  .frame-cap.bottom {
    color: var(--ink-dim, #555);
  }

  .frame-box {
    position: relative;
    width: var(--frame-size);
    height: var(--frame-size);
    border: 1px solid color-mix(in oklab, var(--ink, #1a1a1a) 16%, transparent);
    border-radius: 10px;
    overflow: hidden;
    background: color-mix(in oklab, var(--ink, #1a1a1a) 3%, transparent);
    box-shadow: 0 1px 4px color-mix(in oklab, var(--ink, #1a1a1a) 7%, transparent);
  }
  .pose-box {
    width: 100%;
    height: 100%;
  }
  .pose-box.dual {
    display: grid;
  }
  .pose-layer {
    grid-area: 1 / 1;
    width: 100%;
    height: 100%;
  }
  .combined-cell {
    width: 100%;
    height: 100%;
  }
  .frame-box :global(.guide-pictograph) {
    width: 100%;
    height: 100%;
  }
  .frame-box :global(.pictograph-wrapper) {
    max-width: none !important;
    width: 100%;
    height: 100%;
  }

  .connector {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
  }
  .cap-spacer {
    display: block;
    min-height: 1.1rem;
  }
  .arrow-slot {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: var(--frame-size);
    color: var(--ink, #1a1a1a);
  }
  .flow-arrow {
    display: block;
    width: 100%;
    height: 0.7rem;
  }
  .equals {
    font-family: "Cambria", Georgia, serif;
    font-weight: 700;
    font-size: 1.4rem;
    line-height: 1;
  }

  .turn-strip-caption {
    font-size: 1rem;
    font-style: italic;
    color: var(--ink-dim, #555);
    text-align: center;
    line-height: 1.4;
    max-width: 30rem;
    margin: 0.15rem auto 0.25rem;
  }

  @container (max-width: 360px) {
    .turn-strip {
      --frame-size: clamp(3.4rem, 24cqw, 5.5rem);
      gap: 0.5rem 0.35rem;
    }
  }
</style>
