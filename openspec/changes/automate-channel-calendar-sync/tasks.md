## 1. Modelo de conexión de canal

- [x] 1.1 Definir el esquema Drizzle para conexiones de canal (`platform`, `roomId`, comportamiento de pago `auto_approved`/`pay_at_property`, URL/credencial del feed entrante, token del feed saliente, `enabled`) y verificar que la migración aplica limpia sobre una base local.
- [x] 1.2 Añadir `externalPlatform` y `externalRef` (nullable) a `reservations` con restricción de unicidad sobre `(externalPlatform, externalRef)`, y verificar con una prueba de integración que insertar dos veces el mismo par falla.
- [x] 1.3 Construir el adaptador mock de conexiones de canal (fixtures deterministas, sin red) siguiendo el patrón mock-first existente (`getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT === "mock"`) y verificar que no abre conexiones de red bajo ese contexto.

## 2. Feed saliente (Vista Valle → OTA)

- [x] 2.1 Implementar el generador de documento iCal a partir de la ocupación vigente de una habitación, filtrando `origin` distinto a la plataforma solicitante, y verificar con una prueba unitaria que una reserva de origen Airbnb no aparece en el feed saliente de Airbnb.
- [x] 2.2 Crear el Route Handler público `GET` que sirve el feed por conexión (token; el `roomId` no viaja en la URL porque el token ya es único globalmente — ver nota de implementación), y verificar que una solicitud con token incorrecto o inexistente responde sin datos de ocupación.
- [x] 2.3 Verificar en una prueba de integración que el feed refleja, sin caché, un cambio de ocupación ocurrido inmediatamente antes de la solicitud.

## 3. Ingesta entrante (OTA → Vista Valle)

- [x] 3.1 Implementar el parser de eventos iCal entrantes (fechas de ocupación + `UID`) tolerante a campos desconocidos, y verificar con fixtures que un documento con campos inesperados no rompe el parseo.
- [x] 3.2 Implementar la función de ingesta que, por cada evento nuevo, invoca `createMultiRoomPayAtPropertyReservation` (o la ruta multi-room equivalente) con `origin` igual a la plataforma de la conexión, sin pasar `notificationOutboxWriter`, y verificar con una prueba que la reserva creada no genera ningún evento en `notification_outbox`.
- [x] 3.3 Implementar el huésped placeholder fijo (`firstName: "Huesped"`, `lastName` con el nombre de la plataforma, teléfono generado válido, `email: "vistavallespa@gmail.com"`) reutilizado por toda reserva creada por sincronización, y verificar que pasa la validación existente de `guest.ts` sin relajar el esquema.
- [x] 3.4 Aplicar el comportamiento de pago de la conexión (§1.1) al crear el pago asociado — aprobado para Airbnb, pendiente de pago al llegar para Booking — y verificar con pruebas unitarias ambos casos por separado.
- [x] 3.5 Persistir `externalPlatform`/`externalRef` en la reserva creada y verificar que un segundo sondeo con el mismo `UID` no crea una reserva duplicada.
- [x] 3.6 Implementar la detección de cancelación por desaparición del `UID` en un sondeo posterior, reutilizando `transitionReservationState` hacia `cancelled`, y verificar con una prueba que el pago aprobado permanece sin cambios tras la cancelación.
- [x] 3.7 Crear el Route Handler interno protegido por secreto Bearer (mismo patrón que `app/api/internal/outbox/process/route.ts`) que dispara un ciclo de sondeo para todas las conexiones activas, y verificar que responde 401 sin el secreto correcto.

## 4. Detección y alerta de conflictos

- [x] 4.1 En la ingesta (§3.2), capturar específicamente `RoomLockConflictError`: no propagar la creación de la reserva conflictiva, dejar intacta la reserva/retención existente, y verificar con una prueba que el estado previo no cambia.
- [x] 4.2 Implementar el emisor de alerta operativa compartido ("reserva sobreduplicada... revise la reserva para coordinar con huésped") reutilizable desde ambos puntos de detección, y verificar que la alerta queda visible desde el modelo de datos que alimenta `/admin/alertas`.
- [x] 4.3 Conectar la misma alerta al manejo de `HoldExpiredError` en `app/api/webhooks/fintoc/route.ts`, distinguiéndolo del resto de errores capturados genéricamente por ese handler, y verificar con una prueba que ese caso específico genera la alerta además del registro en Sentry existente.
- [x] 4.4 Prueba de integración de extremo a extremo: crear un hold web, dejarlo vencer, sincronizar un evento externo para la misma habitación/fechas, y confirmar el pago vencido — verificar que no se crea una reserva conflictiva y que se emite exactamente una alerta.

## 5. Verificación de extensibilidad a Booking

- [x] 5.1 Registrar una segunda conexión de canal de prueba para Booking (comportamiento `pay_at_property`) usando el mismo modelo de §1.1, sin escribir código específico de Booking, y verificar que la ingesta y el feed saliente funcionan igual que para Airbnb con solo esa configuración.
- [x] 5.2 Verificar que el checklist manual existente (`channel_sync_tasks` / `/admin/sincronizaciones`) sigue disponible sin cambios para cualquier conexión que no esté `enabled`, confirmando que ambos mecanismos conviven sin conflicto.

## 6. Pruebas y documentación operativa

- [x] 6.1 Cobertura Vitest de: evento nuevo, evento repetido, evento retirado (cancelación), evento superpuesto (conflicto en ingesta), comportamiento de pago por plataforma — verificar que `npm run test` (o el comando de pruebas del proyecto) pasa en verde.
- [x] 6.2 Documentar en el detalle admin de una reserva sincronizada que el contacto real del huésped debe hacerse por la plataforma de origen mientras no se complete el dato real, y verificar visualmente que el placeholder no se presenta como un dato de contacto real.

## 7. Pantalla de conexiones de canal (UI)

- [x] 7.1 Agregar pestañas a `/admin/sincronizaciones` ("Cola manual" / "Conexiones de canal"), moviendo el `ChannelSyncChecklist` existente sin cambios a la primera pestaña, y verificar que la navegación por URL/query conserva la pestaña activa al recargar.
- [x] 7.2 Construir la tarjeta de conexión por habitación+plataforma con sus tres estados (`Sin conectar` / `Activa` / `Con error`), y verificar con una prueba de componente que cada estado renderiza los controles correctos.
- [x] 7.3 Implementar el campo de feed entrante como escritura única tipo secreto: acepta la URL al guardar, y tras guardada solo muestra "configurado ✓" con opción "reemplazar", nunca el valor en texto plano — verificar que una carga posterior de la pantalla no expone la URL guardada en el HTML ni en la respuesta del servidor.
- [x] 7.4 Implementar el feed saliente con link visible, botón "copiar" y botón "regenerar" (invalida el token anterior), y verificar que un link regenerado deja de responder con el token viejo.
- [x] 7.5 Mostrar hora del último sondeo exitoso, cantidad de eventos procesados y el comportamiento de pago de la conexión (aprobado automático / pago al llegar) como texto de solo lectura derivado de la configuración del canal.
- [x] 7.6 Condicionar `createWebsiteChannelSyncTasks` (`src/features/channel-sync/tasks.ts`) para que no genere tarea de una plataforma cuya conexión esté `Activa` para esa habitación, y verificar con una prueba que una reserva web confirmada solo genera tarea manual para las plataformas sin conexión activa.
