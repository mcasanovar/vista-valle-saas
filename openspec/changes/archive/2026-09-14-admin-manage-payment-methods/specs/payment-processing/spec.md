## MODIFIED Requirements

### Requirement: Selección de modalidad de pago al confirmar reserva
El sistema SHALL permitir al huésped elegir entre pago al llegar y pago en línea al confirmar una reserva, restringido a los métodos que el administrador tenga habilitados en la configuración de métodos de pago, y SHALL registrar la modalidad elegida (`pay_at_property` o `pay_now`) junto con el proveedor de pago usado cuando la modalidad sea pago en línea. El sistema SHALL validar en el servidor, al recibir la solicitud de confirmación, que el método solicitado esté habilitado, además de ocultarlo en la interfaz cuando esté deshabilitado.

#### Scenario: Huésped elige pago en línea
- **WHEN** el huésped confirma una reserva y selecciona pago en línea, estando ese método habilitado
- **THEN** el sistema registra la reserva con modalidad `pay_now` y proveedor Fintoc, y no la marca como pagada hasta recibir confirmación del proveedor

#### Scenario: Huésped elige pago al llegar
- **WHEN** el huésped confirma una reserva y selecciona pago al llegar, estando ese método habilitado
- **THEN** el sistema registra la reserva con modalidad `pay_at_property` sin iniciar ningún flujo de pago en línea, igual que en el comportamiento existente

#### Scenario: Método deshabilitado no se muestra
- **WHEN** el administrador deshabilitó "pagar online" y el huésped llega al paso de selección de método de pago
- **THEN** el sistema no muestra la opción de pago en línea, mostrando únicamente los métodos habilitados

#### Scenario: Solicitud directa a un método deshabilitado
- **WHEN** una solicitud llega a los endpoints de confirmación de reserva pidiendo un método de pago que está deshabilitado, sin pasar por la interfaz de selección
- **THEN** el sistema rechaza la solicitud y no crea ni confirma la reserva con ese método

#### Scenario: Ambos métodos deshabilitados
- **WHEN** el administrador deshabilitó tanto "pagar al llegar" como "pagar online"
- **THEN** el sistema no muestra ninguna opción de pago en el paso de selección, sin un mensaje de bloqueo especial distinto al de la ausencia de opciones
