## Context

El repositorio contiene la especificación inicial, pero aún no existe una aplicación ni un modelo persistente. Vista Valle opera tres habitaciones y hoy recibe reservas desde Airbnb, Booking, teléfono y WhatsApp; durante el MVP, el ingreso y bloqueo entre canales seguirá siendo manual. El sistema debe aceptar reservas directas concurrentes, dos modalidades de pago y datos personales, por lo que la consistencia y la seguridad son más importantes que una arquitectura distribuida.

El producto combina sitio público orientado a SEO, checkout, webhook de pago, panel protegido, correo transaccional y una interpretación breve mediante IA. Véanse `proposal.md` y las seis especificaciones para el comportamiento esperado.

## Goals / Non-Goals

**Goals:**

- Mantener frontend y backend en una aplicación desplegable y comprensible para un equipo pequeño.
- Concentrar las reglas de disponibilidad, reservas, pagos y bloqueos en servicios de dominio reutilizables.
- Garantizar que las operaciones concurrentes del sitio no produzcan reservas superpuestas.
- Permitir sustituir proveedores externos sin reescribir el dominio.
- Separar componentes visuales, estado de interfaz, reglas de negocio y persistencia.
- Facilitar pruebas automatizadas de reglas críticas y flujos de usuario.

**Non-Goals:**

- Construir microservicios, API pública, GraphQL o comunicación en tiempo real.
- Convertir el panel en un PMS o channel manager completo.
- Dar acceso directo del navegador o del modelo de IA a tablas operativas.
- Automatizar devoluciones, conciliación contable, facturación o sincronización con OTAs en el MVP.
- Crear un CMS general; los contenidos iniciales se gestionarán como datos controlados y assets preparados.
- Ofrecer pago online mediante Mercado Pago Checkout Pro u otro proveedor; este MVP solo admite pago al llegar, y la integración de pago online queda para una fase posterior.

## Decisions

### 1. Monolito modular con Next.js y TypeScript

Se utilizará Next.js App Router como aplicación full-stack. Server Components resolverán contenido y consultas iniciales; Client Components manejarán interacción local; Server Actions atenderán mutaciones internas; Route Handlers expondrán webhooks y endpoints que requieran un contrato HTTP explícito.

La lógica se organizará por capacidades (`rooms`, `availability`, `reservations`, `payments`, `room-blocks`, `assistant`, `notifications`) y será invocada desde los adaptadores de Next.js. Ninguna regla crítica dependerá de un componente o de un Route Handler.

**Alternativas consideradas:** un frontend Next.js con backend NestJS separado añade autenticación, despliegue y contratos duplicados sin una necesidad de escala que lo justifique; una SPA reduce las ventajas de renderizado y SEO del contenido público.

### 2. Atomic Design limitado a la capa de presentación

Los componentes compartidos se clasificarán como `atoms`, `molecules`, `organisms` y `templates`. Las páginas cargarán datos y compondrán templates; los contenedores de cada feature conectarán estado y acciones con organismos visuales.

La dirección de dependencias será atoms → molecules → organisms → templates → pages. Los componentes visuales recibirán datos y callbacks por props; no accederán directamente a base de datos, pagos o IA. Un componente específico permanecerá dentro de su feature hasta demostrar reutilización, evitando un catálogo global artificial.

**Alternativa considerada:** aplicar Atomic Design a toda la aplicación dispersaría casos de uso y reglas de negocio entre carpetas visuales. La combinación con organización feature-first preserva la jerarquía de UI sin perder cohesión funcional.

### 3. Tailwind CSS, componentes accesibles y tokens visuales

Tailwind CSS proporcionará estilos, con primitivas accesibles compatibles con shadcn/ui para el panel y componentes propios para la identidad pública. Colores, tipografías, espaciado, radios y elevaciones se centralizarán como tokens. La interfaz pública evitará que la estética por defecto del panel determine la identidad boutique.

### 4. PostgreSQL administrado por Supabase

PostgreSQL será la fuente de verdad. Supabase aportará la base gestionada, autenticación del administrador y almacenamiento de imágenes. Drizzle ORM definirá el esquema, migraciones y consultas desde el servidor; las migraciones versionadas serán la autoridad y no se modificarán tablas manualmente en producción.

El navegador no escribirá directamente en tablas de reservas, pagos o bloqueos. Supabase Auth manejará una sesión SSR con registro público deshabilitado, mientras autorizaciones de servidor y RLS ofrecerán defensa en profundidad.

**Alternativas consideradas:** Neon + autenticación y storage separados reduce acoplamiento a Supabase, pero aumenta proveedores y configuración; Prisma es viable, aunque Drizzle permite mantener control cercano de transacciones y SQL específico de PostgreSQL.

### 5. Modelo de datos orientado a historial

Las entidades centrales serán:

- `rooms` y `room_images`: identidad, capacidad, precio base, contenido y actividad.
- `amenities` y asociaciones: servicios configurables.
- `guests`: datos de contacto necesarios.
- `reservations`: cabecera con huésped, fechas tipo `date`, total congelado, origen, modalidad, estado y solicitud tributaria opcional.
- `reservation_items`: una fila por habitación seleccionada, con habitación, noches, precio congelado, cargos y subtotal.
- `reservation_holds`: retenciones de pago con vencimiento.
- `room_blocks`: cierres administrativos con intervalo y motivo.
- `payments` y `payment_events`: intentos, proveedor, referencias, montos, estados y eventos idempotentes.
- `channel_sync_tasks`: estado independiente para bloqueos manuales en Airbnb y Booking.
- `audit_events`: acciones sensibles y actor.
- `notification_outbox`: entrega durable de correos.
- `assistant_interactions`: texto, interpretación, aprobación y resultado.

Las fechas de alojamiento se almacenarán como fechas locales y los eventos técnicos como instantes UTC. Los intervalos hoteleros se interpretarán como `[check_in, check_out)` bajo `America/Santiago`.

La consulta pública de disponibilidad calculará de forma autoritativa la fecha actual bajo `America/Santiago`: no aceptará entradas anteriores a hoy, exigirá que la salida sea como mínimo mañana y verificará que sea posterior a la entrada. Los atributos mínimos de los campos de fecha guiarán al visitante, pero la validación de servidor y dominio seguirá siendo la fuente de verdad para rutas, enlaces directos y APIs.

### 6. Serialización por habitación para evitar sobreventas web

Toda creación de reserva, retención o bloqueo ejecutará una transacción que bloquee las filas de habitación afectadas en un orden estable, elimine conceptualmente retenciones vencidas, vuelva a comprobar superposiciones y recién entonces inserte la operación. Para una reserva multi-habitación, la cabecera, todos sus ítems, el pago pendiente y los eventos de salida se crean como una sola operación o no se crea ninguno. El predicado de superposición será `existing.start < requested.end AND existing.end > requested.start`.

La misma función de dominio se usará desde checkout, pago al llegar, administración y asistente. El checkout público no recibe cantidad de huéspedes; el motor calcula cada ítem y el total desde las habitaciones y fechas autorizadas. Se añadirán restricciones de integridad donde PostgreSQL permita reforzar el contrato, pero la transacción seguirá siendo explícita para producir errores de negocio comprensibles.

**Alternativa considerada:** comprobar disponibilidad en frontend o con dos consultas no transaccionales deja una ventana de carrera y no satisface la garantía de concurrencia.

### 7. Pago al llegar como única modalidad del MVP

Este MVP ofrece exclusivamente pago al llegar. Tras la comprobación transaccional final de disponibilidad (decisión 6), el sistema crea directamente una reserva `CONFIRMED` con pago `PENDING`, sin retención previa ni proveedor de pago online.

El pago online mediante Mercado Pago Checkout Pro queda fuera de alcance de este MVP (ver Non-Goals y Open Questions) y podrá incorporarse en una fase posterior. El modelo de datos y el motor de disponibilidad ya conservan, de forma genérica e implementada, el concepto de retención temporal (`reservation_holds`) con vencimiento configurable y su exclusión de la disponibilidad al vencer — la base necesaria para retener antes de crear una preferencia de pago, redirigir al huésped, validar la firma de un webhook, consultar el pago y confirmar en una nueva transacción cuando se agregue ese proveedor. Ninguna ruta de este MVP crea u ofrece una retención al huésped.

### 8. Estados de reserva y pago separados

Las reservas usarán `CONFIRMED`, `CANCELLED`, `COMPLETED` y `NO_SHOW`; las retenciones serán una entidad temporal separada y no una reserva pública incompleta. Los pagos usarán `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED` y `REFUNDED`, con modalidad `PAY_NOW` o `PAY_AT_PROPERTY` en la reserva. Este MVP solo produce reservas con modalidad `PAY_AT_PROPERTY` y pagos en estado `PENDING`, `APPROVED` o `REFUNDED`; la modalidad `PAY_NOW` y los estados `REJECTED`/`CANCELLED` quedan definidos en el esquema para cuando se incorpore un proveedor de pago online, pero ningún flujo de este MVP los genera.

Cancelar una reserva pagada libera disponibilidad, pero no altera automáticamente el pago. El panel mostrará la resolución financiera pendiente; la política y devolución se gestionarán explícitamente fuera del MVP automatizado.

### 9. Panel mínimo y operación multicanal manual

El panel incluirá calendario por habitaciones, listado/detalle de reservas, creación manual, bloqueos, estados operativos, registro de pagos presenciales y cola de sincronización. Una reserva manual tendrá origen `AIRBNB`, `BOOKING`, `PHONE`, `WHATSAPP` o `ADMIN` y bloqueará inmediatamente la web.

Una reserva `WEBSITE` confirmada creará tareas independientes para Airbnb y Booking. Completar estas tareas no cambia el estado de la reserva; registra plataforma, usuario y hora. Las alertas del panel priorizarán reservas web que siguen pendientes.

### 10. Asistente como extractor estructurado, no agente autónomo

Durante este MVP, el asistente usará una única respuesta mock y determinista para validar la conversación y convertir la instrucción española en la intención `CREATE_ROOM_BLOCK`, validada con Zod. No realizará solicitudes de red ni requerirá credenciales de IA. La conexión a Vercel AI SDK y a un proveedor intercambiable queda diferida a un cambio OpenSpec posterior. La salida no tendrá función ejecutora automática.

El backend resolverá aliases contra habitaciones reales, interpretará fechas bajo `America/Santiago`, solicitará datos faltantes y generará una vista previa. Tras confirmación humana, un token de propuesta de corta duración vinculará exactamente los parámetros vistos con la acción; el servicio normal de bloqueos repetirá autorización y conflictos.

El formulario manual seguirá disponible. Solo se conservará el contexto mínimo necesario para corregir una propuesta; la auditoría almacenará la instrucción y resultado, no razonamientos privados del proveedor.

**Alternativa considerada:** un agente con herramientas ejecutables añade capacidad no requerida y aumenta el riesgo de acciones inesperadas. Una extracción estructurada cubre el caso de uso con una superficie menor.

### 11. Notificaciones mediante outbox

La transacción que confirma una reserva insertará también los eventos de correo requeridos en `notification_outbox`. La lista de destinatarios parte del correo normalizado del huésped y agrega el correo de facturación solo si se solicitó factura y es distinto tras normalizar espacios y mayúsculas/minúsculas. Un procesador enviará mediante Resend y React Email, registrando intentos e idempotencia. Un fallo de correo nunca revertirá una reserva confirmada; podrá reintentarse y verse desde el detalle administrativo.

### 14. Solicitud tributaria condicional

La reserva conservará una solicitud de factura separada del huésped. Al activarla, las fronteras de entrada validarán nombre o razón social, RUT chileno con dígito verificador, teléfono, giro y correo de facturación; al desactivarla, esos datos no se aceptan ni persisten. El sistema solo registra la solicitud y no emite documentos tributarios ni se integra a un proveedor contable.

**Alternativa considerada:** almacenar los datos tributarios siempre como campos opcionales aumenta la retención de datos personales sin una finalidad operativa cuando no hay factura solicitada.

### 12. Validación, pruebas y observabilidad

Zod validará fronteras de entrada. Vitest cubrirá reglas de fechas, precios, superposición, estados e interpretación; pruebas de integración usarán PostgreSQL para transacciones, webhooks e idempotencia; Playwright cubrirá reserva pública, pago al llegar, administración y confirmación del asistente.

Los logs correlacionarán `reservation_id`, `payment_id` y eventos externos sin registrar secretos ni datos personales innecesarios. Se preparará integración con Sentry para errores de producción y alertas sobre anomalías de pago y notificaciones fallidas.

### 13. Infraestructura no productiva mock-first

Los límites de PostgreSQL, Supabase Auth y Supabase Storage se expresarán mediante contratos tipados con adaptadores separados. El contexto explícito `mock` será el valor operativo para desarrollo local, pruebas unitarias y pruebas end-to-end durante la construcción del MVP: utilizará dobles deterministas en memoria o fixtures locales y no abrirá conexiones de red a Supabase, PostgreSQL ni Storage. Para validar el front completo, puede contener fixtures comerciales ficticios y formularios empresariales de demostración sin envío, señalados como datos de demostración y excluidos del contexto `production`. Los clientes y la conectividad productivos se configurarán y validarán estructuralmente, pero solo podrán activarse bajo contexto `production` con credenciales reales.

El esquema Drizzle y sus migraciones seguirán representando la base PostgreSQL definitiva aun cuando su generación y verificación inicial se realicen sin una base remota. Los adaptadores mock deberán respetar los mismos contratos, errores relevantes y fronteras de autorización para que las capacidades siguientes puedan desarrollarse sin un servicio externo disponible. Ningún valor mock podrá habilitar reservas reales ni pasar la validación productiva.

**Alternativa considerada:** exigir un proyecto Supabase o PostgreSQL local desde el inicio acercaría las pruebas al motor definitivo, pero introduciría un bloqueo operativo contrario a la etapa actual. Las pruebas de contrato e integración contra PostgreSQL/Supabase reales se ejecutarán más adelante en un entorno explícito, sin sustituir las pruebas aisladas.

## Risks / Trade-offs

- [La sincronización con Airbnb y Booking es manual y puede producir sobreventa externa] → Mostrar una cola prioritaria, enviar alerta inmediata y exigir que toda reserva externa sea ingresada prontamente al panel.
- [Un pago online podría aprobarse después de vencer su retención] → Riesgo diferido junto con la integración de pago online (ver decisión 7); el motor de disponibilidad ya soporta retenciones con vencimiento y exclusión automática para cuando se active esa fase.
- [El modelo puede interpretar mal una fecha o habitación] → Restringir el esquema, mostrar fechas absolutas, requerir confirmación y repetir validaciones sin IA al ejecutar.
- [Una sola aplicación concentra fallos] → Mantener módulos desacoplados, contratos de servicios y adaptadores de proveedores; para el volumen del MVP, la simplicidad supera el beneficio de distribución.
- [La ejecución serverless no garantiza procesos largos] → Mantener operaciones breves, persistir trabajo en outbox y procesar reintentos mediante una tarea programada.
- [Datos comerciales y fotografías están pendientes] → Usar configuración explícita y bloquear producción de páginas incompletas en vez de publicar placeholders ficticios.
- [Supabase aumenta dependencia de proveedor] → Conservar esquema PostgreSQL y migraciones estándar, encapsular Auth/Storage y evitar reglas de dominio exclusivas de APIs propietarias.
- [Los dobles pueden desviarse del comportamiento real de PostgreSQL o Supabase] → Compartir contratos, validar el SQL generado y añadir pruebas de contrato/integración en un entorno explícito antes de habilitar producción; nunca considerar un mock como evidencia de conectividad real.

## Migration Plan

1. Inicializar la aplicación con contexto mock aislado para desarrollo/pruebas y contexto productivo fail-closed, manteniendo separados sus adaptadores y credenciales.
2. Crear proyecto Supabase, migraciones y datos iniciales de habitaciones con contenido real disponible.
3. Construir y verificar el sitio público antes de habilitar reservas.
4. Activar reservas de pago al llegar y probar concurrencia y operación manual.
5. (Diferido fuera de este MVP) Configurar un proveedor de pago online, sus webhooks, reconciliación e idempotencia, reutilizando el mecanismo de retenciones ya implementado.
6. Configurar dominio, remitente de correo, autenticación administrativa, monitoreo y backups.
7. Realizar una conciliación inicial de todas las reservas externas y bloqueos antes de abrir disponibilidad pública.
8. Habilitar reservas mediante una configuración operativa que permita cerrar las reservas directas sin retirar el sitio público.

Ante una incidencia, se deshabilitarán nuevas reservas conservando el catálogo público, los datos y el panel para conciliación. Las migraciones destructivas no se revertirán automáticamente; se desplegará una migración correctiva y se reconciliarán los registros de pago presencial pendientes recibidos durante la interrupción.

## Open Questions

- Si y cuándo se incorporará un proveedor de pago online (Mercado Pago u otro) en una fase posterior al MVP, y qué proveedor se seleccionará.
- Modelo y proveedor definitivo para la interpretación de IA, manteniendo el contrato estructurado independiente.
- Valores finales de retención (para cuando se active el pago online), anticipación mínima y reintentos de correo, configurables sin cambiar las especificaciones.
- Fotografías, nombres, precios, capacidades, servicios, políticas, horarios y datos de contacto definitivos para producción.
