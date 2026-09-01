## Why

La validación del formulario de datos del huésped puede presentar mensajes predeterminados de la librería en inglés. Una experiencia pública de Vista Valle debe comunicar todos sus errores y estados recuperables en español claro, sin filtrar mensajes técnicos.

## What Changes

- Establecer un contrato de idioma español para los mensajes de error, validación y recuperación que se entregan a visitantes desde la interfaz pública y sus APIs públicas.
- Reemplazar los textos predeterminados o técnicos que alcancen formularios y controladores públicos por mensajes claros, accionables y en español.
- Incorporar pruebas que impidan que regresen mensajes en inglés a los flujos de disponibilidad, cotización y reserva.

## Capabilities

### New Capabilities

- `public-user-message-localization`: Mensajes de error y validación orientados al cliente en español para los flujos públicos.

### Modified Capabilities

- `availability-search-experience`: Los estados recuperables y los errores de criterios de búsqueda deben mantenerse en español para el visitante.

## Impact

- Afecta validadores de formularios públicos, adaptadores de respuesta de APIs públicas y sus controladores de interfaz.
- Afecta pruebas unitarias y de interfaz de disponibilidad, cotizaciones y reservas.
- No modifica datos persistidos, precios, disponibilidad ni integraciones externas.
