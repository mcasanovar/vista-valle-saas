## 1. Dominio y persistencia de bloqueos

- [x] 1.1 Ampliar el contrato de creación de bloqueos para aceptar una lista no vacía de habitaciones distintas y crear todos sus registros de forma atómica, con locks adquiridos en orden estable y revalidación de conflictos; verificar con pruebas unitarias que un conflicto revierte toda la selección en mock.
- [x] 1.2 Implementar la transacción PostgreSQL multi-habitación para bloqueos y auditorías por habitación, agregando una migración e índices no destructivos sólo si la consulta de historial los requiere; verificar con pruebas de integración que un fallo o conflicto no deja bloques ni eventos parciales.
- [x] 1.3 Extender los contratos de lectura para listar y obtener detalle de bloqueos activos y retirados, con habitación, intervalo, motivo, creador, retiro y auditoría; verificar pruebas de repositorio mock y PostgreSQL con filtros de habitación, solapamiento, motivo y estado.
- [x] 1.4 Mantener el retiro lógico autorizado y exponer resultados tipados de creación, conflicto, detalle y retiro que no filtren datos ajenos; verificar pruebas de acciones que rechacen actores no autorizados y que conserven la auditoría al retirar.

## 2. Ruta y experiencia administrativa

- [x] 2.1 Reestructurar `/admin/bloqueos` como página servidor que lea filtros URL, habitaciones confiables, resultados paginados y parámetros de creación rápida; verificar con pruebas de ruta que los parámetros precargan sin conceder confianza al cliente.
- [x] 2.2 Construir el formulario accesible de creación con selector de una o varias habitaciones, rango de alojamiento, noches, motivos sugeridos o texto libre, resumen de selección y feedback de carga/error; verificar pruebas de componente para foco, etiquetas, validación y estado pendiente.
- [x] 2.3 Crear el listado filtrable y paginado de activos/retirados con detalle de trazabilidad, y una confirmación accesible de retiro que no haga mutación al cancelarse; verificar pruebas de componente para filtros combinados, detalle y confirmación.
- [x] 2.4 Conservar la integración de creación rápida desde calendario y presentar los resultados de la creación o conflicto sin desincronizar el calendario; verificar pruebas de componente para fecha/habitación precargadas y revalidación de las rutas afectadas.

## 3. Calidad transversal

- [x] 3.1 Añadir pruebas unitarias y de integración para fechas `[check-in, check-out)`, selección múltiple, conflictos concurrentes, historial, auditoría y autorización en contextos mock y PostgreSQL.
- [x] 3.2 Añadir cobertura Playwright de creación individual y múltiple, conflicto sin efectos parciales, filtros, detalle, retiro confirmado/cancelado y creación iniciada desde el calendario, verificando móvil, tablet y escritorio.
- [x] 3.3 Ejecutar typecheck, lint, suites relevantes, build de prueba y revisión de accesibilidad por teclado; verificar que el módulo no importe servicios server-only desde componentes cliente y que las operaciones sigan siendo server-authoritative.
