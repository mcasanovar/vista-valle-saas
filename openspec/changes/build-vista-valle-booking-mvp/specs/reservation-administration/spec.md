## Purpose

Entregar a Vista Valle un panel protegido para operar el calendario, centralizar reservas propias y externas, registrar pagos presenciales y controlar la sincronización manual de canales.

## ADDED Requirements

### Requirement: Acceso administrativo protegido
El sistema SHALL exigir autenticación a una cuenta administrativa autorizada para acceder a datos de huéspedes y ejecutar operaciones del panel, sin ofrecer registro público de administradores.

#### Scenario: Visitante no autenticado
- **WHEN** una persona no autenticada solicita una ruta administrativa
- **THEN** el sistema impide el acceso y solicita autenticación

### Requirement: Calendario operativo
El sistema SHALL presentar por habitación las reservas, retenciones relevantes y bloqueos en una vista de calendario que permita identificar disponibilidad y origen.

#### Scenario: Revisión de una fecha
- **WHEN** el administrador consulta una fecha del calendario
- **THEN** puede distinguir disponibilidad, reserva, retención o bloqueo y abrir su detalle

### Requirement: Gestión de reservas
El sistema SHALL permitir listar, filtrar, consultar, modificar campos operativos permitidos y cambiar el estado de una reserva a cancelada, completada o no presentada. El detalle de una reserva SHALL identificar todas sus habitaciones, subtotales, total agregado y, cuando exista, la solicitud de factura sin exponer antecedentes tributarios innecesarios.

#### Scenario: Marcar no presentación
- **WHEN** el administrador marca una reserva confirmada como no presentada
- **THEN** el sistema conserva la reserva, registra el nuevo estado y su autoría

#### Scenario: Consulta de reserva con varias habitaciones
- **WHEN** el administrador abre una reserva que contiene varias habitaciones
- **THEN** puede identificar todos sus ítems y las fechas comunes para operar y completar el bloqueo manual de canales

### Requirement: Reservas manuales multicanal
El sistema SHALL permitir crear reservas manuales indicando como origen Airbnb, Booking, teléfono, WhatsApp o administración, aplicando las mismas validaciones de disponibilidad que una reserva web.

#### Scenario: Ingreso de reserva de Booking
- **WHEN** el administrador ingresa una reserva de Booking para una habitación disponible
- **THEN** el sistema la confirma y bloquea esas fechas para nuevas reservas web

#### Scenario: Reserva externa superpuesta
- **WHEN** el administrador intenta ingresar una reserva externa que se superpone con otra ocupación
- **THEN** el sistema rechaza la creación y muestra el conflicto existente

### Requirement: Bloqueos de habitación
El sistema SHALL permitir crear y eliminar bloqueos con habitación, intervalo y motivo sin representar el bloqueo como una reserva ficticia.

#### Scenario: Mantenimiento
- **WHEN** el administrador bloquea una habitación disponible por mantenimiento
- **THEN** el sistema la excluye de disponibilidad durante el intervalo indicado

### Requirement: Registro de pago presencial
El sistema SHALL permitir marcar como recibido el pago de una reserva de pago al llegar, registrando monto, fecha, medio y administrador responsable.

#### Scenario: Pago al check-in
- **WHEN** el administrador registra el pago completo de una reserva pendiente
- **THEN** el estado financiero refleja el pago recibido sin alterar incorrectamente las fechas de la reserva

### Requirement: Control de sincronización manual
El sistema SHALL marcar cada reserva web confirmada como pendiente de bloqueo externo y permitir registrar por separado que Airbnb y Booking fueron bloqueados.

#### Scenario: Nueva reserva web
- **WHEN** se confirma una reserva originada en el sitio
- **THEN** el panel la muestra en una cola visible con Airbnb y Booking pendientes

#### Scenario: Bloqueos externos completados
- **WHEN** el administrador confirma que bloqueó ambas plataformas
- **THEN** la reserva deja de aparecer como pendiente de sincronización manual y conserva quién y cuándo completó la tarea

### Requirement: Auditoría administrativa
El sistema SHALL registrar actor, fecha y cambio para operaciones sensibles sobre reservas, pagos, bloqueos y sincronización manual.

#### Scenario: Cancelación administrativa
- **WHEN** un administrador cancela una reserva
- **THEN** el sistema conserva un evento de auditoría con el estado anterior, el nuevo estado y el responsable

### Requirement: Autenticación administrativa aislada en contexto mock
El sistema SHALL ofrecer sesiones administrativas simuladas y persistencia controlada bajo un contexto mock explícito para validar el panel sin conectarse a Supabase Auth ni a una base externa, sin permitir que esas identidades sean aceptadas en producción.

#### Scenario: Validación local del panel
- **WHEN** se prueba una ruta administrativa bajo el contexto mock
- **THEN** el sistema utiliza una identidad controlada y adaptadores locales, aplica las mismas fronteras de autorización configuradas y no realiza solicitudes de red
