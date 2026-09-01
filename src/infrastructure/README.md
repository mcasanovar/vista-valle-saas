# Infrastructure boundaries

`supabase/browser.ts` only consumes explicit `NEXT_PUBLIC_*` configuration. `supabase/server.ts` and `database/server.ts` are `server-only`; they may never be imported by presentation or client code.

The explicit `mock` context returns deterministic in-memory adapters and the safe administrative fixture. It does not instantiate Supabase clients or create database connections. In `production`, clients are created only by the respective factory; importing a module does not connect or authenticate.

`database/client.ts` builds the production, `postgres-js`-backed Drizzle database only from a `ProductionDatabaseBoundary` (i.e. only under `VISTA_VALLE_CONFIG_CONTEXT=production` with a validated `DATABASE_URL`); importing it never opens a connection, since the underlying driver connects lazily on first query. `database/room-lock.ts` implements the per-room transactional locking and final overlap validation from design.md decision 6 (`SELECT ... FOR UPDATE` on `rooms`, reservation/hold/block re-check, then the caller's insert inside the same transaction) against that client; its persistence-agnostic contract and deterministic mock counterpart live in `src/features/availability/room-lock.ts` (`RoomLockGateway`, `createMockRoomLockGateway`), which is what mock-context tests exercise.

`storage/server.ts` is server-only. Its `room-images` mock uses an isolated in-memory map with no network; its production factory keeps the service-role credential server-side and creates the Storage SDK client only in the explicit production context. The declarative bucket/RLS artifact grants public reads only; application authorization must precede writes in future services.
