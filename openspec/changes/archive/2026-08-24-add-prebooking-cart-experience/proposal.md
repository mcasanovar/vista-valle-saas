## Why

La selección de habitaciones hoy muestra su resumen en la misma página de disponibilidad, mezclando descubrimiento con la decisión de reserva. Vista Valle necesita un carro persistente y una pre-reserva dedicada que haga visible el siguiente paso y prepare al huésped para confirmar con claridad.

## What Changes

- Crear un carro de reservas flotante y sticky, visible al seleccionar una o más habitaciones, con cantidad, subtotal y acceso a la pre-reserva. Su composición visual seguirá la referencia aprobada: cápsula cálida de bordes amplios, áreas jerarquizadas y CTA de alto contraste.
- Incorporar una animación de agregado desde las tarjetas y el detalle de habitación hacia el carro, con alternativa sin movimiento y sin bloquear la interacción.
- Crear la página pública `/pre-reserva` para revisar habitaciones, fechas, noches, subtotales, total, datos del titular y solicitud de factura antes de confirmar.
- Trasladar el resumen de selección fuera de la página de disponibilidad, preservando selección, navegación hacia atrás y revalidación al cambiar fechas.
- Conservar el contexto de selección durante la navegación pública y las recargas del navegador, hasta que la reserva se confirme o el huésped lo modifique explícitamente.
- Impedir agregar habitaciones sin un rango de fechas y suavizar la actualización visual del carro sin recargar ni reposicionar bruscamente la página.
- Alinear la superficie de `/pre-reserva` con los tokens de fondo del sistema visual.
- Reestilizar `/pre-reserva` conforme a la referencia aprobada de fondo marfil cálido y tarjetas claras sin borde, con `shadow-md`; la franja de total usa la superficie tonal aprobada `#F4E9DF`, y el resumen de fechas queda como información no editable. Una nueva búsqueda de fechas parte desde el landing.
- Eliminar CTAs de disponibilidad duplicados en el detalle, expresar claramente el estado de una habitación ya agregada y enriquecer el propio carro con un detalle desplegable integrado de los ítems seleccionados, incluyendo la eliminación directa de cada habitación.
- Refinar el movimiento de agregado para que parta desde el tamaño de su acción, llegue al centro del carro con una reducción progresiva y conserve una cadencia perceptible.

## Capabilities

### New Capabilities

- `prebooking-cart-experience`: Carro de habitaciones persistente, animación de agregado y experiencia de pre-reserva accesible antes de confirmar una reserva.

### Modified Capabilities

- Ninguna. La experiencia se documenta como una capacidad nueva y reutiliza los contratos de selección y reserva existentes.

## Impact

- Rutas públicas de disponibilidad, detalle de habitación y nueva ruta `/pre-reserva`.
- Componentes de selección, resumen, formulario del huésped y composición de la confirmación.
- Estado URL de selección, comportamiento responsive, accesibilidad y pruebas de interacción/end-to-end.
