# MANPOWERS — Web Oficial

Web oficial de **MΛN POWERS**. Este repositorio contiene el **frontend** (React + TypeScript) y la integración con un **backend** alojado en IONOS (MySQL + API en PHP) a través de endpoints HTTP.

## 1) Arquitectura (visión general)

- **Frontend (este repo)**: SPA en React que renderiza el catálogo, páginas de producto, carrito, checkout, landing pages, zonas privadas (comerciales/colaboradores) y utilidades SEO/i18n.
- **Backend (IONOS)**: API en **PHP** que consulta/actualiza datos en **MySQL** (productos, compras, pedidos, colaboradores, chat, etc.) y expone scripts PHP consumidos por el frontend.
- **Pago**: integración con Redsys mediante un endpoint PHP que genera la petición/firmas y una URL de respuesta (notificaciones) en servidor.

En desarrollo local, Vite hace proxy de llamadas a la API hacia `https://manpowers.es` para poder trabajar sin levantar PHP/MySQL en local.

## 2) Tecnologías y librerías

- **React 19** + **TypeScript**
- **Vite** (dev server + build)
- **Tailwind CSS v4** (diseño utility-first)
- **React Router** (rutas SPA)
- **i18next + react-i18next** (multi-idioma)
- **Leaflet + react-leaflet** (mapa de puntos de venta)
- **EmailJS** (emails transaccionales desde el frontend, sin servidor propio para el envío)

## 3) Rutas principales (páginas)

Definidas en [App.tsx](file:///Users/braydarak/Desktop/Work/manpowers/src/App.tsx#L24-L61):

- `/`: Home (Hero + catálogo destacado + mapa de tiendas + about + locations).
- `/products`: Catálogo completo con buscador, filtros y ordenación.
- `/products/:sportId`: Productos filtrados por deporte.
- `/products/category/:categorySlug`: Vista por categoría.
- `/product/:slug` (y variantes): Detalle del producto.
- `/landing/:slug`: Landing específica (campañas/ads).
- `/payment-result`, `/pago-ok`, `/pago-ko`: Resultado de pago (éxito o error) + persistencia/confirmación.
- `/colaboradores`: Login de colaboradores.
- `/colaboradores/panel`: Panel con estadísticas de colaborador.
- `/comercial`: Zona comercial (login, catálogo comercial, creación de pedidos, listado/gestión).

## 4) Frontend en detalle

### 4.1 Home (secciones principales)

Implementado en [HomePage.tsx](file:///Users/braydarak/Desktop/Work/manpowers/src/pages/HomePage.tsx):

- **Hero**: bloque superior principal.
- **AllProducts (home)**: listado de productos para navegación rápida.
- **Shops (lazy-load)**: la sección de tiendas se carga bajo demanda (cuando entra en viewport) para reducir coste inicial.
- **AboutUs** y **Locations**: secciones informativas y de ubicación.
- **Modal de búsqueda de tiendas**: disponible globalmente en home.
- **SEO**: se actualizan tags con `updateSEOTags(seoConfigs.home)` desde [seoConfig.ts](file:///Users/braydarak/Desktop/Work/manpowers/src/utils/seoConfig.ts#L63-L108).
- **Limpieza de estado de compra**: al volver a home se limpian claves de `sessionStorage` relacionadas con compra/envío de email.

### 4.2 Catálogo completo (/products)

Implementado en [AllProductsPage.tsx](file:///Users/braydarak/Desktop/Work/manpowers/src/pages/AllProductsPage.tsx):

- **Carga de productos** mediante `productsService.getProducts()`.
- **Buscador** (por nombre, SKU y categoría, con soporte de idiomas).
- **Buckets** de categorías (rendimiento, suplementos, cuidado, indumentaria), con normalización de slugs.
- **Ordenaciones** (relevancia, nombre, precio asc/desc, “clearance”).
- **SEO** específico del catálogo (title, description, canonical).

### 4.3 Servicio de productos (capa de datos)

Implementado en [productsService.ts](file:///Users/braydarak/Desktop/Work/manpowers/src/services/productsService.ts):

- **Fuente principal**: solicita productos al endpoint `get_products.php`.
- **Cache en memoria**: evita peticiones repetidas y deduplica requests concurrentes.
- **Normalización/parsing**: convierte campos del backend (precios, colores, fichas técnicas, facts nutricionales en múltiples formatos) a una forma consistente para la UI.
- **Soporte multi-idioma**: estructuras `name`, `description`, etc. por idioma, y traducciones auxiliares (p.ej. catalán).

### 4.4 Carrito, checkout y descuentos

El carrito vive en [CartWidget.tsx](file:///Users/braydarak/Desktop/Work/manpowers/src/components/cart/CartWidget.tsx):

- **Gestión de items** (incremento/decremento, totales, subtotal, descuento, total).
- **Códigos promocionales**:
  - Consulta `promo.php`.
  - Fallback a `https://manpowers.es/backend/api/promo.php` si el endpoint principal no responde.
  - Puede devolver un número (descuento global) o una estructura con `percent` y `categories`.
- **Persistencia temporal**: se guarda información de comprador y compra en `sessionStorage` para usarla en la página de resultado.

### 4.5 Pago con Redsys (flujo)

Flujo principal:

1. El usuario completa el checkout (email, dirección, etc.).
2. El frontend crea un `orderId` y guarda datos en `sessionStorage`.
3. El frontend crea un `form` y hace `POST` a `redsys-config.php` (redirige a Redsys).
4. Redsys redirige de vuelta a `/pago-ok` o `/pago-ko`.
5. En la página de resultado, se muestra el estado y se ejecutan acciones post-pago.

Piezas implicadas:

- Form post a backend en [CartWidget.tsx](file:///Users/braydarak/Desktop/Work/manpowers/src/components/cart/CartWidget.tsx#L537-L555).
- Página de resultado en [PaymentResultPage.tsx](file:///Users/braydarak/Desktop/Work/manpowers/src/pages/PaymentResultPage.tsx) (muestra estado y permite reintentos de email).
- Guardado de compra en backend: `save_purchase.php`.

### 4.6 Email transaccional (confirmación / recibo)

Se envía un email con EmailJS y además se guarda la compra en backend:

- En la página de resultado: [PaymentResultPage.tsx](file:///Users/braydarak/Desktop/Work/manpowers/src/pages/PaymentResultPage.tsx#L248-L313).
- En el “auto-sender” (sin UI): [sendEmail/index.tsx](file:///Users/braydarak/Desktop/Work/manpowers/src/components/sendEmail/index.tsx) (se asegura de enviar/guardar una sola vez por pedido).

Comportamiento clave:

- **Idempotencia en cliente**: se usa una marca `purchaseSaved:<orderId>` en `sessionStorage` para no duplicar guardados.
- **Payload**: incluye datos del comprador, lista de productos y total.

### 4.7 Chat (widget + servicio)

- Servicio de red: [chat.ts](file:///Users/braydarak/Desktop/Work/manpowers/src/services/chat.ts#L6-L34).
- Endpoint configurable por variable: `VITE_API_URL` o, por defecto, `https://manpowers.es/backend/chat.php`.
- Request: `POST` con `messages`, `context` y `locale`. Response: `{ reply }`.

### 4.8 Zonas privadas

**Colaboradores**

- Login: [CollaboratorsLoginPage.tsx](file:///Users/braydarak/Desktop/Work/manpowers/src/pages/CollaboratorsLoginPage.tsx#L23-L104)
  - Intenta cargar usuarios desde `collaborators.php`.
  - Si no hay lista, hace fallback a `/collaborators.json` (cuando existe en `public/` en el despliegue).
  - Guarda sesión en `sessionStorage` como `collab_session`.
- Panel: [CollaboratorsDashboardPage.tsx](file:///Users/braydarak/Desktop/Work/manpowers/src/pages/CollaboratorsDashboardPage.tsx#L41-L67)
  - Pide estadísticas a `colaboradores_stats.php` enviando `discount_code`.

**Comercial**

Implementado en [Comercial.tsx](file:///Users/braydarak/Desktop/Work/manpowers/src/pages/Comercial.tsx):

- Login: `comercial_login.php`.
- Carga pedidos:
  - Admin: `get_orders.php`
  - No admin: `get_orders.php?agent=<username>`
- Guardar pedido: `save_order.php` (con datos de cliente, productos, totales y agente).
- Eliminar pedido (admin): `delete_order.php`.
- Email de confirmación de pedido comercial: se envía con EmailJS desde el frontend tras guardar el pedido.

### 4.9 SEO, sitemap y assets públicos

- SEO dinámico: [seoConfig.ts](file:///Users/braydarak/Desktop/Work/manpowers/src/utils/seoConfig.ts) define configs y utilidades para:
  - `title`, `description`, `keywords`, `og:*`, `canonical`
  - structured data (schema) para producto (cuando aplica)
- Archivos públicos relevantes en `public/`:
  - `robots.txt`, `sitemap.xml`
  - `shops.json`, `sports.json`, `tamdProducts.json`, `product.json`
  - imágenes/vídeos y fichas técnicas en `public/ficha-tecnica/`
- Script de build auxiliar: [generate-public-media-manifest.mjs](file:///Users/braydarak/Desktop/Work/manpowers/scripts/generate-public-media-manifest.mjs)
  - Se ejecuta en `predev` y `prebuild`.
  - Genera `src/generated/publicMediaManifest.ts` con un índice de assets (png/jpg/webp/avif/mp4/webm) dentro de `public/`.

## 5) Backend (IONOS): MySQL + API PHP

El backend está desplegado en **IONOS**, con **MySQL** como base de datos y una **API implementada en PHP**. El frontend consume estos scripts como endpoints HTTP.

Importante:

- Este repositorio no contiene necesariamente el código PHP del servidor; aquí se documenta **lo que el frontend utiliza** (endpoints, contratos esperados y finalidad).
- En producción, estos endpoints están publicados en el dominio `manpowers.es` (y existe un endpoint adicional para Redsys en `backendv2`).

### 5.1 Endpoints PHP usados por el frontend (uno por uno)

#### 1) `get_products.php`

- **Uso**: cargar catálogo.
- **Consumidor**: [productsService.ts](file:///Users/braydarak/Desktop/Work/manpowers/src/services/productsService.ts#L173-L193).
- **Respuesta esperada**: JSON con `{ success, products, total, metadata? }`.
- **Rol típico en backend**: consulta a MySQL y devuelve listado de productos (incluyendo campos multi-idioma, precios, disponibilidad, imágenes, etc.).

#### 2) `promo.php` (y fallback `backend/api/promo.php`)

- **Uso**: validar y resolver códigos promocionales.
- **Consumidor**: [CartWidget.tsx](file:///Users/braydarak/Desktop/Work/manpowers/src/components/cart/CartWidget.tsx#L366-L419).
- **Respuesta esperada**: JSON tipo diccionario:
  - `CODE: number` (porcentaje directo), o
  - `CODE: { percent: number, categories?: string[] }` (descuento por categorías).
- **Rol típico en backend**: recuperar tabla/listado de promos (MySQL o configuración) y devolverlo al cliente.

#### 3) `redsys-config.php`

- **Uso**: iniciar el pago por Redsys.
- **Consumidor**: [CartWidget.tsx](file:///Users/braydarak/Desktop/Work/manpowers/src/components/cart/CartWidget.tsx#L537-L555).
- **Entrada típica**: `order` (id) y `amount` (en céntimos).
- **Salida típica**: HTML/form o redirección a Redsys con parámetros firmados.
- **Rol típico en backend**: construir parámetros de Redsys, firmarlos y devolver una página que redirige al TPV.

#### 4) `save_purchase.php`

- **Uso**: persistir una compra confirmada.
- **Consumidores**:
  - [PaymentResultPage.tsx](file:///Users/braydarak/Desktop/Work/manpowers/src/pages/PaymentResultPage.tsx#L284-L313)
  - [sendEmail/index.tsx](file:///Users/braydarak/Desktop/Work/manpowers/src/components/sendEmail/index.tsx#L236-L268)
- **Entrada**: JSON con datos del comprador (nombre, email, teléfono, dirección), pedido (order_id), total y `items`.
- **Rol típico en backend**: insertar en MySQL la compra/lineas de pedido para trazabilidad, soporte y analítica.

#### 5) `chat.php` (o `VITE_API_URL`)

- **Uso**: chat/assistant.
- **Consumidor**: [chat.ts](file:///Users/braydarak/Desktop/Work/manpowers/src/services/chat.ts#L6-L34).
- **Entrada**: `{ messages, context?, locale? }`.
- **Salida**: `{ reply: string }`.
- **Rol típico en backend**: orquestar lógica de chat (p.ej. RAG, reglas, integración con proveedor de IA) y devolver una respuesta.

#### 6) `collaborators.php`

- **Uso**: obtener lista de colaboradores para login.
- **Consumidor**: [CollaboratorsLoginPage.tsx](file:///Users/braydarak/Desktop/Work/manpowers/src/pages/CollaboratorsLoginPage.tsx#L35-L68).
- **Salida esperada**: `{ users: [...] }` o lista directa.
- **Rol típico en backend**: devolver credenciales/usuarios de colaboradores (idealmente de forma segura) desde MySQL o configuración.

#### 7) `colaboradores_stats.php`

- **Uso**: estadísticas para el panel de colaboradores (ventas/pedidos/unidades).
- **Consumidor**: [CollaboratorsDashboardPage.tsx](file:///Users/braydarak/Desktop/Work/manpowers/src/pages/CollaboratorsDashboardPage.tsx#L46-L67).
- **Entrada**: `{ discount_code }`.
- **Salida esperada**: `{ ok: true, data: { orders, sales, units } }`.
- **Rol típico en backend**: agregaciones en MySQL por código/colaborador.

#### 8) `comercial_login.php`

- **Uso**: autenticación de usuarios comerciales.
- **Consumidor**: [Comercial.tsx](file:///Users/braydarak/Desktop/Work/manpowers/src/pages/Comercial.tsx#L955-L987).
- **Salida esperada**: `{ ok: true, username, is_admin }` o `{ ok: false, error? }`.
- **Rol típico en backend**: validar credenciales contra MySQL y devolver rol/permisos.

#### 9) `get_orders.php`

- **Uso**: cargar pedidos en zona comercial (admin o por agente).
- **Consumidor**: [Comercial.tsx](file:///Users/braydarak/Desktop/Work/manpowers/src/pages/Comercial.tsx#L792-L809).
- **Parámetros**: `agent=<username>` cuando no es admin.
- **Salida esperada**: array JSON con pedidos.
- **Rol típico en backend**: listar pedidos (MySQL o almacenamiento de ficheros), filtrables por agente.

#### 10) `save_order.php`

- **Uso**: crear/guardar un pedido desde zona comercial.
- **Consumidor**: [Comercial.tsx](file:///Users/braydarak/Desktop/Work/manpowers/src/pages/Comercial.tsx#L1086-L1206).
- **Entrada**: JSON con cliente, productos, descuentos, totales, fecha y agente.
- **Rol típico en backend**: persistir pedido en MySQL (y/o generar artefactos asociados).

#### 11) `delete_order.php`

- **Uso**: eliminar pedido (solo admin).
- **Consumidor**: [Comercial.tsx](file:///Users/braydarak/Desktop/Work/manpowers/src/pages/Comercial.tsx#L833-L887).
- **Entrada**: `{ filename, agent, order_key }` (según el flujo actual del frontend).
- **Rol típico en backend**: borrar registro/archivo asociado y devolver estado.

#### 12) `backendv2/response.php`

- **Uso**: endpoint de notificación/retorno de Redsys configurado en servidor.
- **Referencia**: configuración de entorno en [public/.htaccess](file:///Users/braydarak/Desktop/Work/manpowers/public/.htaccess#L15-L27).
- **Rol típico en backend**: procesar la respuesta del TPV (validación de firma, actualización de estado del pedido en MySQL, etc.).

### 5.2 Reglas de servidor y seguridad (Apache)

En [public/.htaccess](file:///Users/braydarak/Desktop/Work/manpowers/public/.htaccess#L30-L56) hay reglas relevantes:

- **SPA fallback**: cualquier ruta que no sea un archivo/directorio y no sea una ruta de API se reescribe a `/index.html`.
- **Restricción de acceso a `.php`**: limita el acceso directo a PHP por `Origin/Referer` del propio dominio y localhost (reduce exposición, aunque no sustituye autenticación real).
- **Bloqueo de rutas sensibles**: reglas para proteger accesos directos a “orders” si no viene desde la app.

## 6) Desarrollo local

### Requisitos

- Node.js + npm

### Instalación

```bash
npm install
```

### Arranque en desarrollo

```bash
npm run dev
```

Notas:

- El proxy de Vite está en [vite.config.ts](file:///Users/braydarak/Desktop/Work/manpowers/vite.config.ts#L5-L21):
  - Se enrutan rutas de API hacia producción para desarrollo local.

### Build de producción

```bash
npm run build
```

### Preview de la build

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

## 7) Estructura del proyecto

```
public/
  .htaccess
  robots.txt
  sitemap.xml
  shops.json, sports.json, ...
  products/ (imágenes)
  ficha-tecnica/ (PDFs)

src/
  components/ (UI reutilizable: header, footer, cart, chatWidget, modales, etc.)
  sections/ (bloques de home: hero, aboutUs, shops, locations, sports)
  pages/ (rutas: home, products, product detail, pago, colaboradores, comercial, legales)
  services/ (acceso a API: productos, chat)
  i18n/ (textos multi-idioma)
  utils/ (SEO, helpers)
  generated/ (archivos autogenerados por scripts)
```

## 8) Licencia / uso

Proyecto privado. Todos los derechos reservados a MΛN POWERS.
