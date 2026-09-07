## ADDED Requirements

### Requirement: Persistencia productiva de cotizaciones empresariales
El sistema SHALL persistir en PostgreSQL/Supabase, bajo el contexto `production`, la solicitud de cotización, sus líneas con snapshots y las notificaciones que deben enviarse, usando una operación atómica que no deje una cotización guardada sin sus intents de notificación.

#### Scenario: Cotización productiva aceptada
- **WHEN** una solicitud válida supera la revalidación de disponibilidad en producción
- **THEN** el sistema guarda la cotización, sus líneas y los intents para el cliente y Vista Valle en la base productiva

#### Scenario: Error durante la persistencia atómica
- **WHEN** falla la escritura de la cotización o de cualquiera de sus intents de notificación
- **THEN** la transacción no deja una cotización parcialmente creada y el endpoint devuelve un error seguro y recuperable

#### Scenario: Reenvío idempotente
- **WHEN** se repite la misma solicitud con la misma clave de idempotencia
- **THEN** el sistema conserva una sola cotización y una sola pareja de intents de notificación

### Requirement: Entrega productiva de correos de cotización
El sistema SHALL procesar los intents productivos pendientes mediante el worker de notificaciones y SHALL entregarlos a través de Resend usando credenciales exclusivamente server-side, con remitente verificado de Vista Valle y una dirección de respuesta que permita al cliente confirmar los días cotizados.

#### Scenario: Entrega al cliente y al equipo
- **WHEN** existen intents pendientes para una cotización válida
- **THEN** Resend recibe un correo para el cliente y otro para `ADMIN_NOTIFICATION_EMAIL`, con sus plantillas correspondientes

#### Scenario: Respuesta al mismo correo
- **WHEN** el cliente responde al correo de cotización
- **THEN** la respuesta llega a la bandeja operativa configurada de Vista Valle

#### Scenario: Fallo transitorio del proveedor
- **WHEN** Resend devuelve un fallo transitorio
- **THEN** el intent conserva su estado recuperable, registra un código seguro y queda disponible para reintento sin duplicar una entrega ya completada

#### Scenario: Fallo permanente del proveedor
- **WHEN** Resend devuelve un fallo permanente o la plantilla no puede renderizarse
- **THEN** el sistema marca el intent como fallido, conserva la cotización y no expone secretos ni datos personales innecesarios

### Requirement: Procesador productivo de outbox
El sistema SHALL exponer un procesamiento interno autenticado y acotado que lea intents pendientes desde la base productiva, use la fuente productiva de datos de cotización y respete límites de lote y tiempo apropiados para un entorno serverless.

#### Scenario: Procesamiento autorizado
- **WHEN** un proceso interno presenta el secreto operativo válido
- **THEN** el sistema procesa un lote acotado de intents listos y devuelve un resumen sin datos personales

#### Scenario: Procesamiento no autorizado
- **WHEN** una solicitud al procesador no presenta el secreto válido
- **THEN** el sistema responde con `401` y no consulta ni modifica intents

#### Scenario: No hay intents listos
- **WHEN** el procesador no encuentra intents pendientes o reintentables
- **THEN** devuelve un resultado de lote vacío sin error
