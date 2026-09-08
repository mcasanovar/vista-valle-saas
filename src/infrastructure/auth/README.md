# Administrative authorization

Authorization is server-only. A session is accepted only after the SSR adapter verifies it, its role is `authenticated`, and its normalized email is present in server-only `ADMIN_ALLOWED_EMAILS`. The route-group layout protects `/admin` descendants, while `/admin/login` remains outside the group to avoid a redirect loop. This slice intentionally has no signup or login form.

`supabase/config.toml` disables anonymous and email signup declaratively. `supabase/rls/operational-tables.sql` enables RLS and revokes direct `anon`/`authenticated` privileges for all operational tables. The artifact is applied to the production Supabase project; reapply it after adding operational tables or changing the schema.
