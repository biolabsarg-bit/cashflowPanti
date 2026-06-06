const { useState, useRef, useEffect, useCallback } = React;

// ===== CONFIG =====
const SB_URL = "https://nmhxgkruaiohdpennpga.supabase.co";
const SB_KEY = "sb_publishable_e3OwzCJn8N7zLE-j8i2Suw_PKqqPgRx";
const SB_H = { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}`, "Content-Type": "application/json" };
const PASSWORD = "empresa2026";          // 🔐 contraseña compartida
const USUARIOS = ["Fran", "Santi"];       // usuarios
// ==================

// ---- Supabase REST helpers ----
async function sbGet(tabla, query="") {
  const r = await fetch(`${SB_URL}/rest/v1/${tabla}?${query}`, { headers: SB_H });
  return r.ok ? await r.json() : [];
}
async function sbPost(tabla, obj) {
  const r = await fetch(`${SB_URL}/rest/v1/${tabla}`, { method:"POST", headers:{...SB_H,"Prefer":"return=representation"}, body:JSON.stringify(obj) });
  if(!r.ok) throw new Error("post failed");
  return (await r.json())[0];
}
async function sbPatch(tabla, id, cambios) {
  await fetch(`${SB_URL}/rest/v1/${tabla}?id=eq.${id}`, { method:"PATCH", headers:SB_H, body:JSON.stringify(cambios) });
}
async function sbDel(tabla, id) {
  await fetch(`${SB_URL}/rest/v1/${tabla}?id=eq.${id}`, { method:"DELETE", headers:SB_H });
}

const ICONOS_CAJA = ["💵","🏦","💳","💰","🪙","💴","💶","🏧"];
const COLORES = ["#27ae60","#2980b9","#8e44ad","#d68910","#16a085","#c0392b","#2c3e50","#e67e22"];
const ICONOS_CAT = ["🏷️","📦","🧾","👷","⚡","🛒","🚚","💼","📊","🔧","🏠","✈️","💡","🎯"];

const fmt = (n,mon="ARS") => (mon==="USD"?"US$":"$") + Number(n||0).toLocaleString("es-AR");
const today = () => new Date().toISOString().slice(0,10);
const disp = iso => { const [y,m,d]=iso.split("-"); return `${d}/${m}/${y}`; };
const horaDe = ts => { try { const d=new Date(ts); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; } catch { return ""; } };

const THEMES = {
  light: { bg:"#fff", bg2:"#f6f7f9", card:"#fff", text:"#1a1a1a", text2:"#888", border:"#eaeaea", border2:"#d5d5d5", inputBg:"#f6f7f9", divider:"#f0f0f0" },
  dark:  { bg:"#14161a", bg2:"#1b1e24", card:"#1e2228", text:"#e8e8e8", text2:"#8a8f98", border:"#2a2e36", border2:"#3a3f48", inputBg:"#23272e", divider:"#262a31" },
};

const TIPOS = {
  ingreso:       { label:"Ingreso", color:"#27ae60", icon:"⬇️", signo:1 },
  egreso:        { label:"Egreso",  color:"#e74c3c", icon:"⬆️", signo:-1 },
  transferencia: { label:"Transfer.", color:"#2980b9", icon:"🔁", signo:0 },
};

// Login + selección de usuario
function Login({ onOk, dark }) {
  const T = dark ? THEMES.dark : THEMES.light;
  const e = React.createElement;
  const [pass, setPass] = useState("");
  const [error, setError] = useState(false);
  const [paso, setPaso] = useState("pass");
  function verificar(){ if(pass===PASSWORD){ setPaso("user"); } else setError(true); }
  function elegir(u){ try{ localStorage.setItem("cf_auth","1"); localStorage.setItem("cf_user",u);}catch{} onOk(u); }
  return e("div",{style:{fontFamily:"system-ui,sans-serif",minHeight:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",background:T.bg,padding:20}},
    e("div",{style:{width:"100%",maxWidth:320,textAlign:"center"}},
      e("div",{style:{fontSize:46,marginBottom:8}},"🏢"),
      e("p",{style:{margin:"0 0 4px",fontSize:22,fontWeight:600,color:T.text}},"Cashflow Empresa"),
      paso==="pass"?[
        e("p",{key:"t",style:{margin:"0 0 22px",fontSize:13,color:T.text2}},"Ingresá la contraseña"),
        e("input",{key:"i",type:"password",value:pass,autoFocus:true,onChange:ev=>{setPass(ev.target.value);setError(false);},onKeyDown:ev=>{if(ev.key==="Enter")verificar();},placeholder:"Contraseña",style:{width:"100%",padding:"12px 16px",borderRadius:12,border:`1px solid ${error?"#e74c3c":T.border2}`,background:T.inputBg,color:T.text,fontSize:15,outline:"none",marginBottom:12,boxSizing:"border-box"}}),
        error&&e("p",{key:"e",style:{margin:"0 0 12px",fontSize:13,color:"#e74c3c"}},"Contraseña incorrecta"),
        e("button",{key:"b",onClick:verificar,style:{width:"100%",padding:"12px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#27ae60,#2980b9)",color:"#fff",fontSize:15,fontWeight:600,cursor:"pointer"}},"Continuar")
      ]:[
        e("p",{key:"t",style:{margin:"0 0 22px",fontSize:13,color:T.text2}},"¿Quién sos?"),
        ...USUARIOS.map(u=>e("button",{key:u,onClick:()=>elegir(u),style:{width:"100%",padding:"14px",borderRadius:12,border:`1px solid ${T.border2}`,background:T.card,color:T.text,fontSize:16,fontWeight:600,cursor:"pointer",marginBottom:10}},u))
      ]
    )
  );
}

function App() {
  const [dark, setDark] = useState(()=>{ try { return localStorage.getItem("cf_tema")==="dark"; } catch { return false; } });
  const [auth, setAuth] = useState(()=>{ try { return localStorage.getItem("cf_auth")==="1"; } catch { return false; } });
  const [usuario, setUsuario] = useState(()=>{ try { return localStorage.getItem("cf_user")||""; } catch { return ""; } });
  const T = dark ? THEMES.dark : THEMES.light;

  const [cajas, setCajas] = useState([]);
  const [cats, setCats] = useState([]);
  const [movs, setMovs] = useState([]);
  const [syncing, setSyncing] = useState(true);
  const [view, setView] = useState("inicio");
  const [dolar, setDolar] = useState(null);

  // Form nuevo movimiento
  const [tipo, setTipo] = useState("egreso");
  const [monto, setMonto] = useState("");
  const [cajaId, setCajaId] = useState("");
  const [cajaDest, setCajaDest] = useState("");
  const [catId, setCatId] = useState("");
  const [descr, setDescr] = useState("");
  const [fecha, setFecha] = useState(today());

  // Filtros
  const [fCaja, setFCaja] = useState("");
  const [fAutor, setFAutor] = useState("");
  const [fTipo, setFTipo] = useState("");

  // Config
  const [nuevaCaja, setNuevaCaja] = useState({nombre:"",moneda:"ARS"});
  const [nuevaCat, setNuevaCat] = useState({nombre:"",tipo:"ambos"});
  const [confirmDel, setConfirmDel] = useState(null);
  const [confirmCajaDel, setConfirmCajaDel] = useState(null);
  const [confirmCatDel, setConfirmCatDel] = useState(null);

  useEffect(()=>{ try { localStorage.setItem("cf_tema", dark?"dark":"light"); } catch {} },[dark]);

  const cargar = useCallback(async()=>{
    try {
      const [c, ca, m] = await Promise.all([
        sbGet("cajas","select=*&order=orden.asc,id.asc"),
        sbGet("categorias","select=*&order=id.asc"),
        sbGet("movimientos","select=*&order=fecha.desc,creado_en.desc"),
      ]);
      setCajas(c); setCats(ca); setMovs(m);
    } catch {}
    setSyncing(false);
  },[]);

  useEffect(()=>{ if(auth) cargar(); },[auth,cargar]);

  // Polling cada 12s para ver lo que carga el otro
  useEffect(()=>{
    if(!auth) return;
    const iv = setInterval(cargar, 12000);
    return ()=>clearInterval(iv);
  },[auth,cargar]);

  // Dólar blue
  useEffect(()=>{
    if(!auth) return;
    (async()=>{
      try {
        const r = await fetch("https://dolarapi.com/v1/dolares/blue");
        if(r.ok){ const d=await r.json(); setDolar(d); }
      } catch {}
    })();
  },[auth]);

  const e = React.createElement;
  if (!auth) return e(Login, { onOk:(u)=>{setAuth(true);setUsuario(u);}, dark });

  // Saldos por caja
  function saldoCaja(id){
    let s = 0;
    movs.forEach(m=>{
      if(m.tipo==="ingreso" && m.caja_id===id) s += Number(m.monto);
      else if(m.tipo==="egreso" && m.caja_id===id) s -= Number(m.monto);
      else if(m.tipo==="transferencia"){ if(m.caja_id===id) s -= Number(m.monto); if(m.caja_destino_id===id) s += Number(m.monto); }
    });
    return s;
  }

  async function guardarMov(){
    const m = parseFloat(monto);
    if(!m || m<=0 || !cajaId) return;
    if(tipo==="transferencia" && (!cajaDest || cajaDest===cajaId)) return;
    const obj = {
      id: Date.now(), tipo, monto:m, caja_id:Number(cajaId),
      caja_destino_id: tipo==="transferencia" ? Number(cajaDest) : null,
      categoria_id: catId ? Number(catId) : null,
      descripcion: descr || (tipo==="transferencia"?"Transferencia":""),
      fecha, autor:usuario, creado_en:new Date().toISOString()
    };
    try {
      const g = await sbPost("movimientos", obj);
      setMovs(prev=>[g,...prev]);
      setMonto(""); setDescr(""); setCatId(""); setCajaDest("");
      setView("movimientos");
    } catch {}
  }
  async function borrarMov(id){ setMovs(prev=>prev.filter(x=>x.id!==id)); setConfirmDel(null); try{ await sbDel("movimientos",id); }catch{} }

  async function agregarCaja(){
    const nombre = nuevaCaja.nombre.trim(); if(!nombre) return;
    const idx = cajas.length;
    const obj = { id:Date.now(), nombre, moneda:nuevaCaja.moneda, icon:ICONOS_CAJA[idx%ICONOS_CAJA.length], color:COLORES[idx%COLORES.length], orden:idx };
    try { const g=await sbPost("cajas",obj); setCajas(prev=>[...prev,g]); setNuevaCaja({nombre:"",moneda:"ARS"}); } catch {}
  }
  async function borrarCaja(id){ setCajas(prev=>prev.filter(x=>x.id!==id)); setConfirmCajaDel(null); try{ await sbDel("cajas",id); }catch{} }

  async function agregarCat(){
    const nombre = nuevaCat.nombre.trim(); if(!nombre) return;
    const idx = cats.length;
    const obj = { id:Date.now(), nombre, tipo:nuevaCat.tipo, icon:ICONOS_CAT[idx%ICONOS_CAT.length], color:COLORES[idx%COLORES.length] };
    try { const g=await sbPost("categorias",obj); setCats(prev=>[...prev,g]); setNuevaCat({nombre:"",tipo:"ambos"}); } catch {}
  }
  async function borrarCat(id){ setCats(prev=>prev.filter(x=>x.id!==id)); setConfirmCatDel(null); try{ await sbDel("categorias",id); }catch{} }

  function cerrarSesion(){ try{ localStorage.removeItem("cf_auth"); localStorage.removeItem("cf_user"); }catch{} setAuth(false); }
  function cambiarUsuario(){ try{ localStorage.removeItem("cf_user"); }catch{} setAuth(false); }

  const cajaById = id => cajas.find(c=>c.id===id);
  const catById = id => cats.find(c=>c.id===id);

  // Movimientos filtrados
  const movsFil = movs.filter(m=>{
    if(fCaja && m.caja_id!==Number(fCaja) && m.caja_destino_id!==Number(fCaja)) return false;
    if(fAutor && m.autor!==fAutor) return false;
    if(fTipo && m.tipo!==fTipo) return false;
    return true;
  });

  // Totales del mes actual
  const mesKey = today().slice(0,7);
  const movsMes = movs.filter(m=>String(m.fecha).slice(0,7)===mesKey);
  const ingresosMes = movsMes.filter(m=>m.tipo==="ingreso").reduce((s,m)=>s+Number(m.monto),0);
  const egresosMes = movsMes.filter(m=>m.tipo==="egreso").reduce((s,m)=>s+Number(m.monto),0);

  const css=`
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:${T.bg};overscroll-behavior:none}
    .tab{flex:1;padding:11px 2px;background:none;border:none;border-bottom:2.5px solid transparent;cursor:pointer;font-size:11.5px;color:${T.text2};transition:all .2s}
    .tab:hover{background:${T.bg2}}
    .inp{font-size:14px;border:0.5px solid ${T.border2};border-radius:10px;padding:10px 12px;background:${T.inputBg};color:${T.text};outline:none;width:100%}
    .inp:focus{border-color:#2980b9}
    .btn{border:none;border-radius:10px;padding:11px 16px;font-size:14px;font-weight:600;cursor:pointer;transition:all .15s}
    .btn:hover{filter:brightness(1.08)}
    .card{background:${T.card};border:0.5px solid ${T.border};border-radius:14px;padding:14px}
    .icon-btn{background:${T.bg2};border:0.5px solid ${T.border};border-radius:50%;width:34px;height:34px;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:${T.text2}}
    .seg{flex:1;padding:9px;border:0.5px solid ${T.border2};background:${T.inputBg};color:${T.text2};cursor:pointer;font-size:13px;font-weight:600;transition:all .15s}
    .del-btn{background:none;border:none;cursor:pointer;font-size:14px;color:#bbb}
    .conf-yes{background:#e74c3c;color:#fff;border:none;border-radius:8px;padding:3px 10px;font-size:12px;cursor:pointer}
    .conf-no{background:none;border:0.5px solid ${T.border2};color:${T.text2};border-radius:8px;padding:3px 10px;font-size:12px;cursor:pointer}
    .chip{display:flex;align-items:center;gap:6px;padding:7px 11px;border-radius:11px;border:0.5px solid ${T.border};background:${T.card}}
  `;

  // ---- Vistas ----
  const Header = e("div",{style:{borderBottom:`0.5px solid ${T.border}`}},
    e("div",{style:{padding:"13px 18px 0",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}},
      e("div",null,
        e("p",{style:{margin:0,fontSize:17,fontWeight:600,color:T.text}},"🏢 Cashflow",syncing?e("span",{style:{fontSize:11,color:T.text2,marginLeft:8,fontWeight:400}},"sync..."):null),
        e("p",{style:{margin:0,fontSize:11.5,color:T.text2,marginTop:2}},`Sos: ${usuario} · ${movs.length} movimientos`)
      ),
      e("div",{style:{display:"flex",alignItems:"center",gap:7}},
        e("button",{className:"icon-btn",onClick:cambiarUsuario,title:"Cambiar usuario"},"👤"),
        e("button",{className:"icon-btn",onClick:()=>setDark(!dark),title:"Tema"},dark?"☀️":"🌙"),
        e("button",{className:"icon-btn",onClick:cerrarSesion,title:"Salir"},"⏻")
      )
    ),
    e("div",{style:{display:"flex"}},
      [["inicio","🏠 Inicio","#27ae60"],["nuevo","➕ Cargar","#2980b9"],["movimientos","📋 Movim.","#8e44ad"],["config","⚙️ Config","#d68910"]].map(([k,l,c])=>
        e("button",{key:k,className:"tab",style:{borderBottomColor:view===k?c:"transparent",color:view===k?c:T.text2,fontWeight:view===k?700:400},onClick:()=>setView(k)},l)
      )
    )
  );

  // INICIO: cajas + dólar + resumen mes
  const Inicio = e("div",{style:{flex:1,overflowY:"auto",padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}},
    dolar && e("div",{className:"card",style:{display:"flex",justifyContent:"space-between",alignItems:"center",background:"linear-gradient(135deg,#27ae6022,#2980b922)"}},
      e("span",{style:{fontSize:13,color:T.text2}},"💵 Dólar blue (ref.)"),
      e("span",{style:{fontSize:14,fontWeight:600,color:T.text}},`Compra ${fmt(dolar.compra)} · Venta ${fmt(dolar.venta)}`)
    ),
    e("div",{style:{display:"flex",gap:8}},
      e("div",{className:"card",style:{flex:1,borderTop:"3px solid #27ae60"}},
        e("p",{style:{margin:0,fontSize:11,color:T.text2}},"Ingresos del mes"),
        e("p",{style:{margin:"4px 0 0",fontSize:17,fontWeight:600,color:"#27ae60"}},fmt(ingresosMes))
      ),
      e("div",{className:"card",style:{flex:1,borderTop:"3px solid #e74c3c"}},
        e("p",{style:{margin:0,fontSize:11,color:T.text2}},"Egresos del mes"),
        e("p",{style:{margin:"4px 0 0",fontSize:17,fontWeight:600,color:"#e74c3c"}},fmt(egresosMes))
      )
    ),
    e("p",{style:{margin:"4px 0 -4px",fontSize:13,fontWeight:600,color:T.text}},"Cajas"),
    cajas.length===0 && e("p",{style:{color:T.text2,fontSize:14,textAlign:"center",padding:"20px 0"}},syncing?"Cargando...":"Creá tu primera caja en ⚙️ Config"),
    cajas.map(c=>{
      const s = saldoCaja(c.id);
      return e("div",{key:c.id,className:"card",style:{borderLeft:`3px solid ${c.color}`,display:"flex",alignItems:"center",gap:12}},
        e("div",{style:{width:42,height:42,borderRadius:12,background:c.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:21}},c.icon),
        e("div",{style:{flex:1}},
          e("p",{style:{margin:0,fontSize:15,fontWeight:600,color:T.text}},c.nombre),
          e("p",{style:{margin:0,fontSize:11,color:T.text2}},c.moneda)
        ),
        e("p",{style:{margin:0,fontSize:18,fontWeight:700,color:s<0?"#e74c3c":T.text}},fmt(s,c.moneda))
      );
    })
  );

  // NUEVO: form de movimiento
  const catsValidas = cats.filter(c=>c.tipo==="ambos"||c.tipo===tipo||tipo==="transferencia");
  const Nuevo = e("div",{style:{flex:1,overflowY:"auto",padding:"14px 16px",display:"flex",flexDirection:"column",gap:14}},
    e("div",{style:{display:"flex",borderRadius:11,overflow:"hidden",border:`0.5px solid ${T.border2}`}},
      Object.entries(TIPOS).map(([k,v],i)=>
        e("button",{key:k,className:"seg",onClick:()=>setTipo(k),style:{background:tipo===k?v.color:T.inputBg,color:tipo===k?"#fff":T.text2,borderLeft:i>0?`0.5px solid ${T.border2}`:"none"}},`${v.icon} ${v.label}`)
      )
    ),
    e("div",null,
      e("p",{style:{fontSize:11,color:T.text2,margin:"0 0 5px",fontWeight:600}},"MONTO"),
      e("input",{type:"number",className:"inp",style:{fontSize:20,fontWeight:600},value:monto,onChange:ev=>setMonto(ev.target.value),placeholder:"0"})
    ),
    e("div",null,
      e("p",{style:{fontSize:11,color:T.text2,margin:"0 0 5px",fontWeight:600}},tipo==="transferencia"?"DESDE LA CAJA":"CAJA"),
      e("select",{className:"inp",value:cajaId,onChange:ev=>setCajaId(ev.target.value)},
        e("option",{value:""},"Elegí una caja..."),
        cajas.map(c=>e("option",{key:c.id,value:c.id},`${c.icon} ${c.nombre} (${c.moneda})`))
      )
    ),
    tipo==="transferencia" && e("div",null,
      e("p",{style:{fontSize:11,color:T.text2,margin:"0 0 5px",fontWeight:600}},"HACIA LA CAJA"),
      e("select",{className:"inp",value:cajaDest,onChange:ev=>setCajaDest(ev.target.value)},
        e("option",{value:""},"Elegí una caja..."),
        cajas.filter(c=>c.id!==Number(cajaId)).map(c=>e("option",{key:c.id,value:c.id},`${c.icon} ${c.nombre} (${c.moneda})`))
      )
    ),
    tipo!=="transferencia" && e("div",null,
      e("p",{style:{fontSize:11,color:T.text2,margin:"0 0 5px",fontWeight:600}},"CATEGORÍA"),
      e("select",{className:"inp",value:catId,onChange:ev=>setCatId(ev.target.value)},
        e("option",{value:""},"Sin categoría"),
        catsValidas.map(c=>e("option",{key:c.id,value:c.id},`${c.icon} ${c.nombre}`))
      )
    ),
    e("div",{style:{display:"flex",gap:10}},
      e("div",{style:{flex:2}},
        e("p",{style:{fontSize:11,color:T.text2,margin:"0 0 5px",fontWeight:600}},"DESCRIPCIÓN"),
        e("input",{className:"inp",value:descr,onChange:ev=>setDescr(ev.target.value),placeholder:"ej: pago proveedor"})
      ),
      e("div",{style:{flex:1}},
        e("p",{style:{fontSize:11,color:T.text2,margin:"0 0 5px",fontWeight:600}},"FECHA"),
        e("input",{type:"date",className:"inp",value:fecha,max:today(),onChange:ev=>setFecha(ev.target.value)})
      )
    ),
    e("button",{className:"btn",style:{background:TIPOS[tipo].color,color:"#fff",marginTop:4},onClick:guardarMov},`Registrar ${TIPOS[tipo].label.toLowerCase()}`)
  );

  // MOVIMIENTOS: lista con filtros
  const Movimientos = e("div",{style:{display:"flex",flexDirection:"column",flex:1,overflow:"hidden"}},
    e("div",{style:{display:"flex",gap:7,padding:"10px 16px",borderBottom:`0.5px solid ${T.border}`,flexWrap:"wrap",background:T.bg2}},
      e("select",{className:"inp",style:{flex:1,fontSize:12,padding:"6px 8px"},value:fTipo,onChange:ev=>setFTipo(ev.target.value)},
        e("option",{value:""},"Todo tipo"), Object.entries(TIPOS).map(([k,v])=>e("option",{key:k,value:k},v.label))),
      e("select",{className:"inp",style:{flex:1,fontSize:12,padding:"6px 8px"},value:fCaja,onChange:ev=>setFCaja(ev.target.value)},
        e("option",{value:""},"Toda caja"), cajas.map(c=>e("option",{key:c.id,value:c.id},c.nombre))),
      e("select",{className:"inp",style:{flex:1,fontSize:12,padding:"6px 8px"},value:fAutor,onChange:ev=>setFAutor(ev.target.value)},
        e("option",{value:""},"Todos"), USUARIOS.map(u=>e("option",{key:u,value:u},u)))
    ),
    e("div",{style:{flex:1,overflowY:"auto",padding:"12px 16px",display:"flex",flexDirection:"column",gap:7}},
      movsFil.length===0 && e("p",{style:{color:T.text2,textAlign:"center",marginTop:40,fontSize:14}},syncing?"Cargando...":"No hay movimientos."),
      movsFil.map(m=>{
        const tp=TIPOS[m.tipo]||TIPOS.egreso;
        const cj=cajaById(m.caja_id); const cjD=cajaById(m.caja_destino_id); const ct=catById(m.categoria_id);
        return e("div",{key:m.id,className:"card",style:{borderLeft:`3px solid ${tp.color}`,padding:"10px 13px"}},
          e("div",{style:{display:"flex",alignItems:"flex-start",gap:10}},
            e("span",{style:{fontSize:18}},tp.icon),
            e("div",{style:{flex:1,minWidth:0}},
              e("p",{style:{margin:0,fontSize:14,fontWeight:600,color:T.text}},m.descripcion||tp.label),
              e("p",{style:{margin:"2px 0 0",fontSize:11,color:T.text2}},
                m.tipo==="transferencia" ? `${cj?.nombre||"?"} → ${cjD?.nombre||"?"}` : (cj?.nombre||"?"),
                ct?` · ${ct.icon} ${ct.nombre}`:""
              ),
              e("p",{style:{margin:"2px 0 0",fontSize:10.5,color:T.text2}},`${disp(m.fecha)} ${horaDe(m.creado_en)} · ${m.autor||"?"}`)
            ),
            e("div",{style:{textAlign:"right"}},
              e("p",{style:{margin:0,fontSize:15,fontWeight:700,color:tp.color}},`${m.tipo==="ingreso"?"+":m.tipo==="egreso"?"−":""}${fmt(m.monto,cj?.moneda)}`),
              confirmDel===m.id
                ? e("div",{style:{display:"flex",gap:4,marginTop:4,justifyContent:"flex-end"}}, e("button",{className:"conf-yes",onClick:()=>borrarMov(m.id)},"Sí"), e("button",{className:"conf-no",onClick:()=>setConfirmDel(null)},"No"))
                : e("button",{className:"del-btn",style:{marginTop:2},onClick:()=>setConfirmDel(m.id)},"✕")
            )
          )
        );
      })
    )
  );

  // CONFIG: cajas y categorías
  const Config = e("div",{style:{flex:1,overflowY:"auto",padding:"14px 16px",display:"flex",flexDirection:"column",gap:16}},
    e("div",null,
      e("p",{style:{margin:"0 0 8px",fontSize:14,fontWeight:600,color:T.text}},"💰 Cajas"),
      cajas.map(c=>{
        const s=saldoCaja(c.id);
        return e("div",{key:c.id,className:"card",style:{display:"flex",alignItems:"center",gap:10,marginBottom:8,borderLeft:`3px solid ${c.color}`}},
          e("span",{style:{fontSize:20}},c.icon),
          e("div",{style:{flex:1}}, e("p",{style:{margin:0,fontSize:14,fontWeight:600,color:T.text}},c.nombre), e("p",{style:{margin:0,fontSize:11,color:T.text2}},`${c.moneda} · saldo ${fmt(s,c.moneda)}`)),
          confirmCajaDel===c.id
            ? e("div",{style:{display:"flex",gap:4}}, e("button",{className:"conf-yes",onClick:()=>borrarCaja(c.id)},"Sí"), e("button",{className:"conf-no",onClick:()=>setConfirmCajaDel(null)},"No"))
            : e("button",{className:"del-btn",onClick:()=>setConfirmCajaDel(c.id)},"✕")
        );
      }),
      e("div",{style:{display:"flex",gap:8,marginTop:8}},
        e("input",{className:"inp",style:{flex:2},value:nuevaCaja.nombre,onChange:ev=>setNuevaCaja({...nuevaCaja,nombre:ev.target.value}),placeholder:"Nombre (ej: Efectivo)"}),
        e("select",{className:"inp",style:{flex:1},value:nuevaCaja.moneda,onChange:ev=>setNuevaCaja({...nuevaCaja,moneda:ev.target.value})}, e("option",{value:"ARS"},"ARS"), e("option",{value:"USD"},"USD")),
        e("button",{className:"btn",style:{background:"#27ae60",color:"#fff"},onClick:agregarCaja},"+")
      )
    ),
    e("div",null,
      e("p",{style:{margin:"0 0 8px",fontSize:14,fontWeight:600,color:T.text}},"🏷️ Categorías"),
      e("div",{style:{display:"flex",flexWrap:"wrap",gap:7,marginBottom:10}},
        cats.map(c=>
          e("div",{key:c.id,className:"chip",style:{borderColor:c.color}},
            e("span",{style:{fontSize:14}},c.icon), e("span",{style:{fontSize:12,color:T.text}},c.nombre),
            e("span",{style:{fontSize:9,color:T.text2,textTransform:"uppercase"}},c.tipo==="ambos"?"":c.tipo),
            confirmCatDel===c.id
              ? e("span",{style:{display:"flex",gap:3,marginLeft:3}}, e("button",{className:"conf-yes",style:{padding:"1px 7px"},onClick:()=>borrarCat(c.id)},"Sí"), e("button",{className:"conf-no",style:{padding:"1px 7px"},onClick:()=>setConfirmCatDel(null)},"No"))
              : e("button",{onClick:()=>setConfirmCatDel(c.id),style:{background:"none",border:"none",cursor:"pointer",color:"#bbb",fontSize:11,marginLeft:2}},"✕")
          )
        )
      ),
      e("div",{style:{display:"flex",gap:8}},
        e("input",{className:"inp",style:{flex:2},value:nuevaCat.nombre,onChange:ev=>setNuevaCat({...nuevaCat,nombre:ev.target.value}),placeholder:"Nombre (ej: Proveedores)"}),
        e("select",{className:"inp",style:{flex:1},value:nuevaCat.tipo,onChange:ev=>setNuevaCat({...nuevaCat,tipo:ev.target.value})}, e("option",{value:"ambos"},"Ambos"), e("option",{value:"ingreso"},"Ingreso"), e("option",{value:"egreso"},"Egreso")),
        e("button",{className:"btn",style:{background:"#8e44ad",color:"#fff"},onClick:agregarCat},"+")
      ),
      e("p",{style:{margin:"6px 0 0",fontSize:11,color:T.text2}},"El tipo limita en qué movimientos aparece la categoría.")
    )
  );

  return e("div",{style:{fontFamily:"system-ui,sans-serif",maxWidth:480,margin:"0 auto",display:"flex",flexDirection:"column",height:"100dvh",background:T.bg}},
    e("style",null,css),
    Header,
    view==="inicio" && Inicio,
    view==="nuevo" && Nuevo,
    view==="movimientos" && Movimientos,
    view==="config" && Config
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
}
