# Copa Integración DNB 2026 — Fiscalización (PWA)

Esta carpeta convierte tu web de Fiscalización en una **PWA instalable** (app
en el celular/tablet, con ícono propio y que abre sin conexión).

## Auditoría para uso en competencia real

Antes de esto no había pasado por una revisión a fondo pensando en un
evento internacional en vivo. Encontré y corregí estos problemas:

1. **Índices que se podían pisar solos (bug crítico).** La pantalla de
   Corroborar guardaba internamente "la fila número X de la tabla" en vez
   de "el equipo número tal". Si en el medio de una revisión llegaba una
   sincronización de fondo (la cola subiendo algo, u otro dispositivo
   publicando), la tabla se reemplazaba entera y ese índice podía terminar
   apuntando al resultado de **otro equipo**. Ahora todo se busca siempre
   por (modalidad, número de equipo) en el momento de guardar, nunca por
   posición guardada de antemano.
2. **Orden de subida no garantizado (bug crítico).** Si había una acción
   vieja esperando en la cola offline y llegaba la señal, una acción nueva
   podía viajar al servidor antes que la vieja (por ejemplo, una edición
   adelantándose a la creación de ese mismo equipo). Ahora, mientras haya
   algo pendiente en la cola, todo lo nuevo se encola también, en el mismo
   orden — nunca se salta nada.
3. **Doble clic.** "Corroborar y publicar" y "Eliminar equipo" no se
   bloqueaban mientras la acción estaba en curso; un doble toque podía
   dispararla dos veces. Ahora los botones se deshabilitan durante la
   operación (igual que ya pasaba en "Registrar equipo" y en el duelo).
4. **Publicar sin confirmación.** Publicar un resultado queda visible en
   el Ranking oficial al instante — ahora pide una confirmación explícita
   antes de hacerlo.
5. **Números negativos.** El número de equipo, los tiempos (min/seg/cent)
   y los segundos de penalización ahora no pueden quedar en negativo por
   un tipeo accidental.
6. **Corroborar algo que ya no existe.** Si corroborás/publicás un
   resultado que en el medio ya fue publicado desde otro dispositivo, la
   app ahora te avisa en vez de fallar en silencio o pisar datos.

## Cosas que quedan como decisión tuya, no las cambié solo

- El alta de un integrante solo exige nombre; sexo y edad quedan
  opcionales. Si para la competencia internacional necesitás que sean
  obligatorios, decime y lo agrego.
- **Límite real del diseño offline multi-dispositivo**: si dos personas
  cambian lo mismo estando ambas sin conexión (mismo equipo, dos
  celulares), gana el último que logra subir — no hay resolución de
  conflictos porque eso requeriría cambios del lado del Apps Script/Sheets,
  que no tengo a la vista. Para una competencia internacional con varias
  mesas de fiscalización en simultáneo, esto vale la pena tenerlo muy claro
  con el equipo que va a operar el sistema: idealmente, cada mesa/puesto
  trabaja siempre con el mismo número de equipo y no dos personas editan el
  mismo equipo a la vez estando ambas offline.
- El emparejamiento de "qué equipo enfrentó a cuál" (para corroborar los 2
  juntos) vive en el dispositivo, no en Sheets — ver el punto de
  "Corroborar por enfrentamiento" más abajo.

## Qué se agregó sobre tu web original

- `manifest.json` — nombre, ícono y colores de la app para que se pueda "Instalar".
- `sw.js` — service worker: guarda en caché el HTML/CSS/JS/íconos para que la
  app **abra sin conexión** (el "shell" de la app).
- `icons/icon-192.png` y `icons/icon-512.png` — ícono de la app (llama roja/dorada, DNB).
- **Corroborar por enfrentamiento, no por equipo suelto**: la pantalla
  "Corroborar" ahora agrupa los dos resultados pendientes de un mismo duelo
  (Equipo A vs Equipo B) en **una sola revisión**, con los datos de los dos
  lados en paralelo — igual que en la pantalla de Fiscalización — y un solo
  botón **"Corroborar y publicar los 2"** que los publica juntos.
  - El emparejamiento se arma automáticamente: cuando cargás un duelo en
    "Fiscalización", la app recuerda en este dispositivo qué equipo
    enfrentó a cuál en esa modalidad.
  - Si la app no encuentra el rival automáticamente (por ejemplo, porque el
    duelo se cargó desde otro celular/tablet), el pendiente aparece con un
    desplegable **"Vincular con rival pendiente"** para emparejarlo a mano
    antes de revisar; una vez vinculado, queda guardado para la próxima vez.
  - También podés destildar un emparejamiento mal armado con el botón
    "✕ Quitar vínculo" dentro de la revisión, y corroborar/publicar ese
    equipo solo.
  - Ojo: este emparejamiento vive en el localStorage de cada dispositivo,
    no en Google Sheets (el backend no guarda un "id de enfrentamiento").
    Si fiscalizás desde un celular y corroborás desde otro, puede que
    tengas que vincular manualmente la primera vez en el segundo
    dispositivo — después de eso también queda recordado ahí.
- **Cola de sincronización offline**: si registrás un
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
