# Copa Integración DNB 2026 — Fiscalización (PWA)

Esta carpeta convierte tu web de Fiscalización en una **PWA instalable** (app
en el celular/tablet, con ícono propio y que abre sin conexión).

## Qué se agregó sobre tu web original

- `manifest.json` — nombre, ícono y colores de la app para que se pueda "Instalar".
- `sw.js` — service worker: guarda en caché el HTML/CSS/JS/íconos para que la
  app **abra sin conexión** (el "shell" de la app).
- `icons/icon-192.png` y `icons/icon-512.png` — ícono de la app (llama roja/dorada, DNB).
- **Cola de sincronización offline** (lo que pediste): si registrás un
  equipo, cargás un tiempo, corroborás o publicás un resultado sin
  conexión, la acción:
  1. se aplica al instante en la pantalla (modo optimista, para que puedas
     seguir trabajando normalmente),
  2. queda guardada en el dispositivo (localStorage), y
  3. se sube sola a Google Sheets apenas vuelve la señal — reintenta
     automáticamente cada 20 segundos y también al detectar que el
     celular recuperó conexión.
  Arriba a la derecha aparece un aviso **"⏳ N cambios sin subir"**
  mientras haya algo pendiente. El botón "↻ Sincronizar" también fuerza
  a subir lo pendiente antes de traer datos nuevos.
  - **Generar/actualizar el fixture NO se encola**: como el servidor arma
    las llaves con lógica propia, esa acción puntual sigue necesitando
    conexión en el momento; si no hay señal te avisa en vez de encolarla.
  - Importante: si dos personas cambian lo mismo mientras ambas están sin
    conexión (por ejemplo, el mismo equipo desde dos celulares), gana la
    última que logre subir sus cambios — no hay resolución de conflictos,
    es "el último que sube pisa". Para uso normal en un evento (una
    persona por mesa/puesto) no debería ser un problema.
- En `index.html`:
  - Se agregaron las etiquetas `<link rel="manifest">` y metatags para iOS/Android.
  - Se agregó un botón **"Instalar app"** que aparece cuando el navegador
    permite instalar (Android/Chrome/Edge; en iPhone se instala manualmente,
    ver abajo).
  - Se agregó un **caché local (localStorage)**: cada vez que sincronizás con
    Google Sheets, se guarda una copia de equipos/resultados/ranking/fixture.
    Si abrís la app sin conexión, se muestra automáticamente esa última copia
    (modo lectura) en vez de quedar en blanco.
  - **Corregí un bug que tenía tu código**: al final del script se llamaba a
    una función `calc()` que no existe en ningún lado. Como no estaba en un
    `try/catch`, ese error cortaba la ejecución y `syncFromServer()` (la
    sincronización automática al abrir la página) **nunca se llegaba a
    ejecutar** — solo sincronizaba si tocabas el botón "↻ Sincronizar" a mano.
    Ya lo saqué, así que ahora sincroniza sola al abrir.
  - La **fuente de datos sigue siendo tu Google Apps Script** (mismo
    `API_URL` que ya tenías); no toqué esa lógica del lado del servidor.

## Qué pasa exactamente sin conexión

- La **interfaz** funciona sin conexión (queda guardada en el celular).
- **Ver** equipos/ranking/fixture: se muestra la última sincronización
  disponible (modo lectura), con el estado "Sin conexión · viendo última
  sincronización".
- **Registrar equipo, cargar tiempos, corroborar o publicar**: se guardan
  en el dispositivo y se suben solos cuando vuelve la conexión (ver arriba).
- **Generar fixture**: necesita conexión en el momento, no se encola.

## Cómo publicarla (para que sea instalable de verdad)

Una PWA necesita estar servida por **https** en un dominio real (no alcanza
con abrir el archivo `index.html` directo desde el celular). Usá lo mismo
que ya usaste en tus otros proyectos:

### Opción A — GitHub Pages
1. Subí esta carpeta completa (`index.html`, `manifest.json`, `sw.js`,
   `icons/`) a un repositorio de GitHub, manteniendo la misma estructura.
2. Activá GitHub Pages (Settings → Pages → rama `main`, carpeta raíz).
3. Entrá desde el celular a la URL que te da GitHub Pages.
4. En Android/Chrome va a aparecer el botón "Instalar app" (o el menú del
   navegador → "Agregar a pantalla de inicio").

### Opción B — Cloudflare Pages
1. Igual que antes: conectá el repo o arrastrá la carpeta en el panel de
   Cloudflare Pages.
2. Deploy → te da una URL `https://...pages.dev`.

### En iPhone (Safari)
iOS no muestra el botón "Instalar" como Android. Hay que:
1. Abrir la URL en Safari.
2. Tocar el ícono de Compartir → "Agregar a pantalla de inicio".
Así queda con el ícono propio y abre a pantalla completa.

## Estructura de archivos (mantenerla así)

```
index.html
manifest.json
sw.js
icons/
  icon-192.png
  icon-512.png
```

Si alguno de estos archivos no está en el mismo servidor y con esta misma
ubicación relativa, el navegador no va a ofrecer instalar la app.
