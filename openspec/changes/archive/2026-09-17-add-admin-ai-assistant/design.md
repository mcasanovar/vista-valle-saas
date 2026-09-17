## Context

Ver `proposal.md` — Why para la motivación, y los specs de este cambio para el contrato de comportamiento.

Lo que condiciona el diseño es lo que ya existe:

- `src/features/assistant/` conserva del MVP un intérprete con proveedor inyectable, un esquema de propuesta validado, tokens de propuesta con expiración y una auditoría en memoria. La página `/admin/asistente` existe pero redirige.
- `assistant_interactions` ya está en el esquema, con el enum `assistant_interaction_status` en `proposed | confirmed | cancelled | failed | expired`.
- `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY` y `ASSISTANT_PROPOSAL_TTL_MINUTES` ya se declaran y validan en `src/config/server.ts`.
- `src/features/room-blocks/actions.ts` ya implementa un ciclo revisar → confirmar (`reviewRoomBlocksAction` / `confirmRoomBlocksAction`). Es el patrón a generalizar, no a inventar.
- Las invariantes críticas viven dentro del proceso: serialización por habitación vía `RoomLockGateway`, revalidación de solapamiento dentro de la transacción, y precio por ocupación en `pricing.ts`.
- ESLint impone las fronteras: `architecture/feature-public-api`, `architecture/presentation-boundaries`, `architecture/atomic-direction`.

## Goals / Non-Goals

**Goals:**

- Que la superficie de escritura del asistente sea físicamente incapaz de saltarse la lógica de dominio existente.
- Que cambiar de proveedor o de modelo de IA sea configuración, no reescritura.
- Que el asistente sea testeable de forma determinista, sin llamar a ningún proveedor externo en CI.
- Que un turno lento degrade en un mensaje comprensible, no en una conexión muerta.

**Non-Goals:**

- Optimizar costo por token más allá de cachear el prefijo estable y acotar el bucle. El volumen esperado no lo justifica.
- Soportar varios administradores concurrentes sobre el mismo hilo.
- Generar respuestas habladas, resúmenes automáticos de hilos o títulos inteligentes en esta versión.

## Decisions

### 1. El bucle de agente vive en el proyecto, no en un orquestador externo

Un route handler autenticado de Next.js ejecuta el ciclo petición → llamada a herramienta → resultado → respuesta.

*Por qué:* las herramientas necesitan las invariantes que viven en proceso (locks por habitación, revalidación transaccional, precio por ocupación). Sacar el bucle a N8N o a un agente gestionado obligaría a publicar una API REST nueva para que el orquestador la llame, con su propia autenticación, su versionado y validación duplicada — y `AGENTS.md` prohíbe introducir un backend separado sin cambio aprobado. La autorización ya existe (`requireAdministrator`) y el secreto ya es server-only.

*Alternativas descartadas:* N8N (infra nueva, doble superficie de auth, mal soporte de streaming al navegador); Managed Agents (exigiría una conexión SSE larga desde el servidor para ejecutar herramientas locales); Claude Agent SDK (asume sistema de archivos y subprocesos, mal encaje con serverless).

### 2. Registro de herramientas como lista cerrada con carril declarado

Una única fuente de verdad declara cada herramienta: nombre, esquema de entrada Zod, carril (`read` o `write`) y manejador.

*Por qué:* el esquema JSON que recibe el modelo se deriva del mismo Zod que valida la entrada, así que no pueden divergir. El carril es un dato, no una convención: el bucle **no tiene rama capaz de ejecutar un manejador de escritura**. Un manejador `write` construye y persiste una propuesta y devuelve su token; la ejecución ocurre en una acción de servidor distinta, disparada por el administrador.

*Consecuencia buscada:* que un error futuro al agregar una herramienta de escritura no pueda convertirse en una ejecución sin confirmar. El peor caso es una propuesta que nadie confirma.

### 3. Toda herramienta de escritura envuelve la función de dominio de la pantalla equivalente

`crear_reserva` termina en el mismo camino que `createManualReservationAction`; `editar_fechas` en `editAdminReservationDatesAction`; `cambiar_estado` en `transitionReservationState`; los bloqueos en `createRoomBlocks` / `removeRoomBlock`; los cobros en las acciones de pago existentes.

*Por qué:* es el requisito de paridad del spec. Un camino paralelo significaría duplicar validaciones de capacidad, fechas, conflictos y autorización, y que diverjan con el tiempo.

*Trade-off aceptado:* algunas de esas funciones reciben `FormData` porque nacieron como acciones de servidor. Antes de envolverlas hay que extraer su núcleo tipado, dejando la firma `FormData` como un adaptador delgado sobre él. Es refactor necesario, no oportunista, y no cambia comportamiento observable.

### 4. La propuesta es una fila persistida, no estado de sesión

Cada propuesta se guarda en `assistant_interactions` con su token, el administrador responsable, la operación, la carga interpretada y su expiración. La confirmación es un viaje HTTP aparte que **revalida todo contra los datos vigentes** antes de ejecutar.

*Por qué:* sobrevive a reinicios y despliegues (el spec lo exige), da la auditoría sin estructura adicional, y hace que la confirmación sea idempotente por construcción — el token se consume.

*Nota sobre el esquema:* el enum `assistant_interaction_status` existente cubre los cinco estados necesarios. La operación concreta viaja dentro de `interpretation`, así que **no se requiere migración de enum**.

### 5. El modelo nunca produce identificadores ni montos vinculantes

El modelo propone en términos de lo que el administrador dijo. El servidor resuelve entidades contra datos reales y calcula todo monto con `pricing.ts`, tanto al construir la propuesta como al confirmarla.

*Por qué:* es la diferencia entre un asistente que se equivoca de forma visible y uno que se equivoca de forma cara. Una habitación inventada falla al resolverse; un precio inventado se pagaría.

### 6. Estructura del prompt: prefijo estable primero, volátil después

```
┌─ PREFIJO CACHEADO ─────────────────────────────────┐
│  reglas del asistente                              │
│  esquemas de las 13 herramientas                   │
│  habitaciones vigentes, capacidades, estados       │
│  fecha de hoy en America/Santiago (SOLO fecha)     │
│  hechos de memoria del administrador               │
└────────────────────────────────────────────────────┘
┌─ VOLÁTIL ──────────────────────────────────────────┐
│  historial del hilo · instrucción · resultados     │
└────────────────────────────────────────────────────┘
```

Precisión que importa para quien lo implemente: **la fecha con granularidad de día puede ir dentro del prefijo cacheado**, porque es estable durante 24 horas y el cache vive minutos. Lo que sí lo invalidaría en cada petición es una marca de tiempo completa. La regla operativa es: nada que cambie entre dos peticiones del mismo día puede ir en el prefijo.

Los hechos de memoria van en el prefijo porque cambian rara vez; editarlos invalida el cache una vez, lo cual es correcto.

*Verificación:* si `cache_read` sale en cero en peticiones consecutivas, algo volátil se filtró arriba.

### 7. Transcripción por servidor, detrás de un puerto tipado

El navegador graba con `MediaRecorder`, sube el audio a un endpoint autenticado, el servidor transcribe y devuelve texto. La interfaz lo coloca en el campo de entrada y lo envía de inmediato — se prioriza la velocidad sobre la revisión previa; el resguardo ante un error de transcripción es el mismo que para cualquier instrucción escrita: ninguna escritura se ejecuta sin confirmación humana posterior.

*Por qué por servidor y no `SpeechRecognition` del navegador:* funciona en todos los navegadores (el del navegador no está en Firefox), acierta mejor con nombres propios y nombres de habitación, mantiene la clave fuera del cliente y —dado que el proveedor elegido es OpenAI— reutiliza el mismo proveedor, la misma clave y la misma factura en lugar de enviar audio con datos personales de huéspedes a un tercero adicional.

*Trade-off aceptado:* no hay transcripción en vivo mientras se habla; hay una espera corta al soltar. A cambio, una sola dependencia.

*Puerto:* `SpeechTranscriber` con una operación `transcribe(audio) → texto`. La implementación del navegador queda como alternativa viable si el costo o la latencia molestan.

### 8. Adaptador de proveedor con doble implementación

Un puerto `AssistantModel` expone una operación de turno que recibe mensajes y herramientas y devuelve texto o llamadas a herramientas. Dos implementaciones: OpenAI con `gpt-5-mini`, y una mock determinista guionizada.

*Por qué:* `AGENTS.md` exige proveedores detrás de adaptadores tipados; el mock permite que la suite completa corra en CI sin red ni credenciales, que es como ya está construido `createMockRoomBlockInterpreter`. También deja abierta la decisión de proveedor, que el usuario pidió mantener reversible.

### 9. Bucle acotado y entrega progresiva, en vez de depender del límite de la plataforma

El bucle tiene un tope de rondas de herramientas. Al alcanzarlo, el asistente responde con lo que tiene y ofrece continuar, en lugar de seguir hasta que la plataforma corte la conexión. La respuesta se transmite progresivamente desde el primer token.

*Por qué:* un tope propio hace el comportamiento predecible con independencia del límite de la plataforma, y el streaming evita que el administrador mire una pantalla quieta.

*Valores:* el proyecto corre en plan Hobby con Fluid Compute activo, cuyo techo verificado es de 300 segundos. La ruta conversacional declara `maxDuration = 60` en su propio módulo y el bucle se acota en 6 rondas de herramientas.

El techo disponible no se usa como valor: un turno de varios minutos indica un ciclo o una dependencia colgada, y en ese caso conviene que la función muera pronto en lugar de retener conexiones y locks. Por la misma razón el valor por defecto del proyecto se mantiene en 60 segundos y no en el techo del plan; un default alto lo hereda todo, incluidos los webhooks de pago y las rutas programadas.

La ruta conversacional declara su `maxDuration` de todos modos, aunque hoy coincida con el default del proyecto: deja el requisito junto al código que lo necesita, de modo que bajar el default más adelante no rompa el asistente en silencio.

### 10. Memoria: escritura explícita, lectura de solo lectura

Registrar un hecho es una herramienta que solo se invoca cuando el administrador lo pide. Los resultados de las herramientas se entregan al modelo marcados como datos, nunca como instrucciones, y nada de ese contenido puede originar una escritura en memoria.

*Por qué:* la memoria se inyecta en el prefijo de todas las sesiones futuras. Sin esta separación, el nombre de un huésped o una nota importada de un canal se convierte en un canal de inyección persistente. El spec lo exige con tres escenarios.

### 11. Despliegue detrás de una bandera

Una variable de entorno controla si el asistente está activo, siguiendo el patrón de `BOOKING_ENABLED`. Apagada, la página se comporta como hoy.

## Risks / Trade-offs

**Superficie de escritura mucho mayor que el MVP** → Ningún manejador de escritura es invocable desde el bucle; toda escritura pasa por propuesta persistida, confirmación humana y revalidación contra datos vigentes; toda escritura reutiliza la función de dominio de la pantalla equivalente.

**Inyección de prompt a través de datos de huéspedes o canales** → Resultados de herramientas entregados como datos; escritura en memoria solo por instrucción explícita; memoria visible y editable; ninguna escritura se ejecuta sin confirmación visual.

**Refactor de acciones que hoy reciben `FormData`** → Extraer el núcleo tipado y dejar la firma `FormData` como adaptador. Cubierto por los tests existentes de esas acciones, que deben seguir pasando sin modificarse.

**Turno que excede el límite de duración de la plataforma** → Tope propio de 6 rondas, streaming desde el primer token y `maxDuration = 60` declarado en la ruta, dentro de la holgura que da Hobby con Fluid Compute. Si el techo resultara menor, se reduce el tope de rondas; la arquitectura no cambia.

**Costo por uso creciendo sin que nadie mire** → Prefijo cacheado, tope de rondas, modelo intercambiable por variable de entorno, y límite de gasto configurado en la consola del proveedor. Es mitigación operativa, no técnica.

**Audio con datos personales saliendo a un tercero** → Un solo proveedor en lugar de dos; el audio no se conserva más allá de la transcripción; el administrador conserva la entrada por texto.

**La memoria envejece y contradice al sistema** → El estado vigente siempre gana sobre la memoria y la discrepancia se advierte; la memoria es revisable y borrable.

## Migration Plan

1. Tablas nuevas para hilos, mensajes y hechos de memoria. `assistant_interactions` ya existe y no requiere migración de enum.
2. Extracción de núcleos tipados en las acciones de administración que se van a envolver, sin cambio de comportamiento.
3. Asistente construido y probado contra el adaptador mock, con la bandera apagada.
4. Adaptador OpenAI, credenciales reales y límite de gasto configurado.
5. Confirmación del techo de duración en la configuración del proyecto y ajuste del tope de rondas si fuera necesario.
6. Activación de la bandera.

**Rollback:** apagar la bandera. La página vuelve a redirigir y ninguna operación queda a medias, porque las propuestas sin confirmar no modifican datos y expiran solas.

## Open Questions

- Cómo se nombran los hilos en la lista. Un título derivado de la primera instrucción alcanza para la primera versión; generarlo con el modelo es una mejora posterior que no toca specs.
