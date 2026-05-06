import { MandalaGeometryCalculator } from "$lib/shared/mandala/services/implementations/MandalaGeometryCalculator";
import {
  MANDALA_GRID_RADIUS,
  ENGINE_GRID_RADIUS,
  DEFAULT_TIP_INSET_PX,
} from "$lib/shared/mandala/domain/mandala-constants";
import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";
const FP_SIZE = 32;
const fpCenter = FP_SIZE / 2;
const fpTipReach =
  ((ENGINE_GRID_RADIUS - DEFAULT_TIP_INSET_PX) * MANDALA_GRID_RADIUS) / ENGINE_GRID_RADIUS;
const fpMaxExtent = MANDALA_GRID_RADIUS + fpTipReach;
const fpScale = fpCenter / (fpMaxExtent * 1.05);

const fpCanvas = new OffscreenCanvas(FP_SIZE, FP_SIZE);
const fpCtx = fpCanvas.getContext("2d")!;

function shapeFingerprint(paths: MandalaPaths): string {
  fpCtx.clearRect(0, 0, FP_SIZE, FP_SIZE);
  fpCtx.save();
  fpCtx.translate(fpCenter, fpCenter);
  fpCtx.scale(fpScale, fpScale);
  fpCtx.strokeStyle = "white";
  fpCtx.lineWidth = 3;
  fpCtx.lineCap = "round";
  for (const p of paths.blue) {
    fpCtx.stroke(new Path2D(p.d));
  }
  for (const p of paths.red) {
    fpCtx.stroke(new Path2D(p.d));
  }
  fpCtx.restore();

  const data = fpCtx.getImageData(0, 0, FP_SIZE, FP_SIZE).data;
  let hash = "";
  for (let i = 3; i < data.length; i += 16) {
    hash += data[i]! > 40 ? "1" : "0";
  }
  return hash;
}

export interface ProcessDeckMessage {
  type: "process-deck";
  deckId: string;
  deckName: string;
  loopType: string;
  sequences: Array<{
    id: string;
    word: string | undefined;
    steps: unknown[];
  }>;
}

export interface ResultEntry {
  id: string;
  word: string;
  deckId: string;
  deckName: string;
  loopType: string;
  fingerprint: string;
  isNewShape: boolean;
  paths?: MandalaPaths;
}

export interface DeckResultMessage {
  type: "deck-result";
  deckId: string;
  entries: ResultEntry[];
  sequenceCount: number;
}

export type WorkerInMessage = ProcessDeckMessage;
export type WorkerOutMessage = DeckResultMessage;

const calc = new MandalaGeometryCalculator();
const knownFingerprints = new Set<string>();

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;
  if (msg.type === "process-deck") {
    const entries: ResultEntry[] = [];

    for (const seq of msg.sequences) {
      if (!seq.steps || seq.steps.length === 0) continue;
      const paths = calc.calculate(
        seq.steps as Parameters<MandalaGeometryCalculator["calculate"]>[0],
        "staff",
        "staff",
      );
      const fp = shapeFingerprint(paths);
      const isNew = !knownFingerprints.has(fp);
      if (isNew) knownFingerprints.add(fp);

      entries.push({
        id: seq.id,
        word: seq.word ?? seq.id,
        deckId: msg.deckId,
        deckName: msg.deckName,
        loopType: msg.loopType,
        fingerprint: fp,
        isNewShape: isNew,
        paths: isNew ? paths : undefined,
      });
    }

    const result: DeckResultMessage = {
      type: "deck-result",
      deckId: msg.deckId,
      entries,
      sequenceCount: msg.sequences.length,
    };
    self.postMessage(result);
  }
};
