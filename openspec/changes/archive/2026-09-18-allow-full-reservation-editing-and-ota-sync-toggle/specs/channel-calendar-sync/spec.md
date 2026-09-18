## ADDED Requirements

### Requirement: Interruptor de pausa de sincronización por plataforma

El sistema SHALL permitir a un administrador pausar y reanudar, de forma independiente para cada plataforma (Airbnb, Booking), el sondeo del feed entrante y la publicación del feed saliente de todas las conexiones de esa plataforma, sin modificar el estado `enabled` individual de cada conexión de canal. Mientras una plataforma esté pausada, el sistema SHALL omitir el sondeo entrante de sus conexiones y SHALL rechazar las solicitudes al feed saliente de sus conexiones. Al reanudar una plataforma, cada conexión SHALL retomar el comportamiento que tenía configurado antes de la pausa.

#### Scenario: Pausar Airbnb

- **WHEN** un administrador pausa la plataforma Airbnb
- **THEN** el sistema deja de sondear el feed entrante de todas las conexiones de Airbnb y el feed saliente de esas conexiones deja de responder, sin afectar las conexiones de Booking

#### Scenario: Reanudar una plataforma pausada

- **WHEN** un administrador reanuda una plataforma previamente pausada
- **THEN** cada conexión de esa plataforma retoma el sondeo entrante y la publicación del feed saliente exactamente con la configuración `enabled` que tenía antes de la pausa

#### Scenario: Consulta al feed saliente de una plataforma pausada

- **WHEN** Airbnb o Booking consulta el feed saliente de una conexión cuya plataforma está pausada
- **THEN** el sistema rechaza la solicitud sin exponer datos de ocupación

#### Scenario: Pausa de una plataforma no afecta a la otra

- **WHEN** una plataforma está pausada y la otra permanece activa
- **THEN** el sondeo entrante y el feed saliente de la plataforma activa continúan funcionando con normalidad
