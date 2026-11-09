# catalogo-template

Plantilla de catálogo web para tiendas locales (hoy: celulares). Sitio estático sin backend, hecho con React y Ant Design: el catálogo, el carrito y el pedido corren en el navegador y el pedido sale por WhatsApp. Responsive (celular, tablet y PC) y con tema claro y oscuro según el sistema.

## Estructura

```
index.html                  Entrada de Vite
src/main.jsx                ConfigProvider (tema, idioma, prefijo de clases) + App de Ant Design
src/theme.js                ÚNICA fuente de colores, tipografías y radios
src/App.jsx                 Cabecera, filtros y cuadrícula
src/components/             ProductCard, ProductModal, CartDrawer, Warranty, PhoneArt
src/lib/                    catalog (carga y validación), cart (carrito y enlace de WhatsApp), format
public/data/shop.json       Datos del negocio (nombre, WhatsApp, horario)
public/data/products.json   Modelos, capacidades, precios, stock, colores y ficha técnica
public/data/colors.json     Colores disponibles
public/data/warranties.json Textos de garantía (meses, qué cubre, qué no, cómo reclamarla)
public/img/                 Fotos: img/<id>-<color>.jpg o img/<id>.jpg
public/_headers, vercel.json  Cabeceras de seguridad (CSP)
scripts/validate-data.mjs   Valida los JSON
scripts/check-antd-rules.mjs  Hace cumplir las reglas de Ant Design (ver abajo)
```

## Reglas de Ant Design (se verifican con `npm run check`)

1. **Todo dentro de `ConfigProvider`.** Tema, idioma y prefijo de clases se definen una sola vez en `src/main.jsx`. El prefijo de clases es `cat`, así que una referencia a `.ant-*` no tendría ningún efecto.
2. **Nada de clases `ant-*` ni `anticon`** en el código propio. Si Ant Design cambia su nomenclatura, no se rompe nada. Los estilos se hacen con tokens del tema, props semánticas (`styles`, `classNames`) y clases propias.
3. **Sin métodos estáticos** (`message.*`, `notification.*`, `Modal.confirm`): ignoran el `ConfigProvider`. Se usa `App.useApp()`.
4. **Los colores solo se escriben en `src/theme.js`.** Los componentes los leen con `theme.useToken()`.

## Crear el catálogo de un cliente

1. Copia este repo con un nombre por cliente.
2. Edita `public/data/shop.json`: nombre, ubicación, horario y WhatsApp (solo dígitos con indicativo de país, sin `+`, por ejemplo `573001234567`).
3. Edita `public/data/products.json` con los modelos reales, precios en pesos enteros y stock. Una capacidad con `stock: 0` aparece agotada.
4. Ajusta `public/data/warranties.json` con las condiciones reales. Las garantías de equipos reacondicionados incluidas son un ejemplo: lo que se promete ahí obliga al local.
5. Agrega las fotos en `public/img/`. Si falta una foto, se dibuja el equipo con su color.
6. Valida y compila:

```bash
npm run check
npm run build
```

## Probar en local

Con Node 22 o superior. La instalación bloquea los scripts de los paquetes (`.npmrc` con `ignore-scripts=true`).

```bash
npm ci
npm run dev
```

Opción aislada con Docker, sin instalar nada en tu sistema:

```bash
docker run --rm -it -p 5173:5173 -v "$PWD":/app -w /app node:22-alpine sh -c "npm ci && npm run dev -- --host"
```

## Despliegue

Hosting estático gratuito, sin variables de entorno ni secretos.

- **Netlify o Cloudflare Pages:** comando de build `npm run build`, carpeta de publicación `dist`. Leen `public/_headers`.
- **Vercel:** proyecto Vite, comando `npm run build`, salida `dist`. Lee `vercel.json`.

## Seguridad

- Sin backend, sin base de datos y sin claves en el código. Lo único que sale del navegador es el enlace `wa.me` que abre el cliente.
- CSP por cabecera: scripts solo propios (sin `eval` ni inline), sin formularios, sin iframes. **Excepción documentada:** `style-src` admite `'unsafe-inline'` porque Ant Design inyecta sus estilos en tiempo de ejecución y un sitio estático no puede generar un nonce por petición. Afecta solo a estilos, no a scripts.
- Dependencias fijadas a versión exacta con `package-lock.json`, instaladas sin scripts, todas desde el registro oficial de npm, con `npm audit` sin hallazgos al momento de integrarlas. Revisa `npm audit` y actualiza con regularidad.
- Los datos de `public/data` se validan al cargar y React escapa todo texto antes de pintarlo. El carrito guardado en el navegador se revalida contra el catálogo vigente.

## Pendiente

- Panel para que el dueño edite stock y precios sin tocar JSON.
- Fotos reales de cada cliente.
