const { useState, useRef, useEffect, useCallback } = React;

// ===== CONFIG =====
const SB_URL = "https://nmhxgkruaiohdpennpga.supabase.co";
const SB_KEY = "sb_publishable_e3OwzCJn8N7zLE-j8i2Suw_PKqqPgRx";
const SB_H = { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}`, "Content-Type": "application/json" };
const PASSWORD = "empresa2026";
const USUARIOS = ["Fran", "Santi"];
// ==================

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
const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const THEMES = {
  light: { bg:"#fff", bg2:"#f6f7f9", card:"#fff", text:"#1a1a1a", text2:"#888", border:"#eaeaea", border2:"#d5d5d5", inputBg:"#f6f7f9", divider:"#f0f0f0" },
  dark:  { bg:"#14161a", bg2:"#1b1e24", card:"#1e2228", text:"#e8e8e8", text2:"#8a8f98", border:"#2a2e36", border2:"#3a3f48", inputBg:"#23272e", divider:"#262a31" },
};

const TIPOS = {
  ingreso:       { label:"Ingreso", color:"#27ae60", icon:"⬇️" },
  egreso:        { label:"Egreso",  color:"#e74c3c", icon:"⬆️" },
  transferencia: { label:"Transfer.", color:"#2980b9", icon:"🔁" },
};

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

function BarrasMes({ meses, T }) {
  const e = React.createElement;
  const max = Math.max(...meses.flatMap(m=>[m.ing,m.egr]), 1);
  const W=320, H=150, pad=24, gw=(W-pad*2)/meses.length;
  return e("svg",{width:"100%",viewBox:`0 0 ${W} ${H+22}`,style:{display:"block",overflow:"visible"}},
    meses.map((m,i)=>{
      const baseX=pad+i*gw; const bw=gw*0.32; const hi=(m.ing/max)*H, he=(m.egr/max)*H;
      return e("g",{key:i},
        e("rect",{x:baseX+gw*0.12,y:H-hi,width:bw,height:hi,rx:3,fill:"#27ae60"}),
        e("rect",{x:baseX+gw*0.12+bw+3,y:H-he,width:bw,height:he,rx:3,fill:"#e74c3c"}),
        e("text",{x:baseX+gw*0.5,y:H+15,textAnchor:"middle",style:{fontSize:10,fill:T.text2,fontFamily:"sans-serif"}},m.label)
      );
    })
  );
}

function Torta({ data, total, T, hov, onHov }) {
  const e = React.createElement;
  const r=70, stroke=26, circ=2*Math.PI*r;
  let off=0;
  const segs=data.map(d=>{ const dash=(d.monto/total)*circ; const s={...d,dash,gap:circ-dash,off}; off+=dash; return s; });
  return e("svg",{width:190,height:190,viewBox:"0 0 190 190",style:{display:"block",margin:"0 auto",overflow:"visible"}},
    e("circle",{cx:95,cy:95,r,fill:"none",stroke:T.bg2,strokeWidth:stroke}),
    ...segs.map((s,i)=>{ const isH=hov===i;
      return e("circle",{key:i,cx:95,cy:95,r,fill:"none",stroke:s.color,strokeWidth:isH?stroke+5:stroke,strokeDasharray:`${s.dash} ${s.gap}`,strokeDashoffset:-s.off+circ/4,style:{transition:"all .2s",cursor:"pointer",transformOrigin:"95px 95px"},onMouseEnter:()=>onHov(i),onMouseLeave:()=>onHov(null)});
    }),
    e("text",{x:95,y:90,textAnchor:"middle",style:{fontSize:11,fill:T.text2,fontFamily:"sans-serif"}}, hov!==null?data[hov].nombre:"Egresos"),
    e("text",{x:95,y:108,textAnchor:"middle",style:{fontSize:15,fontWeight:600,fill:T.text,fontFamily:"sans-serif"}}, hov!==null?fmt(data[hov].monto):fmt(total))
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
  const [fijos, setFijos] = useState([]);
  const [cobrar, setCobrar] = useState([]);
  const [syncing, setSyncing] = useState(true);
  const [view, setView] = useState("inicio");
  const [dolar, setDolar] = useState(null);

  const [tipo, setTipo] = useState("egreso");
  const [monto, setMonto] = useState("");
  const [cajaId, setCajaId] = useState("");
  const [cajaDest, setCajaDest] = useState("");
  const [catId, setCatId] = useState("");
  const [descr, setDescr] = useState("");
  const [fecha, setFecha] = useState(today());
  const [esRetiro, setEsRetiro] = useState(false);

  const [fCaja, setFCaja] = useState("");
  const [fAutor, setFAutor] = useState("");
  const [fTipo, setFTipo] = useState("");
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");
  const [busca, setBusca] = useState("");

  const [nuevaCaja, setNuevaCaja] = useState({nombre:"",moneda:"ARS"});
  const [nuevaCat, setNuevaCat] = useState({nombre:"",tipo:"ambos"});
  const [nuevoFijo, setNuevoFijo] = useState({nombre:"",tipo:"egreso",monto:"",caja_id:"",categoria_id:""});
  const [fijoMontos, setFijoMontos] = useState({});
  const [confirmDel, setConfirmDel] = useState(null);
  const [confirmCajaDel, setConfirmCajaDel] = useState(null);
  const [confirmCatDel, setConfirmCatDel] = useState(null);
  const [confirmFijoDel, setConfirmFijoDel] = useState(null);
  const [editMov, setEditMov] = useState(null);
  const [hovTorta, setHovTorta] = useState(null);
  const [nuevoCobro, setNuevoCobro] = useState({quien:"",monto:"",descripcion:"",fecha:today()});
  const [confirmCobroDel, setConfirmCobroDel] = useState(null);
  const [cobrarCaja, setCobrarCaja] = useState({});
  const [nuevoRetiro, setNuevoRetiro] = useState({monto:"",caja_id:"",descr:""});
  const [colMeses, setColMeses] = useState({});
  const [colDias, setColDias] = useState({});

  useEffect(()=>{ try { localStorage.setItem("cf_tema", dark?"dark":"light"); } catch {} },[dark]);

  const cargar = useCallback(async()=>{
    try {
      const [c, ca, m, f, co] = await Promise.all([
        sbGet("cajas","select=*&order=orden.asc,id.asc"),
        sbGet("categorias","select=*&order=id.asc"),
        sbGet("movimientos","select=*&order=fecha.desc,creado_en.desc"),
        sbGet("fijos","select=*&order=id.asc"),
        sbGet("cobrar","select=*&order=fecha.desc,creado_en.desc"),
      ]);
      setCajas(c); setCats(ca); setMovs(m); setFijos(f); setCobrar(co);
    } catch {}
    setSyncing(false);
  },[]);

  useEffect(()=>{ if(auth) cargar(); },[auth,cargar]);
  useEffect(()=>{ if(!auth) return; const iv=setInterval(cargar,12000); return ()=>clearInterval(iv); },[auth,cargar]);
  useEffect(()=>{ if(!auth) return; (async()=>{ try{ const r=await fetch("https://dolarapi.com/v1/dolares/blue"); if(r.ok){ setDolar(await r.json()); } }catch{} })(); },[auth]);

  const e = React.createElement;
  if (!auth) return e(Login, { onOk:(u)=>{setAuth(true);setUsuario(u);}, dark });

  function saldoCaja(id){
    let s=0;
    movs.forEach(m=>{
      if(m.tipo==="ingreso" && m.caja_id===id) s+=Number(m.monto);
      else if(m.tipo==="egreso" && m.caja_id===id) s-=Number(m.monto);
      else if(m.tipo==="transferencia"){ if(m.caja_id===id) s-=Number(m.monto); if(m.caja_destino_id===id) s+=Number(m.monto); }
    });
    return s;
  }

  const blueVenta = dolar ? Number(dolar.venta) : null;
  let patrimonio=0, hayUSDsinDolar=false;
  cajas.forEach(c=>{ const s=saldoCaja(c.id); if(c.moneda==="USD"){ if(blueVenta) patrimonio+=s*blueVenta; else hayUSDsinDolar=true; } else patrimonio+=s; });

  async function guardarMov(){
    const m=parseFloat(monto); if(!m||m<=0||!cajaId) return;
    if(tipo==="transferencia"&&(!cajaDest||cajaDest===cajaId)) return;
    const obj={ id:Date.now(), tipo, monto:m, caja_id:Number(cajaId), caja_destino_id:tipo==="transferencia"?Number(cajaDest):null, categoria_id:catId?Number(catId):null, descripcion:descr||(tipo==="transferencia"?"Transferencia":""), fecha, autor:usuario, es_retiro: tipo==="egreso"?esRetiro:false, creado_en:new Date().toISOString() };
    try { const g=await sbPost("movimientos",obj); setMovs(prev=>[g,...prev]); setMonto("");setDescr("");setCatId("");setCajaDest("");setEsRetiro(false); setView("movimientos"); } catch {}
  }
  async function guardarEdit(){
    const m=parseFloat(editMov.monto); if(!m||m<=0) return;
    const cambios={ monto:m, caja_id:Number(editMov.caja_id), categoria_id:editMov.categoria_id?Number(editMov.categoria_id):null, descripcion:editMov.descripcion, fecha:editMov.fecha };
    setMovs(prev=>prev.map(x=>x.id===editMov.id?{...x,...cambios}:x)); setEditMov(null);
    try{ await sbPatch("movimientos",editMov.id,cambios); }catch{}
  }
  async function borrarMov(id){ setMovs(prev=>prev.filter(x=>x.id!==id)); setConfirmDel(null); try{ await sbDel("movimientos",id); }catch{} }
  async function agregarCaja(){
    const nombre=nuevaCaja.nombre.trim(); if(!nombre) return;
    const idx=cajas.length;
    const obj={ id:Date.now(), nombre, moneda:nuevaCaja.moneda, icon:ICONOS_CAJA[idx%ICONOS_CAJA.length], color:COLORES[idx%COLORES.length], orden:idx };
    try { const g=await sbPost("cajas",obj); setCajas(prev=>[...prev,g]); setNuevaCaja({nombre:"",moneda:"ARS"}); } catch {}
  }
  async function borrarCaja(id){ setCajas(prev=>prev.filter(x=>x.id!==id)); setConfirmCajaDel(null); try{ await sbDel("cajas",id); }catch{} }
  async function agregarCat(){
    const nombre=nuevaCat.nombre.trim(); if(!nombre) return;
    const idx=cats.length;
    const obj={ id:Date.now(), nombre, tipo:nuevaCat.tipo, icon:ICONOS_CAT[idx%ICONOS_CAT.length], color:COLORES[idx%COLORES.length] };
    try { const g=await sbPost("categorias",obj); setCats(prev=>[...prev,g]); setNuevaCat({nombre:"",tipo:"ambos"}); } catch {}
  }
  async function borrarCat(id){ setCats(prev=>prev.filter(x=>x.id!==id)); setConfirmCatDel(null); try{ await sbDel("categorias",id); }catch{} }
  async function agregarFijo(){
    const nombre=nuevoFijo.nombre.trim(); const m=parseFloat(nuevoFijo.monto);
    if(!nombre||!m||m<=0||!nuevoFijo.caja_id) return;
    const obj={ id:Date.now(), nombre, tipo:nuevoFijo.tipo, monto_base:m, caja_id:Number(nuevoFijo.caja_id), categoria_id:nuevoFijo.categoria_id?Number(nuevoFijo.categoria_id):null };
    try { const g=await sbPost("fijos",obj); setFijos(prev=>[...prev,g]); setNuevoFijo({nombre:"",tipo:"egreso",monto:"",caja_id:"",categoria_id:""}); } catch {}
  }
  async function borrarFijo(id){ setFijos(prev=>prev.filter(x=>x.id!==id)); setConfirmFijoDel(null); try{ await sbDel("fijos",id); }catch{} }
  async function registrarFijo(f){
    const me=fijoMontos[f.id];
    const m = me!==undefined&&me!=="" ? parseFloat(me) : Number(f.monto_base);
    if(!m||m<=0) return;
    const obj={ id:Date.now(), tipo:f.tipo, monto:m, caja_id:f.caja_id, caja_destino_id:null, categoria_id:f.categoria_id, descripcion:f.nombre, fecha:today(), autor:usuario, creado_en:new Date().toISOString() };
    try { const g=await sbPost("movimientos",obj); setMovs(prev=>[g,...prev]); setFijoMontos(prev=>{const c={...prev};delete c[f.id];return c;}); setView("movimientos"); } catch {}
  }
  async function agregarCobro(){
    const quien=nuevoCobro.quien.trim(); const m=parseFloat(nuevoCobro.monto);
    if(!quien||!m||m<=0) return;
    const obj={ id:Date.now(), quien, monto:m, descripcion:nuevoCobro.descripcion||"", fecha:nuevoCobro.fecha||today(), cobrado:false, autor:usuario, creado_en:new Date().toISOString() };
    try { const g=await sbPost("cobrar",obj); setCobrar(prev=>[g,...prev]); setNuevoCobro({quien:"",monto:"",descripcion:"",fecha:today()}); } catch {}
  }
  async function borrarCobro(id){ setCobrar(prev=>prev.filter(x=>x.id!==id)); setConfirmCobroDel(null); try{ await sbDel("cobrar",id); }catch{} }
  async function cobrarItem(x, cajaIdSel){
    if(cajaIdSel){
      const obj={ id:Date.now(), tipo:"ingreso", monto:Number(x.monto), caja_id:Number(cajaIdSel), caja_destino_id:null, categoria_id:null, descripcion:`Cobro: ${x.quien}${x.descripcion?" - "+x.descripcion:""}`, fecha:today(), autor:usuario, es_retiro:false, creado_en:new Date().toISOString() };
      try { const g=await sbPost("movimientos",obj); setMovs(prev=>[g,...prev]); } catch {}
    }
    setCobrar(prev=>prev.map(y=>y.id===x.id?{...y,cobrado:true}:y));
    setCobrarCaja(prev=>{ const c={...prev}; delete c[x.id]; return c; });
    try{ await sbPatch("cobrar",x.id,{cobrado:true}); }catch{}
  }
  async function agregarRetiro(){
    const m=parseFloat(nuevoRetiro.monto); if(!m||m<=0||!nuevoRetiro.caja_id) return;
    const obj={ id:Date.now(), tipo:"egreso", monto:m, caja_id:Number(nuevoRetiro.caja_id), caja_destino_id:null, categoria_id:null, descripcion:nuevoRetiro.descr||"Retiro", fecha:today(), autor:usuario, es_retiro:true, creado_en:new Date().toISOString() };
    try { const g=await sbPost("movimientos",obj); setMovs(prev=>[g,...prev]); setNuevoRetiro({monto:"",caja_id:"",descr:""}); } catch {}
  }
  function cerrarSesion(){ try{ localStorage.removeItem("cf_auth"); localStorage.removeItem("cf_user"); }catch{} setAuth(false); }
  function cambiarUsuario(){ try{ localStorage.removeItem("cf_user"); }catch{} setAuth(false); }

  const cajaById = id => cajas.find(c=>c.id===id);
  const catById = id => cats.find(c=>c.id===id);

  // Filtros aplicados (incluye fecha y búsqueda)
  const movsFil = movs.filter(m=>{
    if(fCaja && m.caja_id!==Number(fCaja) && m.caja_destino_id!==Number(fCaja)) return false;
    if(fAutor && m.autor!==fAutor) return false;
    if(fTipo && m.tipo!==fTipo) return false;
    if(fDesde && m.fecha<fDesde) return false;
    if(fHasta && m.fecha>fHasta) return false;
    if(busca && !(m.descripcion||"").toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });
  const hayFiltro = fCaja||fAutor||fTipo||fDesde||fHasta||busca;

  // Exportar CSV
  function exportarCSV(){
    const headers = ["Fecha","Hora","Tipo","Monto","Moneda","Caja","CajaDestino","Categoria","Descripcion","Autor"];
    const filas = movsFil.map(m=>{
      const cj=cajaById(m.caja_id), cjD=cajaById(m.caja_destino_id), ct=catById(m.categoria_id);
      return [ m.fecha, horaDe(m.creado_en), TIPOS[m.tipo]?.label||m.tipo, m.monto, cj?.moneda||"ARS", cj?.nombre||"", cjD?.nombre||"", ct?.nombre||"", (m.descripcion||"").replace(/"/g,'""'), m.autor||"" ];
    });
    const csv = [headers, ...filas].map(f=>f.map(c=>`"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff"+csv], {type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download=`cashflow_${today()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const mesKey = today().slice(0,7);
  const movsMes = movs.filter(m=>String(m.fecha).slice(0,7)===mesKey);
  const ingresosMes = movsMes.filter(m=>m.tipo==="ingreso").reduce((s,m)=>s+Number(m.monto),0);
  const egresosMes = movsMes.filter(m=>m.tipo==="egreso").reduce((s,m)=>s+Number(m.monto),0);
  const netoMes = ingresosMes - egresosMes;

  // Análisis: usa rango de fechas si está, sino últimos 6 meses
  const meses6 = [];
  const ref = new Date();
  for(let i=5;i>=0;i--){
    const d=new Date(ref.getFullYear(),ref.getMonth()-i,1);
    const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const ing=movs.filter(m=>m.tipo==="ingreso"&&String(m.fecha).slice(0,7)===k).reduce((s,m)=>s+Number(m.monto),0);
    const egr=movs.filter(m=>m.tipo==="egreso"&&String(m.fecha).slice(0,7)===k).reduce((s,m)=>s+Number(m.monto),0);
    meses6.push({label:MESES[d.getMonth()],ing,egr});
  }

  // Torta: respeta filtro de fechas si hay, sino mes actual
  const movsTorta = (fDesde||fHasta) ? movsFil : movsMes;
  const egrPorCat = {};
  movsTorta.filter(m=>m.tipo==="egreso").forEach(m=>{ const k=m.categoria_id||"sin"; egrPorCat[k]=(egrPorCat[k]||0)+Number(m.monto); });
  const tortaData = Object.entries(egrPorCat).map(([k,monto])=>{ const cat=k==="sin"?null:catById(Number(k)); return { nombre:cat?cat.nombre:"Sin categoría", color:cat?cat.color:"#999", monto }; }).sort((a,b)=>b.monto-a.monto);
  const tortaTotal = tortaData.reduce((s,d)=>s+d.monto,0);

  const totalFijos = fijos.reduce((s,f)=>{ const me=fijoMontos[f.id]; const m=me!==undefined&&me!==""?parseFloat(me)||0:Number(f.monto_base); return s+(f.tipo==="egreso"?m:0); },0);

  // ---- A cobrar ----
  const cobrarPend = cobrar.filter(x=>!x.cobrado);
  const cobrarHecho = cobrar.filter(x=>x.cobrado);
  const totalCobrar = cobrarPend.reduce((s,x)=>s+Number(x.monto),0);

  // ---- Retiros de socios ----
  const retiros = {}; USUARIOS.forEach(u=>retiros[u]=0);
  movs.filter(m=>m.es_retiro).forEach(m=>{ retiros[m.autor]=(retiros[m.autor]||0)+Number(m.monto); });
  const hayRetiros = Object.values(retiros).some(v=>v>0);
  const rA=retiros[USUARIOS[0]]||0, rB=retiros[USUARIOS[1]]||0;
  const difRet = Math.abs(rA-rB);
  const aFavor = rA<rB ? USUARIOS[0] : USUARIOS[1];

  // ---- Agrupado de movimientos por mes -> día ----
  const MES_LARGO=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const DIA_SEM=["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  const mesLabel = k=>{ const [y,m]=k.split("-"); return `${MES_LARGO[Number(m)-1]} ${y}`; };
  const diaLabel = k=>{ const [y,m,d]=k.split("-"); const dd=new Date(Number(y),Number(m)-1,Number(d)); return `${DIA_SEM[dd.getDay()]} ${d}/${m}`; };
  const gruposMov = [];
  const _im={};
  movsFil.forEach(m=>{
    const mk=String(m.fecha).slice(0,7), dk=String(m.fecha).slice(0,10);
    if(_im[mk]===undefined){ _im[mk]=gruposMov.length; gruposMov.push({mk,dias:[],_id:{},ing:0,egr:0,n:0}); }
    const g=gruposMov[_im[mk]];
    g.n++; if(m.tipo==="ingreso") g.ing+=Number(m.monto); else if(m.tipo==="egreso") g.egr+=Number(m.monto);
    if(g._id[dk]===undefined){ g._id[dk]=g.dias.length; g.dias.push({dk,items:[]}); }
    g.dias[g._id[dk]].items.push(m);
  });

  function renderMov(m){
    const tp=TIPOS[m.tipo]||TIPOS.egreso; const cj=cajaById(m.caja_id); const cjD=cajaById(m.caja_destino_id); const ct=catById(m.categoria_id);
    return e("div",{key:m.id,className:"card",style:{borderLeft:`3px solid ${tp.color}`,padding:"10px 13px"}},
      e("div",{style:{display:"flex",alignItems:"flex-start",gap:10}},
        e("span",{style:{fontSize:18}},tp.icon),
        e("div",{style:{flex:1,minWidth:0}},
          e("p",{style:{margin:0,fontSize:14,fontWeight:600,color:T.text}},m.descripcion||tp.label, m.es_retiro?e("span",{style:{fontSize:10,marginLeft:6,padding:"1px 6px",borderRadius:8,background:"#16a08522",color:"#16a085",fontWeight:600}},"↩️ retiro"):null),
          e("p",{style:{margin:"2px 0 0",fontSize:11,color:T.text2}}, m.tipo==="transferencia"?`${cj?.nombre||"?"} → ${cjD?.nombre||"?"}`:(cj?.nombre||"?"), ct?` · ${ct.icon} ${ct.nombre}`:""),
          e("p",{style:{margin:"2px 0 0",fontSize:10.5,color:T.text2}},`${disp(m.fecha)} ${horaDe(m.creado_en)} · ${m.autor||"?"}`)
        ),
        e("div",{style:{textAlign:"right"}},
          e("p",{style:{margin:0,fontSize:15,fontWeight:700,color:tp.color}},`${m.tipo==="ingreso"?"+":m.tipo==="egreso"?"−":""}${fmt(m.monto,cj?.moneda)}`),
          e("div",{style:{display:"flex",gap:6,marginTop:3,justifyContent:"flex-end"}},
            m.tipo!=="transferencia" && e("button",{className:"edit-btn",onClick:()=>setEditMov({id:m.id,monto:String(m.monto),caja_id:m.caja_id,categoria_id:m.categoria_id||"",descripcion:m.descripcion||"",fecha:m.fecha})},"✏️"),
            confirmDel===m.id ? e("span",{style:{display:"flex",gap:4}}, e("button",{className:"conf-yes",onClick:()=>borrarMov(m.id)},"Sí"), e("button",{className:"conf-no",onClick:()=>setConfirmDel(null)},"No")) : e("button",{className:"del-btn",onClick:()=>setConfirmDel(m.id)},"✕")
          )
        )
      )
    );
  }

  function renderCobro(x){
    const sel = cobrarCaja[x.id];
    return e("div",{key:x.id,className:"card",style:{borderLeft:"3px solid #d68910"}},
      e("div",{style:{display:"flex",alignItems:"center",gap:10}},
        e("div",{style:{flex:1,minWidth:0}},
          e("p",{style:{margin:0,fontSize:15,fontWeight:600,color:T.text}},x.quien),
          e("p",{style:{margin:"2px 0 0",fontSize:11,color:T.text2}},`${disp(x.fecha)}${x.descripcion?" · "+x.descripcion:""}${x.autor?" · "+x.autor:""}`)
        ),
        e("p",{style:{margin:0,fontSize:16,fontWeight:700,color:"#d68910"}},fmt(x.monto)),
        confirmCobroDel===x.id
          ? e("span",{style:{display:"flex",gap:4,marginLeft:8}}, e("button",{className:"conf-yes",onClick:()=>borrarCobro(x.id)},"Sí"), e("button",{className:"conf-no",onClick:()=>setConfirmCobroDel(null)},"No"))
          : e("button",{className:"del-btn",style:{marginLeft:8},onClick:()=>setConfirmCobroDel(x.id)},"✕")
      ),
      sel===undefined
        ? e("button",{className:"btn",style:{background:"#27ae60",color:"#fff",width:"100%",marginTop:10,padding:"8px"},onClick:()=>setCobrarCaja(p=>({...p,[x.id]:""}))},"✓ Marcar cobrado")
        : e("div",{style:{display:"flex",gap:8,marginTop:10}},
            e("select",{className:"inp",style:{flex:1},value:sel,onChange:ev=>setCobrarCaja(p=>({...p,[x.id]:ev.target.value}))}, e("option",{value:""},"¿A qué caja entró? (opcional)"), cajas.map(c=>e("option",{key:c.id,value:c.id},`${c.icon} ${c.nombre}`))),
            e("button",{className:"btn",style:{background:"#27ae60",color:"#fff"},onClick:()=>cobrarItem(x,sel)},"OK"),
            e("button",{className:"btn",style:{background:T.bg2,color:T.text2},onClick:()=>setCobrarCaja(p=>{const c={...p};delete c[x.id];return c;})},"✕")
          )
    );
  }

  const css=`
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:${T.bg};overscroll-behavior:none}
    .tab{flex:1;min-width:fit-content;white-space:nowrap;padding:11px 7px;background:none;border:none;border-bottom:2.5px solid transparent;cursor:pointer;font-size:10.5px;color:${T.text2};transition:all .2s}
    .tab:hover{background:${T.bg2}}
    .inp{font-size:14px;border:0.5px solid ${T.border2};border-radius:10px;padding:10px 12px;background:${T.inputBg};color:${T.text};outline:none;width:100%}
    .inp:focus{border-color:#2980b9}
    .btn{border:none;border-radius:10px;padding:11px 16px;font-size:14px;font-weight:600;cursor:pointer;transition:all .15s}
    .btn:hover{filter:brightness(1.08)}
    .card{background:${T.card};border:0.5px solid ${T.border};border-radius:14px;padding:14px}
    .icon-btn{background:${T.bg2};border:0.5px solid ${T.border};border-radius:50%;width:34px;height:34px;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:${T.text2}}
    .seg{flex:1;padding:9px;border:0.5px solid ${T.border2};background:${T.inputBg};color:${T.text2};cursor:pointer;font-size:13px;font-weight:600;transition:all .15s}
    .del-btn{background:none;border:none;cursor:pointer;font-size:14px;color:#bbb}
    .edit-btn{background:none;border:none;cursor:pointer;font-size:13px;color:${T.text2}}
    .conf-yes{background:#e74c3c;color:#fff;border:none;border-radius:8px;padding:3px 10px;font-size:12px;cursor:pointer}
    .conf-no{background:none;border:0.5px solid ${T.border2};color:${T.text2};border-radius:8px;padding:3px 10px;font-size:12px;cursor:pointer}
    .chip{display:flex;align-items:center;gap:6px;padding:7px 11px;border-radius:11px;border:0.5px solid ${T.border};background:${T.card}}
    .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:50;padding:20px}
    .modal{background:${T.card};border-radius:18px;padding:20px;width:100%;max-width:380px;border:0.5px solid ${T.border}}
    .lbl{font-size:11px;color:${T.text2};margin:0 0 4px;font-weight:600;text-transform:uppercase;letter-spacing:.03em}
    .leg{display:flex;align-items:center;gap:7px;padding:3px 0;font-size:12px}
    .mini{font-size:12px;border:0.5px solid ${T.border2};border-radius:8px;padding:6px 8px;background:${T.inputBg};color:${T.text};outline:none}
    .clearf{font-size:11px;padding:4px 10px;border-radius:16px;border:0.5px solid ${T.border2};background:none;color:${T.text2};cursor:pointer}
    .grphdr{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 12px;border-radius:10px;background:${T.bg2};border:0.5px solid ${T.border};cursor:pointer;user-select:none}
    .dayhdr{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 8px 5px 4px;cursor:pointer;user-select:none}
  `;

  const Header = e("div",{style:{borderBottom:`0.5px solid ${T.border}`}},
    e("div",{style:{padding:"13px 18px 0",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}},
      e("div",null,
        e("p",{style:{margin:0,fontSize:17,fontWeight:600,color:T.text}},"🏢 Cashflow",syncing?e("span",{style:{fontSize:11,color:T.text2,marginLeft:8,fontWeight:400}},"sync..."):null),
        e("p",{style:{margin:0,fontSize:11.5,color:T.text2,marginTop:2}},`Sos: ${usuario} · ${movs.length} movim.`)
      ),
      e("div",{style:{display:"flex",alignItems:"center",gap:7}},
        e("button",{className:"icon-btn",onClick:cambiarUsuario,title:"Cambiar usuario"},"👤"),
        e("button",{className:"icon-btn",onClick:()=>setDark(!dark),title:"Tema"},dark?"☀️":"🌙"),
        e("button",{className:"icon-btn",onClick:cerrarSesion,title:"Salir"},"⏻")
      )
    ),
    e("div",{style:{display:"flex",overflowX:"auto"}},
      [["inicio","🏠 Inicio","#27ae60"],["nuevo","➕ Cargar","#2980b9"],["movimientos","📋 Movim.","#8e44ad"],["cobrar","💰 Cobrar","#d68910"],["retiros","↩️ Retiros","#16a085"],["fijos","🔁 Fijos","#c0392b"],["analisis","📊 Análisis","#2c3e50"],["config","⚙️ Config","#7f8c8d"]].map(([k,l,c])=>
        e("button",{key:k,className:"tab",style:{borderBottomColor:view===k?c:"transparent",color:view===k?c:T.text2,fontWeight:view===k?700:400},onClick:()=>setView(k)},l)
      )
    )
  );

  const Inicio = e("div",{style:{flex:1,overflowY:"auto",padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}},
    e("div",{className:"card",style:{background:"linear-gradient(135deg,#27ae60,#2980b9)",border:"none",textAlign:"center",padding:"18px"}},
      e("p",{style:{margin:0,fontSize:12,color:"rgba(255,255,255,.85)"}},"Patrimonio total (consolidado)"),
      e("p",{style:{margin:"4px 0 0",fontSize:28,fontWeight:700,color:"#fff"}},fmt(patrimonio)),
      e("p",{style:{margin:"3px 0 0",fontSize:11,color:"rgba(255,255,255,.8)"}}, hayUSDsinDolar?"(falta cotización USD)":(blueVenta?`USD convertido a blue $${blueVenta}`:"solo ARS"))
    ),
    dolar && e("div",{className:"card",style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
      e("span",{style:{fontSize:13,color:T.text2}},"💵 Dólar blue"),
      e("span",{style:{fontSize:14,fontWeight:600,color:T.text}},`Compra ${fmt(dolar.compra)} · Venta ${fmt(dolar.venta)}`)
    ),
    e("div",{style:{display:"flex",gap:8}},
      e("div",{className:"card",style:{flex:1,borderTop:"3px solid #27ae60"}}, e("p",{style:{margin:0,fontSize:11,color:T.text2}},"Ingresos mes"), e("p",{style:{margin:"4px 0 0",fontSize:16,fontWeight:600,color:"#27ae60"}},fmt(ingresosMes))),
      e("div",{className:"card",style:{flex:1,borderTop:"3px solid #e74c3c"}}, e("p",{style:{margin:0,fontSize:11,color:T.text2}},"Egresos mes"), e("p",{style:{margin:"4px 0 0",fontSize:16,fontWeight:600,color:"#e74c3c"}},fmt(egresosMes))),
      e("div",{className:"card",style:{flex:1,borderTop:`3px solid ${netoMes>=0?"#27ae60":"#e74c3c"}`}}, e("p",{style:{margin:0,fontSize:11,color:T.text2}},"Neto mes"), e("p",{style:{margin:"4px 0 0",fontSize:16,fontWeight:600,color:netoMes>=0?"#27ae60":"#e74c3c"}},`${netoMes>=0?"+":""}${fmt(netoMes)}`))
    ),
    (totalCobrar>0 || hayRetiros) && e("div",{style:{display:"flex",gap:8}},
      e("div",{className:"card",style:{flex:1,cursor:"pointer",borderLeft:"3px solid #d68910"},onClick:()=>setView("cobrar")},
        e("p",{style:{margin:0,fontSize:11,color:T.text2}},"💰 A cobrar"),
        e("p",{style:{margin:"4px 0 0",fontSize:16,fontWeight:600,color:"#d68910"}},fmt(totalCobrar)),
        e("p",{style:{margin:"2px 0 0",fontSize:10.5,color:T.text2}},`${cobrarPend.length} pendiente${cobrarPend.length!==1?"s":""}`)
      ),
      e("div",{className:"card",style:{flex:1,cursor:"pointer",borderLeft:"3px solid #16a085"},onClick:()=>setView("retiros")},
        e("p",{style:{margin:0,fontSize:11,color:T.text2}},"↩️ Retiros socios"),
        ...USUARIOS.map(u=>e("p",{key:u,style:{margin:"3px 0 0",fontSize:11.5,color:T.text,display:"flex",justifyContent:"space-between"}}, e("span",null,u), e("span",{style:{fontWeight:600}},fmt(retiros[u]||0)))),
        difRet>0 && e("p",{style:{margin:"4px 0 0",fontSize:10,color:"#16a085",fontWeight:600}},`${aFavor} +${fmt(difRet)} a favor`)
      )
    ),
    e("p",{style:{margin:"4px 0 -4px",fontSize:13,fontWeight:600,color:T.text}},"Cajas"),
    cajas.length===0 && e("p",{style:{color:T.text2,fontSize:14,textAlign:"center",padding:"20px 0"}},syncing?"Cargando...":"Creá tu primera caja en ⚙️ Config"),
    cajas.map(c=>{ const s=saldoCaja(c.id);
      return e("div",{key:c.id,className:"card",style:{borderLeft:`3px solid ${c.color}`,display:"flex",alignItems:"center",gap:12}},
        e("div",{style:{width:42,height:42,borderRadius:12,background:c.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:21}},c.icon),
        e("div",{style:{flex:1}}, e("p",{style:{margin:0,fontSize:15,fontWeight:600,color:T.text}},c.nombre), e("p",{style:{margin:0,fontSize:11,color:T.text2}}, c.moneda + (c.moneda==="USD"&&blueVenta?` · ≈ ${fmt(s*blueVenta)}`:""))),
        e("p",{style:{margin:0,fontSize:18,fontWeight:700,color:s<0?"#e74c3c":T.text}},fmt(s,c.moneda))
      );
    })
  );

  const catsValidas = cats.filter(c=>c.tipo==="ambos"||c.tipo===tipo||tipo==="transferencia");
  const Nuevo = e("div",{style:{flex:1,overflowY:"auto",padding:"14px 16px",display:"flex",flexDirection:"column",gap:14}},
    e("div",{style:{display:"flex",borderRadius:11,overflow:"hidden",border:`0.5px solid ${T.border2}`}},
      Object.entries(TIPOS).map(([k,v],i)=>e("button",{key:k,className:"seg",onClick:()=>setTipo(k),style:{background:tipo===k?v.color:T.inputBg,color:tipo===k?"#fff":T.text2,borderLeft:i>0?`0.5px solid ${T.border2}`:"none"}},`${v.icon} ${v.label}`))
    ),
    e("div",null, e("p",{className:"lbl"},"Monto"), e("input",{type:"number",className:"inp",style:{fontSize:20,fontWeight:600},value:monto,onChange:ev=>setMonto(ev.target.value),placeholder:"0"})),
    e("div",null, e("p",{className:"lbl"},tipo==="transferencia"?"Desde la caja":"Caja"),
      e("select",{className:"inp",value:cajaId,onChange:ev=>setCajaId(ev.target.value)}, e("option",{value:""},"Elegí una caja..."), cajas.map(c=>e("option",{key:c.id,value:c.id},`${c.icon} ${c.nombre} (${c.moneda})`)))),
    tipo==="transferencia" && e("div",null, e("p",{className:"lbl"},"Hacia la caja"),
      e("select",{className:"inp",value:cajaDest,onChange:ev=>setCajaDest(ev.target.value)}, e("option",{value:""},"Elegí una caja..."), cajas.filter(c=>c.id!==Number(cajaId)).map(c=>e("option",{key:c.id,value:c.id},`${c.icon} ${c.nombre} (${c.moneda})`)))),
    tipo!=="transferencia" && e("div",null, e("p",{className:"lbl"},"Categoría"),
      e("select",{className:"inp",value:catId,onChange:ev=>setCatId(ev.target.value)}, e("option",{value:""},"Sin categoría"), catsValidas.map(c=>e("option",{key:c.id,value:c.id},`${c.icon} ${c.nombre}`)))),
    e("div",{style:{display:"flex",gap:10}},
      e("div",{style:{flex:2}}, e("p",{className:"lbl"},"Descripción"), e("input",{className:"inp",value:descr,onChange:ev=>setDescr(ev.target.value),placeholder:"ej: pago proveedor"})),
      e("div",{style:{flex:1}}, e("p",{className:"lbl"},"Fecha"), e("input",{type:"date",className:"inp",value:fecha,max:today(),onChange:ev=>setFecha(ev.target.value)}))
    ),
    tipo==="egreso" && e("label",{style:{display:"flex",alignItems:"center",gap:9,fontSize:13.5,color:T.text,cursor:"pointer",padding:"10px 12px",borderRadius:10,background:esRetiro?"#16a08518":T.inputBg,border:`0.5px solid ${esRetiro?"#16a085":T.border2}`}},
      e("input",{type:"checkbox",checked:esRetiro,onChange:ev=>setEsRetiro(ev.target.checked),style:{width:17,height:17,accentColor:"#16a085"}}),
      e("span",null,`↩️ Es un retiro de socio (${usuario})`)
    ),
    e("button",{className:"btn",style:{background:TIPOS[tipo].color,color:"#fff",marginTop:4},onClick:guardarMov},`Registrar ${TIPOS[tipo].label.toLowerCase()}`)
  );

  const Movimientos = e("div",{style:{display:"flex",flexDirection:"column",flex:1,overflow:"hidden"}},
    e("div",{style:{padding:"10px 16px",borderBottom:`0.5px solid ${T.border}`,background:T.bg2,display:"flex",flexDirection:"column",gap:7}},
      e("input",{className:"mini",style:{width:"100%"},value:busca,onChange:ev=>setBusca(ev.target.value),placeholder:"🔍 Buscar por descripción..."}),
      e("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
        e("select",{className:"mini",style:{flex:1},value:fTipo,onChange:ev=>setFTipo(ev.target.value)}, e("option",{value:""},"Tipo"), Object.entries(TIPOS).map(([k,v])=>e("option",{key:k,value:k},v.label))),
        e("select",{className:"mini",style:{flex:1},value:fCaja,onChange:ev=>setFCaja(ev.target.value)}, e("option",{value:""},"Caja"), cajas.map(c=>e("option",{key:c.id,value:c.id},c.nombre))),
        e("select",{className:"mini",style:{flex:1},value:fAutor,onChange:ev=>setFAutor(ev.target.value)}, e("option",{value:""},"Autor"), USUARIOS.map(u=>e("option",{key:u,value:u},u)))
      ),
      e("div",{style:{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}},
        e("span",{style:{fontSize:11,color:T.text2}},"Desde"), e("input",{type:"date",className:"mini",value:fDesde,onChange:ev=>setFDesde(ev.target.value)}),
        e("span",{style:{fontSize:11,color:T.text2}},"Hasta"), e("input",{type:"date",className:"mini",value:fHasta,onChange:ev=>setFHasta(ev.target.value)}),
        hayFiltro && e("button",{className:"clearf",onClick:()=>{setFCaja("");setFAutor("");setFTipo("");setFDesde("");setFHasta("");setBusca("");}},"Limpiar")
      ),
      e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
        e("span",{style:{fontSize:11,color:T.text2}},`${movsFil.length} resultado${movsFil.length!==1?"s":""}`),
        e("button",{className:"clearf",style:{color:"#16a085",borderColor:"#16a085"},onClick:exportarCSV},"⬇ Exportar CSV")
      )
    ),
    e("div",{style:{flex:1,overflowY:"auto",padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}},
      movsFil.length===0 && e("p",{style:{color:T.text2,textAlign:"center",marginTop:40,fontSize:14}},syncing?"Cargando...":"No hay movimientos."),
      gruposMov.map(g=>{
        const mCol = !!colMeses[g.mk]; const neto=g.ing-g.egr;
        return e("div",{key:g.mk,style:{display:"flex",flexDirection:"column",gap:7}},
          e("div",{className:"grphdr",onClick:()=>setColMeses(p=>({...p,[g.mk]:!p[g.mk]}))},
            e("span",{style:{fontSize:13.5,fontWeight:700,color:T.text}}, `${mCol?"▸":"▾"} ${mesLabel(g.mk)}`),
            e("span",{style:{display:"flex",alignItems:"center",gap:8}},
              e("span",{style:{fontSize:11,color:"#27ae60"}},`+${fmt(g.ing)}`),
              e("span",{style:{fontSize:11,color:"#e74c3c"}},`−${fmt(g.egr)}`),
              e("span",{style:{fontSize:11,fontWeight:700,color:neto>=0?"#27ae60":"#e74c3c"}},`${neto>=0?"+":""}${fmt(neto)}`)
            )
          ),
          !mCol && g.dias.map(d=>{
            const dCol = !!colDias[d.dk];
            return e("div",{key:d.dk,style:{display:"flex",flexDirection:"column",gap:6}},
              e("div",{className:"dayhdr",onClick:()=>setColDias(p=>({...p,[d.dk]:!p[d.dk]}))},
                e("span",{style:{fontSize:11.5,fontWeight:600,color:T.text2}}, `${dCol?"▸":"▾"} ${diaLabel(d.dk)}`),
                e("span",{style:{fontSize:10.5,color:T.text2}}, `${d.items.length} mov.`)
              ),
              !dCol && e("div",{style:{display:"flex",flexDirection:"column",gap:7}}, d.items.map(renderMov))
            );
          })
        );
      })
    )
  );

  const Fijos = e("div",{style:{flex:1,overflowY:"auto",padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}},
    e("p",{style:{margin:"0 0 2px",fontSize:13,color:T.text2,lineHeight:1.5}},"Movimientos recurrentes. Registralos cada período con un toque, ajustando el monto si cambió."),
    fijos.length>0 && e("div",{className:"card",style:{display:"flex",justifyContent:"space-between",alignItems:"center",background:"linear-gradient(135deg,#c0392b22,#e74c3c22)"}},
      e("span",{style:{fontSize:12,color:T.text2}},"Total egresos fijos"), e("span",{style:{fontSize:16,fontWeight:600,color:"#c0392b"}},fmt(totalFijos))
    ),
    fijos.map(f=>{
      const tp=TIPOS[f.tipo]; const cj=cajaById(f.caja_id); const ct=catById(f.categoria_id);
      const mv=fijoMontos[f.id]!==undefined?fijoMontos[f.id]:String(f.monto_base);
      return e("div",{key:f.id,className:"card",style:{borderLeft:`3px solid ${tp.color}`}},
        e("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:10}},
          e("span",{style:{fontSize:18}},tp.icon),
          e("div",{style:{flex:1,minWidth:0}},
            e("p",{style:{margin:0,fontSize:15,fontWeight:600,color:T.text}},f.nombre),
            e("p",{style:{margin:0,fontSize:11,color:T.text2}},`${tp.label} · ${cj?.nombre||"?"}${ct?` · ${ct.nombre}`:""} · base ${fmt(f.monto_base)}`)
          ),
          confirmFijoDel===f.id ? e("div",{style:{display:"flex",gap:4}}, e("button",{className:"conf-yes",onClick:()=>borrarFijo(f.id)},"Sí"), e("button",{className:"conf-no",onClick:()=>setConfirmFijoDel(null)},"No")) : e("button",{className:"del-btn",onClick:()=>setConfirmFijoDel(f.id)},"✕")
        ),
        e("div",{style:{display:"flex",gap:8}},
          e("input",{type:"number",className:"inp",style:{flex:1},value:mv,onChange:ev=>setFijoMontos(prev=>({...prev,[f.id]:ev.target.value})),placeholder:"Monto"}),
          e("button",{className:"btn",style:{background:tp.color,color:"#fff"},onClick:()=>registrarFijo(f)},"Registrar")
        )
      );
    }),
    fijos.length===0 && !syncing && e("p",{style:{color:T.text2,textAlign:"center",margin:"16px 0",fontSize:14}},"Todavía no hay movimientos fijos."),
    e("div",{style:{background:T.bg2,border:`0.5px dashed ${T.border2}`,borderRadius:14,padding:14,marginTop:4}},
      e("p",{style:{margin:"0 0 10px",fontSize:13,fontWeight:600,color:T.text}},"➕ Nuevo fijo"),
      e("input",{className:"inp",style:{marginBottom:8},value:nuevoFijo.nombre,onChange:ev=>setNuevoFijo({...nuevoFijo,nombre:ev.target.value}),placeholder:"Nombre (ej: Alquiler)"}),
      e("div",{style:{display:"flex",gap:8,marginBottom:8}},
        e("select",{className:"inp",style:{flex:1},value:nuevoFijo.tipo,onChange:ev=>setNuevoFijo({...nuevoFijo,tipo:ev.target.value})}, e("option",{value:"egreso"},"Egreso"), e("option",{value:"ingreso"},"Ingreso")),
        e("input",{type:"number",className:"inp",style:{flex:1},value:nuevoFijo.monto,onChange:ev=>setNuevoFijo({...nuevoFijo,monto:ev.target.value}),placeholder:"Monto base"})
      ),
      e("div",{style:{display:"flex",gap:8,marginBottom:10}},
        e("select",{className:"inp",style:{flex:1},value:nuevoFijo.caja_id,onChange:ev=>setNuevoFijo({...nuevoFijo,caja_id:ev.target.value})}, e("option",{value:""},"Caja..."), cajas.map(c=>e("option",{key:c.id,value:c.id},`${c.icon} ${c.nombre}`))),
        e("select",{className:"inp",style:{flex:1},value:nuevoFijo.categoria_id,onChange:ev=>setNuevoFijo({...nuevoFijo,categoria_id:ev.target.value})}, e("option",{value:""},"Categoría..."), cats.map(c=>e("option",{key:c.id,value:c.id},`${c.icon} ${c.nombre}`)))
      ),
      e("button",{className:"btn",style:{background:"#c0392b",color:"#fff",width:"100%"},onClick:agregarFijo},"Agregar fijo")
    )
  );

  const Analisis = e("div",{style:{flex:1,overflowY:"auto",padding:"14px 16px",display:"flex",flexDirection:"column",gap:14}},
    e("div",{className:"card"},
      e("p",{style:{margin:"0 0 10px",fontSize:13,fontWeight:600,color:T.text}},"📊 Ingresos vs Egresos (6 meses)"),
      e(BarrasMes,{meses:meses6,T}),
      e("div",{style:{display:"flex",gap:16,justifyContent:"center",marginTop:8}},
        e("span",{style:{fontSize:11,color:T.text2,display:"flex",alignItems:"center",gap:5}}, e("span",{style:{width:10,height:10,borderRadius:2,background:"#27ae60",display:"inline-block"}}),"Ingresos"),
        e("span",{style:{fontSize:11,color:T.text2,display:"flex",alignItems:"center",gap:5}}, e("span",{style:{width:10,height:10,borderRadius:2,background:"#e74c3c",display:"inline-block"}}),"Egresos")
      )
    ),
    tortaData.length>0 && e("div",{className:"card"},
      e("p",{style:{margin:"0 0 10px",fontSize:13,fontWeight:600,color:T.text}},(fDesde||fHasta)?"🍰 Egresos por categoría (período filtrado)":"🍰 Egresos por categoría (este mes)"),
      e(Torta,{data:tortaData,total:tortaTotal,T,hov:hovTorta,onHov:setHovTorta}),
      e("div",{style:{marginTop:14}},
        tortaData.map((d,i)=>{ const pct=tortaTotal>0?Math.round(d.monto/tortaTotal*100):0;
          return e("div",{key:i,className:"leg",style:{justifyContent:"space-between",background:hovTorta===i?T.bg2:"transparent",borderRadius:8,padding:"3px 6px",cursor:"pointer"},onMouseEnter:()=>setHovTorta(i),onMouseLeave:()=>setHovTorta(null)},
            e("span",{style:{display:"flex",alignItems:"center",gap:7,color:T.text}}, e("span",{style:{width:10,height:10,borderRadius:"50%",background:d.color}}), d.nombre),
            e("span",{style:{color:T.text2}},`${fmt(d.monto)} · ${pct}%`)
          );
        })
      )
    ),
    tortaData.length===0 && e("p",{style:{color:T.text2,textAlign:"center",marginTop:30,fontSize:14}},"Sin egresos para graficar en el período.")
  );

  const Config = e("div",{style:{flex:1,overflowY:"auto",padding:"14px 16px",display:"flex",flexDirection:"column",gap:16}},
    e("div",null,
      e("p",{style:{margin:"0 0 8px",fontSize:14,fontWeight:600,color:T.text}},"💰 Cajas"),
      cajas.map(c=>{ const s=saldoCaja(c.id);
        return e("div",{key:c.id,className:"card",style:{display:"flex",alignItems:"center",gap:10,marginBottom:8,borderLeft:`3px solid ${c.color}`}},
          e("span",{style:{fontSize:20}},c.icon),
          e("div",{style:{flex:1}}, e("p",{style:{margin:0,fontSize:14,fontWeight:600,color:T.text}},c.nombre), e("p",{style:{margin:0,fontSize:11,color:T.text2}},`${c.moneda} · saldo ${fmt(s,c.moneda)}`)),
          confirmCajaDel===c.id ? e("div",{style:{display:"flex",gap:4}}, e("button",{className:"conf-yes",onClick:()=>borrarCaja(c.id)},"Sí"), e("button",{className:"conf-no",onClick:()=>setConfirmCajaDel(null)},"No")) : e("button",{className:"del-btn",onClick:()=>setConfirmCajaDel(c.id)},"✕")
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
        cats.map(c=>e("div",{key:c.id,className:"chip",style:{borderColor:c.color}},
          e("span",{style:{fontSize:14}},c.icon), e("span",{style:{fontSize:12,color:T.text}},c.nombre), e("span",{style:{fontSize:9,color:T.text2,textTransform:"uppercase"}},c.tipo==="ambos"?"":c.tipo),
          confirmCatDel===c.id ? e("span",{style:{display:"flex",gap:3,marginLeft:3}}, e("button",{className:"conf-yes",style:{padding:"1px 7px"},onClick:()=>borrarCat(c.id)},"Sí"), e("button",{className:"conf-no",style:{padding:"1px 7px"},onClick:()=>setConfirmCatDel(null)},"No")) : e("button",{onClick:()=>setConfirmCatDel(c.id),style:{background:"none",border:"none",cursor:"pointer",color:"#bbb",fontSize:11,marginLeft:2}},"✕")
        ))
      ),
      e("div",{style:{display:"flex",gap:8}},
        e("input",{className:"inp",style:{flex:2},value:nuevaCat.nombre,onChange:ev=>setNuevaCat({...nuevaCat,nombre:ev.target.value}),placeholder:"Nombre (ej: Proveedores)"}),
        e("select",{className:"inp",style:{flex:1},value:nuevaCat.tipo,onChange:ev=>setNuevaCat({...nuevaCat,tipo:ev.target.value})}, e("option",{value:"ambos"},"Ambos"), e("option",{value:"ingreso"},"Ingreso"), e("option",{value:"egreso"},"Egreso")),
        e("button",{className:"btn",style:{background:"#8e44ad",color:"#fff"},onClick:agregarCat},"+")
      )
    )
  );

  const Cobrar = e("div",{style:{flex:1,overflowY:"auto",padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}},
    e("p",{style:{margin:"0 0 2px",fontSize:13,color:T.text2,lineHeight:1.5}},"Cuentas por cobrar: plata que te deben y todavía no entró. Al marcar \"cobrado\" podés registrar el ingreso en la caja que elijas."),
    cobrarPend.length>0 && e("div",{className:"card",style:{display:"flex",justifyContent:"space-between",alignItems:"center",background:"linear-gradient(135deg,#d6891022,#f39c1222)"}},
      e("span",{style:{fontSize:12,color:T.text2}},"Total a cobrar"), e("span",{style:{fontSize:16,fontWeight:600,color:"#d68910"}},fmt(totalCobrar))
    ),
    ...cobrarPend.map(renderCobro),
    cobrarPend.length===0 && !syncing && e("p",{style:{color:T.text2,textAlign:"center",margin:"16px 0",fontSize:14}},"No hay cuentas pendientes de cobro."),
    e("div",{style:{background:T.bg2,border:`0.5px dashed ${T.border2}`,borderRadius:14,padding:14,marginTop:4}},
      e("p",{style:{margin:"0 0 10px",fontSize:13,fontWeight:600,color:T.text}},"➕ Nueva cuenta por cobrar"),
      e("input",{className:"inp",style:{marginBottom:8},value:nuevoCobro.quien,onChange:ev=>setNuevoCobro({...nuevoCobro,quien:ev.target.value}),placeholder:"¿Quién debe? (ej: Logística)"}),
      e("div",{style:{display:"flex",gap:8,marginBottom:8}},
        e("input",{type:"number",className:"inp",style:{flex:1},value:nuevoCobro.monto,onChange:ev=>setNuevoCobro({...nuevoCobro,monto:ev.target.value}),placeholder:"Monto"}),
        e("input",{type:"date",className:"inp",style:{flex:1},value:nuevoCobro.fecha,max:today(),onChange:ev=>setNuevoCobro({...nuevoCobro,fecha:ev.target.value})})
      ),
      e("input",{className:"inp",style:{marginBottom:10},value:nuevoCobro.descripcion,onChange:ev=>setNuevoCobro({...nuevoCobro,descripcion:ev.target.value}),placeholder:"Descripción (opcional)"}),
      e("button",{className:"btn",style:{background:"#d68910",color:"#fff",width:"100%"},onClick:agregarCobro},"Agregar")
    ),
    cobrarHecho.length>0 && e("div",{style:{marginTop:4}},
      e("p",{style:{margin:"6px 0 8px",fontSize:13,fontWeight:600,color:T.text}},"✅ Ya cobradas"),
      ...cobrarHecho.slice(0,30).map(x=>e("div",{key:x.id,className:"card",style:{opacity:.6,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 13px",marginBottom:6}},
        e("div",{style:{minWidth:0}}, e("p",{style:{margin:0,fontSize:13,color:T.text}},x.quien), e("p",{style:{margin:0,fontSize:11,color:T.text2}},`${disp(x.fecha)}${x.descripcion?" · "+x.descripcion:""}`)),
        e("span",{style:{fontSize:14,fontWeight:600,color:"#27ae60"}},fmt(x.monto))
      ))
    )
  );

  const retirosList = movs.filter(m=>m.es_retiro);
  const Retiros = e("div",{style:{flex:1,overflowY:"auto",padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}},
    e("p",{style:{margin:"0 0 2px",fontSize:13,color:T.text2,lineHeight:1.5}},"Retiros de socios: plata que cada uno saca de la empresa. El que retiró menos queda con saldo a favor para igualar."),
    e("div",{className:"card",style:{background:"linear-gradient(135deg,#16a085,#2c3e50)",border:"none",padding:"16px"}},
      ...USUARIOS.map(u=>e("div",{key:u,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"3px 0"}},
        e("span",{style:{fontSize:14,color:"rgba(255,255,255,.9)"}},`↩️ ${u}`),
        e("span",{style:{fontSize:17,fontWeight:700,color:"#fff"}},fmt(retiros[u]||0))
      )),
      difRet>0
        ? e("p",{style:{margin:"8px 0 0",fontSize:12.5,color:"#fff",fontWeight:600,borderTop:"1px solid rgba(255,255,255,.25)",paddingTop:8}},`✅ ${aFavor} tiene ${fmt(difRet)} a favor para igualar.`)
        : (hayRetiros?e("p",{style:{margin:"8px 0 0",fontSize:12.5,color:"rgba(255,255,255,.9)",borderTop:"1px solid rgba(255,255,255,.25)",paddingTop:8}},"⚖️ Retiros igualados."):null)
    ),
    e("div",{style:{background:T.bg2,border:`0.5px dashed ${T.border2}`,borderRadius:14,padding:14}},
      e("p",{style:{margin:"0 0 10px",fontSize:13,fontWeight:600,color:T.text}},`➕ Registrar retiro (${usuario})`),
      e("div",{style:{display:"flex",gap:8,marginBottom:8}},
        e("input",{type:"number",className:"inp",style:{flex:1},value:nuevoRetiro.monto,onChange:ev=>setNuevoRetiro({...nuevoRetiro,monto:ev.target.value}),placeholder:"Monto"}),
        e("select",{className:"inp",style:{flex:1},value:nuevoRetiro.caja_id,onChange:ev=>setNuevoRetiro({...nuevoRetiro,caja_id:ev.target.value})}, e("option",{value:""},"Caja..."), cajas.map(c=>e("option",{key:c.id,value:c.id},`${c.icon} ${c.nombre}`)))
      ),
      e("input",{className:"inp",style:{marginBottom:10},value:nuevoRetiro.descr,onChange:ev=>setNuevoRetiro({...nuevoRetiro,descr:ev.target.value}),placeholder:"Nota (opcional)"}),
      e("button",{className:"btn",style:{background:"#16a085",color:"#fff",width:"100%"},onClick:agregarRetiro},"Registrar retiro")
    ),
    ...USUARIOS.map(u=>{
      const items=retirosList.filter(m=>m.autor===u);
      const tot=items.reduce((s,m)=>s+Number(m.monto),0);
      return e("div",{key:u,style:{display:"flex",flexDirection:"column",gap:7}},
        e("div",{className:"grphdr",style:{cursor:"default"}},
          e("span",{style:{fontSize:13.5,fontWeight:700,color:T.text}},`↩️ ${u}`),
          e("span",{style:{fontSize:13,fontWeight:700,color:"#16a085"}},fmt(tot))
        ),
        items.length>0 ? items.map(renderMov) : e("p",{style:{color:T.text2,fontSize:12.5,padding:"2px 4px"}},"Sin retiros.")
      );
    })
  );

  const Modal = editMov && e("div",{className:"modal-bg",onClick:()=>setEditMov(null)},
    e("div",{className:"modal",onClick:ev=>ev.stopPropagation()},
      e("p",{style:{margin:"0 0 16px",fontSize:16,fontWeight:600,color:T.text}},"✏️ Editar movimiento"),
      e("p",{className:"lbl"},"Descripción"),
      e("input",{className:"inp",style:{marginBottom:12},value:editMov.descripcion,onChange:ev=>setEditMov({...editMov,descripcion:ev.target.value})}),
      e("div",{style:{display:"flex",gap:10,marginBottom:12}},
        e("div",{style:{flex:1}}, e("p",{className:"lbl"},"Monto"), e("input",{type:"number",className:"inp",value:editMov.monto,onChange:ev=>setEditMov({...editMov,monto:ev.target.value})})),
        e("div",{style:{flex:1}}, e("p",{className:"lbl"},"Fecha"), e("input",{type:"date",className:"inp",value:editMov.fecha,max:today(),onChange:ev=>setEditMov({...editMov,fecha:ev.target.value})}))
      ),
      e("p",{className:"lbl"},"Caja"),
      e("select",{className:"inp",style:{marginBottom:12},value:editMov.caja_id,onChange:ev=>setEditMov({...editMov,caja_id:ev.target.value})}, cajas.map(c=>e("option",{key:c.id,value:c.id},`${c.icon} ${c.nombre}`))),
      e("p",{className:"lbl"},"Categoría"),
      e("select",{className:"inp",style:{marginBottom:18},value:editMov.categoria_id,onChange:ev=>setEditMov({...editMov,categoria_id:ev.target.value})}, e("option",{value:""},"Sin categoría"), cats.map(c=>e("option",{key:c.id,value:c.id},`${c.icon} ${c.nombre}`))),
      e("div",{style:{display:"flex",gap:10}},
        e("button",{className:"btn",style:{flex:1,background:T.bg2,color:T.text2},onClick:()=>setEditMov(null)},"Cancelar"),
        e("button",{className:"btn",style:{flex:1,background:"#2980b9",color:"#fff"},onClick:guardarEdit},"Guardar")
      )
    )
  );

  return e("div",{style:{fontFamily:"system-ui,sans-serif",maxWidth:480,margin:"0 auto",display:"flex",flexDirection:"column",height:"100dvh",background:T.bg}},
    e("style",null,css),
    Modal,
    Header,
    view==="inicio" && Inicio,
    view==="nuevo" && Nuevo,
    view==="movimientos" && Movimientos,
    view==="cobrar" && Cobrar,
    view==="retiros" && Retiros,
    view==="fijos" && Fijos,
    view==="analisis" && Analisis,
    view==="config" && Config
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
}
