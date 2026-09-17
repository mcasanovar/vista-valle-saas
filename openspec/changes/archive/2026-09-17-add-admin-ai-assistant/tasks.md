## 1. Preparación del dominio

- [x] 1.1 Extraer el núcleo tipado de `createManualReservationAction` a una función que reciba valores tipados en vez de `FormData`, dejando la acción como adaptador delgado; verificar que los tests existentes de reserva manual pasan sin modificarse
- [x] 1.2 Extraer el núcleo tipado de `editAdminReservationDatesAction` con el mismo criterio; verificar que los tests de edición de fechas pasan sin modificarse
- [x] 1.3 Extraer el núcleo tipado de `transitionAdminReservation`; verificar que los tests de transición de estado pasan sin modificarse
- [x] 1.4 Extraer el núcleo tipado de las acciones de cobro (`mark-payment-paid-action`, `pay-at-property-admin-collect-action`); verificar que sus tests pasan sin modificarse
- [x] 1.5 Confirmar que `createRoomBlocks`, `removeRoomBlock`, `listRoomBlocks`, `searchAvailability` y `getAdminDashboardSummary` ya son invocables con valores tipados desde otro módulo; documentar en el módulo del asistente cuáles no lo son

## 2. Persistencia

- [x] 2.1 Agregar al esquema Drizzle las tablas de hilos y mensajes del asistente, con propietario, marcas de tiempo e índice por administrador; verificar con `npm run db:generate` y `npm run db:check`
- [x] 2.2 Agregar al esquema la tabla de hechos de memoria por administrador; verificar con `npm run db:generate` y `npm run db:check`
- [x] 2.3 Reemplazar la auditoría en memoria de `interaction-audit.ts` por persistencia sobre `assistant_interactions`, conservando la interfaz pública; verificar que los registros sobreviven un reinicio del proceso en el test de integración
- [x] 2.4 Confirmar que el enum `assistant_interaction_status` cubre los cinco estados sin migración; verificar que `npm run db:check` no reporta cambios pendientes de enum

## 3. Puertos y adaptadores

- [x] 3.1 Definir el puerto `AssistantModel` con la operación de turno que recibe mensajes y herramientas y devuelve texto o llamadas a herramientas; verificar que compila con `npm run typecheck`
- [x] 3.2 Implementar el adaptador mock guionizado de `AssistantModel`; verificar con tests unitarios que reproduce turnos con y sin llamadas a herramientas
- [x] 3.3 Definir el puerto `SpeechTranscriber` con la operación `transcribe`; verificar que compila con `npm run typecheck`
- [x] 3.4 Implementar el adaptador mock de `SpeechTranscriber`; verificar con test unitario que devuelve el texto guionizado
- [x] 3.5 Extender la configuración de `src/config/server.ts` con la bandera de activación del asistente y la variable de transcripción, actualizando `.env.example`; verificar que el arranque falla con mensaje claro si falta una variable requerida

## 4. Registro de herramientas y contexto

- [x] 4.1 Crear el registro de herramientas con nombre, esquema Zod, carril (`read` o `write`) y manejador, derivando el esquema JSON del mismo Zod; verificar con test que el esquema expuesto al modelo coincide con el validador
- [x] 4.2 Construir el contexto operativo (habitaciones vigentes, capacidades, estados y orígenes válidos, fecha de hoy en `America/Santiago`) leído de la fuente de datos; verificar con test que una habitación agregada aparece sin intervención manual
- [x] 4.3 Ensamblar el prompt con prefijo estable y sección volátil según el design; verificar con test que dos turnos del mismo día producen prefijos byte a byte idénticos

## 5. Herramientas de lectura

- [x] 5.1 Implementar `buscar_disponibilidad` sobre `searchAvailability`; verificar con test que devuelve las habitaciones disponibles del intervalo
- [x] 5.2 Implementar `listar_reservas` con estado, origen, rangos de entrada y salida, búsqueda libre y paginación; verificar con test que la búsqueda por nombre, correo y teléfono devuelve las reservas del huésped
- [x] 5.3 Implementar `ver_reserva` incluyendo estado, estado de pago e historial de cambios; verificar con test que el historial viene completo
- [x] 5.4 Implementar `resumen_financiero` sobre `getAdminDashboardSummary` para mes y año; verificar con test que el ingreso aprobado coincide con el que calcula el sistema y no se recalcula
- [x] 5.5 Implementar `listar_bloqueos` sobre `listRoomBlocks`; verificar con test que respeta los filtros de estado
- [x] 5.6 Verificar con test que una consulta sin resultados se comunica como tal y no produce datos inventados

## 6. Propuestas y herramientas de escritura

- [x] 6.1 Generalizar `proposal-tokens.ts` a cualquier operación, persistiendo operación, carga, actor y expiración en `assistant_interactions`; verificar con tests de expiración, consumo único y pertenencia al actor
- [x] 6.2 Implementar la acción de confirmación que revalida contra datos vigentes antes de ejecutar; verificar con test que una propuesta cuya disponibilidad desapareció entre propuesta y confirmación no se ejecuta
- [x] 6.3 Implementar la acción de cancelación de propuesta; verificar con test que no modifica datos y deja el token inutilizable
- [x] 6.4 Implementar `crear_reserva` como propuesta sobre el núcleo de reserva manual; verificar con tests de datos insuficientes y de habitación no disponible
- [x] 6.5 Implementar `editar_fechas` como propuesta; verificar con test que un intervalo en conflicto no se aplica
- [x] 6.6 Implementar `cambiar_estado` como propuesta para `cancelled`, `completed` y `no_show`; verificar con test que cancelar una reserva con pago aprobado deja el estado de pago intacto y no inicia reembolso
- [x] 6.7 Incluir el estado de pago y el monto en la carga de la propuesta de cancelación como dato informativo; verificar con test que la propuesta los expone
- [x] 6.8 Implementar `registrar_cobro` como propuesta sobre los núcleos de cobro; verificar con test que un pago en estado no cobrable se rechaza
- [x] 6.9 Implementar `crear_bloqueo` y `eliminar_bloqueo` como propuestas; verificar con tests de conflicto con reserva existente y de liberación de disponibilidad al eliminar
- [x] 6.10 Verificar con test que ningún manejador de carril `write` es invocable desde el bucle de agente y que su única salida es una propuesta

## 7. Bucle de agente y endpoint

- [x] 7.1 Implementar el bucle de agente con tope de rondas de herramientas, entregando los resultados marcados como datos y no como instrucciones; verificar con test que al alcanzar el tope responde con lo obtenido y ofrece continuar
- [x] 7.2 Implementar el route handler conversacional autenticado con entrega progresiva y `maxDuration` explícito; verificar que una petición sin sesión de administrador es rechazada sin interpretar nada
- [x] 7.3 Implementar persistencia y recuperación de hilos y mensajes, con aislamiento por administrador; verificar con test que un administrador no accede a hilos de otro
- [x] 7.4 Implementar el manejo de fallas del proveedor como interacción fallida sin efectos; verificar con test que un error y un tiempo excedido no modifican datos y devuelven mensaje accionable
- [x] 7.5 Verificar con test que la instrucción de una operación fuera de la superficie declarada es declinada sin ejecutar nada

## 8. Página y presentación

- [x] 8.1 Reactivar `/admin/asistente` como página completa del módulo, eliminando el redirect; verificar que ocupa el área de contenido y no se presenta como ventana superpuesta
- [x] 8.2 Agregar la entrada de navegación en `admin-shell`; verificar que el estado activo se resuelve correctamente en escritorio y móvil
- [x] 8.3 Construir la interfaz de conversación respetando las fronteras de Atomic Design; verificar que `npm run lint` pasa sin violaciones de `architecture/presentation-boundaries`
- [x] 8.4 Construir la tarjeta de propuesta con operación, entidad, valores absolutos y acciones de confirmar y cancelar; verificar con test que no hay cambio de datos hasta la confirmación
- [x] 8.5 Construir la lista de hilos con apertura de hilo nuevo y retomada de hilos previos; verificar con test de interfaz que el contexto se conserva al retomar
- [x] 8.6 Verificar la accesibilidad de la página con la suite de axe existente en e2e

## 9. Entrada por voz

- [x] 9.1 Implementar la captura de audio con `MediaRecorder` en la interfaz; verificar que el permiso denegado deja la entrada por texto plenamente operativa
- [x] 9.2 Implementar el endpoint autenticado de transcripción sobre el puerto `SpeechTranscriber`; verificar que rechaza peticiones sin sesión de administrador
- [x] 9.3 Colocar la transcripción en el campo de entrada y enviarla automáticamente al terminar el dictado (decisión posterior: se prioriza la velocidad sobre la revisión previa, ya que toda escritura sigue exigiendo confirmación humana); verificar con test de interfaz que detener el dictado envía la instrucción sin un clic adicional
- [x] 9.4 Implementar el manejo de falla de transcripción; verificar con test que informa el fallo, no altera datos y conserva la entrada por texto

## 10. Memoria de preferencias

- [x] 10.1 Implementar la herramienta de registro de hechos, invocable solo ante instrucción explícita del administrador; verificar con test que confirma qué quedó registrado
- [x] 10.2 Incorporar los hechos vigentes al prefijo del prompt; verificar con test que una convención enseñada resuelve a la habitación real y se identifica por su nombre real en la propuesta
- [x] 10.3 Implementar la vista de memoria con edición y borrado; verificar con test que un hecho borrado deja de aplicarse
- [x] 10.4 Verificar con test que texto proveniente de datos de huéspedes, comentarios de reserva o notas importadas nunca origina un hecho de memoria
- [x] 10.5 Verificar con test que un dato que aparenta ser instrucción dentro de un resultado de herramienta se trata como dato y no se ejecuta
- [x] 10.6 Verificar con test que ante contradicción entre memoria y estado vigente gana el estado vigente y se advierte la discrepancia
- [x] 10.7 Verificar con test que un dato del estado operativo no se registra como hecho de memoria

## 11. Proveedor real y despliegue

- [x] 11.1 Implementar el adaptador OpenAI de `AssistantModel` con `gpt-5-mini`, traduciendo el registro de herramientas a su formato de llamadas; verificar con un turno real de lectura en entorno de desarrollo
- [x] 11.2 Implementar el adaptador OpenAI de `SpeechTranscriber`; verificar con un dictado real en entorno de desarrollo
- [x] 11.3 Verificar que el prefijo del prompt se cachea, comprobando que las lecturas de cache dejan de ser cero en turnos consecutivos
- [x] 11.4 Declarar `maxDuration = 60` en la ruta conversacional y fijar el tope del bucle en 6 rondas; confirmar en Settings → Functions del proyecto que el techo del plan lo admite y reducir el tope de rondas si no fuera así
- [x] 11.5 Configurar credenciales y límite de gasto mensual en la consola del proveedor; verificar que el límite queda activo antes de encender la bandera
- [x] 11.6 Verificar que con la bandera apagada la página se comporta como antes del cambio y que encenderla la habilita sin otros efectos

## 12. Verificación integral

- [x] 12.1 Prueba e2e del flujo completo de lectura: instrucción en lenguaje natural, consulta y respuesta con datos reales del entorno de prueba
- [x] 12.2 Prueba e2e del flujo completo de escritura: instrucción, propuesta, confirmación, ejecución y registro de auditoría
- [ ] 12.3 Prueba e2e de cancelación de una reserva con pago aprobado, verificando que el estado de pago queda intacto y que la tarjeta mostró el monto involucrado
- [x] 12.4 Ejecutar `npm run lint`, `npm run typecheck`, `npm run test:unit` y `npm run test:e2e` y verificar que pasan
- [x] 12.5 Actualizar `AGENTS.md` en la regla que hoy limita el asistente a `CREATE_ROOM_BLOCK`, reflejando la superficie ampliada y sus garantías; verificar que el texto concuerda con los specs
