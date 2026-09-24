## ADDED Requirements

### Requirement: Progreso de pasos con panel único visible y retroceso mediante un único botón
El sistema SHALL organizar `/cotizacion-empresa` en tres pasos (Fechas y personas, Habitaciones, Datos de empresa y desayunos) mostrados mediante un indicador de progreso persistente, y SHALL mostrar en cada momento el panel de un solo paso a la vez: el contenido de un paso ya completado SHALL dejar de mostrarse en pantalla mientras el visitante permanece en un paso posterior. El sistema SHALL ofrecer un único control "Atrás", ubicado inmediatamente debajo del indicador de progreso, que retrocede al paso inmediatamente anterior conservando la información ya ingresada en él; este control SHALL estar ausente en el primer paso y SHALL ser el único medio de retroceso (sin controles adicionales de "editar" específicos de cada paso).

#### Scenario: Un solo panel visible
- **WHEN** el visitante avanza del paso de habitaciones al paso de datos de empresa
- **THEN** el sistema deja de mostrar el panel de selección de habitaciones y muestra únicamente el panel de datos de empresa y desayunos

#### Scenario: Retroceder con el botón Atrás
- **WHEN** el visitante activa el botón "Atrás" ubicado debajo del indicador de progreso
- **THEN** el sistema vuelve a mostrar el panel del paso inmediatamente anterior con la información ya ingresada, oculta el panel del paso del que retrocede, y actualiza el indicador de progreso para reflejar el paso anterior

#### Scenario: Sin botón Atrás en el primer paso
- **WHEN** el visitante está en el primer paso del flujo (Fechas y personas)
- **THEN** el sistema no muestra el botón "Atrás"

### Requirement: Confirmación explícita de habitación mediante selección de personas y agregado
Al elegir una habitación disponible, el sistema SHALL mostrar primero un selector para indicar cuántas personas se alojarán en ella sin contarla todavía en el total asignado, y SHALL requerir que el visitante confirme una acción explícita "Agregar habitación" para que esa cantidad pase a formar parte del total asignado. El sistema SHALL permitir cancelar la configuración de una habitación antes de confirmarla, sin afectar el total asignado, y SHALL permitir quitar una habitación ya agregada, devolviendo su cantidad al total disponible para asignar.

#### Scenario: Elegir una habitación abre el selector sin asignarla
- **WHEN** el visitante elige una habitación disponible que no está configurada ni agregada
- **THEN** el sistema muestra el selector de cantidad de personas para esa habitación sin sumarla todavía al total asignado

#### Scenario: Confirmar agrega la habitación
- **WHEN** el visitante elige una cantidad de personas para una habitación en configuración y activa "Agregar habitación"
- **THEN** el sistema suma esa cantidad al total asignado y muestra la habitación como agregada

#### Scenario: Cancelar no asigna
- **WHEN** el visitante cancela la configuración de una habitación antes de confirmarla
- **THEN** el sistema no suma ninguna cantidad de esa habitación al total asignado y la vuelve a mostrar como disponible para elegir

#### Scenario: Quitar una habitación agregada
- **WHEN** el visitante quita una habitación ya agregada
- **THEN** el sistema resta su cantidad del total asignado y la vuelve a mostrar como disponible para elegir

### Requirement: Progreso visual de personas asignadas
El sistema SHALL mostrar el progreso de personas asignadas frente al total mediante un indicador visual de puntos o avatares que se llenan a medida que se agregan habitaciones, en lugar de depender de una oración como único medio de comunicarlo, y SHALL mantener un texto accesible equivalente para tecnologías de asistencia que se actualice junto con el indicador visual.

#### Scenario: Indicador visual de progreso
- **WHEN** el visitante agrega o quita una habitación
- **THEN** el sistema actualiza el indicador visual de puntos para reflejar cuántas personas del total ya están asignadas

#### Scenario: Equivalente accesible
- **WHEN** el indicador visual de progreso cambia
- **THEN** el sistema expone un texto accesible equivalente (por ejemplo "4 de 6 personas asignadas") para tecnologías de asistencia

### Requirement: Avance explícito al paso de datos de empresa
El sistema SHALL mostrar en el paso de habitaciones un botón "Continuar" que SHALL permanecer deshabilitado mientras el total de personas agregadas sea distinto del total de la cotización, y SHALL avanzar al paso de datos de empresa y desayunos únicamente cuando el visitante lo active con la asignación completa.

#### Scenario: Continuar deshabilitado
- **WHEN** el total de personas agregadas es distinto del total de la cotización
- **THEN** el botón "Continuar" permanece deshabilitado y el paso de datos de empresa no se muestra

#### Scenario: Continuar habilitado y avance
- **WHEN** el total de personas agregadas es exactamente igual al total de la cotización y el visitante activa "Continuar"
- **THEN** el sistema muestra el paso de datos de empresa y desayunos y oculta el panel de habitaciones

## MODIFIED Requirements

### Requirement: Selección de habitaciones y capacidad visible
El sistema SHALL permitir indicar la cantidad total de personas y, para cada tipo de habitación con al menos una unidad disponible en las fechas consultadas, elegirla para configurar cuántas de las personas del total se alojarían en ella, sin permitir más de una unidad configurada o agregada por tipo aunque existan varias unidades disponibles. El sistema SHALL impedir configurar o agregar a una habitación una cantidad de personas mayor que su capacidad máxima, y SHALL impedir que la suma de personas agregadas en las habitaciones supere el total indicado para la cotización.

#### Scenario: Capacidades mock iniciales
- **WHEN** el visitante consulta las opciones de habitación
- **THEN** el sistema muestra Individual con capacidad máxima de 1 persona, Matrimonial con capacidad máxima de 1 persona y Doble con capacidad máxima de 2 personas

#### Scenario: Selección mediante botón
- **WHEN** el visitante activa el botón "Elegir" de una habitación disponible
- **THEN** el sistema la marca como en configuración y muestra un control para indicar cuántas personas se alojarán en ella (hasta su capacidad máxima), sin sumarla todavía al total asignado

#### Scenario: Máximo una unidad por tipo
- **WHEN** un tipo de habitación tiene más de una unidad disponible para las fechas consultadas
- **THEN** el sistema permite configurar o agregar como máximo una unidad de ese tipo por cotización

#### Scenario: Bloqueo por capacidad de la habitación
- **WHEN** el visitante intenta configurar en una habitación una cantidad de personas mayor que su capacidad máxima
- **THEN** el sistema impide la selección de esa cantidad y no permite superar la capacidad de esa habitación

#### Scenario: Bloqueo al completar el total
- **WHEN** la suma de personas agregadas en las habitaciones alcanza el total de personas de la cotización
- **THEN** el sistema bloquea la posibilidad de configurar cantidades adicionales en cualquier habitación y bloquea elegir habitaciones adicionales, hasta que se libere capacidad quitando alguna habitación agregada

#### Scenario: Remanente disponible para cualquier habitación
- **WHEN** la suma de personas agregadas es menor que el total de personas de la cotización
- **THEN** el sistema permite configurar el remanente de personas en cualquiera de las habitaciones que aún no estén agregadas y tengan capacidad disponible

#### Scenario: Capacidad suficiente
- **WHEN** la suma de personas agregadas en las habitaciones es exactamente igual al total de personas de la cotización
- **THEN** el sistema habilita el botón "Continuar" para avanzar al paso de datos de empresa

#### Scenario: Capacidad insuficiente
- **WHEN** la suma de personas agregadas en las habitaciones es menor que el total de personas de la cotización
- **THEN** el sistema mantiene deshabilitado el botón "Continuar" y no muestra el paso de datos de empresa

#### Scenario: Cantidades inválidas
- **WHEN** una solicitud indica cantidades de personas por habitación negativas, fraccionarias o no válidas (por ejemplo, enviadas directamente a la API sin pasar por el control de asignación)
- **THEN** el sistema marca el campo correspondiente y no calcula ni envía una cotización válida

### Requirement: Selector y detalle de desayunos
El sistema SHALL ofrecer, en el paso de datos de empresa y desayunos, un selector booleano "¿Desea desayunos?" con valor por defecto "No". Cuando el visitante seleccione "No", el resto del flujo SHALL continuar sin cambios y el sistema SHALL registrar la solicitud de desayuno como no solicitada. Cuando el visitante seleccione "Sí", el sistema SHALL mostrar un bloque con la descripción vigente de lo que incluye el desayuno, su precio unitario en CLP, un campo numérico obligatorio para indicar la cantidad de desayunos deseados por noche (obtenidos del catálogo de desayuno administrable), y un texto de ayuda persistente junto al campo que explique que esa cantidad se multiplicará por la cantidad de noches de la estadía para calcular el total del servicio.

#### Scenario: Desayuno no solicitado
- **WHEN** el visitante deja o selecciona "No" en "¿Desea desayunos?"
- **THEN** el sistema no muestra el bloque de detalle de desayuno y registra la cotización sin desayuno

#### Scenario: Desayuno solicitado
- **WHEN** el visitante selecciona "Sí" en "¿Desea desayunos?"
- **THEN** el sistema despliega la descripción vigente del desayuno, su precio unitario en CLP, un campo numérico para la cantidad deseada por noche y el texto de ayuda sobre la multiplicación por noches

#### Scenario: Cantidad de desayunos inválida
- **WHEN** el visitante selecciona "Sí" pero indica una cantidad de desayunos por noche ausente, cero, negativa o fraccionaria
- **THEN** el sistema marca el campo como obligatorio y no envía la cotización

#### Scenario: Texto de ayuda sobre el cálculo del desayuno
- **WHEN** el visitante ve el campo de cantidad de desayunos por noche en el paso de datos de empresa
- **THEN** el sistema muestra junto al campo, sin necesidad de interacción adicional, la explicación de que el total de desayunos se calcula multiplicando esa cantidad por noche por la cantidad de noches de la estadía
