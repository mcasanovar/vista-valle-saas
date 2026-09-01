## Why

La consulta de disponibilidad actual presenta una lista mínima dentro de la página de inicio y deja mezclados el descubrimiento, la búsqueda y el resto del proceso de reserva. Vista Valle necesita una experiencia de resultados dedicada que entregue feedback inmediato, mantenga visibles los criterios buscados y permita comparar claramente las habitaciones disponibles, todavía bajo datos y adaptadores mock.

## What Changes

- Mantener en la página de inicio, debajo del hero, la captura de entrada, salida y cantidad de huéspedes.
- Entregar feedback de carga general y accesible desde el envío hasta la presentación de resultados, sin introducir una demora artificial.
- Navegar las búsquedas válidas a una nueva página pública de disponibilidad con los criterios representados en la URL.
- Presentar en la parte superior de la página de resultados una barra de búsqueda reutilizable y editable con los valores consultados.
- Mostrar debajo una colección visual y responsive de habitaciones disponibles con información mock suficiente para comparar y continuar al detalle conservando los criterios de búsqueda.
- Incorporar estados claros para carga, resultados, ausencia de disponibilidad, entrada inválida y error recuperable.
- Conservar la fuente mock determinista y las validaciones autoritativas actuales; no conectar PostgreSQL, Supabase ni proveedores externos en este cambio.
- Mantener fuera de alcance mapas, ordenamiento, filtros avanzados, paginación, recomendaciones de fechas alternativas y datos comerciales reales.

## Capabilities

### New Capabilities

- `availability-search-experience`: Cubre la transición desde el buscador de la página de inicio hacia una página dedicada, la persistencia de criterios, el feedback de carga y la presentación accesible de resultados mock.

### Modified Capabilities

- Ninguna. Las capacidades del MVP inicial todavía viven en un cambio activo no archivado; este cambio agrega una experiencia pública delimitada sin alterar sus reglas de disponibilidad ni reserva.

## Impact

- Afecta la integración del buscador de la home, el routing público de Next.js, la presentación de resultados, los modelos de lectura de habitaciones y las pruebas unitarias/end-to-end de búsqueda.
- Reutiliza el motor de disponibilidad, los fixtures de habitaciones, los tokens visuales y los componentes Atomic Design existentes.
- Puede ampliar el contrato interno de lectura usado por la página de resultados, pero no cambia reglas de precios, capacidad, solapamiento, persistencia o confirmación de reservas.
- No agrega dependencias, migraciones, servicios externos ni datos de producción.
