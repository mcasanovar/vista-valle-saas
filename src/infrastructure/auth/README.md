# Administrative authorization

Authorization is server-only. A session is accepted only after the SSR adapter verifies it, its role is `authenticated`, its normalized email is present in server-only `ADMIN_ALLOWED_EMAILS`, **and** its user id is present in `ADMIN_ALLOWED_USER_IDS` — both allowlists must match the same session (`isAdministrativeSession`). The route-group layout protects `/admin` descendants, while `/admin/login` remains outside the group to avoid a redirect loop. This slice intentionally has no signup or login form.

The `authenticated` role by itself is **not** an authorization signal — every account with a valid session has it, including one created by anyone who signs up with an allowlisted email before the real owner does. The user id allowlist is the barrier against exactly that: an allowlisted email with no account yet is a claimable administrative identity until someone registers it, and only a user id already on `ADMIN_ALLOWED_USER_IDS` can ever pass authorization, regardless of which email that account later uses. Get a user's id from the Supabase dashboard (Authentication → Users → "User UID"), not from anything the client supplies.

`supabase/config.toml` disables anonymous and email signup declaratively. `supabase/rls/operational-tables.sql` enables RLS and revokes direct `anon`/`authenticated` privileges for all operational tables. The artifact is applied to the production Supabase project; reapply it after adding operational tables or changing the schema.

**That RLS artifact is not a second authorization layer for this application.** It protects direct access through Supabase's public `anon`/`authenticated` keys only. The application itself reaches Postgres through a direct connection (`DATABASE_URL`) under a role that is not `anon` or `authenticated`, so it is not subject to those policies — the session/allowlist checks on this page are the only control on that path, whether or not the connection's role also happens to bypass RLS (`rolbypassrls`; see task 10.4). Don't reason about a request as if RLS were a backstop behind a bug in `requireAdministrator()` or `isAdministrativeSession()` — there isn't one.

## Login rate limiting does not protect the identity provider's own endpoint

`POST /api/admin/auth/login` applies `getSharedAdminLoginRequestLimiter()` (`src/infrastructure/security/request-limiter.ts`) by client address and by the submitted email before contacting Supabase, and every rejection — rate-limited or not — returns the identical generic message. **This limiter does not protect password guessing against the identity provider directly.** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are published in the browser bundle by design (`src/config/public.ts`), so anyone can call Supabase's own auth endpoint directly, bypassing this application and its rate limiter entirely. The durable control against that is the identity provider's own configuration: its login attempt limits, password policy, leaked-password protection, and a second factor required on the administrative account (see "Owner actions" below).

The limiter itself is process-local (in-memory), which does not hold across a multi-instance deployment on its own. The control that actually holds across instances is **Vercel's platform firewall rate limiting**, configured on `/api/admin/auth/login` in the Vercel dashboard (not in this repository) — the in-memory limiter is a defense-in-depth layer on top of it, not the primary control.

## Owner actions (outside this repository)

- Rotate the administrative account's password and require a second factor for it in the Supabase dashboard.
- Confirm Supabase's own login attempt limits, password policy, and leaked-password protection for administrative accounts.
- Configure the Vercel firewall rate-limiting rule on `/api/admin/auth/login`.
