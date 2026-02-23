# Dead Code Detection

Full workflow is in the `/deadcode` skill (loads on demand).

Start with: `npx -p @austencloud/code-quality ac-deadcode --auto-claim`

Key rule: always get user confirmation before deleting. Never delete DI containers, route files, or anything the user says to keep.
