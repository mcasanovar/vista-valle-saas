## Context

El formulario actual de `/admin/reservas/nueva` es de una habitación, usa entradas libres para habitación/fechas y omite comentario y factura. El dominio ya ofrece creación de pago al llegar y bloqueo multi-habitación; el nuevo flujo debe reutilizarlos. La primera ampliación del servicio sólo opera en mock, lo que contradice que la administración protegida debe poder registrar reservas reales; esta modificación incorpora la adaptación persistente de producción. Ver `proposal.md` para la motivación.

## Goals / Non-Goals

**Goals:**
- Un flujo administrativo que cubra los mismos datos de reserva del huésped público y múltiples habitaciones.
- Una única fuente server-side para disponibilidad, capacidad, tarifa, pago al llegar, auditoría y notificaciones.
- El mismo contrato administrativo en mock y producción, con dependencias de persistencia seleccionadas exclusivamente en el servidor.
- UI consistente con Reservas y feedback de carga accesible.

**Non-Goals:**
- Crear pagos online, cobrar manualmente durante la creación, o permitir editar importe/estado.
- Cambiar el flujo público, inventario, política de precios o proveedores de canales externos.

## Decisions

### 1. Reutilizar el comando multi-habitación de pago al llegar

La acción administrativa adaptará sus datos al comando de creación multi-habitación existente. El servidor obtiene habitaciones autorizadas, deriva precios y repite la validación de solapamiento dentro del bloqueo antes de persistir todas las filas y el pago pendiente.

**Alternativa descartada:** encadenar varias reservas de una habitación. Rompería la atomicidad y permitiría éxito parcial.

### 2. Selección basada en datos del servidor

El formulario carga habitaciones y disponibilidad desde una frontera autenticada y muestra controles seleccionables; los IDs, fechas, capacidad y tarifa se revalidan al enviar. Origen es un enum permitido; comentario y factura se mapean a los contratos públicos existentes.

**Alternativa descartada:** conservar entradas de texto libres para habitación y precio. Aumenta errores de operador y no es una fuente confiable.

### 3. Estados de interfaz reutilizables

La página usa los tokens `data-theme="admin"`, patrones de tarjetas/listados de Reservas y componentes de feedback compartibles: skeleton con shimmer para lectura inicial y spinner más etiqueta persistente para submit. Los estados de error usan mensajes próximos al campo y un resumen enfocable si hay varios errores.

**Alternativa descartada:** una página visualmente independiente o spinner sin texto. Reduciría consistencia y accesibilidad.

### 4. Persistencia transaccional por contexto

El adaptador administrativo resuelve en el servidor el catálogo, el repositorio de huéspedes, el repositorio de reservas, el gateway de bloqueo y el escritor de outbox del contexto activo. En producción, la creación se ejecuta dentro de una única transacción persistente que bloquea todas las habitaciones en un orden estable y vuelve a comprobar solapamientos antes de insertar huésped, reserva, ítems, pago pendiente y evento de notificación. Cualquier conflicto o fallo revierte toda la transacción.

**Alternativa descartada:** rechazar siempre el contexto productivo o combinar adaptadores mock y persistentes. La primera hace inutilizable el módulo administrativo real; la segunda puede dejar datos parciales o permitir que pruebas influyan en producción.

## Risks / Trade-offs

- [La disponibilidad cambia durante la captura] → sólo la validación dentro de la operación bloqueada decide la confirmación; la UI comunica conflicto y preserva datos.
- [Selección de muchas habitaciones complica móvil] → lista/tarjetas responsivas, objetivos táctiles y resumen persistente sin ocultar foco.
- [Factura incompleta] → validar antes de enviar y revalidar en el servidor, sin guardar una reserva parcial.

## Migration Plan

1. Reemplazar el formulario manual de una habitación sin migración de datos.
2. Verificar el flujo admin multi-habitación en mock y producción con operación autorizada, incluida la persistencia y reversión total ante conflicto.
3. Rollback: revertir la interfaz y adaptador; las reservas ya creadas conservan el modelo existente.
