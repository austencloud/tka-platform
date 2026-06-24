import { beforeEach, describe, expect, it } from "vitest";
import {
  GridLocation,
  GridPosition,
} from "../../../src/lib/shared/pictograph/grid/domain/enums/grid-enums";
import { GridPositionDeriver } from "$lib/shared/pictograph/grid/services/grid-position-deriver";

describe("GridPositionDeriver", () => {
  let service: GridPositionDeriver;

  beforeEach(() => {
    service = new GridPositionDeriver();
  });

  describe("Alpha Positions - Bidirectional Mapping", () => {
    it("should map ALPHA1: SOUTH,NORTH ↔ alpha1", () => {
      // Position → Locations
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ALPHA1
      );
      expect(blue).toBe(GridLocation.SOUTH);
      expect(red).toBe(GridLocation.NORTH);

      // Locations → Position
      const position = service.getGridPositionFromLocations(
        GridLocation.SOUTH,
        GridLocation.NORTH
      );
      expect(position).toBe(GridPosition.ALPHA1);
    });

    it("should map ALPHA2: SOUTHWEST,NORTHEAST ↔ alpha2", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ALPHA2
      );
      expect(blue).toBe(GridLocation.SOUTHWEST);
      expect(red).toBe(GridLocation.NORTHEAST);

      const position = service.getGridPositionFromLocations(
        GridLocation.SOUTHWEST,
        GridLocation.NORTHEAST
      );
      expect(position).toBe(GridPosition.ALPHA2);
    });

    it("should map ALPHA3: WEST,EAST ↔ alpha3", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ALPHA3
      );
      expect(blue).toBe(GridLocation.WEST);
      expect(red).toBe(GridLocation.EAST);

      const position = service.getGridPositionFromLocations(
        GridLocation.WEST,
        GridLocation.EAST
      );
      expect(position).toBe(GridPosition.ALPHA3);
    });

    it("should map ALPHA4: NORTHWEST,SOUTHEAST ↔ alpha4", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ALPHA4
      );
      expect(blue).toBe(GridLocation.NORTHWEST);
      expect(red).toBe(GridLocation.SOUTHEAST);

      const position = service.getGridPositionFromLocations(
        GridLocation.NORTHWEST,
        GridLocation.SOUTHEAST
      );
      expect(position).toBe(GridPosition.ALPHA4);
    });

    it("should map ALPHA5: NORTH,SOUTH ↔ alpha5", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ALPHA5
      );
      expect(blue).toBe(GridLocation.NORTH);
      expect(red).toBe(GridLocation.SOUTH);

      const position = service.getGridPositionFromLocations(
        GridLocation.NORTH,
        GridLocation.SOUTH
      );
      expect(position).toBe(GridPosition.ALPHA5);
    });

    it("should map ALPHA6: NORTHEAST,SOUTHWEST ↔ alpha6", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ALPHA6
      );
      expect(blue).toBe(GridLocation.NORTHEAST);
      expect(red).toBe(GridLocation.SOUTHWEST);

      const position = service.getGridPositionFromLocations(
        GridLocation.NORTHEAST,
        GridLocation.SOUTHWEST
      );
      expect(position).toBe(GridPosition.ALPHA6);
    });

    it("should map ALPHA7: EAST,WEST ↔ alpha7", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ALPHA7
      );
      expect(blue).toBe(GridLocation.EAST);
      expect(red).toBe(GridLocation.WEST);

      const position = service.getGridPositionFromLocations(
        GridLocation.EAST,
        GridLocation.WEST
      );
      expect(position).toBe(GridPosition.ALPHA7);
    });

    it("should map ALPHA8: SOUTHEAST,NORTHWEST ↔ alpha8", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ALPHA8
      );
      expect(blue).toBe(GridLocation.SOUTHEAST);
      expect(red).toBe(GridLocation.NORTHWEST);

      const position = service.getGridPositionFromLocations(
        GridLocation.SOUTHEAST,
        GridLocation.NORTHWEST
      );
      expect(position).toBe(GridPosition.ALPHA8);
    });
  });

  describe("Beta Positions - Bidirectional Mapping", () => {
    it("should map BETA1: NORTH,NORTH ↔ beta1", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.BETA1
      );
      expect(blue).toBe(GridLocation.NORTH);
      expect(red).toBe(GridLocation.NORTH);

      const position = service.getGridPositionFromLocations(
        GridLocation.NORTH,
        GridLocation.NORTH
      );
      expect(position).toBe(GridPosition.BETA1);
    });

    it("should map BETA2: NORTHEAST,NORTHEAST ↔ beta2", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.BETA2
      );
      expect(blue).toBe(GridLocation.NORTHEAST);
      expect(red).toBe(GridLocation.NORTHEAST);

      const position = service.getGridPositionFromLocations(
        GridLocation.NORTHEAST,
        GridLocation.NORTHEAST
      );
      expect(position).toBe(GridPosition.BETA2);
    });

    it("should map BETA3: EAST,EAST ↔ beta3", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.BETA3
      );
      expect(blue).toBe(GridLocation.EAST);
      expect(red).toBe(GridLocation.EAST);

      const position = service.getGridPositionFromLocations(
        GridLocation.EAST,
        GridLocation.EAST
      );
      expect(position).toBe(GridPosition.BETA3);
    });

    it("should map BETA4: SOUTHEAST,SOUTHEAST ↔ beta4", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.BETA4
      );
      expect(blue).toBe(GridLocation.SOUTHEAST);
      expect(red).toBe(GridLocation.SOUTHEAST);

      const position = service.getGridPositionFromLocations(
        GridLocation.SOUTHEAST,
        GridLocation.SOUTHEAST
      );
      expect(position).toBe(GridPosition.BETA4);
    });

    it("should map BETA5: SOUTH,SOUTH ↔ beta5", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.BETA5
      );
      expect(blue).toBe(GridLocation.SOUTH);
      expect(red).toBe(GridLocation.SOUTH);

      const position = service.getGridPositionFromLocations(
        GridLocation.SOUTH,
        GridLocation.SOUTH
      );
      expect(position).toBe(GridPosition.BETA5);
    });

    it("should map BETA6: SOUTHWEST,SOUTHWEST ↔ beta6", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.BETA6
      );
      expect(blue).toBe(GridLocation.SOUTHWEST);
      expect(red).toBe(GridLocation.SOUTHWEST);

      const position = service.getGridPositionFromLocations(
        GridLocation.SOUTHWEST,
        GridLocation.SOUTHWEST
      );
      expect(position).toBe(GridPosition.BETA6);
    });

    it("should map BETA7: WEST,WEST ↔ beta7", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.BETA7
      );
      expect(blue).toBe(GridLocation.WEST);
      expect(red).toBe(GridLocation.WEST);

      const position = service.getGridPositionFromLocations(
        GridLocation.WEST,
        GridLocation.WEST
      );
      expect(position).toBe(GridPosition.BETA7);
    });

    it("should map BETA8: NORTHWEST,NORTHWEST ↔ beta8", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.BETA8
      );
      expect(blue).toBe(GridLocation.NORTHWEST);
      expect(red).toBe(GridLocation.NORTHWEST);

      const position = service.getGridPositionFromLocations(
        GridLocation.NORTHWEST,
        GridLocation.NORTHWEST
      );
      expect(position).toBe(GridPosition.BETA8);
    });
  });

  describe("Gamma Positions (1-8) - Bidirectional Mapping", () => {
    it("should map GAMMA1: WEST,NORTH ↔ gamma1", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.GAMMA1
      );
      expect(blue).toBe(GridLocation.WEST);
      expect(red).toBe(GridLocation.NORTH);

      const position = service.getGridPositionFromLocations(
        GridLocation.WEST,
        GridLocation.NORTH
      );
      expect(position).toBe(GridPosition.GAMMA1);
    });

    it("should map GAMMA2: NORTHWEST,NORTHEAST ↔ gamma2", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.GAMMA2
      );
      expect(blue).toBe(GridLocation.NORTHWEST);
      expect(red).toBe(GridLocation.NORTHEAST);

      const position = service.getGridPositionFromLocations(
        GridLocation.NORTHWEST,
        GridLocation.NORTHEAST
      );
      expect(position).toBe(GridPosition.GAMMA2);
    });

    it("should map GAMMA3: NORTH,EAST ↔ gamma3", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.GAMMA3
      );
      expect(blue).toBe(GridLocation.NORTH);
      expect(red).toBe(GridLocation.EAST);

      const position = service.getGridPositionFromLocations(
        GridLocation.NORTH,
        GridLocation.EAST
      );
      expect(position).toBe(GridPosition.GAMMA3);
    });

    it("should map GAMMA4: NORTHEAST,SOUTHEAST ↔ gamma4", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.GAMMA4
      );
      expect(blue).toBe(GridLocation.NORTHEAST);
      expect(red).toBe(GridLocation.SOUTHEAST);

      const position = service.getGridPositionFromLocations(
        GridLocation.NORTHEAST,
        GridLocation.SOUTHEAST
      );
      expect(position).toBe(GridPosition.GAMMA4);
    });

    it("should map GAMMA5: EAST,SOUTH ↔ gamma5", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.GAMMA5
      );
      expect(blue).toBe(GridLocation.EAST);
      expect(red).toBe(GridLocation.SOUTH);

      const position = service.getGridPositionFromLocations(
        GridLocation.EAST,
        GridLocation.SOUTH
      );
      expect(position).toBe(GridPosition.GAMMA5);
    });

    it("should map GAMMA6: SOUTHEAST,SOUTHWEST ↔ gamma6", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.GAMMA6
      );
      expect(blue).toBe(GridLocation.SOUTHEAST);
      expect(red).toBe(GridLocation.SOUTHWEST);

      const position = service.getGridPositionFromLocations(
        GridLocation.SOUTHEAST,
        GridLocation.SOUTHWEST
      );
      expect(position).toBe(GridPosition.GAMMA6);
    });

    it("should map GAMMA7: SOUTH,WEST ↔ gamma7", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.GAMMA7
      );
      expect(blue).toBe(GridLocation.SOUTH);
      expect(red).toBe(GridLocation.WEST);

      const position = service.getGridPositionFromLocations(
        GridLocation.SOUTH,
        GridLocation.WEST
      );
      expect(position).toBe(GridPosition.GAMMA7);
    });

    it("should map GAMMA8: SOUTHWEST,NORTHWEST ↔ gamma8", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.GAMMA8
      );
      expect(blue).toBe(GridLocation.SOUTHWEST);
      expect(red).toBe(GridLocation.NORTHWEST);

      const position = service.getGridPositionFromLocations(
        GridLocation.SOUTHWEST,
        GridLocation.NORTHWEST
      );
      expect(position).toBe(GridPosition.GAMMA8);
    });
  });

  describe("Gamma Positions (9-16) - Bidirectional Mapping", () => {
    it("should map GAMMA9: EAST,NORTH ↔ gamma9", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.GAMMA9
      );
      expect(blue).toBe(GridLocation.EAST);
      expect(red).toBe(GridLocation.NORTH);

      const position = service.getGridPositionFromLocations(
        GridLocation.EAST,
        GridLocation.NORTH
      );
      expect(position).toBe(GridPosition.GAMMA9);
    });

    it("should map GAMMA10: SOUTHEAST,NORTHEAST ↔ gamma10", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.GAMMA10
      );
      expect(blue).toBe(GridLocation.SOUTHEAST);
      expect(red).toBe(GridLocation.NORTHEAST);

      const position = service.getGridPositionFromLocations(
        GridLocation.SOUTHEAST,
        GridLocation.NORTHEAST
      );
      expect(position).toBe(GridPosition.GAMMA10);
    });

    it("should map GAMMA11: SOUTH,EAST ↔ gamma11", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.GAMMA11
      );
      expect(blue).toBe(GridLocation.SOUTH);
      expect(red).toBe(GridLocation.EAST);

      const position = service.getGridPositionFromLocations(
        GridLocation.SOUTH,
        GridLocation.EAST
      );
      expect(position).toBe(GridPosition.GAMMA11);
    });

    it("should map GAMMA12: SOUTHWEST,SOUTHEAST ↔ gamma12", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.GAMMA12
      );
      expect(blue).toBe(GridLocation.SOUTHWEST);
      expect(red).toBe(GridLocation.SOUTHEAST);

      const position = service.getGridPositionFromLocations(
        GridLocation.SOUTHWEST,
        GridLocation.SOUTHEAST
      );
      expect(position).toBe(GridPosition.GAMMA12);
    });

    it("should map GAMMA13: WEST,SOUTH ↔ gamma13", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.GAMMA13
      );
      expect(blue).toBe(GridLocation.WEST);
      expect(red).toBe(GridLocation.SOUTH);

      const position = service.getGridPositionFromLocations(
        GridLocation.WEST,
        GridLocation.SOUTH
      );
      expect(position).toBe(GridPosition.GAMMA13);
    });

    it("should map GAMMA14: NORTHWEST,SOUTHWEST ↔ gamma14", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.GAMMA14
      );
      expect(blue).toBe(GridLocation.NORTHWEST);
      expect(red).toBe(GridLocation.SOUTHWEST);

      const position = service.getGridPositionFromLocations(
        GridLocation.NORTHWEST,
        GridLocation.SOUTHWEST
      );
      expect(position).toBe(GridPosition.GAMMA14);
    });

    it("should map GAMMA15: NORTH,WEST ↔ gamma15", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.GAMMA15
      );
      expect(blue).toBe(GridLocation.NORTH);
      expect(red).toBe(GridLocation.WEST);

      const position = service.getGridPositionFromLocations(
        GridLocation.NORTH,
        GridLocation.WEST
      );
      expect(position).toBe(GridPosition.GAMMA15);
    });

    it("should map GAMMA16: NORTHEAST,NORTHWEST ↔ gamma16", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.GAMMA16
      );
      expect(blue).toBe(GridLocation.NORTHEAST);
      expect(red).toBe(GridLocation.NORTHWEST);

      const position = service.getGridPositionFromLocations(
        GridLocation.NORTHEAST,
        GridLocation.NORTHWEST
      );
      expect(position).toBe(GridPosition.GAMMA16);
    });
  });

  describe("Zeta Positions (1-8) - 135° CCW offset", () => {
    it("should map ZETA1: SOUTHWEST,NORTH ↔ zeta1", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ZETA1
      );
      expect(blue).toBe(GridLocation.SOUTHWEST);
      expect(red).toBe(GridLocation.NORTH);

      const position = service.getGridPositionFromLocations(
        GridLocation.SOUTHWEST,
        GridLocation.NORTH
      );
      expect(position).toBe(GridPosition.ZETA1);
    });

    it("should map ZETA2: WEST,NORTHEAST ↔ zeta2", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ZETA2
      );
      expect(blue).toBe(GridLocation.WEST);
      expect(red).toBe(GridLocation.NORTHEAST);

      const position = service.getGridPositionFromLocations(
        GridLocation.WEST,
        GridLocation.NORTHEAST
      );
      expect(position).toBe(GridPosition.ZETA2);
    });

    it("should map ZETA3: NORTHWEST,EAST ↔ zeta3", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ZETA3
      );
      expect(blue).toBe(GridLocation.NORTHWEST);
      expect(red).toBe(GridLocation.EAST);

      const position = service.getGridPositionFromLocations(
        GridLocation.NORTHWEST,
        GridLocation.EAST
      );
      expect(position).toBe(GridPosition.ZETA3);
    });

    it("should map ZETA4: NORTH,SOUTHEAST ↔ zeta4", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ZETA4
      );
      expect(blue).toBe(GridLocation.NORTH);
      expect(red).toBe(GridLocation.SOUTHEAST);

      const position = service.getGridPositionFromLocations(
        GridLocation.NORTH,
        GridLocation.SOUTHEAST
      );
      expect(position).toBe(GridPosition.ZETA4);
    });

    it("should map ZETA5: NORTHEAST,SOUTH ↔ zeta5", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ZETA5
      );
      expect(blue).toBe(GridLocation.NORTHEAST);
      expect(red).toBe(GridLocation.SOUTH);

      const position = service.getGridPositionFromLocations(
        GridLocation.NORTHEAST,
        GridLocation.SOUTH
      );
      expect(position).toBe(GridPosition.ZETA5);
    });

    it("should map ZETA6: EAST,SOUTHWEST ↔ zeta6", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ZETA6
      );
      expect(blue).toBe(GridLocation.EAST);
      expect(red).toBe(GridLocation.SOUTHWEST);

      const position = service.getGridPositionFromLocations(
        GridLocation.EAST,
        GridLocation.SOUTHWEST
      );
      expect(position).toBe(GridPosition.ZETA6);
    });

    it("should map ZETA7: SOUTHEAST,WEST ↔ zeta7", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ZETA7
      );
      expect(blue).toBe(GridLocation.SOUTHEAST);
      expect(red).toBe(GridLocation.WEST);

      const position = service.getGridPositionFromLocations(
        GridLocation.SOUTHEAST,
        GridLocation.WEST
      );
      expect(position).toBe(GridPosition.ZETA7);
    });

    it("should map ZETA8: SOUTH,NORTHWEST ↔ zeta8", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ZETA8
      );
      expect(blue).toBe(GridLocation.SOUTH);
      expect(red).toBe(GridLocation.NORTHWEST);

      const position = service.getGridPositionFromLocations(
        GridLocation.SOUTH,
        GridLocation.NORTHWEST
      );
      expect(position).toBe(GridPosition.ZETA8);
    });
  });

  describe("Zeta Positions (9-16) - 135° CW offset", () => {
    it("should map ZETA9: SOUTHEAST,NORTH ↔ zeta9", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ZETA9
      );
      expect(blue).toBe(GridLocation.SOUTHEAST);
      expect(red).toBe(GridLocation.NORTH);

      const position = service.getGridPositionFromLocations(
        GridLocation.SOUTHEAST,
        GridLocation.NORTH
      );
      expect(position).toBe(GridPosition.ZETA9);
    });

    it("should map ZETA10: SOUTH,NORTHEAST ↔ zeta10", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ZETA10
      );
      expect(blue).toBe(GridLocation.SOUTH);
      expect(red).toBe(GridLocation.NORTHEAST);

      const position = service.getGridPositionFromLocations(
        GridLocation.SOUTH,
        GridLocation.NORTHEAST
      );
      expect(position).toBe(GridPosition.ZETA10);
    });

    it("should map ZETA11: SOUTHWEST,EAST ↔ zeta11", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ZETA11
      );
      expect(blue).toBe(GridLocation.SOUTHWEST);
      expect(red).toBe(GridLocation.EAST);

      const position = service.getGridPositionFromLocations(
        GridLocation.SOUTHWEST,
        GridLocation.EAST
      );
      expect(position).toBe(GridPosition.ZETA11);
    });

    it("should map ZETA12: WEST,SOUTHEAST ↔ zeta12", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ZETA12
      );
      expect(blue).toBe(GridLocation.WEST);
      expect(red).toBe(GridLocation.SOUTHEAST);

      const position = service.getGridPositionFromLocations(
        GridLocation.WEST,
        GridLocation.SOUTHEAST
      );
      expect(position).toBe(GridPosition.ZETA12);
    });

    it("should map ZETA13: NORTHWEST,SOUTH ↔ zeta13", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ZETA13
      );
      expect(blue).toBe(GridLocation.NORTHWEST);
      expect(red).toBe(GridLocation.SOUTH);

      const position = service.getGridPositionFromLocations(
        GridLocation.NORTHWEST,
        GridLocation.SOUTH
      );
      expect(position).toBe(GridPosition.ZETA13);
    });

    it("should map ZETA14: NORTH,SOUTHWEST ↔ zeta14", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ZETA14
      );
      expect(blue).toBe(GridLocation.NORTH);
      expect(red).toBe(GridLocation.SOUTHWEST);

      const position = service.getGridPositionFromLocations(
        GridLocation.NORTH,
        GridLocation.SOUTHWEST
      );
      expect(position).toBe(GridPosition.ZETA14);
    });

    it("should map ZETA15: NORTHEAST,WEST ↔ zeta15", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ZETA15
      );
      expect(blue).toBe(GridLocation.NORTHEAST);
      expect(red).toBe(GridLocation.WEST);

      const position = service.getGridPositionFromLocations(
        GridLocation.NORTHEAST,
        GridLocation.WEST
      );
      expect(position).toBe(GridPosition.ZETA15);
    });

    it("should map ZETA16: EAST,NORTHWEST ↔ zeta16", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ZETA16
      );
      expect(blue).toBe(GridLocation.EAST);
      expect(red).toBe(GridLocation.NORTHWEST);

      const position = service.getGridPositionFromLocations(
        GridLocation.EAST,
        GridLocation.NORTHWEST
      );
      expect(position).toBe(GridPosition.ZETA16);
    });
  });

  describe("Eta Positions (1-8) - 45° CCW offset", () => {
    it("should map ETA1: NORTHWEST,NORTH ↔ eta1", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ETA1
      );
      expect(blue).toBe(GridLocation.NORTHWEST);
      expect(red).toBe(GridLocation.NORTH);

      const position = service.getGridPositionFromLocations(
        GridLocation.NORTHWEST,
        GridLocation.NORTH
      );
      expect(position).toBe(GridPosition.ETA1);
    });

    it("should map ETA2: NORTH,NORTHEAST ↔ eta2", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ETA2
      );
      expect(blue).toBe(GridLocation.NORTH);
      expect(red).toBe(GridLocation.NORTHEAST);

      const position = service.getGridPositionFromLocations(
        GridLocation.NORTH,
        GridLocation.NORTHEAST
      );
      expect(position).toBe(GridPosition.ETA2);
    });

    it("should map ETA3: NORTHEAST,EAST ↔ eta3", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ETA3
      );
      expect(blue).toBe(GridLocation.NORTHEAST);
      expect(red).toBe(GridLocation.EAST);

      const position = service.getGridPositionFromLocations(
        GridLocation.NORTHEAST,
        GridLocation.EAST
      );
      expect(position).toBe(GridPosition.ETA3);
    });

    it("should map ETA4: EAST,SOUTHEAST ↔ eta4", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ETA4
      );
      expect(blue).toBe(GridLocation.EAST);
      expect(red).toBe(GridLocation.SOUTHEAST);

      const position = service.getGridPositionFromLocations(
        GridLocation.EAST,
        GridLocation.SOUTHEAST
      );
      expect(position).toBe(GridPosition.ETA4);
    });

    it("should map ETA5: SOUTHEAST,SOUTH ↔ eta5", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ETA5
      );
      expect(blue).toBe(GridLocation.SOUTHEAST);
      expect(red).toBe(GridLocation.SOUTH);

      const position = service.getGridPositionFromLocations(
        GridLocation.SOUTHEAST,
        GridLocation.SOUTH
      );
      expect(position).toBe(GridPosition.ETA5);
    });

    it("should map ETA6: SOUTH,SOUTHWEST ↔ eta6", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ETA6
      );
      expect(blue).toBe(GridLocation.SOUTH);
      expect(red).toBe(GridLocation.SOUTHWEST);

      const position = service.getGridPositionFromLocations(
        GridLocation.SOUTH,
        GridLocation.SOUTHWEST
      );
      expect(position).toBe(GridPosition.ETA6);
    });

    it("should map ETA7: SOUTHWEST,WEST ↔ eta7", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ETA7
      );
      expect(blue).toBe(GridLocation.SOUTHWEST);
      expect(red).toBe(GridLocation.WEST);

      const position = service.getGridPositionFromLocations(
        GridLocation.SOUTHWEST,
        GridLocation.WEST
      );
      expect(position).toBe(GridPosition.ETA7);
    });

    it("should map ETA8: WEST,NORTHWEST ↔ eta8", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ETA8
      );
      expect(blue).toBe(GridLocation.WEST);
      expect(red).toBe(GridLocation.NORTHWEST);

      const position = service.getGridPositionFromLocations(
        GridLocation.WEST,
        GridLocation.NORTHWEST
      );
      expect(position).toBe(GridPosition.ETA8);
    });
  });

  describe("Eta Positions (9-16) - 45° CW offset", () => {
    it("should map ETA9: NORTHEAST,NORTH ↔ eta9", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ETA9
      );
      expect(blue).toBe(GridLocation.NORTHEAST);
      expect(red).toBe(GridLocation.NORTH);

      const position = service.getGridPositionFromLocations(
        GridLocation.NORTHEAST,
        GridLocation.NORTH
      );
      expect(position).toBe(GridPosition.ETA9);
    });

    it("should map ETA10: EAST,NORTHEAST ↔ eta10", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ETA10
      );
      expect(blue).toBe(GridLocation.EAST);
      expect(red).toBe(GridLocation.NORTHEAST);

      const position = service.getGridPositionFromLocations(
        GridLocation.EAST,
        GridLocation.NORTHEAST
      );
      expect(position).toBe(GridPosition.ETA10);
    });

    it("should map ETA11: SOUTHEAST,EAST ↔ eta11", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ETA11
      );
      expect(blue).toBe(GridLocation.SOUTHEAST);
      expect(red).toBe(GridLocation.EAST);

      const position = service.getGridPositionFromLocations(
        GridLocation.SOUTHEAST,
        GridLocation.EAST
      );
      expect(position).toBe(GridPosition.ETA11);
    });

    it("should map ETA12: SOUTH,SOUTHEAST ↔ eta12", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ETA12
      );
      expect(blue).toBe(GridLocation.SOUTH);
      expect(red).toBe(GridLocation.SOUTHEAST);

      const position = service.getGridPositionFromLocations(
        GridLocation.SOUTH,
        GridLocation.SOUTHEAST
      );
      expect(position).toBe(GridPosition.ETA12);
    });

    it("should map ETA13: SOUTHWEST,SOUTH ↔ eta13", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ETA13
      );
      expect(blue).toBe(GridLocation.SOUTHWEST);
      expect(red).toBe(GridLocation.SOUTH);

      const position = service.getGridPositionFromLocations(
        GridLocation.SOUTHWEST,
        GridLocation.SOUTH
      );
      expect(position).toBe(GridPosition.ETA13);
    });

    it("should map ETA14: WEST,SOUTHWEST ↔ eta14", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ETA14
      );
      expect(blue).toBe(GridLocation.WEST);
      expect(red).toBe(GridLocation.SOUTHWEST);

      const position = service.getGridPositionFromLocations(
        GridLocation.WEST,
        GridLocation.SOUTHWEST
      );
      expect(position).toBe(GridPosition.ETA14);
    });

    it("should map ETA15: NORTHWEST,WEST ↔ eta15", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ETA15
      );
      expect(blue).toBe(GridLocation.NORTHWEST);
      expect(red).toBe(GridLocation.WEST);

      const position = service.getGridPositionFromLocations(
        GridLocation.NORTHWEST,
        GridLocation.WEST
      );
      expect(position).toBe(GridPosition.ETA15);
    });

    it("should map ETA16: NORTH,NORTHWEST ↔ eta16", () => {
      const [blue, red] = service.getGridLocationsFromPosition(
        GridPosition.ETA16
      );
      expect(blue).toBe(GridLocation.NORTH);
      expect(red).toBe(GridLocation.NORTHWEST);

      const position = service.getGridPositionFromLocations(
        GridLocation.NORTH,
        GridLocation.NORTHWEST
      );
      expect(position).toBe(GridPosition.ETA16);
    });
  });

  describe("Error Handling", () => {
    it("should throw error for invalid position in getGridLocationsFromPosition", () => {
      const invalidPosition = "invalid_position" as GridPosition;

      expect(() =>
        service.getGridLocationsFromPosition(invalidPosition)
      ).toThrow("No location pair found for position: invalid_position");
    });

    it("should verify that previously unmapped pairs now map correctly", () => {
      // With zeta and eta positions, these are now valid:
      // (NORTH, NORTHEAST) = ETA2
      expect(
        service.getGridPositionFromLocations(
          GridLocation.NORTH,
          GridLocation.NORTHEAST
        )
      ).toBe(GridPosition.ETA2);

      // (SOUTH, NORTHEAST) = ZETA10
      expect(
        service.getGridPositionFromLocations(
          GridLocation.SOUTH,
          GridLocation.NORTHEAST
        )
      ).toBe(GridPosition.ZETA10);
    });
  });

  describe("Complete Position Coverage", () => {
    it("should have exactly 64 total positions mapped", () => {
      const allPositions = [
        // Alpha (8)
        GridPosition.ALPHA1,
        GridPosition.ALPHA2,
        GridPosition.ALPHA3,
        GridPosition.ALPHA4,
        GridPosition.ALPHA5,
        GridPosition.ALPHA6,
        GridPosition.ALPHA7,
        GridPosition.ALPHA8,
        // Beta (8)
        GridPosition.BETA1,
        GridPosition.BETA2,
        GridPosition.BETA3,
        GridPosition.BETA4,
        GridPosition.BETA5,
        GridPosition.BETA6,
        GridPosition.BETA7,
        GridPosition.BETA8,
        // Gamma (16)
        GridPosition.GAMMA1,
        GridPosition.GAMMA2,
        GridPosition.GAMMA3,
        GridPosition.GAMMA4,
        GridPosition.GAMMA5,
        GridPosition.GAMMA6,
        GridPosition.GAMMA7,
        GridPosition.GAMMA8,
        GridPosition.GAMMA9,
        GridPosition.GAMMA10,
        GridPosition.GAMMA11,
        GridPosition.GAMMA12,
        GridPosition.GAMMA13,
        GridPosition.GAMMA14,
        GridPosition.GAMMA15,
        GridPosition.GAMMA16,
        // Zeta (16)
        GridPosition.ZETA1,
        GridPosition.ZETA2,
        GridPosition.ZETA3,
        GridPosition.ZETA4,
        GridPosition.ZETA5,
        GridPosition.ZETA6,
        GridPosition.ZETA7,
        GridPosition.ZETA8,
        GridPosition.ZETA9,
        GridPosition.ZETA10,
        GridPosition.ZETA11,
        GridPosition.ZETA12,
        GridPosition.ZETA13,
        GridPosition.ZETA14,
        GridPosition.ZETA15,
        GridPosition.ZETA16,
        // Eta (16)
        GridPosition.ETA1,
        GridPosition.ETA2,
        GridPosition.ETA3,
        GridPosition.ETA4,
        GridPosition.ETA5,
        GridPosition.ETA6,
        GridPosition.ETA7,
        GridPosition.ETA8,
        GridPosition.ETA9,
        GridPosition.ETA10,
        GridPosition.ETA11,
        GridPosition.ETA12,
        GridPosition.ETA13,
        GridPosition.ETA14,
        GridPosition.ETA15,
        GridPosition.ETA16,
      ];

      // Verify all positions can be converted to locations and back
      allPositions.forEach((position) => {
        const [blue, red] = service.getGridLocationsFromPosition(position);
        const derivedPosition = service.getGridPositionFromLocations(blue, red);
        expect(derivedPosition).toBe(position);
      });

      expect(allPositions.length).toBe(64);
    });

    it("should maintain bidirectional consistency for all positions", () => {
      // Test that every position → locations → position round-trip works
      // Filter out tau and terra positions which use CENTER location and aren't in the perimeter map
      const positions = Object.values(GridPosition).filter(
        (p) => !p.startsWith("tau") && !p.startsWith("terra")
      );

      positions.forEach((position) => {
        const [blue, red] = service.getGridLocationsFromPosition(position);
        const roundTrip = service.getGridPositionFromLocations(blue, red);
        expect(roundTrip).toBe(position);
      });
    });
  });
});
