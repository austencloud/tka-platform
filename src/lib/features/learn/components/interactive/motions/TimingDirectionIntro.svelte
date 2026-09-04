<!--
  Five distinct motion bays model the two independent Timing and Direction
  axes. The ball examples intentionally run on offset clocks so each reads as
  its own idea instead of becoming one synchronized comparison instrument.
-->
<div
  class="concept-model"
  role="group"
  aria-label="Animated timing and direction examples"
>
  <section class="concept-panel timing-panel" aria-labelledby="timing-heading">
    <h3 id="timing-heading">Timing</h3>

    <div class="examples timing-examples">
      <div class="example-bay timing-example together" data-phase="0">
        <strong>Together</strong>
        <div class="bounce-stage" role="img" aria-label="Together timing">
          <div class="bounce-lane blue">
            <span class="ball" aria-hidden="true"></span>
            <span class="ball-shadow" aria-hidden="true"></span>
          </div>
          <div class="bounce-lane red">
            <span class="ball" aria-hidden="true"></span>
            <span class="ball-shadow" aria-hidden="true"></span>
          </div>
        </div>
      </div>

      <div class="example-bay timing-example split" data-phase="half">
        <strong>Split</strong>
        <div class="bounce-stage" role="img" aria-label="Split timing">
          <div class="bounce-lane blue">
            <span class="ball" aria-hidden="true"></span>
            <span class="ball-shadow" aria-hidden="true"></span>
          </div>
          <div class="bounce-lane red">
            <span class="ball" aria-hidden="true"></span>
            <span class="ball-shadow" aria-hidden="true"></span>
          </div>
        </div>
      </div>

      <div class="example-bay timing-example quarter" data-phase="quarter">
        <strong>Quarter</strong>
        <div class="bounce-stage" role="img" aria-label="Quarter timing">
          <div class="bounce-lane blue">
            <span class="ball" aria-hidden="true"></span>
            <span class="ball-shadow" aria-hidden="true"></span>
          </div>
          <div class="bounce-lane red">
            <span class="ball" aria-hidden="true"></span>
            <span class="ball-shadow" aria-hidden="true"></span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section
    class="concept-panel direction-panel"
    aria-labelledby="direction-heading"
  >
    <h3 id="direction-heading">Direction</h3>

    <div class="examples direction-examples">
      <div class="example-bay direction-example same" data-direction="same">
        <strong>Same</strong>
        <div class="travel-stage" role="img" aria-label="Same direction">
          <div class="travel-lane blue">
            <span class="direction-arrow" aria-hidden="true">›</span>
            <span class="traveler" aria-hidden="true"></span>
          </div>
          <div class="travel-lane red">
            <span class="direction-arrow" aria-hidden="true">›</span>
            <span class="traveler" aria-hidden="true"></span>
          </div>
        </div>
      </div>

      <div
        class="example-bay direction-example opposite"
        data-direction="opposite"
      >
        <strong>Opposite</strong>
        <div class="travel-stage" role="img" aria-label="Opposite direction">
          <div class="travel-lane blue">
            <span class="direction-arrow" aria-hidden="true">›</span>
            <span class="traveler" aria-hidden="true"></span>
          </div>
          <div class="travel-lane red">
            <span class="direction-arrow" aria-hidden="true">‹</span>
            <span class="traveler" aria-hidden="true"></span>
          </div>
        </div>
      </div>
    </div>
  </section>
</div>

<style>
  .concept-model {
    --concept-cycle: calc(
      var(--duration-dramatic) + var(--duration-dramatic) +
        var(--duration-dramatic) + var(--duration-dramatic)
    );
    --travel-cycle: calc(
      var(--duration-dramatic) + var(--duration-dramatic) +
        var(--duration-dramatic) + var(--duration-dramatic) +
        var(--duration-dramatic) + var(--duration-dramatic)
    );
    --phase-quarter: calc(0ms - var(--duration-dramatic));
    --phase-half: calc(
      0ms - var(--duration-dramatic) - var(--duration-dramatic)
    );
    --bounce-rise: 4.6rem;
    --quarter-rest: 2.3rem;
    --ball-size: 1.05rem;
    --track-width: 7.5rem;
    --track-travel: 6.45rem;

    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    gap: clamp(0.65rem, 1.3cqw, 1rem);
    width: min(100%, 72rem);
    height: min(100%, 18rem);
    min-height: min(100%, 15rem);
    margin-inline: auto;
  }

  .concept-panel {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: clamp(0.65rem, 1.6cqh, 0.95rem);
    min-width: 0;
    min-height: 0;
  }

  h3 {
    margin: 0;
    color: var(--theme-text);
    font-size: clamp(1.35rem, 2.1cqw, 2rem);
    line-height: 1.1;
    text-align: center;
  }

  .examples {
    display: grid;
    gap: clamp(0.45rem, 0.9cqw, 0.75rem);
    min-width: 0;
    min-height: 0;
  }

  .timing-examples {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .direction-examples {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .example-bay {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    align-items: stretch;
    gap: clamp(0.45rem, 1.2cqh, 0.7rem);
    min-width: 0;
    min-height: 0;
    padding: clamp(0.7rem, 1.35cqw, 1rem);
    overflow: hidden;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-lg, 0.75rem);
    background: var(--theme-card-bg);
  }

  .example-bay > strong {
    color: var(--theme-text-dim);
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.2;
    text-align: center;
  }

  .timing-example {
    --scene-delay: calc(0ms - var(--duration-fast));
  }

  .split {
    --scene-delay: calc(0ms - var(--duration-emphasis));
  }

  .quarter {
    --scene-delay: calc(0ms - var(--duration-dramatic));
  }

  .bounce-stage {
    position: relative;
    display: flex;
    align-items: stretch;
    justify-content: center;
    gap: clamp(1rem, 1.8cqw, 1.55rem);
    min-height: calc(var(--bounce-rise) + var(--ball-size) + 0.5rem);
  }

  .bounce-stage::after {
    content: "";
    position: absolute;
    right: 18%;
    bottom: 0;
    left: 18%;
    height: 1px;
    background: var(--theme-stroke-strong);
  }

  .bounce-lane {
    position: relative;
    z-index: 1;
    width: var(--ball-size);
    height: calc(var(--bounce-rise) + var(--ball-size) + 0.25rem);
    min-width: var(--ball-size);
  }

  .ball,
  .traveler {
    display: block;
    width: var(--ball-size);
    aspect-ratio: 1;
    border-radius: 50%;
  }

  .ball {
    position: absolute;
    z-index: 1;
    top: 0;
    left: 0;
    transform: translateY(var(--bounce-rise)) scale(1.14, 0.86);
    transform-origin: center bottom;
    animation: timing-bounce var(--concept-cycle) linear infinite both;
    animation-delay: calc(var(--scene-delay, 0ms) + var(--phase-delay, 0ms));
  }

  .ball-shadow {
    position: absolute;
    right: 0.04rem;
    bottom: 0.08rem;
    left: 0.04rem;
    height: 0.28rem;
    border-radius: 50%;
    background: var(--theme-text);
    opacity: 0.36;
    animation: timing-shadow var(--concept-cycle) linear infinite both;
    animation-delay: calc(var(--scene-delay, 0ms) + var(--phase-delay, 0ms));
  }

  .blue .ball,
  .blue .traveler {
    background: var(--prop-blue, #3d44b8);
  }

  .red .ball,
  .red .traveler {
    background: var(--prop-red, #ed1c24);
  }

  .split .red {
    --phase-delay: var(--phase-half);
  }

  .quarter .red {
    --phase-delay: var(--phase-quarter);
  }

  .travel-stage {
    display: grid;
    align-content: center;
    justify-items: center;
    gap: clamp(0.8rem, 2cqh, 1.15rem);
    min-width: 0;
  }

  .travel-lane {
    position: relative;
    width: min(100%, var(--track-width));
    height: var(--ball-size);
    border-radius: 999px;
    background: color-mix(in srgb, var(--theme-stroke) 70%, transparent);
  }

  .direction-arrow {
    position: absolute;
    top: 50%;
    right: 0.28rem;
    translate: 0 -52%;
    color: var(--theme-text-dim);
    font-size: 1rem;
    font-weight: 800;
    line-height: 1;
  }

  .opposite .red .direction-arrow {
    right: auto;
    left: 0.28rem;
  }

  .traveler {
    position: absolute;
    top: 0;
    left: 0;
    animation: direction-travel-forward var(--travel-cycle) linear infinite both;
    animation-delay: calc(0ms - var(--duration-fast));
  }

  .opposite .traveler {
    animation-delay: calc(0ms - var(--duration-dramatic));
  }

  .opposite .red .traveler {
    animation-name: direction-travel-reverse;
  }

  @keyframes timing-bounce {
    0%,
    4% {
      transform: translateY(var(--bounce-rise)) scale(1.14, 0.86);
      animation-timing-function: var(--ease-out);
    }
    12% {
      transform: translateY(calc(var(--bounce-rise) - 0.45rem))
        scale(0.94, 1.06);
      animation-timing-function: var(--ease-out);
    }
    46% {
      transform: translateY(0) scale(1);
      animation-timing-function: var(--ease-in);
    }
    78% {
      transform: translateY(var(--bounce-rise)) scale(1.16, 0.84);
      animation-timing-function: var(--ease-out);
    }
    84% {
      transform: translateY(calc(var(--bounce-rise) - 0.35rem))
        scale(0.96, 1.04);
      animation-timing-function: var(--ease-in);
    }
    92%,
    100% {
      transform: translateY(var(--bounce-rise)) scale(1.05, 0.95);
    }
  }

  @keyframes timing-shadow {
    0%,
    4%,
    78%,
    100% {
      opacity: 0.38;
      transform: scaleX(1);
      animation-timing-function: var(--ease-out);
    }
    46% {
      opacity: 0.09;
      transform: scaleX(0.34);
      animation-timing-function: var(--ease-in);
    }
    84% {
      opacity: 0.24;
      transform: scaleX(0.7);
    }
  }

  @keyframes direction-travel-forward {
    0% {
      opacity: 1;
      transform: translateX(0);
    }
    45% {
      opacity: 1;
      transform: translateX(var(--track-travel));
    }
    48% {
      opacity: 0;
      transform: translateX(var(--track-travel));
    }
    50% {
      opacity: 0;
      transform: translateX(0);
    }
    52% {
      opacity: 1;
      transform: translateX(0);
    }
    97% {
      opacity: 1;
      transform: translateX(var(--track-travel));
    }
    100% {
      opacity: 0;
      transform: translateX(var(--track-travel));
    }
  }

  @keyframes direction-travel-reverse {
    0% {
      opacity: 1;
      transform: translateX(var(--track-travel));
    }
    45% {
      opacity: 1;
      transform: translateX(0);
    }
    48% {
      opacity: 0;
      transform: translateX(0);
    }
    50% {
      opacity: 0;
      transform: translateX(var(--track-travel));
    }
    52% {
      opacity: 1;
      transform: translateX(var(--track-travel));
    }
    97% {
      opacity: 1;
      transform: translateX(0);
    }
    100% {
      opacity: 0;
      transform: translateX(0);
    }
  }

  @media (max-width: 640px) {
    .concept-model {
      --bounce-rise: 2.35rem;
      --quarter-rest: 1.15rem;
      --ball-size: 0.8rem;
      --track-width: 3.6rem;
      --track-travel: 2.8rem;

      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.45rem;
      height: min(100%, 17.5rem);
      min-height: min(100%, 16rem);
    }

    .concept-panel {
      gap: 0.45rem;
    }

    h3 {
      font-size: 1.25rem;
    }

    .examples {
      gap: 0.35rem;
    }

    .timing-examples {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-rows: repeat(2, minmax(0, 1fr));
    }

    .timing-examples .together {
      grid-column: 1 / -1;
    }

    .direction-examples {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .example-bay {
      gap: 0.3rem;
      padding: 0.45rem 0.35rem;
    }

    .bounce-stage {
      gap: 0.8rem;
      min-height: calc(var(--bounce-rise) + var(--ball-size) + 0.25rem);
    }

    .bounce-stage::after {
      right: 12%;
      left: 12%;
    }

    .travel-stage {
      gap: 0.65rem;
    }
  }

  @media (max-height: 540px) and (min-width: 641px) {
    .concept-model {
      --bounce-rise: 1.45rem;
      --quarter-rest: 0.7rem;
      --ball-size: 0.72rem;
      --track-width: 5rem;
      --track-travel: 4.28rem;

      height: 8rem;
      min-height: 8rem;
      gap: 0.5rem;
    }

    .concept-panel {
      gap: 0.2rem;
    }

    h3 {
      font-size: 1.05rem;
    }

    .examples {
      gap: 0.35rem;
    }

    .example-bay {
      gap: 0.15rem;
      padding: 0.3rem 0.4rem;
    }

    .bounce-stage {
      gap: 0.8rem;
      min-height: calc(var(--bounce-rise) + var(--ball-size) + 0.12rem);
    }

    .travel-stage {
      gap: 0.4rem;
    }
  }

  @media (min-width: 1680px) {
    .concept-model {
      width: min(100%, 82rem);
    }
  }

  @media (min-width: 2600px) {
    .concept-model {
      width: min(100%, 96rem);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ball,
    .ball-shadow,
    .traveler {
      animation: none;
    }

    .split .red .ball {
      transform: translateY(0) scale(1);
    }

    .quarter .red .ball {
      transform: translateY(var(--quarter-rest));
    }

    .split .red .ball-shadow {
      opacity: 0.09;
      transform: scaleX(0.34);
    }

    .quarter .red .ball-shadow {
      opacity: 0.24;
      transform: scaleX(0.7);
    }

    .same .traveler {
      transform: translateX(1.1rem);
    }

    .opposite .blue .traveler {
      transform: translateX(1.1rem);
    }

    .opposite .red .traveler {
      transform: translateX(calc(var(--track-travel) - 1.1rem));
    }
  }
</style>
