import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

export interface CatdogCombo {
  bluePropType: PropType;
  redPropType: PropType;
}

export interface PropPreferences {
  propsISpinWith: PropType[];
  favoriteProp: PropType | null;
  favoriteCatdog: CatdogCombo | null;
}

export interface IPropPreferencePersister {
  load(userId: string): Promise<PropPreferences>;
  save(userId: string, prefs: PropPreferences): Promise<void>;
  addProp(userId: string, prop: PropType): Promise<void>;
  removeProp(userId: string, prop: PropType): Promise<void>;
  setFavorite(userId: string, prop: PropType): Promise<void>;
  setCatdogFavorite(userId: string, combo: CatdogCombo | null): Promise<void>;
}
