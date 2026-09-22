/**
 * ============================================================================
 * COPA INTEGRACIÓN DNB URUGUAY 2026 — BACKEND (Google Apps Script)
 * ============================================================================
 *
 * Reemplazo completo del backend, escrito desde cero.
 *
 * COMPATIBILIDAD: expone exactamente las mismas acciones y formas de datos
 * que el index.html actual ya usa (registrar_equipo, editar_equipo,
 * eliminar_equipo, guardar_duelo, guardar_corroboracion, publicar_resultado,
 * generar_fixture, bootstrap, estado). El frontend actual funciona sin
 * cambios apuntando a la URL de despliegue de este script.
 *
 * POR DENTRO usa un esquema normalizado de 9 hojas (creadas automáticamente
 * la primera vez que se usan):
 *   EQUIPOS, PARTICIPANTES, ENFRENTAMIENTOS, RESULTADOS, PENALIZACIONES,
 *   CLASIFICACION, FIXTURE, HISTORIAL, CONFIGURACION
 *
 * NOVEDAD CLAVE: cada enfrentamiento tiene un matchId persistente en
 * ENFRENTAMIENTOS (formato tipo INDM-R1-001), no depende de localStorage
 * del dispositivo. Guardar el mismo duelo dos veces (ej. reintento de la
 * cola offline) reutiliza el mismo matchId y sobrescribe los mismos
 * resultados — no genera duplicados.
 *
 * INSTALACIÓN:
 * 1) Extensiones → Apps Script en tu Google Sheet (o uno nuevo).
 * 2) Pegar este archivo completo como Code.gs (reemplazando lo que haya).
 * 3) Ejecutar la función `setup` una vez (menú Ejecutar → setup) para crear
 *    las hojas; también se crean solas la primera vez que se usan desde la
 *    app, así que este paso es solo para verlas de entrada.
 * 4) Implementar → Nueva implementación → Aplicación web
 *      Ejecutar como: Yo
 *      Quién tiene acceso: Cualquier usuario
 * 5) Copiar la URL /exec y pegarla como API_URL en index.html.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// ESQUEMA
// ---------------------------------------------------------------------------

const HEADERS = {
  EQUIPOS: ['numero','delegacion','capitan','capitanCompite','modalidades','estadoHabilitacion','fechaCreacion','fechaModificacion'],
  PARTICIPANTES: ['equipoNumero','modalidad','orden','nombre','sexo','edad'],
  ENFRENTAMIENTOS: ['matchId','modalidad','ronda','equipoRojo','equipoAmarillo','estado','fechaCreacion'],
  RESULTADOS: ['numero','modalidad','matchId','sector','tiempoBaseSegundos','penalizacionTotalSegundos','reincidencias','tiempoFinalSegundos','observaciones','publicado','estado','fechaCreacion','fechaModificacion'],
  PENALIZACIONES: ['numero','modalidad','orden','tipo','segundos','reincidencia','detalle'],
  CLASIFICACION: ['modalidad','pos','numero','fechaCongelado'],
  FIXTURE: ['modalidad','ronda','llave','equipoRojoNumero','equipoRojoDelegacion','equipoAmarilloNumero','equipoAmarilloDelegacion','matchId','fechaCreacion'],
  HISTORIAL: ['fecha','accion','numero','modalidad','matchId','valorAnterior','valorNuevo','detalle'],
  CONFIGURACION: ['clave','valor']
};

const MODALIDAD_PREFIJOS = {
  'GRUPAL MASCULINO':'GRM',
  'GRUPAL FEMENINO':'GRF',
  'GRUPAL MIXTA':'GRX',
  'INDIVIDUAL MASCULINO':'INDM',
  'INDIVIDUAL FEMENINA':'INDF',
  'GRUPAL MASCULINO +50':'GRM50',
  'GRUPAL FEMENINO +50':'GRF50',
  'GRUPAL MIXTA +50':'GRX50',
  'INDIVIDUAL MASCULINO +50':'INDM50',
  'INDIVIDUAL FEMENINA +50':'INDF50'
};

// ---------------------------------------------------------------------------
// PUNTOS DE ENTRADA HTTP
// ---------------------------------------------------------------------------

function doGet(e){
  try{
    const accion = e && e.parameter ? e.parameter.accion : '';
    if(accion === 'bootstrap') return jsonOut(bootstrap());
    if(accion === 'estado') return jsonOut(estado());
    return jsonOut({ok:false, error:'Acción no reconocida: '+accion});
  }catch(err){
    return jsonOut({ok:false, error:'Error del servidor (GET): '+describirError(err)});
  }
}

function doPost(e){
  const lock = LockService.getScriptLock();
  try{
    lock.waitLock(30000);
  }catch(lockErr){
    return jsonOut({ok:false, error:'El servidor está ocupado con otra operación, probá de nuevo en unos segundos.'});
  }
  try{
    if(!e || !e.postData || !e.postData.contents){
      return jsonOut({ok:false, error:'Solicitud sin cuerpo.'});
    }
    const payload = JSON.parse(e.postData.contents);
    const accion = payload.accion;
    let result;
    switch(accion){
      case 'registrar_equipo': result = registrarEquipo(payload, false); break;
      case 'editar_equipo': result = registrarEquipo(payload, true); break;
      case 'eliminar_equipo': result = eliminarEquipo(payload); break;
      case 'guardar_duelo': result = guardarDuelo(payload); break;
      case 'guardar_corroboracion': result = guardarResultado(payload, false); break;
      case 'publicar_resultado': result = guardarResultado(payload, true); break;
      case 'generar_fixture': result = generarFixture(payload); break;
      case 'actualizar_habilitacion': result = actualizarHabilitacion(payload); break;
      default: result = {ok:false, error:'Acción no reconocida: '+accion};
    }
    return jsonOut(result);
  }catch(err){
    return jsonOut({ok:false, error:'Error del servidor (POST): '+describirError(err)});
  }finally{
    lock.releaseLock();
  }
}

function describirError(err){
  return String(err && err.message ? err.message : err);
}

function jsonOut(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// SETUP / MENÚ
// ---------------------------------------------------------------------------

function setup(){
  Object.keys(HEADERS).forEach(function(name){ getOrCreateSheet(name); });
  SpreadsheetApp.getActiveSpreadsheet().toast('Hojas verificadas/creadas correctamente.', 'Copa Integración', 5);
}

function onOpen(){
  SpreadsheetApp.getUi().createMenu('Copa Integración')
    .addItem('Verificar / crear hojas', 'setup')
    .addToUi();
}

// ---------------------------------------------------------------------------
// HELPERS DE HOJAS
// ---------------------------------------------------------------------------

function getSs(){
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getOrCreateSheet(name){
  const ss = getSs();
  let sh = ss.getSheetByName(name);
  if(!sh){
    sh = ss.insertSheet(name);
    sh.appendRow(HEADERS[name]);
    sh.setFrozenRows(1);
  }else if(sh.getLastRow() === 0){
    sh.appendRow(HEADERS[name]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function readAll(name){
  const sh = getOrCreateSheet(name);
  const lastRow = sh.getLastRow();
  if(lastRow < 2) return [];
  const headers = HEADERS[name];
  const values = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const rows = [];
  for(let i = 0; i < values.length; i++){
    const row = values[i];
    const vacia = row.every(function(c){ return c === '' || c === null || c === undefined; });
    if(vacia) continue;
    const obj = {};
    headers.forEach(function(h, idx){ obj[h] = row[idx]; });
    obj.__row = i + 2; // fila real en la hoja (1-based, +1 por encabezado)
    rows.push(obj);
  }
  return rows;
}

function appendRow(name, obj){
  const sh = getOrCreateSheet(name);
  const headers = HEADERS[name];
  const row = headers.map(function(h){ return obj[h] !== undefined ? obj[h] : ''; });
  sh.appendRow(row);
  return sh.getLastRow();
}

function updateRow(name, rowNumber, obj){
  const sh = getOrCreateSheet(name);
  const headers = HEADERS[name];
  headers.forEach(function(h, idx){
    if(obj[h] !== undefined){
      sh.getRange(rowNumber, idx + 1).setValue(obj[h]);
    }
  });
}

function deleteRows(name, rows){
  // Borra de abajo hacia arriba para no correr los números de fila de las
  // filas que todavía no se borraron.
  const sh = getOrCreateSheet(name);
  rows.slice().sort(function(a, b){ return b.__row - a.__row; })
    .forEach(function(r){ sh.deleteRow(r.__row); });
}

function safeParseArray(v){
  if(Array.isArray(v)) return v;
  if(typeof v !== 'string' || !v) return [];
  try{
    const p = JSON.parse(v);
    return Array.isArray(p) ? p : [];
  }catch(e){
    return [];
  }
}

function prefijoModalidad(m){
  if(MODALIDAD_PREFIJOS[m]) return MODALIDAD_PREFIJOS[m];
  return String(m).replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() || 'MOD';
}

// ---------------------------------------------------------------------------
// CONFIGURACIÓN / CONTADORES (para matchId secuencial)
// ---------------------------------------------------------------------------

function siguienteContador(clave){
  const rows = readAll('CONFIGURACION');
  const existente = rows.find(function(r){ return r.clave === clave; });
  let siguiente;
  if(existente){
    siguiente = (Number(existente.valor) || 0) + 1;
    updateRow('CONFIGURACION', existente.__row, {clave: clave, valor: siguiente});
  }else{
    siguiente = 1;
    appendRow('CONFIGURACION', {clave: clave, valor: siguiente});
  }
  return siguiente;
}

// ---------------------------------------------------------------------------
// HISTORIAL
// ---------------------------------------------------------------------------

function registrarHistorial(accion, numero, modalidad, matchId, valorAnterior, valorNuevo, detalle){
  appendRow('HISTORIAL', {
    fecha: new Date(),
    accion: accion || '',
    numero: numero || '',
    modalidad: modalidad || '',
    matchId: matchId || '',
    valorAnterior: valorAnterior || '',
    valorNuevo: valorNuevo || '',
    detalle: detalle || ''
  });
}

// ---------------------------------------------------------------------------
// EQUIPOS / PARTICIPANTES
// ---------------------------------------------------------------------------

function registrarEquipo(payload, esEdicion){
  const numero = Number(payload.numero);
  if(!numero || numero <= 0 || !Number.isInteger(numero)){
    return {ok:false, error:'Número de equipo inválido.'};
  }
  const delegacion = String(payload.delegacion || '').trim();
  if(!delegacion){
    return {ok:false, error:'Falta la delegación.'};
  }
  const capitan = String(payload.capitan || '').trim();
  const modalidades = Array.isArray(payload.modalidades) ? payload.modalidades : [];
  const integrantesPorModalidad = payload.integrantesPorModalidad || {};

  const equipos = readAll('EQUIPOS');
  const existente = equipos.find(function(e){ return Number(e.numero) === numero; });
  if(existente && !esEdicion){
    return {ok:false, error:'Ya existe un equipo con el número ' + numero + '.'};
  }
  if(!existente && esEdicion){
    return {ok:false, error:'No existe el equipo ' + numero + ' para editar.'};
  }

  const ahora = new Date();
  const valorAnterior = existente ? (existente.delegacion + ' / ' + existente.modalidades) : '';
  const registro = {
    numero: numero,
    delegacion: delegacion,
    capitan: capitan,
    capitanCompite: !!payload.capitanCompite,
    modalidades: JSON.stringify(modalidades),
    estadoHabilitacion: existente ? existente.estadoHabilitacion : 'PENDIENTE',
    fechaCreacion: existente ? existente.fechaCreacion : ahora,
    fechaModificacion: ahora
  };
  if(existente){
    updateRow('EQUIPOS', existente.__row, registro);
  }else{
    appendRow('EQUIPOS', registro);
  }

  reemplazarParticipantesDeEquipo(numero, integrantesPorModalidad);

  registrarHistorial(
    esEdicion ? 'Equipo editado' : 'Equipo registrado',
    numero, '', '', valorAnterior, delegacion + ' / ' + modalidades.join(', '), ''
  );
  return {ok:true};
}

function reemplazarParticipantesDeEquipo(numero, integrantesPorModalidad){
  eliminarParticipantesDeEquipo(numero);
  Object.keys(integrantesPorModalidad || {}).forEach(function(modalidad){
    const lista = integrantesPorModalidad[modalidad] || [];
    lista.forEach(function(persona, idx){
      appendRow('PARTICIPANTES', {
        equipoNumero: numero,
        modalidad: modalidad,
        orden: idx + 1,
        nombre: persona.nombre || '',
        sexo: persona.sexo || '',
        edad: persona.edad || ''
      });
    });
  });
}

function eliminarParticipantesDeEquipo(numero){
  const rows = readAll('PARTICIPANTES').filter(function(r){ return Number(r.equipoNumero) === numero; });
  deleteRows('PARTICIPANTES', rows);
}

function eliminarEquipo(payload){
  const numero = Number(payload.numero);
  const equipos = readAll('EQUIPOS');
  const existente = equipos.find(function(e){ return Number(e.numero) === numero; });
  if(!existente){
    return {ok:false, error:'No existe el equipo ' + numero + '.'};
  }
  deleteRows('EQUIPOS', [existente]);
  eliminarParticipantesDeEquipo(numero);

  const resultados = readAll('RESULTADOS').filter(function(r){ return Number(r.numero) === numero; });
  resultados.forEach(function(r){ eliminarPenalizacionesDe(numero, r.modalidad); });
  deleteRows('RESULTADOS', resultados);

  registrarHistorial('Equipo eliminado', numero, '', '', existente.delegacion, '', '');
  return {ok:true};
}

function actualizarHabilitacion(payload){
  const numero = Number(payload.numero);
  const estado = String(payload.estadoHabilitacion || '').trim();
  const validos = ['PENDIENTE','DOCUMENTACION_OK','CONTROL_MEDICO_OK','HABILITADO','NO_HABILITADO'];
  if(validos.indexOf(estado) === -1){
    return {ok:false, error:'Estado de habilitación inválido.'};
  }
  const equipos = readAll('EQUIPOS');
  const existente = equipos.find(function(e){ return Number(e.numero) === numero; });
  if(!existente){
    return {ok:false, error:'No existe el equipo ' + numero + '.'};
  }
  const anterior = existente.estadoHabilitacion;
  updateRow('EQUIPOS', existente.__row, {estadoHabilitacion: estado, fechaModificacion: new Date()});
  registrarHistorial('Habilitación actualizada', numero, '', '', anterior, estado, '');
  return {ok:true};
}

// ---------------------------------------------------------------------------
// ENFRENTAMIENTOS (matchId persistente)
// ---------------------------------------------------------------------------

function obtenerOCrearEnfrentamiento(modalidad, ronda, numRojo, numAmarillo){
  const rows = readAll('ENFRENTAMIENTOS');
  const existente = rows.find(function(r){
    return r.modalidad === modalidad && r.ronda === ronda &&
      ((Number(r.equipoRojo) === numRojo && Number(r.equipoAmarillo) === numAmarillo) ||
       (Number(r.equipoRojo) === numAmarillo && Number(r.equipoAmarillo) === numRojo));
  });
  if(existente) return existente.matchId;

  const contador = siguienteContador('matchId:' + modalidad + ':' + ronda);
  const matchId = prefijoModalidad(modalidad) + '-' + ronda + '-' + String(contador).padStart(3, '0');
  appendRow('ENFRENTAMIENTOS', {
    matchId: matchId,
    modalidad: modalidad,
    ronda: ronda,
    equipoRojo: numRojo,
    equipoAmarillo: numAmarillo,
    estado: 'pendiente',
    fechaCreacion: new Date()
  });
  return matchId;
}

// ---------------------------------------------------------------------------
// RESULTADOS / PENALIZACIONES
// ---------------------------------------------------------------------------

function guardarDuelo(payload){
  const modalidad = String(payload.modalidad || '').trim();
  if(!modalidad) return {ok:false, error:'Falta la modalidad.'};
  const a = payload.a, b = payload.b;
  if(!a || !b) return {ok:false, error:'Faltan los datos de los dos equipos.'};
  const numRojo = Number(a.numero), numAmarillo = Number(b.numero);
  if(!numRojo || !numAmarillo){
    return {ok:false, error:'Números de equipo inválidos.'};
  }
  const ronda = String(payload.ronda || 'R1').trim();
  const matchId = obtenerOCrearEnfrentamiento(modalidad, ronda, numRojo, numAmarillo);

  guardarParticipacion(numRojo, modalidad, matchId, 'ROJO', a, false);
  guardarParticipacion(numAmarillo, modalidad, matchId, 'AMARILLO', b, false);

  registrarHistorial('Duelo guardado', numRojo, modalidad, matchId, '', '', 'vs #' + numAmarillo);
  return {ok:true, matchId: matchId};
}

function guardarResultado(payload, publicar){
  const numero = Number(payload.numero);
  const modalidad = String(payload.modalidad || '').trim();
  if(!numero || !modalidad){
    return {ok:false, error:'Faltan número de equipo o modalidad.'};
  }
  guardarParticipacion(numero, modalidad, null, null, payload, publicar);
  return {ok:true};
}

function guardarParticipacion(numero, modalidad, matchId, sector, datos, publicar){
  const resultados = readAll('RESULTADOS');
  const existente = resultados.find(function(r){
    return Number(r.numero) === numero && r.modalidad === modalidad;
  });

  const tiempoBase = Number(datos.tiempoSegundos) || 0;
  const penalizaciones = Array.isArray(datos.penalizaciones) ? datos.penalizaciones : [];
  const penalizacionTotal = penalizaciones.reduce(function(s, p){ return s + (Number(p.segundos) || 0); }, 0);
  const tiempoFinal = tiempoBase + penalizacionTotal;
  const ahora = new Date();
  const valorAnteriorFinal = existente ? Number(existente.tiempoFinalSegundos) : null;

  const registro = {
    numero: numero,
    modalidad: modalidad,
    matchId: matchId || (existente ? existente.matchId : ''),
    sector: sector || (existente ? existente.sector : ''),
    tiempoBaseSegundos: tiempoBase,
    penalizacionTotalSegundos: penalizacionTotal,
    reincidencias: penalizaciones.length,
    tiempoFinalSegundos: tiempoFinal,
    observaciones: datos.observaciones || '',
    publicado: publicar ? true : (existente ? !!existente.publicado : false),
    estado: publicar ? 'publicado' : 'pendiente',
    fechaCreacion: existente ? existente.fechaCreacion : ahora,
    fechaModificacion: ahora
  };
  if(existente){
    updateRow('RESULTADOS', existente.__row, registro);
  }else{
    appendRow('RESULTADOS', registro);
  }

  eliminarPenalizacionesDe(numero, modalidad);
  penalizaciones.forEach(function(p, idx){
    appendRow('PENALIZACIONES', {
      numero: numero,
      modalidad: modalidad,
      orden: idx + 1,
      tipo: p.tipo || '',
      segundos: Number(p.segundos) || 0,
      reincidencia: !!p.reincidencia,
      detalle: p.detalle || ''
    });
  });

  const accionHist = publicar ? 'Resultado publicado' : (existente ? 'Resultado corroborado/editado' : 'Resultado cargado');
  registrarHistorial(
    accionHist, numero, modalidad, registro.matchId,
    valorAnteriorFinal !== null ? String(valorAnteriorFinal) : '',
    String(tiempoFinal), ''
  );
}

function eliminarPenalizacionesDe(numero, modalidad){
  const rows = readAll('PENALIZACIONES').filter(function(r){
    return Number(r.numero) === numero && r.modalidad === modalidad;
  });
  deleteRows('PENALIZACIONES', rows);
}

// ---------------------------------------------------------------------------
// FIXTURE / CLASIFICACIÓN (Top 8 — Art. 15 del reglamento)
// ---------------------------------------------------------------------------

function generarFixture(payload){
  const modalidad = String(payload.modalidad || '').trim();
  if(!modalidad) return {ok:false, error:'Falta la modalidad.'};

  const resultados = readAll('RESULTADOS').filter(function(r){
    return r.modalidad === modalidad && r.publicado &&
      String(r.observaciones || '').trim().toUpperCase().indexOf('[DESCALIFICADO]') !== 0;
  });
  if(!resultados.length){
    return {ok:false, error:'No hay resultados publicados en esta modalidad todavía.'};
  }
  const equipos = readAll('EQUIPOS');
  const porTiempo = resultados.slice().sort(function(x, y){
    return Number(x.tiempoFinalSegundos) - Number(y.tiempoFinalSegundos);
  });
  const top8 = porTiempo.slice(0, 8);

  // Congela la clasificación (Art. 15): mejores tiempos disponibles en este momento.
  const clasExistente = readAll('CLASIFICACION').filter(function(r){ return r.modalidad === modalidad; });
  deleteRows('CLASIFICACION', clasExistente);
  top8.forEach(function(r, i){
    appendRow('CLASIFICACION', {modalidad: modalidad, pos: i + 1, numero: r.numero, fechaCongelado: new Date()});
  });

  // Emparejamiento de cuartos según reglamento: 1º-8º, 4º-5º, 3º-6º, 7º-2º.
  function pos(p){ return top8[p - 1] || null; }
  const llaves = [
    {llave: 1, rojoPos: 1, amarilloPos: 8},
    {llave: 2, rojoPos: 4, amarilloPos: 5},
    {llave: 3, rojoPos: 3, amarilloPos: 6},
    {llave: 4, rojoPos: 7, amarilloPos: 2}
  ];

  const fixExistente = readAll('FIXTURE').filter(function(r){
    return r.modalidad === modalidad && r.ronda === 'CUARTOS';
  });
  deleteRows('FIXTURE', fixExistente);

  let creadas = 0;
  llaves.forEach(function(k){
    const rojo = pos(k.rojoPos), amarillo = pos(k.amarilloPos);
    const equipoRojo = rojo ? equipos.find(function(e){ return Number(e.numero) === Number(rojo.numero); }) : null;
    const equipoAmarillo = amarillo ? equipos.find(function(e){ return Number(e.numero) === Number(amarillo.numero); }) : null;
    let matchId = '';
    if(rojo && amarillo){
      matchId = obtenerOCrearEnfrentamiento(modalidad, 'CUARTOS', Number(rojo.numero), Number(amarillo.numero));
    }
    appendRow('FIXTURE', {
      modalidad: modalidad,
      ronda: 'CUARTOS',
      llave: k.llave,
      equipoRojoNumero: rojo ? rojo.numero : '',
      equipoRojoDelegacion: equipoRojo ? equipoRojo.delegacion : '',
      equipoAmarilloNumero: amarillo ? amarillo.numero : '',
      equipoAmarilloDelegacion: equipoAmarillo ? equipoAmarillo.delegacion : '',
      matchId: matchId,
      fechaCreacion: new Date()
    });
    creadas++;
  });

  registrarHistorial('Fixture generado', '', modalidad, '', '', '', 'Top 8 congelado, ' + creadas + ' llaves de cuartos armadas');
  return {ok:true, llaves: creadas};
}

// ---------------------------------------------------------------------------
// LECTURA (bootstrap / estado) — reconstruye las formas que espera el frontend
// ---------------------------------------------------------------------------

function construirEquipos(){
  const equipos = readAll('EQUIPOS');
  const participantes = readAll('PARTICIPANTES');
  return equipos.map(function(e){
    const modalidades = safeParseArray(e.modalidades);
    const integrantesPorModalidad = {};
    modalidades.forEach(function(m){
      integrantesPorModalidad[m] = participantes
        .filter(function(p){ return Number(p.equipoNumero) === Number(e.numero) && p.modalidad === m; })
        .sort(function(a, b){ return Number(a.orden) - Number(b.orden); })
        .map(function(p){ return {nombre: p.nombre, sexo: p.sexo, edad: p.edad}; });
    });
    return {
      numero: e.numero,
      delegacion: e.delegacion,
      capitan: e.capitan,
      capitanCompite: !!e.capitanCompite,
      modalidades: modalidades,
      integrantesPorModalidad: integrantesPorModalidad,
      estadoHabilitacion: e.estadoHabilitacion || 'PENDIENTE'
    };
  });
}

function construirParticipaciones(){
  const resultados = readAll('RESULTADOS');
  const equipos = readAll('EQUIPOS');
  const participantes = readAll('PARTICIPANTES');
  const penalizaciones = readAll('PENALIZACIONES');
  return resultados.map(function(r){
    const equipo = equipos.find(function(e){ return Number(e.numero) === Number(r.numero); });
    const integrantes = participantes
      .filter(function(p){ return Number(p.equipoNumero) === Number(r.numero) && p.modalidad === r.modalidad; })
      .sort(function(a, b){ return Number(a.orden) - Number(b.orden); })
      .map(function(p){ return {nombre: p.nombre, sexo: p.sexo, edad: p.edad}; });
    const pens = penalizaciones
      .filter(function(p){ return Number(p.numero) === Number(r.numero) && p.modalidad === r.modalidad; })
      .sort(function(a, b){ return Number(a.orden) - Number(b.orden); })
      .map(function(p){ return {tipo: p.tipo, segundos: p.segundos, reincidencia: !!p.reincidencia, detalle: p.detalle}; });
    return {
      numero: r.numero,
      delegacion: equipo ? equipo.delegacion : '',
      capitan: equipo ? equipo.capitan : '',
      modalidad: r.modalidad,
      integrantes: integrantes,
      tiempoBaseSegundos: r.tiempoBaseSegundos,
      penalizaciones: pens,
      penalizacionTotalSegundos: r.penalizacionTotalSegundos,
      reincidencias: r.reincidencias,
      tiempoFinalSegundos: r.tiempoFinalSegundos,
      observaciones: r.observaciones,
      publicado: !!r.publicado,
      estado: r.estado,
      matchId: r.matchId,
      sector: r.sector
    };
  });
}

function construirFixture(){
  return readAll('FIXTURE').map(function(f){
    return {
      modalidad: f.modalidad,
      ronda: f.ronda,
      llave: f.llave,
      equipoA: f.equipoRojoNumero,
      delegacionA: f.equipoRojoDelegacion,
      equipoB: f.equipoAmarilloNumero,
      delegacionB: f.equipoAmarilloDelegacion,
      matchId: f.matchId
    };
  });
}

function construirHistorial(){
  const todo = readAll('HISTORIAL');
  const ultimos = todo.slice(Math.max(0, todo.length - 300));
  return ultimos.map(function(h){
    return {
      fecha: h.fecha,
      accion: h.accion,
      numero: h.numero,
      modalidad: h.modalidad,
      matchId: h.matchId,
      valorAnterior: h.valorAnterior,
      valorNuevo: h.valorNuevo,
      detalle: h.detalle
    };
  });
}

function bootstrap(){
  return {
    ok: true,
    equipos: construirEquipos(),
    participaciones: construirParticipaciones(),
    historial: construirHistorial(),
    fixture: construirFixture()
  };
}

function estado(){
  return {
    ok: true,
    equipos: construirEquipos(),
    participaciones: construirParticipaciones(),
    fixture: construirFixture()
  };
}
