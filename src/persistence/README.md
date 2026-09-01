# Persistence schema

This public schema API is metadata only: importing it does not create a database client, read environment variables, or open a network connection. Lodging intervals use `check_in`/`check_out` PostgreSQL `date` columns and are interpreted as `[check-in, check-out)` in `America/Santiago`. Technical events use `timestamptz`; all CLP amounts are integer columns.

`*_user_id` columns are external Supabase Auth identifiers, deliberately not foreign keys to an application-owned auth table. The initial migration, database constraints, and offline `db:generate`/`db:check` scripts are versioned here; a driver, a live connection, and seed data remain outside this layer.
