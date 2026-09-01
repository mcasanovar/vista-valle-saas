## Context

La motivación y el alcance están en `proposal.md`; los contratos observables están en `specs/company-quotation-flow/spec.md`. El proyecto ya tiene precios mock por habitación, cálculo autoritativo de reservas basado en noches y precio nocturno, repositorios de lectura de habitaciones y una infraestructura de plantillas/outbox de notificaciones que hoy está conectada al contexto mock. La integración de Resend real todavía no está habilitada y el outbox actual está modelado alrededor de reservas.

## Goals / Non-Goals

**Goals:**

- Crear una cotización server-authoritative para varias habitaciones y cantidades.
- Hacer visible la capacidad máxima de cada habitación y validar contra la cantidad total de personas.
- Reutilizar el cálculo de noches y precios existente sin confiar en valores del navegador.
- Persistir solicitudes y snapshots con un contrato mock y una implementación PostgreSQL preparada.
- Renderizar correos reales como plantillas server-only y entregarlos mediante un puerto compatible con Resend.
- Mantener el landing liviano, con un único CTA hacia `/cotizacion-empresa`.

**Non-Goals:**

- No crear reservas, bloqueos de disponibilidad ni pagos a partir de la cotización.
- No distribuir personas entre habitaciones individualmente; se valida capacidad acumulada.
- No incorporar un dominio, verificación DNS o envío real mientras Resend no tenga un dominio habilitado.
- No agregar plazos de respuesta, descuentos, impuestos o cargos comerciales no aprobados.
- No implementar un panel administrativo completo para gestionar cotizaciones.

## Decisions

### 1. Modelo de cotización con líneas por habitación

La entrada normalizada tendrá fechas, cantidad total de personas, contacto y una colección de líneas `{ roomId/slug, quantity }`. Cada línea calculada conservará nombre, capacidad, precio nocturno, noches, subtotal y una marca de origen mock o real.

Se elige este modelo sobre un único `roomId` porque una empresa puede solicitar varias habitaciones y cantidades diferentes. La capacidad válida será la suma de `quantity * capacity`; no se exige asignación individual de huéspedes.

### 2. Cálculo compartido y server-authoritative

El servicio de cotización resolverá habitaciones activas desde el `RoomReadSource`, validará fechas con el contrato de fechas de alojamiento y calculará cada línea con la lógica de pricing existente. Los valores derivados enviados por el cliente serán ignorados.

Se evita duplicar una fórmula específica de cotización. Si el futuro precio proviene de PostgreSQL, solo cambia la fuente autorizada, no el contrato de cálculo.

### 3. Página server/client separada

`app/cotizacion-empresa/page.tsx` será la entrada pública y server-side, con metadata, navegación y footer. Un controlador cliente manejará cantidades, resumen accesible y estados de envío, pero enviará solamente datos de entrada no confiables a una ruta POST server-side.

El formulario se extrae de `PublicHomeTemplate`; el CTA empresarial usará `/cotizacion-empresa`. Se conserva la misma biblioteca visual y los mismos tokens, pero la página tendrá una composición propia con encabezado, resumen de capacidad, selector de habitaciones y tarjeta de resultado.

### 4. Persistencia con solicitud y líneas snapshot

Se definirá un repositorio `CompanyQuotationRepository` con operaciones para crear y consultar solicitudes. El adaptador mock será determinista para pruebas y desarrollo; el adaptador PostgreSQL usará tablas separadas para la solicitud y sus líneas, con estado de solicitud y timestamps UTC.

Las líneas guardarán snapshots de nombre, capacidad y precio, además de cantidad, noches y subtotal. Esto evita que una modificación futura del catálogo cambie una cotización ya enviada.

Se generará una migración Drizzle para la forma PostgreSQL, pero el contexto mock no intentará conectarse a PostgreSQL.

### 5. Outbox de notificaciones por agregado

Las notificaciones de cotización usarán el mismo worker, renderer, idempotencia y política de reintentos existentes, pero el contrato del outbox se extenderá para identificar un agregado de cotización sin forzar una relación a `reservation_id`.

Se prefieren campos explícitos de tipo/id de agregado o una tabla de intents compatible antes que crear un segundo sistema de envío. Las notificaciones tendrán claves deterministas por cotización y destinatario: una para el cliente y otra para el correo operativo.

### 6. Resend detrás de un puerto y transporte mock

El dominio de aplicación no conocerá Resend. El adaptador aceptará un transporte inyectable: en mock capturará el correo renderizado sin red; cuando el dominio esté verificado se conectará el transporte real usando `RESEND_API_KEY`, `RESEND_FROM_EMAIL` y el nombre `Vista Valle SpA` desde configuración server-only.

La dirección `reservas@vistavalle.cl` se dejará como configuración inicial, pero el mock será el único transporte permitido mientras no exista dominio habilitado. El cliente solo recibirá la confirmación después de que la solicitud esté persistida; el estado de entrega quedará desacoplado mediante outbox.

### 7. Plantillas HTML separadas

Se crearán dos plantillas server-only: confirmación de cotización para cliente y alerta operativa para Vista Valle. Ambas recibirán un modelo ya normalizado y calculado, usarán formato CLP consistente y no incluirán plazos ni información de infraestructura.

La plantilla del cliente mostrará únicamente el resumen solicitado y los valores; la operativa incluirá además empresa, persona de contacto, correo, teléfono y requisitos. Los datos completos no se escribirán en logs.

## Risks / Trade-offs

- [Riesgo] El precio o capacidad mock puede no representar la oferta final → [Mitigación] identificar el contexto mock, guardar snapshots y mantener la fuente detrás de un contrato reemplazable.
- [Riesgo] Cambiar el outbox existente puede afectar reservas → [Mitigación] conservar compatibilidad con intents de reserva y agregar pruebas de regresión antes de activar cotizaciones.
- [Riesgo] Un correo se entregue y la respuesta HTTP falle → [Mitigación] persistir primero, usar idempotency keys y procesar entrega desde outbox.
- [Riesgo] Resend rechace `reservas@vistavalle.cl` sin dominio verificado → [Mitigación] transporte mock explícito y configuración separada para habilitar producción posteriormente.
- [Riesgo] La capacidad agregada no garantiza una distribución final de huéspedes → [Mitigación] presentar la cotización como propuesta calculada, no como reserva ni confirmación de disponibilidad.
- [Riesgo] PostgreSQL no esté disponible durante desarrollo → [Mitigación] repositorio mock determinista y migración/adaptador verificables sin conexión externa.

## Migration Plan

1. Añadir contratos, validación, cálculo, repositorio, migración y plantillas manteniendo el flujo de reservas existente.
2. Activar la ruta y reemplazar el formulario embebido por el CTA dedicado.
3. Validar el transporte mock, los correos renderizados y la persistencia mock en CI.
4. Cuando exista dominio verificado, configurar el transporte Resend real y los secretos server-only sin cambiar el formulario ni el cálculo.
5. Para rollback, retirar el CTA/ruta y desactivar la creación de solicitudes; las tablas nuevas y los intents no afectan reservas existentes.
