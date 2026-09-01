## Context

La página de detalle de habitación ya existe (tarea 3.5 de `build-vista-valle-booking-mvp`), construida con los organismos de galería, características/servicios y precio definidos en la capability `public-lodging-site` bajo Atomic Design. Este cambio ajusta esos organismos existentes para que coincidan con el diseño de referencia aprobado (`proposes/mejora-detalle-habitacion.png`). Ver `proposal.md` para la motivación.

## Goals / Non-Goals

**Goals:**
- Ajustar el layout y composición visual de los organismos ya existentes de galería, características/servicios y precio en la página de detalle, sin crear nuevos flujos ni endpoints.
- Mantener la implementación dentro de los mismos componentes/organismos Atomic Design ya definidos (`3.3`), extendiéndolos o reordenándolos según corresponda.

**Non-Goals:**
- No cambia el catálogo de habitaciones, el modelo de datos de habitaciones, ni la lógica de disponibilidad/reserva.
- No introduce nueva infraestructura, dependencias ni proveedores externos.
- No modifica el aviso de contenido de demostración más allá de su posición en el orden de secciones.

## Decisions

- **Reutilizar organismos existentes en vez de crear nuevos**: la galería, el panel de características/servicios y la tarjeta de precio ya existen como organismos public de `public-lodging-site` (tarea 3.3). Se ajustan su disposición interna (grid de tres columnas para la galería, indicadores con ícono para características, checklist para servicios, tarjeta con CTA y enlace de retorno) en lugar de introducir organismos nuevos, para no duplicar responsabilidades entre capabilities.
- **Capability de spec separada en vez de modificar `public-lodging-site`**: se documenta como capability nueva (`room-detail-page`) porque especifica presentación (layout, orden visual) mientras que `public-lodging-site` especifica comportamiento (qué datos se muestran y a dónde llevan). Mantenerlas separadas evita mezclar dos niveles de abstracción distintos en el mismo archivo de spec.

## Risks / Trade-offs

- [Duplicar intención entre `public-lodging-site` ("Detalle de habitación") y `room-detail-page` (esta capability) podría generar specs que diverjan con el tiempo] → La capability nueva se limita explícitamente a presentación/estructura visual y no repite ni contradice el comportamiento ya definido; cualquier cambio de comportamiento futuro debe hacerse en `public-lodging-site`.
- [El grid de tres imágenes en fila puede no adaptarse bien a habitaciones con menos de tres fotografías] → El organismo de galería ya maneja conteos variables de imágenes; este cambio solo fija la disposición para el caso de tres o más fotografías, dejando el comportamiento existente para casos con menos.
