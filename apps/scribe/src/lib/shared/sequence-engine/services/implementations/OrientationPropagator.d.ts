/**
 * Orientation Propagator Implementation
 *
 * Handles propagation of prop orientations through a sequence.
 * Includes orientation calculation based on motion parameters.
 */
import type { IOrientationPropagator, IOrientationCalculator } from "../contracts/IOrientationPropagator";
import type { SequenceStep, SequenceResult, Orientation } from "../../domain/models/SequenceEngineTypes";
/**
 * Calculate end orientation from motion data.
 */
export declare function calculateEndOrientation(motionType: string, turns: number | "fl" | undefined, rotationDirection: string | undefined, startLocation: string, endLocation: string, startOrientation?: Orientation): Orientation;
/**
 * Standalone orientation calculator service.
 */
export declare class OrientationCalculator implements IOrientationCalculator {
    calculateEndOrientation(motionType: string, turns: number | "fl", rotationDirection: string, startLocation: string, endLocation: string, startOrientation: Orientation): Orientation;
}
/**
 * Propagates orientations through a sequence.
 */
export declare class OrientationPropagator implements IOrientationPropagator {
    private readonly calculator;
    constructor(calculator: IOrientationCalculator);
    propagateForColor(steps: SequenceStep[], color: "blue" | "red", initialOrientation: Orientation): SequenceStep[];
    recalculateAll(result: SequenceResult): SequenceResult;
}
