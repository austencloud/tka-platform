import { browser } from '$app/environment';
import { WorkshopPortfolioRepository } from './services/implementations/WorkshopPortfolioRepository';

let instance: WorkshopPortfolioRepository | null = null;

export function getWorkshopPortfolioRepository(): WorkshopPortfolioRepository {
	if (!browser) throw new Error('getWorkshopPortfolioRepository() is browser-only');
	return instance ??= new WorkshopPortfolioRepository();
}
