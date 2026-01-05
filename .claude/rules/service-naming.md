# Service Naming Convention (CRITICAL)

**Never use the word "Service" in service names.** Use descriptive, verb-based names instead.

This is a core architectural decision. The word "Service" is redundant - everything in the `services/` folder is already a service. Using action-oriented names makes the codebase more readable and intention-revealing.

## Naming Patterns

| If the service does...  | Name it...      | Example                                   |
| ----------------------- | --------------- | ----------------------------------------- |
| Detection/checking      | `*Detector`     | `LOOPDetector`, `ReversalDetector`        |
| Management/coordination | `*Manager`      | `TurnManager`, `CollectionManager`        |
| Configuration           | `*Configurator` | `CardConfigurator`                        |
| Orchestration           | `*Orchestrator` | `GenerationOrchestrator`                  |
| Persistence/storage     | `*Persister`    | `SequencePersister`, `FilterPersister`    |
| Loading data            | `*Loader`       | `SequenceLoader`, `OptionLoader`          |
| Filtering               | `*Filter`       | `OptionFilter`, `DiscoverFilter`          |
| Sorting                 | `*Sorter`       | `OptionSorter`, `DiscoverSorter`          |
| Validation              | `*Validator`    | `SequenceValidator`                       |
| Transformation          | `*Transformer`  | `SequenceTransformer`                     |
| Analysis                | `*Analyzer`     | `SequenceAnalyzer`, `PositionAnalyzer`    |
| Calculation             | `*Calculator`   | `SequenceStatsCalculator`                 |
| Export/conversion       | `*Exporter`     | `SequenceExporter`, `CocoExporter`        |
| Import                  | `*Importer`     | `SequenceImporter`                        |
| Indexing                | `*Indexer`      | `SequenceIndexer`                         |
| Repository/CRUD         | `*Repository`   | `LibraryRepository`, `FeedbackRepository` |
| Playing media           | `*Player`       | `MusicPlayer`                             |
| Recording               | `*Recorder`     | `PerformanceRecorder`                     |
| Tracking                | `*Tracker`      | `SessionTracker`, `ActivityTracker`       |
| Handling events         | `*Handler`      | `DeepLinkSequenceHandler`                 |
| Notifying               | `*Notifier`     | `AdminNotifier`                           |
| Caching                 | `*Cache`        | `DiscoverCache`, `SequenceCache`          |

## Examples

```typescript
// CORRECT - Descriptive, action-oriented names
class LOOPDetector implements ILOOPDetector {}
class SequencePersister implements ISequencePersister {}
class TurnManager implements ITurnManager {}

// WRONG - Redundant "Service" suffix
class LOOPDetectionService implements ILOOPDetectionService {}
class SequencePersistenceService implements ISequencePersistenceService {}
class TurnManagementService implements ITurnManagementService {}
```

## Interface Naming

Interfaces follow the same pattern with `I` prefix:

- `ISequencePersister` (not `ISequencePersistenceService`)
- `ILOOPDetector` (not `ILOOPDetectionService`)

## When Creating New Services

1. Think: "What does this service DO?"
2. Name it after that action: Detector, Manager, Loader, etc.
3. Never append "Service" - it adds no information
