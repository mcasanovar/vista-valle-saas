## Why

La página de detalle de habitación ya cumple funcionalmente el requisito "Detalle de habitación" de `public-lodging-site` (galería, características, servicios, precio y acceso a reserva), pero su presentación visual actual no refleja la jerarquía y composición que Vista Valle aprobó como referencia (`proposes/mejora-detalle-habitacion.png`). Se necesita una especificación propia que fije la estructura visual de esta página para guiar su implementación de forma verificable, sin reabrir ni contradecir el requisito funcional ya existente.

## What Changes

- Definir la estructura visual de la página de detalle de habitación en el orden: encabezado del sitio, aviso de contenido de demostración (cuando aplique), título y descripción breve de la habitación, galería de imágenes, panel de características y servicios, y tarjeta de precio/reserva.
- Especificar una galería de imágenes en fila de tres fotografías de igual tamaño visibles sin scroll adicional en escritorio, con comportamiento responsive apropiado en móvil.
- Especificar un bloque de "Características" con capacidad, camas y baño presentados como íconos con etiqueta y valor.
- Especificar un bloque de "Servicios" como lista de verificación de las comodidades incluidas.
- Especificar una tarjeta de precio y reserva que muestre el precio desde/por noche, un llamado a la acción hacia la disponibilidad/reserva, y un enlace de retorno al catálogo de habitaciones.
- No se modifica el comportamiento funcional ya definido (qué datos se muestran, cómo se llega a la reserva); solo se fija cómo se presentan.

## Capabilities

### New Capabilities

- `room-detail-page`: Especificación visual y estructural de la página de detalle de una habitación individual (orden de secciones, galería, características, servicios y tarjeta de precio/reserva), alineada con el diseño de referencia aprobado.

### Modified Capabilities

- Ninguna. El requisito funcional "Detalle de habitación" en `public-lodging-site` no cambia; esta capability nueva añade el nivel de detalle de presentación que esa spec no especifica.

## Impact

- Afecta la implementación de la página pública de detalle de habitación (`/habitaciones/[slug]` o ruta equivalente) construida en la capability `public-lodging-site` (tarea 3.5 del MVP), en particular sus organismos de galería, características/servicios y tarjeta de precio.
- No afecta el modelo de datos, disponibilidad, reservas ni ningún otro dominio de negocio.
- Referencia visual: `proposes/mejora-detalle-habitacion.png`.
