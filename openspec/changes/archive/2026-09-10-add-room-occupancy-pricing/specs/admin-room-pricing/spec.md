## Purpose

Permite a un administrador autorizado ver y editar, habitación por habitación, el precio para 1 persona y el precio para 2 personas, o marcarla con un precio fijo indistinto de la ocupación, desde el panel admin.

## ADDED Requirements

### Requirement: Listado de habitaciones con su configuración de tarifas
El sistema SHALL mostrar, en el panel admin, cada habitación activa junto con el estado de su configuración de tarifas (tarifas diferenciadas, precio fijo, o precio único para habitaciones de capacidad 1) y un acceso para editarla.

#### Scenario: Habitación con tarifas diferenciadas
- **WHEN** el administrador abre el listado de habitaciones
- **THEN** el sistema identifica cuáles tienen tarifas distintas para 1 y 2 personas, cuáles tienen precio fijo, y cuáles son de capacidad 1 sin distinción de ocupación

### Requirement: Edición de precio por ocupación
El sistema SHALL permitir al administrador editar el precio para 1 persona y el precio para 2 personas de una habitación con capacidad mayor a 1, validando en el servidor que cada valor sea un entero positivo en CLP antes de guardar, y SHALL rechazar el guardado completo si algún valor no es válido.

#### Scenario: Guardado válido
- **WHEN** el administrador edita el precio para 1 persona y el precio para 2 personas de una habitación con valores enteros positivos
- **THEN** el sistema guarda ambos precios y los refleja de inmediato en el listado

#### Scenario: Valor inválido
- **WHEN** el administrador intenta guardar un precio vacío, negativo o no numérico para alguna de las dos ocupaciones
- **THEN** el sistema rechaza el guardado, no modifica las tarifas existentes y señala el campo inválido

### Requirement: Precio fijo independiente del huésped adicional
El sistema SHALL permitir marcar una habitación con capacidad mayor a 1 para cobrar el mismo precio sin importar si se aloja 1 o 2 personas, SHALL sincronizar el precio de 2 personas con el precio de 1 persona mientras esa marca esté activa, y SHALL permitir editar ambos precios de forma independiente al desactivarla.

#### Scenario: Activar precio fijo
- **WHEN** el administrador marca una habitación para cobrar el mismo precio en ambas ocupaciones
- **THEN** el sistema sincroniza el precio de 2 personas con el precio de 1 persona y bloquea su edición independiente mientras la marca esté activa

#### Scenario: Desactivar precio fijo
- **WHEN** el administrador desmarca una habitación previamente configurada con precio fijo
- **THEN** el sistema permite editar el precio de 2 personas de forma independiente, partiendo del último valor sincronizado

### Requirement: Habitaciones de capacidad 1 sin distinción de ocupación
El sistema SHALL presentar un único campo de precio por noche, sin la marca de precio fijo ni el campo de precio para 2 personas, para una habitación cuya capacidad sea 1.

#### Scenario: Editar habitación de una sola plaza
- **WHEN** el administrador abre la edición de tarifas de una habitación con capacidad 1
- **THEN** el sistema muestra únicamente un precio por noche, sin ofrecer la distinción por ocupación

### Requirement: Reflejo inmediato en el sitio público
El sistema SHALL asegurar que una tarifa guardada para una habitación esté disponible para la búsqueda de disponibilidad, el detalle de la habitación y el carro de reserva sin requerir un despliegue ni una intervención manual adicional.

#### Scenario: Nueva tarifa visible en disponibilidad
- **WHEN** el administrador guarda un cambio de tarifa para una habitación publicada
- **THEN** un visitante que consulta disponibilidad después de ese cambio ve el precio actualizado para esa ocupación

### Requirement: Autorización y auditoría de cambios de tarifa
Solo un administrador autenticado SHALL poder editar las tarifas de una habitación, y el sistema SHALL registrar actor, fecha y valores guardados de cada cambio de tarifa.

#### Scenario: Intento no autenticado
- **WHEN** una solicitud sin sesión administrativa válida intenta editar tarifas de una habitación
- **THEN** el sistema rechaza la operación sin modificar las tarifas existentes

#### Scenario: Cambio auditado
- **WHEN** un administrador autenticado guarda un cambio de tarifa
- **THEN** el sistema conserva un registro de auditoría con el responsable, la fecha y los valores guardados
