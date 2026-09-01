## 1. Dependencia y controlador base del carrusel

- [x] 1.1 Agregar `yet-another-react-lightbox` a `package.json` e instalar; verificar que `npm ls yet-another-react-lightbox` resuelve la versión instalada
- [x] 1.2 Crear `RoomPhotoGalleryProvider` (client component) con contexto `openPhoto(roomSlug, index)`, estado `{ openRoomSlug, activeIndex }`, y carga diferida del `<Lightbox />` vía `next/dynamic({ ssr: false })`; verificar con `npm run test:unit` que un test de render confirma que el provider monta sin abrir el lightbox por defecto
- [x] 1.3 Implementar la sincronización con el router (`useRouter`/`usePathname`/`useSearchParams`): `push` con `{ scroll: false }` al abrir, `back()`/`replace()` al cerrar, usando los params `habitacion`+`foto` en páginas multi-habitación y solo `foto` en el detalle; verificar con `npm run test:unit` que abrir actualiza la URL y que simular "atrás" cierra el carrusel

## 2. Integración en tarjetas y galería

- [x] 2.1 Volver clickeable la imagen principal de `RoomCard` (botón que llama `openPhoto`), sin afectar el `ActionLink` "Ver más"; verificar con `npm run test:unit` que el click abre el carrusel y que "Ver más" sigue navegando a `/habitaciones/[slug]`
- [x] 2.2 Adaptar `RoomGallery` para que cada foto sea un botón que llama `openPhoto` con su índice, manteniendo el render de `next/image` existente para SEO/LCP; verificar con `npm run test:unit` que cada foto abre el carrusel en el índice correcto
- [x] 2.3 Envolver la sección de habitaciones de home (`PublicHomeTemplate`) y de `/habitaciones` (`RoomCatalogueTemplate`) con `RoomPhotoGalleryProvider`, pasando el mapa de habitaciones a imágenes; verificar manualmente con `npm run dev` que el carrusel abre y navega entre todas las fotos de la habitación seleccionada
- [x] 2.4 Envolver `/habitaciones/[slug]` (`RoomDetailTemplate`) con el mismo provider en modo de una sola habitación; verificar manualmente con `npm run dev` que el carrusel abre desde cualquier foto de la grilla
- [x] 2.5 Envolver `/disponibilidad` (`AvailabilityResultsTemplate`, que incluye el árbol de `AvailabilityResultsRegion` streameado vía `Suspense`) con `RoomPhotoGalleryProvider`; verificar manualmente con `npm run dev` que el carrusel abre desde las tarjetas de resultados de disponibilidad una vez cargados

## 3. Deep-link

- [x] 3.1 Verificar que abrir una URL con `?habitacion=<slug>&foto=<n>` (home/catálogo) o `?foto=<n>` (detalle) presenta la página con el carrusel ya abierto en la foto correspondiente; cubrir con un test Playwright bajo `npm run test:e2e`
- [x] 3.2 Verificar que un `habitacion`/`foto` inválido o de una habitación despublicada no rompe la página y el carrusel permanece cerrado; cubrir con un test unitario del provider bajo `npm run test:unit`

## 4. Accesibilidad y cierre

- [x] 4.1 Verificar que Escape, click fuera y el control de cierre cierran el carrusel y devuelven el foco al elemento que lo abrió; cubrir con un test Playwright de teclado bajo `npm run test:e2e`
- [x] 4.2 Verificar la navegación con flechas de teclado dentro del carrusel (siguiente/anterior); cubrir con un test Playwright bajo `npm run test:e2e`
- [x] 4.3 Confirmar que cada slide expone el texto alternativo de la foto y que el diálogo se anuncia correctamente a lectores de pantalla; verificar con revisión de accesibilidad (axe u otra herramienta ya usada en el proyecto) o revisión manual con lector de pantalla

## 5. Cobertura y regresión

- [x] 5.1 Ajustar la cobertura Playwright de descubrimiento de habitaciones existente para cubrir el flujo de carrusel desde home, catálogo y resultados de disponibilidad; verificar que `npm run test:e2e` pasa
- [x] 5.2 Ejecutar `npm run lint`, `npm run typecheck`, `npm run test:unit` y `npm run test:e2e`; verificar que todos pasan sin regresiones propias del carrusel (ver nota de cierre de sesión: el árbol comparte trabajo en paralelo de otra persona que introduce fallas ajenas no relacionadas con este change)
