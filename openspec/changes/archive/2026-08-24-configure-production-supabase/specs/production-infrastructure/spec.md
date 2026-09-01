## Purpose

Definir el comportamiento verificable de la infraestructura productiva de Supabase de Vista Valle: aplicación repetible del esquema, cobertura de integración sobre el historial completo de migraciones, reconocimiento del administrador real configurado, y retroalimentación visible al usuario mientras las consultas contra Supabase están en curso — skeletons para carga de información, loading a nivel de botón para acciones y navegación.

## ADDED Requirements

### Requirement: Aplicación repetible de migraciones
El sistema SHALL proveer un comando que aplique, de forma idempotente, todas las migraciones de Drizzle versionadas contra la base de datos configurada por `DATABASE_URL`, sin requerir edición manual de tablas.

#### Scenario: Primera aplicación sobre una base vacía
- **WHEN** se ejecuta el comando de migración contra una base de datos Postgres vacía
- **THEN** el sistema crea todas las tablas, tipos, restricciones e índices definidos por el esquema Drizzle vigente

#### Scenario: Reejecución sobre una base ya migrada
- **WHEN** se ejecuta el comando de migración nuevamente contra una base que ya tiene todas las migraciones aplicadas
- **THEN** el sistema no falla ni duplica objetos, y la base queda en el mismo estado

### Requirement: Cobertura de integración sobre el historial completo de migraciones
El sistema SHALL verificar mediante pruebas de integración contra PostgreSQL el esquema resultante de aplicar todas las migraciones versionadas existentes, no solo la migración inicial.

#### Scenario: Ejecución de la suite de integración
- **WHEN** se ejecuta la suite de integración de PostgreSQL
- **THEN** el esquema de verificación reproduce cada migración versionada existente, incluyendo las tablas de cotizaciones de empresa y de reservas multi-habitación

### Requirement: Reconocimiento del administrador productivo
El sistema SHALL autenticar y autorizar como administrador, bajo el contexto `production`, únicamente a la cuenta configurada en `ADMIN_ALLOWED_EMAILS` que exista como usuario real en Supabase Auth, sin permitir registro público.

#### Scenario: Acceso del administrador configurado
- **WHEN** el correo administrador configurado inicia sesión bajo el contexto `production`
- **THEN** el sistema concede acceso al panel administrativo

#### Scenario: Intento de registro público
- **WHEN** cualquier visitante intenta registrarse como nuevo usuario bajo el contexto `production`
- **THEN** el sistema rechaza el registro público

### Requirement: Catálogo de habitaciones leído desde Postgres en producción
El sistema SHALL construir el catálogo público de habitaciones y su detalle, bajo el contexto `production`, a partir de las habitaciones activas en Postgres (con sus imágenes y servicios), en vez de una lista vacía o de datos de demostración.

#### Scenario: Catálogo con habitaciones activas reales
- **WHEN** existen habitaciones con `active=true` en la base de datos productiva
- **THEN** el catálogo y el detalle público las presentan, con sus imágenes y servicios asociados

#### Scenario: Sin habitaciones activas
- **WHEN** ninguna habitación está activa en la base de datos productiva
- **THEN** el catálogo se presenta vacío en vez de fallar o mostrar contenido de demostración

### Requirement: Búsqueda de disponibilidad calculada desde Postgres en producción
El sistema SHALL calcular la disponibilidad de una habitación, bajo el contexto `production`, a partir de las reservas confirmadas, las retenciones vigentes y los bloqueos activos en Postgres, usando la misma definición de ocupación que aplica el bloqueo transaccional al confirmar una reserva.

#### Scenario: Consulta de disponibilidad sin conflictos
- **WHEN** un visitante consulta disponibilidad para fechas en las que una habitación activa no tiene reservas confirmadas, retenciones vigentes ni bloqueos activos superpuestos
- **THEN** el sistema la presenta como disponible para esas fechas

#### Scenario: Consulta de disponibilidad con conflicto
- **WHEN** un visitante consulta disponibilidad para fechas que se superponen con una reserva confirmada, una retención vigente o un bloqueo activo de una habitación
- **THEN** el sistema no la presenta como disponible para esas fechas

### Requirement: Confirmación de reserva con pago al llegar escrita en Postgres en producción
El sistema SHALL, bajo el contexto `production`, persistir una reserva confirmada con pago al llegar (huésped, reserva, ítems por habitación y pago pendiente) usando bloqueo transaccional por habitación, en vez de rechazar la confirmación o simular su persistencia.

#### Scenario: Confirmación exitosa
- **WHEN** un visitante confirma una reserva de pago al llegar para una o más habitaciones activas y disponibles en esas fechas
- **THEN** el sistema crea el huésped, la reserva confirmada con sus ítems por habitación y un pago pendiente, y devuelve un identificador público de reserva

#### Scenario: Conflicto de disponibilidad al confirmar
- **WHEN** una habitación seleccionada deja de estar disponible para el intervalo solicitado antes de que la confirmación complete su bloqueo transaccional
- **THEN** el sistema rechaza la confirmación sin crear una reserva parcial

#### Scenario: Consulta de la confirmación pública
- **WHEN** se solicita la página de confirmación pública con el identificador de una reserva real ya creada
- **THEN** el sistema presenta los datos de esa reserva leídos desde Postgres, incluyendo huésped, habitaciones, fechas y total

### Requirement: Interruptor operativo de reservas
El sistema SHALL permitir pausar la aceptación de nuevas reservas reales mediante una configuración explícita, con la aceptación habilitada por defecto cuando esa configuración está ausente, y SHALL aplicar esa pausa únicamente bajo el contexto `production`.

#### Scenario: Reservas pausadas en producción
- **WHEN** la configuración de aceptación de reservas está explícitamente deshabilitada bajo el contexto `production`
- **THEN** el sistema rechaza la confirmación de nuevas reservas y lo comunica claramente al visitante, sin exponer el botón de confirmación como si fuera a funcionar

#### Scenario: Configuración ausente
- **WHEN** la configuración de aceptación de reservas no está definida
- **THEN** el sistema acepta reservas normalmente

#### Scenario: El interruptor no afecta el contexto mock
- **WHEN** el sistema corre bajo el contexto `mock`, sin importar el valor de la configuración de aceptación de reservas
- **THEN** el sistema acepta reservas normalmente

### Requirement: Skeletons para carga de información
El sistema SHALL envolver toda superficie que esté obteniendo información desde Supabase/Postgres (catálogo de habitaciones, detalle de habitación, resultados de disponibilidad por fechas, listados administrativos) en un skeleton que refleje la forma del contenido esperado, hasta que los datos estén disponibles o se informe un error.

#### Scenario: Carga del catálogo de habitaciones
- **WHEN** el catálogo de habitaciones está obteniendo datos desde la fuente configurada
- **THEN** el sistema muestra un skeleton con la forma de las tarjetas de habitación hasta que los datos llegan o se informa un error

#### Scenario: Carga del detalle de una habitación
- **WHEN** la página de detalle de una habitación está obteniendo sus datos desde la fuente configurada
- **THEN** el sistema muestra un skeleton con la forma de la página de detalle hasta que los datos llegan o se informa un error

#### Scenario: Resultados de disponibilidad por fechas
- **WHEN** una búsqueda de disponibilidad por fechas está en curso
- **THEN** el sistema muestra un skeleton con la forma de los resultados esperados hasta que la respuesta llega o se informa un error

### Requirement: Loading a nivel de botón para acciones y navegación
El sistema SHALL mostrar el estado de carga de cualquier botón de acción o navegación que dispare una consulta o escritura contra Supabase/Postgres únicamente en el propio botón activado, y SHALL NOT cubrir ni bloquear la pantalla completa con un indicador de carga global mientras esa acción está pendiente.

#### Scenario: Botón que dispara una operación contra Supabase
- **WHEN** un usuario activa un botón que inicia una consulta o escritura contra Supabase y la operación sigue pendiente
- **THEN** el sistema muestra el estado de carga en ese botón (deshabilitado, con indicador de carga) mientras el resto de la pantalla permanece visible e interactivo

#### Scenario: Prohibición de bloqueo de pantalla completa en acciones
- **WHEN** una acción de botón o de navegación está pendiente
- **THEN** el sistema no reemplaza el contenido de la pantalla por un indicador de carga global
