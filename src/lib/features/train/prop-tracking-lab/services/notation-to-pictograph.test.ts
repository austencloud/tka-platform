import { describe, it, expect } from 'vitest';
import { notationToPictographData } from './notation-to-pictograph';
import { MotionType, RotationDirection, Orientation } from '$lib/shared/pictograph/shared/domain/enums/pictograph-enums';
import { GridLocation, GridMode } from '$lib/shared/pictograph/grid/domain/enums/grid-enums';
import type { StaffMotionNotation } from '../domain/notation-3d';

function note(over: Partial<StaffMotionNotation>): StaffMotionNotation {
  return {
    staff: 'blue',
    startLocation: 'n',
    endLocation: 'e',
    handMotion: 'shift',
    motionType: MotionType.PRO,
    rotationDirection: RotationDirection.NO_ROTATION,
    turns: 0,
    startOrientation: Orientation.OUT,
    endOrientation: Orientation.OUT,
    confidence: 1,
    ...over,
  };
}

describe('notationToPictographData', () => {
  it('builds blue+red motions with mapped enums and locations', () => {
    const blue = note({ staff: 'blue', startLocation: 'n', endLocation: 'e' });
    const red = note({ staff: 'red', startLocation: 's', endLocation: 'w', motionType: MotionType.ANTI });
    const pd = notationToPictographData(blue, red, 'beat-1');

    expect(pd.id).toBe('beat-1');
    expect(pd.motions.blue!.motionType).toBe(MotionType.PRO);
    expect(pd.motions.blue!.startLocation).toBe(GridLocation.NORTH);
    expect(pd.motions.blue!.endLocation).toBe(GridLocation.EAST);
    expect(pd.motions.red!.motionType).toBe(MotionType.ANTI);
    expect(pd.motions.red!.startLocation).toBe(GridLocation.SOUTH);
  });

  it('derives diamond grid mode for cardinal locations', () => {
    const pd = notationToPictographData(
      note({ startLocation: 'n', endLocation: 'e' }),
      note({ staff: 'red', startLocation: 's', endLocation: 'w' }),
      'b',
    );
    expect(pd.gridMode).toBe(GridMode.DIAMOND);
  });

  it('derives box grid mode for intercardinal locations', () => {
    const pd = notationToPictographData(
      note({ startLocation: 'ne', endLocation: 'se' }),
      note({ staff: 'red', startLocation: 'sw', endLocation: 'nw' }),
      'b',
    );
    expect(pd.gridMode).toBe(GridMode.BOX);
  });

  it('float maps to turns "fl"', () => {
    const pd = notationToPictographData(
      note({ motionType: MotionType.FLOAT, turns: 0 }),
      note({ staff: 'red' }),
      'b',
    );
    expect(pd.motions.blue!.turns).toBe('fl');
  });
});
