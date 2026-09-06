import type { PropState } from "$lib/shared/foundation/domain/types/prop-state";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

export interface StudioAnimationFrame {
  sequence: SequenceData;
  position: number;
  playing: boolean;
  left: PropState | null;
  right: PropState | null;
  step: SequenceData["steps"][number] | SequenceData["startPosition"] | null;
  leftPropType?: PropType;
  rightPropType?: PropType;
}

interface CanvasDestination {
  owner: object;
  target: HTMLElement;
  frame: () => StudioAnimationFrame;
}

export interface StudioControls {
  playing: boolean;
  bpm: number;
  propType: PropType;
  toggle: () => void;
  setBpm: (value: number) => void;
  setProp: (value: PropType) => void;
}

export function createViewerStudioSurfaces() {
  let active = $state(false);
  let canvas = $state.raw<HTMLElement | null>(null);
  let inspector = $state.raw<HTMLElement | null>(null);
  let destinations = $state.raw<CanvasDestination[]>([]);
  let inspectorTarget = $state.raw<HTMLElement | null>(null);
  let moving = $state(false);
  let controls = $state.raw<(() => StudioControls) | null>(null);
  let entry = $state({ position: 0, playing: false, bpm: 60, revision: 0 });
  return {
    get active() {
      return active;
    },
    get entry() {
      return entry;
    },
    get canvasAvailable() {
      return canvas !== null;
    },
    get inspectorAvailable() {
      return inspector !== null;
    },
    get canvasTarget() {
      return active ? (destinations[0]?.target ?? null) : null;
    },
    get frame() {
      return active ? (destinations[0]?.frame() ?? null) : null;
    },
    get inspectorTarget() {
      return active ? inspectorTarget : null;
    },
    get moving() {
      return moving;
    },
    get controls() {
      return active ? (controls?.() ?? null) : null;
    },
    setControls(getControls: () => StudioControls) {
      controls = getControls;
      return () => {
        if (controls === getControls) controls = null;
      };
    },
    setMoving(value: boolean) {
      moving = value;
    },
    enter(position: number, playing: boolean, bpm: number) {
      entry = { position, playing, bpm, revision: entry.revision + 1 };
      active = true;
    },
    leave() {
      active = false;
    },
    registerCanvas(node: HTMLElement) {
      canvas = node;
      return () => {
        if (canvas === node) canvas = null;
      };
    },
    registerInspector(node: HTMLElement) {
      inspector = node;
      return () => {
        if (inspector === node) inspector = null;
      };
    },
    requestCanvas(
      owner: object,
      target: HTMLElement,
      frame: () => StudioAnimationFrame
    ) {
      destinations = [
        ...destinations.filter((d) => d.owner !== owner),
        { owner, target, frame },
      ];
      return () => {
        destinations = destinations.filter((d) => d.owner !== owner);
      };
    },
    ownsCanvas(owner: object) {
      return canvas !== null && destinations[0]?.owner === owner;
    },
    requestInspector(target: HTMLElement) {
      inspectorTarget = target;
      return () => {
        if (inspectorTarget === target) inspectorTarget = null;
      };
    },
  };
}
export type ViewerStudioSurfaces = ReturnType<
  typeof createViewerStudioSurfaces
>;
