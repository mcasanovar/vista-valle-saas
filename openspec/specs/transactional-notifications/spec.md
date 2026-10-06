# transactional-notifications Specification

## Purpose

Informar oportunamente a huéspedes y administradores sobre reservas y pagos sin hacer que un fallo del proveedor de correo revierta una operación comercial ya confirmada.

## Requirements

### Requirement: Confirmación al huésped
El sistema SHALL enviar al correo del huésped una confirmación con número de reserva, todas las habitaciones, subtotales, check-in, check-out, noches, total, modalidad de pago y contacto de Vista Valle. Si la reserva solicita factura, SHALL enviar el mismo detalle al correo de facturación.

#### Scenario: Confirmación con pago al llegar
- **WHEN** se crea una reserva confirmada bajo pago al llegar
- **THEN** el sistema programa un correo con el detalle completo que indica que la reserva está confirmada y el pago está pendiente para la llegada

#### Scenario: Factura solicitada con correos distintos
- **WHEN** una reserva confirmada solicita factura y el correo de facturación difiere del correo del huésped
- **THEN** el sistema programa una confirmación para cada destinatario con el mismo detalle de reserva

#### Scenario: Factura solicitada con correo duplicado
- **WHEN** una reserva confirmada solicita factura y ambos correos coinciden tras normalizar espacios y mayúsculas/minúsculas
- **THEN** el sistema programa una sola confirmación para ese destinatario

### Requirement: Alerta administrativa
El sistema SHALL notificar al destinatario administrativo configurado cuando se confirme una nueva reserva e indicar su origen y si requiere bloquear Airbnb y Booking.

#### Scenario: Reserva desde el sitio
- **WHEN** una reserva web queda confirmada
- **THEN** el administrador recibe una alerta que solicita completar la sincronización manual de canales

### Requirement: Entrega desacoplada
El sistema SHALL persistir la intención de notificar antes de intentar el envío y SHALL reintentar fallos transitorios sin duplicar mensajes entregados.

#### Scenario: Proveedor de correo temporalmente caído
- **WHEN** el proveedor no acepta una notificación pendiente
- **THEN** la reserva mantiene su estado, el fallo queda registrado y el envío puede reintentarse

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

### Requirement: Privacidad del contenido
El sistema SHALL limitar los correos a la información necesaria para la operación y SHALL evitar incluir credenciales, secretos, datos internos de pago o antecedentes tributarios innecesarios.

#### Scenario: Correo de pago
- **WHEN** se genera una confirmación de pago
- **THEN** el mensaje no contiene tokens, credenciales ni payloads privados del proveedor

### Requirement: Trazabilidad de notificaciones
El sistema SHALL registrar tipo, destinatario, reserva asociada, estado, intentos y marca temporal de cada notificación.

#### Scenario: Revisión de correo fallido
- **WHEN** el administrador consulta una reserva cuya notificación falló
- **THEN** puede identificar el fallo y su estado sin acceder a secretos del proveedor
