## 1. Fuente de datos de solo lectura contra Postgres

- [x] 1.1 Crear `src/infrastructure/database/admin-reservation-source.ts` con la Fase 1 (IDs + conteo: predicados de búsqueda sobre `guests`, `EXISTS` contra `reservation_items`+`rooms` para nombre de habitación, filtros `checkIn`/`checkOut` como rango `{from, to}`, orden por `createdAt DESC`, `LIMIT`/`OFFSET`), y verificar con un test de integración que una reserva multi-habitación no se duplica ni corta entre páginas.
- [x] 1.2 Implementar la Fase 2 (detalle liviano de la página: reserva + huésped + todos los `reservation_items`) y verificar con un test que ensambla correctamente varias habitaciones por reserva.
- [x] 1.3 Implementar la función de detalle completo de una reserva (pagos, eventos de pago, sincronización de canales, auditoría) y verificar con un test que incluye todos esos datos para una reserva con pago y factura.
- [x] 1.4 Dejar de usar la fuente mock (`getAdminReservationSource` de `src/features/admin/reservations.ts`) y `getMockReservationPaymentAdminView`/`listMockReservationPaymentAdminViews` desde el módulo de reservas admin (listado y detalle), reemplazándolas por la nueva fuente de producción. **Ajuste de alcance decidido con el usuario**: `src/features/admin/reservations.ts` NO se elimina en este change, porque `src/features/admin/dashboard.ts` (pantalla Resumen) sigue dependiendo de él para sus KPIs y es explícitamente mock-only por diseño de `redesign-admin-dashboard-shell`; migrar Resumen a producción queda fuera de alcance aquí.

## 2. Búsqueda y filtros de fecha

- [x] 2.1 Implementar el predicado de búsqueda de texto libre (`ILIKE` sobre nombre/apellido/email/teléfono/RUT/empresa del huésped, `publicId`, nombre de habitación, excluyendo el comentario del huésped) y verificar con un test que cada campo buscable encuentra la reserva esperada y que el comentario no participa en la búsqueda.
- [x] 2.2 Implementar el filtro de fecha de llegada admitiendo fecha exacta y rango (`from === to` para exacta) y verificar con tests ambos casos, incluyendo los límites inclusivos del rango.
- [x] 2.3 Implementar el filtro de fecha de salida con la misma forma, combinable con el de llegada, y verificar con un test que ambos filtros aplican en conjunto (AND).
- [x] 2.4 Verificar con un test que el conteo total y el listado paginado son consistentes bajo cualquier combinación de filtros activos.

## 3. Listado (UI)

- [x] 3.1 Agregar la dependencia de calendario de rango (ej. `react-day-picker`) y confirmar que solo se carga en el bundle del layout admin protegido. (Instalada `react-day-picker@10`; se importará únicamente desde componentes bajo `(admin-protected)`, nunca desde el sitio público.)
- [x] 3.2 Reescribir `app/(admin-protected)/admin/reservas/page.tsx` para leer de la nueva fuente de datos (sin fallback mock), con el formulario de búsqueda (botón + Enter, sin debounce) y filtros de estado/origen existentes.
- [x] 3.3 Implementar el selector de fecha de llegada con el calendario de rango (clic único = fecha exacta, selección de rango = rango) y los chips rápidos (hoy, esta semana, próximos 7 días).
- [x] 3.4 Implementar el filtro de fecha de salida oculto tras "+ Agregar filtro de salida", revelado apilado verticalmente en todos los breakpoints, y verificar manualmente en 390px/834px/1440px que no rompe el layout.
- [x] 3.5 Implementar la paginación (20 por página) con navegación entre páginas que preserva los filtros activos en la URL.
- [x] 3.6 Verificar manualmente que buscar, filtrar por fecha (exacta y rango, llegada y salida combinadas) y paginar producen resultados consistentes entre sí sin recargar filtros perdidos.

## 4. Detalle de reserva (UI)

- [x] 4.1 Reescribir `app/(admin-protected)/admin/reservas/[id]/page.tsx` para consumir el detalle completo de la nueva fuente de datos, sin la bifurcación entre fuentes mock.
- [x] 4.2 Mostrar huésped, ítems por habitación con subtotales y total agregado, y la solicitud de factura solo cuando exista, sin datos tributarios no registrados.
- [x] 4.3 Mostrar el o los pagos asociados con su estado, monto y reembolsos, reutilizando el componente de reembolso Fintoc ya existente donde aplique.
- [x] 4.4 Mostrar el estado de sincronización de canales (Airbnb/Booking) y la línea de tiempo de auditoría (cambios de estado, quién y cuándo).
- [x] 4.5 Verificar manualmente el detalle de una reserva de una habitación, una multi-habitación, una con factura solicitada, y una sin ella.

## 5. Acciones sobre la reserva

- [x] 5.1 Conectar la acción de cancelar reserva a `transitionReservationState` contra la reserva real, sin restricción de fecha, y verificar con un test que cancela una reserva cuya fecha de llegada ya pasó igual que una futura.
- [x] 5.2 Conectar la acción de marcar no presentada (`no_show`) a `transitionReservationState` contra la reserva real y verificar con un test.
- [x] 5.3 Implementar la acción de registro de pago presencial contra Postgres (monto, fecha, medio, administrador responsable) para reservas `pay_at_property` con pago pendiente, sin restricción de fecha respecto al término de la estadía, y verificar con un test que acepta el registro días después del checkout.
- [x] 5.4 Verificar con un test que la acción de registro de pago presencial no está disponible (ni se ofrece) para una reserva pagada en línea con Fintoc.
- [x] 5.5 Mostrar en el detalle una señal visual cuando una reserva cancelada tiene un pago aprobado sin reembolsar, indicando que requiere resolución financiera manual.

## 6. Verificación final

- [x] 6.1 Ejecutar la suite de pruebas existente y verificar que no hay regresiones fuera del módulo de reservas admin. (Suite unitaria: 5 fallos preexistentes no relacionados en room-catalogue/room-detail/prebooking-review-controller; suite de integración Postgres: 10/10 pasando contra Postgres.app local.)
- [x] 6.2 Recorrer manualmente el flujo completo (buscar, filtrar por fecha, paginar, abrir detalle, cancelar, marcar no-show, registrar pago presencial) contra datos reales de producción antes de dar el change por completo. (Verificación del usuario detectó 8 gaps de UX/bugs — limpiar filtros, fila clicable, botón volver, botones de transición rotos por `type="button"` por defecto del átomo `Button`, nombre en sección huésped, columna/chip de factura, skeleton de carga — todos corregidos y reverificados.)
