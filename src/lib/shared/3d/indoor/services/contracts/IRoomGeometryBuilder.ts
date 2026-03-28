import type { RoomDefinition, SolvedRoom } from "../../domain/room-types";

export interface IRoomGeometryBuilder {
	build(definition: RoomDefinition): SolvedRoom;
}
