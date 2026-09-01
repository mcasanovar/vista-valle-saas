## Purpose

Proporcionar una experiencia pública rápida, accesible y orientada a conversión que presente Vista Valle y conduzca a huéspedes y empresas hacia el flujo apropiado de reserva o contacto.

## ADDED Requirements

### Requirement: Experiencia pública responsive
El sistema SHALL ofrecer una experiencia mobile-first utilizable en teléfonos, tablets, notebooks y escritorios, con navegación hacia inicio, habitaciones, servicios, nosotros, ubicación, contacto y reserva.

#### Scenario: Navegación móvil
- **WHEN** un visitante abre el sitio desde una pantalla móvil
- **THEN** el sistema presenta navegación adaptada, controles táctiles accesibles y un acceso visible a reservar

### Requirement: Presentación institucional orientada a conversión
El sistema SHALL presentar la identidad de Vista Valle, una propuesta de valor, servicios, ventajas, ubicación, contacto y llamados a reservar sin inventar información comercial no configurada.

#### Scenario: Contenido pendiente
- **WHEN** un dato comercial definitivo aún no ha sido proporcionado
- **THEN** el sistema no publica información ficticia y mantiene el dato como configuración pendiente

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

### Requirement: SEO local y metadatos
El sistema SHALL exponer títulos, descripciones, Open Graph, URLs canónicas, sitemap, robots y datos estructurados apropiados para el alojamiento y sus habitaciones.

#### Scenario: Indexación de habitación
- **WHEN** un buscador rastrea una habitación activa
- **THEN** recibe contenido indexable y metadatos únicos relacionados con alojamiento en Illapel

### Requirement: Accesibilidad y rendimiento
El sistema SHALL utilizar HTML semántico, navegación por teclado, foco visible, labels, texto alternativo y contraste suficiente, y SHALL optimizar la entrega de fotografías mediante dimensionamiento, carga diferida y formatos adecuados.

#### Scenario: Navegación sin ratón
- **WHEN** una persona navega las áreas públicas mediante teclado
- **THEN** puede identificar el foco y activar los controles esenciales, incluido el acceso a reservar

### Requirement: Recursos aislados en contexto mock
El sistema SHALL permitir validar la presentación y los contratos de recursos mediante fixtures locales bajo un contexto mock explícito, sin acceder a Supabase Storage. Los fixtures comerciales ficticios solo se permiten para validar el front bajo `mock`, deben identificarse como demostración y la configuración de producción debe rechazarlos.

#### Scenario: Storage no configurado durante desarrollo
- **WHEN** la experiencia pública se ejecuta bajo el contexto mock sin un proyecto Supabase disponible
- **THEN** utiliza recursos locales controlados, no realiza solicitudes a Storage y puede presentar fixtures comerciales ficticios para validar el front, señalados como demostración y excluidos de producción

#### Scenario: Datos comerciales ficticios en desarrollo
- **WHEN** se habilitan fixtures comerciales para revisar el catálogo y detalle en desarrollo
- **THEN** las habitaciones ficticias solo están disponibles bajo el contexto `mock`, se identifican como demostración y la configuración de producción las rechaza
