/** Position in 3D space */
export interface Vec3 {
	x: number;
	y: number;
	z: number;
}

/** A single exhibit in the archive */
export interface ArchiveExhibit {
	id: string;
	name: string;
	/** Position of the exhibit in room-local coordinates */
	position: Vec3;
	/** Direction the exhibit faces (normal vector) */
	normal: Vec3;
	/** Interaction radius in meters */
	interactionRadius: number;
}

/** Plaque content displayed when examining an exhibit */
export interface PlaqueContent {
	title: string;
	subtitle: string;
	body: string;
	footer: string;
	/** Optional secondary plaque (academic note, etc.) */
	secondary?: {
		title: string;
		body: string;
	};
}

/** Room definition for the archive */
export interface ArchiveRoom {
	id: string;
	name: string;
	exhibits: ArchiveExhibit[];
}
