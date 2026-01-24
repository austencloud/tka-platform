# DI Migration Command

Migrate services away from dependency injection to direct singleton exports.

## Quick Start

```bash
node scripts/migrate-di.cjs --auto-claim
```

This atomically claims the next container to migrate and shows its status.

---

## Workflow

1. **Run the command** - Claims a container and shows migration status
2. **Migrate services** - Add direct exports, update consumers
3. **Mark progress** - Track which services are migrated
4. **Complete container** - When all services migrated, delete the container

---

## Why We're Doing This

The ITI dependency injection system causes:
- **5+ second HMR delays** during development
- **Unnecessary complexity** for a solo project
- **Indirection tax** making debugging harder
- **Circular dependency hell** requiring careful container layering

The fix: Direct singleton exports from service files.

---

## Migration Steps Per Service

### Step 1: Add direct export to service file

```typescript
// At bottom of ServiceName.ts

// Dependencies (import from their direct exports)
import { dep1 } from '../other/Dep1';
import { dep2 } from '../other/Dep2';

// Direct singleton export
export const serviceName = new ServiceName(dep1, dep2);
```

### Step 2: Update all consumers

```typescript
// Before
import { container } from "$lib/shared/di";
const svc = container.items.serviceName;

// After
import { serviceName } from "$lib/path/to/ServiceName";
```

### Step 3: Mark as migrated

```bash
node scripts/migrate-di.cjs --mark-migrated <container> <serviceName>
```

### Step 4: When container is empty, delete it

```bash
node scripts/migrate-di.cjs --complete <container>
```

---

## Commands Reference

```bash
# View status
node scripts/migrate-di.cjs                     # Show all containers and progress
node scripts/migrate-di.cjs --status            # Same as above
node scripts/migrate-di.cjs --status <container> # Detailed status for one container

# Claiming (multi-agent coordination)
node scripts/migrate-di.cjs --auto-claim        # Claim next available container
node scripts/migrate-di.cjs --claim <container> # Claim specific container
node scripts/migrate-di.cjs --release <container> # Release claim
node scripts/migrate-di.cjs --claims            # Show active claims

# Progress tracking
node scripts/migrate-di.cjs --mark-migrated <container> <service>  # Mark service done
node scripts/migrate-di.cjs --unmark <container> <service>         # Undo mark
node scripts/migrate-di.cjs --complete <container>                 # Mark container done

# Maintenance
node scripts/migrate-di.cjs --clear-expired     # Clear stale claims
node scripts/migrate-di.cjs --scan              # Re-scan containers for services
```

---

## Dependency Order

Migrate leaf services first (no dependencies), then work up the tree.

Example for pictograph:
1. `GridPositionDeriver` (no deps)
2. `StartPositionDeriver` (depends on GridPositionDeriver)
3. Services that depend on StartPositionDeriver

The script tracks dependencies and suggests migration order.

---

## After Claiming

1. **Read the container file** to understand what services remain
2. **Pick a leaf service** (one with no unmigrated dependencies)
3. **Add direct export** at bottom of service file
4. **Find consumers** with grep: `grep -r "container.items.serviceName" src/`
5. **Update each consumer** to use direct import
6. **Run TypeScript check**: `npm run check`
7. **Mark as migrated**: `node scripts/migrate-di.cjs --mark-migrated <container> <service>`
8. **Repeat** until container is empty
9. **Delete container** and update di/index.ts

---

## Verification

After migrating services:

```bash
npm run check   # No TypeScript errors
npm run build   # Build succeeds
```

Test HMR by editing a migrated service - should be instant, not 5 seconds.
