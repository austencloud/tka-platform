# TKA Composer

Sequence editor and notation platform for two-handed prop manipulation. Think sheet music, but for flow arts.

TKA (The Kinetic Alphabet) is a notation system built for static props -- staff, fans, clubs, buugeng, and other props you grip directly. Static props can be held at any orientation and moved to any point with controlled rotation, free from gravity. Every previous notation system mapped what gravity makes spinning props do. TKA maps what's possible when gravity isn't a constraint.

Momentum-based props like poi can perform many TKA sequences, but not all of them. The Poi Lab module exists to identify which sequences are poi-legal.

## Stack

- **SvelteKit** with Svelte 5 runes
- **TypeScript** (strict)
- **Firebase** (Firestore, Auth, Storage, Functions)
- **ITI** for dependency injection
- **Vite** for builds
- **Vitest** + **Playwright** for testing

## Getting Started

```bash
npm install
npm run dev
```

Dev server runs on port 5173.

## Modules

| Module | What it does |
|--------|-------------|
| **Create** | Build sequences manually or with the generator |
| **Browse** | Search and explore the sequence library |
| **Learn** | Interactive lessons on TKA concepts |
| **Tika** | AI tutor that teaches TKA through conversation |
| **Compose** | Arrange sequences into longer animations |
| **Watch** | Community video feed |
| **Train** | Camera-based practice with real-time scoring |
| **Write** | Author choreography acts |
| **Choreo Card** | Printable reference cards for sequences |
| **Settings** | Props, backgrounds, visibility, AI preferences |

Admin-only: Lab (experiments), Admin (system config), Moderation (user reports).

## Project Structure

```
src/
  lib/
    features/       # Feature modules (create, browse, learn, etc.)
    shared/         # Shared infrastructure
      di/           # Dependency injection containers
      pictograph/   # Pictograph rendering engine
      animation-engine/
      navigation/
      settings/
      ...
  routes/           # SvelteKit routes
mcp-server/         # TKA domain MCP server (alphabet data, rendering)
firebase-functions/ # Cloud functions
scripts/            # Build and utility scripts
tests/              # Unit and E2E tests
```

## Architecture

Services live in DI containers, not utility files. Every service has an interface (`services/contracts/IName.ts`) and an implementation (`services/implementations/Name.ts`), registered in the appropriate ITI container under `src/lib/shared/di/`.

No barrel exports. Direct imports only.

## Scripts

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run check      # TypeScript + Svelte check
npm test           # Unit tests (Vitest)
npm run test:e2e   # E2E tests (Playwright)
npm run lint       # Prettier + ESLint
```

## License

AGPL-3.0-or-later
