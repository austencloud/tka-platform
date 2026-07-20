---
name: service-naming
description: Use when creating or renaming service classes, interfaces, or getter functions. Enforces the "name by what it does" convention — never use "Service" suffix.
---

<!-- generated from .claude by scripts/sync-codex-skills.mjs; do not edit directly -->

# Service Naming

**Never use "Service" suffix.** Name services by what they DO.

| Action | Suffix | Example |
|--------|--------|---------|
| Detect/check | `*Detector` | `LOOPDetector` |
| Manage/coordinate | `*Manager` | `TurnManager` |
| Persist/store | `*Persister` | `SequencePersister` |
| Load data | `*Loader` | `OptionLoader` |
| Filter/sort | `*Filter`, `*Sorter` | `BrowseFilter` |
| Validate | `*Validator` | `SequenceValidator` |
| Transform | `*Transformer` | `SequenceTransformer` |
| Analyze/calculate | `*Analyzer`, `*Calculator` | `PositionAnalyzer` |
| Export/import | `*Exporter`, `*Importer` | `SequenceExporter` |
| CRUD operations | `*Repository` | `LibraryRepository` |
| Cache | `*Cache` | `BrowseCache` |
| Orchestrate | `*Orchestrator` | `GenerationOrchestrator` |

Interfaces use `I` prefix: `ISequencePersister`, `ILOOPDetector`.
