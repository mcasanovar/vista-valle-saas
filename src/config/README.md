# Environment configuration

`public.ts` exposes only validated `NEXT_PUBLIC_*` values. `server.ts` is marked `server-only` and contains every secret or operational setting. `NEXT_PUBLIC_VISTA_VALLE_CONFIG_CONTEXT` and `VISTA_VALLE_CONFIG_CONTEXT` must both be `mock` or `production` and must match; this lets browser factories select the same safe adapter without exposing server configuration.

The root server layout calls `validateRuntimeEnvironment()` so build and server rendering fail before application work begins when required configuration is invalid. CI must provide the same non-secret-shaped test variable set used by the build; there is no validation bypass.

`.env.example` is intentionally copyable as `.env.local`: it contains syntactically valid, non-commercial mock values and sets `VISTA_VALLE_CONFIG_CONTEXT=mock`. This explicit context is the only way mock-marked values are accepted for local work or CI builds. In the default `production` context, `mock`, `REPLACE_WITH`, `YOUR_`, and `.test` values are rejected for credentials, the public Supabase endpoint, site URL, and administrative recipient; errors report affected key names only. Real production configuration must use non-mock credentials and production endpoints/recipients, and omit the mock context.
