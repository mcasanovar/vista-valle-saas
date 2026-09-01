# Test environment

`npm run test:unit`, `npm run test:e2e`, and `npm run build:test` execute through `scripts/with-test-env.mjs`. The wrapper loads only `.env.test.example` after the inherited environment, so its explicit mock values override local or CI credentials. It also requires `VISTA_VALLE_CONFIG_CONTEXT=mock` and `BOOKING_ENABLED=false` before starting a process.

## Opt-in PostgreSQL reservation integration

`npm run test:integration:postgres` is intentionally separate from the mock
suite. Set `VISTA_VALLE_POSTGRES_INTEGRATION_URL` to a disposable, dedicated
PostgreSQL database whose name ends in `_test` or `_integration`, and do not
set `VISTA_VALLE_CONFIG_CONTEXT=mock`. The runner recreates only the `public`
schema in that database by replaying every migration listed in
`drizzle/meta/_journal.json`, in order, executes the reservation integration
suite in Node, then drops that schema. It exits as an
explicit skip when the URL is absent; it never falls back to `DATABASE_URL`.

Do not create or commit `.env.test`; use the tracked example as the sole test source. In CI, the Playwright smoke test starts a fresh local Next server on `127.0.0.1:3000`. Outside CI it safely reuses an already running local server when one exists; otherwise it starts the same mock-configured server. The smoke test asserts that the minimal page makes no third-party requests.
