## Context

`RoomCard` (home, `/habitaciones` y los resultados de `/disponibilidad`) y `RoomGallery` (`/habitaciones/[slug]`) ya reciben el arreglo completo de imágenes de cada habitación como props; no hay plomería de datos pendiente. `RoomCard` es un client component (`"use client"`); `RoomGallery` hoy es un server component sin interactividad. La página de detalle (`/habitaciones/[slug]`) ya usa `searchParams` en el servidor para propagar el contexto de disponibilidad (`checkIn`, `checkOut`, `guests`, `room`) hacia el CTA de reserva — cualquier param nuevo debe evitar colisionar con ese uso, en particular con `room`, que ya identifica la habitación preseleccionada para reservar. Ver `proposal.md` para la motivación.

`RoomCard` también se usa en `AvailabilityResultsTemplate`/`AvailabilityResultsRegion` (resultados de `/disponibilidad`), donde las habitaciones disponibles llegan de forma asíncrona (`Suspense`, streaming desde el servidor) en vez de estar disponibles de entrada como en home/catálogo. El controlador del carrusel no puede asumir que conoce todas las habitaciones de la página al montarse.

## Goals / Non-Goals

**Goals:**
- Un único punto de estado por página para el carrusel, evitando montar un diálogo por tarjeta.
- Reusar el mismo componente de carrusel tanto desde `RoomCard` como desde `RoomGallery`.
- Mantener el bundle inicial liviano: la librería del carrusel solo se carga cuando se abre por primera vez.

**Non-Goals:**
- No se rediseña el layout de `RoomCard`, `RoomGallery` ni de las páginas que las usan, salvo volver clickeables sus imágenes.
- No se agrega backend, endpoint ni cambio de modelo de datos.
- No se resuelve accesibilidad "desde cero"; se apoya en el soporte nativo de la librería (foco, teclado, `aria-*`).

## Decisions

**Un controlador de carrusel por página, no por tarjeta.** Home, `/habitaciones` y los resultados de `/disponibilidad` listan varias habitaciones a la vez; un `RoomPhotoGalleryProvider` (client component) envuelve la sección de habitaciones. En vez de recibir un mapa de habitaciones como prop (inviable en `/disponibilidad`, donde las habitaciones llegan async vía `Suspense`), el provider no requiere datos de habitación al montarse: cada `RoomCard`/`RoomGallery` **se registra** con `registerRoom(roomSlug, images)` en un `useEffect` al montar, y llama a `openPhoto(roomSlug, index)` al hacer click; el provider resuelve `roomSlug` contra su registro interno. El `<Lightbox />` (de `yet-another-react-lightbox`) se monta una sola vez por página, en el provider, con los slides de la habitación actualmente abierta. En `/habitaciones/[slug]` el provider recibe además `singleRoomSlug` (la habitación ya la da la ruta, de forma síncrona), para poder resolver un deep-link que solo trae `foto` sin `habitacion`.

**Imágenes clickeables sin romper la navegación existente.** La imagen principal de `RoomCard` pasa a ser un `<button>` que llama a `openPhoto`, superpuesto sobre la imagen pero sin envolver el botón "Ver más" (que sigue siendo el `ActionLink` a `/habitaciones/[slug]`, sin cambios). Cada foto de `RoomGallery` se vuelve un `<button>` equivalente, uno por imagen de la grilla. `RoomGallery` deja de ser un server component puro: pasa a ser (o envuelve internamente) un client component para manejar el click, sin cambiar su render server-side de `next/image` para SEO/LCP.

**Registro en vez de mapa upfront (deep-link con datos async).** El provider guarda un registro `Map<roomSlug, images>` poblado por cada `RoomCard`/`RoomGallery` montado. Si la página se carga con `?habitacion=<slug>&foto=<n>` (o solo `?foto=<n>` cuando el provider tiene `singleRoomSlug`) y esa habitación aún no se ha registrado (p. ej. sigue resolviendo el `Suspense` de disponibilidad), el provider guarda la intención como pendiente y abre el carrusel apenas esa habitación se registra — sin bloquear el render del resto de la página.

**Esquema de query param para deep-link.** Se usa `foto` (índice 1-based, legible) en vez de reusar `room`, que ya tiene otro significado en `/habitaciones/[slug]`. En páginas con varias habitaciones (home, `/habitaciones`) se agrega `habitacion=<slug>` para saber cuál carrusel abrir; en `/habitaciones/[slug]` basta `foto`, porque la habitación ya la da la ruta. Ejemplo: `/habitaciones?habitacion=suite-valle&foto=3`, `/habitaciones/suite-valle?foto=3`.

**Sincronización con el router de Next.js (App Router).** Al abrir, el provider hace `router.push` agregando `habitacion`/`foto` (con `{ scroll: false }`), creando una entrada de historial nueva — así "atrás" cierra el carrusel. Al cerrar de forma explícita (botón X, Escape, click fuera), si la entrada anterior es la URL limpia se usa `router.back()`; si la página se cargó directamente con el param (enlace compartido, sin una entrada limpia previa en el historial de esta pestaña), se usa `router.replace()` quitando el param. El estado visual del carrusel (abierto/cerrado, foto activa) vive en el estado de React del provider, no depende de que la navegación del router resuelva primero — la URL se actualiza en paralelo para que sea compartible, no como fuente de verdad del render.

**Carga diferida de la librería.** `yet-another-react-lightbox` se importa con `next/dynamic` y `ssr: false`, cargándose recién cuando `openPhoto` se invoca por primera vez, para no sumar peso al bundle inicial de home ni del catálogo.

**Alternativas consideradas:** un `<Lightbox />` por `RoomCard`/por foto de `RoomGallery` — descartado porque multiplicaría instancias montadas sin necesidad, con el mismo estado replicado. Construir el diálogo, el foco trap y el swipe a mano con `framer-motion` — descartado porque el usuario priorizó menos código propio, y ya se decidió usar una librería dedicada.

## Risks / Trade-offs

- [Nueva dependencia externa suma peso y superficie de mantenimiento] → mitigado con carga diferida (`next/dynamic`, `ssr: false`); librería activamente mantenida y ampliamente usada.
- [Actualizar `searchParams` en App Router puede re-renderizar el árbol de servidor que los lee en `/habitaciones/[slug]`] → el estado del carrusel no depende de ese round-trip (fuente de verdad es el estado de cliente), así que no hay parpadeo visible aunque la sincronización de URL tarde un tick.
- [Enlace compartido apuntando a una habitación/foto que ya no existe o fue despublicada] → si `habitacion` o `foto` no resuelven a una habitación/índice válido, el provider ignora el param y la página se muestra cerrada, sin error.
