import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateModuleContext } from "$lib/features/create/shared/context/create-module-context";
import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import ButtonPanel from "./ButtonPanel.svelte";

vi.mock("$lib/shared/mobile/share-action.svelte", () => ({
  shareTarget: {
    get isMobile() {
      return true;
    },
  },
}));

vi.mock("$lib/shared/navigation/state/navigation-state.svelte", () => ({
  navigationState: {
    activeTab: "construct",
  },
}));

vi.mock("$lib/shared/application/get-haptic-feedback", () => ({
  getHapticFeedback: () => null,
}));

vi.mock("$lib/shared/share/get-sharer", () => ({
  getSharer: () => ({
    getCardImageBlob: vi.fn().mockResolvedValue(
      new Blob(["card"], {
        type: "image/png",
      })
    ),
    generateFilename: vi.fn(() => "sequence.png"),
  }),
}));

vi.mock("$lib/shared/share/state/image-composition-state.svelte", () => ({
  getImageCompositionManager: () => ({
    darkMode: true,
    registerObserver: vi.fn(),
    unregisterObserver: vi.fn(),
  }),
}));

vi.mock("$lib/shared/pictograph/shared/state/visibility-state.svelte", () => ({
  getVisibilityStateManager: () => ({
    registerObserver: vi.fn(),
    unregisterObserver: vi.fn(),
  }),
}));

vi.mock("$lib/shared/qr/get-short-code-manager", () => ({
  getShortCodeManager: () => ({
    createShortCode: vi.fn().mockResolvedValue({
      url: "https://tka.run/A",
    }),
  }),
}));

const sequence = createSequenceData({
  id: "toolbar-geometry",
  word: "A",
  name: "A",
  steps: [createStepData({ letter: "A" })],
});

type ButtonPanelCreateModuleStateFixture = Pick<
  CreateModuleContext["CreateModuleState"],
  | "canShowActionButtons"
  | "canShowSequenceActionsButton"
  | "canClearSequence"
  | "canUndo"
  | "canRedo"
  | "undoHistory"
  | "undo"
  | "redo"
  | "assembleTabState"
> & {
  getActiveTabSequenceState: () => {
    currentSequence: typeof sequence;
  };
};

type ButtonPanelContextFixture = {
  CreateModuleState: ButtonPanelCreateModuleStateFixture;
  constructTutorialState: Pick<
    CreateModuleContext["constructTutorialState"],
    "isActive" | "stage" | "recordFullPlay"
  >;
  panelState: Pick<
    CreateModuleContext["panelState"],
    "isExportPanelOpen" | "openSequenceActionsPanel"
  >;
  layout: Pick<CreateModuleContext["layout"], "shouldUseSideBySideLayout">;
};

function createContext(): ButtonPanelContextFixture {
  return {
    CreateModuleState: {
      canShowActionButtons: () => true,
      canShowSequenceActionsButton: () => true,
      canClearSequence: () => true,
      getActiveTabSequenceState: () => ({ currentSequence: sequence }),
      canUndo: false,
      canRedo: false,
      undoHistory: [],
      undo: () => false,
      redo: () => false,
      assembleTabState: null,
    },
    constructTutorialState: {
      isActive: false,
      stage: "play-sequence",
      recordFullPlay: vi.fn(),
    },
    panelState: {
      isExportPanelOpen: false,
      openSequenceActionsPanel: vi.fn(),
    },
    layout: {
      shouldUseSideBySideLayout: false,
    },
  } satisfies ButtonPanelContextFixture;
}

function rect(name: string): DOMRect {
  return (
    page.getByRole("button", { name, exact: true }).element() as HTMLElement
  ).getBoundingClientRect();
}

beforeEach(() => {
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(navigator, "canShare", {
    configurable: true,
    value: vi.fn(() => true),
  });
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "share");
  Reflect.deleteProperty(navigator, "canShare");
});

describe("ButtonPanel narrow geometry", () => {
  it("keeps five controls in one centered row at 320 CSS pixels", async () => {
    const screen = render(ButtonPanel, {
      props: {
        onClearSequence: vi.fn(),
        onViewSequence: vi.fn(),
      },
      context: new Map([["createModule", createContext()]]),
    });
    screen.container.style.width = "320px";

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    const containerBounds = screen.container.getBoundingClientRect();
    const play = rect("Play sequence");
    const buttons = [
      rect("Nothing to Undo"),
      rect("Clear sequence"),
      play,
      rect("Sequence actions"),
      rect("Share sequence"),
    ];

    expect(play.width).toBe(50);
    expect(play.left + play.width / 2).toBeCloseTo(
      containerBounds.left + containerBounds.width / 2,
      0
    );

    for (const button of buttons) {
      expect(button.width).toBeGreaterThanOrEqual(44);
      expect(button.height).toBeGreaterThanOrEqual(44);
      expect(button.left).toBeGreaterThanOrEqual(containerBounds.left);
      expect(button.right).toBeLessThanOrEqual(containerBounds.right);
      expect(button.top + button.height / 2).toBeCloseTo(
        play.top + play.height / 2,
        0
      );
    }

    const orderedButtons = [...buttons].sort((a, b) => a.left - b.left);
    for (let index = 1; index < orderedButtons.length; index++) {
      const previousButton = orderedButtons[index - 1];
      const currentButton = orderedButtons[index];

      expect(previousButton).toBeDefined();
      expect(currentButton).toBeDefined();

      if (previousButton && currentButton) {
        expect(previousButton.right).toBeLessThanOrEqual(currentButton.left);
      }
    }
  });
});
