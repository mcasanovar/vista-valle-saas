## Context

La cotización empresarial ya tiene una página dedicada, cálculo server-side, consulta de disponibilidad, repositorio mock y adaptador PostgreSQL preparado. El landing renderiza actualmente el CTA a través de la ruta de consulta empresarial, pero esa decisión está acoplada al canal genérico de contacto y puede ocultar el CTA en producción. El endpoint de cotización también usa hoy el escritor de outbox mock; el escritor PostgreSQL y el transporte Resend productivo existen por separado, pero no están conectados al flujo completo.

La tabla productiva debe conservar el snapshot de la cotización y los intents de correo. La disponibilidad debe seguir siendo una consulta de solo lectura y no debe convertir una cotización en una reserva. La reserva solo se generará después de que Vista Valle reciba y procese la respuesta de confirmación del cliente.

## Goals / Non-Goals

**Goals:**

- Hacer que el CTA empresarial sea visible en producción cuando la cotización esté habilitada, sin depender de un contacto genérico.
- Mantener la consulta de fechas/personas como gate previo: disponibilidad nula oculta el formulario; disponibilidad parcial o total muestra las opciones disponibles.
- Revalidar disponibilidad antes de persistir la cotización.
- Guardar cotización, líneas e intents de correo en una transacción productiva coherente.
- Entregar dos correos mediante Resend con credenciales server-only, Reply-To operativo e idempotencia.
- Usar una plantilla HTML responsive, accesible y reconocible como Vista Valle, con el aviso destacado de confirmación por respuesta al mismo correo.
- Procesar el outbox productivo mediante un endpoint interno autenticado, acotado y apto para scheduler serverless.

**Non-Goals:**

- Crear automáticamente una reserva a partir del envío del formulario o de la respuesta del cliente.
- Interpretar respuestas de correo automáticamente; la confirmación seguirá siendo una acción operativa posterior.
- Incorporar descuentos, impuestos, vigencia comercial o condiciones no proporcionadas por Vista Valle.
- Exponer credenciales, acceso directo del navegador a PostgreSQL/Supabase o datos personales en respuestas de API y logs.
- Construir un panel administrativo completo para administrar cotizaciones.

## Decisions

### 1. CTA independiente del contacto genérico

El CTA “Solicitar cotización” será parte explícita del modelo de contenido de la sección empresarial y apuntará a `/cotizacion-empresa` cuando el flujo esté habilitado. No se reutilizará la ausencia de un teléfono, correo o canal genérico como señal para ocultarlo. La alternativa de mantener el acoplamiento actual se descarta porque una cotización puede estar operativa aunque el contacto institucional general todavía no esté completo.

El landing seguirá sin el formulario completo. La navegación se verificará con un enlace real y con una prueba E2E que compruebe la URL final, no solo el atributo `href`.

### 2. Gate y semántica de disponibilidad

Se conserva el flujo de dos pasos existente: primero fechas de entrada/salida y personas; después, si existe al menos una habitación libre, habitaciones disponibles, capacidad y datos empresariales. Si ninguna habitación está libre, se muestra “No hay habitaciones disponibles para esas fechas” y no se monta el formulario.

La disponibilidad parcial seguirá permitiendo una cotización parcial, siempre que el mensaje indique la capacidad disponible frente a la solicitada. La respuesta POST resolverá nuevamente la disponibilidad y rechazará una línea que haya quedado obsoleta.

### 3. Persistencia y outbox en una misma transacción

En producción, la operación de creación se compondrá sobre un único handle de PostgreSQL y una única transacción: insertar cabecera, insertar líneas snapshot y registrar los dos intents (`customer` y `admin`). El contrato se ampliará o se agregará un servicio de aplicación que permita que el repositorio de cotización y el escritor productivo compartan la transacción, sin pasar `undefined` al escritor productivo.

La clave de idempotencia de la cotización seguirá siendo única. Las claves de los correos serán deterministas por identificador de cotización y destinatario. Si la transacción falla, no debe quedar una cotización sin notificaciones ni una notificación apuntando a una cotización inexistente.

El contexto mock conservará sus repositorios en memoria y su entrega sin red para no modificar el comportamiento de las pruebas locales.

### 4. Procesamiento productivo del outbox

Se implementará un repositorio PostgreSQL de outbox con lectura de intents listos, reclamación segura, actualización de intentos, estados `processing`, `retrying`, `delivered` y `failed`, y registros de entrega. La reclamación debe tolerar ejecuciones concurrentes del scheduler sin enviar dos veces el mismo intent; la unicidad de idempotencia y el estado persistido serán la defensa principal.

La fuente productiva de datos cargará la cotización y sus líneas desde PostgreSQL usando el `quotationId` del payload mínimo del intent. El worker existente seguirá siendo responsable de renderizar, entregar y clasificar fallos; el procesador productivo solo orquestará lotes y límites de tiempo.

El endpoint interno existente mantendrá autenticación Bearer con `OUTBOX_PROCESSOR_SECRET`, respuesta sin información personal, lote acotado y presupuesto de tiempo. En producción devolverá un procesador real en vez de `null`; en mock seguirá usando el procesador mock.

### 5. Resend y respuesta al mismo correo

Se reutilizará el adaptador server-only de Resend. El modelo de correo tendrá un campo opcional de dirección de respuesta. Para el correo del cliente, `Reply-To` será la bandeja operativa aprobada de Vista Valle; el remitente será `Vista Valle SpA <reservas@vistavalle.cl>` solo después de verificar el dominio y configurar credenciales reales.

El transporte mock seguirá capturando correos sin red. Un fallo transitorio de Resend mantendrá el intent reintentable; un fallo permanente conservará la cotización y marcará únicamente la entrega afectada como fallida.

### 6. Plantilla de correo de Vista Valle

El correo del cliente tendrá una estructura clara y compatible con clientes de correo:

- Encabezado oscuro con el logotipo blanco y el nombre “Vista Valle Lodging House”.
- Título “Tu cotización para empresas”.
- Saludo con la persona de contacto y una breve explicación.
- Tarjeta de resumen con entrada, salida, noches y personas.
- Tabla de habitaciones con cantidad, precio por noche y subtotal.
- Total estimado destacado en la paleta tierra/dorado.
- Bloque de alerta visual, con texto: “IMPORTANTE: responde a este mismo correo confirmando los días cotizados para que podamos generar la reserva. Esta cotización no crea una reserva automáticamente.”
- Aviso de cobertura parcial cuando corresponda.
- Pie con la identidad y canales aprobados de Vista Valle, sin inventar datos comerciales pendientes.

La plantilla operativa para Vista Valle conservará contacto, requisitos, mensaje, fechas, capacidad y snapshot completo. Ambas plantillas escaparán valores dinámicos y no incluirán secretos ni información de infraestructura.

### 7. Configuración productiva y despliegue

La activación requerirá `VISTA_VALLE_CONFIG_CONTEXT=production`, una `DATABASE_URL` PostgreSQL real, Supabase productivo configurado, migraciones aplicadas, `RESEND_DELIVERY_MODE=real`, `RESEND_API_KEY`, remitente verificado, `ADMIN_NOTIFICATION_EMAIL` y `OUTBOX_PROCESSOR_SECRET`. Los valores mock no podrán pasar la validación productiva.

Antes de habilitar el CTA en el dominio público se verificará una cotización completa contra datos reales, la entrega a cliente y equipo, la respuesta al mismo correo, el reintento de un fallo simulado y la ausencia de solicitudes externas en modo mock.

## Risks / Trade-offs

- [Riesgo] Una cotización puede guardar datos correctamente pero el proveedor estar temporalmente caído → [Mitigación] outbox persistente, estados recuperables, reintentos acotados y confirmación al cliente solo después de persistir.
- [Riesgo] Dos ejecuciones del scheduler pueden reclamar el mismo intent → [Mitigación] reclamación transaccional, estados persistidos, claves únicas e idempotencia del proveedor.
- [Riesgo] El dominio o remitente no esté verificado → [Mitigación] mantener mock por defecto fuera de producción y fallar cerrado si faltan credenciales reales.
- [Riesgo] Cambien precios o capacidades después de emitir una cotización → [Mitigación] guardar snapshots de nombre, capacidad, precio, noches y subtotales.
- [Riesgo] La capacidad parcial se interprete como confirmación de alojamiento → [Mitigación] aviso explícito en UI y correo indicando cobertura y que no es una reserva.
- [Riesgo] El CTA productivo lleve a un flujo sin configuración completa → [Mitigación] validación de configuración, respuesta segura de indisponibilidad y checklist de aceptación antes de publicar.

## Migration Plan

1. Ejecutar y verificar las migraciones existentes contra la base PostgreSQL/Supabase productiva.
2. Conectar el servicio productivo de creación de cotización con la transacción compartida y el escritor de outbox.
3. Conectar fuente, repositorio y procesador productivo del outbox al endpoint interno autenticado.
4. Añadir `Reply-To`, plantillas visuales y pruebas de renderizado, idempotencia y errores de Resend.
5. Corregir el CTA y ejecutar pruebas mock, integración PostgreSQL, E2E y accesibilidad.
6. Configurar dominio/remitente y ejecutar una prueba controlada con destinatarios aprobados.
7. Habilitar el flujo en producción.

Para rollback, se deshabilita el flujo de cotización o se revierte el release sin borrar cotizaciones ya registradas. Los intents pendientes se conservan para recuperación; nunca se deben eliminar como parte de un rollback normal.
