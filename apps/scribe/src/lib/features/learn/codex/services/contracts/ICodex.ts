import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";

export interface ICodex {
  loadAllPictographs(): Promise<PictographData[]>;

  searchPictographs(searchTerm: string): Promise<PictographData[]>;

  getPictographByLetter(letter: string): Promise<PictographData | null>;

  getAllPictographsForLetter(letter: string): Promise<PictographData[]>;

  getPictographsForLesson(lessonType: string): Promise<PictographData[]>;

  getLettersByRow(): Promise<string[][]>;

  rotateAllPictographs(
    pictographs: PictographData[]
  ): Promise<PictographData[]>;

  mirrorAllPictographs(
    pictographs: PictographData[]
  ): Promise<PictographData[]>;

  colorSwapAllPictographs(
    pictographs: PictographData[]
  ): Promise<PictographData[]>;

  getAllPictographData(): Promise<Record<string, PictographData | null>>;
}
