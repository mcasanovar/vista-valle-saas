## 1. Contrato de datos y validación en servidor

- [x] 1.1 Agregar `guestCount` a `CompanyQuotationRoomSelection` (`{ slug, quantity, guestCount }`) en `src/features/company-quotations/quotation.ts`, manteniendo `quantity` intacto (soporta líneas multi-unidad ya probadas en `tests/company-quotation.test.ts`/`tests/company-quotation-notifications.test.ts`), y propagar `guestCount` al snapshot de línea (`CompanyQuotationLine`)
- [x] 1.2 En `normalizeCompanyQuotationInput`, validar que cada `room.guestCount` sea un entero positivo (mismo patrón que la validación de `quantity`), agregando un `CompanyQuotationIssue` por línea inválida
- [x] 1.3 En `calculateCompanyQuotation`, una vez resuelta la habitación por línea, rechazar con `CompanyQuotationInputError` si `guestCount > quantity * room.capacity`, y rechazar la solicitud completa si `sum(line.guestCount) !== input.guestCount`; verificar con tests que ambos casos son rechazados
- [x] 1.4 Confirmar que el cálculo de subtotal/capacidad por línea sigue usando `quantity` sin cambios (precio por habitación no por ocupante; ver design.md - Decisiones) y que los tests existentes de `calculateCompanyQuotation` siguen en verde tras agregar `guestCount` a los fixtures
- [x] 1.5 Ejecutar la suite de tests de `src/features/company-quotations/` y confirmar que pasan con el nuevo contrato

## 2. Reutilización de la lógica de asignación de huéspedes

- [x] 2.1 Confirmar que `src/features/reservations/guest-allocation.ts` puede importarse desde `src/features/company-quotations/` sin acoplar código de reservas (dates, sessionStorage) — si depende de algo específico de reservas, extraerlo a un módulo neutral antes de continuar
- [x] 2.2 Construir en el estado del formulario de cotización una lista `RoomOccupancySelection[]` (usando el `slug` de la habitación como `roomId`) y verificar con un test unitario del formulario que el estado se actualiza correctamente al seleccionar/deseleccionar habitaciones

## 3. Formulario de cotización (cliente)

- [x] 3.1 Reemplazar el toggle binario de `company-quotation-form.tsx` por un control de cantidad de huéspedes por habitación seleccionada, limitado a `[1, room.capacity]`
- [x] 3.2 Usar `isOccupancySelectable`/`remainingGuestsExcludingRoom` para deshabilitar el aumento de huéspedes en una habitación y el botón "Seleccionar" de habitaciones no seleccionadas cuando ya no queda remanente, y verificar manualmente el caso del ejemplo del proposal (3 personas, habitación de 3, bloqueo total; luego 2/3, remanente 1 disponible en cualquier otra habitación)
- [x] 3.3 Mostrar el estado de asignación con `computeGuestAllocation`/`describeGuestAllocation` (o una copia equivalente en español ya usada en este formulario) cerca del resumen de habitaciones
- [x] 3.4 Eliminar `capacityShortfall` y el mensaje/flujo de "cotización parcial"; el botón de envío SHALL permanecer deshabilitado mientras `computeGuestAllocation(...).isComplete` sea `false`, y verificar con un test de componente que el botón de envío está deshabilitado con distribución incompleta y habilitado con distribución exacta
- [x] 3.5 Actualizar `company-quotation-controller.tsx` para eliminar el mismo flujo de "continuar con cotización parcial" en el paso de verificación de disponibilidad

## 4. Verificación de disponibilidad previa

- [x] 4.1 En el paso de verificación de disponibilidad, cuando la capacidad sumada de habitaciones disponibles (respetando una unidad por tipo) sea menor que `guestCount`, mostrar el mensaje de disponibilidad insuficiente y no mostrar el formulario de selección (en vez de mostrarlo acotado), y verificar con un test que ese caso ya no habilita el formulario

## 5. Correos de cotización

- [x] 5.1 Actualizar las plantillas de correo de confirmación al cliente y notificación operativa para eliminar cualquier mensaje de "cobertura parcial" (el campo de línea que se muestra sigue siendo `quantity`, sin cambios), verificando con los tests de snapshot/renderizado de correos existentes

## 6. Especificación y cierre

- [x] 6.1 Ejecutar `openspec validate --change add-company-quotation-occupancy-validation --strict` y corregir cualquier hallazgo
- [x] 6.2 Ejecutar la suite de tests completa relacionada a `company-quotations` (unitarios y de integración/componente) y confirmar que pasa en verde
