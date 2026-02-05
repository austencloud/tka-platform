import type { MotionData, MotionEndpoints } from "@tka/types";
import { MotionType, RotationDirection } from "@tka/types";
import type { IAngleCalculator } from "../contracts/IAngleCalculator";
import type { IEndpointCalculator } from "../contracts/IEndpointCalculator";
import type { IMotionCalculator } from "../contracts/IMotionCalculator";
import { PI } from "../domain/math-constants";

export class EndpointCalculator implements IEndpointCalculator {
  constructor(
    private angleCalculator: IAngleCalculator,
    private motionCalculator: IMotionCalculator
  ) {}

  calculateMotionEndpoints(motionData: MotionData): MotionEndpoints {
    const {
      startLocation,
      endLocation,
      startOrientation,
      endOrientation,
      motionType,
      rotationDirection,
      turns = 0,
    } = motionData;

    const normalizedTurns = typeof turns === "number" ? turns : 0;

    const startCenterAngle =
      this.angleCalculator.mapPositionToAngle(startLocation);
    const startStaffAngle = this.angleCalculator.mapOrientationToAngle(
      startOrientation,
      startCenterAngle
    );
    const targetCenterAngle =
      this.angleCalculator.mapPositionToAngle(endLocation);

    let calculatedTargetStaffAngle: number;
    let calculatedStaffRotationDelta: number;

    switch (motionType) {
      case MotionType.PRO: {
        const centerMovement = this.angleCalculator.normalizeAngleSigned(
          targetCenterAngle - startCenterAngle
        );
        const dir =
          rotationDirection === RotationDirection.COUNTER_CLOCKWISE ? -1 : 1;
        const propRotation = dir * normalizedTurns * PI;
        const staffMovement = centerMovement;
        calculatedStaffRotationDelta = staffMovement + propRotation;

        calculatedTargetStaffAngle =
          this.motionCalculator.calculateProTargetAngle(
            startCenterAngle,
            targetCenterAngle,
            startStaffAngle,
            normalizedTurns,
            rotationDirection
          );
        break;
      }
      case MotionType.ANTI: {
        const centerMovement = this.angleCalculator.normalizeAngleSigned(
          targetCenterAngle - startCenterAngle
        );
        const dir =
          rotationDirection === RotationDirection.COUNTER_CLOCKWISE ? -1 : 1;
        const propRotation = dir * normalizedTurns * PI;
        const staffMovement = -centerMovement;
        calculatedStaffRotationDelta = staffMovement + propRotation;

        calculatedTargetStaffAngle =
          this.motionCalculator.calculateAntispinTargetAngle(
            startCenterAngle,
            targetCenterAngle,
            startStaffAngle,
            normalizedTurns,
            rotationDirection
          );
        break;
      }
      case MotionType.STATIC: {
        const baseTargetAngle = this.motionCalculator.calculateStaticStaffAngle(
          startStaffAngle,
          endOrientation,
          targetCenterAngle
        );

        if (
          normalizedTurns > 0 &&
          rotationDirection !== RotationDirection.NO_ROTATION
        ) {
          const dir =
            rotationDirection === RotationDirection.COUNTER_CLOCKWISE ? -1 : 1;
          calculatedStaffRotationDelta = dir * normalizedTurns * PI;
          calculatedTargetStaffAngle =
            this.angleCalculator.normalizeAnglePositive(
              startStaffAngle + calculatedStaffRotationDelta
            );
        } else {
          calculatedTargetStaffAngle = baseTargetAngle;
          calculatedStaffRotationDelta =
            this.angleCalculator.normalizeAngleSigned(
              calculatedTargetStaffAngle - startStaffAngle
            );
        }
        break;
      }
      case MotionType.DASH: {
        calculatedTargetStaffAngle =
          this.motionCalculator.calculateDashTargetAngle(
            startStaffAngle,
            endOrientation,
            targetCenterAngle,
            normalizedTurns,
            rotationDirection
          );

        if (normalizedTurns > 0) {
          const dir =
            rotationDirection === RotationDirection.COUNTER_CLOCKWISE ? -1 : 1;
          calculatedStaffRotationDelta = dir * normalizedTurns * PI;
        } else {
          const baseAngle = this.motionCalculator.calculateDashTargetAngle(
            startStaffAngle,
            endOrientation,
            targetCenterAngle,
            0,
            rotationDirection
          );
          calculatedStaffRotationDelta =
            this.angleCalculator.normalizeAngleSigned(
              baseAngle - startStaffAngle
            );
        }
        break;
      }
      case MotionType.FLOAT: {
        calculatedTargetStaffAngle =
          this.motionCalculator.calculateFloatStaffAngle(startStaffAngle);
        calculatedStaffRotationDelta = 0;
        break;
      }
      default: {
        calculatedTargetStaffAngle = startStaffAngle;
        calculatedStaffRotationDelta = 0;
        break;
      }
    }

    return {
      startCenterAngle,
      startStaffAngle,
      targetCenterAngle,
      targetStaffAngle: calculatedTargetStaffAngle,
      staffRotationDelta: calculatedStaffRotationDelta,
      rotationDirection,
    };
  }

  calculateEndpointStaffAngle(motionData: MotionData): number {
    const endpoints = this.calculateMotionEndpoints(motionData);
    return endpoints.targetStaffAngle;
  }
}
