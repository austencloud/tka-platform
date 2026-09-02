import { describe, expect, it } from "vitest";
import {
  isHeldPanel,
  needsMeasuredBasisHandoff,
  panelFlexStyle,
  resolvePanelFlex,
} from "$lib/shared/panels/panel-flex";

/**
 * The stacked viewer dock as the shell declares it: the performances gallery
 * hands PanelGroup a measured length, and every other stacked inspector hands
 * it `auto` so the dock can size to its contents.
 */
const performancesDock = { preferredSize: "var(--performance-inspector-height)" };
const contentSizedDock = { preferredSize: "auto" };

describe("resolvePanelFlex", () => {
  it("holds a panel that declares a fixed or preferred size", () => {
    expect(resolvePanelFlex({ fixedSize: "0px" }, {})).toEqual({
      grow: 0,
      shrink: 0,
      basis: "0px",
    });
    expect(resolvePanelFlex(performancesDock, {})).toEqual({
      grow: 0,
      shrink: 0,
      basis: "var(--performance-inspector-height)",
    });
  });

  it("returns a panel to its flex share once the user has sized it", () => {
    const flex = resolvePanelFlex(performancesDock, {
      flexShare: 2,
      manuallySized: true,
    });
    expect(flex).toEqual({ grow: 2, shrink: 1, basis: "0px" });
    expect(isHeldPanel(flex)).toBe(false);
  });

  it("prefers a fixed size over a preferred one", () => {
    expect(
      resolvePanelFlex(
        { fixedSize: "0px", preferredSize: "480px" },
        { manuallySized: true }
      ).basis
    ).toBe("0px");
  });

  it("writes the style PanelGroup puts on the wrapper", () => {
    expect(panelFlexStyle({ grow: 0, shrink: 0, basis: "auto" })).toBe(
      "flex-grow: 0; flex-shrink: 0; flex-basis: auto"
    );
  });
});

describe("needsMeasuredBasisHandoff", () => {
  it("takes over the dock swap that CSS cannot interpolate", () => {
    // Performances -> Card. Both ends are held, so the basis carries the whole
    // size and `480px -> auto` would otherwise re-lay out the group in one
    // frame, dropping the collapsed Card column below the viewport.
    const performances = resolvePanelFlex(performancesDock, {});
    const card = resolvePanelFlex(contentSizedDock, {});
    expect(needsMeasuredBasisHandoff(performances, card)).toBe(true);
    expect(needsMeasuredBasisHandoff(card, performances)).toBe(true);
  });

  it("takes over a held collapse to an explicit length", () => {
    expect(
      needsMeasuredBasisHandoff(
        resolvePanelFlex({ preferredSize: "480px" }, {}),
        resolvePanelFlex({ fixedSize: "0px" }, {})
      )
    ).toBe(true);
  });

  it("leaves an unchanged basis alone", () => {
    const dock = resolvePanelFlex(contentSizedDock, {});
    expect(needsMeasuredBasisHandoff(dock, { ...dock })).toBe(false);
  });

  it("leaves a panel with a live flex share to its declared grow transition", () => {
    const held = resolvePanelFlex(performancesDock, {});
    const shared = resolvePanelFlex(performancesDock, {
      flexShare: 1,
      manuallySized: true,
    });
    expect(needsMeasuredBasisHandoff(held, shared)).toBe(false);
    expect(needsMeasuredBasisHandoff(shared, held)).toBe(false);
  });

  it("leaves a drag between two flex shares alone", () => {
    expect(
      needsMeasuredBasisHandoff(
        { grow: 1, shrink: 1, basis: "0px" },
        { grow: 2, shrink: 1, basis: "0px" }
      )
    ).toBe(false);
  });
});
