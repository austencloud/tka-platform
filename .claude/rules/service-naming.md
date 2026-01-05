# Service Naming Convention

**Never use "Service" suffix.** Name services by what they DO.

## Pattern

| Action | Suffix | Example |
|--------|--------|---------|
| Detect/check | `*Detector` | `LOOPDetector` |
| Manage/coordinate | `*Manager` | `TurnManager` |
| Persist/store | `*Persister` | `SequencePersister` |
| Load data | `*Loader` | `OptionLoader` |
| Filter/sort | `*Filter`, `*Sorter` | `DiscoverFilter` |
| Validate | `*Validator` | `SequenceValidator` |
| Transform | `*Transformer` | `SequenceTransformer` |
| Analyze/calculate | `*Analyzer`, `*Calculator` | `PositionAnalyzer` |
| Export/import | `*Exporter`, `*Importer` | `SequenceExporter` |
| CRUD operations | `*Repository` | `LibraryRepository` |
| Cache | `*Cache` | `DiscoverCache` |
| Orchestrate | `*Orchestrator` | `GenerationOrchestrator` |

Interfaces use `I` prefix: `ISequencePersister`, `ILOOPDetector`
