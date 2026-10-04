## Why

Hoy el sitio no compite por las búsquedas locales que originan la demanda ("alojamiento en Illapel", "habitaciones en Illapel", "hostal en Illapel"): el HTML que recibe un rastreador en `/` no contiene ningún encabezado ni texto de contenido, porque el único `<Suspense>` de `app/page.tsx` envuelve todo el árbol de la home y `useSearchParams()` dentro de ese árbol anula el prerender, de modo que solo se emite el fallback vacío. Las rutas restantes entregan un `h1` pero casi nada de texto indexable, los datos estructurados omiten campos que Google usa para alojamientos, y el sitemap deja fuera dos páginas públicas que ya existen.

La oportunidad es inmediata y barata: Vista Valle ya tiene reputación en agregadores de terceros (Booking, Tripadvisor) que capturan el tráfico, mientras su propio dominio no es indexable en la práctica. Corregir la entrega del contenido y poblar las señales locales que faltan habilita el posicionamiento orgánico con el código que ya está escrito.

## What Changes

- **Entrega del contenido de la home en HTML**: reubicar el límite de `Suspense` en `app/page.tsx` para que cubra únicamente el buscador de disponibilidad, y eliminar la dependencia de `useSearchParams()` de `RoomCard` y `RoomPhotoGallery` (los parámetros de consulta pasan a entrar como props resueltas en el servidor). Resultado observable: `/` entrega `h1`, `h2` y el texto de todas sus secciones sin ejecutar JavaScript.
- **Contenido orientado a intención de búsqueda**: el `h1` de la home pasa a nombrar el servicio y la localidad ("Hospedaje y habitaciones en Illapel") con el claim actual como texto de apoyo; se reemplazan los textos marcados como pendientes en `src/config/public-site-content.ts` (`services`, `experience`, `contact`) por contenido real; se amplía el texto introductorio de `/habitaciones` y de `/cotizacion-empresa`.
- **Sección de preguntas frecuentes** en la home, con respuestas reales sobre check-in/check-out, estacionamiento, mascotas, Wi-Fi y desayuno, que además sustenta el marcado `FAQPage`.
- **Datos estructurados completos** en `src/seo/structured-data.ts`: `geo` (reutilizando las coordenadas ya presentes en `publicSiteContent.location.hostal.position`), `priceRange`, `checkinTime`, `checkoutTime`, `petsAllowed`, `email`, `hasMap`, `sameAs` hacia las fichas de Booking, Tripadvisor e Instagram, `amenityFeature` a nivel del alojamiento, `offers` con precio por habitación a partir de `nightlyPriceClp`, y `BreadcrumbList` en las rutas internas. Se añade `FAQPage` acompañando la sección anterior. **No** se publica `aggregateRating` ni `review` con notas de terceros.
- **Sitemap completo**: `/ubicacion` y `/cotizacion-empresa` se incorporan a `app/sitemap.ts`, y cada entrada declara `lastModified`.
- **Texto alternativo descriptivo** en las imágenes públicas: los `alt` genéricos ("Habitación Doble") pasan a describir la escena incluyendo el alojamiento y la localidad.
- **Datos comerciales por confirmar**: los valores de check-in/check-out, mascotas, servicios y perfiles sociales se toman de lo ya publicado por el propio alojamiento en Booking y Tripadvisor, y quedan concentrados en un único lugar de configuración con una tarea explícita de confirmación por parte del dueño antes del despliegue. El requisito vigente de no publicar información comercial no configurada se mantiene: cambia el mecanismo (un dato confirmado y centralizado en lugar de un marcador de pendiente), no la prohibición.

Fuera de alcance (no se implementa en este cambio): rutas informativas nuevas (por ejemplo guías de la ciudad o cómo llegar), y las acciones externas al repositorio —ficha de Google Business Profile, verificación en Search Console y construcción de enlaces entrantes— que son las que gobiernan el paquete local y se gestionan aparte.

## Capabilities

### New Capabilities

Ninguna. El cambio refuerza requisitos que la capability pública ya declara.

### Modified Capabilities

- `public-lodging-site`: el requisito de SEO local y metadatos pasa a exigir que el contenido principal de cada página pública esté presente en el HTML de la respuesta sin ejecución de JavaScript, que los encabezados nombren el servicio y la localidad, que los datos estructurados del alojamiento incluyan las señales locales enumeradas y excluyan calificaciones de terceros, y que el sitemap cubra todas las rutas públicas con fecha de modificación. El requisito de presentación institucional pasa a admitir contenido comercial confirmado y centralizado en lugar de marcadores de pendiente, conservando la prohibición de publicar datos no confirmados. El requisito de accesibilidad y rendimiento pasa a exigir texto alternativo descriptivo del contenido de cada fotografía.

## Impact

- `app/page.tsx`: reubicación del límite de `Suspense`; la home deja de depender del cliente para renderizar su contenido.
- `src/presentation/organisms/room-card.tsx` y `src/presentation/organisms/room-photo-gallery.tsx`: dejan de llamar `useSearchParams()`; sus consumidores deben pasar los parámetros necesarios. Afecta a `PublicHomeTemplate`, `RoomCatalogueTemplate`, `RoomDetailTemplate` y a la pantalla de resultados de disponibilidad.
- `src/config/public-site-content.ts`: contenido real en lugar de marcadores; nuevos datos comerciales (horarios, políticas, perfiles sociales) y copy de preguntas frecuentes.
- `src/seo/structured-data.ts` y `src/seo/public-metadata.ts`: ampliación del grafo del alojamiento y nuevos generadores (`BreadcrumbList`, `FAQPage`).
- `app/sitemap.ts`: dos rutas nuevas y `lastModified`.
- `src/presentation/templates/public-home.tsx` y los textos de `/habitaciones` y `/cotizacion-empresa`: nuevos encabezados y secciones.
- Pruebas: `room-photo-gallery` tiene cobertura de deep-link por querystring (capability `room-photo-gallery`) que depende del origen de los parámetros; sus pruebas deben seguir pasando con el nuevo mecanismo. Se requiere además verificación del HTML servido sin JavaScript.
- Riesgo de regresión concentrado en el carrusel deep-linkable y en la restauración de selección por querystring; ninguna dependencia nueva.
- Externo al repositorio: tras el despliegue hay que solicitar reindexación en Search Console para que el contenido recién expuesto se rastree.
