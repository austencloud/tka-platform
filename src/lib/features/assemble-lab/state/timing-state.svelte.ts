import type { CaptureMode, InterpretMode, TimedStepRecord } from "../services/timing-interpreter";
import { computeDurations } from "../services/timing-interpreter";

/**
 * Public shape of the timing capture/playback state. Declared explicitly so the
 * API surface consumed by components stays stable under refactors.
 */
export interface TimingState {
  readonly records: TimedStepRecord[];
  readonly captureMode: CaptureMode;
  readonly interpretMode: InterpretMode;
  readonly bpm: number;
  readonly subdivision: 4 | 8 | 16;
  readonly durations: number[];
  readonly hasTimingData: boolean;
  readonly isReRecording: boolean;
  readonly reRecordIndex: number;

  recordKeydown(): void;
  recordKeyup(): void;
  startReRecord(totalSteps: number): void;
  advanceReRecord(): boolean;
  finishReRecord(): void;
  clearTiming(): void;
  setCaptureMode(mode: CaptureMode): void;
  setInterpretMode(mode: InterpretMode): void;
  setBpm(value: number): void;
  setSubdivision(value: 4 | 8 | 16): void;
}

export function createTimingState(): TimingState {
  let records = $state<TimedStepRecord[]>([]);
  let captureMode = $state<CaptureMode>("inter-press");
  let interpretMode = $state<InterpretMode>("proportional");
  let bpm = $state(120);
  let subdivision = $state<4 | 8 | 16>(8);
  let isReRecording = $state(false);
  let reRecordIndex = $state(0);

  const durations = $derived(computeDurations(records, captureMode, interpretMode, bpm, subdivision));
  const hasTimingData = $derived(records.length > 0);

  function recordKeydown(): void {
    const now = performance.now();
    records = [...records, { keydownTimestamp: now, keyupTimestamp: now }];
  }

  function recordKeyup(): void {
    if (captureMode !== "hold-duration" || records.length === 0) return;
    const now = performance.now();
    const last = records[records.length - 1]!;
    records = [...records.slice(0, -1), { ...last, keyupTimestamp: now }];
  }

  function startReRecord(_totalSteps: number): void {
    records = [];
    isReRecording = true;
    reRecordIndex = 0;
  }

  function advanceReRecord(): boolean {
    reRecordIndex++;
    return true;
  }

  function finishReRecord(): void {
    isReRecording = false;
    reRecordIndex = 0;
  }

  function clearTiming(): void {
    records = [];
    isReRecording = false;
    reRecordIndex = 0;
  }

  function setCaptureMode(mode: CaptureMode): void {
    captureMode = mode;
  }

  function setInterpretMode(mode: InterpretMode): void {
    interpretMode = mode;
  }

  function setBpm(value: number): void {
    bpm = Math.max(40, Math.min(300, value));
  }

  function setSubdivision(value: 4 | 8 | 16): void {
    subdivision = value;
  }

  return {
    get records() { return records; },
    get captureMode() { return captureMode; },
    get interpretMode() { return interpretMode; },
    get bpm() { return bpm; },
    get subdivision() { return subdivision; },
    get durations() { return durations; },
    get hasTimingData() { return hasTimingData; },
    get isReRecording() { return isReRecording; },
    get reRecordIndex() { return reRecordIndex; },

    recordKeydown,
    recordKeyup,
    startReRecord,
    advanceReRecord,
    finishReRecord,
    clearTiming,
    setCaptureMode,
    setInterpretMode,
    setBpm,
    setSubdivision,
  };
}
