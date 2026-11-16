## MODIFIED Requirements

### Requirement: Confirmación al huésped
El sistema SHALL enviar al correo del huésped una confirmación con su nombre, número de reserva, todas las habitaciones, subtotales, check-in, check-out, noches, total, modalidad de pago y contacto de Vista Valle, únicamente cuando la reserva se originó en el sitio web. Si la reserva solicita factura, SHALL enviar el mismo detalle al correo de facturación. Una reserva ingresada desde el panel de administración —teléfono, WhatsApp, Airbnb, Booking o admin— NO SHALL generar esta confirmación.

#### Scenario: Confirmación con pago al llegar
- **WHEN** se crea desde el sitio web una reserva confirmada bajo pago al llegar
- **THEN** el sistema programa un correo con el detalle completo que indica que la reserva está confirmada y el pago está pendiente para la llegada, y saluda al huésped por su nombre

#### Scenario: Reserva ingresada desde el panel
- **WHEN** un administrador crea una reserva con cualquier origen distinto del sitio web
- **THEN** el sistema no programa ninguna confirmación para el huésped

#### Scenario: Factura solicitada con correos distintos
- **WHEN** una reserva web confirmada solicita factura y el correo de facturación difiere del correo del huésped
- **THEN** el sistema programa una confirmación para cada destinatario con el mismo detalle de reserva

#### Scenario: Factura solicitada con correo duplicado
- **WHEN** una reserva web confirmada solicita factura y ambos correos coinciden tras normalizar espacios y mayúsculas/minúsculas
- **THEN** el sistema programa una sola confirmación para ese destinatario

### Requirement: Alerta administrativa
El sistema SHALL notificar al destinatario administrativo configurado cuando se confirme una nueva reserva originada en el sitio web, e indicar el nombre del huésped que reservó, el origen y que corresponde bloquear Airbnb y Booking. Una reserva ingresada desde el panel de administración NO SHALL generar esta alerta, porque quien la recibiría es quien acaba de crearla.

#### Scenario: Reserva desde el sitio
- **WHEN** una reserva web queda confirmada
- **THEN** el administrador recibe una alerta con el nombre del huésped que solicita completar la sincronización manual de canales

#### Scenario: Reserva ingresada desde el panel
- **WHEN** un administrador crea una reserva con cualquier origen distinto del sitio web
- **THEN** el sistema no programa ninguna alerta administrativa para esa reserva
