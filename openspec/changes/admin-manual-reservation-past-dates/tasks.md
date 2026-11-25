## 1. Contrato de fechas del flujo administrativo

- [x] 1.1 En `src/features/admin/manual-reservation-contract.ts`, eliminar `manualReservationDateMinimums` y su dependencia de `publicAvailabilityDateMinimums`, y reducir `validateManualReservationDateRange` a una sola comprobación: la salida debe ser posterior a la entrada, reportada como error del campo `checkOut` con un mensaje en español (design decisión 1). Conservar el manejo tolerante de fechas malformadas, que siguen siendo responsabilidad de la validación de intervalo del dominio. Verificar con casos nuevos en `tests/manual-reservation-contract.test.ts` que una entrada anterior a hoy no produce error, que una estadía completamente pasada tampoco, y que un intervalo invertido o de un solo día sí.
- [x] 1.2 Eliminar la validación de fechas que quedó inalcanzable en el servidor: la llamada en `src/features/admin/manual-reservation.ts` y en `src/features/admin/manual-reservation-availability.ts` corre después de `createLodgingInterval`, que ya rechaza el intervalo invertido (design decisión 2). Eliminar con ella `ManualReservationDateRangeError` y su rama en `src/features/admin/manual-reservation-action.ts`, dejando `InvalidLodgingIntervalError` como el único error de fecha que la acción traduce al campo `checkOut`. Verificar con `npm run typecheck` y quitando de `tests/manual-reservation-action.test.ts` el caso que construía ese error.
- [x] 1.3 Confirmar que la frontera de importación del contrato no se rompe: debe seguir importando desde `@/features/availability/client-date-only` y nunca desde `@/features/availability`. Verificar con `tests/manual-reservation-client-boundary.test.ts`.

## 2. Formulario administrativo

- [x] 2.1 En `src/features/admin/manual-reservation-form.tsx`, quitar el `min` del control de entrada y hacer que el del control de salida sea la fecha de entrada elegida (design decisión 4), eliminando el uso de `manualReservationDateMinimums`. Verificar con `tests/manual-reservation-form.test.tsx` que el control de entrada no expone `min`, que el de salida lo toma de la entrada elegida, y reemplazar el caso «rechaza una entrada anterior a hoy» por uno que confirme que esa fecha se acepta y dispara la consulta de disponibilidad.
- [x] 2.2 Agregar a `tests/manual-reservation-form.test.tsx` un caso que confirme que un intervalo invertido se detiene en el cliente con el mensaje de salida inválida, sin llamar a la Server Action.

## 3. BFF de disponibilidad y creación

- [x] 3.1 Actualizar `tests/manual-reservation-availability.test.ts`: el caso «rejects dates before the public booking minimums» pasa a confirmar que `getManualReservationAvailability` resuelve las habitaciones libres para un intervalo pasado, y se agrega uno que confirme que un intervalo invertido sigue siendo rechazado como entrada inválida. `src/features/admin/manual-reservation-availability.ts` no requiere cambios propios más allá de la regla reducida que hereda del contrato.
- [x] 3.2 Verificar en `tests/manual-reservation.test.ts` que `createManualReservationFromInput` crea una reserva con entrada anterior a hoy y otra completamente pasada, y que un intervalo pasado superpuesto con una ocupación existente sigue fallando por conflicto de disponibilidad (escenarios «Estadía en curso registrada con retraso», «Estadía completamente pasada» y «Conflicto de disponibilidad en fechas pasadas»).
- [x] 3.3 Confirmar en `tests/manual-reservation-action.test.ts` que un `InvalidLodgingIntervalError` proveniente de la creación sigue llegando al administrador como error del campo `checkOut`.

## 4. No regresión del sitio público

- [x] 4.1 Confirmar que la regla pública sigue intacta, tanto en el buscador (`src/features/availability/search.ts`) como en la consulta de resultados (`src/features/availability/results-query.ts`), corriendo `tests/availability-date-only.test.ts` y los tests de búsqueda pública existentes sin modificarlos (escenario «La consulta pública conserva su regla»).

## 5. Verificación en navegador

- [x] 5.0 Crear `e2e/admin-manual-reservation-past-dates.spec.ts` con Playwright sobre Chromium, cubriendo: que el control de entrada ya no expone `min` y que el de salida se ancla a la entrada elegida; que una estadía en curso (entrada ayer, salida mañana) y una estadía ya terminada resuelven disponibilidad y se crean con éxito; que un intervalo invertido nombra la regla de fechas; y que la consulta pública sigue rechazando una entrada anterior a hoy. Confirmar que la prueba discrimina: restableciendo la regla pública en el contrato, los cuatro casos administrativos fallan y el de no regresión pública sigue pasando.
  - Las fechas se derivan de la fecha actual en `America/Santiago` dentro del propio spec, para que no caduquen como las de `tests/availability-search.test.ts`.
  - La prueba no puede verificar la ocupación resultante ni leer `/admin/reservas`: bajo el contexto mock en que corren los e2e el repositorio de disponibilidad es deliberadamente vacío y ese listado solo se renderiza contra datos de producción. La evidencia de creación es el estado de éxito de la Server Action, que solo se devuelve tras persistir la reserva.

## 6. Verificación integral

- [x] 6.1 Recorrer los escenarios del requisito «Registro de estadías ya iniciadas o pasadas» de `specs/admin-manual-reservations/spec.md` y confirmar que cada uno tiene una prueba que lo cubre; agregar la que falte.
- [x] 6.2 Correr la verificación completa del proyecto —`npm run lint`, `npm run typecheck`, `npm run test:unit` y `npm run build`.
  - `npm run lint`: 0 errores (3 advertencias preexistentes, ajenas a este cambio).
  - `npm run typecheck`: pasa.
  - `npm run test:e2e` del spec nuevo: 5 de 5 pasan en Chromium. `e2e/admin-manual-reservation-responsive.spec.ts` falla aparte, en `toHaveCSS("min-height", "56px")` sobre el label de una habitación: el markup ya no lleva esa altura mínima en el elemento que el test inspecciona. Es preexistente y ajeno a este cambio, cuyo diff no toca ese markup. Varios e2e administrativos más (`admin-edit-reservation-dates`, `admin-operations`, `admin-room-blocks`, `admin-assistant-integration`) fallan por leer `/admin/reservas`, que bajo el contexto mock responde «Las reservas no están disponibles.».
  - `npm run test:unit`: 1204 pasan, 8 fallan. Los 8 son preexistentes y ajenos: `tests/availability-search.test.ts` y `tests/availability-results.test.ts` usan fechas fijas de octubre de 2026 que la regla pública —intacta— ya rechaza por haber pasado, y `tests/prebooking-review-controller.test.tsx` falla en un assert de estructura DOM del flujo público de prebooking. Ninguno de los tres archivos ni su código de producción forma parte de este cambio.
  - `npm run build`: pasa («Compiled successfully», 27 páginas generadas), lo que confirma que el módulo `"use server"` tocado sigue exportando solo funciones async. El primer intento había fallado en `app/layout.tsx` al resolver las fuentes de Google con `next/font`: era falta de red, y webpack había dejado el módulo fallido en `.next/cache`, por lo que seguía fallando aun con red. Se resolvió borrando esa caché y repitiendo el build con red.
