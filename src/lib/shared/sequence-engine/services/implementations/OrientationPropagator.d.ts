/**
 * Orientation Propagator - Adapter over canonical orientation logic
 *
 * Delegates orientation calculation to render/core/calculations/orientation.ts
 * (the single source of truth). Retains propagation logic that chains
 * orientations through a sequence.
 */
import type { IOrientationPropagator, IOrientationCalculator } from "../contracts/IOrientationPropagator";
import type { SequenceStep, SequenceResult, Orientation } from "../../domain/models/SequenceEngineTypes";
/**
 * Standalone orientation calculator that delegates to the canonical implementation.
 */
export declare class OrientationCalculator implements IOrientationCalculator {
    calculateEndOrientation(motionType: string, turns: number | "fl", rotationDirection: string, startLocation: string, endLocation: string, startOrientation: Orientation): Orientation;
}
/**
 * Propagates orientations through a sequence.
 * Each beat's start orientation = previous beat's end orientation.
 */
export declare class OrientationPropagator implements IOrientationPropagator {
    private readonly calculator;
    constructor(calculator: IOrientationCalculator);
    propagateForColor(steps: SequenceStep[], color: "blue" | "red", initialOrientation: Orientation): SequenceStep[];
    recalculateAll(result: SequenceResult): SequenceResult;
}
