import { browser } from '$app/environment';
import { FestivalAttendanceRepository } from './services/implementations/FestivalAttendanceRepository';

let instance: FestivalAttendanceRepository | null = null;

export function getFestivalAttendanceRepository(): FestivalAttendanceRepository {
	if (!browser) throw new Error('getFestivalAttendanceRepository() is browser-only');
	return instance ??= new FestivalAttendanceRepository();
}
