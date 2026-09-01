## 1. Contratos de mensajes públicos

- [x] 1.1 Reemplazar los mensajes predeterminados en inglés de la validación de huésped y facturación por mensajes explícitos en español, y verificar casos de campo obligatorio, correo inválido y RUT inválido mediante pruebas unitarias.
- [x] 1.2 Normalizar los errores esperados e inesperados que retornan las APIs públicas de reserva, disponibilidad y cotización para que sus payloads de cliente estén en español y no expongan errores internos; verificar rutas de error con pruebas de API.

## 2. Presentación y regresión

- [x] 2.1 Comprobar que los formularios y controladores públicos presenten el mensaje seguro en español recibido desde sus validadores o APIs, con pruebas de interfaz para datos inválidos y fallos recuperables.
- [x] 2.2 Ejecutar la suite unitaria, lint, typecheck, build y una auditoría focalizada de los mensajes públicos para verificar que no quede texto de error en inglés expuesto a visitantes.
