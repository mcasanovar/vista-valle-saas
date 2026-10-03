## MODIFIED Requirements

### Requirement: Seguridad de credenciales y sesión
El sistema MUST validar y normalizar el correo en el servidor, verificar la identidad con el proveedor antes de autorizarla y proteger las cookies de sesión mediante el mecanismo SSR del proveedor. El sistema MUST evitar la enumeración de cuentas, redirecciones abiertas, claves privilegiadas en el navegador y registros de contraseñas, tokens o datos sensibles.

El sistema MUST además fijar explícitamente los atributos de las cookies de sesión administrativa en lugar de heredar los valores por omisión de la librería: las cookies que transportan el access token y el refresh token SHALL emitirse con `HttpOnly`, `Secure` y un `Max-Age` acotado, en **todos** los puntos donde se escriben (el proxy de Next.js y el adaptador SSR del servidor deben coincidir). El sistema MUST propagar a la respuesta las cabeceras anti-caché que la librería SSR entrega junto a las cookies de sesión.

#### Scenario: Solicitud de acceso malformada o abusiva
- **WHEN** una solicitud de inicio de sesión contiene datos inválidos o supera el límite de intentos aplicable
- **THEN** el sistema rechaza la solicitud con un mensaje genérico, sin crear una sesión ni revelar si el correo existe

#### Scenario: Sesión manipulada o expirada
- **WHEN** una cookie de sesión es inválida, expirada o no puede verificarse con el proveedor
- **THEN** el sistema falla cerrado, no renderiza contenido protegido y dirige al usuario al acceso

#### Scenario: Atributos de la cookie de sesión
- **WHEN** el sistema establece o renueva la cookie de sesión administrativa, sea desde una ruta de API o desde el proxy
- **THEN** la cookie se emite con `HttpOnly`, `Secure` y un `Max-Age` acotado por política, y ningún script de la página puede leerla

#### Scenario: Respuesta que establece cookies de sesión no se almacena en cachés compartidas
- **WHEN** una respuesta incluye cookies de sesión renovadas por el proveedor
- **THEN** el sistema propaga a esa respuesta las cabeceras `Cache-Control: private, no-cache, no-store, must-revalidate, max-age=0`, `Expires: 0` y `Pragma: no-cache` que entrega la librería SSR

## ADDED Requirements

### Requirement: Límite de intentos de inicio de sesión administrativo
El sistema MUST aplicar un límite de intentos a `POST /api/admin/auth/login` antes de contactar al proveedor de identidad, contabilizado por dirección de cliente **y** por correo enviado, y SHALL responder `429` con `Retry-After` al superarlo sin revelar si el correo existe. El contador MUST residir en un almacén compartido entre instancias, porque el despliegue ejecuta múltiples instancias sin estado y un contador en memoria de proceso no protege ese escenario.

#### Scenario: Intentos repetidos desde el mismo cliente
- **WHEN** un cliente supera el número de intentos permitidos dentro de la ventana configurada
- **THEN** el sistema responde `429` con `Retry-After`, no contacta al proveedor de identidad y no revela si el correo existe

#### Scenario: Intentos repetidos contra el mismo correo desde distintos clientes
- **WHEN** distintas direcciones de cliente acumulan intentos fallidos contra un mismo correo administrativo
- **THEN** el sistema aplica el límite al correo objetivo, con un mensaje genérico idéntico al de cualquier otro fallo

#### Scenario: El límite no deja fuera al administrador legítimo
- **WHEN** el límite por correo o por cliente está activo para un atacante
- **THEN** el administrador legítimo conserva una vía de acceso (el límite por cliente no se agota de forma global) y el sistema registra el bloqueo como evento auditable

### Requirement: Registro auditable de la autenticación administrativa
El sistema MUST registrar como evento auditable cada inicio de sesión administrativo exitoso, cada intento fallido y cada cierre de sesión, con marca de tiempo, dirección de cliente e identificador de la cuenta cuando exista, sin almacenar contraseñas ni tokens. El registro MUST ser consultable por la persona dueña del sistema después de una sospecha de compromiso.

#### Scenario: Inicio de sesión exitoso
- **WHEN** un administrador autorizado inicia sesión correctamente
- **THEN** el sistema registra un evento auditable con la cuenta, la marca de tiempo y la dirección de cliente

#### Scenario: Intento fallido
- **WHEN** una solicitud de inicio de sesión es rechazada por credenciales inválidas, por identidad no verificable o por no pertenecer a la allowlist
- **THEN** el sistema registra un evento auditable que distingue el motivo internamente, sin exponerlo en la respuesta al cliente y sin guardar la contraseña enviada

#### Scenario: Cierre de sesión
- **WHEN** un administrador cierra sesión
- **THEN** el sistema registra un evento auditable del cierre

### Requirement: Transporte seguro obligatorio del panel administrativo
El sistema MUST emitir la cabecera `Strict-Transport-Security` en todas las respuestas, con una vigencia de al menos dos años, de modo que el navegador nunca emita una solicitud en texto claro hacia el dominio del panel después de la primera visita.

#### Scenario: Cabecera de transporte estricto presente
- **WHEN** el navegador recibe cualquier respuesta del sitio
- **THEN** la respuesta incluye `Strict-Transport-Security` con `max-age` de al menos dos años

### Requirement: Vinculación de origen en toda mutación administrativa autenticada por cookie
El sistema MUST exigir que el encabezado `Origin` coincida con el origen de la solicitud en **toda** ruta administrativa que muta estado o consume recursos pagados y que se autentica con la cookie de sesión, no solamente en las rutas de inicio y cierre de sesión. Una solicitud sin `Origin` o con un `Origin` distinto MUST rechazarse antes de interpretar el cuerpo.

#### Scenario: Solicitud administrativa desde otro origen del mismo sitio
- **WHEN** una solicitud `POST` llega a una ruta administrativa con la cookie de sesión válida pero con un `Origin` que no corresponde al origen del panel
- **THEN** el sistema la rechaza antes de parsear el cuerpo y sin ejecutar ningún efecto

#### Scenario: Cobertura verificada de la vinculación de origen
- **WHEN** se agrega una ruta administrativa que no es de solo lectura
- **THEN** existe una verificación automatizada que falla si esa ruta no aplica la vinculación de origen

### Requirement: La escotilla de origen de desarrollo es inerte en producción
El sistema MUST ignorar la variable de escape de origen para túneles de desarrollo cuando la ejecución es de producción, de modo que un valor dejado por error en la configuración del despliegue no pueda ampliar el conjunto de orígenes de confianza.

#### Scenario: Variable de túnel presente en producción
- **WHEN** la variable de origen de túnel de desarrollo está definida y la ejecución es de producción
- **THEN** el sistema no acepta ese origen y trata la solicitud como de origen no confiable

### Requirement: La autorización administrativa se aplica en la capa de datos, no solo en el layout
El sistema MUST verificar la sesión administrativa en la capa más cercana a los datos — cada página protegida y cada función que lee datos administrativos — y NO SHALL depender del layout de grupo de rutas como único punto de control. El layout conserva su rol de redirección para la experiencia de usuario, pero no puede ser la única barrera: el framework omite la ejecución de los layouts ancestros cuando atiende una solicitud de componente de servidor cuyo árbol de estado de router (encabezado provisto por el cliente) coincide hasta un segmento más profundo, de modo que un layout es una barrera que el cliente puede saltarse.

#### Scenario: Solicitud de componente de servidor con árbol de estado elegido por el cliente
- **WHEN** una solicitud sin sesión pide una ruta administrativa con el encabezado de solicitud de componente de servidor y un árbol de estado de router que coincide hasta un segmento interno
- **THEN** el sistema no devuelve contenido administrativo: la verificación de la página o de la función de acceso a datos rechaza la solicitud aunque el layout no se haya ejecutado

#### Scenario: Nueva página administrativa sin verificación propia
- **WHEN** se agrega una página bajo el grupo administrativo protegido
- **THEN** existe una verificación automatizada que falla si esa página (o la función de datos que usa) no verifica la sesión administrativa

### Requirement: Los módulos de Server Actions exportan únicamente puntos de entrada verificados
El sistema MUST asegurar que **toda** función exportada desde un módulo marcado como acción de servidor verifique la sesión administrativa antes de cualquier lectura de datos o efecto, porque cada exportación de ese módulo es un punto de entrada HTTP direccionable de forma independiente. Los núcleos de mutación reutilizados internamente MUST vivir en módulos que no sean de acción de servidor, de modo que no queden expuestos como endpoints.

#### Scenario: Núcleo de mutación reutilizado internamente
- **WHEN** una función de mutación necesita ser invocada tanto por un formulario administrativo como por otro módulo del servidor
- **THEN** esa función reside en un módulo que no es de acción de servidor y el módulo de acción de servidor expone solo el envoltorio que verifica la sesión

#### Scenario: Cobertura verificada de las acciones de servidor
- **WHEN** se agrega o modifica un módulo de acción de servidor
- **THEN** existe una verificación automatizada que enumera **todas** sus exportaciones y falla si alguna no verifica la sesión administrativa

### Requirement: La identidad administrativa no depende únicamente del correo
El sistema MUST anclar la autorización administrativa al identificador de usuario del proveedor además del correo, de modo que un correo de la allowlist que todavía no tenga cuenta, o una cuenta que cambie su correo a uno de la allowlist, no obtenga capacidad administrativa. El sistema MUST NOT tratar el rol `authenticated` del proveedor como una señal de autorización: ese rol lo tiene toda cuenta con sesión válida.

#### Scenario: Correo de la allowlist sin cuenta asociada
- **WHEN** un correo presente en la allowlist no corresponde a ninguna cuenta previamente registrada y alguien crea una cuenta con ese correo
- **THEN** el sistema no le concede capacidad administrativa, porque su identificador de usuario no está autorizado

#### Scenario: Cuenta existente que cambia su correo a uno de la allowlist
- **WHEN** una cuenta sin capacidad administrativa cambia su correo a uno presente en la allowlist
- **THEN** el sistema no le concede capacidad administrativa

### Requirement: El contexto de configuración mock es imposible en un despliegue de producción
El sistema MUST fallar el arranque si el despliegue es de producción y el contexto de configuración no es `production`, porque el contexto `mock` entrega una sesión administrativa completa sin credenciales. El archivo de ejemplo de configuración MUST NOT traer `mock` como valor por omisión de las dos variables de contexto.

#### Scenario: Despliegue de producción con contexto mock
- **WHEN** el entorno indica un despliegue de producción y el contexto de configuración es `mock`
- **THEN** el sistema lanza un error de configuración y no atiende solicitudes

#### Scenario: Archivo de ejemplo de configuración
- **WHEN** alguien copia el archivo de ejemplo de variables de entorno a un despliegue
- **THEN** el resultado no es un panel administrativo sin autenticación

### Requirement: Atribución y registro auditable de las operaciones de dinero
El sistema MUST registrar, para cada reembolso, quién lo ordenó, y MUST escribir un evento auditable equivalente al de la recaudación administrativa. El sistema MUST hacer idempotente el reembolso respecto de un reenvío del mismo formulario.

#### Scenario: Reembolso ejecutado
- **WHEN** un administrador ordena un reembolso
- **THEN** el sistema persiste un evento auditable que incluye el identificador del administrador, el pago y el monto

#### Scenario: Reenvío del mismo reembolso
- **WHEN** el mismo formulario de reembolso se envía dos veces con los mismos datos
- **THEN** el sistema no ejecuta un segundo reembolso

### Requirement: Comparación de secretos compartidos en tiempo constante
El sistema MUST comparar los secretos compartidos de los endpoints internos con una comparación de tiempo constante, no con igualdad de cadenas.

#### Scenario: Secreto incorrecto en un endpoint interno
- **WHEN** una solicitud a un endpoint interno presenta un secreto incorrecto
- **THEN** el sistema la rechaza y el tiempo de respuesta no depende de cuántos bytes iniciales del secreto son correctos

### Requirement: El feed iCal saliente no publica identificadores internos
El sistema MUST usar en el feed iCal saliente un identificador de evento opaco y estable por feed, en lugar del identificador interno de la reserva, bloqueo o hold.

#### Scenario: Evento publicado en el feed saliente
- **WHEN** el sistema publica un evento de ocupación en el feed iCal saliente
- **THEN** el identificador del evento no permite deducir el identificador interno del registro correspondiente

### Requirement: La identidad administrativa no se publica en el repositorio
El sistema MUST NOT registrar en archivos versionados el valor real de `ADMIN_ALLOWED_EMAILS` ni ninguna dirección de correo administrativa de producción. Los documentos de historia del proyecto SHALL usar un marcador en lugar del valor.

Además, el sistema MUST reconocer que un límite de intentos en su propia ruta de acceso **no** protege el endpoint de autenticación del proveedor: la URL del proyecto y la clave anónima se publican en el paquete del navegador por diseño, de modo que cualquiera puede intentar contraseñas directamente contra el proveedor. El control duradero contra adivinación de contraseñas MUST residir en la configuración del proveedor (límite de intentos propio, política de contraseñas, protección contra contraseñas filtradas) y en un segundo factor exigido para las cuentas administrativas.

#### Scenario: Documento de historia del proyecto
- **WHEN** un documento versionado necesita mostrar la configuración administrativa de producción
- **THEN** usa un marcador como `<correo administrativo>` en lugar de la dirección real

#### Scenario: Adivinación de contraseña contra el proveedor
- **WHEN** alguien intenta contraseñas directamente contra el endpoint de autenticación del proveedor, sin pasar por la aplicación
- **THEN** el límite de intentos y la política de contraseñas del proveedor lo frenan, y un segundo factor impide que una contraseña correcta baste para obtener una sesión administrativa

### Requirement: Minimización de datos personales enviados al proveedor de modelo
El sistema MUST limitar los datos del huésped que salen hacia el proveedor del modelo de lenguaje a lo que la tarea requiere. La salida de la herramienta de detalle de reserva MUST NOT incluir correo, teléfono, RUT, razón social, datos de facturación ni el comentario libre del huésped.

#### Scenario: El asistente consulta el detalle de una reserva
- **WHEN** el asistente administrativo invoca la herramienta de detalle de reserva
- **THEN** el resultado entregado al modelo contiene identificadores, fechas, estado y montos, pero no los datos de contacto ni de facturación del huésped

#### Scenario: Un dato de contacto es realmente necesario
- **WHEN** una persona administradora necesita el dato de contacto de un huésped
- **THEN** lo obtiene en la interfaz administrativa, no a través del modelo

### Requirement: Credenciales privilegiadas ausentes del entorno de ejecución
El sistema MUST NOT exigir en su configuración de arranque credenciales que ninguna ruta de ejecución usa. La clave de rol de servicio del proveedor, que omite tanto la seguridad a nivel de fila como la autenticación, MUST ser opcional para la aplicación y estar ausente del entorno de ejecución del despliegue, quedando disponible solo en el entorno local de quien ejecuta los scripts que la necesitan.

#### Scenario: Arranque de la aplicación sin la clave de rol de servicio
- **WHEN** la aplicación arranca sin la clave de rol de servicio definida
- **THEN** arranca correctamente, porque ninguna ruta de ejecución la usa

### Requirement: Los artefactos con datos reales de huéspedes no entran al control de versiones
El sistema MUST excluir del control de versiones los archivos de datos operacionales reales que se usan para importaciones puntuales, de modo que un `git add` masivo no publique nombres ni historial de huéspedes.

#### Scenario: Archivo de datos históricos en el árbol de trabajo
- **WHEN** existe un archivo de datos con nombres reales de huéspedes en el árbol de trabajo
- **THEN** las reglas de exclusión del repositorio lo cubren y no puede agregarse por accidente

### Requirement: La redacción de observabilidad no depende solo del nombre de la clave
El sistema MUST redactar también por forma del valor —no únicamente por nombre de clave— antes de escribir un registro, cubriendo al menos tokens con forma de JWT, encabezados con esquema `Bearer` y cadenas de conexión de base de datos con credenciales, incluyendo valores primitivos y elementos de arreglo que hoy pasan sin revisión.

#### Scenario: Valor sensible bajo una clave no reconocida
- **WHEN** un registro recibe un valor con forma de JWT, de encabezado `Bearer` o de cadena de conexión bajo una clave que la lista de nombres sensibles no cubre
- **THEN** el sistema lo redacta antes de escribirlo

### Requirement: El artefacto de seguridad a nivel de fila no se presenta como control de la ruta de la aplicación
El artefacto declarativo de seguridad a nivel de fila MUST declarar explícitamente que protege únicamente el acceso directo mediante las claves públicas del proveedor, y que la conexión de la aplicación a la base de datos no queda sujeta a esos controles. La autorización de la aplicación MUST NOT documentarse ni razonarse como si tuviera una segunda barrera en la base de datos.

#### Scenario: Lectura del artefacto declarativo
- **WHEN** alguien lee el artefacto de seguridad a nivel de fila para entender qué protege
- **THEN** el documento indica que la conexión de la aplicación no está sujeta a esas políticas y que la autorización efectiva es la de la aplicación
