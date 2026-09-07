# company-quotation-breakfast-catalog Specification

## Purpose

Mantener una única entrada vigente de contenido y precio del desayuno ofrecido en cotizaciones empresariales, editable por administradores de Vista Valle sin requerir cambios de código, y disponible para que el formulario público de cotización la muestre y la use en el cálculo.

## Requirements

### Requirement: Entrada única de catálogo de desayuno
El sistema SHALL mantener exactamente una entrada vigente del catálogo de desayuno con una descripción de lo que incluye y un precio unitario en CLP, SHALL garantizar que exista con un valor por defecto editable antes de que cualquier lectura o edición la necesite, y SHALL exponerla para lectura pública desde el formulario de cotización empresarial.

#### Scenario: Lectura pública del desayuno vigente
- **WHEN** el formulario de cotización empresarial necesita mostrar el detalle del desayuno
- **THEN** el sistema entrega la descripción y el precio unitario vigentes del catálogo

#### Scenario: Catálogo siempre disponible
- **WHEN** el sistema se despliega y aún no se ha leído ni editado el catálogo de desayuno
- **THEN** el sistema garantiza que exista una entrada con contenido por defecto en el primer acceso, sin requerir una creación manual previa ni devolver una lectura vacía

### Requirement: Edición del desayuno desde el dashboard admin
El sistema SHALL permitir a un administrador autenticado editar la descripción y el precio unitario en CLP de la entrada vigente del catálogo de desayuno desde el dashboard admin, SHALL exigir una descripción no vacía y un precio entero no negativo, y SHALL reflejar la actualización inmediatamente en las siguientes lecturas del formulario público.

#### Scenario: Actualización exitosa
- **WHEN** un administrador autenticado guarda una nueva descripción y precio válidos para el desayuno
- **THEN** el sistema actualiza la entrada del catálogo y las siguientes consultas públicas devuelven los valores nuevos

#### Scenario: Descripción vacía
- **WHEN** un administrador intenta guardar el catálogo de desayuno con la descripción vacía
- **THEN** el sistema rechaza la actualización y no modifica la entrada vigente

#### Scenario: Precio inválido
- **WHEN** un administrador intenta guardar un precio negativo, fraccionario o no numérico para el desayuno
- **THEN** el sistema rechaza la actualización y no modifica la entrada vigente

#### Scenario: Acceso no autenticado
- **WHEN** una solicitud sin sesión admin válida intenta leer o editar el catálogo de desayuno desde la ruta administrativa
- **THEN** el sistema rechaza la solicitud sin exponer el contenido del catálogo
