## Context

La home monta actualmente un controlador cliente que actualiza su propia URL, consulta `/api/availability` y muestra una lista de nombres dentro de la misma sección. Los formularios de huésped y resumen también viven después del contenido de la home. El dominio ya valida intervalos de alojamiento, capacidad, habitación opcional y disponibilidad; el contexto `mock` usa fixtures locales y falla de forma cerrada en producción.

El cambio abarca routing, composición server/client, presentación Atomic Design, accesibilidad, SEO y pruebas. Véanse `proposal.md` para la motivación y `specs/availability-search-experience/spec.md` para el contrato observable.

## Goals / Non-Goals

**Goals:**

- Separar captura de criterios y comparación de resultados sin duplicar reglas de dominio.
- Hacer que la URL sea la fuente de verdad navegable de la consulta.
- Dar feedback inmediato tanto en la primera navegación como al cambiar criterios dentro de resultados.
- Reutilizar la identidad, tokens, fixtures y componentes actuales, ampliándolos solo donde el modelo de resultados lo requiera.
- Mantener una frontera clara entre datos mock, composición de servidor y componentes de presentación.

**Non-Goals:**

- Rediseñar el flujo posterior de datos de huésped, resumen o confirmación.
- Agregar mapas, filtros avanzados, ordenamiento, paginación o fechas alternativas.
- Crear disponibilidad, precios o contenido real, ni habilitar producción.
- Introducir una API externa, dependencia, migración o caché distribuida.

## Decisions

### 1. Usar `/disponibilidad` como ruta pública y la query string como estado canónico

Los parámetros canónicos serán `checkIn`, `checkOut`, `guests` y el parámetro opcional `room`. La home y el detalle construirán esta URL al enviar el buscador; la página de resultados leerá los valores desde `searchParams` asíncronos conforme a Next.js 16.

Esto permite enlaces compartibles, historial atrás/adelante y recarga sin crear un store global. Los parámetros solo contendrán criterios no personales; nunca se incluirán datos del huésped.

**Alternativas consideradas:** mantener `history.pushState` y resultados dentro de la home conserva el acoplamiento actual; un store cliente pierde estado al recargar y dificulta deep links.

### 2. Resolver la consulta en el servidor mediante el caso de uso existente

La página de resultados normalizará los parámetros y llamará directamente al caso de uso de disponibilidad con `getAvailabilitySearchRepository()` y `getRoomReadSource()`. Después compondrá un modelo de presentación con los detalles de las habitaciones cuyos identificadores fueron autorizados por el resultado.

No se hará un `fetch` HTTP desde un Server Component hacia el Route Handler interno. `/api/availability` puede mantenerse por compatibilidad, pero tanto la ruta como la página deben reutilizar el mismo caso de uso para no duplicar reglas ni confiar en filtros de cliente.

**Alternativas consideradas:** ampliar el controlador cliente actual sería simple, pero añade una segunda carga después de renderizar y obliga a mantener sincronización manual entre URL, estado y respuesta.

### 3. Separar shell persistente y región asíncrona de resultados

La ruta tendrá una shell con header, título/resumen y buscador superior. Un `loading.tsx` proporcionará feedback estructural durante la entrada inicial a la ruta. Dentro de la página, la región de resultados estará en un límite `Suspense` identificado por los criterios normalizados para que las búsquedas posteriores dentro de la misma ruta muestren skeleton sin desmontar el buscador.

El botón reflejará estado pendiente y quedará deshabilitado contra doble envío. Los skeleton reservarán proporciones de imagen y bloques de texto para evitar saltos de layout. No se usará un temporizador para prolongar el loading; si la consulta es inmediata, la transición también lo será. `prefers-reduced-motion` deshabilitará shimmer o desplazamientos no esenciales.

**Alternativas consideradas:** un overlay de pantalla completa oculta contexto y puede tapar el foco; un spinner aislado no preserva el espacio de los resultados y comunica menos progreso.

### 4. Reutilizar un formulario GET progresivamente mejorado

`BookingSearch` seguirá siendo el organismo visual compartido, pero su contrato permitirá envío hacia `/disponibilidad` con campos nombrados y un valor oculto opcional para `room`. La validación inmediata dará errores por campo antes de navegar, y el servidor repetirá toda validación antes de consultar.

En resultados, el mismo organismo se renderizará con valores derivados de la URL. Un envío válido crea una nueva entrada de historial para que atrás recupere la búsqueda anterior; los estados inválidos no reemplazan resultados válidos por datos parciales.

**Alternativas consideradas:** formularios separados para home y resultados se desviarían visual y funcionalmente con rapidez.

### 5. Crear una composición de resultados, no copiar la página de Airbnb

La jerarquía será:

```text
Header público
└── Main / Disponibilidad
    ├── Título + resumen de fechas y huéspedes
    ├── Buscador editable
    └── Región de resultados (aria-busy / aria-live)
        ├── Cantidad de habitaciones
        ├── Grilla de cards disponibles
        └── Estado vacío o error recuperable
```

En móvil, buscador y cards usan una columna. Desde tablet, el buscador se compacta y la colección puede crecer hasta tres columnas, coherente con el catálogo actual. No habrá mapa porque todas las habitaciones pertenecen a un único alojamiento, ni filtros/ordenamiento porque el inventario mock es de tres habitaciones.

Las cards reutilizarán imagen optimizada, nombre, capacidad, camas, baño, amenidades y precio base por noche. Se ampliará su acción para llevar al detalle con los criterios conservados y se mostrará la identificación de demostración exigida por el contexto mock. No se inventarán totales, descuentos ni características.

### 6. Tratar ausencia, preselección inválida y fallos como estados distintos

- Cero resultados generales: mensaje “sin disponibilidad” y foco en ajustar el buscador.
- Habitación preseleccionada no disponible: explicación específica y acción para quitar `room` o cambiar criterios.
- Parámetros inválidos: errores asociados a campos y región de resultados vacía.
- Fallo inesperado: mensaje genérico sin información sensible y reintento con la misma URL.

No se propondrán fechas alternativas porque el motor actual no las calcula y simularlas podría inducir al usuario a creer que existe disponibilidad.

### 7. Mantener aislamiento mock y SEO controlado

La página solo accederá a las fuentes tipadas existentes. El contexto `production` seguirá fallando cerrado mientras no existan fuentes reales; no habrá fallback silencioso a fixtures. Las pruebas end-to-end verificarán ausencia de solicitudes a hosts externos.

La ruta será compartible, pero declarará `noindex,follow` y canonical `/disponibilidad` para evitar indexar combinaciones temporales de fechas y huéspedes. El contenido de habitación indexable continuará en sus páginas de detalle.

## Risks / Trade-offs

- [El cambio inicial de ruta puede sentirse excesivo si la respuesta mock es instantánea] → Mostrar feedback inmediato sin duración mínima y precargar la shell de destino.
- [Dos superficies reutilizan el buscador con necesidades de layout distintas] → Mantener un único contrato semántico y permitir variantes de composición mediante props, no duplicar lógica.
- [La URL puede editarse manualmente con valores malformados] → Validar en servidor y presentar errores recuperables antes de consultar.
- [Los detalles de habitación pueden divergir de la lista autorizada] → Componer las cards únicamente a partir de identificadores devueltos por el caso de uso y la misma fuente de habitaciones.
- [El contexto `mock` puede confundirse con disponibilidad real] → Identificación visual de demostración y fallo cerrado en producción.
- [Skeletons o anuncios dinámicos pueden distraer] → Una sola región ocupada/anunciada, estructura estable y respeto a movimiento reducido.

## Migration Plan

1. Añadir la ruta y sus estados sin retirar todavía el controlador actual.
2. Conectar la home y el detalle a `/disponibilidad` conservando parámetros.
3. Actualizar las acciones de cards y la continuidad de criterios hacia el detalle.
4. Migrar pruebas de la lista inline a la nueva ruta y añadir cobertura de historial, errores, mock y accesibilidad.
5. Retirar solo la presentación inline que haya quedado sin consumidores; conservar el caso de uso y el Route Handler compartidos.

El rollback consiste en restaurar los destinos hacia `/#consulta-disponibilidad`; no hay datos que migrar ni estado persistente que revertir.
