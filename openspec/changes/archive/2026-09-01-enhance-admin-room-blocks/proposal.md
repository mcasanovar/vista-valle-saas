## Why

El panel ya puede crear y retirar bloqueos individuales, pero exige identificadores manuales de habitación, ofrece poca visibilidad de los bloqueos vigentes y entrega escaso contexto para evitar liberaciones accidentales. La operación diaria necesita un módulo de bloqueos tan claro, auditable y adaptable como el de reservas.

## What Changes

- Reemplazar la captura manual de identificadores por selección segura de una o varias habitaciones y un rango de alojamiento accesible, con previsualización de noches y habitaciones afectadas.
- Crear múltiples bloqueos de habitación con un motivo común como una única operación atómica; conservar un registro individual por habitación para que la disponibilidad y auditoría sigan siendo precisas.
- Mejorar el listado de bloqueos con filtros por habitación, intervalo, motivo y estado activo/retirado, y una vista de detalle que muestre la trazabilidad del bloqueo.
- Permitir seleccionar motivos sugeridos o un motivo libre, y exigir una confirmación accesible antes de retirar un bloqueo.
- Mantener la edición como retiro seguido de recreación, preservando el historial de quién creó, retiró y cuándo cada bloqueo.
- Mantener la integración actual con creación rápida desde el calendario y con propuestas confirmadas del asistente, incluyendo los parámetros precargados.

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `reservation-administration`: Amplía la gestión de bloqueos de habitación para una operación administrativa filtrable, multi-habitación y completamente auditable.

## Impact

- Afecta la ruta protegida `/admin/bloqueos`, sus Server Actions, servicios de bloqueos y adaptadores mock/PostgreSQL.
- Reutiliza las reglas existentes de disponibilidad, bloqueo transaccional por habitación, auditoría, `America/Santiago` e intervalos `[check-in, check-out)`.
- Reutiliza el patrón de filtros por URL, componentes de fecha del dashboard y enlaces de creación rápida del calendario; no introduce proveedores externos ni cambios de esquema incompatibles.
