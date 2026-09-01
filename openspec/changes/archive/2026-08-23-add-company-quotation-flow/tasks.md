## 1. Contrato de cotización y datos mock

- [x] 1.1 Definir el contrato normalizado de solicitud, líneas, capacidad acumulada y resultado de cotización; verificar casos válidos, fechas inválidas, cantidades no válidas y capacidad insuficiente con pruebas unitarias
- [x] 1.2 Ajustar los fixtures mock de habitaciones a Individual=1, Matrimonial=1 y Doble=2 personas, preservando precios, y actualizar las pruebas de disponibilidad/capacidad afectadas
- [x] 1.3 Implementar el cálculo server-authoritative de noches, subtotales y total para múltiples tipos y cantidades; verificar que ignora precios y totales manipulados desde el cliente

## 2. Persistencia y API

- [x] 2.1 Definir el contrato `CompanyQuotationRepository` y repositorio mock con snapshots de habitación, capacidad, precio, noches, subtotal y total; verificar idempotencia de creación y lectura
- [x] 2.2 Añadir el esquema Drizzle y migración PostgreSQL para solicitudes y líneas de cotización, estados y timestamps UTC; verificar la migración con `npm run db:check`
- [x] 2.3 Implementar el adaptador PostgreSQL detrás del contrato sin activar conexiones en contexto mock; verificar límites de configuración y pruebas de repositorio
- [x] 2.4 Crear el endpoint server-side de cotización con validación, cálculo, persistencia y respuesta segura; verificar errores de entrada, capacidad, persistencia y ausencia de secretos en respuestas

## 3. Página y experiencia de usuario

- [x] 3.1 Crear `/cotizacion-empresa` con metadata, navegación, footer y composición profesional alineada a los tokens existentes; verificar carga directa, canonical y accesibilidad básica
- [x] 3.2 Retirar el formulario del landing y cambiar el CTA “Solicitar cotización” para navegar a `/cotizacion-empresa`; verificar que el landing solo contiene el CTA y que la ruta nueva contiene el formulario
- [x] 3.3 Implementar el formulario con fechas, personas, cantidades por habitación, datos empresariales y requisitos; mostrar capacidad máxima por habitación antes del envío y verificar operación con teclado
- [x] 3.4 Implementar resumen dinámico de capacidad y cotización con subtotales por línea, total CLP, estados de capacidad suficiente/insuficiente y errores asociados a campos; verificar responsive 320–1440px sin overflow
- [x] 3.5 Implementar estados de envío, éxito y error recuperable sin duplicar solicitudes; verificar que el cliente no puede confirmar una cotización sin respuesta server-side exitosa

## 4. Plantillas y entrega de correo

- [x] 4.1 Crear la plantilla server-only de confirmación al cliente con solo resumen, habitaciones, fechas, cantidades, precios y total; verificar HTML renderizado y formato CLP
- [x] 4.2 Crear la plantilla operativa para Vista Valle con contacto, requisitos y snapshot completo; verificar que no se filtren datos en logs de prueba
- [x] 4.3 Extender el outbox/worker para soportar cotizaciones, claves idempotentes por destinatario y reintentos; verificar que una misma solicitud no duplica correos y que los fallos se clasifican
- [x] 4.4 Preparar configuración `Vista Valle SpA <reservas@vistavalle.cl>` y transporte mock compatible con Resend, dejando el transporte real server-only y condicionado a dominio configurado; verificar que mock no realiza llamadas externas

## 5. Verificación integrada

- [x] 5.1 Añadir pruebas unitarias de cálculo, capacidades, snapshots, persistencia mock, plantillas y estados de entrega; verificar con `npm run test:unit`
- [x] 5.2 Añadir pruebas E2E del landing a `/cotizacion-empresa`, selección multi-habitación, capacidad insuficiente, cálculo final y confirmación mock; verificar sin solicitudes a hosts externos
- [x] 5.3 Añadir pruebas de accesibilidad, metadata, responsive y regresión de reservas; verificar con `npm run test:e2e`, `npm run typecheck` y `npm run lint`
- [x] 5.4 Ejecutar validación final de build, formato y migraciones; verificar con `npm run build:test`, `npm run format:check`, `npm run db:check` y `openspec validate --specs`
