import type { TeachingPortfolio } from "../../domain/models/teaching-portfolio";

export interface IWorkshopPortfolioRepository {
  get(userId: string): Promise<TeachingPortfolio | null>;
  set(userId: string, portfolio: TeachingPortfolio): Promise<void>;
}
