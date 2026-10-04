## Context

Ver `proposal.md` — Why para la motivación. Lo que importa al diseño es el mecanismo exacto que vacía el HTML y hasta dónde se extiende.

En el App Router, un componente cliente que llama `useSearchParams()` no puede participar del prerender estático: Next aborta el prerender del subárbol y emite el `fallback` del `<Suspense>` más cercano. El patrón vigente en el proyecto es colocar ese límite **por encima de un bloque de contenido completo**, con un `fallback` que es un hueco vacío. El efecto medido en producción:

| Ruta | Límite y fallback | HTML entregado |
|---|---|---|
| `/` | `app/page.tsx:17` envuelve todo `PublicHomeTemplate`; fallback `<main class="min-h-screen bg-warm" />` | sin `h1`, sin `h2`, 0 palabras de contenido |
| `/habitaciones` | `src/presentation/templates/room-catalogue.tsx:60` envuelve la grilla; fallback `<div class="grid min-h-64 …" />` | `h1` presente (queda fuera del límite), ~9 palabras |
| `/habitaciones/[slug]` | límite alrededor de los controles de precio y selección | `h1` presente, ~9 palabras |

El origen de la llamada es acotado. En el árbol de la home solo hay dos consumidores: `src/presentation/organisms/room-card.tsx:72` y `src/presentation/organisms/room-photo-gallery.tsx:88`. El segundo **ya está resuelto**: `RoomPhotoGalleryProvider` (`room-photo-gallery.tsx:246`) tiene su propio `<Suspense>` cuyo `fallback` **sí renderiza `props.children`** con un contexto degradado, de modo que no sustrae contenido del HTML. Ese es el patrón correcto y ya existe en el repositorio; el problema es que no se aplicó en los demás casos. En el detalle de habitación los consumidores equivalentes son `src/features/reservations/room-detail-price-card.tsx:35` y `room-detail-selection-button.tsx:17`.

Restricción de contenido: el requisito vigente de la capability prohíbe publicar información comercial no configurada, y por eso `services`, `experience` y `contact` en `src/config/public-site-content.ts` llevan textos del tipo "se publicará cuando esté aprobado". Este cambio los reemplaza por contenido real tomado de lo que el propio alojamiento ya publica en Booking y Tripadvisor, lo que exige un punto de confirmación explícito antes de desplegar.

## Goals / Non-Goals

**Goals:**

- Un patrón único y reutilizable para leer la URL sin sustraer contenido del HTML, aplicado a los tres casos (`RoomCard`, tarjeta de precio y botón de selección del detalle), tomando como referencia el que ya usa `RoomPhotoGalleryProvider`.
- Preservar íntegro el comportamiento en cliente: selección de habitaciones por querystring y por sesión, carrusel deep-linkable, restauración de selección.
- Concentrar los datos comerciales nuevos en un único lugar de configuración, con su procedencia anotada, para que la confirmación del dueño sea una revisión de un solo archivo.
- Dejar los datos estructurados como una sola fuente derivada de esa configuración, sin valores literales repartidos por el código.

**Non-Goals:**

- No se introduce renderizado dinámico por petición (`force-dynamic`) ni se desactiva el prerender de ninguna ruta pública: la corrección es estructural, no un cambio de modo de render.
- No se rediseña la experiencia visual ni se cambia el sistema de diseño; los encabezados cambian de texto y se agrega una sección, nada más.
- No se tocan las plantillas del área administrativa ni los flujos de pago.

## Decisions

### 1. Aislar la lectura de la URL en el subárbol mínimo, no envolver el bloque de contenido

Cada componente que necesita la URL se divide en dos: una parte presentacional que recibe el estado dependiente de la URL como prop, y una envoltura mínima que lee la URL y vive dentro de su propio `<Suspense>`, cuyo `fallback` renderiza la misma parte presentacional con el estado neutro ("no seleccionado", precio base). El contenido indexable —nombre, descripción, camas, baño, servicios, precio, imagen— queda siempre fuera del límite.

Aplicado a `RoomCard`: la tarjeta se renderiza completa en HTML y solo el estado del control de selección se resuelve tras la hidratación. Esto es coherente con lo que ya ocurre: ese estado depende además de `sessionStorage` (`useSessionRoomSelection`), que por definición nunca puede estar en el HTML. No se pierde nada que hoy esté en la respuesta del servidor.

*Alternativas consideradas:*

- **`export const dynamic = "force-dynamic"`** en las rutas públicas. Resolvería `useSearchParams()` en el servidor y el HTML saldría completo sin tocar componentes. Se descarta: renuncia al prerender de todas las páginas públicas para arreglar el estado de un botón, degrada el TTFB —que es señal de ranking— y deja el acoplamiento intacto, de modo que el próximo componente con `useSearchParams()` vuelve a vaciar la página.
- **Leer `window.location.search` en un `useEffect`** en lugar del hook. Evita el bailout sin dividir componentes, pero sustituye una API soportada por una lectura manual que se desincroniza de la navegación cliente y obliga a reimplementar la suscripción a cambios de URL. Se descarta por costo de mantenimiento.
- **Pasar los `searchParams` del Server Component como props** hasta cada tarjeta. Funciona, pero propaga los parámetros por toda la jerarquía de plantillas y vuelve dinámicas las rutas que los lean. Se descarta por invasividad.

### 2. El `fallback` de todo `Suspense` en una página pública debe renderizar contenido, no un hueco

Se adopta como regla de la capa de presentación: un `fallback` vacío en una ruta pública es un defecto, porque es exactamente lo que recibe el rastreador. Afecta a `app/page.tsx:17` y a `room-catalogue.tsx:60`, que pasan a desaparecer o a envolver únicamente el subárbol que lee la URL. `RoomPhotoGalleryProvider` ya cumple la regla y queda como referencia.

### 3. Datos comerciales en una sola estructura, con procedencia y confirmación anotadas

Los datos nuevos —horarios de ingreso y salida, política de mascotas, servicios, rango de precios, perfiles externos— se agregan a `src/config/public-site-content.ts` en una sola estructura (p. ej. `stayPolicies` y `externalProfiles`), cada campo con un comentario que indique su fuente (ficha propia en Booking o Tripadvisor) y que está pendiente de confirmación del dueño. La página y los datos estructurados leen de ahí; ningún valor se repite literal en `src/seo/structured-data.ts`.

Esto satisface el requisito modificado de presentación institucional: un dato confirmado y centralizado reemplaza al marcador de pendiente, y lo que no se confirme se omite en lugar de suponerse.

### 4. Las preguntas frecuentes son contenido primero, marcado después

El `FAQPage` se genera a partir del mismo arreglo que renderiza la sección visible. No existe la posibilidad de declarar una pregunta que no esté en la página, que es lo que Google trata como marcado engañoso.

### 5. Sin `aggregateRating` propio

La nota de Booking (8.2 sobre 21 reseñas) y la de Tripadvisor pertenecen a esas plataformas. Declararlas como calificación propia es marcado no admitido y expone a una acción manual. En su lugar se enlazan los perfiles vía `sameAs`, que es la forma correcta de asociar la entidad con su reputación externa.

### 6. El H1 nombra servicio y localidad; el claim pasa a subtítulo

`"Un lugar para bajar el ritmo."` deja de ser el `h1` y pasa a ser el párrafo de apoyo del hero; el `h1` pasa a `"Hospedaje y habitaciones en Illapel"`. El `eyebrow` actual (`"Illapel · Valle del Choapa"`) se conserva. `Hero` ya recibe `title` y `copy` por separado, así que el cambio es de contenido en `public-site-content.ts`, no de componente.

## Risks / Trade-offs

- **Regresión en el carrusel deep-linkable** (capability `room-photo-gallery`, escenario de deep-link por querystring) al reorganizar los límites de `Suspense` → el provider no se modifica; su `Suspense` interno ya es correcto. La verificación debe incluir abrir `/habitaciones/<slug>?foto=2` y confirmar que el carrusel se abre en la foto indicada.
- **Regresión en la selección de habitaciones** al mover la lectura de la URL a un subárbol → el estado de selección ya dependía de `sessionStorage` y por tanto de la hidratación; el riesgo real es un parpadeo del control de selección en la primera pintura cuando la URL ya trae una selección. Mitigación: el `fallback` renderiza el control en estado neutro con las mismas dimensiones, de modo que no haya desplazamiento de layout.
- **Publicar un dato comercial equivocado** tomado de una ficha de terceros desactualizada → ninguna de estas afirmaciones se despliega sin la confirmación del dueño; la tarea correspondiente es bloqueante en `tasks.md` y los valores quedan en un único archivo revisable.
- **El arreglo técnico no garantiza el posicionamiento por sí solo**: para "habitaciones illapel" el paquete local lo gobierna la ficha de Google Business Profile, que está fuera de este repositorio. Este cambio habilita la indexación y las señales del sitio; el trabajo externo se gestiona aparte y no debe tomarse como parte de la aceptación.
- **Sin cobertura automática de "HTML sin JavaScript" el defecto puede reaparecer**: cualquier componente futuro con `useSearchParams()` bajo un `fallback` vacío lo reintroduce en silencio. Mitigación: incorporar una verificación que solicite las rutas públicas y afirme la presencia del `h1` y de los encabezados de sección en el HTML crudo, sin ejecutar JavaScript.

## Migration Plan

No hay migración de datos ni cambio de contrato público. El despliegue es el habitual del proyecto.

1. Implementar y verificar en local que el HTML crudo de `/`, `/habitaciones`, `/habitaciones/<slug>`, `/ubicacion` y `/cotizacion-empresa` contiene sus encabezados y textos.
2. Confirmar con el responsable del alojamiento los datos comerciales nuevos antes de desplegar; omitir los que no se confirmen.
3. Desplegar y validar los datos estructurados de cada ruta con la prueba de resultados enriquecidos de Google.
4. Verificar la propiedad del dominio en Search Console, reenviar el sitemap y solicitar reindexación de las rutas públicas.

Rollback: revertir el commit. No queda estado persistido ni configuración externa que deshacer; lo único que persiste fuera del repositorio es la solicitud de reindexación, que es inocua.

## Open Questions

- Perfil de Instagram del alojamiento para incluirlo en `sameAs`: no figura en el repositorio. Si no se obtiene, se omite ese enlace sin afectar el resto del marcado.
- Si el alojamiento ofrece desayuno como servicio incluido o pagado en el canal directo. El catálogo de desayunos existe para cotizaciones de empresa (`company-quotation-breakfast-catalog`), pero eso no determina lo que corresponde afirmar en la página pública. Mientras no se confirme, la pregunta frecuente sobre desayuno se omite.
