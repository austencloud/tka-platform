import { browser } from '$app/environment';
import type { IFestivalAttendanceRepository } from './services/contracts/IFestivalAttendanceRepository';
import { FestivalAttendanceRepository } from './services/implementations/FestivalAttendanceRepository';

let instance: IFestivalAttendanceRepository | null = null;

export function getFestivalAttendanceRepository(): IFestivalAttendanceRepository {
	if (!browser) throw new Error('getFestivalAttendanceRepository() is browser-only');
	return instance ??= new FestivalAttendanceRepository();
}
