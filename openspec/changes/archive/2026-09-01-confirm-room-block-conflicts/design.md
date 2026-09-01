## Context

El flujo actual intenta crear todos los bloqueos en una operación y rechaza la operación cuando la revalidación detecta una reserva, retención o bloqueo superpuesto. La pantalla de `/admin/bloqueos` ya dispone de selección de habitaciones, intervalo, motivo y acciones de servidor. Ver `proposal.md` y la especificación modificada para el comportamiento esperado.

## Goals / Non-Goals

**Goals:**

- Separar una revisión de conflictos sin escritura de la confirmación que sí crea los bloqueos.
- Entregar conflictos agrupados por fecha de alojamiento y habitación, con nombres confiables del servidor.
- Mantener autorización, revalidación server-authoritative, atomicidad, auditoría y compatibilidad con mock y PostgreSQL.
- Hacer que confirmar y cancelar sean acciones explícitas y accesibles en la interfaz.

**Non-Goals:**

- No modificar, cancelar ni reprogramar reservas existentes.
- No cambiar el modelo de reservas, el calendario público, precios ni políticas de disponibilidad para huéspedes.
- No permitir que el navegador decida qué conflictos existen ni omitir la revalidación al confirmar.

## Decisions

1. **Previsualización server-side antes de escribir.** Añadir una operación de revisión al dominio/Server Action que valide sesión, habitaciones, motivo e intervalo y consulte la ocupación vigente por cada fecha y habitación. Devuelve un resultado tipado `clear` o `conflicts`, con fecha, habitación y tipo/identificador de la ocupación. La revisión no inserta, retira ni audita registros.

2. **Confirmación explícita con revalidación.** La UI enviará la selección original y una señal explícita de confirmación (no una lista de disponibilidad confiada al cliente). El servidor repetirá autorización, validación de entrada y consulta de conflictos dentro de la transacción; si la confirmación es válida, insertará un bloqueo por cada habitación seleccionada para el intervalo completo, incluso cuando haya ocupación superpuesta. No se modificarán filas de reservas, retenciones ni bloqueos previos.

3. **Atomicidad y auditoría.** La inserción de todos los bloqueos seguirá siendo all-or-nothing. La auditoría de creación incluirá que la operación fue confirmada con conflictos y sus referencias resumidas, sin registrar datos personales innecesarios. Si una carrera cambia la selección o el intervalo, la confirmación falla de forma segura y no deja bloqueos parciales.

4. **Resumen accesible en la UI.** El formulario mostrará un diálogo o panel de confirmación con cada fecha afectada y las habitaciones agendadas, un aviso de que el bloqueo puede coexistir con la reserva, y botones claramente diferenciados `Confirmar bloqueo` y `Cancelar`. Cancelar sólo cierra/limpia la revisión y mantiene el formulario sin efectos persistidos.

5. **Sin migración.** Se reutilizan las tablas, repositorios y adaptadores existentes; sólo se amplían tipos, servicios y pruebas. Si la auditoría actual no admite metadatos estructurados, se conserva el formato existente y se registra un motivo técnico seguro, sin alterar el esquema.

## Risks / Trade-offs

- **[Riesgo]** Un bloqueo confirmado sobre una reserva puede producir una contradicción operativa en el calendario. → Mostrar advertencia inequívoca, exigir confirmación y conservar ambas trazas para resolución administrativa.
- **[Riesgo]** La ocupación puede cambiar entre revisión y confirmación. → Reconsultar dentro de la transacción y mantener atomicidad; el resumen se considera informativo, no una autorización persistida.
- **[Riesgo]** La lista de conflictos puede ser extensa. → Agrupar por fecha, ordenar por fecha y nombre, y limitar sólo la presentación; nunca truncar la decisión del servidor.
- **[Riesgo]** Mock y PostgreSQL podrían divergir. → Cubrir ambos gateways con las mismas pruebas de contrato y una prueba E2E del flujo completo.

## Migration Plan

1. Desplegar tipos, revisión y confirmación detrás del formulario existente; el flujo sin conflictos conserva su camino actual.
2. Verificar pruebas unitarias, de gateway PostgreSQL, lint, typecheck y E2E antes de habilitar el diálogo.
3. No hay migración de base de datos. Para rollback, revertir el código: los bloqueos ya creados permanecen como registros válidos y pueden retirarse desde el panel.
