import { browser } from '$app/environment';
import type { IWorkshopPortfolioRepository } from './services/contracts/IWorkshopPortfolioRepository';
import { WorkshopPortfolioRepository } from './services/implementations/WorkshopPortfolioRepository';

let instance: IWorkshopPortfolioRepository | null = null;

export function getWorkshopPortfolioRepository(): IWorkshopPortfolioRepository {
	if (!browser) throw new Error('getWorkshopPortfolioRepository() is browser-only');
	return instance ??= new WorkshopPortfolioRepository();
}
