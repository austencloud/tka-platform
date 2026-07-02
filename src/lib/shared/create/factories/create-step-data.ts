/**
 * Re-export of the canonical StepData factory.
 *
 * This file used to hold a near-duplicate implementation; the foundation
 * factory (which placeholder-fills missing hands for the both-required
 * canonical Step shape) is the single source of truth.
 */
export {
  createStepData,
  type CreateStepDataInput,
} from "$lib/shared/foundation/domain/factories/create-step-data";
