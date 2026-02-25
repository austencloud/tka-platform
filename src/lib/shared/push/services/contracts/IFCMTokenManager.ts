export interface IFCMTokenManager {
	registerToken(userId: string): Promise<string | null>;
	unregisterToken(userId: string): Promise<void>;
	isSupported(): Promise<boolean>;
	getPermissionState(): NotificationPermission;
	requestPermission(): Promise<NotificationPermission>;
}
