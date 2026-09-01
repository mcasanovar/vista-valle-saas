## Context

Los flujos públicos ya contienen mensajes en español en la mayoría de sus vistas y respuestas. Sin embargo, algunos formularios consumen directamente mensajes de validación generados por dependencias, que pueden estar en inglés. Véase `proposal.md` para la motivación.

## Goals / Non-Goals

**Goals:**

- Centralizar la traducción de errores que puedan viajar desde validadores hasta una interfaz pública.
- Mantener mensajes de API seguros para ser renderizados sin revelar detalles internos.
- Proteger el comportamiento mediante pruebas que ejerciten datos inválidos y respuestas fallidas.

**Non-Goals:**

- Traducir comentarios de código, registros internos, nombres de clases o herramientas de administración que no se presenten a visitantes.
- Agregar internacionalización, selector de idioma o modificar los contratos de datos de reserva.

## Decisions

- Definir mensajes de validación explícitos en los límites de entrada pública. Evita depender del idioma predeterminado de Zod y mantiene el contrato estable. Alternativa descartada: traducir por coincidencia de textos producidos por la librería, porque es frágil ante actualizaciones.
- Normalizar toda excepción que cruce una API pública antes de usarla como mensaje de respuesta. Los errores de dominio previsibles conservarán mensajes de español aprobados; los inesperados se registrarán en servidor y recibirán una respuesta genérica. Alternativa descartada: mostrar `Error.message` sin filtro, pues puede revelar información técnica.
- Cubrir validadores, controladores y rutas públicas con pruebas focalizadas de texto visible o de payload. Alternativa descartada: una búsqueda estática exclusiva, que no comprueba rutas de ejecución ni mensajes generados dinámicamente.

## Risks / Trade-offs

- [Una nueva ruta pública reenvía un mensaje técnico] → Mantener la normalización en los límites HTTP y probar los flujos que presentan `message`.
- [Un mensaje en español pierde precisión para un campo] → Conservar errores por campo y enfocar el primer campo inválido en formularios.
- [La búsqueda de textos no identifica todos los mensajes dinámicos] → Complementarla con pruebas de entradas inválidas y errores de servicio.

## Migration Plan

1. Incorporar los mensajes explícitos y la normalización en los límites públicos existentes.
2. Ejecutar pruebas focalizadas y la suite de verificación de frontend.
3. Desplegar sin migración de datos; revertir restaurando los mensajes previos si fuera necesario.
