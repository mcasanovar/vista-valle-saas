## 1. Criterio de elegibilidad

- [x] 1.1 En `src/features/reservations/reservation-rate-eligibility.ts`, agregar `"whatsapp"` al conjunto elegible y renombrar los seis símbolos exportados según la tabla de design.md (decisión 1), documentando en el comentario del módulo que este conjunto ya no coincide con `ExternalReservationPlatform`. Verificar con `npm run typecheck`, que debe señalar todos los puntos de uso pendientes.
- [x] 1.2 Actualizar los puntos de uso al nuevo vocabulario en `src/features/reservations/edit-reservation-nightly-rates.ts`, `src/features/reservations/edit-reservation-origin.ts`, `src/features/admin/manual-reservation.ts`, `src/features/admin/manual-reservation-form.tsx` y `src/features/admin/edit-reservation-nightly-rates-core.ts`, ajustando los comentarios que hablan de "canal externo" donde el criterio ya no es ese. Verificar con `npm run typecheck` y `npm run lint` sin errores.
- [x] 1.3 Actualizar `tests/reservation-rate-eligibility.test.ts` al nuevo vocabulario, conservando la enumeración de los seis orígenes del enum y afirmando el conjunto elegible exacto `["airbnb", "booking", "whatsapp"]` (design.md decisión 5). Verificar que el test pasa y que falla si se quita `"whatsapp"` del conjunto.

## 2. Creación manual con valor acordado

- [x] 2.1 Verificar que `applyManualNightlyRate` en `src/features/admin/manual-reservation.ts` aplica el valor en una reserva de WhatsApp y lo sigue descartando en teléfono y administración, agregando en `tests/manual-reservation.test.ts` un caso de creación de WhatsApp con valor fijado y ajustando el caso que hoy lista `["admin", "phone", "whatsapp"]` como no elegibles a `["admin", "phone"]`.
- [x] 2.2 En `src/features/admin/manual-reservation-form.tsx`, confirmar que el campo de valor por noche aparece al elegir WhatsApp y volver neutral el rótulo "Valor por noche del canal" (design.md decisión 3). Verificar con el test del formulario de creación manual, cubriendo que el campo aparece con WhatsApp y no con teléfono.

## 3. Edición posterior en el detalle

- [x] 3.1 En `app/(admin-protected)/admin/reservas/[id]/page.tsx`, separar la condición única en `allowsManualRate` (puerta del formulario de valor por noche, derivada del predicado compartido) e `isExternalPlatformOrigin` (aviso de plataforma externa y `externalChannelLabel`), según design.md decisión 2. Verificar que una reserva de WhatsApp muestra el formulario de valor por noche y no muestra el aviso de plataforma externa.
- [x] 3.2 Actualizar `tests/admin-reservation-detail-nightly-rate.test.tsx`: WhatsApp pasa a esperar el formulario presente, teléfono/web/administración lo siguen esperando ausente, y añadir el caso de que WhatsApp no renderiza el aviso "no se refleja en la plataforma". Verificar que el archivo de test pasa completo.
- [x] 3.3 Volver neutral el texto "Registra lo que cobró el canal" en `src/features/admin/edit-reservation-nightly-rates-form.tsx` y el mensaje de rechazo "Solo las reservas de Airbnb y Booking admiten un valor por noche propio" en `src/features/admin/edit-reservation-nightly-rates-core.ts`. Verificar con `tests/edit-reservation-nightly-rates-action.test.ts`, ajustando las aserciones de mensaje.
- [x] 3.4 En `tests/edit-reservation-nightly-rates.test.ts`, mover `"whatsapp"` del conjunto que se rechaza al conjunto que se acepta y agregar un caso que fije el valor por noche de una reserva de WhatsApp verificando subtotal, total, conciliación de pagos y auditoría. Verificar que el archivo de test pasa completo.

## 4. Corrección de origen

- [x] 4.1 En `tests/edit-reservation-origin.test.ts`, cubrir que una corrección de Booking a WhatsApp y de WhatsApp a Airbnb conserva el valor fijado a mano sin tocar total ni pagos, y que WhatsApp a teléfono lo descarta y repricea (design.md decisión 4). Verificar que los casos nuevos pasan sin cambios en `edit-reservation-origin.ts` más allá del renombre.
- [x] 4.2 Verificar que la advertencia previa a confirmar de `src/features/admin/edit-reservation-origin-form.tsx` no aparece al elegir WhatsApp en una reserva con valor manual y sí aparece al elegir teléfono, con un test del formulario de corrección de origen.

## 5. Verificación y cierre

- [x] 5.1 Correr `npm run typecheck`, `npm run lint`, `npm test` y `npm run build` y dejar constancia de los resultados; `build` es obligatorio porque los cambios tocan módulos `"use server"`.
- [x] 5.2 Actualizar el `## Purpose` de `openspec/specs/reservation-rate-and-channel-editing/spec.md`, que hoy atribuye el valor por noche a "un canal externo", para que incluya el precio acordado por mensaje. Verificar con `openspec validate --specs --strict`.
