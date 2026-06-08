// Endpoint de cron: liquida automáticamente las cuentas por cobrar vencidas.
// Va en /api/cron-liquidar.js y lo dispara Vercel Cron (ver vercel.json).
// También se puede llamar manualmente: GET /api/cron-liquidar

const SB_URL = "https://nmhxgkruaiohdpennpga.supabase.co";
const SB_KEY = "sb_publishable_e3OwzCJn8N7zLE-j8i2Suw_PKqqPgRx";
const SB_H = { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}`, "Content-Type": "application/json" };

const HOY = () => new Date().toISOString().slice(0, 10);

async function sbGet(tabla, query="") {
  const r = await fetch(`${SB_URL}/rest/v1/${tabla}?${query}`, { headers: SB_H });
  return r.ok ? await r.json() : [];
}
async function sbInsert(tabla, obj) {
  const r = await fetch(`${SB_URL}/rest/v1/${tabla}`, { method:"POST", headers:{...SB_H,"Prefer":"return=representation"}, body:JSON.stringify(obj) });
  return r.ok ? (await r.json())[0] : null;
}

export default async function handler(req, res) {
  let liquidadas = 0;
  try {
    const due = await sbGet("cobrar", "select=*&cobrado=eq.false&auto_liq=eq.true");
    const ahora = Date.now();
    for (const x of due) {
      if (!x.fecha_liquidacion || !x.caja_liq_id) continue;
      if (new Date(x.fecha_liquidacion).getTime() > ahora) continue;
      // Reclama la fila de forma condicional para no duplicar el ingreso
      const r = await fetch(`${SB_URL}/rest/v1/cobrar?id=eq.${x.id}&cobrado=eq.false`, { method:"PATCH", headers:{...SB_H,"Prefer":"return=representation"}, body:JSON.stringify({cobrado:true}) });
      const rows = r.ok ? await r.json() : [];
      if (!rows.length) continue;
      const fechaMov = String(x.fecha_liquidacion).slice(0,10) || HOY();
      await sbInsert("movimientos", {
        id: Date.now()+Math.floor(Math.random()*1000), tipo:"ingreso", monto:Number(x.monto),
        caja_id:Number(x.caja_liq_id), caja_destino_id:null, categoria_id:null,
        descripcion:`Liquidación: ${x.quien}${x.descripcion?` - ${x.descripcion}`:""}`,
        fecha:fechaMov, autor:x.autor||"Sistema", es_retiro:false, creado_en:new Date().toISOString()
      });
      liquidadas++;
    }
    return res.status(200).json({ ok:true, liquidadas });
  } catch (err) {
    return res.status(200).json({ ok:false, error:String(err), liquidadas });
  }
}
