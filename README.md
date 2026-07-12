# Flow Arts Composer

Sequence editor and notation platform for two-handed prop manipulation. Think sheet music, but for flow arts.

**[tkaflowarts.com](https://tkaflowarts.com)**

TKA (The Kinetic Alphabet) is a notation system built for static props — staff, fans, clubs, buugeng, and other props you grip directly. Static props can be held at any orientation and moved to any point with controlled rotation, free from gravity. Every previous notation system mapped what gravity makes spinning props do. TKA maps what's possible when gravity isn't a constraint.

## Stack

| Layer | Tech |
|-------|------|
| App framework | SvelteKit + Svelte 5 runes, TypeScript (strict) |
| 3D | Threlte (Three.js), post-processing, Rapier physics |
| Backend | Firebase (Firestore, Auth, Storage, Functions) |
| Native | Capacitor (iOS + Android) |
| Rendering | Canvas 2D pictograph pipeline, WebGL trail overlays |
| Domain engine | 13 internal packages under `packages/` |
| AI | MCP servers (domain knowledge, game controller, Tika tutor) |
| i18n | 11 languages (ar, de, en, es, fr, it, ja, ko, pt, ru, zh) |
| Testing | Vitest (unit), Playwright (E2E) |
| Build | Vite, feature flags per module |

## Monorepo Structure

```
src/                          # Composer application (Elastic License 2.0)
  lib/
    features/                 # 25+ feature modules
    shared/                   # Shared services, animation engine, 3D, auth, etc.
  routes/                     # SvelteKit routes

packages/                     # Internal packages (most MIT-licensed)
  domain/                     # @tka/domain — letter types, positions, glossary
  sequence-engine/            # @tka/sequence-engine — beam-search builder, LOOP detection
  render-core/                # @tka/render-core — prop placement, arrow calculation
  render-composition/         # @tka/render-composition — card layout, headers, footers
  tka-types/                  # @tka/tka-types — shared type definitions
  vtg-domain/                 # @vtg/domain — per-hand (VTG) learning model
  flow-arts-core/             # @flow-arts/core — cross-system primitives
  9square-domain/             # @9square/domain
  caps-domain/                # @caps/domain
  spin-science-domain/        # @spin-science/domain
  mcp-tika-talk/              # Tika AI tutor MCP server
  mcp-game-controller/        # Game controller MCP server
  feedback-types/             # Shared feedback type definitions

mcp-server/                   # Flow Arts Knowledge MCP server
firebase-functions/           # Cloud Functions
messages/                     # i18n translation files
scripts/                      # Build and utility scripts
tests/                        # Unit and E2E tests
```

## Modules

| Module | What it does |
|--------|-------------|
| **Create** | Build sequences manually or with the constrained generator |
| **Browse** | Search and explore the public sequence library |

<details>
<summary><strong>In Development</strong> — 20+ additional modules not yet public</summary>

| Module | What it does |
|--------|-------------|
| **Learn** | Interactive lessons and drills on TKA concepts |
| **Tika** | AI tutor that teaches TKA through conversation |
| **Compose** | Arrange sequences into longer choreographies, export video |
| **Choreo Cards** | Printable reference cards with pictographs and metadata |
| **Watch** | Community video feed |
| **Arena** | Head-to-head sequence voting |
| **Train** | Camera-based practice with real-time scoring |
| **Write** | Author choreography acts |
| **Social** | Community map and nearby spinner sync |
| **Levels** | Position labs (L4–L7) and poi constraint validation |
| **Hand Paths** | Browse and build spatial hand paths |
| **Video** | Video analysis, trail extraction, notation overlay |
| **Museum** | Walkable archive — 2D museum with 3D flip mode |
| **Archive** | 40,000 years of kinetic history |
| **Retro** | 1989 DOS terminal, 1995 Win95 desktop, pictograph timeline |
| **Festivals** | Discover and apply to flow festivals |
| **Settings** | Props, backgrounds, visibility, AI preferences |

Admin-only: Lab (experiments), Admin (system config), Moderation (user reports).

</details>

## Architecture

Services use a factory-getter pattern — each service has a `get<Name>.ts` file that lazily creates and caches the singleton. No DI container. No barrel exports. Direct imports only.

Domain packages under `packages/` encode the notation system: letter type classification, position algebra, transition graphs, and the constrained beam-search sequence builder. These are MIT-licensed and designed to be consumed independently of the Composer app.

The MCP server (`mcp-server/`) exposes domain knowledge — alphabet data, sequence generation, pictograph rendering — as tool calls for AI assistants.

The 3D viewer (Threlte/Three.js) renders avatar animation with 16 tip effects, physics-driven props, and indoor scene navigation.

## Scripts

```bash
npm run dev        # Start dev server (port 5173)
npm run build      # Production build
npm run check      # TypeScript + Svelte check
npm test           # Unit tests (Vitest)
npm run test:e2e   # E2E tests (Playwright)
npm run lint       # Prettier + ESLint
```

## License

Mixed licensing. Foundation and engine packages are MIT. The Composer application and MCP servers are Elastic License 2.0. Sequence datasets (53,000+) are CC BY-SA 4.0. See [LICENSE](LICENSE) for full details.
