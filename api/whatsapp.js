// Webhook de WhatsApp para Cashflow Empresa — ASISTENTE con tool-calling.
// Un solo agente (Claude Haiku) que REGISTRA movimientos/cobros Y responde consultas
// abiertas sobre la caja. Reusa la lógica de escritura probada como tools; suma tools de
// lectura con agregados (no vuelca las 379 filas al modelo). Identifica autor por número
// y avisa al otro socio en cada escritura.
// ponytail: loop de tool-use a mano con fetch (el proyecto es cero-deps/no-build → no meto
// el SDK). Haiku + max 4 iteraciones para entrar en los ~15s del webhook de Twilio; si una
// consulta pesada se pasa, Twilio corta → el socio reintenta. Subir a Sonnet vía CF_MODEL.

const SB_URL = "https://nmhxgkruaiohdpennpga.supabase.co";
const SB_KEY = "sb_publishable_e3OwzCJn8N7zLE-j8i2Suw_PKqqPgRx";
const SB_H = { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}`, "Content-Type": "application/json" };

const SOCIOS = { "+5491157712384": "Fran", "+5491158592920": "Santi" };
const BOT_NUM = "whatsapp:+19312402359";
const MODELO = process.env.CF_MODEL || "claude-haiku-4-5-20251001";

const HOY = () => new Date().toISOString().slice(0, 10);
const fmt = (n, mon = "ARS") => (mon === "USD" ? "US$" : "$") + Number(n || 0).toLocaleString("es-AR");
const dispCorto = iso => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };
const fmtDT = iso => { try { return new Date(iso).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

// ---- Supabase ----
async function sbGet(tabla, query = "") {
  const r = await fetch(`${SB_URL}/rest/v1/${tabla}?${query}`, { headers: SB_H });
  return r.ok ? await r.json() : [];
}
async function sbInsert(tabla, obj) {
  const r = await fetch(`${SB_URL}/rest/v1/${tabla}`, { method: "POST", headers: { ...SB_H, "Prefer": "return=representation" }, body: JSON.stringify(obj) });
  return r.ok ? (await r.json())[0] : null;
}
async function sbPatch(tabla, id, cambios) {
  const r = await fetch(`${SB_URL}/rest/v1/${tabla}?id=eq.${id}`, { method: "PATCH", headers: SB_H, body: JSON.stringify(cambios) });
  return r.ok;
}

// Liquida automáticamente las cuentas por cobrar vencidas (auto_liq) y registra el ingreso.
// PATCH condicional (cobrado=eq.false) → sólo una ejecución procesa cada fila.
async function liquidarVencidas() {
  const due = await sbGet("cobrar", "select=*&cobrado=eq.false&auto_liq=eq.true");
  const ahora = Date.now();
  for (const x of due) {
    if (!x.fecha_liquidacion || !x.caja_liq_id) continue;
    if (new Date(x.fecha_liquidacion).getTime() > ahora) continue;
    const r = await fetch(`${SB_URL}/rest/v1/cobrar?id=eq.${x.id}&cobrado=eq.false`, { method: "PATCH", headers: { ...SB_H, "Prefer": "return=representation" }, body: JSON.stringify({ cobrado: true }) });
    const rows = r.ok ? await r.json() : [];
    if (!rows.length) continue;
    const fechaMov = String(x.fecha_liquidacion).slice(0, 10) || HOY();
    await sbInsert("movimientos", {
      id: Date.now() + Math.floor(Math.random() * 1000), tipo: "ingreso", monto: Number(x.monto),
      caja_id: Number(x.caja_liq_id), caja_destino_id: null, categoria_id: null,
      descripcion: `Liquidación: ${x.quien}${x.descripcion ? ` - ${x.descripcion}` : ""}`,
      fecha: fechaMov, autor: x.autor || "Sistema", es_retiro: false, creado_en: new Date().toISOString()
    });
  }
}

function twiml(msg) {
  if (!msg) return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>";
  const safe = msg.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`;
}

// Envía un WhatsApp al otro socio vía API de Twilio (aviso cruzado)
async function avisar(aQuienNum, texto) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return;
  try {
    const body = new URLSearchParams();
    body.append("To", `whatsapp:${aQuienNum}`);
    body.append("From", BOT_NUM);
    body.append("Body", texto);
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { "Authorization": "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });
  } catch {}
}

// ---- Agregados (puros — testeables) ----
export function saldoCaja(movs, id) {
  let s = 0;
  movs.forEach(m => {
    if (m.tipo === "ingreso" && m.caja_id === id) s += Number(m.monto);
    else if (m.tipo === "egreso" && m.caja_id === id) s -= Number(m.monto);
    else if (m.tipo === "transferencia") { if (m.caja_id === id) s -= Number(m.monto); if (m.caja_destino_id === id) s += Number(m.monto); }
  });
  return s;
}
const enRango = (f, desde, hasta) => { const d = String(f).slice(0, 10); return (!desde || d >= desde) && (!hasta || d <= hasta); };
export function totalesPeriodo(movs, desde, hasta) {
  let ing = 0, egr = 0; const porCat = {};
  for (const m of movs) {
    if (!enRango(m.fecha, desde, hasta)) continue;
    if (m.tipo === "ingreso") ing += Number(m.monto);
    else if (m.tipo === "egreso") { egr += Number(m.monto); const k = m.categoria_id ?? "sin"; porCat[k] = (porCat[k] || 0) + Number(m.monto); }
  }
  return { ingresos: ing, egresos: egr, neto: ing - egr, egresos_por_categoria: porCat };
}

// Arma el row de movimiento a insertar (puro). Devuelve {obj, confirm, aviso} o {error}.
// Camino de plata → se testea aislado (ver demo() abajo).
export function armarMovimiento(c, ctx) {
  const caja = ctx.cajas.find(x => x.id === Number(c.caja_id));
  if (!caja) return { error: "⚠️ No identifiqué la caja. Nombrala como la tenés en la app." };
  const cajaD = c.caja_destino_id ? ctx.cajas.find(x => x.id === Number(c.caja_destino_id)) : null;
  const cat = c.categoria_id ? ctx.cats.find(x => x.id === Number(c.categoria_id)) : null;
  if (c.mov_tipo === "transferencia" && !cajaD) return { error: "⚠️ Para transferencia indicá caja origen y destino." };

  const fecha = (c.fecha && /^\d{4}-\d{2}-\d{2}$/.test(c.fecha)) ? c.fecha : HOY();
  const esRetiro = c.mov_tipo === "egreso" && !!c.es_retiro;
  const NOMBRES = [...new Set(Object.values(SOCIOS))];
  let autorMov = ctx.autor;
  if (esRetiro && c.retira) {
    const q = String(c.retira).toLowerCase();
    const match = NOMBRES.find(n => n.toLowerCase() === q || n.toLowerCase().includes(q) || q.includes(n.toLowerCase()));
    if (match) autorMov = match;
  }
  const obj = {
    id: Date.now(), tipo: c.mov_tipo, monto: Number(c.monto), caja_id: caja.id,
    caja_destino_id: cajaD ? cajaD.id : null, categoria_id: cat ? cat.id : null,
    descripcion: c.descripcion || (c.mov_tipo === "transferencia" ? "Transferencia" : ""),
    fecha, autor: autorMov, es_retiro: esRetiro, creado_en: new Date().toISOString()
  };
  const tipoTxt = esRetiro ? `↩️ Retiro de ${autorMov}` : c.mov_tipo === "ingreso" ? "⬇️ Ingreso" : c.mov_tipo === "egreso" ? "⬆️ Egreso" : "🔁 Transferencia";
  const detalle = c.mov_tipo === "transferencia"
    ? `${fmt(obj.monto, caja.moneda)} de ${caja.nombre} → ${cajaD.nombre}`
    : `${fmt(obj.monto, caja.moneda)} · ${caja.nombre}${cat ? ` · ${cat.nombre}` : ""}`;
  const cuando = fecha === HOY() ? "hoy" : dispCorto(fecha);
  return {
    obj,
    confirm: `${tipoTxt} registrado: ${detalle}${obj.descripcion ? ` (${obj.descripcion})` : ""} · ${cuando}`,
    aviso: `📥 ${ctx.autor} registró:\n${tipoTxt} ${detalle}${obj.descripcion ? ` (${obj.descripcion})` : ""} · ${cuando}`,
  };
}

// Matchea un nombre suelto contra la lista de socios; null si no matchea.
function matchSocio(q) {
  if (!q) return null;
  const n = String(q).toLowerCase();
  return [...new Set(Object.values(SOCIOS))].find(s => s.toLowerCase() === n || s.toLowerCase().includes(n) || n.includes(s.toLowerCase())) || null;
}

// ---- Tools (lectura + escritura) ----
function buildTools() {
  return [
    { name: "saldos", description: "Saldo actual de cada caja y el total. Para 'cuánto hay', 'saldo de X', 'cuánta plata tenemos'.",
      input_schema: { type: "object", properties: {} },
      run: async (_i, ctx) => {
        const movs = await ctx.getMovs();
        // ponytail: sin cajas USD hoy → total = suma ARS. Si aparecen cajas USD, sumar conversión blue.
        const porCaja = ctx.cajas.map(cj => ({ caja: cj.nombre, moneda: cj.moneda, saldo: saldoCaja(movs, cj.id) }));
        const totalARS = porCaja.filter(c => c.moneda !== "USD").reduce((s, c) => s + c.saldo, 0);
        return JSON.stringify({ por_caja: porCaja, total_ARS: totalARS });
      } },
    { name: "totales_periodo", description: "Ingresos, egresos y neto en un rango de fechas (default: mes actual), con desglose de egresos por categoría. Para 'cuánto ingresó/gasté', comparar meses, 'en qué gastamos'.",
      input_schema: { type: "object", properties: { desde: { type: "string", description: "YYYY-MM-DD inclusive; default inicio del mes actual" }, hasta: { type: "string", description: "YYYY-MM-DD inclusive; default hoy" } } },
      run: async (i, ctx) => {
        const desde = i.desde || HOY().slice(0, 7) + "-01";
        const hasta = i.hasta || HOY();
        const t = totalesPeriodo(await ctx.getMovs(), desde, hasta);
        const porCat = Object.entries(t.egresos_por_categoria)
          .map(([k, v]) => ({ categoria: ctx.cats.find(c => String(c.id) === String(k))?.nombre || "Sin categoría", monto: v }))
          .sort((a, b) => b.monto - a.monto);
        return JSON.stringify({ desde, hasta, ingresos: t.ingresos, egresos: t.egresos, neto: t.neto, egresos_por_categoria: porCat });
      } },
    { name: "listar_movimientos", description: "Movimientos que matchean filtros, más recientes primero (hasta 'limite'). Para 'últimos gastos', 'movimientos de X caja', 'qué pagamos a proveedores'.",
      input_schema: { type: "object", properties: { desde: { type: "string" }, hasta: { type: "string" }, tipo: { type: "string", enum: ["ingreso", "egreso", "transferencia"] }, caja_id: { type: "number" }, categoria_id: { type: "number" }, autor: { type: "string" }, texto: { type: "string", description: "substring en la descripción" }, limite: { type: "number", description: "default 15, máx 40" } } },
      run: async (i, ctx) => {
        let f = (await ctx.getMovs()).filter(m => enRango(m.fecha, i.desde, i.hasta));
        if (i.tipo) f = f.filter(m => m.tipo === i.tipo);
        if (i.caja_id) f = f.filter(m => m.caja_id === Number(i.caja_id) || m.caja_destino_id === Number(i.caja_id));
        if (i.categoria_id) f = f.filter(m => m.categoria_id === Number(i.categoria_id));
        if (i.autor) f = f.filter(m => String(m.autor || "").toLowerCase() === String(i.autor).toLowerCase());
        if (i.texto) f = f.filter(m => String(m.descripcion || "").toLowerCase().includes(String(i.texto).toLowerCase()));
        f.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || (b.id - a.id));
        const lim = Math.min(Number(i.limite) || 15, 40);
        const rows = f.slice(0, lim).map(m => ({ fecha: m.fecha, tipo: m.tipo, monto: Number(m.monto), caja: ctx.cajas.find(c => c.id === m.caja_id)?.nombre, cat: ctx.cats.find(c => c.id === m.categoria_id)?.nombre || null, desc: m.descripcion || "", autor: m.autor }));
        return JSON.stringify({ total_matches: f.length, mostrando: rows.length, movimientos: rows });
      } },
    { name: "a_cobrar", description: "Cuentas por cobrar pendientes (plata que todavía no entró) y su total.",
      input_schema: { type: "object", properties: {} },
      run: async (_i, ctx) => {
        const p = ctx.cobrarPend || [];
        return JSON.stringify({ total: p.reduce((s, x) => s + Number(x.monto), 0), cuentas: p.map(x => ({ quien: x.quien, monto: Number(x.monto), desc: x.descripcion || "", liquida: x.fecha_liquidacion || null })) });
      } },
    { name: "retiros", description: "Retiros de socios acumulados por socio y cuánto tiene a favor el que retiró menos (para igualar).",
      input_schema: { type: "object", properties: {} },
      run: async (_i, ctx) => {
        const movs = await ctx.getMovs();
        const socios = [...new Set(Object.values(SOCIOS))];
        const ret = {}; socios.forEach(s => ret[s] = 0);
        movs.filter(m => m.es_retiro).forEach(m => { ret[m.autor] = (ret[m.autor] || 0) + Number(m.monto); });
        let favor = null;
        if (socios.length === 2) { const a = ret[socios[0]], b = ret[socios[1]], dif = Math.abs(a - b); if (dif > 0) favor = { socio: a < b ? socios[0] : socios[1], monto: dif }; }
        return JSON.stringify({ retiros: ret, a_favor: favor });
      } },

    { name: "registrar_movimiento", description: "Registra un movimiento YA efectuado. 'pagué/gasté/salió'→egreso; 'entró/cobré/facturé'→ingreso; 'pasé/transferí de X a Y'→transferencia (caja_id=ORIGEN, caja_destino_id=DESTINO). es_retiro=true SOLO si un socio saca plata para sí ('retiré','me llevé','retiro de socio'): ahí mov_tipo=egreso y 'retira'=nombre del socio si se menciona. Matcheá caja/categoría con los IDs del contexto.",
      input_schema: { type: "object", properties: { mov_tipo: { type: "string", enum: ["ingreso", "egreso", "transferencia"] }, monto: { type: "number" }, caja_id: { type: "number" }, caja_destino_id: { type: ["number", "null"] }, categoria_id: { type: ["number", "null"] }, descripcion: { type: "string" }, es_retiro: { type: "boolean" }, retira: { type: ["string", "null"] }, fecha: { type: "string", description: "YYYY-MM-DD; default hoy" } }, required: ["mov_tipo", "monto", "caja_id"] },
      run: async (c, ctx) => {
        const r = armarMovimiento(c, ctx);
        if (r.error) return r.error;
        const ok = await sbInsert("movimientos", r.obj);
        if (!ok) return "⚠️ No se pudo guardar. Intentá de nuevo.";
        if (ctx.otroNum) await avisar(ctx.otroNum, r.aviso);
        return r.confirm;
      } },
    { name: "registrar_cobrar", description: "Registra una CUENTA POR COBRAR (plata que se va a acreditar, todavía NO entró): 'X nos debe', 'nos liquida', 'a cobrar'. 'quien'=de quién viene (no un socio). Si dice cuándo se acredita → fecha_liquidacion ISO -03:00; si dice a qué caja → caja_liq_id.",
      input_schema: { type: "object", properties: { quien: { type: "string" }, monto: { type: "number" }, descripcion: { type: "string" }, fecha: { type: "string" }, fecha_liquidacion: { type: ["string", "null"], description: "ISO con -03:00 si se sabe cuándo, si no null" }, caja_liq_id: { type: ["number", "null"] } }, required: ["quien", "monto"] },
      run: async (c, ctx) => {
        if (!c.quien) return "⚠️ ¿De quién/qué es lo que vas a cobrar?";
        if (!c.monto) return `⚠️ Me falta el monto de lo que vas a cobrar de ${c.quien}.`;
        const fecha = (c.fecha && /^\d{4}-\d{2}-\d{2}$/.test(c.fecha)) ? c.fecha : HOY();
        const cajaLiq = c.caja_liq_id ? ctx.cajas.find(x => x.id === Number(c.caja_liq_id)) : null;
        const fechaLiqISO = (c.fecha_liquidacion && !isNaN(Date.parse(c.fecha_liquidacion))) ? new Date(c.fecha_liquidacion).toISOString() : null;
        const auto = !!(fechaLiqISO && cajaLiq);
        const obj = { id: Date.now(), quien: c.quien, monto: Number(c.monto), descripcion: c.descripcion || "", fecha, fecha_liquidacion: fechaLiqISO, caja_liq_id: cajaLiq ? cajaLiq.id : null, auto_liq: auto, cobrado: false, autor: ctx.autor, creado_en: new Date().toISOString() };
        const ok = await sbInsert("cobrar", obj);
        if (!ok) return "⚠️ No se pudo guardar la cuenta por cobrar.";
        let extra = "";
        if (fechaLiqISO) extra = `\n📅 Liquida: ${fmtDT(fechaLiqISO)}${cajaLiq ? ` → ${cajaLiq.nombre}` : ""}${auto ? " 🤖 (automático)" : (cajaLiq ? "" : " — sin caja, no liquida solo")}`;
        if (ctx.otroNum) await avisar(ctx.otroNum, `📥 ${ctx.autor} anotó a cobrar:\n${c.quien}: ${fmt(c.monto)}${fechaLiqISO ? `\nLiquida ${fmtDT(fechaLiqISO)}${auto ? " (auto)" : ""}` : ""}`);
        return `💰 A cobrar registrado: ${c.quien} ${fmt(c.monto)}${c.descripcion ? ` (${c.descripcion})` : ""}${extra}`;
      } },
    { name: "marcar_cobrado", description: "Marca como COBRADA una cuenta por cobrar pendiente (ya entró la plata): 'ya cobramos lo de X', 'entró lo de X'. Matcheá 'quien' con las pendientes del contexto. Si dice a qué caja entró → caja_id (registra el ingreso).",
      input_schema: { type: "object", properties: { quien: { type: "string" }, caja_id: { type: ["number", "null"] } }, required: ["quien"] },
      run: async (c, ctx) => {
        const q = String(c.quien).toLowerCase();
        const match = (ctx.cobrarPend || []).find(x => x.quien.toLowerCase().includes(q) || q.includes(x.quien.toLowerCase()));
        if (!match) return `⚠️ No encontré una cuenta pendiente de "${c.quien}". Pendientes: ${(ctx.cobrarPend || []).map(x => x.quien).join(", ") || "ninguna"}.`;
        await sbPatch("cobrar", match.id, { cobrado: true });
        let ingTxt = "";
        const caja = c.caja_id ? ctx.cajas.find(x => x.id === Number(c.caja_id)) : null;
        if (caja) {
          await sbInsert("movimientos", { id: Date.now(), tipo: "ingreso", monto: Number(match.monto), caja_id: caja.id, caja_destino_id: null, categoria_id: null, descripcion: `Cobro: ${match.quien}${match.descripcion ? ` - ${match.descripcion}` : ""}`, fecha: HOY(), autor: ctx.autor, es_retiro: false, creado_en: new Date().toISOString() });
          ingTxt = `\n⬇️ Ingreso de ${fmt(match.monto, caja.moneda)} en ${caja.nombre}.`;
        }
        if (ctx.otroNum) await avisar(ctx.otroNum, `📥 ${ctx.autor} marcó como cobrado:\n${match.quien}: ${fmt(match.monto)}${caja ? ` → ${caja.nombre}` : ""}`);
        return `✅ Cobrado: ${match.quien} (${fmt(match.monto)}).${ingTxt}${caja ? "" : "\n(No registré ingreso porque no indicaste la caja.)"}`;
      } },

    { name: "anotar_tarea", description: "Anota una tarea/pendiente compartida (Fran/Santi): 'anotá X', 'recordá que hay que X', 'pendiente: X'. 'para' opcional: nombre del socio si es para uno solo; si es de los dos, null.",
      input_schema: { type: "object", properties: { texto: { type: "string" }, para: { type: ["string", "null"] } }, required: ["texto"] },
      run: async (c, ctx) => {
        const texto = String(c.texto || "").trim();
        if (!texto) return "⚠️ ¿Qué anoto?";
        const para = matchSocio(c.para);
        const ok = await sbInsert("tareas", { id: Date.now(), texto, hecha: false, para, autor: ctx.autor, creado_en: new Date().toISOString() });
        if (!ok) return "⚠️ No se pudo anotar la tarea.";
        if (ctx.otroNum) await avisar(ctx.otroNum, `📝 ${ctx.autor} anotó una tarea:\n• ${texto}${para ? ` (para ${para})` : ""}`);
        return `📝 Anotado: ${texto}${para ? ` (para ${para})` : ""}`;
      } },
    { name: "listar_tareas", description: "Lista las tareas pendientes. 'qué hay pendiente', 'tareas'. Para 'mis tareas / las que me tocan', pasá para=<nombre de quien te habla> (incluye las 'para ambos'). incluir_hechas=true para ver también las completadas recientes.",
      input_schema: { type: "object", properties: { para: { type: ["string", "null"], description: "filtra por destinatario e incluye las 'para ambos'; para 'mis tareas' usá el nombre de quien te habla" }, incluir_hechas: { type: "boolean" } } },
      run: async (c, _ctx) => {
        const rows = await sbGet("tareas", "select=*&order=hecha.asc,creado_en.desc");
        const filtro = matchSocio(c.para);
        const esDe = t => !filtro || t.para == null || t.para === filtro; // null = para ambos → siempre entra
        const pend = rows.filter(t => !t.hecha && esDe(t)).map(t => ({ texto: t.texto, para: t.para || "ambos", autor: t.autor }));
        const hechas = c.incluir_hechas ? rows.filter(t => t.hecha && esDe(t)).slice(0, 10).map(t => ({ texto: t.texto })) : undefined;
        return JSON.stringify({ pendientes: pend, hechas });
      } },
    { name: "completar_tarea", description: "Marca una tarea pendiente como HECHA: 'listo lo de X', 'ya hice X', 'completá X'. Matcheá por texto con las pendientes.",
      input_schema: { type: "object", properties: { texto: { type: "string" } }, required: ["texto"] },
      run: async (c, ctx) => {
        const pend = await sbGet("tareas", "select=*&hecha=eq.false");
        const q = String(c.texto || "").toLowerCase();
        const match = pend.find(t => t.texto.toLowerCase().includes(q) || q.includes(t.texto.toLowerCase()));
        if (!match) return `⚠️ No encontré una tarea pendiente que matchee "${c.texto}". Pendientes: ${pend.map(t => t.texto).join("; ") || "ninguna"}.`;
        await sbPatch("tareas", match.id, { hecha: true, hecha_en: new Date().toISOString() });
        if (ctx.otroNum) await avisar(ctx.otroNum, `✅ ${ctx.autor} completó:\n• ${match.texto}`);
        return `✅ Listo: ${match.texto}`;
      } },
  ];
}

function sysPrompt(ctx) {
  const listaCajas = ctx.cajas.map(c => `${c.nombre} (id ${c.id}, ${c.moneda})`).join("; ") || "ninguna";
  const listaCats = ctx.cats.map(c => `${c.nombre} (id ${c.id}, ${c.tipo})`).join("; ") || "ninguna";
  const listaCobrar = (ctx.cobrarPend || []).map(c => `${c.quien} (${c.monto})`).join("; ") || "ninguna";
  const socios = [...new Set(Object.values(SOCIOS))].join(", ");
  return `Sos el asistente de Cashflow de la empresa (pesos argentinos), que usan los socios ${socios}. Hablás con ${ctx.autor}. HOY es ${HOY()} (hora Argentina).

Podés hacer TRES cosas, según lo que diga el mensaje:
1) REGISTRAR lo que ${ctx.autor} informa (un movimiento, una cuenta por cobrar, o marcar algo como cobrado) → usá las tools registrar_movimiento / registrar_cobrar / marcar_cobrado.
2) RESPONDER consultas sobre la caja → usá las tools de lectura (saldos, totales_periodo, listar_movimientos, a_cobrar, retiros).
3) TAREAS/PENDIENTES compartidos (Fran/Santi): anotar (anotar_tarea), listar (listar_tareas) o marcar hechas (completar_tarea). "anotá / recordá / pendiente" → anotar_tarea; "qué hay pendiente / tareas" → listar_tareas; "mis tareas / las que me tocan" → listar_tareas con para=${ctx.autor}; "listo / ya hice X" → completar_tarea. Cada tarea puede ser para un socio o para los dos (para=null).

Reglas:
- Usá SIEMPRE una tool para cualquier número o dato de la caja; nunca inventes ni estimes de memoria.
- Cuando "esta semana / este mes / ayer", calculá las fechas desde HOY.
- Registrá SOLO lo que el mensaje afirma explícitamente; si falta un dato clave (monto, caja), preguntá en vez de asumir. No registres una consulta.
- Después de registrar, confirmá con el resultado de la tool. Para consultas, respondé en español, directo y conciso, montos en $ ARS con separador de miles.
- Es WhatsApp: texto plano, SIN tablas ni markdown (nada de "|" ni "**"). Para resaltar usá *un asterisco simple*. Listas con • y una línea por ítem. Respuestas breves (es la pantalla de un teléfono).
- Elegí la mínima cantidad de tools necesaria (casi siempre 1).

CAJAS: ${listaCajas}.
CATEGORÍAS: ${listaCats}.
CUENTAS POR COBRAR PENDIENTES: ${listaCobrar}.`;
}

async function callClaude(system, tools, messages) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODELO, max_tokens: 1024, system, tools: tools.length ? tools : undefined, messages }),
  });
  return await r.json();
}

// Loop de tool-use a mano: llama al modelo, ejecuta las tools que pida, repite hasta que
// devuelva texto final (o se agoten las iteraciones → una última pasada sin tools).
export async function agente(texto, ctx) {
  const tools = buildTools();
  const defs = tools.map(({ name, description, input_schema }) => ({ name, description, input_schema }));
  const system = sysPrompt(ctx);
  const messages = [{ role: "user", content: texto }];
  for (let i = 0; i < 4; i++) {
    const data = await callClaude(system, defs, messages);
    const content = data.content || [];
    messages.push({ role: "assistant", content });
    const uses = content.filter(b => b.type === "tool_use");
    if (!uses.length) return content.filter(b => b.type === "text").map(b => b.text).join("").trim();
    const results = [];
    for (const u of uses) {
      const t = tools.find(x => x.name === u.name);
      let out; try { out = t ? await t.run(u.input || {}, ctx) : "tool desconocida"; } catch (e) { out = "error: " + ((e && e.message) || e); }
      results.push({ type: "tool_result", tool_use_id: u.id, content: String(out) });
    }
    messages.push({ role: "user", content: results });
  }
  const data = await callClaude(system, [], messages);
  return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim() || "No pude completar la consulta.";
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/xml");
  if (req.method !== "POST") return res.status(200).send(twiml(null));

  const body = req.body || {};
  const texto = (body.Body || "").trim();
  const fromRaw = (body.From || "").replace("whatsapp:", "");
  const autor = SOCIOS[fromRaw] || "Alguien";
  const otroNum = Object.keys(SOCIOS).find(n => n !== fromRaw);
  if (!texto) return res.status(200).send(twiml(null));

  try {
    try { await liquidarVencidas(); } catch {}
    const [cajas, cats, cobrarPend] = await Promise.all([
      sbGet("cajas", "select=*&order=orden.asc"),
      sbGet("categorias", "select=*"),
      sbGet("cobrar", "select=*&cobrado=eq.false"),
    ]);
    let _movs = null;
    const getMovs = async () => { if (!_movs) _movs = await sbGet("movimientos", "select=*"); return _movs; };
    const ctx = { autor, otroNum, cajas, cats, cobrarPend, getMovs };
    const reply = await agente(texto, ctx);
    return res.status(200).send(twiml(reply || "No pude procesar el mensaje."));
  } catch (err) {
    return res.status(200).send(twiml("⚠️ Hubo un error procesando el mensaje."));
  }
}

// Self-check del camino de plata + agregados. No corre en Vercel (env sin setear).
// Correr:  CF_SELFTEST=1 node --input-type=module -e "await import('./whatsapp.js')"
function demo() {
  const assert = (c, m) => { if (!c) throw new Error("SELFTEST: " + m); };
  const ctx = { autor: "Fran", cajas: [{ id: 1, nombre: "Cash", moneda: "ARS" }, { id: 2, nombre: "Banco", moneda: "ARS" }], cats: [{ id: 9, nombre: "Proveedores" }] };
  // egreso normal
  let r = armarMovimiento({ mov_tipo: "egreso", monto: 5000, caja_id: 1, categoria_id: 9, descripcion: "pago" }, ctx);
  assert(!r.error && r.obj.tipo === "egreso" && r.obj.monto === 5000 && r.obj.categoria_id === 9 && !r.obj.es_retiro, "egreso mal armado");
  // retiro con 'retira' → autor = quien retira, no el remitente
  r = armarMovimiento({ mov_tipo: "egreso", monto: 100000, caja_id: 2, es_retiro: true, retira: "Santi" }, ctx);
  assert(r.obj.es_retiro && r.obj.autor === "Santi", "retiro no asigna autor 'retira'");
  // caja inexistente → error, no inserta
  assert(armarMovimiento({ mov_tipo: "egreso", monto: 1, caja_id: 999 }, ctx).error, "caja inválida no rechazada");
  // transferencia sin destino → error
  assert(armarMovimiento({ mov_tipo: "transferencia", monto: 1, caja_id: 1 }, ctx).error, "transfer sin destino no rechazada");
  // agregados
  const movs = [
    { tipo: "ingreso", monto: 1000, caja_id: 1, fecha: "2026-07-05" },
    { tipo: "egreso", monto: 300, caja_id: 1, categoria_id: 9, fecha: "2026-07-06" },
    { tipo: "egreso", monto: 200, caja_id: 1, categoria_id: 9, fecha: "2026-06-30" },
    { tipo: "transferencia", monto: 500, caja_id: 1, caja_destino_id: 2, fecha: "2026-07-07" },
  ];
  assert(saldoCaja(movs, 1) === 1000 - 300 - 200 - 500, "saldoCaja mal"); // all-time: incluye junio
  assert(saldoCaja(movs, 2) === 500, "saldoCaja destino mal");
  const t = totalesPeriodo(movs, "2026-07-01", "2026-07-31");
  assert(t.ingresos === 1000 && t.egresos === 300 && t.neto === 700, "totalesPeriodo mal (rango excluye junio)");
  console.log("SELFTEST OK");
}
if (process.env.CF_SELFTEST) demo();
