## Why

The public site has no real way for a prospective guest to understand where the hostal actually is. The only geographic reference today is a text address in the footer; the landing page's `#ubicacion` section is a static panoramic photo with a "Reservar ahora" button, no map, no streets, no route. Guests arriving in Illapel for the first time need to see the town, orient themselves against a known landmark (Plaza de Armas), and understand how to physically get from there to the hostal, plus what transportation reaches the property.

## What Changes

- Add a new dedicated route `/ubicacion` with an interactive map (Leaflet + OpenStreetMap raster tiles, no API key, no billing) that guests can pan/zoom to explore streets around the hostal.
- Show two markers on the map: the hostal (Flor de Mayo #55) and the town's Plaza de Armas, each with a popup label.
- Draw a fixed polyline on the map tracing the actual walking route between the Plaza de Armas and the hostal (baked into static config data, not fetched from any routing service at runtime).
- Add city/context copy (about Illapel) and a "cómo llegar" / locomoción section (placeholder text for now, to be replaced by the owner later) — matches the existing project pattern of clearly-marked placeholder copy pending owner approval.
- Update the public header nav's "Ubicación" item to link to `/ubicacion` on every public page, instead of the current `#ubicacion` / `/#ubicacion` anchor (also updates the shared `publicNavigationForRoute()` source of truth added for nav consistency).
- Shrink the landing page's existing `#ubicacion` section into a teaser (photo + short blurb) that links to `/ubicacion` for the full map experience, instead of duplicating the map inline on the homepage.
- Loosen `next.config.ts`'s Content-Security-Policy `img-src` to allow the OpenStreetMap tile subdomains (`*.tile.openstreetmap.org`), since Leaflet renders tiles as `<img>` requests to that third-party host.

## Capabilities

### New Capabilities
- `location-page`: dedicated `/ubicacion` page showing an interactive map (hostal + Plaza de Armas markers, walking route polyline), city info, and transportation/locomoción info.

### Modified Capabilities
(none — no existing spec documents the public header nav or the homepage `#ubicacion` teaser; both are covered as implementation details of `location-page`.)

## Impact

- **New route**: `app/ubicacion/page.tsx` (+ loading/error states, following the pattern in `app/disponibilidad/`).
- **New dependency**: `leaflet` + `react-leaflet` (client-side only; no API key, no billing).
- **Config**: `next.config.ts` CSP `img-src` gains the OSM tile hostnames.
- **Content**: `src/config/public-site-content.ts` gains a `location` data block (coordinates for hostal + Plaza de Armas, the route polyline, city copy, transportation copy) and the nav item's `href` changes from `#ubicacion` to `/ubicacion`.
- **Existing files touched**: `src/presentation/templates/public-home.tsx` (teaser section), `src/presentation/organisms/public-header.tsx` and the four other public templates that consume `publicNavigationForRoute()` (nav item href change flows through automatically).
- **Coordinates used** (geocoded once via free OpenStreetMap/OSRM lookups, then hardcoded — no runtime calls): Plaza de Armas `-31.6327658, -71.1683340`; hostal (approximate, pending owner confirmation of the exact house-front pin) `-31.6296004, -71.1741538`; walking route ~1.37 km as a 49-point GeoJSON line.
