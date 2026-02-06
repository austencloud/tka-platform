import { LetterType } from "../../../../foundation/domain/models/LetterType";

export const LETTER_TYPE_COLORS = {
  [LetterType.TYPE1]: ["#36c3ff", "#6F2DA8"], // Dual-Shift: Cyan, Purple
  [LetterType.TYPE2]: ["#6F2DA8", "#6F2DA8"], // Shift: Purple, Purple
  [LetterType.TYPE3]: ["#26e600", "#6F2DA8"], // Cross-Shift: Green, Purple
  [LetterType.TYPE4]: ["#26e600", "#26e600"], // Dash: Green, Green
  [LetterType.TYPE5]: ["#00b3ff", "#26e600"], // Dual-Dash: Blue, Green
  [LetterType.TYPE6]: ["#eb7d00", "#eb7d00"], // Static: Orange, Orange
} as const;
