## Why

La experiencia de cotización empresarial ya existe en modo mock, pero el CTA y el flujo deben quedar confiables para visitantes reales y conectados a la operación de Vista Valle. La cotización debe consultar disponibilidad para las fechas solicitadas, persistir la solicitud en PostgreSQL/Supabase y enviar un correo identificable de Vista Valle que indique que el cliente debe responder al mismo correo para confirmar los días y permitir la generación de la reserva.

## What Changes

- Asegurar que la sección empresarial de la landing muestre el CTA “Solicitar cotización” y navegue a `/cotizacion-empresa` en el contexto productivo cuando la cotización esté habilitada.
- Mantener el formulario completo únicamente en `/cotizacion-empresa`.
- Resolver disponibilidad real antes de mostrar el selector y el formulario: sin habitaciones disponibles se mostrará un mensaje y se ocultará el formulario; con al menos una habitación disponible se mostrarán las opciones y el formulario.
- Mantener la revalidación server-side de disponibilidad al enviar y la advertencia explícita para cotizaciones parciales.
- Persistir de forma atómica la cotización, sus líneas snapshot y las notificaciones asociadas en PostgreSQL/Supabase.
- Activar el outbox productivo, su fuente de datos, reintentos y procesador seguro para entregar correos.
- Habilitar el proveedor Resend exclusivamente server-side con dominio y remitente verificados.
- Rediseñar el correo del cliente con identidad visual de Vista Valle, resumen de fechas/habitaciones/valores y un bloque destacado que solicite responder al mismo correo confirmando los días cotizados.
- Mantener un correo operativo separado para Vista Valle con los datos necesarios para revisar la solicitud.
- Corregir la navegación del CTA y completar las pruebas unitarias, de integración y E2E del flujo productivo/mock.

## Capabilities

### New Capabilities

<!-- No se introduce una capacidad independiente; se activan y modifican capacidades existentes. -->

### Modified Capabilities

- `company-quotation-flow`: agrega la confirmación requerida por correo, preserva el gate de disponibilidad antes del formulario y define la entrega productiva de la solicitud.
- `production-infrastructure`: conecta las cotizaciones y el outbox a PostgreSQL/Supabase y habilita el procesamiento productivo de correo mediante Resend.

## Impact

- Frontend: CTA de la landing, página `/cotizacion-empresa`, estados de disponibilidad, mensajes y correcciones de navegación.
- Backend: ruta de disponibilidad, ruta POST de cotización, transacción de persistencia y revalidación de disponibilidad.
- Base de datos: uso productivo de `company_quotations`, `company_quotation_lines` y `notification_outbox`, incluyendo migraciones y verificación contra PostgreSQL.
- Notificaciones: repositorio de outbox productivo, fuente de datos productiva, worker, reintentos, remitente, Reply-To y plantillas HTML.
- Configuración: credenciales server-only de PostgreSQL/Supabase, Resend, dominio/remitente verificado, destinatario operativo y secreto del procesador.
- Verificación: regresión del flujo mock, pruebas de correo, idempotencia, fallos de proveedor, disponibilidad nula/parcial y pruebas E2E responsive/accesibles.
