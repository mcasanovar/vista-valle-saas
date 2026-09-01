## Why

El bloqueo manual actualmente rechaza toda la selección cuando una habitación tiene una reserva superpuesta, aunque el administrador puede necesitar cerrar igualmente el resto de las habitaciones y asumir explícitamente ese solapamiento operativo. La interfaz debe hacer visible el día y las habitaciones afectadas antes de permitir una decisión irreversible.

## What Changes

- Separar la revisión de conflictos de la confirmación de creación de bloqueos.
- Mostrar, antes de crear, cada fecha afectada y las habitaciones seleccionadas que tienen una reserva superpuesta.
- Permitir confirmar explícitamente la creación de todos los bloqueos seleccionados, incluidos los que se superponen con reservas, sin modificar ni cancelar esas reservas.
- Permitir cancelar la revisión sin crear bloques ni alterar disponibilidad o auditoría.
- Mantener autorización administrativa, revalidación server-authoritative, auditoría por habitación y feedback claro de la decisión.

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `reservation-administration`: cambia el tratamiento administrativo de conflictos al crear bloqueos manuales para permitir un override confirmado y auditable.

## Impact

- Afecta el dominio y las Server Actions de `src/features/room-blocks`, el formulario de `/admin/bloqueos` y sus adaptadores mock/PostgreSQL.
- Amplía los resultados tipados de creación para distinguir revisión requerida, confirmación y cancelación.
- No modifica reservas existentes, no introduce proveedores nuevos ni cambia el esquema de fechas.
- Requiere pruebas unitarias, PostgreSQL y Playwright para conflicto, confirmación, cancelación y ausencia de efectos parciales antes de confirmar.
