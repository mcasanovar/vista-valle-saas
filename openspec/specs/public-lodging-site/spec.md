# public-lodging-site Specification

## Purpose

Proporcionar una experiencia pública rápida, accesible y orientada a conversión que presente Vista Valle y conduzca a huéspedes y empresas hacia el flujo apropiado de reserva o contacto.

## Requirements

### Requirement: Experiencia pública responsive
El sistema SHALL ofrecer una experiencia mobile-first utilizable en teléfonos, tablets, notebooks y escritorios, con navegación hacia inicio, habitaciones, servicios, nosotros, ubicación, contacto y reserva.

#### Scenario: Navegación móvil
- **WHEN** un visitante abre el sitio desde una pantalla móvil
- **THEN** el sistema presenta navegación adaptada, controles táctiles accesibles y un acceso visible a reservar

### Requirement: Presentación institucional orientada a conversión
El sistema SHALL presentar la identidad de Vista Valle, una propuesta de valor, servicios, ventajas, ubicación, contacto y llamados a reservar sin inventar información comercial no configurada. Los datos comerciales publicados —servicios, horarios de ingreso y salida, políticas de la estadía, canales de contacto y perfiles externos del alojamiento— SHALL provenir de una configuración única y explícita cuyos valores hayan sido confirmados por el responsable del alojamiento; mientras un dato no esté confirmado, el sistema SHALL omitir la afirmación correspondiente en lugar de publicar un valor supuesto.

#### Scenario: Contenido pendiente
- **WHEN** un dato comercial definitivo aún no ha sido proporcionado
- **THEN** el sistema no publica información ficticia y mantiene el dato como configuración pendiente

#### Scenario: Dato comercial confirmado
- **WHEN** el responsable del alojamiento confirma un dato comercial y este queda registrado en la configuración pública
- **THEN** el sistema lo presenta como contenido definitivo en la página y, cuando corresponda, en los datos estructurados, sin marcarlo como pendiente

### Requirement: Catálogo de habitaciones
El sistema SHALL listar todas las habitaciones activas desde una fuente de datos configurable y mostrar para cada una imágenes, nombre, capacidad, camas, baño, servicios, precio base y accesos a detalle y reserva.

#### Scenario: Nueva habitación activa
- **WHEN** se incorpora una habitación activa a la fuente de datos
- **THEN** el catálogo puede presentarla sin modificar la estructura de la página

### Requirement: Detalle de habitación
El sistema SHALL proporcionar una URL amigable por habitación con galería, descripción, características, servicios, capacidad, precio y acceso contextual para agregarla a una reserva existente o iniciar una nueva selección.

#### Scenario: Consulta de una habitación
- **WHEN** un visitante selecciona una habitación activa
- **THEN** el sistema muestra su información completa y permite agregarla a la selección de reserva para las fechas vigentes

### Requirement: Selección pública de habitaciones
El sistema SHALL permitir agregar y quitar habitaciones disponibles desde los resultados de búsqueda y desde sus detalles, y SHALL mostrar un resumen accesible de las habitaciones seleccionadas con fechas compartidas, subtotales y total antes de continuar al checkout.

#### Scenario: Selección de varias habitaciones por canales distintos
- **WHEN** un visitante agrega una habitación desde resultados de disponibilidad y otra desde su detalle para las mismas fechas
- **THEN** el resumen muestra ambas habitaciones y permite continuar con una sola reserva

#### Scenario: Cambio de fechas con selección existente
- **WHEN** un visitante cambia las fechas mientras tiene habitaciones seleccionadas
- **THEN** el sistema vuelve a consultar disponibilidad y no permite confirmar habitaciones que ya no estén disponibles para el nuevo intervalo

### Requirement: Captación de clientes empresa
El sistema SHALL presentar una propuesta específica para empresas y ofrecer un medio directo de solicitar disponibilidad o cotización sin obligarlas a completar el checkout individual.

#### Scenario: Consulta empresarial
- **WHEN** un representante de empresa selecciona el llamado a solicitar cotización
- **THEN** el sistema abre el canal de contacto configurado o presenta el formulario empresarial correspondiente

#### Scenario: Formulario empresarial de demostración
- **WHEN** la experiencia pública se ejecuta bajo el contexto `mock` sin un canal comercial aprobado
- **THEN** el sistema puede presentar un formulario empresarial ficticio, identificado como demostración, que no envía datos ni inicia checkout; el contexto `production` no debe habilitarlo

### Requirement: Preguntas frecuentes publicadas
El sistema SHALL publicar en la experiencia pública un conjunto de preguntas frecuentes con sus respuestas sobre las condiciones de la estadía —al menos horarios de ingreso y salida, estacionamiento, política de mascotas, conexión a internet y desayuno— y SHALL exponer ese mismo conjunto como datos estructurados de preguntas frecuentes derivados del contenido visible, sin incluir preguntas que no aparezcan en la página.

#### Scenario: Consulta de condiciones de la estadía
- **WHEN** un visitante recorre la experiencia pública buscando las condiciones de la estadía
- **THEN** encuentra las preguntas frecuentes con sus respuestas como texto legible en la página

#### Scenario: Correspondencia entre marcado y contenido visible
- **WHEN** un rastreador lee los datos estructurados de preguntas frecuentes
- **THEN** cada pregunta y respuesta declarada coincide con una pregunta y respuesta visible en la misma página, y no existe ninguna declarada que falte en el contenido visible

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

### Requirement: Recursos aislados en contexto mock
El sistema SHALL permitir validar la presentación y los contratos de recursos mediante fixtures locales bajo un contexto mock explícito, sin acceder a Supabase Storage. Los fixtures comerciales ficticios solo se permiten para validar el front bajo `mock`, deben identificarse como demostración y la configuración de producción debe rechazarlos.

#### Scenario: Storage no configurado durante desarrollo
- **WHEN** la experiencia pública se ejecuta bajo el contexto mock sin un proyecto Supabase disponible
- **THEN** utiliza recursos locales controlados, no realiza solicitudes a Storage y puede presentar fixtures comerciales ficticios para validar el front, señalados como demostración y excluidos de producción

#### Scenario: Datos comerciales ficticios en desarrollo
- **WHEN** se habilitan fixtures comerciales para revisar el catálogo y detalle en desarrollo
- **THEN** las habitaciones ficticias solo están disponibles bajo el contexto `mock`, se identifican como demostración y la configuración de producción las rechaza
