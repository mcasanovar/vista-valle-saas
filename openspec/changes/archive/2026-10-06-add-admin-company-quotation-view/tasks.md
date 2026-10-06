## 1. Capa de datos de lectura

- [x] 1.1 Crear `src/infrastructure/database/admin-company-quotation-source.ts` con `listAdminCompanyQuotations(db, filter)`, replicando la paginación en dos fases de `admin-reservation-source.ts`, y verificar con un test de integración que la fase 1 (IDs filtrados) y la fase 2 (detalle liviano) devuelven resultados consistentes con datos de prueba con varias líneas por cotización.
- [x] 1.2 Implementar los filtros de búsqueda (texto libre sobre empresa/contacto/email/teléfono), rango de check-in, rango de check-out y estado de entrega de notificación, y verificar cada filtro con un test que confirma que excluye cotizaciones que no coinciden.
- [x] 1.3 Implementar `getAdminCompanyQuotationDetail(db, id)` devolviendo cotización + líneas + desayuno + estado de entrega de sus notificaciones asociadas, y verificar con un test que una cotización con varias líneas y con/sin desayuno se lee completa.
- [x] 1.4 Verificar con un test que ambas funciones llaman `requireAdministrator()` y rechazan la lectura sin autorización administrativa, replicando el patrón de `admin-reservation-source.ts:147`.

## 2. Páginas del admin

- [x] 2.1 Crear `app/(admin-protected)/admin/cotizaciones/page.tsx` (Server Component) que llama `requireAdministrator()`, lee `searchParams` (search, checkInFrom/To, checkOutFrom/To, deliveryStatus, page) y renderiza la tabla con los filtros aplicados; verificar manualmente que paginar y filtrar actualiza la URL y el contenido como en `/admin/reservas`.
- [x] 2.2 Crear `app/(admin-protected)/admin/cotizaciones/[id]/page.tsx` que llama `requireAdministrator()`, carga `getAdminCompanyQuotationDetail` y usa `notFound()` si no existe; verificar manualmente que un ID inexistente muestra la página de no encontrado sin exponer datos de otras cotizaciones.
- [x] 2.3 En la página de detalle, mostrar secciones: Empresa/Contacto, Estadía, Líneas por habitación, Desayuno (solo si fue solicitado), Total, Mensaje libre (solo si existe), Estado de entrega de notificaciones; verificar visualmente con una cotización de prueba de cada variante (con y sin desayuno, con una y con varias líneas).

## 3. Componentes de UI

- [x] 3.1 Crear `src/features/admin/company-quotation-row.tsx` (fila clicable hacia `/admin/cotizaciones/{id}`), análogo a `reservation-row.tsx`, y verificar que la fila completa es navegable por click y por teclado. — Resuelto reutilizando el componente en vez de clonarlo: `reservation-row.tsx` ya era totalmente genérico (solo `href` + `children`), así que se renombró a `admin-table-row.tsx` (`AdminTableRow`) y lo comparten reservas y cotizaciones.
- [x] 3.2 Crear `src/features/admin/cotizaciones-pagination.tsx`, análogo a `reservations-pagination.tsx` pero apuntando a `/admin/cotizaciones`, y verificar que conserva los filtros activos al cambiar de página.
- [x] 3.3 Crear `src/features/admin/cotizaciones-filter-bar.tsx` con los controles de búsqueda, rango de fechas y estado de entrega, y verificar que al aplicar un filtro la URL refleja los parámetros correspondientes.

## 4. Navegación

- [x] 4.1 Agregar la entrada "Cotizaciones" (`/admin/cotizaciones`) en `navigationGroups` de `src/features/admin/admin-shell.tsx`, junto a "Reservas", y verificar visualmente que aparece en el sidebar desktop, el sidebar compacto y el menú "Más" móvil.
- [x] 4.2 Verificar que `isActiveRoute` resalta correctamente "Cotizaciones" al navegar a `/admin/cotizaciones` y a `/admin/cotizaciones/[id]`, sin interferir con el resaltado de "Reservas".

## 5. Validación de especificación

- [x] 5.1 Ejecutar `openspec validate add-admin-company-quotation-view --strict` y verificar que no reporta errores.
- [x] 5.2 Probar manualmente en local el flujo completo: crear una cotización de prueba vía el formulario público, confirmar que aparece en `/admin/cotizaciones`, abrir su detalle y verificar que coincide con el contenido del correo admin de esa misma cotización.
