/* Prototipo del panel de la barbería. Datos de ejemplo (en la app salen de /panel/*). */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const pesos = (n) => '$ ' + n.toLocaleString('es-AR');
const min = (t) => { const [h, m] = t.split(':'); return +h * 60 + +m; };
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const corto = (t) => t.replace(/^0/, '').replace(':00', '');
const ini = (n) => n.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DIAS_C = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DIAS_L = ['los lunes', 'los martes', 'los miércoles', 'los jueves', 'los viernes', 'los sábados', 'los domingos'];
const HOY = 2;          // miércoles
const AHORA = min('16:00');

/* ── Datos ── */
const SHOP = { nombre: 'La Navaja', slug: 'la-navaja', color: '#c9a46a', direccion: 'Calle 8 e/ 49 y 50', barrio: 'Centro', descripcion: 'Cortes clásicos y degradés en el centro de La Plata.', cancel: 3 };
const REGLA = { cada: 5, tipo: 'servicio_gratis', valor: 's1', texto: '' };
let BARBEROS = [
  { id: 'b1', nombre: 'Martín Sosa', activo: true, franjas: [{ desde: '10:00', hasta: '13:00', dias: [0, 1, 2, 3, 4] }, { desde: '16:00', hasta: '20:00', dias: [0, 1, 2, 3, 4] }, { desde: '10:00', hasta: '15:00', dias: [5] }], libres: [] },
  { id: 'b2', nombre: 'Lucas Ferreyra', activo: true, franjas: [{ desde: '11:00', hasta: '20:00', dias: [1, 2, 3, 4, 5] }], libres: [{ desde: '2026-11-10', hasta: '2026-11-14' }] },
  { id: 'b3', nombre: 'Tomás Ibarra', activo: true, franjas: [{ desde: '10:00', hasta: '19:00', dias: [0, 1, 2, 3, 4, 5] }], libres: [] },
  { id: 'b4', nombre: 'Ramiro Paz', activo: false, franjas: [], libres: [] },
];
let SERVICIOS = [
  { id: 's1', nombre: 'Corte', precio: 12000, min: 30, activo: true, barberos: ['b1', 'b2', 'b3'] },
  { id: 's2', nombre: 'Corte + barba', precio: 14500, min: 45, activo: true, barberos: ['b1', 'b2', 'b3'] },
  { id: 's3', nombre: 'Barba', precio: 7000, min: 20, activo: true, barberos: ['b1', 'b2', 'b3'] },
  { id: 's4', nombre: 'Perfilado de cejas', precio: 4000, min: 15, activo: true, barberos: ['b1', 'b3'] },
];
let CLIENTES = [
  { id: 'c1', nombre: 'Nicolás Rojas', tel: '2214567890', visitas: 14, ausencias: 0, cortes: 4, usados: 2, premio: false, bloq: false },
  { id: 'c2', nombre: 'Facundo Díaz', tel: '2215551234', visitas: 6, ausencias: 1, cortes: 0, usados: 1, premio: true, bloq: false },
  { id: 'c3', nombre: 'Agustín Pérez', tel: '2216012345', visitas: 3, ausencias: 0, cortes: 3, usados: 0, premio: false, bloq: false },
  { id: 'c4', nombre: 'Julián Romero', tel: '2219876543', visitas: 9, ausencias: 2, cortes: 2, usados: 1, premio: false, bloq: false },
  { id: 'c5', nombre: 'Bruno Medina', tel: '2213332211', visitas: 1, ausencias: 3, cortes: 1, usados: 0, premio: false, bloq: false },
];
let TURNOS = [
  { id: 't1', b: 'b1', hora: '10:00', cli: 'c3', serv: 's1', precio: 12000, estado: 'asistio', premio: false },
  { id: 't2', b: 'b1', hora: '11:00', cli: 'c4', serv: 's2', precio: 14500, estado: 'asistio', premio: false },
  { id: 't3', b: 'b1', hora: '16:15', cli: 'c1', serv: 's1', precio: 12000, estado: 'reservado', premio: false },
  { id: 't4', b: 'b1', hora: '18:00', cli: 'c2', serv: 's2', precio: 14500, estado: 'reservado', premio: false },
  { id: 't5', b: 'b2', hora: '11:30', cli: 'c5', serv: 's1', precio: 12000, estado: 'no_asistio', premio: false },
  { id: 't6', b: 'b2', hora: '17:00', cli: 'c4', serv: 's3', precio: 7000, estado: 'reservado', premio: false },
  { id: 't7', b: 'b3', hora: '12:00', cli: 'c3', serv: 's4', precio: 4000, estado: 'asistio', premio: false },
  { id: 't8', b: 'b3', hora: '16:30', cli: 'c2', serv: 's1', precio: 12000, estado: 'reservado', premio: false },
];
let BLOQUEOS = [{ b: 'b3', desde: '13:00', hasta: '14:00', motivo: 'Almuerzo' }];
const srv = (id) => SERVICIOS.find((s) => s.id === id);
const barb = (id) => BARBEROS.find((b) => b.id === id);
const cli = (id) => CLIENTES.find((c) => c.id === id);
const finDe = (t) => min(t.hora) + srv(t.serv).min;
const premioTxt = () => (REGLA.tipo === 'servicio_gratis' ? `${srv(REGLA.valor)?.nombre || 'Servicio'} gratis` : REGLA.tipo === 'descuento_pct' ? `${REGLA.valor}% off` : REGLA.tipo === 'descuento_monto' ? `${pesos(+REGLA.valor || 0)} off` : REGLA.texto || 'Premio');

/* Horario en una línea: "Lun a Vie 10 a 13 y 16 a 20 · Sáb 10 a 15" */
function resumen(franjas) {
  const porDia = DIAS.map((_, d) => franjas.filter((f) => f.dias.includes(d)).sort((a, b) => min(a.desde) - min(b.desde)).map((f) => `${corto(f.desde)} a ${corto(f.hasta)}`).join(' y '));
  const g = [];
  porDia.forEach((txt, d) => { if (!txt) return; const u = g.at(-1); if (u && u.txt === txt && u.hasta === d - 1) u.hasta = d; else g.push({ desde: d, hasta: d, txt }); });
  return g.length ? g.map((x) => `${x.desde === x.hasta ? DIAS_C[x.desde] : `${DIAS_C[x.desde]} a ${DIAS_C[x.hasta]}`} ${x.txt}`).join(' · ') : 'Sin horario cargado';
}
const horasSemana = (franjas) => { const t = franjas.reduce((a, f) => a + Math.max(0, min(f.hasta) - min(f.desde)) * f.dias.length, 0); return t ? `${Math.floor(t / 60)} h${t % 60 ? ` ${t % 60} min` : ''} por semana` : ''; };

/* 7 segmentos */
const SEG = { a: 'M14 4h52l-8 8H22z', b: 'M68 6l8 8v42l-8 4-8-8V14z', c: 'M68 64l8 4v42l-8 8-8-8V72z', d: 'M22 112h36l8 8H14z', e: 'M12 64l8 8v38l-8 8-8-8V68z', f: 'M12 6l8 8v38l-8 8-8-4V14z', g: 'M20 58h40l6 4-6 4H20l-6-4z' };
const MAP = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg'];
function seg(txt) {
  return `<span class="seg" aria-hidden="true">${[...txt].map((c) => (c === ':' ? '<svg viewBox="0 0 16 124"><circle cx="8" cy="42" r="6" class="on"/><circle cx="8" cy="84" r="6" class="on"/></svg>'
    : c === '.' ? '<svg viewBox="0 0 16 124"><circle cx="8" cy="114" r="6" class="on"/></svg>'
    : `<svg viewBox="0 0 80 124">${Object.entries(SEG).map(([k, p]) => `<path d="${p}" class="${/\d/.test(c) && MAP[c].includes(k) ? 'on' : 'off'}"/>`).join('')}</svg>`)).join('')}</span>`;
}

/* ── Aviso (con Deshacer opcional) ── */
let avisoT;
function aviso(txt, deshacer) {
  const a = $('#aviso'); $('#aviso-txt').textContent = txt;
  $('#aviso-btn').hidden = !deshacer; $('#aviso-btn').onclick = () => { deshacer(); a.hidePopover?.(); };
  try { a.hidePopover(); a.showPopover(); } catch { a.setAttribute('open', ''); }
  clearTimeout(avisoT); avisoT = setTimeout(() => { try { a.hidePopover(); } catch {} }, deshacer ? 8000 : 3500);
}

/* ── Navegación ── */
const VISTAS = [['hoy', 'Hoy', 'i-hoy'], ['barberos', 'Barberos', 'i-barberos'], ['servicios', 'Servicios', 'i-tijera'], ['clientes', 'Clientes', 'i-clientes'], ['numeros', 'Números', 'i-numeros'], ['pagina', 'Mi página', 'i-pagina']];
function nav() {
  const v = location.hash.slice(1) || 'hoy';
  const a = (x) => `<a href="#${x[0]}" ${x[0] === v ? 'aria-current="page"' : ''}><svg class="i" aria-hidden="true"><use href="#${x[2]}"/></svg>${x[1]}</a>`;
  $('#nav-lado').innerHTML = `<div class="b"><span>Panel de</span><b class="cond">${esc(SHOP.nombre)}</b></div>${VISTAS.map(a).join('')}<a href="ingresar.html" class="salir"><svg class="i" aria-hidden="true"><use href="#i-salir"/></svg>Salir</a>`;
  $('#nav-abajo').innerHTML = VISTAS.map((x) => a(x[0] === 'pagina' ? [x[0], 'Página', x[2]] : x)).join('');
  return v;
}
function tira() {
  const prox = TURNOS.filter((t) => t.estado === 'reservado' && min(t.hora) >= AHORA).sort((a, b) => min(a.hora) - min(b.hora))[0];
  $('#tira').innerHTML = prox ? `<div><small>Próximo</small>${seg(prox.hora)}</div><div class="quien">${esc(cli(prox.cli).nombre)} con ${esc(barb(prox.b).nombre.split(' ')[0])}<span>${esc(srv(prox.serv).nombre)} · ${pesos(prox.precio)}</span></div>`
    : '<div class="quien">No quedan turnos por hoy.</div>';
  $('#tira').setAttribute('aria-label', prox ? `Próximo turno: ${prox.hora}, ${cli(prox.cli).nombre} con ${barb(prox.b).nombre}` : 'No quedan turnos por hoy');
}
function render() { const v = nav(); tira(); ({ hoy, barberos, servicios, clientes, numeros, pagina })[v]?.(); }
addEventListener('hashchange', () => { render(); scrollTo(0, 0); });

/* ═══ HOY: la grilla ═══ */
let filtro = 'todos';
function hoy() {
  const hechos = TURNOS.filter((t) => t.estado === 'asistio');
  const activos = BARBEROS.filter((b) => b.activo);
  const ver = filtro === 'todos' ? activos : activos.filter((b) => b.id === filtro);
  $('#main').innerHTML = `
    <div class="titulo"><h1 class="cond">Hoy</h1><p>Miércoles 21 de octubre · Marcá quién vino: suma a la caja y a su tarjeta de cortes.</p></div>
    <div class="tablero">
      <div class="dato"><small>Facturado</small><b>${pesos(hechos.reduce((a, t) => a + (t.premio ? 0 : t.precio), 0))}</b></div>
      <div class="dato"><small>Cortes</small><b>${hechos.length}</b></div>
      <div class="dato"><small>Faltan</small><b>${TURNOS.filter((t) => t.estado === 'reservado').length}</b></div>
      <div class="dato"><small>No vinieron</small><b>${TURNOS.filter((t) => t.estado === 'no_asistio').length}</b></div>
    </div>
    <div class="elegir" role="group" aria-label="Qué barbero ver">${[['todos', 'Todos'], ...activos.map((b) => [b.id, b.nombre.split(' ')[0]])].map(([id, n]) => `<button class="chip" type="button" data-filtro="${id}" aria-pressed="${filtro === id}">${esc(n)}</button>`).join('')}</div>
    <div class="cols ${filtro === 'todos' ? 'todos' : ''}" style="--n:${ver.length}">${ver.map(columna).join('')}</div>`;
}
function columna(b) {
  const tramos = b.franjas.filter((f) => f.dias.includes(HOY)).sort((x, y) => min(x.desde) - min(y.desde));
  const ocup = [...TURNOS.filter((t) => t.b === b.id).map((t) => ({ k: 't', t, d: min(t.hora), h: finDe(t) })), ...BLOQUEOS.filter((x) => x.b === b.id).map((x) => ({ k: 'b', x, d: min(x.desde), h: min(x.hasta) }))].sort((p, q) => p.d - q.d);
  const items = [];
  tramos.forEach((f) => {
    let c = min(f.desde);
    ocup.filter((o) => o.d < min(f.hasta) && o.h > min(f.desde)).forEach((o) => { if (o.d - c >= 30) items.push({ k: 'l', d: c, h: o.d }); items.push(o); c = Math.max(c, o.h); });
    if (min(f.hasta) - c >= 30) items.push({ k: 'l', d: c, h: min(f.hasta) });
  });
  const vistos = new Set();
  const html = items.filter((o) => (o.k === 'l' ? true : !vistos.has(o) && vistos.add(o))).map((o) => {
    if (o.k === 'b') return `<li class="bloqueo"><span>${corto(o.x.desde)} a ${corto(o.x.hasta)} · ${esc(o.x.motivo)}</span><button class="link" type="button" data-desbloq="${b.id}|${o.x.desde}">Desbloquear</button></li>`;
    if (o.k === 'l') return o.h <= AHORA ? '' : `<li class="libre"><span>Libre ${corto(hhmm(Math.max(o.d, AHORA - AHORA % 15)))} a ${corto(hhmm(o.h))}</span><button class="link" type="button" data-nuevo="${b.id}|${hhmm(Math.max(o.d, AHORA - AHORA % 15))}"><svg class="i" aria-hidden="true"><use href="#i-mas"/></svg>Turno</button></li>`;
    const t = o.t, c = cli(t.cli), s = srv(t.serv);
    const sello = t.estado === 'reservado' && c.premio ? `<span class="sello"><svg class="i" aria-hidden="true"><use href="#i-regalo"/></svg>Tiene ${esc(premioTxt())}</span>`
      : t.estado === 'reservado' && c.cortes === REGLA.cada - 1 ? '<span class="sello completa">Con este corte completa la tarjeta</span>' : '';
    const marca = t.estado === 'asistio' ? `<span class="marca">${t.premio ? 'Premio' : 'Asistió'}</span>` : t.estado === 'no_asistio' ? '<span class="marca">No vino</span>' : '';
    return `<li class="turno ${t.estado}"><span class="h">${t.hora}<small>a ${hhmm(finDe(t))}</small></span>
      <span><span class="c">${esc(c.nombre)}${marca}</span><br><span class="s">${esc(s.nombre)} · ${t.premio ? 'gratis' : pesos(t.precio)}</span></span>${sello}
      <span class="acc">${t.estado === 'reservado' ? `<button class="btn chico" type="button" data-asistio="${t.id}">Asistió</button><button class="btn sec chico" type="button" data-falto="${t.id}">No vino</button>`
        : `<button class="link" type="button" data-deshacer="${t.id}">Corregir</button>`}</span></li>`;
  }).join('');
  return `<section class="col"><h2 class="cond">${esc(b.nombre.split(' ')[0])}<small>${tramos.map((f) => `${corto(f.desde)} a ${corto(f.hasta)}`).join(' y ') || 'No trabaja hoy'}</small></h2>
    <ul class="items">${html || '<li class="vacio">Hoy no trabaja.</li>'}</ul></section>`;
}
function marcar(t, estado, conPremio = false) {
  const antes = JSON.stringify({ t, c: cli(t.cli) });
  const c = cli(t.cli);
  t.estado = estado; t.premio = conPremio;
  if (estado === 'asistio') {
    if (conPremio) { c.premio = false; c.usados++; }
    else { c.cortes++; if (c.cortes >= REGLA.cada) { c.cortes = 0; c.premio = true; } }
    c.visitas++;
  } else c.ausencias++;
  render();
  aviso(estado === 'asistio' ? (conPremio ? `${c.nombre.split(' ')[0]} usó su premio.` : c.premio && !conPremio && c.cortes === 0 ? `¡${c.nombre.split(' ')[0]} completó la tarjeta! La próxima tiene ${premioTxt()}.` : `${c.nombre.split(' ')[0]} vino. Tachamos una tijera.`) : `${c.nombre.split(' ')[0]} no vino.`, () => {
    const prev = JSON.parse(antes); Object.assign(t, prev.t); Object.assign(cli(t.cli), prev.c); render();
  });
}
document.addEventListener('click', (e) => {
  const d = e.target.closest('[data-filtro],[data-asistio],[data-falto],[data-deshacer],[data-nuevo],[data-desbloq]'); if (!d) return;
  if (d.dataset.filtro) { filtro = d.dataset.filtro; hoy(); }
  else if (d.dataset.asistio) {
    const t = TURNOS.find((x) => x.id === d.dataset.asistio), c = cli(t.cli);
    if (c.premio) abrirHoja({ titulo: 'Tiene el premio', ok: 'Aplicar premio', cancelar: 'Ahora no', cuerpo: `<p style="font:600 18px/1.4 Archivo">${esc(c.nombre)} completó su tarjeta. ¿Le aplicás <b>${esc(premioTxt())}</b> en este turno?</p><span class="sello" style="justify-self:start"><svg class="i" aria-hidden="true"><use href="#i-regalo"/></svg>${esc(premioTxt())}</span>`,
      guardar: () => { marcar(t, 'asistio', true); return true; }, alCancelar: () => marcar(t, 'asistio', false) });
    else marcar(t, 'asistio');
  } else if (d.dataset.falto) marcar(TURNOS.find((x) => x.id === d.dataset.falto), 'no_asistio');
  else if (d.dataset.deshacer) { const t = TURNOS.find((x) => x.id === d.dataset.deshacer); const c = cli(t.cli); if (t.estado === 'asistio') { if (t.premio) { c.premio = true; c.usados--; } else c.cortes = Math.max(0, c.cortes - 1); c.visitas--; } else c.ausencias--; t.estado = 'reservado'; t.premio = false; render(); }
  else if (d.dataset.nuevo) turnoAMano(...d.dataset.nuevo.split('|'));
  else if (d.dataset.desbloq) { const [b, desde] = d.dataset.desbloq.split('|'); const x = BLOQUEOS.find((y) => y.b === b && y.desde === desde); BLOQUEOS = BLOQUEOS.filter((y) => y !== x); render(); aviso('Horario desbloqueado.', () => { BLOQUEOS.push(x); render(); }); }
});

function telefono(v) { let d = v.replace(/\D/g, ''); if (d.startsWith('54')) d = d.slice(2); if (d.startsWith('9') && d.length === 11) d = d.slice(1); if (d.startsWith('0')) d = d.slice(1); return d.length === 10 ? d : null; }
function turnoAMano(bid, hora) {
  const b = barb(bid);
  abrirHoja({
    titulo: 'Turno a mano', ok: 'Cargar turno',
    cuerpo: `<section class="bloque"><h3 class="cond">Hoy ${corto(hora)} con ${esc(b.nombre.split(' ')[0])}</h3>
      <label class="campo">Servicio<select id="t-serv">${SERVICIOS.filter((s) => s.activo && s.barberos.includes(bid)).map((s) => `<option value="${s.id}">${esc(s.nombre)} · ${s.min} min · ${pesos(s.precio)}</option>`).join('')}</select></label>
      <label class="campo" id="c-t-nom">Nombre del cliente<input id="t-nom" autocomplete="off" aria-describedby="e-t-nom" /><span class="err" id="e-t-nom" hidden></span></label>
      <label class="campo" id="c-t-tel">Teléfono<span class="prefijo"><span aria-hidden="true">+54 9</span><input id="t-tel" type="tel" inputmode="tel" autocomplete="off" aria-describedby="a-t-tel e-t-tel" /></span>
        <span class="ayuda" id="a-t-tel">Con código de área, sin 0 ni 15. Así le suman los cortes a su tarjeta.</span><span class="err" id="e-t-tel" hidden></span></label></section>
      <section class="bloque"><h3 class="cond">O bloquear este horario</h3><p class="ayuda" style="margin-top:10px">Para almuerzo o un trámite: deja de aparecer para reservar.</p>
      <button class="btn sec chico" type="button" id="t-bloq" style="margin-top:10px"><svg class="i" aria-hidden="true"><use href="#i-candado"/></svg>Bloquear 30 min</button></section>`,
    alAbrir: () => {
      $('#t-bloq').onclick = () => { BLOQUEOS.push({ b: bid, desde: hora, hasta: hhmm(min(hora) + 30), motivo: 'Bloqueado' }); cerrarHoja(true); render(); aviso('Horario bloqueado.'); };
    },
    guardar: () => {
      const nom = $('#t-nom').value.trim(), tel = telefono($('#t-tel').value);
      error('t-nom', nom.length < 2 && 'Poné el nombre del cliente.'); error('t-tel', !tel && 'Revisá el número: con código de área, sin 0 ni 15.');
      if (nom.length < 2 || !tel) return false;
      let c = CLIENTES.find((x) => x.tel === tel);
      if (!c) { c = { id: 'c' + Date.now(), nombre: nom, tel, visitas: 0, ausencias: 0, cortes: 0, usados: 0, premio: false, bloq: false }; CLIENTES.push(c); }
      const s = srv($('#t-serv').value);
      TURNOS.push({ id: 't' + Date.now(), b: bid, hora, cli: c.id, serv: s.id, precio: s.precio, estado: 'reservado', premio: false });
      render(); aviso(`Turno cargado: ${corto(hora)} ${c.nombre.split(' ')[0]} con ${b.nombre.split(' ')[0]}.`); return true;
    },
  });
}
function error(id, msg) { const c = $('#c-' + id), e = $('#e-' + id); if (!c) return; c.classList.toggle('mal', !!msg); e.hidden = !msg; e.textContent = msg || ''; $('#' + id).setAttribute('aria-invalid', msg ? 'true' : 'false'); }

/* ═══ Hoja genérica: guardar, cancelar y aviso de cambios sin guardar ═══ */
const hoja = $('#hoja'); let actual = null;
function abrirHoja(cfg) {
  actual = cfg;
  $('#hoja-t').textContent = cfg.titulo; $('#hoja-ok').textContent = cfg.ok || 'Guardar'; $('#hoja-cancelar').textContent = cfg.cancelar || 'Cancelar';
  $('#hoja-form').innerHTML = cfg.cuerpo; $('#hoja-estado').textContent = ''; $('#hoja-resumen').textContent = ''; $('#hoja-salir').hidden = true;
  cfg.alAbrir?.(); hoja.showModal(); cfg.inicial = cfg.firma?.();
  ($('#hoja-form input:not([type=checkbox])') || $('#hoja-ok')).focus();
}
function cerrarHoja(forzar) {
  if (!forzar && actual?.firma && actual.firma() !== actual.inicial) { $('#hoja-salir').hidden = false; $('#salir-no').focus(); return; }
  hoja.close(); actual = null;
}
hoja.addEventListener('cancel', (e) => { e.preventDefault(); cerrarHoja(); });
$('#hoja-x').onclick = () => cerrarHoja();
$('#hoja-cancelar').onclick = () => { const c = actual?.alCancelar; cerrarHoja(!!c); c?.(); };
$('#salir-si').onclick = () => cerrarHoja(true);
$('#salir-no').onclick = () => { $('#hoja-salir').hidden = true; };
$('#hoja-form').addEventListener('submit', (e) => { e.preventDefault(); if (actual?.guardar() !== false) cerrarHoja(true); });

/* ═══ BARBEROS ═══ */
function barberos() {
  const act = BARBEROS.filter((b) => b.activo), bajas = BARBEROS.filter((b) => !b.activo);
  const fila = (b) => {
    const n = TURNOS.filter((t) => t.b === b.id && t.estado === 'reservado').length;
    const ns = SERVICIOS.filter((s) => s.activo && s.barberos.includes(b.id)).length, tot = SERVICIOS.filter((s) => s.activo).length;
    return `<li class="fila ${b.activo ? '' : 'baja'}"><button type="button" data-barbero="${b.id}" aria-label="Editar a ${esc(b.nombre)}">
      <span class="ini" aria-hidden="true">${ini(b.nombre)}</span>
      <span><span class="n cond">${esc(b.nombre)}</span><span class="r">${resumen(b.franjas)}</span>
        <span class="r">${b.activo ? (ns === tot ? 'Hace todos los servicios' : `${ns} de ${tot} servicios`) : 'No aparece para reservar · su historial queda guardado'}${b.libres.length ? ` · Franco desde el ${fecha(b.libres[0].desde)}` : ''}</span></span>
      ${b.activo ? `<span class="mini" aria-label="${n} turnos por atender hoy"><small>Hoy</small><b>${n}</b></span>` : ''}</button></li>`;
  };
  $('#main').innerHTML = `<div class="titulo"><h1 class="cond">Barberos</h1><button class="btn" type="button" data-barbero="nuevo"><svg class="i" aria-hidden="true"><use href="#i-mas"/></svg>Nuevo barbero</button>
    <p>Al sumar un barbero ya aparece en tu página para sacar turno, con su grilla y sus números. Solo cargá su horario.</p></div>
    ${act.length ? `<ul class="lista">${act.map(fila).join('')}</ul>` : '<div class="vacio"><b class="cond">Todavía no hay barberos</b>Sumá el primero y ya se puede sacar turno con él.</div>'}
    ${bajas.length ? `<p class="grupo">Dados de baja</p><ul class="lista">${bajas.map(fila).join('')}</ul>` : ''}`;
}
const fecha = (ymd) => new Date(ymd + 'T12:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
document.addEventListener('click', (e) => { const b = e.target.closest('[data-barbero]'); if (b) editarBarbero(b.dataset.barbero === 'nuevo' ? null : barb(b.dataset.barbero)); });

const selHora = (v, attr) => { const [h, m] = v.split(':'); return `<span class="hora"><select ${attr}="h" aria-label="hora">${Array.from({ length: 18 }, (_, i) => i + 6).map((x) => `<option ${x === +h ? 'selected' : ''}>${String(x).padStart(2, '0')}</option>`).join('')}</select><b>:</b><select ${attr}="m" aria-label="minutos">${Array.from({ length: 12 }, (_, i) => i * 5).map((x) => `<option ${x === +m ? 'selected' : ''}>${String(x).padStart(2, '0')}</option>`).join('')}</select></span>`; };
function editarBarbero(b) {
  const e = b ? structuredClone(b) : { id: null, nombre: '', activo: true, franjas: [{ desde: '10:00', hasta: '13:00', dias: [] }, { desde: '16:00', hasta: '20:00', dias: [] }], libres: [] };
  let sv = b ? SERVICIOS.filter((s) => s.barberos.includes(b.id)).map((s) => s.id) : SERVICIOS.filter((s) => s.activo).map((s) => s.id);
  const franjaHtml = (f, i) => `<div class="franja" data-f="${i}"><div class="horas">De ${selHora(f.desde, 'data-desde')} a ${selHora(f.hasta, 'data-hasta')}</div>
      <div class="dias" role="group" aria-label="Días de esta franja">${DIAS.map((d, k) => `<button type="button" data-dia="${k}" aria-pressed="${f.dias.includes(k)}" aria-label="${DIAS_L[k]}">${d}</button>`).join('')}</div>
      <div class="pie-f"><p class="err" role="alert"></p><button class="link rojo" type="button" data-quitar-f="${i}">Quitar franja</button></div></div>`;
  const pintarFranjas = () => { $('#franjas').innerHTML = e.franjas.map(franjaHtml).join(''); validar(); };
  function validar() {
    let hay = false;
    e.franjas.forEach((f, i) => {
      let msg = '';
      if (min(f.desde) >= min(f.hasta)) msg = 'Termina antes de empezar.';
      else e.franjas.forEach((g, j) => { if (j !== i && !msg) { const dia = f.dias.find((d) => g.dias.includes(d)); if (dia !== undefined && min(f.desde) < min(g.hasta) && min(g.desde) < min(f.hasta)) msg = `Se pisa con ${corto(g.desde)} a ${corto(g.hasta)} ${DIAS_L[dia]}.`; } });
      const el = $(`.franja[data-f="${i}"]`); if (el) { el.classList.toggle('mal', !!msg); $('.err', el).textContent = msg; }
      hay ||= !!msg;
    });
    $('#hoja-resumen').textContent = `${resumen(e.franjas)}${horasSemana(e.franjas) ? ` · ${horasSemana(e.franjas)}` : ''}`;
    return !hay;
  }
  const futuros = b ? TURNOS.filter((t) => t.b === b.id && t.estado === 'reservado') : [];
  abrirHoja({
    titulo: b ? b.nombre : 'Nuevo barbero', ok: b ? 'Guardar' : 'Guardar y publicar',
    firma: () => JSON.stringify([e, sv]),
    cuerpo: `<section class="bloque"><h3 class="cond">Datos</h3><label class="campo" id="c-b-nom">Nombre y apellido<input id="b-nom" value="${esc(e.nombre)}" autocomplete="off" enterkeyhint="next" placeholder="Como lo conocen tus clientes" aria-describedby="e-b-nom" /><span class="err" id="e-b-nom" hidden></span></label></section>
      <section class="bloque"><h3 class="cond">Horario</h3><p class="ayuda" style="margin-top:10px">Cargá cada franja una vez y tocá los días que la trabaja.</p><div class="franjas" id="franjas"></div>
        <button class="link" type="button" id="mas-franja" style="margin-top:6px"><svg class="i" aria-hidden="true"><use href="#i-mas"/></svg>Agregar otra franja</button></section>
      <section class="bloque"><h3 class="cond">Servicios que hace</h3><div class="checks" id="b-serv">${SERVICIOS.filter((s) => s.activo).map((s) => `<label class="check"><input type="checkbox" value="${s.id}" ${sv.includes(s.id) ? 'checked' : ''} />${esc(s.nombre)}<small>${s.min} min · ${pesos(s.precio)}</small></label>`).join('')}</div><p class="err" id="e-b-serv" hidden></p></section>
      <section class="bloque"><h3 class="cond">Días libres <small>Vacaciones, trámites, francos</small></h3><ul class="libres" id="libres"></ul>
        <div class="fila2" style="margin-top:10px"><label class="campo" style="margin:0">Desde<input type="date" id="l-desde" /></label><label class="campo" style="margin:0">Hasta<input type="date" id="l-hasta" /></label></div>
        <button class="btn sec chico" type="button" id="l-agregar" style="margin-top:10px">Agregar días libres</button><p class="err" id="l-err" hidden></p></section>
      ${b ? `<section id="zona-baja">${b.activo ? '<button class="link rojo" type="button" id="baja">Dar de baja a este barbero</button>' : '<button class="link" type="button" id="alta">Volver a darlo de alta</button>'}</section>` : ''}`,
    alAbrir: () => {
      pintarFranjas(); pintarLibres();
      $('#franjas').addEventListener('change', (ev) => { const s = ev.target.closest('select'); if (!s) return; const i = +s.closest('.franja').dataset.f, campo = s.hasAttribute('data-desde') ? 'desde' : 'hasta', box = s.closest('.hora'); e.franjas[i][campo] = `${$('[aria-label=hora]', box).value}:${$('[aria-label=minutos]', box).value}`; validar(); });
      $('#franjas').addEventListener('click', (ev) => {
        const d = ev.target.closest('[data-dia]'), q = ev.target.closest('[data-quitar-f]');
        if (d) { const i = +d.closest('.franja').dataset.f, k = +d.dataset.dia, f = e.franjas[i]; f.dias = f.dias.includes(k) ? f.dias.filter((x) => x !== k) : [...f.dias, k].sort(); d.setAttribute('aria-pressed', f.dias.includes(k)); validar(); }
        if (q) { e.franjas.splice(+q.dataset.quitarF, 1); pintarFranjas(); }
      });
      $('#mas-franja').onclick = () => { const u = e.franjas.at(-1); const desde = u ? Math.min(min(u.hasta) + 60, 21 * 60) : 600; e.franjas.push({ desde: hhmm(desde), hasta: hhmm(Math.min(desde + 240, 23 * 60)), dias: u ? [...u.dias] : [] }); pintarFranjas(); $(`.franja[data-f="${e.franjas.length - 1}"] select`).focus(); };
      $('#b-serv').addEventListener('change', () => { sv = $$('#b-serv input:checked').map((i) => i.value); });
      $('#l-agregar').onclick = () => { const de = $('#l-desde').value, ha = $('#l-hasta').value || de; const er = $('#l-err'); er.hidden = true; if (!de) { $('#l-desde').focus(); return; } if (ha < de) { er.hidden = false; er.textContent = '"Hasta" es antes que "desde".'; return; } e.libres.push({ desde: de, hasta: ha }); $('#l-desde').value = $('#l-hasta').value = ''; pintarLibres(); };
      $('#libres').addEventListener('click', (ev) => { const q = ev.target.closest('[data-libre]'); if (q) { e.libres.splice(+q.dataset.libre, 1); pintarLibres(); } });
      $('#baja')?.addEventListener('click', () => {
        $('#zona-baja').innerHTML = `<div class="confirmar">¿Dar de baja a ${esc(b.nombre.split(' ')[0])}? Deja de aparecer para reservar y su historial queda guardado.${futuros.length ? ` <b>Tiene ${futuros.length} turno${futuros.length > 1 ? 's' : ''} por atender</b> (${futuros.map((t) => `${t.hora} ${esc(cli(t.cli).nombre.split(' ')[0])}`).join(', ')}): avisales o pasáselos a otro barbero.` : ''}
          <div class="botones"><button class="btn peligro chico" type="button" id="baja-si">Dar de baja</button><button class="btn sec chico" type="button" id="baja-no">No</button></div></div>`;
        $('#baja-no').onclick = () => { cerrarHoja(true); editarBarbero(barb(b.id)); };
        $('#baja-si').onclick = () => { b.activo = false; cerrarHoja(true); render(); aviso(`${b.nombre.split(' ')[0]} ya no aparece para reservar.`, () => { b.activo = true; render(); }); };
        $('#baja-si').focus();
      });
      $('#alta')?.addEventListener('click', () => { b.activo = true; cerrarHoja(true); render(); aviso(`${b.nombre.split(' ')[0]} volvió a atender.`); });
    },
    guardar: () => {
      e.nombre = $('#b-nom').value.trim();
      error('b-nom', e.nombre.length < 2 && 'Poné el nombre del barbero.');
      const okF = validar(), okD = e.franjas.some((f) => f.dias.length);
      const eS = $('#e-b-serv'); eS.hidden = !!sv.length; eS.textContent = 'Elegí al menos un servicio.';
      $('#hoja-estado').className = 'estado mal';
      $('#hoja-estado').textContent = e.nombre.length < 2 ? 'Falta el nombre.' : !okF ? 'Revisá las franjas marcadas en rojo.' : !okD ? 'Tocá los días que trabaja en alguna franja.' : !sv.length ? 'Elegí al menos un servicio.' : '';
      if (e.nombre.length < 2 || !okF || !okD || !sv.length) { (e.nombre.length < 2 ? $('#b-nom') : $('.franja.mal select') || $('.franja .dias button') || $('#b-serv input')).focus(); return false; }
      e.franjas = e.franjas.filter((f) => f.dias.length);
      if (b) Object.assign(b, e); else { e.id = 'b' + Date.now(); BARBEROS.push(e); }
      SERVICIOS.forEach((s) => { s.barberos = s.barberos.filter((x) => x !== e.id); if (sv.includes(s.id)) s.barberos.push(e.id); });
      render(); aviso(b ? `Horario de ${e.nombre.split(' ')[0]} actualizado en tu página.` : `${e.nombre.split(' ')[0]} ya aparece en tu página para sacar turno.`); return true;
    },
  });
  function pintarLibres() { $('#libres').innerHTML = e.libres.length ? e.libres.map((l, i) => `<li><span>${l.desde === l.hasta ? fecha(l.desde) : `Del ${fecha(l.desde)} al ${fecha(l.hasta)}`}<small>No aparece para reservar</small></span><button class="quitar" type="button" data-libre="${i}" aria-label="Quitar"><svg class="i" aria-hidden="true"><use href="#i-x"/></svg></button></li>`).join('') : '<li style="border-style:dashed"><span>Sin días libres cargados.</span></li>'; }
}

/* ═══ SERVICIOS ═══ */
function servicios() {
  const quien = (s) => { const bs = BARBEROS.filter((b) => b.activo && s.barberos.includes(b.id)); return bs.length === BARBEROS.filter((b) => b.activo).length ? 'Todos los barberos' : bs.map((b) => b.nombre.split(' ')[0]).join(', ') || 'Nadie lo hace'; };
  const fila = (s) => `<li class="fila ${s.activo ? '' : 'baja'}"><button type="button" data-servicio="${s.id}" aria-label="Editar ${esc(s.nombre)}">
    <span class="ini" aria-hidden="true" style="background:var(--papel);border:2px solid var(--ink)"><svg class="i"><use href="#i-tijera"/></svg></span>
    <span><span class="n cond">${esc(s.nombre)}</span><span class="r">${s.min} min · ${s.activo ? quien(s) : 'De baja: no se ofrece'}</span></span>
    <span class="cond" style="font-size:28px">${pesos(s.precio)}</span></button></li>`;
  $('#main').innerHTML = `<div class="titulo"><h1 class="cond">Servicios</h1><button class="btn" type="button" data-servicio="nuevo"><svg class="i" aria-hidden="true"><use href="#i-mas"/></svg>Nuevo servicio</button>
    <p>Precio, duración y quién lo hace. Si cambiás un precio, los turnos ya reservados mantienen el anterior.</p></div>
    <ul class="lista">${SERVICIOS.filter((s) => s.activo).map(fila).join('')}</ul>
    ${SERVICIOS.some((s) => !s.activo) ? `<p class="grupo">Dados de baja</p><ul class="lista">${SERVICIOS.filter((s) => !s.activo).map(fila).join('')}</ul>` : ''}`;
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-servicio]'); if (b) editarServicio(b.dataset.servicio === 'nuevo' ? null : srv(b.dataset.servicio)); });
function editarServicio(s) {
  const e = s ? structuredClone(s) : { id: null, nombre: '', precio: 0, min: 30, activo: true, barberos: BARBEROS.filter((b) => b.activo).map((b) => b.id) };
  abrirHoja({
    titulo: s ? s.nombre : 'Nuevo servicio', firma: () => JSON.stringify([$('#s-nom')?.value, $('#s-precio')?.value, $('#s-min')?.value, $$('#s-barb input:checked').map((i) => i.value)]),
    cuerpo: `<section class="bloque"><h3 class="cond">Servicio</h3>
      <label class="campo" id="c-s-nom">Nombre<input id="s-nom" value="${esc(e.nombre)}" autocomplete="off" placeholder="Ej.: Corte + barba" aria-describedby="e-s-nom" /><span class="err" id="e-s-nom" hidden></span></label>
      <div class="fila2"><label class="campo" id="c-s-precio">Precio<span class="prefijo"><span aria-hidden="true">$</span><input id="s-precio" inputmode="numeric" value="${e.precio ? e.precio.toLocaleString('es-AR') : ''}" autocomplete="off" aria-describedby="e-s-precio" /></span><span class="err" id="e-s-precio" hidden></span></label>
      <label class="campo">Duración<select id="s-min">${Array.from({ length: 36 }, (_, i) => (i + 1) * 5).map((m) => `<option value="${m}" ${m === e.min ? 'selected' : ''}>${m < 60 ? m + ' min' : `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}`}</option>`).join('')}</select></label></div>
      <p class="ayuda" style="margin-top:8px">Los turnos ya reservados mantienen el precio con el que se sacaron.</p></section>
      <section class="bloque"><h3 class="cond">Quién lo hace</h3><div class="checks" id="s-barb">${BARBEROS.filter((b) => b.activo).map((b) => `<label class="check"><input type="checkbox" value="${b.id}" ${e.barberos.includes(b.id) ? 'checked' : ''} />${esc(b.nombre)}<small></small></label>`).join('')}</div><p class="err" id="e-s-barb" hidden>Elegí al menos un barbero.</p></section>
      ${s ? `<section id="zona-baja-s">${s.activo ? '<button class="link rojo" type="button" id="s-baja">Dar de baja este servicio</button>' : '<button class="link" type="button" id="s-alta">Volver a ofrecerlo</button>'}</section>` : ''}`,
    alAbrir: () => {
      $('#s-precio').addEventListener('input', (ev) => { const n = ev.target.value.replace(/\D/g, ''); ev.target.value = n ? (+n).toLocaleString('es-AR') : ''; });
      $('#s-baja')?.addEventListener('click', () => {
        $('#zona-baja-s').innerHTML = `<div class="confirmar">¿Dar de baja "${esc(s.nombre)}"? Deja de ofrecerse en tu página. Los turnos ya reservados siguen igual.<div class="botones"><button class="btn peligro chico" type="button" id="sb-si">Dar de baja</button><button class="btn sec chico" type="button" id="sb-no">No</button></div></div>`;
        $('#sb-no').onclick = () => { cerrarHoja(true); editarServicio(s); };
        $('#sb-si').onclick = () => { s.activo = false; cerrarHoja(true); render(); aviso(`"${s.nombre}" ya no se ofrece.`, () => { s.activo = true; render(); }); };
      });
      $('#s-alta')?.addEventListener('click', () => { s.activo = true; cerrarHoja(true); render(); aviso(`"${s.nombre}" se ofrece de nuevo.`); });
    },
    guardar: () => {
      const nom = $('#s-nom').value.trim(), precio = +$('#s-precio').value.replace(/\D/g, ''), bs = $$('#s-barb input:checked').map((i) => i.value);
      error('s-nom', nom.length < 2 && 'Poné el nombre del servicio.'); error('s-precio', !precio && 'Poné el precio (puede ser $ 0 si es sin cargo… pero escribilo).');
      $('#e-s-barb').hidden = !!bs.length;
      if (nom.length < 2 || !precio || !bs.length) return false;
      Object.assign(e, { nombre: nom, precio, min: +$('#s-min').value, barberos: bs });
      if (s) Object.assign(s, e); else { e.id = 's' + Date.now(); SERVICIOS.push(e); }
      render(); aviso(s ? `"${nom}" actualizado en tu página.` : `"${nom}" ya se puede reservar.`); return true;
    },
  });
}

/* ═══ CLIENTES ═══ */
let busqueda = '';
function clientes() {
  $('#main').innerHTML = `<div class="titulo"><h1 class="cond">Clientes</h1><p>Se identifican por teléfono. Cada corte al que vienen tacha una tijera de su tarjeta.</p></div>
    <label class="buscar"><svg class="i" aria-hidden="true"><use href="#i-lupa"/></svg><span class="sr">Buscar cliente</span><input id="buscar" value="${esc(busqueda)}" placeholder="Nombre o teléfono" autocomplete="off" /></label>
    <div id="lista-c"></div>`;
  $('#buscar').addEventListener('input', (e) => { busqueda = e.target.value; listaClientes(); });
  listaClientes();
}
const telFmt = (t) => `${t.slice(0, 3)} ${t.slice(3, 6)} ${t.slice(6)}`;
function listaClientes() {
  const q = busqueda.trim().toLowerCase().replace(/\s/g, '');
  const ls = CLIENTES.filter((c) => !q || c.nombre.toLowerCase().replace(/\s/g, '').includes(q) || c.tel.includes(q)).sort((a, b) => b.visitas - a.visitas);
  $('#lista-c').innerHTML = ls.length ? `<ul class="lista">${ls.map((c) => `<li class="cliente ${c.bloq ? 'bloq' : ''}">
      <span><span class="n cond">${esc(c.nombre)}</span><span class="r" style="display:block">${telFmt(c.tel)} · ${c.visitas} visitas · ${c.ausencias} ${c.ausencias === 1 ? 'ausencia' : 'ausencias'} · ${c.usados} premios usados</span></span>
      ${c.premio ? `<span class="sello"><svg class="i" aria-hidden="true"><use href="#i-regalo"/></svg>Tiene premio</span>` : `<span class="tarjetita" role="img" aria-label="${c.cortes} de ${REGLA.cada} cortes">${Array.from({ length: REGLA.cada }, (_, i) => `<i class="${i < c.cortes ? 'x' : ''}"></i>`).join('')}</span>`}
      <span class="acc"><button class="link ${c.bloq ? '' : 'rojo'}" type="button" data-bloq="${c.id}">${c.bloq ? 'Desbloquear teléfono' : 'Bloquear teléfono'}</button>${c.bloq ? ' <span class="ayuda">No puede sacar turnos online.</span>' : ''}</span></li>`).join('')}</ul>`
    : `<div class="vacio"><b class="cond">Nadie con "${esc(busqueda)}"</b>Probá con otro nombre o con el teléfono sin 0 ni 15.</div>`;
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-bloq]'); if (!b) return; const c = cli(b.dataset.bloq); c.bloq = !c.bloq; listaClientes(); aviso(c.bloq ? `${c.nombre.split(' ')[0]} no puede sacar turnos online.` : `${c.nombre.split(' ')[0]} puede volver a sacar turnos.`, () => { c.bloq = !c.bloq; listaClientes(); }); });

/* ═══ NÚMEROS ═══ */
let periodo = 'hoy';
function numeros() {
  const hechos = TURNOS.filter((t) => t.estado === 'asistio');
  const P = {
    hoy: { tot: hechos.reduce((a, t) => a + (t.premio ? 0 : t.precio), 0), cortes: hechos.length, aus: TURNOS.filter((t) => t.estado === 'no_asistio').length, por: BARBEROS.filter((b) => b.activo).map((b) => [b.nombre.split(' ')[0], hechos.filter((t) => t.b === b.id).reduce((a, t) => a + (t.premio ? 0 : t.precio), 0)]), srv: SERVICIOS.map((s) => [s.nombre, hechos.filter((t) => t.serv === s.id).length]) },
    semana: { tot: 486500, cortes: 41, aus: 3, por: [['Martín', 212000], ['Lucas', 151500], ['Tomás', 123000]], srv: [['Corte', 22], ['Corte + barba', 11], ['Barba', 5], ['Perfilado de cejas', 3]] },
    mes: { tot: 1982500, cortes: 167, aus: 12, por: [['Martín', 846000], ['Lucas', 611500], ['Tomás', 525000]], srv: [['Corte', 88], ['Corte + barba', 47], ['Barba', 21], ['Perfilado de cejas', 11]] },
  }[periodo];
  const maxB = Math.max(1, ...P.por.map((x) => x[1])), maxS = Math.max(1, ...P.srv.map((x) => x[1]));
  const tasa = P.cortes + P.aus ? Math.round((P.aus / (P.cortes + P.aus)) * 100) : 0;
  $('#main').innerHTML = `<div class="titulo"><h1 class="cond">Números</h1><div class="periodo" role="group" aria-label="Período">${[['hoy', 'Hoy'], ['semana', 'Semana'], ['mes', 'Mes']].map(([k, n]) => `<button type="button" data-periodo="${k}" aria-pressed="${k === periodo}">${n}</button>`).join('')}</div>
      <p>Solo cuenta lo que se cobró: turnos marcados "Asistió". ${periodo !== 'hoy' ? 'Semana y mes: datos de ejemplo.' : ''}</p></div>
    <div class="facturado" role="img" aria-label="Facturado: ${pesos(P.tot)}"><small>Facturado ${periodo === 'hoy' ? 'hoy' : periodo === 'semana' ? 'esta semana' : 'este mes'}</small>
      <div class="monto"><span>$</span>${seg(P.tot.toLocaleString('es-AR'))}</div><p>${P.cortes} cortes · ${tasa}% no vino · ticket promedio ${pesos(P.cortes ? Math.round(P.tot / P.cortes) : 0)}</p></div>
    <div class="dos"><section class="bloque"><h3 class="cond">Por barbero</h3><div class="barras">${P.por.map(([n, v]) => `<div class="barra"><span>${esc(n)}</span><span class="t"><i style="width:${(v / maxB) * 100}%"></i></span><span class="v">${pesos(v)}</span></div>`).join('')}</div></section>
    <section class="bloque"><h3 class="cond">Lo que más sale</h3><div class="barras">${P.srv.sort((a, b) => b[1] - a[1]).map(([n, v]) => `<div class="barra"><span>${esc(n)}</span><span class="t"><i style="width:${(v / maxS) * 100}%"></i></span><span class="v">${v} ${v === 1 ? 'vez' : 'veces'}</span></div>`).join('')}</div></section></div>`;
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-periodo]'); if (b) { periodo = b.dataset.periodo; numeros(); } });

/* ═══ MI PÁGINA ═══ */
function lum(hex) { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
const tinta = (hex) => { const l = lum(hex); return (l + 0.05) / (lum('#141210') + 0.05) >= (lum('#fffdf3') + 0.05) / (l + 0.05) ? '#141210' : '#fffdf3'; };
const colorOk = (hex) => /^#[0-9a-f]{6}$/.test(hex) && ((l) => Math.max((l + 0.05) / (lum('#141210') + 0.05), (lum('#fffdf3') + 0.05) / (l + 0.05)))(lum(hex)) >= 4.5;
const PRESETS = ['#c9a46a', '#c47f57', '#d4a24c', '#1f3a5f', '#2f6b4f', '#7a1f2b', '#141210'];
function pagina() {
  const url = `navagenda.com.ar/${SHOP.slug}`;
  $('#main').innerHTML = `<div class="titulo"><h1 class="cond">Mi página</h1><p>Lo que ven tus clientes cuando abren tu link. Los cambios se ven al toque.</p></div>
    <div class="dos">
      <div style="display:grid;gap:26px;align-content:start">
        <section class="bloque"><h3 class="cond">Tu link</h3><p class="ayuda" style="margin-top:10px">Ponelo en tu Instagram y tu WhatsApp. Cada barbero tiene el suyo, que abre la página con él ya elegido.</p>
          <ul class="links"><li><span>${url}</span><button class="quitar" type="button" data-copiar="https://${url}" aria-label="Copiar tu link"><svg class="i" aria-hidden="true"><use href="#i-copiar"/></svg></button></li>
          ${BARBEROS.filter((b) => b.activo).map((b) => { const c = b.nombre.split(' ')[0].normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase(); return `<li><span>${url}?con=${c}</span><button class="quitar" type="button" data-copiar="https://${url}?con=${c}" aria-label="Copiar el link de ${esc(b.nombre)}"><svg class="i" aria-hidden="true"><use href="#i-copiar"/></svg></button></li>`; }).join('')}</ul></section>
        <section class="bloque"><h3 class="cond">Color</h3>
          <div class="colores" role="group" aria-label="Color de tu página">${PRESETS.map((c) => `<button class="color" type="button" data-color="${c}" style="background:${c}" aria-pressed="${c === SHOP.color}" aria-label="Color ${c}"></button>`).join('')}</div>
          <label class="campo" id="c-p-color">Otro color (hexadecimal)<input id="p-color" value="${SHOP.color}" maxlength="7" autocomplete="off" aria-describedby="e-p-color" /><span class="err" id="e-p-color" hidden></span></label>
          <div class="previa" id="previa"></div></section>
      </div>
      <div style="display:grid;gap:26px;align-content:start">
        <section class="bloque"><h3 class="cond">Datos</h3>
          <label class="campo">Nombre<input id="p-nom" value="${esc(SHOP.nombre)}" /></label>
          <div class="fila2"><label class="campo">Dirección<input id="p-dir" value="${esc(SHOP.direccion)}" /></label><label class="campo">Barrio<input id="p-barrio" value="${esc(SHOP.barrio)}" /></label></div>
          <label class="campo">Descripción<textarea id="p-desc" maxlength="600">${esc(SHOP.descripcion)}</textarea></label>
          <label class="campo">Pueden cancelar hasta<select id="p-cancel">${[0, 1, 2, 3, 6, 12, 24].map((h) => `<option value="${h}" ${h === SHOP.cancel ? 'selected' : ''}>${h ? `${h} h antes` : 'el último momento'}</option>`).join('')}</select></label></section>
        <section class="bloque"><h3 class="cond">Tarjeta de cortes</h3><p class="ayuda" style="margin-top:10px">Así se ve en el ticket de tus clientes: una tijera tachada por cada corte.</p>
          <div class="regla">Cada <input id="r-cada" type="number" min="1" max="20" value="${REGLA.cada}" aria-label="Cantidad de cortes" /> cortes,
            <select id="r-tipo" aria-label="Tipo de premio"><option value="servicio_gratis">un servicio gratis</option><option value="descuento_pct">un % de descuento</option><option value="descuento_monto">un descuento en $</option><option value="texto">otro premio</option></select>
            <span id="r-valor"></span></div>
          <div class="tarjeta" id="r-tarjeta" role="img"></div></section>
        <button class="btn" type="button" id="p-guardar" style="justify-self:start">Guardar cambios</button>
      </div>
    </div>`;
  $('#r-tipo').value = REGLA.tipo;
  const valor = () => { const t = $('#r-tipo').value; $('#r-valor').innerHTML = t === 'servicio_gratis' ? `<select id="r-v" aria-label="Qué servicio">${SERVICIOS.filter((s) => s.activo).map((s) => `<option value="${s.id}" ${s.id === REGLA.valor ? 'selected' : ''}>${esc(s.nombre)}</option>`).join('')}</select>`
    : t === 'texto' ? `<input id="r-v" style="width:220px" placeholder="Ej.: una cerveza" value="${esc(REGLA.texto)}" />` : `<input id="r-v" type="number" min="1" ${t === 'descuento_pct' ? 'max="100"' : ''} placeholder="${t === 'descuento_pct' ? '%' : '$'}" value="${t === REGLA.tipo && REGLA.tipo !== 'servicio_gratis' ? REGLA.valor : ''}" />`; tarjeta(); };
  const leerRegla = () => ({ cada: Math.max(1, Math.min(20, +$('#r-cada').value || 1)), tipo: $('#r-tipo').value, valor: $('#r-v')?.value || '', texto: $('#r-tipo').value === 'texto' ? $('#r-v')?.value || '' : '' });
  const tarjeta = () => { const r = leerRegla(), n = Math.min(2, r.cada - 1); const p = r.tipo === 'servicio_gratis' ? `${srv(r.valor)?.nombre || ''} gratis` : r.tipo === 'descuento_pct' ? `${r.valor || '?'}% off` : r.tipo === 'descuento_monto' ? `${pesos(+r.valor || 0)} off` : r.texto || 'Premio';
    $('#r-tarjeta').innerHTML = Array.from({ length: r.cada }, (_, i) => `<span class="tijera ${i < n ? 'x' : ''}"><svg class="i" aria-hidden="true"><use href="#i-tijera"/></svg></span>`).join('') + `<span class="premio"><svg class="i" aria-hidden="true"><use href="#i-regalo"/></svg>${esc(p)}</span>`;
    $('#r-tarjeta').setAttribute('aria-label', `Ejemplo: ${n} de ${r.cada} cortes para ${p}`); };
  const previa = (hex) => { const p = $('#previa'); p.style.setProperty('--prev', hex); p.style.setProperty('--prev-ink', tinta(hex)); p.innerHTML = `<b class="cond">${esc($('#p-nom')?.value || SHOP.nombre)}</b><span style="font:600 14px Archivo">${esc(SHOP.direccion)} · ${esc(SHOP.barrio)}</span><div class="maq">${seg('16:15')}<span>Así se ve tu página con este color</span></div>`; };
  const ponerColor = (hex) => { hex = hex.toLowerCase(); if (!hex.startsWith('#')) hex = '#' + hex; const ok = colorOk(hex); error('p-color', !ok && (/^#[0-9a-f]{6}$/.test(hex) ? 'Con ese color no se lee bien el texto. Probá uno más claro o más oscuro.' : 'Escribilo como #c9a46a.')); if (ok) { previa(hex); $$('.color').forEach((c) => c.setAttribute('aria-pressed', c.dataset.color === hex)); } return ok && hex; };
  valor(); previa(SHOP.color);
  $('#r-tipo').onchange = valor; $('#r-cada').oninput = tarjeta; $('#r-valor').addEventListener('input', tarjeta); $('#r-valor').addEventListener('change', tarjeta);
  $('#p-color').addEventListener('input', (e) => ponerColor(e.target.value)); $('#p-nom').addEventListener('input', () => previa($('#p-color').value));
  $('.colores').addEventListener('click', (e) => { const c = e.target.closest('[data-color]'); if (c) { $('#p-color').value = c.dataset.color; ponerColor(c.dataset.color); } });
  $('#p-guardar').onclick = () => {
    const hex = ponerColor($('#p-color').value); if (!hex) { $('#p-color').focus(); return; }
    Object.assign(SHOP, { color: hex, nombre: $('#p-nom').value.trim() || SHOP.nombre, direccion: $('#p-dir').value, barrio: $('#p-barrio').value, descripcion: $('#p-desc').value, cancel: +$('#p-cancel').value });
    Object.assign(REGLA, leerRegla()); document.documentElement.style.setProperty('--shop', hex); render(); aviso('Tu página se actualizó.');
  };
}
document.addEventListener('click', async (e) => { const b = e.target.closest('[data-copiar]'); if (!b) return; try { await navigator.clipboard.writeText(b.dataset.copiar); aviso('Link copiado. Pegalo en tu Instagram o WhatsApp.'); } catch { aviso(b.dataset.copiar); } });

render();
