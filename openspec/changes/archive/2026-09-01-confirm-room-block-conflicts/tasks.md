## 1. Dominio y contratos

- [x] 1.1 Definir tipos para la revisión de conflictos agrupada por fecha, habitación y fuente de ocupación, y verificar que mock y PostgreSQL compilan con el contrato compartido
- [x] 1.2 Implementar la consulta server-side de conflictos para un intervalo y habitaciones seleccionadas, verificando con pruebas unitarias que devuelve todas las fechas/habitaciones afectadas sin escribir datos
- [x] 1.3 Ampliar el caso de uso/Server Actions de bloqueo con revisión y confirmación explícita, verificando autorización, validación de entrada y revalidación dentro de la operación atómica

## 2. Persistencia y seguridad

- [x] 2.1 Adaptar los gateways mock y PostgreSQL para permitir, sólo tras confirmación autorizada, bloqueos superpuestos sin modificar reservas, retenciones ni bloqueos existentes; verificar con pruebas de integración que la inserción es all-or-nothing
- [x] 2.2 Registrar de forma segura la confirmación con conflictos en la auditoría existente y verificar que no se persisten datos personales innecesarios
- [x] 2.3 Cubrir carreras entre revisión y confirmación, entradas manipuladas y usuarios no autorizados; verificar que no quedan bloqueos parciales ni se confía en disponibilidad del cliente

## 3. Interfaz de administración

- [x] 3.1 Integrar la revisión en el formulario de `/admin/bloqueos` sin romper el flujo sin conflictos y verificar mensajes de validación y estados de carga/error
- [x] 3.2 Crear el resumen accesible de conflictos por fecha y habitación con advertencia, y botones inequívocos de confirmar/cancelar; verificar teclado, foco, etiquetas y cierre sin escritura al cancelar
- [x] 3.3 Tras confirmar, actualizar listado y calendario mostrando todos los bloqueos seleccionados; verificar que una cancelación deja el listado, calendario y formulario sin cambios persistidos

## 4. Verificación de aceptación

- [x] 4.1 Añadir pruebas E2E del caso de tres habitaciones con una reserva superpuesta: mostrar día y habitación, cancelar sin filas nuevas y confirmar creando las tres sin alterar la reserva
- [x] 4.2 Ejecutar pruebas unitarias, integración PostgreSQL con `VISTA_VALLE_POSTGRES_INTEGRATION_URL`, lint, typecheck y build; documentar resultados y cualquier riesgo residual
