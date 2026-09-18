## 1. Edición de fechas sin restricción por origen

- [x] 1.1 Quitar `EDITABLE_RESERVATION_ORIGINS` y la lógica de rechazo por origen en `assertReservationDatesEditable()` (`src/features/reservations/edit-reservation-dates.ts`), dejando la función como punto único de verificación (hoy siempre elegible) y verificar que las pruebas existentes de `editReservationDates()` para reservas de origen `airbnb`/`booking` pasen a permitir la edición en vez de rechazarla.
- [x] 1.2 Actualizar `canEditDates` en `app/(admin-protected)/admin/reservas/[id]/page.tsx` para que ya no filtre por origen, y verificar manualmente (o con test de UI) que el formulario de edición de fechas aparece en el detalle de una reserva de origen Airbnb y de una de Booking.
- [x] 1.3 Actualizar el mensaje de error/documentación de `edit-reservation-dates-action.ts` que hoy referencia el rechazo por origen, y verificar que ya no se dispare `ReservationDateEditIneligibleError` por origen en ningún flujo (incluido el tool del asistente `editar_fechas`).
- [x] 1.4 Agregar un aviso visible en el detalle de una reserva de origen Airbnb/Booking indicando que editar sus fechas no se refleja en la plataforma externa, y verificar que se muestra solo para esos orígenes.

## 2. Edición de datos de contacto del huésped

- [x] 2.1 Definir la validación de formato de nombre, apellido, correo y teléfono a reutilizar (buscar si ya existe un esquema compartido en el flujo de reserva pública) y verificar con casos válidos/inválidos.
- [x] 2.2 Implementar la server action de actualización de datos de contacto del huésped, sin tocar fechas, precios, pagos ni estado, y verificar con un test que actualiza cada campo de forma independiente sobre una reserva confirmada.
- [x] 2.3 Verificar explícitamente con un test que la acción funciona igual para una reserva de origen Airbnb/Booking y para una reserva cancelada/completada/no presentada, sin ningún rechazo por origen o estado.
- [x] 2.4 Reemplazar los `<dd>` de solo lectura de nombre, apellido, correo y teléfono en `app/(admin-protected)/admin/reservas/[id]/page.tsx` por un formulario editable que llame a la acción del paso 2.2, mostrando el error de validación cuando corresponda.

  Nota: el código y `npx tsc --noEmit` verifican la integración, pero no se probó el flujo en navegador por la misma razón de la tarea 4.3 (el único `next dev` disponible corre contra producción, sin sesión de administrador autenticada) — guardar un dato de prueba ahí habría escrito sobre una reserva real.

## 3. Estado de pausa de sincronización por plataforma

- [x] 3.1 Diseñar y migrar el almacenamiento del estado de pausa por plataforma (Airbnb/Booking) descrito en `design.md`, por defecto ambas plataformas "no pausadas", y verificar que la migración corre limpio sobre una base existente.
- [x] 3.2 Implementar la consulta y el toggle de pausa (leer/escribir el estado por plataforma) como una función reutilizable, y verificar con un test unitario que pausar una plataforma no modifica el `enabled` de ninguna conexión.
- [x] 3.3 Aplicar la comprobación de pausa en `pollAllActiveConnections()` (`src/features/channel-calendar-sync/poll.ts`) para omitir las conexiones de una plataforma pausada, y verificar con un test que las conexiones de la otra plataforma se siguen sondeando con normalidad.
- [x] 3.4 Aplicar la comprobación de pausa en `app/api/ical/[token]/route.ts` para rechazar la solicitud (mismo código que token inválido) cuando la plataforma de esa conexión está pausada, y verificar con un test de la ruta para ambos casos (pausada / no pausada).
- [x] 3.5 Exponer una acción de servidor para pausar/reanudar cada plataforma (reutilizando el patrón de `requireAdministrator()` de `actions.ts`), y verificar que solo un administrador autenticado puede invocarla.

  Nota de implementación: la migración `drizzle/0016_empty_cyclops.sql` (tabla `channel_platform_pauses`) fue generada y **aplicada** con `npm run db:migrate` (autorizado por el usuario) — confirmada corriendo contra la base de datos real.

## 4. UI de los interruptores en el panel de sincronizaciones

- [x] 4.1 Agregar los dos controles (Airbnb, Booking) en `app/(admin-protected)/admin/sincronizaciones/page.tsx` o `connections-panel.tsx`, mostrando el estado actual de cada uno.
- [x] 4.2 Mostrar un aviso cuando una plataforma está pausada, indicando que no se están recibiendo reservas nuevas de esa plataforma ni informándole disponibilidad, y verificar en el navegador que el aviso aparece/desaparece correctamente al alternar el interruptor.
- [x] 4.3 Verificar en el navegador el ciclo completo: pausar Airbnb, confirmar que Booking sigue funcionando con normalidad (revisando el estado de sus conexiones en el panel), reanudar Airbnb y confirmar que cada conexión vuelve a su `enabled` previo.

  Nota: verificado por el usuario directamente en producción (edición de reserva y pausa/reanudación de Airbnb y Booking funcionando correctamente), ya que el entorno de desarrollo disponible apunta a la base de datos real y requiere sesión de administrador.

## 5. Validación final

- [x] 5.1 Correr `openspec validate --strict` sobre este change y confirmar que no hay errores.
- [x] 5.2 Ejecutar la suite de tests del proyecto y confirmar que pasa completa, incluyendo los tests nuevos y modificados de las secciones 1-3.

  Nota: `tests/prebooking-review-controller.test.tsx` falla en `main`/`dev` sin relación con este change (confirmado corriendo la suite sobre el código sin modificar); el resto de la suite (773 tests) pasa.
