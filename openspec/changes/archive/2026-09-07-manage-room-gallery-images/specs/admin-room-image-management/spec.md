## Purpose

Permite a un administrador autorizado cargar, ordenar, marcar como principal y eliminar las fotografías de cada habitación desde el panel admin, de modo que esas fotos alimenten la galería y el carrusel ya existentes en el sitio público.

## ADDED Requirements

### Requirement: Listado de fotos por habitación
El sistema SHALL mostrar, para una habitación seleccionada en el panel admin, todas sus fotos existentes en el orden de posición vigente, identificando cuál es la foto principal.

#### Scenario: Habitación con fotos existentes
- **WHEN** el administrador abre la gestión de fotos de una habitación que ya tiene imágenes
- **THEN** el sistema lista todas sus fotos en el orden guardado y señala visualmente cuál es la principal

#### Scenario: Habitación sin fotos
- **WHEN** el administrador abre la gestión de fotos de una habitación sin imágenes
- **THEN** el sistema indica que no hay fotos cargadas y ofrece la acción de subir la primera

### Requirement: Carga de nuevas fotos
El sistema SHALL permitir subir una o más imágenes para una habitación, validando en el servidor que cada archivo sea de un tipo permitido y no exceda el tamaño máximo antes de almacenarlo, y SHALL rechazar la carga completa si algún archivo no cumple la validación.

#### Scenario: Carga válida
- **WHEN** el administrador sube una o más imágenes de un tipo y tamaño permitidos para una habitación
- **THEN** el sistema las almacena, las agrega al final del orden existente y las refleja en el listado

#### Scenario: Archivo inválido en la carga
- **WHEN** el administrador intenta subir un archivo de tipo no permitido o que excede el tamaño máximo
- **THEN** el sistema rechaza la carga completa, no almacena ningún archivo del lote y muestra cuál archivo falló y por qué

### Requirement: Selección de foto principal
El sistema SHALL permitir marcar cualquier foto existente de una habitación como su foto principal, y SHALL garantizar que cada habitación tenga como máximo una foto principal a la vez.

#### Scenario: Cambiar la foto principal
- **WHEN** el administrador marca como principal una foto distinta de la actual
- **THEN** el sistema actualiza cuál foto es la principal y refleja el cambio en el listado sin duplicar la marca en más de una foto

### Requirement: Reordenamiento de fotos
El sistema SHALL permitir cambiar el orden de las fotos de una habitación (excluida la principal, que siempre se presenta primero) y persistir ese orden.

#### Scenario: Reordenar fotos secundarias
- **WHEN** el administrador cambia la posición de una foto secundaria dentro del listado
- **THEN** el sistema guarda el nuevo orden y ese orden es el que verá un visitante en el carrusel público

### Requirement: Eliminación de una foto
El sistema SHALL permitir eliminar una foto existente de una habitación tras confirmación explícita del administrador, quitándola del almacenamiento y del listado sin afectar las demás fotos ni su orden relativo.

#### Scenario: Eliminar foto secundaria
- **WHEN** el administrador confirma la eliminación de una foto que no es la principal
- **THEN** el sistema la elimina del almacenamiento y del listado, conservando el orden relativo de las fotos restantes

#### Scenario: Eliminar la foto principal
- **WHEN** el administrador confirma la eliminación de la foto marcada como principal
- **THEN** el sistema la elimina y, si quedan otras fotos, promueve la siguiente en el orden como nueva foto principal

### Requirement: Auditoría de cambios en fotos de habitación
El sistema SHALL registrar actor, fecha y tipo de cambio (carga, cambio de principal, reordenamiento o eliminación) para cada operación sobre las fotos de una habitación.

#### Scenario: Eliminación auditada
- **WHEN** un administrador elimina una foto de una habitación
- **THEN** el sistema conserva un evento de auditoría con el responsable, la fecha y la foto eliminada

### Requirement: Reflejo inmediato en el sitio público
El sistema SHALL asegurar que un cambio guardado en las fotos de una habitación (carga, principal, orden o eliminación) esté disponible para la landing y la página de detalle sin requerir un despliegue ni una intervención manual adicional.

#### Scenario: Nueva foto visible en la landing
- **WHEN** el administrador sube una foto y la guarda para una habitación publicada
- **THEN** un visitante que abre esa habitación en la landing puede ver la nueva foto en el carrusel existente
