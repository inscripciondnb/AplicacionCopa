# Copa Integración DNB 2026 — Fiscalización (PWA)

## Versión rediseñada integral

Esta entrega incorpora un centro de comando con Dashboard, estados de
acreditación, buscador y filtros, orden de largada reordenable, carga directa
de cada pasada en Fiscalización, Sectores Rojo y Amarillo, clasificación,
Top 8, podio y modo de pantalla pública. Mantiene la cola offline, el
service worker, el manifest y la sincronización con Apps Script.

El orden de largada se conserva localmente en el dispositivo de Mesa de
Control. Los equipos, estados, resultados, penalizaciones, historial,
clasificación, fixture y `matchId` se conservan en Google Sheets.

Esta carpeta convierte tu web de Fiscalización en una **PWA instalable** (app
en el celular/tablet, con ícono propio y que abre sin conexión).

## Adecuación al Reglamento Oficial (Copa Integración DNB Uruguay 2026)

Repasé el reglamento artículo por artículo contra el sistema. Esto es lo
que ajusté:

### 1. Catálogo de penalizaciones (Art. 22) — reescrito completo
El catálogo anterior era genérico e inventado ("Error técnico", "Falta de
elemento", etc.) y no correspondía a ninguna falta real del reglamento.
Lo reemplacé por las **17 faltas oficiales del Art. 22**, agrupadas por
estación (Generales, Estación 1 — Arrastre de trineo, Estación 2 —
Entrada forzada, Estación 3 — Avance con línea, Estación 4 — Rescate de
víctima), cada una con su sanción exacta en segundos, más una opción
"Otra falta" para casos no previstos.

### 2. Eliminé el multiplicador "Reincidencia ×2"
El reglamento **no tiene** un mecanismo de "duplicar la sanción". Lo que
tiene son faltas que "¿Repite?: Sí" — es decir, se pueden contar varias
veces si ocurren varias veces (ej. "Mover un cono fuera de la marca
+2 seg./cono"). Antes, el sistema representaba eso con un casillero que
multiplicaba por 2 una sola fila — lo cual no reproduce bien "3 conos
movidos = +6s", solo podía dar +2s o +4s.
Ahora cada fila de penalización es una ocurrencia real: si el mismo cono
se mueve 3 veces, se cargan 3 filas de "Mover un cono" (+2s cada una =
+6s). El tipo de falta muestra un aviso **"✓ admite repetirse"** o
**"✕ NO admite repetirse (Art. 22)"** para guiar al fiscal.
La métrica "Reincidencias" pasó a llamarse **"Cant. faltas"** (cuenta
cuántas penalizaciones se cargaron, no cuántas se duplicaron).

### 3. Composición de equipos por categoría (Art. 4) — ahora se valida
Al registrar un equipo, si la modalidad es:
- **Masculino** (individual o grupal): todos los integrantes deben ser Masculino.
- **Femenino** (individual o grupal): todas deben ser Femenino.
- **Mixto**: mínimo 2 de los 4 integrantes deben ser Femenino.
- **+50** (cualquier modalidad): todos los integrantes deben tener 50 años o más.
Si no se cumple, el sistema bloquea el guardado y explica cuál artículo
incumple. También hice **obligatorio el campo Sexo** (antes era opcional,
y sin eso no se puede validar nada de lo anterior).

### 4. Aviso de tiempo máximo (Art. 21)
Superar 8:00 minutos es causal de descalificación. Ahora, tanto en
Fiscalización como en Corroborar, si el tiempo final de un equipo supera
8:00 aparece un aviso en rojo. **No descalifica solo** — el reglamento
dice que las descalificaciones las decide el Jurado, así que esto es un
recordatorio para el fiscal, no una acción automática.

### 5. Recordatorio de faltas "INCOMPLETO" (Art. 22)
Dos faltas del reglamento no son una sanción en segundos sino que
invalidan la pasada ("soltar el trineo antes de los 15m", "no cruzar la
línea de los 15m"). El sistema no tiene forma de marcar una pasada como
inválida (eso requeriría tocar el backend de Google Sheets, que no
tengo a la vista) — agregué un recordatorio visible en Fiscalización para
que el fiscal sepa que esos casos hay que resolverlos con el Jurado
directamente, no cargándolos como si fueran una penalización más.

### 6. Aviso de tope de integrantes (Art. 8)
"Máximo 15 integrantes por delegación, capitán incluido." Al guardar un
equipo, el sistema cuenta nombres distintos entre todas las modalidades
más el capitán; si da más de 15, pide confirmación antes de guardar.
Es una estimación por nombre (dos personas tipeadas distinto no se
detectan como la misma), por eso avisa en vez de bloquear directamente.

### 7. Ya estaba bien (no lo toqué)
- Capitán no compite: el sistema nunca envía `capitanCompite: true`, ya
  cumplía el Art. 9.
- Integrantes por modalidad (1 para individual, 4 para grupal): correcto
  desde el original.

### 8. Decisiones que dejo en tus manos (no las cambié solo)
- **Nombres de modalidad**: el reglamento dice "INDIVIDUAL FEMENINA" y
  "GRUPAL MIXTA"; el sistema usa "INDIVIDUAL FEMENINO" y "GRUPO MIXTO".
  Es solo una diferencia de redacción (la cantidad y estructura de
  categorías ya coincide: 5 categorías × con/sin +50 = 10). **No renombré
  los valores** porque si ya hay equipos cargados con los nombres viejos,
  renombrar crearía dos categorías separadas con nombres distintos y
  partiría el ranking en dos. Si todavía no cargaste equipos reales,
  decime y lo renombro para que coincida exactamente con el reglamento.
- **Descalificación como estado formal**: el reglamento prevé
  descalificar a un equipo (Art. 21) y excluirlo del ranking. El sistema
  no tiene ese estado — solo tiempo + penalizaciones. Agregar un estado
  real de "descalificado" que además saque al equipo del cálculo de
  posiciones requiere tocar el backend de Google Sheets (que no tengo a
  la vista) para que el ranking lo excluya de verdad. Por ahora, la única
  vía es que el Jurado lo resuelva fuera del sistema (o le carguen un
  tiempo/observación manual). Si querés, puedo diseñar esto si me pasás
  el código del Apps Script.
- **Repechaje / instancias adicionales (Art. 14)**: el reglamento
  contempla que la Organización pueda agregar repechajes. El sistema solo
  tiene el fixture de "Top 8 → cuartos → semis → final"; no arma
  repechajes. Si los van a usar, se puede registrar manualmente como
  duelos sueltos (Fiscalización ya lo permite sin pasar por el fixture),
  pero no hay una pantalla dedicada.

### 8. Actualización — ya resueltos los dos puntos pendientes
- **Nombres de modalidad**: ya están alineados exactamente con el
  reglamento — `GRUPO MIXTO` → `GRUPAL MIXTA`, `INDIVIDUAL FEMENINO` →
  `INDIVIDUAL FEMENINA` (y sus versiones +50). **Ojo**: si ya había
  equipos guardados en Google Sheets con los nombres viejos, esos equipos
  van a quedar con una modalidad que ya no aparece en los selectores
  nuevos — hay que revisarlos y volver a guardarlos (editar equipo) para
  que tomen el nombre correcto.
- **Descalificación (Art. 21)**: agregada como casillero "Descalificar
  este resultado", disponible tanto en Fiscalización como en Corroborar.
  No requiere ningún cambio en tu Google Sheets/Apps Script — se guarda
  como un prefijo `[DESCALIFICADO]` al principio de las Observaciones (el
  sistema lo oculta del cuadro de texto para que no moleste al editar). En
  el Ranking oficial, los equipos descalificados aparecen en una sección
  aparte, debajo del cuadro de posiciones, sin número de puesto — nunca
  compiten por el podio aunque su tiempo hubiese sido el mejor.

### 9. Fallos silenciosos de sincronización — corregidos
Detecté que, si el envío (registrar equipo, guardar duelo, corroborar,
publicar, generar fixture) se hacía bien pero la **sincronización
posterior** fallaba (por ejemplo, un corte de señal justo después de
guardar), el sistema igual mostraba el mensaje de éxito — dejando al
fiscal creyendo que ya estaba reflejado en el Ranking/lista cuando en
realidad no se había confirmado. Ahora, si eso pasa, el sistema avisa
explícitamente: "se envió, pero no se pudo confirmar la actualización —
tocá Sincronizar para verificar", en vez de mentir con un éxito genérico.

### 10. La revisión ya no se reabre sola después de publicar
Antes, al publicar un resultado, la pantalla de Corroborar volvía a
abrir la misma revisión — lo cual invitaba a un reenvío accidental si
alguien tocaba "Publicar" de nuevo por error. Ahora, una vez publicado
(con éxito confirmado), la revisión se cierra sola y no vuelve a
aparecer editable; si hay que corregir algo después de publicado, se
entra de nuevo desde cero como una edición nueva.

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
