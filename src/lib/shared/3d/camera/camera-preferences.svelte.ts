import { createCameraPreferences, CameraMode } from "@austencloud/camera-3d";

const DESTINATION_DEFAULTS: Record<string, CameraMode> = {
	stage: CameraMode.ORBIT,
	gallery: CameraMode.THIRD_PERSON,
	realm: CameraMode.ORBIT,
};

export const cameraPreferences = createCameraPreferences("tka-camera-preferences", DESTINATION_DEFAULTS);
