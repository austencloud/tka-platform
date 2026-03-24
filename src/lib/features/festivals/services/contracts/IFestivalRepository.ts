import type { Festival } from "../../domain/models/festival";

export interface IFestivalRepository {
  getById(id: string): Promise<Festival | null>;
  create(festival: Omit<Festival, "id">): Promise<string>;
  update(id: string, data: Partial<Festival>): Promise<void>;
  delete(id: string): Promise<void>;
}
