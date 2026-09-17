## Purpose

Dar al administrador una página conversacional dentro del panel donde pueda pedir en lenguaje natural —escrito o dictado— las tareas operativas de reservas y bloqueos que hoy exigen navegar a una pantalla y llenar un formulario, conservando trazabilidad completa de cada interacción.

## ADDED Requirements

### Requirement: Página dedicada del asistente
El asistente SHALL vivir en una página completa del módulo de administración y MUST NOT presentarse como ventana superpuesta, panel flotante ni widget sobre otra pantalla.

#### Scenario: Acceso desde la navegación
- **WHEN** el administrador autenticado selecciona el asistente en la navegación del panel
- **THEN** el sistema muestra la página del asistente ocupando el área de contenido completa del módulo

#### Scenario: Acceso sin autorización
- **WHEN** una petición a la página o al endpoint conversacional del asistente llega sin sesión de administrador válida
- **THEN** el sistema deniega el acceso y no ejecuta ninguna interpretación ni operación

### Requirement: Conversación persistente
El sistema SHALL conservar los hilos de conversación entre sesiones y SHALL permitir al administrador retomar un hilo anterior o iniciar uno nuevo.

#### Scenario: Retomar un hilo
- **WHEN** el administrador vuelve a la página del asistente después de cerrar el navegador
- **THEN** el sistema muestra sus hilos anteriores y permite continuar cualquiera de ellos conservando el contexto ya intercambiado

#### Scenario: Iniciar un hilo nuevo
- **WHEN** el administrador inicia un hilo nuevo
- **THEN** el sistema abre una conversación sin contexto de mensajes previos, conservando el contexto operativo del sistema y la memoria de preferencias

#### Scenario: Aislamiento por administrador
- **WHEN** un administrador abre la página del asistente
- **THEN** el sistema muestra únicamente los hilos de ese administrador y no expone los de otro

### Requirement: Respuesta en texto con entrega progresiva
El asistente SHALL responder siempre en texto y SHALL entregar su respuesta de forma progresiva para que el administrador perciba avance durante turnos que invocan varias operaciones.

#### Scenario: Turno con varias operaciones
- **WHEN** el asistente necesita consultar más de una operación de lectura antes de responder
- **THEN** el sistema mantiene informado al administrador del avance y entrega la respuesta a medida que se produce, sin dejar la interfaz sin señal de actividad

#### Scenario: Sin respuesta hablada
- **WHEN** el administrador envía una instrucción por voz
- **THEN** el asistente responde en texto y no genera audio

### Requirement: Entrada por voz con envío inmediato
El sistema SHALL permitir dictar instrucciones además de escribirlas. Al terminar el dictado, MUST colocar la transcripción en el campo de texto y enviarla de inmediato, sin esperar una acción de envío separada. La revisión previa se sacrifica por velocidad: el resguardo real sigue siendo que ninguna escritura se ejecuta sin confirmación humana posterior (ver "Propuesta obligatoria para toda escritura" en `admin-assistant-operations`), independientemente de si la instrucción llegó escrita o dictada.

#### Scenario: Dictado exitoso
- **WHEN** el administrador dicta una instrucción y termina el dictado
- **THEN** el sistema coloca el texto transcrito en el campo de entrada y lo envía automáticamente al asistente, sin requerir que el administrador presione enviar

#### Scenario: Transcripción no disponible
- **WHEN** el servicio de transcripción falla o el navegador no permite capturar audio
- **THEN** el sistema informa la falla, mantiene la entrada por texto plenamente operativa y no altera ningún dato

### Requirement: Contexto operativo actualizado
El sistema MUST proveer al asistente el contexto operativo vigente —habitaciones existentes, capacidades, estados de reserva válidos y orígenes válidos— leído de la fuente de datos del sistema, y MUST proveer la fecha actual interpretada en `America/Santiago` en cada turno.

#### Scenario: Referencia temporal relativa
- **WHEN** el administrador usa una referencia temporal relativa como "este fin de semana" o "el viernes"
- **THEN** el asistente la resuelve contra la fecha actual en `America/Santiago` y expone las fechas absolutas resultantes antes de cualquier ejecución

#### Scenario: Habitación agregada recientemente
- **WHEN** se agrega una habitación al sistema y el administrador inicia una conversación después
- **THEN** el asistente reconoce esa habitación sin requerir intervención manual sobre su configuración

### Requirement: Falla del proveedor sin efectos
El sistema MUST tratar cualquier falla, tiempo excedido o respuesta no interpretable del proveedor de IA como interacción fallida, sin modificar datos.

#### Scenario: Proveedor no disponible
- **WHEN** el proveedor de IA devuelve un error o excede el tiempo de respuesta
- **THEN** el sistema informa la falla al administrador, no modifica ningún dato y le indica que la operación sigue disponible en su pantalla correspondiente

#### Scenario: Credenciales ausentes
- **WHEN** la configuración del proveedor de IA no está disponible
- **THEN** la página informa que el asistente está fuera de servicio y no ofrece enviar instrucciones

### Requirement: Auditoría de interacciones
El sistema SHALL conservar de forma duradera, por cada interacción que derive en una operación de escritura, la instrucción original, la interpretación producida, las correcciones aplicadas, la confirmación o cancelación, el administrador responsable y el resultado.

#### Scenario: Operación ejecutada
- **WHEN** el administrador confirma una propuesta y la operación se ejecuta
- **THEN** el sistema conserva el registro completo de esa interacción y la entidad afectada queda identificada como originada desde el asistente

#### Scenario: Propuesta descartada
- **WHEN** el administrador cancela una propuesta o esta expira sin confirmarse
- **THEN** el sistema conserva el registro de la interacción con ese desenlace y no modifica ningún dato

#### Scenario: Persistencia entre despliegues
- **WHEN** el sistema se reinicia o se despliega una versión nueva
- **THEN** los registros de auditoría de interacciones anteriores siguen disponibles
