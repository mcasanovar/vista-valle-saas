## ADDED Requirements

### Requirement: Preguntas frecuentes publicadas
El sistema SHALL publicar en la experiencia pública un conjunto de preguntas frecuentes con sus respuestas sobre las condiciones de la estadía —al menos horarios de ingreso y salida, estacionamiento, política de mascotas, conexión a internet y desayuno— y SHALL exponer ese mismo conjunto como datos estructurados de preguntas frecuentes derivados del contenido visible, sin incluir preguntas que no aparezcan en la página.

#### Scenario: Consulta de condiciones de la estadía
- **WHEN** un visitante recorre la experiencia pública buscando las condiciones de la estadía
- **THEN** encuentra las preguntas frecuentes con sus respuestas como texto legible en la página

#### Scenario: Correspondencia entre marcado y contenido visible
- **WHEN** un rastreador lee los datos estructurados de preguntas frecuentes
- **THEN** cada pregunta y respuesta declarada coincide con una pregunta y respuesta visible en la misma página, y no existe ninguna declarada que falte en el contenido visible

## MODIFIED Requirements

### Requirement: Presentación institucional orientada a conversión
El sistema SHALL presentar la identidad de Vista Valle, una propuesta de valor, servicios, ventajas, ubicación, contacto y llamados a reservar sin inventar información comercial no configurada. Los datos comerciales publicados —servicios, horarios de ingreso y salida, políticas de la estadía, canales de contacto y perfiles externos del alojamiento— SHALL provenir de una configuración única y explícita cuyos valores hayan sido confirmados por el responsable del alojamiento; mientras un dato no esté confirmado, el sistema SHALL omitir la afirmación correspondiente en lugar de publicar un valor supuesto.

#### Scenario: Contenido pendiente
- **WHEN** un dato comercial definitivo aún no ha sido proporcionado
- **THEN** el sistema no publica información ficticia y mantiene el dato como configuración pendiente

#### Scenario: Dato comercial confirmado
- **WHEN** el responsable del alojamiento confirma un dato comercial y este queda registrado en la configuración pública
- **THEN** el sistema lo presenta como contenido definitivo en la página y, cuando corresponda, en los datos estructurados, sin marcarlo como pendiente

### Requirement: SEO local y metadatos
El sistema SHALL exponer títulos, descripciones, Open Graph, URLs canónicas, sitemap, robots y datos estructurados apropiados para el alojamiento y sus habitaciones.

El contenido principal de cada página pública —su encabezado de primer nivel, los encabezados de sus secciones y el texto de cada sección— SHALL estar presente en el HTML de la respuesta del servidor, sin requerir la ejecución de JavaScript en el cliente para aparecer. Ningún límite de carga diferida SHALL abarcar el contenido principal de una página; los límites de carga diferida se restringen a los controles que dependen de datos del cliente o de la petición en curso.

El encabezado de primer nivel de la página de inicio SHALL nombrar el servicio de alojamiento y la localidad de Illapel.

Los datos estructurados del alojamiento SHALL incluir sus coordenadas geográficas, el rango de precios, los horarios de ingreso y salida, la política de mascotas, el correo de contacto, un enlace al mapa de la ubicación, los enlaces a los perfiles externos oficiales del alojamiento y los servicios que ofrece; y para cada habitación publicada, su precio por noche y su capacidad. Los datos estructurados NO SHALL declarar calificaciones ni reseñas agregadas cuyo origen sea una plataforma de terceros.

Las páginas públicas distintas de la de inicio SHALL exponer datos estructurados de ruta de navegación que las ubiquen respecto de la página de inicio.

El sitemap SHALL incluir todas las rutas públicas indexables del sitio y SHALL declarar para cada entrada su fecha de última modificación.

#### Scenario: Indexación de habitación
- **WHEN** un buscador rastrea una habitación activa
- **THEN** recibe contenido indexable y metadatos únicos relacionados con alojamiento en Illapel

#### Scenario: Rastreo sin ejecución de JavaScript
- **WHEN** un cliente solicita cualquier página pública y no ejecuta JavaScript
- **THEN** la respuesta contiene el encabezado de primer nivel de la página, los encabezados de sus secciones y el texto de cada sección

#### Scenario: Señales locales del alojamiento
- **WHEN** un buscador lee los datos estructurados de la página de inicio
- **THEN** obtiene las coordenadas, el rango de precios, los horarios de ingreso y salida, la política de mascotas, el correo de contacto, el enlace al mapa, los perfiles externos y los servicios del alojamiento, junto al precio y la capacidad de cada habitación publicada

#### Scenario: Calificaciones de terceros excluidas
- **WHEN** el alojamiento tiene calificaciones publicadas en plataformas de terceros
- **THEN** los datos estructurados del sitio no las declaran como calificación propia y, como máximo, enlazan el perfil externo correspondiente

#### Scenario: Cobertura del sitemap
- **WHEN** un buscador solicita el sitemap
- **THEN** encuentra listadas todas las rutas públicas indexables, cada una con su fecha de última modificación

### Requirement: Accesibilidad y rendimiento
El sistema SHALL utilizar HTML semántico, navegación por teclado, foco visible, labels, texto alternativo y contraste suficiente, y SHALL optimizar la entrega de fotografías mediante dimensionamiento, carga diferida y formatos adecuados.

El texto alternativo de cada fotografía publicada SHALL describir lo que la fotografía muestra y SHALL identificar el alojamiento y su localidad; no SHALL limitarse a repetir el nombre del elemento al que acompaña.

#### Scenario: Navegación sin ratón
- **WHEN** una persona navega las áreas públicas mediante teclado
- **THEN** puede identificar el foco y activar los controles esenciales, incluido el acceso a reservar

#### Scenario: Fotografía descrita para lectura asistida
- **WHEN** una persona recorre con un lector de pantalla las fotografías de una habitación
- **THEN** cada texto alternativo describe la escena e identifica el alojamiento y su localidad, en lugar de repetir solo el nombre de la habitación
