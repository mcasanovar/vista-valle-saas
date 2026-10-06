## ADDED Requirements

### Requirement: Intento inmediato de entrega
El sistema SHALL intentar la entrega de una notificación recién encolada inmediatamente después de responder a la solicitud que la originó, de forma best-effort y sin bloquear esa respuesta. Si el intento inmediato no completa (por ejemplo, por fallo transitorio del proveedor o por interrupción de la invocación en curso), el procesador programado SHALL seguir siendo responsable de reintentar la notificación hasta su entrega o hasta agotar la política de reintentos.

#### Scenario: Entrega inmediata exitosa
- **WHEN** se encola una notificación como parte de procesar una solicitud
- **THEN** el sistema intenta entregarla justo después de responder al solicitante, sin que ese intento retrase la respuesta

#### Scenario: Intento inmediato no completa
- **WHEN** el intento inmediato de entrega no logra completarse
- **THEN** la notificación conserva su estado pendiente/reintentable en el registro de entregas y el procesador programado puede reintentarla más adelante, sin duplicar el envío si ya fue entregada

#### Scenario: Entrega dirigida, no por backlog completo
- **WHEN** el sistema intenta la entrega inmediata de las notificaciones de una solicitud específica
- **THEN** solo procesa las notificaciones generadas por esa solicitud, sin verse obligado a procesar el backlog completo de notificaciones pendientes de otras solicitudes
