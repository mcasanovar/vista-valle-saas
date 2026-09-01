## Context

El módulo actual de `/admin/bloqueos` crea y retira un único bloqueo a partir de campos de texto y sólo lista los activos. Ya existen contratos de disponibilidad, bloqueo transaccional por habitación, auditoría, persistencia mock/PostgreSQL, creación rápida desde el calendario y propuestas confirmadas del asistente. Véase `proposal.md` para la motivación y la especificación delta para el comportamiento esperado.

## Goals / Non-Goals

**Goals:**

- Ofrecer una operación diaria clara para crear, consultar y retirar bloqueos sin debilitar las garantías de disponibilidad.
- Extender los contratos mock y PostgreSQL con el mismo modelo de filtros, historial y resultado multi-habitación.
- Mantener las acciones sensibles autorizadas y la auditoría por cada bloqueo afectado.
- Reutilizar patrones del dashboard para filtros en URL, rangos accesibles, feedback y responsive.

**Non-Goals:**

- No modificar una reserva existente para convertirla en bloqueo ni tratar un bloqueo como una reserva.
- No añadir edición en lugar: una corrección se representa mediante retiro y creación posterior.
- No introducir bloques recurrentes, plantillas persistentes, automatización de canales ni acceso de la IA a mutaciones directas.
- No cambiar el esquema de fechas ni permitir que el navegador sea autoritativo sobre habitación, conflicto, duración o disponibilidad.

## Decisions

### 1. Operación multi-habitación atómica con registros individuales

La solicitud de creación recibirá una lista no vacía de identificadores de habitación distintos, intervalo y motivo. El servicio ordenará los IDs de forma estable, adquirirá los bloqueos de cada habitación y repetirá la comprobación de superposición dentro de una única transacción. Sólo después insertará un `room_block` y un evento de auditoría por habitación; cualquier conflicto o fallo revierte la operación completa.

En contexto mock, el gateway de bloqueo mantendrá la misma adquisición ordenada y el rollback de cambios en memoria. En PostgreSQL, la transacción abarcará bloqueos, inserciones y auditorías. El resultado devolverá los bloqueos creados y los conflictos con datos seguros para presentar al administrador.

**Alternativas consideradas:** guardar un “bloqueo grupal” y sus ítems requeriría nuevas tablas y migraciones sin mejorar la comprobación de disponibilidad, que ya es por habitación. Ejecutar una acción por habitación puede dejar resultados parciales.

### 2. Ciclo de vida inmutable y retiro lógico

`room_blocks` seguirá usando `removed_at` y `removed_by`. Un bloqueo no se modifica ni se elimina físicamente: retirarlo libera su ocupación, conserva el registro y registra el evento de auditoría. Para cambiar fechas, habitaciones o motivo, la interfaz guiará al administrador a retirar el bloqueo y crear otro.

**Alternativas consideradas:** editar en lugar requeriría registrar antes/después, revalidar nuevos conflictos y explicar qué porción de la disponibilidad histórica cambió. El flujo retirar/recrear es más seguro y deja una trazabilidad legible.

### 3. Lectura administrativa paginada y filtrable

El servidor interpretará filtros de URL: `roomId`, rango de solapamiento, texto de motivo y estado `active`/`removed`/`all`. La consulta usará los mismos intervalos `[check-in, check-out)` para determinar intersección, incluirá metadatos de habitación y autor, ordenará de manera estable por creación descendente y expondrá paginación. El detalle se podrá resolver desde la lista sin exponer datos personales ajenos al bloqueo.

**Alternativas consideradas:** cargar todos los registros en el navegador simplifica la primera versión, pero no escala ni mantiene filtros compartibles. Un filtro de fechas por creación no responde al caso operativo de “qué habitaciones están cerradas en este intervalo”.

### 4. Límites cliente-servidor y composición de la interfaz

La página servidor cargará habitaciones permitidas, resultados filtrados y parámetros de creación rápida; pasará DTOs serializables a un componente cliente feature-local. El componente presentará selector de habitaciones, rango de fechas, motivos sugeridos y texto libre, resumen de noches, filtros y confirmación de retiro accesible. Las Server Actions sólo aceptarán los campos mínimos, autorizarán al actor y volverán a validar todo antes de invocar el dominio.

La disponibilidad mostrada antes de enviar es orientativa; los resultados de creación o conflicto del servidor son la fuente de verdad. La interfaz reutilizará el selector de rango del dashboard cuando sea compatible con las reglas de alojamiento, con mínimos locales y foco/errores accesibles.

**Alternativas consideradas:** llamar a la base de datos desde componentes de presentación viola los límites de servidor. Usar IDs escritos manualmente conserva el error operativo actual.

### 5. Integración contextual sin duplicar comandos

El calendario conservará sus enlaces de creación rápida hacia `/admin/bloqueos` con habitación y fecha opcionales; el formulario interpretará esos valores como selección inicial, pero no los confiará al confirmar. Las propuestas del asistente continuarán ejecutándose mediante el servicio normal de bloqueos y aparecerán en el mismo listado/auditoría.

**Alternativas consideradas:** crear rutas de mutación exclusivas para calendario o asistente duplicaría las reglas de autorización, conflicto y auditoría.

## Risks / Trade-offs

- [Varias habitaciones amplían la ventana de concurrencia] → Adquirir los locks por ID estable y usar una transacción única para todas las inserciones.
- [El historial puede hacer lenta la lista] → Filtros y paginación desde la fuente de datos, con índices revisados según la consulta resultante.
- [El administrador puede confundir retiro con edición] → Explicar que retirar libera el intervalo y ofrecer crear un nuevo bloqueo desde el detalle, sin ocultar la acción detrás de una edición ambigua.
- [Los filtros por texto pueden resultar costosos] → Limitarse al motivo y aplicar búsquedas indexables o documentar el límite si PostgreSQL requiere una optimización posterior.
- [La previsualización puede quedar desactualizada] → Etiquetarla como estimación y traducir el conflicto final a un mensaje accionable.

## Migration Plan

1. Extender contratos y fuentes de datos sin retirar las acciones actuales.
2. Agregar los índices o migración no destructiva que exija la consulta de historial, si el esquema actual no los cubre.
3. Desplegar las lecturas, formulario y acciones mejoradas detrás de la misma ruta protegida.
4. Verificar creación, conflicto, retiro, historial y enlaces de calendario en mock y PostgreSQL.
5. Si aparece un incidente, volver temporalmente al formulario individual conservando los mismos datos y operaciones ya persistidos; no se requiere reversión destructiva.
