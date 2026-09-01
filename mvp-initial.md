# Vista Valle — Sitio Web de Reservas

## 1. Contexto del proyecto

**Vista Valle Lodging House** es una empresa ubicada en **Illapel, Región de Coquimbo, Chile**, dedicada al alojamiento de:

* Empresas y trabajadores del sector minero.
* Turistas.
* Viajeros de trabajo.
* Familias.
* Público general.

Actualmente Vista Valle cuenta con **3 habitaciones disponibles para alojamiento**.

El objetivo del proyecto es desarrollar un sitio web moderno, confiable y responsive que permita presentar las instalaciones de Vista Valle y que, además, permita a los clientes **consultar disponibilidad, realizar reservas y pagar directamente desde la página web**.

La experiencia debe ser sencilla y transmitir tranquilidad, comodidad, limpieza y confianza.

---

# 2. Identidad visual

La identidad gráfica debe estar basada en el logo oficial de:

**VISTA VALLE — LODGING HOUSE**

El logo será proporcionado dentro de los assets del proyecto.

## Paleta visual sugerida

Tomar como referencia los colores presentes en el logo:

* Negro / gris muy oscuro.
* Beige.
* Crema.
* Blanco cálido.
* Tonos tierra suaves.

Se pueden utilizar colores complementarios muy sutiles relacionados con naturaleza, montaña y valle.

Evitar colores demasiado saturados.

La página debe transmitir:

* Elegancia.
* Comodidad.
* Naturaleza.
* Descanso.
* Confianza.
* Profesionalismo.

El diseño debe ser moderno, limpio y minimalista.

---

# 3. Objetivo principal

El sitio debe permitir que un potencial huésped pueda realizar todo el proceso de reserva sin abandonar la página.

Flujo principal esperado:

```text
Usuario ingresa al sitio
        ↓
Visualiza Vista Valle
        ↓
Revisa habitaciones
        ↓
Selecciona una habitación
        ↓
Selecciona fecha de entrada
        ↓
Selecciona fecha de salida
        ↓
Sistema consulta disponibilidad
        ↓
Muestra precio total
        ↓
Usuario ingresa sus datos
        ↓
Realiza el pago
        ↓
Reserva confirmada
        ↓
Usuario recibe confirmación
```

---

# 4. Estructura principal del sitio

La página principal estará compuesta inicialmente por:

1. Menú de navegación.
2. Hero / imagen principal.
3. Habitaciones disponibles.
4. Por qué elegir Vista Valle.
5. Footer.

Además se debe contemplar el flujo de reserva.

---

# 5. Header / menú de navegación

Crear un header moderno y limpio.

Debe incluir el logo de Vista Valle.

Opciones principales:

```text
Inicio
Habitaciones
Servicios
Nosotros
Ubicación
Contacto
```

Agregar un botón destacado:

**Reservar ahora**

El botón debe dirigir al sistema o sección de reservas.

En dispositivos móviles debe transformarse en un menú hamburguesa.

El header puede mantenerse fijo al realizar scroll.

---

# 6. Hero / imagen principal

Crear una sección principal visualmente atractiva.

Utilizar una fotografía de Vista Valle, de sus habitaciones o de la vista hacia Illapel.

Sobre la imagen incluir un mensaje similar a:

## Descansa con una vista privilegiada de Illapel

Texto secundario:

> Comodidad, tranquilidad y una ubicación ideal para viajes de trabajo, turismo y estadías en la zona.

Botón principal:

**Reservar ahora**

Botón secundario opcional:

**Ver habitaciones**

También se puede incorporar directamente un pequeño formulario de búsqueda:

```text
Entrada
Salida
Huéspedes
Buscar disponibilidad
```

---

# 7. Habitaciones

Crear una sección:

# Nuestras habitaciones

Vista Valle dispone actualmente de **3 habitaciones**.

Cada habitación debe mostrarse mediante una card visual.

Cada card debe contener:

* Imagen principal.
* Nombre de la habitación.
* Capacidad máxima.
* Tipo de cama.
* Tamaño si está disponible.
* Baño privado o compartido.
* Servicios incluidos.
* Precio por noche.
* Botón "Ver habitación".
* Botón "Reservar".

Ejemplo conceptual:

```text
Habitación 1

[ Imagen ]

Habitación cómoda y completamente equipada.

👤 Hasta 2 huéspedes
🛏 Cama matrimonial
🚿 Baño
📶 WiFi
🚗 Estacionamiento

Desde $XX.XXX / noche

[ Ver habitación ] [ Reservar ]
```

---

# 8. Página o modal de detalle de habitación

Al seleccionar una habitación se debe mostrar información ampliada.

Incluir:

## Galería

Permitir visualizar varias fotografías de la habitación.

Idealmente utilizar:

* Imagen principal grande.
* Miniaturas.
* Galería fullscreen al seleccionar una fotografía.

## Descripción

Mostrar una descripción completa de la habitación.

## Características

Por ejemplo:

* Tipo de cama.
* Cantidad de huéspedes.
* Baño.
* Escritorio.
* TV.
* WiFi.
* Climatización.
* Ropa de cama.
* Toallas.
* Espacio para guardar ropa.

Los servicios definitivos deberán quedar configurables.

## Servicios incluidos

Mostrar mediante iconos.

Por ejemplo:

```text
WiFi
Estacionamiento
TV
Baño
Ropa de cama
Toallas
Agua caliente
```

No asumir que todos estos servicios existen. Deben poder editarse posteriormente.

---

# 9. Por qué elegir Vista Valle

Crear una sección visual con el título:

# ¿Por qué elegir Vista Valle?

Destacar las principales ventajas.

## Estacionamiento privado

Los huéspedes disponen de estacionamiento privado durante su estadía.

## Vista privilegiada

Vista Valle cuenta con una excelente vista hacia la ciudad de Illapel y sus alrededores.

## Ubicación

Ubicación conveniente tanto para trabajadores como para turistas que visitan Illapel y zonas cercanas.

## Atención personalizada

Servicio cercano y directo con los huéspedes.

## Ideal para empresas

Vista Valle debe posicionarse también como una buena alternativa para empresas que necesiten alojamiento para trabajadores o colaboradores.

Puede agregarse un CTA especial:

**¿Necesitas alojamiento para tu empresa?**

Botón:

**Consultar disponibilidad**

---

# 10. Servicios

Crear una sección donde puedan mostrarse todos los servicios generales del alojamiento.

Inicialmente considerar:

* Estacionamiento privado.
* WiFi.
* Atención personalizada.
* Espacios comunes.
* Vista a la ciudad.

Los servicios deben provenir de una estructura de datos configurable para poder agregar o eliminar servicios fácilmente.

---

# 11. Sistema de reservas

El sitio debe permitir realizar reservas directamente.

El usuario debe seleccionar:

```text
Fecha de entrada
Fecha de salida
Número de huéspedes
Habitación
```

El sistema debe verificar la disponibilidad de cada habitación.

Una habitación **no puede reservarse si ya existe otra reserva que se superpone con las fechas seleccionadas**.

---

# 12. Calendario de disponibilidad

Cada habitación debe manejar su propio calendario.

Estados posibles:

```text
Disponible
Reservada
Bloqueada
```

Los días ocupados deben aparecer deshabilitados al momento de realizar una nueva reserva.

El sistema debe calcular automáticamente:

```text
Número de noches
x
Precio por noche
=
Subtotal
```

Y posteriormente:

```text
Subtotal
+ cargos adicionales si corresponde
=
Total a pagar
```

---

# 13. Información del huésped

Antes del pago solicitar:

* Nombre.
* Apellido.
* Correo electrónico.
* Teléfono.
* RUT opcional.
* Empresa opcional.
* Cantidad de huéspedes.
* Comentarios adicionales.

Para clientes empresa se puede permitir ingresar:

```text
Nombre empresa
RUT empresa
Nombre contacto
Correo
Teléfono
```

---

# 14. Proceso de pago

La arquitectura debe estar preparada para recibir pagos online.

El flujo deberá ser:

```text
Seleccionar habitación
        ↓
Seleccionar fechas
        ↓
Validar disponibilidad
        ↓
Ingresar datos huésped
        ↓
Mostrar resumen
        ↓
Pagar
        ↓
Confirmar pago
        ↓
Crear reserva
```

Importante:

**No considerar una reserva completamente confirmada hasta que el backend valide correctamente el estado del pago.**

No confiar únicamente en la redirección del navegador después del pago.

Utilizar webhook del proveedor de pagos para validar el pago cuando corresponda.

---

# 15. Pantalla de resumen de reserva

Antes del pago mostrar claramente:

```text
Habitación seleccionada

Check-in:
XX/XX/XXXX

Check-out:
XX/XX/XXXX

Cantidad de noches:
X

Huéspedes:
X

Valor por noche:
$XX.XXX

Total:
$XXX.XXX
```

Botón:

**Continuar al pago**

---

# 16. Reserva confirmada

Después de validar correctamente el pago mostrar una página:

# ¡Tu reserva está confirmada!

Mostrar:

* Número de reserva.
* Nombre huésped.
* Habitación.
* Check-in.
* Check-out.
* Número de noches.
* Total pagado.
* Datos de contacto de Vista Valle.

Idealmente enviar también un correo electrónico de confirmación.

---

# 17. Estados de reserva

Contemplar los siguientes estados:

```typescript
PENDING
CONFIRMED
CANCELLED
COMPLETED
```

Opcionalmente:

```typescript
NO_SHOW
```

---

# 18. Footer

El footer debe incluir:

**Vista Valle Lodging House**

Información:

```text
Illapel
Región de Coquimbo
Chile
```

Agregar:

* Teléfono.
* WhatsApp.
* Correo electrónico.
* Instagram si existe.
* Google Maps.
* Políticas de reserva.
* Políticas de cancelación.
* Términos y condiciones.

Incluir nuevamente el logo.

Texto inferior:

```text
© Vista Valle Lodging House. Todos los derechos reservados.
```

---

# 19. Ubicación

Crear una sección:

# Encuéntranos

Mostrar un mapa con la ubicación de Vista Valle en Illapel.

Debe incluir:

* Mapa.
* Dirección.
* Botón "Cómo llegar".
* Referencia de ubicación si corresponde.

---

# 21. Responsive

La aplicación debe diseñarse bajo criterio **mobile-first**.

Debe funcionar correctamente en:

```text
Mobile
Tablet
Notebook
Desktop
```

Considerar especialmente que muchos clientes probablemente realizarán reservas desde teléfonos móviles.

Los botones principales deben ser grandes y fáciles de utilizar desde una pantalla táctil.

---

# 22. SEO

Preparar la página para posicionamiento en buscadores.

Keywords conceptuales:

```text
alojamiento Illapel
habitaciones Illapel
hostal Illapel
hospedaje Illapel
hotel Illapel
alojamiento empresas Illapel
alojamiento trabajadores mineros Illapel
habitaciones empresas mineras Illapel
Vista Valle Illapel
Vista Valle Lodging House
```

Configurar correctamente:

* Title.
* Meta description.
* Open Graph.
* Sitemap.
* Robots.
* URLs amigables.
* Schema de alojamiento si corresponde.

---

# 23. Rendimiento

Priorizar un sitio rápido.

Especial atención a las fotografías porque serán una parte importante del sitio.

Utilizar:

* Lazy loading.
* Optimización de imágenes.
* Formatos modernos cuando sea posible.
* Carga progresiva.
* Correcto dimensionamiento de imágenes.

---

# 24. Accesibilidad

Implementar buenas prácticas:

* HTML semántico.
* Contraste correcto.
* Alt text en imágenes.
* Navegación mediante teclado.
* Labels en formularios.
* Estados de focus visibles.

---

# 25. Modelo conceptual de habitaciones

La información no debe escribirse directamente dentro de los componentes.

Crear una estructura que pueda posteriormente venir desde una base de datos.

Ejemplo:

```typescript
interface Room {
  id: string;
  name: string;
  slug: string;
  description: string;
  capacity: number;
  beds: string;
  pricePerNight: number;
  images: string[];
  amenities: string[];
  active: boolean;
}
```

---

# 26. Modelo conceptual de reserva

```typescript
interface Reservation {
  id: string;

  roomId: string;

  guestName: string;
  guestEmail: string;
  guestPhone: string;

  company?: string;

  checkIn: Date;
  checkOut: Date;

  guests: number;

  pricePerNight: number;
  nights: number;

  total: number;

  status:
    | "PENDING"
    | "CONFIRMED"
    | "CANCELLED"
    | "COMPLETED";

  paymentId?: string;

  createdAt: Date;
}
```

---

# 27. Reglas importantes de disponibilidad

Para crear una reserva validar siempre en backend que no exista otra reserva activa para la misma habitación que se superponga con el rango solicitado.

Nunca confiar únicamente en la validación realizada desde frontend.

Si dos usuarios intentan reservar la misma habitación simultáneamente, el backend debe impedir que ambas reservas terminen confirmadas.

---

# 28. Arquitectura sugerida

Si no existe todavía una arquitectura definida, se puede utilizar como referencia:

```text
Frontend
Next.js
TypeScript
Tailwind CSS

Backend
Next.js API / Server Actions

Base de datos
PostgreSQL

Storage
Storage compatible con imágenes

Pagos
Proveedor disponible en Chile

Emails
Proveedor transaccional de emails

Hosting
Vercel u otra infraestructura compatible
```

No acoplar fuertemente el sistema de reservas al proveedor de pagos.

Crear una capa de servicio que permita cambiar el proveedor posteriormente.

---

# 29. Estructura conceptual de páginas

```text
/
├── Inicio
│
├── /habitaciones
│
├── /habitaciones/[slug]
│
├── /reservar
│
├── /reserva/[id]
│
├── /pago
│
├── /reserva-confirmada
│
├── /nosotros
│
├── /contacto
│
├── /terminos
│
└── /politica-cancelacion
```

---

# 30. Componentes principales

Separar correctamente la interfaz en componentes reutilizables.

Por ejemplo:

```text
Header
MobileMenu
Hero
BookingSearch
RoomCard
RoomGallery
RoomAmenities
RoomAvailability
WhyVistaValle
Services
LocationMap
CompanyCTA
Testimonials
BookingSummary
BookingForm
PaymentButton
WhatsAppButton
Footer
```

---

# 31. Contenido administrable

Aunque inicialmente sean solamente 3 habitaciones, evitar construir el proyecto pensando que siempre serán 3.

Debe ser posible agregar nuevas habitaciones en el futuro sin modificar toda la aplicación.

Los siguientes elementos deberían quedar preparados para ser administrables:

```text
Habitaciones
Fotografías
Precios
Servicios
Descripción
Capacidad
Disponibilidad
Bloqueos de calendario
Reservas
```

---

# 32. Futuro panel administrativo

No es obligatorio desarrollarlo en la primera versión pública, pero la arquitectura debe considerar posteriormente un panel:

```text
/admin
```

Desde donde Vista Valle pueda:

* Revisar reservas.
* Crear reservas manuales.
* Modificar reservas.
* Cancelar reservas.
* Bloquear habitaciones.
* Ver disponibilidad.
* Modificar precios.
* Agregar fotografías.
* Editar habitaciones.
* Ver datos de huéspedes.
* Consultar pagos.

---

# 33. Clientes empresas

Vista Valle tiene como segmento importante a empresas, especialmente aquellas que necesitan alojamiento para trabajadores o personal que se encuentre temporalmente en la zona.

Crear dentro del sitio contenido específico que comunique esta posibilidad.

Ejemplo:

# Alojamiento para empresas

> Si tu empresa necesita alojamiento para trabajadores o colaboradores en Illapel, Vista Valle ofrece una alternativa cómoda, segura y flexible.

CTA:

**Solicitar cotización para empresa**

Este CTA puede abrir WhatsApp o un formulario.

---

# 34. Fotografías

Las fotografías deben tener un protagonismo importante.

Necesitamos mostrar:

* Habitaciones.
* Camas.
* Baños.
* Espacios comunes.
* Exterior.
* Estacionamiento.
* Vista hacia la ciudad.
* Entorno.

No utilizar fotografías genéricas cuando existan fotografías reales de Vista Valle.

---

# 35. Tono de comunicación

La comunicación debe ser cercana pero profesional.

Evitar lenguaje excesivamente corporativo.

Conceptos que queremos transmitir:

```text
Descanso
Tranquilidad
Comodidad
Vista
Hospitalidad
Confianza
Seguridad
Atención personalizada
```

---

# 36. Home — orden sugerido

La home debe seguir aproximadamente este orden:

```text
HEADER
   ↓
HERO + BUSCADOR DE DISPONIBILIDAD
   ↓
HABITACIONES
   ↓
POR QUÉ ELEGIR VISTA VALLE
   ↓
SERVICIOS
   ↓
VISTA / EXPERIENCIA
   ↓
ALOJAMIENTO PARA EMPRESAS
   ↓
UBICACIÓN
   ↓
CTA RESERVA
   ↓
FOOTER
```

---

# 37. CTA principal

El CTA más importante de toda la aplicación será:

**Reservar ahora**

Debe aparecer estratégicamente en:

* Header.
* Hero.
* Habitaciones.
* Secciones intermedias.
* Mobile.
* Final de la página.

Evitar saturar visualmente la interfaz con demasiados botones.

---

# 38. Diseño esperado

Buscar un resultado similar a sitios modernos de hoteles boutique o alojamientos.

Características:

```text
Fotografías grandes
Mucho espacio en blanco
Tipografía elegante
Colores cálidos
Animaciones suaves
Bordes sutiles
Sombras mínimas
Cards limpias
Iconografía simple
```

Las animaciones deben ser discretas.

Por ejemplo:

* Fade-in.
* Transiciones suaves.
* Hover en habitaciones.
* Aparición progresiva al hacer scroll.

No utilizar animaciones excesivas.

---

# 39. Información todavía pendiente

No inventar información comercial que no haya sido proporcionada.

Mantener como configuración o placeholder:

```text
Precio habitación 1
Precio habitación 2
Precio habitación 3

Nombre habitación 1
Nombre habitación 2
Nombre habitación 3

Características exactas de cada habitación

Servicios exactos

Dirección exacta

Teléfono

WhatsApp

Correo

Instagram

Horarios de check-in

Horarios de check-out

Política de cancelación

Política de niños

Política de mascotas

Proveedor de pagos

Datos tributarios

Link de Google Maps
```

---

# 40. Primera fase de desarrollo

Para la primera implementación concentrarse en:

1. Crear arquitectura del proyecto.
2. Configurar estilos globales y diseño.
3. Incorporar identidad visual de Vista Valle.
4. Crear Header.
5. Crear Hero.
6. Crear buscador de disponibilidad visual.
7. Crear sección de habitaciones.
8. Crear detalle de habitación.
9. Crear sección "Por qué elegir Vista Valle".
10. Crear sección de servicios.
11. Crear sección empresas.
12. Crear ubicación.
13. Crear Footer.
14. Crear estructura inicial del sistema de reservas.
15. Preparar arquitectura para integrar base de datos y pagos.

---

# 41. Resultado esperado

El resultado final debe ser una página profesional que permita que un usuario pase desde:

> "Estoy buscando dónde alojarme en Illapel"

hasta:

> "Ya reservé y pagué mi habitación en Vista Valle"

con la menor cantidad posible de pasos.

La página debe funcionar simultáneamente como:

* Sitio institucional.
* Catálogo de habitaciones.
* Motor de reservas.
* Canal de venta directa.
* Canal de captación de clientes empresa.

El objetivo comercial principal es aumentar las **reservas directas**, reduciendo la dependencia de intermediarios y entregándole a Vista Valle control sobre la relación con sus huéspedes.
