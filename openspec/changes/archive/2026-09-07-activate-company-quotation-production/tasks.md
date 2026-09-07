## 1. CTA y gate de disponibilidad

- [x] 1.1 Revisar la guía vigente de Next.js en `node_modules/next/dist/docs/` y confirmar el patrón de navegación aplicable antes de modificar la interfaz; verificar que la decisión quede reflejada en el diff o en las pruebas correspondientes.
- [x] 1.2 Desacoplar el CTA “Solicitar cotización” del canal genérico de contacto y mantenerlo visible cuando la cotización esté habilitada, apuntando a `/cotizacion-empresa`; verificar con pruebas de componente en contexto mock y productivo sin contacto genérico.
- [x] 1.3 Corregir la navegación real del CTA desde la landing y verificar con Playwright la URL `/cotizacion-empresa`, además de confirmar que el formulario completo no aparece en la landing.
- [x] 1.4 Verificar el gate de fechas, personas y disponibilidad: disponibilidad nula muestra el mensaje requerido y oculta el formulario; disponibilidad existente muestra habitaciones, capacidades y formulario; verificar casos total, parcial, nulo y nueva consulta.

## 2. Persistencia productiva de cotizaciones

- [x] 2.1 Definir el contrato de creación productiva que permita compartir una transacción entre cabecera, líneas snapshot e intents de notificación, sin pasar un contexto nulo al escritor PostgreSQL; verificar tipos y pruebas de contrato.
- [x] 2.2 Implementar la creación atómica de cotizaciones en PostgreSQL/Supabase usando `company_quotations` y `company_quotation_lines`; verificar rollback cuando falle una escritura y conservación de snapshots.
- [x] 2.3 Conectar la ruta POST de cotización al flujo productivo sin alterar el mock; verificar respuestas seguras, revalidación server-side, clave de idempotencia y ausencia de reservas creadas automáticamente.
- [x] 2.4 Verificar la migración completa contra PostgreSQL y documentar la aplicación idempotente sobre la base productiva; ejecutar `npm run db:check` y la integración PostgreSQL cuando las credenciales estén disponibles.

## 3. Outbox productivo y Resend

- [x] 3.1 Implementar el repositorio PostgreSQL del outbox para leer, reclamar y actualizar intents con estados, intentos, timestamps y códigos de error seguros; verificar concurrencia, reintentos y no duplicación.
- [x] 3.2 Implementar la fuente productiva de datos de cotización para que el worker reconstruya la plantilla desde PostgreSQL usando únicamente el identificador del intent; verificar que no dependa del repositorio mock ni exponga datos en logs.
- [x] 3.3 Conectar el procesador productivo al endpoint interno autenticado, con lote y presupuesto de tiempo acotados; verificar `401` sin secreto, procesamiento autorizado y respuesta sin datos personales.
- [x] 3.4 Extender el contrato de correo con remitente y Reply-To, y conectar el transporte real de Resend únicamente bajo configuración productiva; verificar que el mock no realice llamadas externas y que los fallos del proveedor se clasifiquen.
- [x] 3.5 Configurar y validar variables server-only para PostgreSQL/Supabase, Resend, remitente verificado, `ADMIN_NOTIFICATION_EMAIL` y `OUTBOX_PROCESSOR_SECRET`; verificar que valores mock o placeholder sean rechazados en producción.

## 4. Plantillas y confirmación por correo

- [x] 4.1 Crear la plantilla HTML del cliente con identidad visual de Vista Valle, logo, resumen de estadía, habitaciones, precios, total y formato responsive; verificar renderizado HTML, escape de datos y accesibilidad básica.
- [x] 4.2 Agregar el bloque destacado: “IMPORTANTE: responde a este mismo correo confirmando los días cotizados para que podamos generar la reserva. Esta cotización no crea una reserva automáticamente.”; verificar su presencia en el correo del cliente.
- [x] 4.3 Configurar Reply-To hacia la bandeja operativa aprobada y mantener un correo interno separado con requisitos, contacto y snapshot completo; verificar destinatarios, asuntos y datos permitidos.
- [x] 4.4 Verificar explícitamente la cobertura parcial en ambos correos y confirmar que ninguna plantilla presente una cotización como reserva confirmada; ejecutar las pruebas de plantillas y notificaciones existentes.

## 5. Verificación integrada y despliegue

- [x] 5.1 Añadir o actualizar pruebas unitarias para CTA productivo, gate de disponibilidad, persistencia atómica, Reply-To, idempotencia y fallos de Resend; verificar con `npm run test:unit`.
- [x] 5.2 Añadir pruebas de integración PostgreSQL para cotización, líneas, intents y lectura de datos por el worker; verificar contra un esquema generado con todas las migraciones.
- [x] 5.3 Corregir y ampliar las pruebas E2E del CTA, disponibilidad total/parcial/nula, envío y confirmación visual; verificar con `npm run test:e2e` sin solicitudes externas en contexto mock.
- [x] 5.4 Ejecutar `npm run typecheck`, `npm run lint`, `npm run build:test`, `npm run format:check` y `openspec validate --specs`; resolver cualquier regresión antes de habilitar producción. `format:check` reporta 126 archivos preexistentes con deuda de formato ajena a este cambio (ver nota equivalente en `add-company-quotation-addons`); los archivos que este cambio tocó (`tests/postgres-company-quotation.integration.test.ts`) pasan el check. El resto (typecheck, lint, build:test, openspec validate --specs) está en verde sin regresiones.
- [x] 5.5 Ejecutar una prueba controlada en producción con datos y destinatarios aprobados, confirmar recepción del correo y respuesta a Reply-To, revisar intents entregados y dejar documentado el rollback sin borrar cotizaciones ni intents pendientes. Ejecutado el 2026-09-07 contra la base productiva real: se agregó `RESEND_FROM_NAME` (configurable, ver `src/config/server.ts` y `src/features/notifications/resend-adapter.ts`) para poder enviar desde un dominio de prueba (`vistavalle@nvitame.com`) sin tocar código, apuntando `ADMIN_NOTIFICATION_EMAIL` (Reply-To) a un correo aprobado por el usuario. Se creó una cotización real (`checkIn 2027-01-10`, id `c03791e1-4e0c-47d1-934b-c9b27125faec`) vía `POST /api/company-quotations` y se procesó el outbox vía `POST /api/internal/outbox/process`; ambos intents (`company_quotation_customer` y `company_quotation_admin`) quedaron `delivered` en `notification_outbox` sin reintentos. El usuario confirmó recepción de ambos correos y funcionamiento del Reply-To. Rollback: no se eliminó la cotización de prueba ni sus intents (quedan como registro, con fecha 2027-01-10 sin colisión con reservas reales); para volver a producción real basta con restaurar `RESEND_FROM_EMAIL`/`RESEND_FROM_NAME`/`ADMIN_NOTIFICATION_EMAIL` a los valores de Vista Valle en `.env.local` (o el entorno de despliegue) sin cambios de código.
