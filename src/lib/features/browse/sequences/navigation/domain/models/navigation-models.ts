import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface ExploreNavigationItem {
  id: string;
  label: string;
  value: string | number;
  count: number;
  isActive: boolean;
  sequences: SequenceData[];
}

export interface ExploreNavigationConfig {
  id: string;
  title: string;
  type: "date" | "length" | "letter" | "level" | "author" | "favorites";
  items: ExploreNavigationItem[];
  isExpanded: boolean;
  totalCount: number;
}
