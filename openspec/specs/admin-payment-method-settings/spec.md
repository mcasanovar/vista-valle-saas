# admin-payment-method-settings Specification

## Purpose

Permitir a un administrador de Vista Valle mostrar u ocultar cada método de pago disponible para los huéspedes (pagar al llegar, pagar online) desde el dashboard admin, sin requerir un deploy de código, para poder reaccionar rápido ante problemas con un proveedor de pago.

## Requirements

### Requirement: Entrada única de configuración de métodos de pago
El sistema SHALL mantener exactamente una entrada vigente con el estado habilitado/deshabilitado de cada método de pago (`payAtPropertyEnabled`, `payOnlineEnabled` para transferencia bancaria vía Fintoc, y `payByCardEnabled` para tarjeta de crédito o débito vía Mercado Pago), SHALL garantizar que exista con los tres métodos habilitados por defecto antes de que cualquier lectura o edición la necesite, y SHALL exponerla para lectura desde el flujo público de confirmación de reserva.

#### Scenario: Lectura pública del estado vigente
- **WHEN** el flujo de confirmación de reserva necesita saber qué métodos de pago mostrar
- **THEN** el sistema entrega el estado habilitado/deshabilitado vigente de cada uno de los tres métodos de pago

#### Scenario: Configuración siempre disponible
- **WHEN** el sistema se despliega y aún no se ha leído ni editado la configuración de métodos de pago
- **THEN** el sistema garantiza que exista una entrada con los tres métodos habilitados por defecto en el primer acceso, sin requerir una creación manual previa ni devolver una lectura vacía

### Requirement: Edición de métodos de pago desde el dashboard admin
El sistema SHALL permitir a un administrador autenticado habilitar o deshabilitar independientemente "pagar al llegar", "transferencia bancaria" (Fintoc) y "tarjeta de crédito o débito" (Mercado Pago) desde el dashboard admin, SHALL permitir cualquier combinación incluyendo los tres deshabilitados sin exigir que al menos uno quede activo, y SHALL reflejar la actualización inmediatamente en las siguientes lecturas del flujo público.

#### Scenario: Actualización exitosa de un método
- **WHEN** un administrador autenticado deshabilita uno de los tres métodos de pago y guarda
- **THEN** el sistema actualiza la entrada de configuración y las siguientes consultas del flujo público de reservas reflejan que ese método está deshabilitado, sin afectar el estado de los otros dos

#### Scenario: Ambos métodos deshabilitados
- **WHEN** un administrador autenticado deshabilita los tres métodos de pago y guarda
- **THEN** el sistema acepta y persiste la configuración sin validación adicional, dejando al huésped sin ninguna opción de pago visible

#### Scenario: Acceso no autenticado
- **WHEN** una solicitud sin sesión admin válida intenta editar la configuración de métodos de pago desde la ruta administrativa
- **THEN** el sistema rechaza la solicitud y no modifica la entrada vigente
