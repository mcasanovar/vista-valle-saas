## Context

See `proposal.md` — Why. Two constraints shape this design:

- `next.config.ts` sets a strict CSP: `img-src 'self' res.cloudinary.com data: blob:` and no `frame-src` (falls back to `default-src 'self'`). Any third-party map host needs an explicit CSP allowance.
- The public header nav was just unified across all public pages behind a single source of truth, `publicNavigationForRoute()` in `src/config/public-site-content.ts`. Nav changes here must go through that function, not per-page overrides.
- The project already has a working pattern for client-only, DOM-dependent libraries that can't render during SSR: `room-photo-gallery.tsx` loads `room-photo-lightbox.tsx` via `next/dynamic(() => import(...), { ssr: false })` from inside a `"use client"` component. The map component follows the same shape.

## Goals / Non-Goals

**Goals:**
- A real, pannable/zoomable map centered on Illapel, rendered with Leaflet + `react-leaflet`, tiles from the public OpenStreetMap raster tile servers — no API key, no account, no billing surface of any kind.
- Two markers with popups: the hostal and the Plaza de Armas.
- A fixed polyline tracing the actual walking route between them, stored as static data — no routing API called at runtime.
- `/ubicacion` reachable from the header nav (all public pages) and from a shrunk teaser on the landing page's existing `#ubicacion` section.
- Clearly-marked placeholder copy for city context and "cómo llegar" / transportation info, matching the project's existing convention for content pending owner approval.

**Non-Goals:**
- No live geocoding or routing calls in production (Nominatim/OSRM were used once, out-of-band, to produce the static coordinates and polyline in `proposal.md` — the running app never calls them).
- No self-hosted tile pipeline (PMTiles/MapLibre). Live OSM raster tiles are accepted for this traffic profile; revisit only if OSM's tile usage policy becomes a real constraint.
- No admin UI for editing the map's coordinates/route — they live in `public-site-content.ts` as static config, same as the rest of the site's placeholder content, and are edited via code changes.
- No fix for the pre-existing, unrelated `#servicios` footer-nav link (points at a section that doesn't exist) — out of scope for this change.
- No real city/transportation copy — placeholder text only, owner replaces later.

## Decisions

**Map library: Leaflet + react-leaflet, not MapLibre/PMTiles or a Google Maps iframe.**
Explored three tiers (see prior conversation): a Google Maps iframe embed (fastest, but not self-drawn, and opens `frame-src` to a third party for something we can't fully control); MapLibre + a self-hosted PMTiles extract (zero external runtime dependency, best long-term robustness, but requires generating and hosting a vector tile extract before any of this can ship); and Leaflet + live OSM raster tiles (real interactivity, standard well-documented stack, smallest setup cost, only a CSP `img-src` change). Chose Leaflet for the effort/interactivity balance appropriate to a low-traffic hostal site. MapLibre+PMTiles remains the natural upgrade path later if OSM tile load ever becomes a concern.

**Tiles served live from OpenStreetMap's public tile servers, not self-hosted.**
Requires adding the OSM tile subdomains to `next.config.ts`'s CSP `img-src` (Leaflet requests tiles as plain `<img>` elements, so `connect-src` is untouched). Must keep Leaflet's default attribution control enabled (OSM's tile usage policy requires "© OpenStreetMap contributors" attribution) and keep the map's own tile request volume light (small area, sane max zoom) to stay within OSM's fair-use policy — a small hostal site's traffic is well within that.

**Map rendering is a client-only component, dynamically imported with `ssr: false`.**
Leaflet touches `window`/DOM APIs unavailable during SSR. Mirrors the existing `room-photo-gallery.tsx` → `room-photo-lightbox.tsx` pattern: a `"use client"` wrapper organism that `next/dynamic`-imports the actual Leaflet map component.

**Coordinates and route are static config, not computed at request time.**
`public-site-content.ts`'s existing `location` block gains hard-coded values: hostal position, Plaza de Armas position, and the route as an array of `[lat, lng]` pairs (the 49-point walking path from `proposal.md`, sourced once via OSRM's public demo server and frozen into config — that demo endpoint is never called by the running app). This keeps the page's data flow identical to the rest of the site's static public content — no new runtime dependency, no new failure mode.

**Nav: change the single canonical entry, not per-page overrides.**
`publicSiteContent.navigation`'s `{ href: "#ubicacion", label: "Ubicación" }` becomes `{ href: "/ubicacion", label: "Ubicación" }`. Because `/ubicacion` doesn't start with `#`, `publicNavigationForRoute()`'s existing anchor-rewrite logic (`#x` → `/#x` off the home page) leaves it untouched everywhere — the same absolute path renders correctly on every public page, home included. The footer navigation's separate `#ubicacion` entry (`public-site-content.ts` footer block) is updated the same way for consistency, since it's the same logical link.

**Homepage `#ubicacion` section becomes a teaser, keeps its anchor id.**
Section id stays `ubicacion` (in case anything external still links `#ubicacion`), but its content shrinks to the existing panoramic photo + a short blurb + a "Ver mapa y cómo llegar" button pointing at `/ubicacion`, instead of duplicating the full map inline on the landing page.

## Risks / Trade-offs

- **[Risk] OpenStreetMap's tile usage policy is a fair-use policy, not a contract** → could rate-limit or block if traffic spikes unexpectedly. *Mitigation*: traffic profile is a small hostal site; if it ever becomes a real concern, the upgrade path is self-hosted PMTiles (already scoped out as a non-goal here, not a rewrite).
- **[Risk] The hostal's exact pin is an approximation** — OSM has no house-number-level data for "Flor de Mayo #55"; the coordinate used is the nearest matching street segment, not a confirmed house-front pin. → *Mitigation*: ship with the approximation, flag it clearly in `tasks.md` for the owner to confirm/adjust by dropping a real pin later; it's a one-line config change.
- **[Risk] CSP loosening for `img-src`** — adds a third-party host to a previously self+Cloudinary-only allowlist. → *Mitigation*: scoped narrowly to the OSM tile subdomains only, no wildcard beyond that; no `connect-src` or `script-src` change needed since Leaflet's tile requests are plain images.
- **[Trade-off] Static route polyline** won't reflect real-world street changes (a new road, a closure) — but for a small town this is effectively permanent, and avoids a live routing dependency; can be regenerated the same way (a one-off OSRM lookup) if it ever needs updating.

## Migration Plan

No data migration. Additive: new route, new config block, one CSP entry, one nav entry change, one homepage section trimmed. Rollback is a revert of the same commit(s) — nothing else in the app depends on `/ubicacion` existing.
