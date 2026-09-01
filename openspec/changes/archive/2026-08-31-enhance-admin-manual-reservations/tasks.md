## 1. Dominio seguro de reserva manual

- [x] 1.1 Ampliar el contrato y servicio de reserva manual para aceptar múltiples IDs de habitación, comentario y solicitud de factura, adaptándolos al comando multi-habitación de pago al llegar, y resolver repositorios confiables para mock y producción; verificar con pruebas unitarias que crea una sola reserva confirmada, un pago pendiente y todos los ítems seleccionados.
- [x] 1.2 Revalidar en servidor habitaciones, capacidad, fechas, origen y factura, ignorando precio, estado, disponibilidad y condición de pago enviados por el cliente; verificar con pruebas que entradas manipuladas no alteran la reserva ni el pago en ambos contextos.
- [x] 1.3 Mantener la operación multi-habitación atómica ante conflicto y preservar notificación/auditoría, incluida la transacción persistente de producción; verificar con pruebas de integración que un solapamiento o fallo no deja huéspedes, reservas, pagos ni outbox parciales.

## 2. Datos y experiencia de nueva reserva

- [x] 2.1 Exponer una frontera administrativa autenticada para cargar habitaciones y disponibilidad iniciales desde la fuente confiable del contexto activo, sin filtrar datos no autorizados; verificar con pruebas de ruta/servicio que sólo un administrador accede y que la respuesta no confía en estado del cliente.
- [x] 2.2 Reescribir la página de nueva reserva con selección multi-habitación, fechas, origen, datos de huésped, comentario y factura opcional, reutilizando patrones y tokens de la sección Reservas; verificar con pruebas de componente que todos los campos y errores accesibles están presentes.
- [x] 2.3 Implementar skeletons con shimmer para carga inicial y datos dependientes, y estado de confirmación con spinner, texto visible y botón deshabilitado; verificar con pruebas que nunca se muestran controles parciales ni un spinner sin etiqueta.
- [x] 2.4 Hacer la vista adaptable a móvil, tablet y escritorio sin ocultar foco ni resumen de selección; verificar en 390px, 834px y 1440px con pruebas visuales o Playwright.

## 3. Confirmación y calidad

- [x] 3.1 Conectar la confirmación con la acción administrativa y mostrar éxito, conflicto y errores de validación sin perder los datos del formulario; verificar con pruebas de integración que el flujo válido termina en la reserva creada y el conflicto no genera efectos parciales.
- [x] 3.2 Ejecutar typecheck, lint y suites relevantes, y recorrer el flujo completo con un administrador en mock y producción persistente; verificar creación y rollback, que el único medio creado es pago al llegar y que la reserva pública no presenta regresiones.
