# public-user-message-localization Specification

## Purpose

Garantizar que quienes interactúan con los flujos públicos reciban mensajes comprensibles y accionables en español, sin que se expongan textos técnicos de dependencias o servicios internos.

## Requirements

### Requirement: Mensajes públicos de error en español
El sistema SHALL entregar en español todos los mensajes de validación, error y recuperación que se muestren a visitantes desde formularios, páginas públicas o respuestas de APIs públicas consumidas por la interfaz.

#### Scenario: Validación de formulario público inválido
- **WHEN** una persona envía un formulario público con datos ausentes, mal formados o fuera de rango
- **THEN** cada mensaje visible identifica la corrección necesaria en español y no muestra mensajes predeterminados de una librería

#### Scenario: Fallo recuperable de una operación pública
- **WHEN** una operación pública falla y la interfaz muestra su respuesta al visitante
- **THEN** la interfaz comunica un mensaje seguro y accionable en español sin exponer detalles técnicos, nombres internos ni trazas

### Requirement: Contrato de mensaje seguro en APIs públicas
Las APIs públicas SHALL responder errores esperados con mensajes en español aptos para mostrarse a visitantes, y SHALL normalizar fallos inesperados antes de responderlos.

#### Scenario: Error de entrada de reserva
- **WHEN** una solicitud pública de reserva contiene datos de huésped o facturación inválidos
- **THEN** la respuesta contiene un mensaje en español que la interfaz puede presentar sin traducción adicional

#### Scenario: Error inesperado del servidor
- **WHEN** ocurre un error no previsto durante una operación pública
- **THEN** la respuesta conserva el detalle técnico solo para observabilidad del servidor y entrega al visitante una explicación genérica en español
