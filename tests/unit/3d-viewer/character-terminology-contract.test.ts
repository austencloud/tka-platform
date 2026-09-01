import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

describe("3D character terminology contract", () => {
  it("keeps scene-3d's avatar vocabulary behind the character model boundary", () => {
    const boundary = read("src/lib/shared/3d/domain/character-model.ts");
    const productState = read(
      "src/lib/shared/3d/state/character-instance-state.svelte.ts"
    );

    expect(boundary).toContain('from "@austencloud/scene-3d"');
    expect(boundary).toContain("export type CharacterId = AvatarId");
    expect(productState).not.toMatch(/\bavatar(?:Id|State)?\b/i);
    expect(productState).toContain("characterId");
  });

  it("writes Director v4 with characterId while retaining an explicit legacy migration", () => {
    const schema = read(
      "src/routes/test/film-director/_lib/film-director-schema.ts"
    );
    const migration = read(
      "src/routes/test/film-director/_lib/normalize-film-director-input.ts"
    );

    expect(schema).toContain("FILM_DIRECTOR_SCHEMA_VERSION_4 = 4");
    expect(schema).toContain("characterId:");
    expect(schema).not.toContain("avatarId:");
    expect(migration).toContain('"avatarId"');
    expect(migration).toContain('"characterId"');
  });
});
