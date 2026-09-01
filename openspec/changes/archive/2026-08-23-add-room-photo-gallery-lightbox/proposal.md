## Why

En la home y en el catálogo de habitaciones, la imagen principal de cada `RoomCard` es estática: no hay forma de ver más fotos de una habitación sin entrar al detalle. En la página de detalle, la galería (`RoomGallery`) es una grilla fija sin posibilidad de ampliar ninguna foto. Los visitantes que quieren comparar habitaciones por sus fotos antes de decidir no tienen ese recurso disponible.

## What Changes

- Al hacer click en la imagen principal de una `RoomCard` (home, `/habitaciones` y los resultados de `/disponibilidad`, que reutilizan el mismo componente), se abre un carrusel/lightbox con todas las fotos de esa habitación.
- Al hacer click en cualquier foto de `RoomGallery` (página de detalle `/habitaciones/[slug]`), se abre el mismo carrusel/lightbox con todas las fotos de la habitación.
- El estado abierto del carrusel se refleja en la URL (deep-link): es compartible y el botón "atrás" del navegador lo cierra sin salir de la página.
- El botón "Ver más" / "Ver detalle" de `RoomCard` mantiene su comportamiento actual de navegar a `/habitaciones/[slug]`; no cambia.
- Se agrega la dependencia `yet-another-react-lightbox` para la implementación del carrusel/lightbox.
- El carrusel solo presenta imágenes (sin descripciones ni texto adicional).

## Capabilities

### New Capabilities
- `room-photo-gallery`: Cubre la interacción de carrusel/lightbox de fotos activada desde la imagen principal de `RoomCard` (home y catálogo) y desde las fotos de `RoomGallery` (detalle), incluyendo su comportamiento deep-linkable.

### Modified Capabilities
- Ninguna. La capability `public-lodging-site` todavía vive en el cambio MVP activo sin archivar; este cambio agrega una capability nueva que se apoya en sus componentes sin alterar sus requisitos.

## Impact

- Afecta `src/presentation/organisms/room-card.tsx`, `room-gallery.tsx`, `src/presentation/templates/room-catalogue.tsx`, `public-home.tsx`, `room-detail.tsx`, `availability-results.tsx` (RoomCard también se usa en los resultados de disponibilidad), y las rutas `app/page.tsx`, `app/habitaciones/page.tsx`, `app/habitaciones/[slug]/page.tsx`, `app/disponibilidad/page.tsx` (manejo de query param para el deep-link del carrusel).
- Nueva dependencia de terceros: `yet-another-react-lightbox`.
- No requiere cambios de modelo de datos ni de backend: reutiliza los arreglos de imágenes de habitación que ya llegan a estas plantillas.
