## Why

La solicitud empresarial está embebida en el landing y actualmente solo funciona como una demostración sin cálculo, persistencia ni envío real. Vista Valle necesita una experiencia dedicada en `/cotizacion-empresa` que permita cotizar múltiples habitaciones para una cantidad total de personas y entregar al cliente un resumen calculado por correo.

## What Changes

- Retirar el formulario empresarial del landing y conservar únicamente el botón “Solicitar cotización”.
- Crear la página dedicada `/cotizacion-empresa` con una experiencia profesional y coherente con el sistema.
- Permitir seleccionar cantidades de habitaciones por tipo y calcular automáticamente noches, subtotales y total.
- Mostrar desde el inicio la capacidad máxima por habitación y validar la capacidad acumulada contra la cantidad total de personas solicitada.
- Usar inicialmente precios y capacidades mock, manteniendo contratos preparados para reemplazarlos por datos de PostgreSQL.
- Persistir la solicitud y el snapshot de los valores calculados mediante un repositorio mock y una ruta preparada para PostgreSQL.
- Generar una plantilla de correo para el cliente con el resumen y los valores de la cotización.
- Generar una plantilla de correo operativo para Vista Valle con los datos completos de la solicitud.
- Preparar la integración con Resend usando `Vista Valle SpA <reservas@vistavalle.cl>` como remitente, con transporte mock hasta disponer de un dominio verificado.
- Mantener idempotencia, reintentos y estados seguros de entrega para no duplicar cotizaciones ni correos.

## Capabilities

### New Capabilities

- `company-quotation-flow`: Solicitud empresarial multi-habitación, cálculo autoritativo, persistencia y notificaciones por correo.

### Modified Capabilities

<!-- No existing requirement changes are needed; the room capacity changes are part of the mock data contract for the new capability. -->

## Impact

- Frontend: nueva ruta, formulario dedicado, selección de cantidades, resumen de capacidad y cotización.
- Backend: validación server-side, cálculo de precios, endpoint de envío y contratos de repositorio.
- Datos: solicitud de cotización, líneas por tipo de habitación, snapshots de precio/capacidad y migración PostgreSQL preparada.
- Notificaciones: nuevas plantillas de correo, transporte Resend mock/real y extensión del outbox para entidades distintas de reservas.
- Configuración: remitente, destinatario operativo, modo mock y futura activación de Resend mediante variables server-only.
- Pruebas: unitarias, integración, E2E, accesibilidad, persistencia, renderizado de plantillas y ausencia de llamadas externas en mock.
