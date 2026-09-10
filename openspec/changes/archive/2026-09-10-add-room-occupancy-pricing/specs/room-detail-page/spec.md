## MODIFIED Requirements

### Requirement: Tarjeta de precio y llamado a la acción
El sistema SHALL presentar una tarjeta de precio que, cuando la habitación admita más de un huésped, incluya un selector de ocupación (1 o 2 personas) cuyo precio por noche se actualice de inmediato al cambiar la selección; cuando la habitación admita solo 1 huésped, o aún no se haya elegido ocupación, SHALL mostrar el precio con la etiqueta "Desde" y la unidad por noche. La tarjeta SHALL incluir un botón de llamado a la acción hacia la disponibilidad o reserva de esa habitación con la ocupación elegida, y un enlace de retorno al catálogo de habitaciones.

#### Scenario: Interacción con la tarjeta de precio
- **WHEN** un visitante revisa la página de detalle de una habitación activa con capacidad 1, o de una con capacidad mayor antes de elegir ocupación
- **THEN** el sistema muestra el precio con la etiqueta "Desde" por noche, un botón que inicia el flujo de disponibilidad o reserva para esa habitación, y un enlace visible para volver al catálogo de habitaciones

#### Scenario: Selector de ocupación en el detalle
- **WHEN** un visitante revisa el detalle de una habitación con capacidad mayor a 1 y elige 1 o 2 personas
- **THEN** el sistema actualiza de inmediato el precio por noche mostrado en la tarjeta según la ocupación elegida, y esa ocupación se usa al continuar hacia disponibilidad o reserva
