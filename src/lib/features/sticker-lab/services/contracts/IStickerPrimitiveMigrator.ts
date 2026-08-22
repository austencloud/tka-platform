import type { MandalaPrimitiveRef } from "../../domain/sticker-types";

export interface IStickerPrimitiveMigrator {
  resolveGeometryIdentity(
    ref: MandalaPrimitiveRef
  ): Promise<MandalaPrimitiveRef | null>;
}
