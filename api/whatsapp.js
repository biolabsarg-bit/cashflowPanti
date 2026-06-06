// Webhook de WhatsApp para Cashflow Empresa.
// Registra movimientos (ingreso/egreso/transferencia), responde consultas,
// identifica autor por número y manda aviso cruzado al otro socio.

const SB_URL = "https://nmhxgkruaiohdpennpga.supabase.co";
const SB_KEY = "sb_publishable_e3OwzCJn8N7zLE-j8i2Suw_PKqqPgRx";
const SB_H = { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}`, "Content-Type": "application/json" };

// Mapeo de números → personas
const SOCIOS = {
  "+5491157712384": "Fran",
  "+5491158592920": "Santi",
};
const BOT_NUM = "whatsapp:+19312402359";

const HOY = () => new Date().toISOString().slice(0, 10);
const fmt = (n,mon="ARS") => (mon==="USD"?"US$":"$") + Number(n||0).toLocaleString("es-AR");
const dispCorto = iso => { const [,m,d]=iso.split("-"); return `${d}/${m}`; };

// ---- Supabase ----
async function sbGet(tabla, query="") {
  const r = await fetch(`${SB_URL}/rest/v1/${tabla}?${query}`, { headers: SB_H });
  return r.ok ? await r.json() : [];
}
async function sbInsert(tabla, obj) {
  const r = await fetch(`${SB_URL}/rest/v1/${tabla}`, { method:"POST", headers:{...SB_H,"Prefer":"return=representation"}, body:JSON.stringify(obj) });
  return r.ok ? (await r.json())[0] : null;
}

function twiml(msg) {
  if (!msg) return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>";
  const safe = msg.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`;
}

// Envía un WhatsApp al otro socio vía API de Twilio (aviso cruzado)
async function avisar(aQuienNum, texto) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  console.log("AVISO DEBUG → destinatario:", aQuienNum, "| tiene SID:", !!sid, "| tiene token:", !!token);
  if (!sid || !token) return;
try {
    const body = new URLSearchParams();
    body.append("To", `whatsapp:${aQuienNum}`);
    body.append("From", BOT_NUM);
    body.append("Body", texto);
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method:"POST",
      headers:{ "Authorization":"Basic "+Buffer.from(`${sid}:${token}`).toString("base64"), "Content-Type":"application/x-www-form-urlencoded" },
      body: body.toString()
    });
  } catch {}
}

async function clasificar(texto, cajas, cats) {
  const hoy = HOY();
  const listaCajas = cajas.map(c=>`${c.nombre} (id ${c.id}, ${c.moneda})`).join("; ") || "ninguna";
  const listaCats = cats.map(c=>`${c.nombre} (id ${c.id}, ${c.tipo})`).join("; ") || "ninguna";
  const sys = `Sos un clasificador para una app de cashflow empresarial (pesos argentinos). HOY es ${hoy}.
CAJAS DISPONIBLES: ${listaCajas}.
CATEGORÍAS DISPONIBLES: ${listaCats}.
Analizá el mensaje y devolvé SOLO JSON (sin backticks).

TIPOS:
1. "movimiento" — registra un movimiento de dinero.
   {"tipo":"movimiento","mov_tipo":"ingreso"|"egreso"|"transferencia","monto":50000,"caja_id":123,"caja_destino_id":null,"categoria_id":456|null,"descripcion":"pago proveedor","fecha":"${hoy}"}
   - "pagué/gasté/salió" → egreso. "entró/cobré/facturé/ingresó" → ingreso. "pasé/transferí/moví de X a Y" → transferencia.
   - Para transferencia: caja_id es ORIGEN, caja_destino_id es DESTINO.
   - Matcheá la caja y categoría mencionadas con los IDs de las listas. Si no se menciona caja clara, usá la primera. Si no hay categoría clara, categoria_id null.
2. "consulta" — {"tipo":"consulta","que":"saldos"|"ingresos_mes"|"egresos_mes"|"saldo_caja"|"por_categoria","caja_id":null,"categoria_id":null}
   "cuánto hay en caja"→saldos; "cuánto facturamos/ingresó este mes"→ingresos_mes; "cuánto gastamos este mes"→egresos_mes;
   "cuánto hay en banco"→saldo_caja con caja_id; "cuánto gastamos en proveedores"→por_categoria con categoria_id.
3. "otro" — {"tipo":"otro"}

Reglas: monto en cualquier parte; fecha a YYYY-MM-DD (si no hay, ${hoy}); descripción concisa.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "x-api-key":process.env.ANTHROPIC_API_KEY, "anthropic-version":"2023-06-01" },
    body: JSON.stringify({ model:"claude-haiku-4-5-20251001", max_tokens:400, system:sys, messages:[{role:"user",content:texto}] })
  });
  const data = await res.json();
  const raw = (data.content||[]).map(i=>i.text||"").join("").trim();
  try { return JSON.parse(raw.replace(/```json|```/g,"").trim()); }
  catch { return { tipo:"otro" }; }
}

function saldoCaja(movs, id) {
  let s = 0;
  movs.forEach(m=>{
    if(m.tipo==="ingreso" && m.caja_id===id) s += Number(m.monto);
    else if(m.tipo==="egreso" && m.caja_id===id) s -= Number(m.monto);
    else if(m.tipo==="transferencia"){ if(m.caja_id===id) s -= Number(m.monto); if(m.caja_destino_id===id) s += Number(m.monto); }
  });
  return s;
}
const mesKey = () => HOY().slice(0,7);

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
    const [cajas, cats] = await Promise.all([
      sbGet("cajas","select=*&order=orden.asc"),
      sbGet("categorias","select=*"),
    ]);

    const c = await clasificar(texto, cajas, cats);

    // ---- MOVIMIENTO ----
    if (c.tipo === "movimiento" && c.monto && c.mov_tipo && c.caja_id) {
      const caja = cajas.find(x=>x.id===Number(c.caja_id));
      const cajaD = c.caja_destino_id ? cajas.find(x=>x.id===Number(c.caja_destino_id)) : null;
      const cat = c.categoria_id ? cats.find(x=>x.id===Number(c.categoria_id)) : null;
      if (!caja) return res.status(200).send(twiml("⚠️ No identifiqué la caja. Nombrala como la tenés en la app."));
      if (c.mov_tipo==="transferencia" && !cajaD) return res.status(200).send(twiml("⚠️ Para transferencia indicá caja origen y destino."));

      const fecha = (c.fecha && /^\d{4}-\d{2}-\d{2}$/.test(c.fecha)) ? c.fecha : HOY();
      const obj = {
        id: Date.now(), tipo:c.mov_tipo, monto:c.monto, caja_id:caja.id,
        caja_destino_id: cajaD?cajaD.id:null, categoria_id: cat?cat.id:null,
        descripcion: c.descripcion || (c.mov_tipo==="transferencia"?"Transferencia":""),
        fecha, autor, creado_en:new Date().toISOString()
      };
      const ok = await sbInsert("movimientos", obj);
      if (!ok) return res.status(200).send(twiml("⚠️ No se pudo guardar. Intentá de nuevo."));

      const tipoTxt = c.mov_tipo==="ingreso"?"⬇️ Ingreso":c.mov_tipo==="egreso"?"⬆️ Egreso":"🔁 Transferencia";
      const detalle = c.mov_tipo==="transferencia"
        ? `${fmt(c.monto,caja.moneda)} de ${caja.nombre} → ${cajaD.nombre}`
        : `${fmt(c.monto,caja.moneda)} · ${caja.nombre}${cat?` · ${cat.nombre}`:""}`;
      const cuando = fecha===HOY()?"hoy":dispCorto(fecha);

      // Aviso cruzado al otro socio
     // Aviso cruzado al otro socio
      if (otroNum) {
        await avisar(otroNum, `📥 ${autor} registró:\n${tipoTxt} ${detalle}${obj.descripcion?` (${obj.descripcion})`:""} · ${cuando}`);
      }

      return res.status(200).send(twiml(`${tipoTxt} registrado: ${detalle}${obj.descripcion?` (${obj.descripcion})`:""} · ${cuando}`));
    }

    // ---- CONSULTA ----
    if (c.tipo === "consulta") {
      const movs = await sbGet("movimientos","select=*");
      if (c.que === "saldos") {
        if (cajas.length===0) return res.status(200).send(twiml("No hay cajas creadas todavía."));
        const lineas = cajas.map(cj=>`${cj.icon||"💰"} ${cj.nombre}: ${fmt(saldoCaja(movs,cj.id),cj.moneda)}`).join("\n");
        return res.status(200).send(twiml("💼 Saldos actuales:\n"+lineas));
      }
      if (c.que === "saldo_caja" && c.caja_id) {
        const cj = cajas.find(x=>x.id===Number(c.caja_id));
        if(!cj) return res.status(200).send(twiml("No encontré esa caja."));
        return res.status(200).send(twiml(`${cj.icon||"💰"} ${cj.nombre}: ${fmt(saldoCaja(movs,cj.id),cj.moneda)}`));
      }
      if (c.que === "ingresos_mes") {
        const t = movs.filter(m=>m.tipo==="ingreso"&&String(m.fecha).slice(0,7)===mesKey()).reduce((s,m)=>s+Number(m.monto),0);
        return res.status(200).send(twiml(`📊 Ingresos del mes: ${fmt(t)}`));
      }
      if (c.que === "egresos_mes") {
        const t = movs.filter(m=>m.tipo==="egreso"&&String(m.fecha).slice(0,7)===mesKey()).reduce((s,m)=>s+Number(m.monto),0);
        return res.status(200).send(twiml(`📊 Egresos del mes: ${fmt(t)}`));
      }
      if (c.que === "por_categoria" && c.categoria_id) {
        const cat = cats.find(x=>x.id===Number(c.categoria_id));
        const t = movs.filter(m=>m.categoria_id===Number(c.categoria_id)&&String(m.fecha).slice(0,7)===mesKey()).reduce((s,m)=>s+Number(m.monto),0);
        return res.status(200).send(twiml(`📊 ${cat?cat.nombre:"Categoría"} este mes: ${fmt(t)}`));
      }
      return res.status(200).send(twiml("No entendí la consulta. Probá: '¿cuánto hay en caja?' o '¿cuánto facturamos este mes?'"));
    }

    return res.status(200).send(twiml("Mandame un movimiento (ej: 'pagué 50000 a proveedor en efectivo') o una consulta ('¿cuánto hay en caja?')."));

  } catch (err) {
    return res.status(200).send(twiml("⚠️ Hubo un error procesando el mensaje."));
  }
}
