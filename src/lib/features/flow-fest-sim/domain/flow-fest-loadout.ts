/**
 * What the player decides before the car leaves the driveway.
 *
 * Sub-project 0 of the arrival arc is the loadout economy; this module is its
 * data model and the slice of it that has consequences today: who you are,
 * what you drive, and when you leave. The budget and the car's cargo volume
 * are the two caps. What the roadmap lists beyond that (veteran status,
 * props) rides along as data with no control on screen until something in
 * the sim reads it.
 *
 * Every number here is authored, not surveyed. The savings and ticket price
 * are placeholders for the weekend economy; the departure clocks are the
 * sim's own Thursday timeline against the roadmap's May 14 sunset of 8:44 PM.
 */
import type { CharacterId } from "../../../shared/3d/domain/character-model";
import {
  flowFestParkedCarModel,
  flowFestParkedCarPaintCount,
  FLOW_FEST_PARKED_CAR_MODELS,
} from "../../../../routes/test/flow-fest-sim/flow-fest-parked-car-catalog";
import { FLOW_FEST_CAR_CONFIG, flowFestCarSpec } from "./flow-fest-car";
import { FLOW_FEST_EUC_CONFIG } from "./flow-fest-electric-unicycle";

export type FlowFestDeparture = "early" | "midday" | "late";

/** The lighting profile the drive arrives into; the night profiles come later. */
export type FlowFestArrivalMoment = "afternoon" | "golden-hour";

export interface FlowFestDepartureProfile {
  id: FlowFestDeparture;
  label: string;
  detail: string;
  /** Clock at the moment the car reaches the west edge of the square. */
  clockLabel: string;
  arrivalMoment: FlowFestArrivalMoment;
  startingEnergyPercent: number;
  gateQueueCars: number;
  daylightLeftMinutes: number;
}

const SUNSET_MINUTES = 20 * 60 + 44;

function arrival(hour: number, minute: number): {
  clockLabel: string;
  daylightLeftMinutes: number;
} {
  const twelveHour = hour > 12 ? hour - 12 : hour;
  return {
    clockLabel: `THU · ${twelveHour}:${String(minute).padStart(2, "0")} PM`,
    daylightLeftMinutes: SUNSET_MINUTES - (hour * 60 + minute),
  };
}

export const FLOW_FEST_DEPARTURES: readonly FlowFestDepartureProfile[] =
  Object.freeze([
    {
      id: "early",
      label: "Early",
      detail:
        "Up before the sun. You roll in with the gate empty and most of the afternoon ahead, running on less sleep.",
      ...arrival(15, 5),
      arrivalMoment: "afternoon",
      startingEnergyPercent: 70,
      gateQueueCars: 0,
    },
    {
      id: "midday",
      label: "Midday",
      detail:
        "A civilised morning. One car ahead of you at the gate and four hours of light to set up in.",
      ...arrival(16, 37),
      arrivalMoment: "afternoon",
      startingEnergyPercent: 85,
      gateQueueCars: 1,
    },
    {
      id: "late",
      label: "Late",
      detail:
        "Sleep in and leave after lunch. Golden hour on the way down, three cars queued, and under an hour of daylight to pitch a tent.",
      ...arrival(19, 48),
      arrivalMoment: "golden-hour",
      startingEnergyPercent: 95,
      gateQueueCars: 3,
    },
  ]);

export function flowFestDepartureProfile(
  departure: FlowFestDeparture
): FlowFestDepartureProfile {
  const profile = FLOW_FEST_DEPARTURES.find((entry) => entry.id === departure);
  if (!profile) throw new Error(`Unknown Flow Fest departure: ${departure}`);
  return profile;
}

export function flowFestDaylightLeftLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} min of daylight`;
  return `${hours} h ${String(remainder).padStart(2, "0")} min of daylight`;
}

/** Authored placeholders until the weekend economy owns real prices. */
export const FLOW_FEST_LOADOUT_ECONOMY = Object.freeze({
  savingsUsd: 4800,
  ticketUsd: 320,
});

export interface FlowFestBudget {
  savingsUsd: number;
  ticketUsd: number;
  carUsd: number;
  remainingUsd: number;
}

export function flowFestBudgetFor(carModelId: string): FlowFestBudget {
  const carUsd = flowFestCarSpec(carModelId).priceUsd;
  const { savingsUsd, ticketUsd } = FLOW_FEST_LOADOUT_ECONOMY;
  return {
    savingsUsd,
    ticketUsd,
    carUsd,
    remainingUsd: savingsUsd - ticketUsd - carUsd,
  };
}

export function canAffordFlowFestCar(carModelId: string): boolean {
  return flowFestBudgetFor(carModelId).remainingUsd >= 0;
}

/**
 * The wheel is the only cargo with a consequence today: it rides in the car
 * and comes out behind it at the gate, so the car has to have room for it.
 */
export const FLOW_FEST_LOADOUT_CARGO_LITRES =
  FLOW_FEST_CAR_CONFIG.electricUnicycleCargoLitres;

export function flowFestCargoFits(carModelId: string): boolean {
  return flowFestCarSpec(carModelId).cargoLitres >= FLOW_FEST_LOADOUT_CARGO_LITRES;
}

export interface FlowFestLoadout {
  characterId: CharacterId;
  carModelId: string;
  paintIndex: number;
  departure: FlowFestDeparture;
  /** Data only until a consequence exists; no control shows it. */
  veteran: boolean;
  /** Data only until props are cargo geometry; no control shows it. */
  props: readonly string[];
}

export function createFlowFestDefaultLoadout(): FlowFestLoadout {
  return {
    characterId: FLOW_FEST_EUC_CONFIG.riderAvatarId,
    carModelId: "ace-hatchback",
    paintIndex: 0,
    departure: "midday",
    veteran: false,
    props: [],
  };
}

export function isFlowFestLoadoutDrivable(loadout: FlowFestLoadout): boolean {
  return (
    canAffordFlowFestCar(loadout.carModelId) &&
    flowFestCargoFits(loadout.carModelId)
  );
}

export function restoreFlowFestLoadout(value: unknown): FlowFestLoadout | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.characterId !== "string" ||
    candidate.characterId.length === 0 ||
    typeof candidate.carModelId !== "string" ||
    !FLOW_FEST_PARKED_CAR_MODELS.some(
      (model) => model.id === candidate.carModelId
    ) ||
    typeof candidate.paintIndex !== "number" ||
    !Number.isInteger(candidate.paintIndex) ||
    candidate.paintIndex < 0 ||
    candidate.paintIndex >=
      flowFestParkedCarPaintCount(
        flowFestParkedCarModel(candidate.carModelId)
      ) ||
    !FLOW_FEST_DEPARTURES.some((entry) => entry.id === candidate.departure) ||
    typeof candidate.veteran !== "boolean" ||
    !Array.isArray(candidate.props) ||
    !candidate.props.every((prop) => typeof prop === "string")
  ) {
    return null;
  }
  return {
    characterId: candidate.characterId as CharacterId,
    carModelId: candidate.carModelId,
    paintIndex: candidate.paintIndex,
    departure: candidate.departure as FlowFestDeparture,
    veteran: candidate.veteran,
    props: [...(candidate.props as string[])],
  };
}

/** Authored; the weekend economy will tune it against the rest of Thursday. */
export const FLOW_FEST_DRIVING_ENERGY_DRAIN_PERCENT_PER_MINUTE = 3;

export function flowFestDrivingEnergyDrainPercent(seconds: number): number {
  return (FLOW_FEST_DRIVING_ENERGY_DRAIN_PERCENT_PER_MINUTE * seconds) / 60;
}
