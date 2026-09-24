# Code.gs — backend nuevo, desde cero

Escrito de cero porque el script anterior no apareció. Expone **exactamente
las mismas acciones** que tu `index.html` actual ya usa
(`registrar_equipo`, `editar_equipo`, `eliminar_equipo`, `guardar_duelo`,
`guardar_corroboracion`, `publicar_resultado`, `generar_fixture`,
`bootstrap`, `estado`) — no hace falta tocar el frontend para que hablen
entre sí. Por dentro guarda todo en 9 hojas normalizadas, con **matchId
persistente en Sheets** (no en el navegador).

Probé la lógica entera con una batería de 30 verificaciones automáticas
antes de entregarlo (generación de matchId, reenvío del mismo duelo sin
duplicar filas, suma de penalizaciones, armado de cuartos de final según el
reglamento, borrado en cascada al eliminar un equipo, etc.) — no es código
sin probar.

## 1. Crear la planilla

Si no tenés una planilla de Google Sheets para esto todavía, creá una
nueva y ponele un nombre (ej. "Copa Integración DNB 2026 — Base de datos").
Si ya tenés una (aunque esté vacía), podés reusarla.

## 2. Instalar el script

1. En la planilla: **Extensiones → Apps Script**.
2. Te abre un editor con un `Code.gs` de ejemplo (función `myFunction`).
   Borrá todo ese contenido y pegá el `Code.gs` completo que te entrego.
3. Guardá (ícono de disquete o Ctrl+S).

## 3. Crear las hojas

En el editor de Apps Script, con `Code.gs` abierto:
1. Arriba, en el desplegable de funciones, elegí **setup**.
2. Tocá **Ejecutar** (▶).
3. La primera vez te va a pedir autorización — es tu propio script actuando
   sobre tu propia planilla, aceptá los permisos.
4. Volvé a la planilla: deberías ver 9 hojas nuevas — EQUIPOS,
   PARTICIPANTES, ENFRENTAMIENTOS, RESULTADOS, PENALIZACIONES,
   CLASIFICACION, FIXTURE, HISTORIAL, CONFIGURACION.

(Esto también pasa solo la primera vez que la app llama a cualquier acción,
así que si te salteás este paso no rompe nada — es solo para verlas de
entrada.)

## 4. Publicar como aplicación web

1. En el editor: **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web**.
3. Ejecutar como: **Yo** (tu cuenta).
4. Quién tiene acceso: **Cualquier usuario**.
5. **Implementar**.
6. Copiá la URL que termina en `/exec`.

## 5. Conectar el frontend

Abrí `index.html`, buscá la constante `API_URL` (tiene un comentario en
mayúscula justo arriba marcándola) y reemplazá la URL vieja por la nueva
que copiaste en el paso anterior. Guardá el archivo y volvé a subirlo a
donde tengas publicada la PWA (GitHub Pages / Cloudflare Pages).

## 6. Probar

Con la app apuntando a la URL nueva:
1. Registrá un equipo de prueba.
2. Cargá un duelo con otro equipo de prueba.
3. Corroborá y publicá.
4. Mirá el Ranking — debería aparecer.
5. En la planilla, revisá la hoja ENFRENTAMIENTOS: debería haber una fila
   con un `matchId` con forma `GRM-R1-001` (o el prefijo que corresponda a
   la modalidad que probaste).
6. Borrá los equipos de prueba antes del evento real (Acreditación →
   Eliminar).

## Notas importantes

- **Bloqueo de escritura entre dispositivos**: agregué `LockService` — si
  dos tablets guardan algo exactamente al mismo tiempo, una espera a que
  termine la otra (hasta 30 segundos) en vez de pisarse. Esto es nuevo
  respecto a lo que probablemente tenía el script perdido, y reduce el
  riesgo de datos corruptos con varios dispositivos en simultáneo.
- **Reenvíos seguros**: si la cola offline del navegador reintenta guardar
  el mismo duelo o resultado (por ejemplo, después de un corte de señal),
  el backend lo reconoce por número de equipo + modalidad y actualiza la
  misma fila — no genera duplicados ni un segundo matchId. Esto lo
  verifiqué explícitamente con una prueba automática.
- **matchId**: formato `<PREFIJO_MODALIDAD>-<RONDA>-<NÚMERO>`, por ejemplo
  `INDM-R1-001` (individual masculino, ronda 1, primer enfrentamiento) o
  `GRX-CUARTOS-003` (grupal mixta, cuartos de final, tercera llave). Se
  genera solo la primera vez que dos equipos se enfrentan en una
  modalidad+ronda; si se vuelve a guardar ese mismo par, reutiliza el
  mismo matchId.
- **`generar_fixture`** ahora, además de armar las llaves de cuartos según
  el reglamento (1º-8º, 4º-5º, 3º-6º, 7º-2º), **congela el Top 8** en la
  hoja CLASIFICACION en ese momento — así queda un registro permanente de
  quiénes clasificaron, tal como pide el Art. 15 sobre el momento de
  "conformarse la lista de los 8".
- **`actualizar_habilitacion`**: acción nueva, todavía no la usa el
  frontend actual (es para cuando hagamos la pantalla de Acreditación con
  estados PENDIENTE/DOCUMENTACIÓN OK/CONTROL MÉDICO OK/HABILITADO/NO
  HABILITADO). Ya está lista del lado del backend para cuando lleguemos a
  esa fase.
- **Sector Rojo/Amarillo**: internamente el equipo "A" de cada duelo queda
  como `sector: 'ROJO'` y el "B" como `'AMARILLO'` en la hoja RESULTADOS —
  ya preparado para cuando el frontend adopte esa nomenclatura en las
  próximas fases.

## Qué falta para el resto de tu pedido

Este Code.gs es la base (matchId real, esquema de 9 hojas, historial con
valor anterior/nuevo, habilitación). Las pantallas nuevas — Dashboard,
Orden de largada, rediseño visual completo, Eliminatorias con avance
automático, Podio, Pantalla pública — siguen pendientes: eso es trabajo de
`index.html`, no de este archivo. Server listo para soportarlas; avisame
cuándo seguimos con el frontend y en qué orden.
