## Why

Hoy la cotización para empresas permite seleccionar habitaciones sin distribuir la cantidad de personas por habitación y sin bloquear el envío cuando la capacidad elegida no cubre el total solicitado ("cotización parcial" explícita). El flujo de reservas ya resuelve este mismo problema con una validación de ocupación por habitación que bloquea el exceso y exige completar el total antes de continuar. La cotización empresarial debe adoptar la misma garantía: si se necesitan alojar N personas, la suma de personas asignadas por habitación debe ser exactamente N antes de poder enviar la cotización.

## What Changes

- Agregar un campo de cantidad de huéspedes por habitación seleccionada en el formulario de cotización empresarial (en vez de un simple toggle de selección).
- Bloquear en el cliente el aumento de huéspedes en una habitación (o la selección de nuevas habitaciones) una vez que la suma asignada alcanza el total de personas de la cotización, reutilizando la lógica de `isOccupancySelectable`/`computeGuestAllocation` ya usada en reservas.
- Mostrar el estado de asignación ("X de Y personas asignadas") en la selección de habitaciones de la cotización.
- **BREAKING**: Eliminar la opción de enviar una "cotización parcial". El botón de envío SHALL permanecer deshabilitado hasta que la suma de personas asignadas por habitación sea exactamente igual al total de personas solicitado.
- Validar en el servidor, de forma autoritativa, que cada línea de habitación no exceda su `capacity` y que la suma de personas asignadas sea exactamente igual al total de personas de la solicitud; rechazar la cotización si no se cumple.
- Actualizar los correos de confirmación y notificación operativa para eliminar el mensaje de "cobertura parcial", dado que ya no existe ese estado.

## Capabilities

### Modified Capabilities
- `company-quotation-flow`: cambia el requirement de selección de habitaciones para exigir distribución de huéspedes por habitación con bloqueo estricto por capacidad individual y por el total, elimina el envío de cotizaciones parciales, y ajusta el cálculo autoritativo del servidor y el contenido de los correos para reflejar que toda cotización enviada cubre el 100% de las personas solicitadas.

## Impact

- Cliente: `src/presentation/organisms/company-quotation-form.tsx`, `src/presentation/organisms/company-quotation-controller.tsx`.
- Dominio compartido: reutiliza `src/features/reservations/guest-allocation.ts` (o una extracción equivalente reutilizable) para el cálculo de ocupación y el bloqueo por habitación.
- Servidor: `src/features/company-quotations/quotation.ts` (`normalizeCompanyQuotationInput`, `calculateCompanyQuotation`) — nueva forma de datos por línea (`guestCount` por habitación) y rechazo cuando la asignación no es exacta.
- Correos: plantillas que hoy declaran cobertura parcial en `company-quotation-flow` (confirmación al cliente y notificación operativa).
- Specs: `openspec/specs/company-quotation-flow/spec.md`.
