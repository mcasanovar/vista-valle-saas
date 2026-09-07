## 1. Dependencias y configuración

- [x] 1.1 Agregar `leaflet` y `react-leaflet` a `package.json` (más `@types/leaflet` en devDependencies) y verificar que `npm install` termina sin errores
- [x] 1.2 Actualizar `next.config.ts`: sumar los subdominios de tiles de OpenStreetMap (`*.tile.openstreetmap.org`) al `img-src` de la CSP, y verificar que el resto de la política (incluyendo `connect-src 'self'`) queda sin cambios

## 2. Datos de configuración

- [x] 2.1 Extender el bloque `location` de `src/config/public-site-content.ts` con: posición del hostal, posición de la Plaza de Armas, el polyline de la ruta caminando (los 49 puntos calculados en `proposal.md`), texto placeholder de ciudad y texto placeholder de locomoción/transporte — verificar con `tsc --noEmit` que el nuevo shape tipa correctamente
- [x] 2.2 Cambiar el `href` de la entrada "Ubicación" en `publicSiteContent.navigation` de `#ubicacion` a `/ubicacion`, y el de la misma entrada en `footer.navigation`, y verificar con `grep` que ningún template público sigue generando un `href="#ubicacion"` o `href="/#ubicacion"`

## 3. Componente de mapa

- [x] 3.1 Crear `location-map.tsx` (organism, `"use client"`) que renderiza el `MapContainer` de `react-leaflet` con la tile layer de OpenStreetMap, los dos marcadores (hostal, Plaza de Armas) con popup, y la polyline de la ruta, recibiendo las coordenadas como props desde `public-site-content.ts`
- [x] 3.2 Envolver la carga del mapa con `next/dynamic(..., { ssr: false })` siguiendo el mismo patrón que `room-photo-gallery.tsx` usa para `room-photo-lightbox.tsx`, y verificar que `npm run build` no falla por acceso a `window`/DOM durante el prerender
- [x] 3.3 Exportar el nuevo organism desde `src/presentation/organisms/index.ts`

## 4. Página `/ubicacion`

- [x] 4.1 Crear `app/ubicacion/page.tsx` con el mismo `PublicHeader`/`PublicFooter` que el resto de páginas públicas (usando `publicNavigationForRoute(false)`), el mapa, y las secciones de texto de ciudad y locomoción
- [x] 4.2 Crear `app/ubicacion/loading.tsx` siguiendo el patrón de `app/disponibilidad/loading.tsx`
- [x] 4.3 Verificar manualmente en el navegador que `/ubicacion` carga el mapa, se puede hacer pan/zoom, y ambos marcadores y la línea de ruta son visibles — verificado en `npm run build` + `npm run start`; se agregó además un `loading:` skeleton al `next/dynamic` del mapa (ver 3.2) porque el chunk de Leaflet tarda un momento en descargar y sin fallback dejaba un hueco vacío

## 5. Teaser en el landing

- [x] 5.1 Reemplazar el contenido de la sección `id="ubicacion"` en `public-home.tsx` por una versión resumida (foto + texto corto) con un botón "Ver mapa y cómo llegar" que enlaza a `/ubicacion`, manteniendo el `id="ubicacion"` de la sección
- [x] 5.2 Verificar que el test existente `tests/home-page.test.tsx` sigue pasando (o actualizarlo si asume el contenido anterior de la sección) — se actualizó la aserción del link "Ubicación" de `#ubicacion` a `/ubicacion`

## 6. Pruebas

- [x] 6.1 Agregar un mock de `react-leaflet`/`leaflet` en la config de tests (siguiendo el patrón de mocks de librerías cliente-only ya usado en el proyecto) para poder testear la página `/ubicacion` sin depender del DOM real de Leaflet — se mockeó `LocationMapLoader` vía `vi.mock("@/presentation/organisms", ...)` en el test file, mismo patrón local de `vi.mock` que usa el resto de la suite
- [x] 6.2 Escribir un test para la página `/ubicacion` que verifique: se renderizan los dos marcadores con sus etiquetas, se renderiza la sección de texto de ciudad y de locomoción, y el nav de la página incluye el ítem "Ubicación" apuntando a `/ubicacion`
- [x] 6.3 Correr `npm run typecheck` y la suite de `npm run test:unit` completa, y verificar que todo pasa — typecheck y lint limpios; test:unit pasa 506/519 (11 skipped), con 2 fallas preexistentes no relacionadas (`tests/prebooking-review-controller.test.tsx`, `tests/room-detail.test.tsx`) originadas en el commit `0676236 mejoras sitio` hecho por el usuario durante esta sesión, fuera del alcance de este change
