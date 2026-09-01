# admin-password-auth Specification

## Purpose

Permitir que administradores aprobados accedan al panel mediante credenciales de Supabase, manteniendo el contenido y las acciones administrativas detrás de una sesión verificada.

## Requirements

### Requirement: Inicio de sesión administrativo con contraseña
El sistema SHALL ofrecer en `/admin/login` un formulario de correo y contraseña para iniciar una sesión administrativa, sin exponer un flujo de registro público.

#### Scenario: Credenciales válidas de administrador autorizado
- **WHEN** una persona ingresa credenciales válidas cuyo correo pertenece a `ADMIN_ALLOWED_EMAILS`
- **THEN** el sistema establece la sesión y la redirige a `/admin`

#### Scenario: Credenciales inválidas o sesión no verificable
- **WHEN** el proveedor rechaza las credenciales o no puede verificar la sesión
- **THEN** el sistema permanece en el acceso, presenta un mensaje seguro y no revela detalles internos del proveedor

### Requirement: Restricción administrativa por allowlist
El sistema MUST permitir el panel y sus operaciones solamente a una sesión verificada cuyo correo pertenezca a `ADMIN_ALLOWED_EMAILS`.

#### Scenario: Usuario autenticado sin autorización administrativa
- **WHEN** un usuario autenticado intenta acceder al panel y su correo no está en la allowlist
- **THEN** el sistema revoca su sesión administrativa y presenta el acceso sin renderizar contenido protegido

#### Scenario: Visitante sin sesión
- **WHEN** un visitante abre una ruta protegida de `/admin`
- **THEN** el sistema lo redirige a `/admin/login`

### Requirement: Seguridad de credenciales y sesión
El sistema MUST validar y normalizar el correo en el servidor, verificar la identidad con el proveedor antes de autorizarla y proteger las cookies de sesión mediante el mecanismo SSR del proveedor. El sistema MUST evitar la enumeración de cuentas, redirecciones abiertas, claves privilegiadas en el navegador y registros de contraseñas, tokens o datos sensibles.

#### Scenario: Solicitud de acceso malformada o abusiva
- **WHEN** una solicitud de inicio de sesión contiene datos inválidos o supera el límite de intentos aplicable
- **THEN** el sistema rechaza la solicitud con un mensaje genérico, sin crear una sesión ni revelar si el correo existe

#### Scenario: Sesión manipulada o expirada
- **WHEN** una cookie de sesión es inválida, expirada o no puede verificarse con el proveedor
- **THEN** el sistema falla cerrado, no renderiza contenido protegido y dirige al usuario al acceso

### Requirement: Cierre de sesión administrativo
El sistema SHALL ofrecer un control de cierre de sesión accesible desde el panel administrativo.

#### Scenario: Cierre de sesión exitoso
- **WHEN** un administrador autenticado cierra sesión
- **THEN** el sistema elimina la sesión local y del proveedor y redirige a `/admin/login`

#### Scenario: Fallo al cerrar sesión
- **WHEN** el proveedor no puede confirmar el cierre de sesión
- **THEN** el sistema no muestra datos sensibles de la falla y conserva un camino seguro para volver al acceso
