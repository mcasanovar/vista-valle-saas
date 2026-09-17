## Why

Operar Vista Valle exige entrar al panel, encontrar la pantalla correcta y llenar un formulario para cada tarea: crear una reserva telefónica, mover fechas, cancelar, bloquear una habitación, revisar cuánto se facturó en el mes. Cuando el administrador está ocupado —atendiendo huéspedes, fuera del computador, con el teléfono en la mano— ese costo de navegación es la razón por la que las tareas se posponen o se anotan en papel para después.

Este cambio agrega un asistente conversacional en el panel de administración que recibe instrucciones en lenguaje natural, escritas o dictadas por voz, y ejecuta contra las mismas operaciones que ya existen en las pantallas, con confirmación humana obligatoria antes de cualquier escritura.

El asistente no agrega capacidades nuevas de negocio: agrega una forma más rápida de invocar las que ya están construidas y probadas.

## What Changes

### Página del asistente

- Se reactiva `/admin/asistente`, hoy un `redirect("/admin")`, como página completa del módulo —no un panel flotante ni una ventana superpuesta—, con su entrada en la navegación de `admin-shell`.
- La conversación persiste entre sesiones: el administrador puede retomar un hilo o abrir uno nuevo.
- Las respuestas del asistente llegan en streaming. El asistente responde siempre en texto.

### Entrada por voz

- El administrador puede dictar instrucciones además de escribirlas.
- La transcripción se muestra en el campo de texto y **se envía de inmediato al terminar el dictado**, sin esperar una acción de envío separada. El resguardo ante un error de transcripción no es la edición previa, sino que ninguna escritura se ejecuta sin confirmación humana posterior — igual que con una instrucción escrita.
- La transcripción vive detrás de un puerto tipado, igual que el resto de los proveedores externos, para no acoplar la funcionalidad a un servicio concreto.

### Superficie de operaciones

Dos carriles con reglas distintas:

**Lectura — se ejecuta directo, sin confirmación:**

- Buscar disponibilidad por fecha o rango.
- Listar y filtrar reservas por estado, origen, rango de entrada/salida y búsqueda libre (que ya cubre nombre, email, teléfono, RUT, empresa, identificador público y nombre de habitación — con esto "las reservas de un huésped" no requiere una operación aparte).
- Ver el detalle de una reserva, incluido su historial de cambios de estado.
- Consultar el resumen financiero y de ocupación de un mes o un año.
- Listar bloqueos de habitación.

**Escritura — propone, el administrador confirma, recién entonces se ejecuta:**

- Crear una reserva manual.
- Editar las fechas de una reserva.
- Cambiar el estado de una reserva a `cancelled`, `completed` o `no_show`.
- Registrar el cobro de un pago pendiente y marcar un pago como recibido.
- Crear y eliminar bloqueos de habitación.

Cada operación de escritura invoca **la misma función de dominio que usa el formulario de la pantalla correspondiente**. El asistente no obtiene ningún camino de escritura propio.

### Cancelaciones sin reembolso

- Cancelar una reserva cambia su estado y **no toca el estado de pago ni inicia reembolso alguno**; la gestión del dinero se hace fuera del sistema.
- La tarjeta de confirmación **muestra el estado de pago vigente** como dato informativo, para que el administrador sepa si le corresponde gestionar plata por fuera. Es información, no una acción.

### Memoria de preferencias

- El asistente conserva hechos que el administrador le enseña explícitamente —vocabulario propio para habitaciones, criterios operativos recurrentes— y los aplica en interacciones posteriores.
- La memoria **solo se escribe por instrucción explícita del administrador**. Nunca se infiere de datos de huéspedes, notas de canales externos ni texto de terceros.
- La memoria es visible, editable y borrable desde la página del asistente.
- El contexto operativo del sistema —habitaciones, capacidades, tarifas, estados válidos— **no es memoria**: se lee de la base de datos en cada sesión y nunca se aprende.

### Ejecución y proveedor

- Se generaliza el mecanismo de propuesta con token que hoy existe solo para bloqueos (`proposal-tokens.ts`, y el par `reviewRoomBlocksAction`/`confirmRoomBlocksAction`) a todas las operaciones de escritura.
- La auditoría de interacciones pasa del almacenamiento en memoria a la tabla `assistant_interactions`, que ya existe en el esquema.
- El proveedor de IA queda detrás de un adaptador tipado, alimentado por las variables `AI_PROVIDER`, `AI_MODEL` y `AI_API_KEY` que ya valida `src/config/server.ts`. La implementación de este cambio usa OpenAI con `gpt-5-mini`; cambiar de proveedor o de modelo no debe requerir tocar la lógica del asistente.

### Fuera de alcance

- Notificaciones salientes de reservas nuevas: el correo existente ya cumple esa función.
- Cualquier canal de mensajería adicional (WhatsApp, Telegram, push).
- Reembolsos, notas de crédito y devoluciones.
- Respuestas habladas: el asistente responde solo en texto.
- Operaciones sobre habitaciones, tarifas, fotos, cotizaciones de empresa y sincronizaciones de canal.

## Capabilities

### New Capabilities

- `admin-ai-assistant`: La página conversacional del panel: hilos persistentes, entrada por texto y por voz con transcripción editable, respuestas en texto con streaming, manejo de fallas del proveedor y auditoría de cada interacción.
- `admin-assistant-operations`: La superficie de operaciones que el asistente puede invocar, separada en lectura directa y escritura con propuesta y confirmación humana, y su correspondencia uno a uno con las operaciones ya disponibles en las pantallas de administración.
- `admin-assistant-memory`: Los hechos que el administrador le enseña al asistente: cómo se escriben, cómo se aplican, cómo se revisan y por qué el contexto del sistema queda excluido.

### Modified Capabilities

- `calendar-assistant`: Deja de ser un asistente restringido a `CREATE_ROOM_BLOCK` con una respuesta mock determinista. El alcance de interpretación se amplía a todas las operaciones de `admin-assistant-operations`, la respuesta mock única se reemplaza por un proveedor real detrás de un adaptador, y el mecanismo de propuesta y confirmación se generaliza. Las garantías que se conservan sin cambio —validación determinista posterior a la interpretación, confirmación humana obligatoria, prohibición de acceso directo a SQL, auditoría y alternativa manual— pasan a aplicar sobre la superficie ampliada.

## Impact

### Código afectado

- `app/(admin-protected)/admin/asistente/page.tsx` — deja de redirigir.
- `app/api/admin/assistant/**` — nuevo route handler para el turno conversacional con streaming, y para la transcripción de audio.
- `src/features/assistant/**` — crece de intérprete de bloqueos a asistente completo: registro de herramientas, bucle de agente, propuestas, memoria, persistencia de hilos.
- `src/features/admin/admin-shell.tsx` — nueva entrada de navegación.
- Consumo (sin modificar) de `@/features/availability`, `@/features/reservations`, `@/features/admin` y `@/features/room-blocks` a través de sus barriles públicos.

### Base de datos

- `assistant_interactions` ya existe y pasa a usarse de verdad; requiere revisar si el enum `assistant_interaction_status` cubre los estados necesarios.
- Tablas nuevas para hilos de conversación, mensajes y memoria de preferencias.

### Configuración

- `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY` y `ASSISTANT_PROPOSAL_TTL_MINUTES` ya existen y ya se validan; pasan a tener valores reales en producción.
- Posible variable adicional para el servicio de transcripción, según el proveedor que se elija.

### Riesgos

- **Superficie de escritura ampliada.** El asistente podrá cancelar reservas y registrar cobros. La mitigación es estructural: toda escritura pasa por propuesta, revalidación determinista y confirmación humana, y reutiliza la función de dominio de la pantalla equivalente.
- **Inyección de prompt vía memoria.** Un hecho aprendido termina en el contexto de sesiones futuras. Se mitiga restringiendo la escritura a instrucciones explícitas del administrador y haciendo la memoria visible y editable.
- **Privacidad en el dictado.** El audio puede contener nombres, teléfonos y correos de huéspedes. La elección del servicio de transcripción debe hacerse con ese dato a la vista.
- **Costo por uso.** Cada instrucción consume tokens del proveedor. Se mitiga cacheando el prefijo estable del prompt y manteniendo el contenido volátil —la fecha de hoy, sobre todo— fuera de ese prefijo.
- **Tiempo de ejecución.** Un turno con varias llamadas a herramientas puede superar el límite de duración de una función serverless; el streaming es parte de la mitigación y el límite debe verificarse antes de cerrar el diseño.
