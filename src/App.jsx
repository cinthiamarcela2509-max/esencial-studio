import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import { LOGO_BASE64, SERVICE_IMAGES } from "./assets/resources";

const C = {
  bg:"#F6F0E8", surface:"#FFFDF9", surfaceAlt:"#EFE8DC",
  charcoal:"#1E1810", muted:"#7A6A55",
  gold:"#B07D2A", goldLight:"#D4A843", champagne:"#F0E2C8",
  border:"#DDD0BC", green:"#5C8A6A", greenPale:"#E4F0E8",
  red:"#B05050", redPale:"#F5E4E4", orange:"#C47830", orangePale:"#FAF0E0",
  white:"#FFFDF9",
};
const FD = "'Cormorant Garamond', serif";
const FB = "Inter, sans-serif";

function fp(n){return `$${Number(n||0).toLocaleString("es-CO")} COP`;}
function fd(m){m=Number(m);return m>=60?`${Math.floor(m/60)}h${m%60>0?` ${m%60}m`:""}` :`${m}m`;}
function fdate(d){if(!d)return"—";const[y,m,day]=d.split("-");return`${day}/${m}/${y}`;}
function todayStr(){const n=new Date();return`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`;}
function nowTime(){const n=new Date();return`${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`;}

// ── HOOKS ──────────────────────────────────────────────────────
function usePersonal(){
  const [personal,setPersonal]=useState([]);
  const load=useCallback(async()=>{
    const{data}=await supabase.from("personal").select("*").eq("activo",true).order("orden");
    if(data)setPersonal(data.map(p=>({id:p.id,name:p.nombre,specialty:p.especialidad,emoji:p.foto_emoji})));
  },[]);
  useEffect(()=>{load();},[load]);
  // Admin CRUD
  const addPersonal=async(item)=>{await supabase.from("personal").insert({nombre:item.name,especialidad:item.specialty,foto_emoji:item.emoji,orden:99});load();};
  const updatePersonal=async(id,item)=>{await supabase.from("personal").update({nombre:item.name,especialidad:item.specialty,foto_emoji:item.emoji}).eq("id",id);load();};
  const deletePersonal=async(id)=>{await supabase.from("personal").update({activo:false}).eq("id",id);load();};
  return{personal,addPersonal,updatePersonal,deletePersonal};
}

function useServices(){
  const [services,setServices]=useState([]);
  const [loading,setLoading]=useState(true);
  const load=useCallback(async()=>{
    const{data}=await supabase.from("servicios").select("*").eq("activo",true).order("orden");
    if(data){
      const g={};
      data.forEach(s=>{
        if(!g[s.categoria])g[s.categoria]={id:s.categoria,category:s.categoria,emoji:s.emoji,items:[]};
        g[s.categoria].items.push({id:s.id,name:s.nombre,duration:s.duracion,price:s.precio,desc:s.descripcion});
      });
      setServices(Object.values(g));
    }
    setLoading(false);
  },[]);
  useEffect(()=>{load();},[load]);
  const addService=async(catName,emoji,item)=>{await supabase.from("servicios").insert({categoria:catName,emoji,nombre:item.name,duracion:item.duration,precio:item.price,descripcion:item.desc,orden:99});load();};
  const updateService=async(id,item)=>{await supabase.from("servicios").update({nombre:item.name,duracion:item.duration,precio:item.price,descripcion:item.desc}).eq("id",id);load();};
  const deleteService=async(id)=>{await supabase.from("servicios").update({activo:false}).eq("id",id);load();};
  const addCategory=(name,emoji)=>{setServices(p=>[...p,{id:name,category:name,emoji,items:[]}]);};
  return{services,loading,addService,updateService,deleteService,addCategory};
}

function useClients(){
  const [clients,setClients]=useState([]);
  const load=useCallback(async()=>{
    const{data}=await supabase.from("clientes").select("*").order("creado_en",{ascending:false});
    if(data)setClients(data.map(c=>({id:c.id,name:c.nombre,phone:c.telefono,email:c.email,notes:c.notas,visits:c.visitas,lastService:c.ultimo_servicio,lastDate:c.ultima_visita})));
  },[]);
  useEffect(()=>{load();},[load]);
  const registerClient=async(form)=>{
    const{data:ex}=await supabase.from("clientes").select("*").eq("telefono",form.phone).single();
    if(ex)return{id:ex.id,name:ex.nombre,phone:ex.telefono,email:ex.email,notes:ex.notas,visits:ex.visitas,lastService:ex.ultimo_servicio,lastDate:ex.ultima_visita};
    const{data}=await supabase.from("clientes").insert({nombre:form.name,telefono:form.phone,email:form.email,notas:form.notes}).select().single();
    load();
    return data?{id:data.id,name:data.nombre,phone:data.telefono,email:data.email,notes:data.notas,visits:0}:null;
  };
  const loginClient=async(phone)=>{
    const{data}=await supabase.from("clientes").select("*").eq("telefono",phone).single();
    return data?{id:data.id,name:data.nombre,phone:data.telefono,email:data.email,notes:data.notas,visits:data.visitas,lastService:data.ultimo_servicio,lastDate:data.ultima_visita}:null;
  };
  const updateClientAfterBooking=async(clientId,serviceName,date)=>{
    const{count}=await supabase.from("citas").select("id",{count:"exact"}).eq("cliente_id",clientId);
    await supabase.from("clientes").update({visitas:count,ultimo_servicio:serviceName,ultima_visita:date}).eq("id",clientId);
    load();
  };
  return{clients,registerClient,loginClient,updateClientAfterBooking};
}

function useAgenda(){
  const [agenda,setAgenda]=useState([]);
  const [loading,setLoading]=useState(true);
  const load=useCallback(async()=>{
    const{data}=await supabase.from("citas").select("*").order("fecha").order("hora");
    if(data)setAgenda(data.map(a=>({id:a.id,clientId:a.cliente_id,clientName:a.cliente_nombre,clientPhone:a.cliente_telefono,serviceId:a.servicio_id,serviceName:a.servicio_nombre,personalId:a.personal_id,personalName:a.personal_nombre,duration:a.duracion,date:a.fecha,time:a.hora?.slice(0,5),note:a.nota,status:a.estado})));
    setLoading(false);
  },[]);
  useEffect(()=>{load();},[load]);
  useEffect(()=>{const i=setInterval(load,20000);return()=>clearInterval(i);},[load]);
  const bookAppointment=async(b)=>{
    await supabase.from("citas").insert({cliente_id:b.clientId,cliente_nombre:b.clientName,cliente_telefono:b.clientPhone,servicio_id:b.serviceId,servicio_nombre:b.serviceName,personal_id:b.personalId,personal_nombre:b.personalName,duracion:b.duration,fecha:b.date,hora:b.time,nota:b.note,estado:"pending"});
    load();
  };
  const updateStatus=async(id,estado)=>{await supabase.from("citas").update({estado}).eq("id",id);load();};
  return{agenda,loading,bookAppointment,updateStatus};
}

// ── UI ATOMS ───────────────────────────────────────────────────
function Inp({label,value,onChange,type="text",placeholder,required}){
  return(
    <div style={{marginBottom:13}}>
      <label style={{display:"block",fontFamily:FB,fontSize:11,letterSpacing:1.5,textTransform:"uppercase",color:C.muted,marginBottom:5}}>
        {label}{required&&<span style={{color:C.gold}}> *</span>}
      </label>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder||""}
        style={{width:"100%",padding:"10px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontFamily:FB,fontSize:14,color:C.charcoal,background:C.bg,boxSizing:"border-box",outline:"none"}}/>
    </div>
  );
}

function Btn({label,onClick,variant="gold",full,small,disabled}){
  const s={
    gold:{background:`linear-gradient(135deg,${C.goldLight} 0%,${C.gold} 100%)`,color:C.charcoal,border:"none"},
    dark:{background:C.charcoal,color:C.white,border:"none"},
    ghost:{background:"none",color:C.muted,border:`1.5px solid ${C.border}`},
    red:{background:C.redPale,color:C.red,border:"none"},
  };
  return(
    <button onClick={disabled?undefined:onClick} style={{...s[variant],width:full?"100%":"auto",padding:small?"7px 14px":"12px 20px",borderRadius:10,fontFamily:FB,fontSize:small?12:14,fontWeight:600,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.4:1}}>
      {label}
    </button>
  );
}

function Tag({color}){
  const m={confirmed:[C.green,C.greenPale,"Confirmado"],pending:[C.orange,C.orangePale,"Pendiente"],cancelled:[C.red,C.redPale,"Cancelado"]};
  const[fg,bg,text]=m[color]||[C.muted,C.surfaceAlt,color];
  return<span style={{display:"inline-block",padding:"3px 10px",borderRadius:20,fontFamily:FB,fontSize:11,fontWeight:600,color:fg,background:bg}}>{text}</span>;
}

function PageHeader({eyebrow,title,right}){
  return(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:20}}>
      <div>
        <p style={{fontFamily:FB,fontSize:10,letterSpacing:2.5,color:C.goldLight,textTransform:"uppercase",margin:"0 0 3px"}}>{eyebrow}</p>
        <h2 style={{fontFamily:FD,fontSize:28,fontWeight:600,color:C.charcoal,margin:0,lineHeight:1}}>{title}</h2>
      </div>
      {right}
    </div>
  );
}

function Loading(){return<div style={{padding:"60px 20px",textAlign:"center"}}><p style={{fontFamily:FD,fontSize:22,color:C.muted}}>Cargando...</p></div>;}

function BottomNav({tab,setTab,isAdmin}){
  const tabs=isAdmin
    ?[{id:"admin-agenda",label:"Agenda",icon:"◷"},{id:"admin-clientes",label:"Clientes",icon:"◉"},{id:"admin-servicios",label:"Servicios",icon:"✦"},{id:"admin-personal",label:"Personal",icon:"👤"},{id:"admin-config",label:"Config",icon:"⚙"}]
    :[{id:"inicio",label:"Inicio",icon:"◈"},{id:"servicios",label:"Servicios",icon:"✦"},{id:"reservar",label:"Reservar",icon:"＋"},{id:"perfil",label:"Mi perfil",icon:"◉"}];
  return(
    <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:C.surface,borderTop:`1px solid ${C.border}`,display:"flex",zIndex:100}}>
      {tabs.map(t=>(
        <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"13px 0 17px",background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          <span style={{fontSize:tab===t.id?18:15,color:tab===t.id?C.goldLight:C.muted}}>{t.icon}</span>
          <p style={{fontFamily:FB,fontSize:10,fontWeight:tab===t.id?600:400,color:tab===t.id?C.goldLight:C.muted,margin:0}}>{t.label}</p>
        </button>
      ))}
    </div>
  );
}

// ── BIENVENIDA ────────────────────────────────────────────────
function ViewBienvenida({setCurrentUser,registerClient,loginClient,onSecretTap}){
  const [mode,setMode]=useState("welcome");
  const [form,setForm]=useState({name:"",phone:"",email:"",notes:""});
  const [loginPhone,setLoginPhone]=useState("");
  const [error,setError]=useState("");
  const [saving,setSaving]=useState(false);

  const register=async()=>{
    if(!form.name||!form.phone)return;
    setSaving(true);setError("");
    const client=await registerClient(form);
    setSaving(false);
    if(client)setCurrentUser(client);
    else setError("Hubo un error. Intenta de nuevo.");
  };
  const login=async()=>{
    if(!loginPhone)return;
    setSaving(true);setError("");
    const found=await loginClient(loginPhone);
    setSaving(false);
    if(found)setCurrentUser(found);
    else setError("No encontramos una cuenta con ese número.");
  };

  return(
    <div style={{minHeight:"100vh",background:C.charcoal,display:"flex",flexDirection:"column",padding:"60px 28px 40px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-80,right:-80,width:280,height:280,borderRadius:"50%",background:C.gold,opacity:0.07}}/>
      <div style={{position:"absolute",bottom:-40,left:-40,width:180,height:180,borderRadius:"50%",background:C.goldLight,opacity:0.05}}/>
      <div style={{textAlign:"center",marginBottom:44,flex:1,display:"flex",flexDirection:"column",justifyContent:"center"}}>
        <img src={LOGO_BASE64} alt="Esencial Studio" style={{width:160,height:"auto",objectFit:"contain",marginBottom:16,margin:"0 auto 16px",display:"block",cursor:"default"}} onClick={onSecretTap}/>        <p style={{fontFamily:FB,fontSize:11,color:"rgba(245,239,230,0.4)",margin:"0 0 8px",letterSpacing:2.5,textTransform:"uppercase"}}>A domicilio · Cúcuta, Colombia</p>
        <h1 style={{fontFamily:FD,fontSize:38,fontWeight:600,color:"#F6F0E8",margin:"0 0 8px",lineHeight:1.15}}>Belleza que llega<br/>hasta ti</h1>
        <p style={{fontFamily:FB,fontSize:14,color:"rgba(245,239,230,0.4)",margin:0}}>Uñas y peluquería profesional</p>
      </div>

      {mode==="welcome"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <button onClick={()=>setMode("register")} style={{padding:"16px",borderRadius:12,border:"none",background:`linear-gradient(135deg,${C.goldLight},${C.gold})`,fontFamily:FB,fontSize:15,fontWeight:700,color:C.charcoal,cursor:"pointer"}}>Crear cuenta</button>
          <button onClick={()=>setMode("login")} style={{padding:"16px",borderRadius:12,border:`1.5px solid rgba(212,168,67,0.35)`,background:"rgba(212,168,67,0.07)",fontFamily:FB,fontSize:15,fontWeight:600,color:C.goldLight,cursor:"pointer"}}>Ya tengo cuenta</button>
        </div>
      )}

      {mode==="register"&&(
        <div style={{background:"rgba(255,253,249,0.05)",borderRadius:16,padding:20}}>
          <p style={{fontFamily:FD,fontSize:22,color:C.goldLight,margin:"0 0 16px"}}>Crear cuenta</p>
          <Inp label="Nombre completo" value={form.name} onChange={v=>setForm(s=>({...s,name:v}))} required/>
          <Inp label="Teléfono" value={form.phone} onChange={v=>setForm(s=>({...s,phone:v}))} type="tel" required/>
          <Inp label="Email (opcional)" value={form.email} onChange={v=>setForm(s=>({...s,email:v}))} type="email"/>
          <div style={{marginBottom:16}}>
            <label style={{display:"block",fontFamily:FB,fontSize:11,letterSpacing:1.5,textTransform:"uppercase",color:C.muted,marginBottom:5}}>Notas (alergias, preferencias)</label>
            <textarea value={form.notes} onChange={e=>setForm(s=>({...s,notes:e.target.value}))} rows={2}
              style={{width:"100%",padding:"10px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontFamily:FB,fontSize:14,color:C.charcoal,background:C.bg,boxSizing:"border-box",outline:"none",resize:"none"}}/>
          </div>
          {error&&<p style={{fontFamily:FB,fontSize:12,color:"#F5A0A0",margin:"-8px 0 12px"}}>{error}</p>}
          <Btn label={saving?"Creando cuenta...":"Crear mi cuenta"} onClick={register} variant="gold" full disabled={!form.name||!form.phone||saving}/>
          <p style={{fontFamily:FB,fontSize:13,color:"rgba(245,239,230,0.4)",textAlign:"center",margin:"14px 0 0",cursor:"pointer"}} onClick={()=>{setMode("welcome");setError("");}}>← Volver</p>
        </div>
      )}

      {mode==="login"&&(
        <div style={{background:"rgba(255,253,249,0.05)",borderRadius:16,padding:20}}>
          <p style={{fontFamily:FD,fontSize:22,color:C.goldLight,margin:"0 0 16px"}}>Ingresar</p>
          <Inp label="Tu número de teléfono" value={loginPhone} onChange={setLoginPhone} type="tel"/>
          {error&&<p style={{fontFamily:FB,fontSize:12,color:"#F5A0A0",margin:"-8px 0 12px"}}>{error}</p>}
          <Btn label={saving?"Buscando...":"Ingresar"} onClick={login} variant="gold" full disabled={!loginPhone||saving}/>
          <p style={{fontFamily:FB,fontSize:13,color:"rgba(245,239,230,0.4)",textAlign:"center",margin:"14px 0 0",cursor:"pointer"}} onClick={()=>{setMode("welcome");setError("");}}>← Volver</p>
        </div>
      )}
    </div>
  );
}

// ── INICIO ────────────────────────────────────────────────────
function ViewInicio({currentUser,agenda,services,setTab,setCurrentUser}){
  const myBookings=agenda.filter(a=>a.clientId===currentUser?.id&&a.date>=todayStr()).sort((a,b)=>a.date>b.date?1:-1);
  const allSrvs=services.flatMap(c=>c.items);
  return(
    <div style={{paddingBottom:90}}>
      <div style={{background:C.charcoal,padding:"52px 24px 32px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-60,right:-60,width:220,height:220,borderRadius:"50%",background:C.gold,opacity:0.08}}/>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
          <img src={LOGO_BASE64} alt="Esencial Studio" style={{width:110,height:"auto",objectFit:"contain"}}/>
        </div>
        <p style={{fontFamily:FB,fontSize:13,color:"rgba(245,239,230,0.5)",margin:"0 0 4px"}}>Hola, {currentUser?.name?.split(" ")[0]} 👋</p>
        <h1 style={{fontFamily:FD,fontSize:34,fontWeight:600,color:"#F6F0E8",margin:"0 0 6px",lineHeight:1.15}}>Belleza que llega<br/>hasta ti</h1>
        <p style={{fontFamily:FB,fontSize:13,color:"rgba(245,239,230,0.45)",margin:"0 0 20px"}}>A domicilio · Cúcuta, Colombia</p>
        <div style={{display:"flex",gap:10}}>
          <Btn label="Reservar turno" onClick={()=>setTab("reservar")} variant="gold"/>
          <button onClick={()=>setCurrentUser(null)} style={{padding:"12px 16px",borderRadius:10,border:`1px solid rgba(212,168,67,0.3)`,background:"rgba(212,168,67,0.08)",fontFamily:FB,fontSize:13,color:C.goldLight,cursor:"pointer"}}>Salir</button>
        </div>
      </div>
      <div style={{padding:"22px 20px 0"}}>
        {myBookings.length>0&&(
          <div style={{marginBottom:24}}>
            <p style={{fontFamily:FB,fontSize:11,letterSpacing:2,color:C.muted,textTransform:"uppercase",marginBottom:12}}>Mis próximas citas</p>
            {myBookings.slice(0,2).map(b=>(
              <div key={b.id} style={{background:C.surface,borderRadius:12,padding:"14px 16px",marginBottom:10,borderLeft:`3px solid ${C.goldLight}`}}>
                <p style={{fontFamily:FB,fontSize:14,fontWeight:600,color:C.charcoal,margin:"0 0 4px"}}>{b.serviceName}</p>
                <p style={{fontFamily:FB,fontSize:12,color:C.muted,margin:"0 0 2px"}}>👤 {b.personalName||"—"}</p>
                <p style={{fontFamily:FB,fontSize:12,color:C.muted,margin:0}}>📅 {fdate(b.date)} · ⏰ {b.time} <Tag color={b.status}/></p>
              </div>
            ))}
          </div>
        )}
        <p style={{fontFamily:FB,fontSize:11,letterSpacing:2,color:C.muted,textTransform:"uppercase",marginBottom:12}}>Servicios destacados</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
          {allSrvs.slice(0,4).map(s=>(
            <div key={s.id} onClick={()=>setTab("servicios")} style={{background:C.surface,borderRadius:12,padding:"14px 12px",cursor:"pointer"}}>
              <p style={{fontFamily:FB,fontSize:13,fontWeight:600,color:C.charcoal,margin:"0 0 4px"}}>{s.name}</p>
              <p style={{fontFamily:FD,fontSize:17,fontWeight:600,color:C.gold,margin:"0 0 2px"}}>{fp(s.price)}</p>
              <p style={{fontFamily:FB,fontSize:11,color:C.muted,margin:0}}>{fd(s.duration)}</p>
            </div>
          ))}
        </div>
        <Btn label="Ver todos los servicios →" onClick={()=>setTab("servicios")} variant="ghost" full/>
      </div>
    </div>
  );
}

// ── SERVICIOS (con botón Reservar) ────────────────────────────
function ViewServicios({services,loading,setTab,setPreselect}){
  const [open,setOpen]=useState(null);
  if(loading)return<Loading/>;
  return(
    <div style={{padding:"24px 20px 90px"}}>
      <PageHeader eyebrow="Esencial Studio" title="Servicios"/>
      {services.map(cat=>(
        <div key={cat.id} style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,paddingBottom:8,borderBottom:`1px solid ${C.border}`}}>
            <span style={{fontSize:18}}>{cat.emoji}</span>
            <p style={{fontFamily:FB,fontSize:12,letterSpacing:2,color:C.muted,textTransform:"uppercase",margin:0,fontWeight:600}}>{cat.category}</p>
          </div>
          {cat.items.map(srv=>(
            <div key={srv.id} style={{background:C.surface,borderRadius:12,marginBottom:10,overflow:"hidden"}}>
              {SERVICE_IMAGES[srv.name]&&<img src={SERVICE_IMAGES[srv.name]} alt={srv.name} style={{width:"100%",height:130,objectFit:"cover",display:"block"}}/>}
              <div style={{padding:"14px 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <div>
                    <p style={{fontFamily:FB,fontSize:15,fontWeight:600,color:C.charcoal,margin:"0 0 2px"}}>{srv.name}</p>
                    <p style={{fontFamily:FB,fontSize:12,color:C.muted,margin:0}}>{fd(srv.duration)}</p>
                  </div>
                  <p style={{fontFamily:FD,fontSize:22,fontWeight:600,color:C.gold,margin:0}}>{fp(srv.price)}</p>
                </div>
                {srv.desc&&<p style={{fontFamily:FB,fontSize:13,color:C.muted,margin:"0 0 12px",lineHeight:1.5}}>{srv.desc}</p>}
                {/* BOTÓN RESERVAR dentro de cada servicio */}
                <Btn
                  label="Reservar este servicio"
                  onClick={()=>{setPreselect(srv.id);setTab("reservar");}}
                  variant="gold" full
                />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── RESERVAR: flujo con selección de personal ─────────────────
function ViewReservar({services,agenda,personal,bookAppointment,currentUser,setTab,preselect,setPreselect,updateClientAfterBooking}){
  const allSrvs=services.flatMap(c=>c.items);
  const [step,setStep]=useState(preselect?2:1); // si viene con preselect, salta a paso 2
  const [srvId,setSrvId]=useState(preselect||"");
  const [staffId,setStaffId]=useState("");
  const [date,setDate]=useState("");
  const [time,setTime]=useState("");
  const [note,setNote]=useState("");
  const [done,setDone]=useState(false);
  const [saving,setSaving]=useState(false);

  const srv=allSrvs.find(s=>s.id===srvId);
  const staff=personal.find(p=>p.id===staffId);

  const ALL_SLOTS=["08:00","09:00","10:00","11:00","12:00","14:00","15:00","16:00","17:00","18:00"];

  // Horarios bloqueados para la persona seleccionada en la fecha elegida
  const getAvailable=(selDate,selStaff)=>{
    if(!selDate||!selStaff)return[];
    const bookedTimes=agenda
      .filter(a=>a.date===selDate&&a.personalId===selStaff&&a.status!=="cancelled")
      .map(a=>a.time);
    const isToday=selDate===todayStr();
    const cur=nowTime();
    return ALL_SLOTS.filter(slot=>{
      if(bookedTimes.includes(slot))return false;
      if(isToday&&slot<=cur)return false;
      return true;
    });
  };

  const available=getAvailable(date,staffId);

  // Cuántas citas tiene cada persona para la fecha elegida (para mostrar disponibilidad)
  const staffLoad=(pid)=>date?agenda.filter(a=>a.date===date&&a.personalId===pid&&a.status!=="cancelled").length:0;

  const confirm=async()=>{
    setSaving(true);
    await bookAppointment({clientId:currentUser.id,clientName:currentUser.name,clientPhone:currentUser.phone,serviceId:srvId,serviceName:srv.name,personalId:staffId,personalName:staff.name,duration:srv.duration,date,time,note});
    await updateClientAfterBooking(currentUser.id,srv.name,date);
    setSaving(false);
    setDone(true);
  };

  if(done)return(
    <div style={{padding:"24px 20px 90px"}}>
      <div style={{background:C.surface,borderRadius:14,padding:32,textAlign:"center",marginTop:20}}>
        <img src={LOGO_BASE64} alt="Esencial Studio" style={{width:100,height:"auto",margin:"0 auto 16px",display:"block"}}/>
        <h2 style={{fontFamily:FD,fontSize:28,color:C.charcoal,margin:"0 0 10px"}}>¡Cita solicitada!</h2>
        <p style={{fontFamily:FB,fontSize:14,color:C.charcoal,margin:"0 0 4px",fontWeight:600}}>{srv?.name}</p>
        <p style={{fontFamily:FB,fontSize:14,color:C.muted,margin:"0 0 4px"}}>👤 {staff?.name}</p>
        <p style={{fontFamily:FB,fontSize:14,color:C.muted,margin:"0 0 20px"}}>📅 {fdate(date)} · ⏰ {time}</p>
        <p style={{fontFamily:FB,fontSize:13,color:C.muted,padding:"12px 16px",background:C.champagne,borderRadius:10,margin:"0 0 24px"}}>
          Tu cita está <strong>pendiente</strong>. Esencial Studio la confirmará pronto.
        </p>
        <Btn label="Volver al inicio" onClick={()=>{setDone(false);setStep(1);setSrvId("");setStaffId("");setDate("");setTime("");setNote("");setPreselect("");setTab("inicio");}} variant="gold" full/>
      </div>
    </div>
  );

  return(
    <div style={{padding:"24px 20px 90px"}}>
      <PageHeader eyebrow="Esencial Studio" title="Reservar"/>

      {/* Barra de progreso */}
      <div style={{display:"flex",gap:6,marginBottom:22}}>
        {[1,2,3].map(n=>(
          <div key={n} style={{flex:1,height:3,borderRadius:4,background:step>=n?C.goldLight:C.border,transition:"background .2s"}}/>
        ))}
      </div>
      <p style={{fontFamily:FB,fontSize:11,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",margin:"-14px 0 18px"}}>
        {step===1?"Paso 1 — Servicio":step===2?"Paso 2 — Especialista":"Paso 3 — Fecha y hora"}
      </p>

      {/* ── PASO 1: Elegir servicio ── */}
      {step===1&&(
        <div>
          {services.map(cat=>(
            <div key={cat.id} style={{marginBottom:16}}>
              <p style={{fontFamily:FB,fontSize:10,letterSpacing:2,color:C.muted,textTransform:"uppercase",marginBottom:8}}>{cat.emoji} {cat.category}</p>
              {cat.items.map(s=>(
                <div key={s.id} onClick={()=>setSrvId(s.id)}
                  style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",borderRadius:10,marginBottom:6,cursor:"pointer",border:`1.5px solid ${srvId===s.id?C.goldLight:C.border}`,background:srvId===s.id?C.champagne:C.surface,transition:"all .15s"}}>
                  <div>
                    <p style={{fontFamily:FB,fontSize:13,fontWeight:500,color:C.charcoal,margin:0}}>{s.name}</p>
                    <p style={{fontFamily:FB,fontSize:11,color:C.muted,margin:"2px 0 0"}}>{fd(s.duration)}</p>
                  </div>
                  <p style={{fontFamily:FD,fontSize:18,fontWeight:600,color:C.gold,margin:0}}>{fp(s.price)}</p>
                </div>
              ))}
            </div>
          ))}
          <Btn label="Continuar →" onClick={()=>srvId&&setStep(2)} variant="gold" full disabled={!srvId}/>
        </div>
      )}

      {/* ── PASO 2: Elegir especialista ── */}
      {step===2&&(
        <div>
          {srv&&(
            <div style={{background:C.champagne,borderRadius:10,padding:"10px 14px",marginBottom:20,display:"flex",justifyContent:"space-between"}}>
              <p style={{fontFamily:FB,fontSize:13,color:C.charcoal,margin:0}}><strong>{srv.name}</strong></p>
              <p style={{fontFamily:FD,fontSize:17,fontWeight:600,color:C.gold,margin:0}}>{fp(srv.price)}</p>
            </div>
          )}
          <p style={{fontFamily:FB,fontSize:13,fontWeight:600,color:C.charcoal,marginBottom:14}}>¿Con quién quieres tu cita?</p>
          {personal.length===0&&<p style={{fontFamily:FB,fontSize:14,color:C.muted,textAlign:"center",margin:"30px 0"}}>No hay especialistas disponibles aún.</p>}
          {personal.map(p=>{
            const load=staffLoad(p.id);
            const isSel=staffId===p.id;
            return(
              <div key={p.id} onClick={()=>setStaffId(p.id)}
                style={{display:"flex",alignItems:"center",gap:14,padding:"16px",borderRadius:12,marginBottom:10,cursor:"pointer",border:`1.5px solid ${isSel?C.goldLight:C.border}`,background:isSel?C.champagne:C.surface,transition:"all .15s"}}>
                <div style={{width:50,height:50,borderRadius:"50%",background:isSel?`linear-gradient(135deg,${C.goldLight},${C.gold})`:`${C.surfaceAlt}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>
                  {p.emoji}
                </div>
                <div style={{flex:1}}>
                  <p style={{fontFamily:FB,fontSize:15,fontWeight:600,color:C.charcoal,margin:"0 0 2px"}}>{p.name}</p>
                  <p style={{fontFamily:FB,fontSize:12,color:C.muted,margin:0}}>{p.specialty}</p>
                </div>
                {date&&(
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <p style={{fontFamily:FB,fontSize:11,color:load>=ALL_SLOTS.length?C.red:C.green,fontWeight:600,margin:0}}>
                      {ALL_SLOTS.length-load} disponibles
                    </p>
                  </div>
                )}
              </div>
            );
          })}
          <div style={{display:"flex",gap:10,marginTop:4}}>
            <Btn label="← Atrás" onClick={()=>setStep(1)} variant="ghost"/>
            <div style={{flex:1}}><Btn label="Continuar →" onClick={()=>staffId&&setStep(3)} variant="gold" full disabled={!staffId}/></div>
          </div>
        </div>
      )}

      {/* ── PASO 3: Fecha y horario ── */}
      {step===3&&(
        <div>
          {/* Resumen */}
          <div style={{background:C.champagne,borderRadius:10,padding:"12px 14px",marginBottom:20}}>
            <p style={{fontFamily:FB,fontSize:13,color:C.charcoal,margin:"0 0 3px"}}><strong>{srv?.name}</strong></p>
            <p style={{fontFamily:FB,fontSize:12,color:C.muted,margin:0}}>👤 {staff?.name} · {fd(srv?.duration)}</p>
          </div>

          <p style={{fontFamily:FB,fontSize:13,fontWeight:600,color:C.charcoal,marginBottom:12}}>¿Cuándo prefieres la cita?</p>
          <Inp label="Fecha" value={date} onChange={v=>{setDate(v);setTime("");}} type="date"/>

          {date&&(
            <div style={{marginBottom:18}}>
              <label style={{display:"block",fontFamily:FB,fontSize:11,letterSpacing:1.5,textTransform:"uppercase",color:C.muted,marginBottom:8}}>
                Agenda de {staff?.name}
                {available.length===0&&<span style={{color:C.red}}> — Sin disponibilidad</span>}
              </label>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                {ALL_SLOTS.map(t=>{
                  const isToday=date===todayStr();
                  const isPast=isToday&&t<=nowTime();
                  const isBooked=agenda.filter(a=>a.date===date&&a.personalId===staffId&&a.status!=="cancelled").map(a=>a.time).includes(t);
                  const isAvail=!isPast&&!isBooked;
                  const isSel=time===t;
                  return(
                    <div key={t} onClick={()=>isAvail&&setTime(t)}
                      style={{padding:"10px 4px",textAlign:"center",borderRadius:8,
                        border:`1.5px solid ${isSel?C.goldLight:isAvail?C.border:"transparent"}`,
                        background:isSel?C.champagne:isAvail?C.surface:C.surfaceAlt,
                        fontFamily:FB,fontSize:13,
                        color:isSel?C.gold:isAvail?C.charcoal:"#bbb",
                        fontWeight:isSel?700:400,
                        cursor:isAvail?"pointer":"not-allowed"}}>
                      {t}
                      {(isPast||isBooked)&&<span style={{display:"block",fontSize:9,color:"#bbb",marginTop:1}}>{isPast?"pasado":"ocupado"}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{marginBottom:16}}>
            <label style={{display:"block",fontFamily:FB,fontSize:11,letterSpacing:1.5,textTransform:"uppercase",color:C.muted,marginBottom:5}}>Dirección y notas (opcional)</label>
            <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Dirección exacta, alergias, preferencias..." rows={3}
              style={{width:"100%",padding:"10px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontFamily:FB,fontSize:14,color:C.charcoal,background:C.bg,boxSizing:"border-box",outline:"none",resize:"none"}}/>
          </div>
          <div style={{display:"flex",gap:10}}>
            <Btn label="← Atrás" onClick={()=>setStep(2)} variant="ghost"/>
            <div style={{flex:1}}><Btn label={saving?"Guardando...":"Confirmar cita"} onClick={confirm} variant="gold" full disabled={!date||!time||saving}/></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PERFIL ───────────────────────────────────────────────────
function ViewPerfil({currentUser,setCurrentUser,agenda,updateStatus}){
  const myBookings=agenda.filter(a=>a.clientId===currentUser.id).sort((a,b)=>a.date>b.date?-1:1);
  const [cancelling,setCancelling]=useState(null);

  const cancelCita=async(id)=>{
    setCancelling(id);
    await updateStatus(id,"cancelled");
    setCancelling(null);
  };

  return(
    <div style={{padding:"24px 20px 90px"}}>
      <PageHeader eyebrow="Mi cuenta" title={currentUser.name.split(" ")[0]}
        right={<button onClick={()=>setCurrentUser(null)} style={{fontFamily:FB,fontSize:12,color:C.muted,background:"none",border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 12px",cursor:"pointer"}}>Salir</button>}/>
      <div style={{background:C.surface,borderRadius:14,padding:16,marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[["📞 Teléfono",currentUser.phone],["📧 Email",currentUser.email||"—"],["💅 Visitas",currentUser.visits||0],["📅 Último servicio",currentUser.lastService||"—"]].map(([k,v])=>(
            <div key={k} style={{background:C.bg,borderRadius:8,padding:"10px 12px"}}>
              <p style={{fontFamily:FB,fontSize:11,color:C.muted,margin:"0 0 3px"}}>{k}</p>
              <p style={{fontFamily:FB,fontSize:13,fontWeight:600,color:C.charcoal,margin:0}}>{String(v)}</p>
            </div>
          ))}
        </div>
        {currentUser.notes&&<div style={{marginTop:10,background:C.champagne,borderRadius:8,padding:"8px 12px"}}><p style={{fontFamily:FB,fontSize:12,color:C.muted,margin:0}}>📝 {currentUser.notes}</p></div>}
      </div>
      <p style={{fontFamily:FB,fontSize:11,letterSpacing:2,color:C.muted,textTransform:"uppercase",marginBottom:12}}>Mis citas</p>
      {myBookings.length===0&&<p style={{fontFamily:FB,fontSize:14,color:C.muted,textAlign:"center",margin:"20px 0"}}>No tienes citas aún.</p>}
      {myBookings.map(b=>{
        const isPast=b.date<todayStr()||(b.date===todayStr()&&b.time<=nowTime());
        return(
          <div key={b.id} style={{background:C.surface,borderRadius:12,padding:"14px 16px",marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div>
                <p style={{fontFamily:FB,fontSize:14,fontWeight:600,color:C.charcoal,margin:"0 0 2px"}}>{b.serviceName}</p>
                {b.personalName&&<p style={{fontFamily:FB,fontSize:12,color:C.muted,margin:"0 0 2px"}}>👤 {b.personalName}</p>}
                <p style={{fontFamily:FB,fontSize:12,color:C.muted,margin:0}}>📅 {fdate(b.date)} · ⏰ {b.time}</p>
              </div>
              <Tag color={b.status}/>
            </div>
            {/* Botón cancelar — solo citas futuras no canceladas */}
            {!isPast&&b.status!=="cancelled"&&(
              <button
                onClick={()=>cancelCita(b.id)}
                disabled={cancelling===b.id}
                style={{marginTop:8,padding:"7px 16px",borderRadius:10,border:"none",background:C.redPale,fontFamily:FB,fontSize:12,fontWeight:600,color:C.red,cursor:"pointer",opacity:cancelling===b.id?0.6:1}}>
                {cancelling===b.id?"Cancelando...":"✕ Cancelar cita"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── ADMIN AGENDA ─────────────────────────────────────────────
function AdminAgenda({agenda,updateStatus,loading,personal}){
  const [filter,setFilter]=useState("all");
  const [dateFilter,setDateFilter]=useState("");
  const [staffFilter,setStaffFilter]=useState("all");
  if(loading)return<Loading/>;
  let list=[...agenda].sort((a,b)=>a.date>b.date?1:a.date<b.date?-1:a.time>b.time?1:-1);
  if(filter!=="all")list=list.filter(a=>a.status===filter);
  if(dateFilter)list=list.filter(a=>a.date===dateFilter);
  if(staffFilter!=="all")list=list.filter(a=>a.personalId===staffFilter);
  const pending=agenda.filter(a=>a.status==="pending").length;
  return(
    <div style={{padding:"24px 20px 90px"}}>
      <PageHeader eyebrow="Admin" title="Agenda"
        right={pending>0?<div style={{background:C.orangePale,borderRadius:10,padding:"6px 12px"}}><p style={{fontFamily:FB,fontSize:11,color:C.orange,fontWeight:600,margin:0}}>{pending} pendientes</p></div>:null}/>

      {/* Filtro por persona */}
      <div style={{display:"flex",gap:8,marginBottom:10,overflowX:"auto",paddingBottom:4}}>
        <button onClick={()=>setStaffFilter("all")} style={{padding:"6px 14px",borderRadius:20,border:"none",background:staffFilter==="all"?C.charcoal:C.surface,fontFamily:FB,fontSize:11,fontWeight:staffFilter==="all"?600:400,color:staffFilter==="all"?C.white:C.muted,cursor:"pointer",whiteSpace:"nowrap"}}>Todas</button>
        {personal.map(p=>(
          <button key={p.id} onClick={()=>setStaffFilter(p.id)} style={{padding:"6px 14px",borderRadius:20,border:"none",background:staffFilter===p.id?C.charcoal:C.surface,fontFamily:FB,fontSize:11,fontWeight:staffFilter===p.id?600:400,color:staffFilter===p.id?C.white:C.muted,cursor:"pointer",whiteSpace:"nowrap"}}>{p.name.split(" ")[0]}</button>
        ))}
      </div>

      {/* Filtro por estado */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        {[["all","Todos"],["pending","Pendientes"],["confirmed","Confirmados"],["cancelled","Cancelados"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{padding:"6px 12px",borderRadius:20,border:`1px solid ${C.border}`,background:filter===v?C.gold:"none",fontFamily:FB,fontSize:11,fontWeight:filter===v?600:400,color:filter===v?C.charcoal:C.muted,cursor:"pointer"}}>{l}</button>
        ))}
      </div>

      {/* Filtro por fecha */}
      <div style={{marginBottom:16}}>
        <input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}
          style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontFamily:FB,fontSize:13,color:C.charcoal,background:C.bg,boxSizing:"border-box",outline:"none"}}/>
        {dateFilter&&<button onClick={()=>setDateFilter("")} style={{marginTop:6,fontFamily:FB,fontSize:12,color:C.muted,background:"none",border:"none",cursor:"pointer"}}>✕ Limpiar filtro de fecha</button>}
      </div>

      {list.length===0&&<p style={{fontFamily:FB,fontSize:14,color:C.muted,textAlign:"center",margin:"30px 0"}}>No hay citas en esta categoría.</p>}
      {list.map(a=>{
        const isPast=a.date<todayStr()||(a.date===todayStr()&&a.time<=nowTime());
        const phone=a.clientPhone?.replace(/\D/g,"");
        const fullPhone=phone?.startsWith("57")?phone:`57${phone}`;
        const waMsg=encodeURIComponent(`Hola ${a.clientName} 👋, te recordamos tu cita en *Esencial Studio*:\n\n💅 *${a.serviceName}*\n📅 ${fdate(a.date)}\n⏰ ${a.time}\n\n¡Te esperamos! Si necesitas cancelar escríbenos.`);
        const waLink=`https://wa.me/${fullPhone}?text=${waMsg}`;
        return(
          <div key={a.id} style={{background:C.surface,borderRadius:12,padding:"14px 16px",marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div>
                <p style={{fontFamily:FB,fontSize:14,fontWeight:600,color:C.charcoal,margin:"0 0 2px"}}>{a.clientName}</p>
                <p style={{fontFamily:FB,fontSize:12,color:C.muted,margin:"0 0 1px"}}>{a.serviceName}</p>
                <p style={{fontFamily:FB,fontSize:12,color:C.gold,margin:0}}>👤 {a.personalName||"Sin asignar"}</p>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                <Tag color={a.status}/>
                {isPast&&<span style={{fontFamily:FB,fontSize:10,color:C.muted,background:C.surfaceAlt,padding:"2px 8px",borderRadius:10}}>Pasado</span>}
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
              {[["📅",fdate(a.date)],["⏰",a.time],["⏱",fd(a.duration)]].map(([icon,val])=>(
                <span key={icon} style={{background:C.bg,borderRadius:8,padding:"5px 10px",fontFamily:FB,fontSize:12,color:C.charcoal}}>{icon} {val}</span>
              ))}
            </div>
            {a.note&&<p style={{fontFamily:FB,fontSize:12,color:C.muted,margin:"0 0 10px",padding:"6px 10px",background:C.champagne,borderRadius:8}}>📝 {a.note}</p>}
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {/* WhatsApp recordatorio */}
              {a.clientPhone&&a.status!=="cancelled"&&(
                <a href={waLink} target="_blank" rel="noopener noreferrer"
                  style={{padding:"7px 14px",borderRadius:10,background:"#25D366",color:"#fff",fontFamily:FB,fontSize:12,fontWeight:600,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:5}}>
                  📲 Recordatorio
                </a>
              )}
              {/* Futuras pendientes: confirmar y cancelar */}
              {!isPast&&a.status==="pending"&&<><Btn label="✓ Confirmar" onClick={()=>updateStatus(a.id,"confirmed")} variant="gold" small/><Btn label="✕ Cancelar" onClick={()=>updateStatus(a.id,"cancelled")} variant="red" small/></>}
              {/* Futuras confirmadas: solo cancelar */}
              {!isPast&&a.status==="confirmed"&&<Btn label="✕ Cancelar" onClick={()=>updateStatus(a.id,"cancelled")} variant="red" small/>}
              {/* Pasadas pendientes: solo cancelar para limpiar */}
              {isPast&&a.status==="pending"&&<Btn label="✕ Cancelar" onClick={()=>updateStatus(a.id,"cancelled")} variant="red" small/>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── ADMIN CLIENTES ───────────────────────────────────────────
function AdminClientes({clients,loading,agenda}){
  const [search,setSearch]=useState("");
  const [sel,setSel]=useState(null);
  if(loading)return<Loading/>;
  const filtered=clients.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())||c.phone.includes(search));
  return(
    <div style={{padding:"24px 20px 90px"}}>
      <PageHeader eyebrow="Admin" title="Clientes"
        right={<div style={{background:C.champagne,borderRadius:10,padding:"6px 12px"}}><p style={{fontFamily:FB,fontSize:11,color:C.gold,fontWeight:600,margin:0}}>{clients.length} registradas</p></div>}/>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nombre o teléfono..."
        style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1.5px solid ${C.border}`,fontFamily:FB,fontSize:14,color:C.charcoal,background:C.surface,boxSizing:"border-box",outline:"none",marginBottom:16}}/>
      {filtered.map(c=>{
        const myB=agenda.filter(b=>b.clientId===c.id);
        const isOpen=sel===c.id;
        return(
          <div key={c.id} onClick={()=>setSel(isOpen?null:c.id)} style={{background:C.surface,borderRadius:12,padding:"14px 16px",marginBottom:8,cursor:"pointer",border:`1.5px solid ${isOpen?C.goldLight:"transparent"}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <p style={{fontFamily:FB,fontSize:14,fontWeight:600,color:C.charcoal,margin:"0 0 3px"}}>{c.name}</p>
                <p style={{fontFamily:FB,fontSize:12,color:C.muted,margin:0}}>📞 {c.phone}{c.email?` · ${c.email}`:""}</p>
              </div>
              <div style={{background:C.champagne,borderRadius:20,padding:"4px 10px"}}><p style={{fontFamily:FB,fontSize:11,fontWeight:600,color:C.gold,margin:0}}>{c.visits||0} visitas</p></div>
            </div>
            {isOpen&&(
              <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                  {[["Último servicio",c.lastService||"—"],["Última visita",fdate(c.lastDate)]].map(([k,v])=>(
                    <div key={k} style={{background:C.bg,borderRadius:8,padding:"8px 10px"}}><p style={{fontFamily:FB,fontSize:11,color:C.muted,margin:"0 0 2px"}}>{k}</p><p style={{fontFamily:FB,fontSize:12,fontWeight:600,color:C.charcoal,margin:0}}>{v}</p></div>
                  ))}
                </div>
                {c.notes&&<div style={{background:C.champagne,borderRadius:8,padding:"8px 12px",marginBottom:10}}><p style={{fontFamily:FB,fontSize:12,color:C.muted,margin:0}}>📝 {c.notes}</p></div>}
                <p style={{fontFamily:FB,fontSize:11,color:C.muted,marginBottom:6}}>Citas ({myB.length})</p>
                {myB.slice(0,3).map(b=>(
                  <div key={b.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>
                    <p style={{fontFamily:FB,fontSize:12,color:C.charcoal,margin:0}}>{b.serviceName} · {b.personalName}</p>
                    <span style={{fontFamily:FB,fontSize:12,color:C.muted}}>{fdate(b.date)} <Tag color={b.status}/></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {filtered.length===0&&<p style={{fontFamily:FB,fontSize:14,color:C.muted,textAlign:"center",margin:"30px 0"}}>No se encontraron clientes.</p>}
    </div>
  );
}

// ── ADMIN SERVICIOS ──────────────────────────────────────────
function ServiceForm({catId,catName,catEmoji,item,onSave,onCancel}){
  const [form,setForm]=useState({name:item.name||"",duration:item.duration||60,price:item.price||0,desc:item.desc||"",id:item.id});
  const [saving,setSaving]=useState(false);
  const save=async()=>{setSaving(true);await onSave(catId,catName,catEmoji,form);setSaving(false);};
  return(
    <div style={{padding:"24px 20px 90px"}}>
      <PageHeader eyebrow="Admin · Servicios" title={item.id?"Editar servicio":"Nuevo servicio"}/>
      <div style={{background:C.surface,borderRadius:14,padding:20}}>
        <Inp label="Nombre" value={form.name} onChange={v=>setForm(s=>({...s,name:v}))} required/>
        <Inp label="Duración (minutos)" value={form.duration} onChange={v=>setForm(s=>({...s,duration:v}))} type="number"/>
        <Inp label="Precio (COP)" value={form.price} onChange={v=>setForm(s=>({...s,price:v}))} type="number"/>
        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontFamily:FB,fontSize:11,letterSpacing:1.5,textTransform:"uppercase",color:C.muted,marginBottom:5}}>Descripción</label>
          <textarea value={form.desc} onChange={e=>setForm(s=>({...s,desc:e.target.value}))} rows={2}
            style={{width:"100%",padding:"10px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontFamily:FB,fontSize:14,color:C.charcoal,background:C.bg,boxSizing:"border-box",outline:"none",resize:"none"}}/>
        </div>
        <div style={{display:"flex",gap:10}}>
          <Btn label="Cancelar" onClick={onCancel} variant="ghost"/>
          <div style={{flex:1}}><Btn label={saving?"Guardando...":"Guardar"} onClick={save} variant="gold" full disabled={!form.name||saving}/></div>
        </div>
      </div>
    </div>
  );
}

function AdminServicios({services,loading,addService,updateService,deleteService,addCategory}){
  const [editing,setEditing]=useState(null);
  const [newCatName,setNewCatName]=useState("");
  if(loading&&services.length===0)return<Loading/>;

  if(editing){
    return(
      <ServiceForm
        catId={editing.catId} catName={editing.catName} catEmoji={editing.catEmoji} item={editing.item}
        onSave={async(catId,catName,catEmoji,form)=>{
          if(form.id)await updateService(form.id,form);
          else await addService(catName,catEmoji,form);
          setEditing(null);
        }}
        onCancel={()=>setEditing(null)}
      />
    );
  }
  return(
    <div style={{padding:"24px 20px 90px"}}>
      <PageHeader eyebrow="Admin" title="Servicios"/>
      {services.map(cat=>(
        <div key={cat.id} style={{marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <p style={{fontFamily:FB,fontSize:11,letterSpacing:2,color:C.muted,textTransform:"uppercase",margin:0}}>{cat.emoji} {cat.category}</p>
            <Btn label="+ Agregar" onClick={()=>setEditing({catId:cat.id,catName:cat.category,catEmoji:cat.emoji,item:{name:"",duration:60,price:0,desc:""}})} variant="gold" small/>
          </div>
          {cat.items.map(srv=>(
            <div key={srv.id} style={{background:C.surface,borderRadius:10,padding:"10px 14px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <p style={{fontFamily:FB,fontSize:13,fontWeight:600,color:C.charcoal,margin:"0 0 2px"}}>{srv.name}</p>
                <p style={{fontFamily:FB,fontSize:11,color:C.muted,margin:0}}>{fd(srv.duration)} · {fp(srv.price)}</p>
              </div>
              <div style={{display:"flex",gap:6}}>
                <Btn label="✏️" onClick={()=>setEditing({catId:cat.id,catName:cat.category,catEmoji:cat.emoji,item:srv})} variant="ghost" small/>
                <Btn label="🗑" onClick={()=>deleteService(srv.id)} variant="red" small/>
              </div>
            </div>
          ))}
        </div>
      ))}
      <div style={{display:"flex",gap:8,marginTop:10}}>
        <input value={newCatName} onChange={e=>setNewCatName(e.target.value)} placeholder="Nueva categoría..."
          style={{flex:1,padding:"10px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontFamily:FB,fontSize:14,color:C.charcoal,background:C.bg,outline:"none"}}/>
        <Btn label="+ Crear" onClick={()=>{if(newCatName.trim()){addCategory(newCatName.trim(),"✨");setNewCatName("");}}} variant="gold"/>
      </div>
    </div>
  );
}

// ── ADMIN PERSONAL ───────────────────────────────────────────
function PersonalForm({item, onSave, onCancel}){
  const EMOJIS=["💅","✂️","💇","💆","💄","✨","🌟","👑"];
  const [form,setForm]=useState({name:item.name||"",specialty:item.specialty||"",emoji:item.emoji||"💅",id:item.id});
  const [saving,setSaving]=useState(false);
  const save=async()=>{
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };
  return(
    <div style={{padding:"24px 20px 90px"}}>
      <PageHeader eyebrow="Admin · Personal" title={item.id?"Editar especialista":"Agregar especialista"}/>
      <div style={{background:C.surface,borderRadius:14,padding:20}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{width:70,height:70,borderRadius:"50%",background:`linear-gradient(135deg,${C.goldLight},${C.gold})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,margin:"0 auto 12px"}}>{form.emoji}</div>
          <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
            {EMOJIS.map(e=><button key={e} onClick={()=>setForm(s=>({...s,emoji:e}))} style={{width:36,height:36,borderRadius:"50%",border:`2px solid ${form.emoji===e?C.gold:C.border}`,background:form.emoji===e?C.champagne:C.bg,fontSize:18,cursor:"pointer"}}>{e}</button>)}
          </div>
        </div>
        <Inp label="Nombre completo" value={form.name} onChange={v=>setForm(s=>({...s,name:v}))} required/>
        <Inp label="Especialidad" value={form.specialty} onChange={v=>setForm(s=>({...s,specialty:v}))} placeholder="Ej: Uñas & Nail Art"/>
        <div style={{display:"flex",gap:10}}>
          <Btn label="Cancelar" onClick={onCancel} variant="ghost"/>
          <div style={{flex:1}}><Btn label={saving?"Guardando...":"Guardar"} onClick={save} variant="gold" full disabled={!form.name||saving}/></div>
        </div>
      </div>
    </div>
  );
}

function AdminPersonal({personal,addPersonal,updatePersonal,deletePersonal}){
  const [editing,setEditing]=useState(null);

  if(editing){
    return(
      <PersonalForm
        item={editing}
        onSave={async(form)=>{
          if(form.id)await updatePersonal(form.id,form);
          else await addPersonal(form);
          setEditing(null);
        }}
        onCancel={()=>setEditing(null)}
      />
    );
  }

  return(
    <div style={{padding:"24px 20px 90px"}}>
      <PageHeader eyebrow="Admin" title="Personal"
        right={<Btn label="+ Agregar" onClick={()=>setEditing({name:"",specialty:"",emoji:"💅"})} variant="gold" small/>}/>
      {personal.length===0&&<p style={{fontFamily:FB,fontSize:14,color:C.muted,textAlign:"center",margin:"30px 0"}}>No hay personal registrado aún.</p>}
      {personal.map(p=>(
        <div key={p.id} style={{background:C.surface,borderRadius:12,padding:"16px",marginBottom:10,display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:50,height:50,borderRadius:"50%",background:`linear-gradient(135deg,${C.goldLight},${C.gold})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>{p.emoji}</div>
          <div style={{flex:1}}>
            <p style={{fontFamily:FB,fontSize:15,fontWeight:600,color:C.charcoal,margin:"0 0 2px"}}>{p.name}</p>
            <p style={{fontFamily:FB,fontSize:12,color:C.muted,margin:0}}>{p.specialty}</p>
          </div>
          <div style={{display:"flex",gap:6}}>
            <Btn label="✏️" onClick={()=>setEditing(p)} variant="ghost" small/>
            <Btn label="🗑" onClick={()=>deletePersonal(p.id)} variant="red" small/>
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminConfig({setIsAdmin,onPinChange}){
  const [newPin,setNewPin]=useState("");
  const [confirmPin,setConfirmPin]=useState("");
  const [pinMsg,setPinMsg]=useState("");
  const [pinOk,setPinOk]=useState(false);

  const savePin=()=>{
    if(newPin.length<4){setPinMsg("El PIN debe tener al menos 4 caracteres.");setPinOk(false);return;}
    if(newPin!==confirmPin){setPinMsg("Los PINs no coinciden.");setPinOk(false);return;}
    onPinChange(newPin);
    setNewPin("");setConfirmPin("");
    setPinMsg("✓ PIN actualizado correctamente.");setPinOk(true);
    setTimeout(()=>setPinMsg(""),3000);
  };

  return(
    <div style={{padding:"24px 20px 90px"}}>
      <PageHeader eyebrow="Admin" title="Configuración"/>

      {/* Cambiar PIN */}
      <div style={{background:C.surface,borderRadius:14,padding:20,marginBottom:16}}>
        <p style={{fontFamily:FD,fontSize:18,color:C.charcoal,margin:"0 0 16px"}}>Cambiar PIN de acceso</p>
        <div style={{marginBottom:13}}>
          <label style={{display:"block",fontFamily:FB,fontSize:11,letterSpacing:1.5,textTransform:"uppercase",color:C.muted,marginBottom:5}}>Nuevo PIN</label>
          <input type="password" value={newPin} onChange={e=>setNewPin(e.target.value)} placeholder="Mínimo 4 caracteres" maxLength={12}
            style={{width:"100%",padding:"10px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontFamily:FB,fontSize:14,color:C.charcoal,background:C.bg,boxSizing:"border-box",outline:"none"}}/>
        </div>
        <div style={{marginBottom:16}}>
          <label style={{display:"block",fontFamily:FB,fontSize:11,letterSpacing:1.5,textTransform:"uppercase",color:C.muted,marginBottom:5}}>Confirmar PIN</label>
          <input type="password" value={confirmPin} onChange={e=>setConfirmPin(e.target.value)} placeholder="Repite el PIN" maxLength={12}
            style={{width:"100%",padding:"10px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontFamily:FB,fontSize:14,color:C.charcoal,background:C.bg,boxSizing:"border-box",outline:"none"}}/>
        </div>
        {pinMsg&&<p style={{fontFamily:FB,fontSize:13,color:pinOk?C.green:C.red,margin:"-8px 0 12px"}}>{pinMsg}</p>}
        <Btn label="Guardar PIN" onClick={savePin} variant="gold" full disabled={!newPin||!confirmPin}/>
      </div>

      {/* Salir */}
      <div style={{background:C.redPale,borderRadius:12,padding:16}}>
        <p style={{fontFamily:FB,fontSize:13,color:C.red,margin:"0 0 10px"}}>Salir del panel de administración</p>
        <Btn label="Volver a la app" onClick={()=>setIsAdmin(false)} variant="ghost"/>
      </div>
    </div>
  );
}

// ── ROOT ─────────────────────────────────────────────────────
export default function App(){
  const{services,loading:srvLoading,addService,updateService,deleteService,addCategory}=useServices();
  const{clients,registerClient,loginClient,updateClientAfterBooking}=useClients();
  const{agenda,loading:agLoading,bookAppointment,updateStatus}=useAgenda();
  const{personal,addPersonal,updatePersonal,deletePersonal}=usePersonal();

  const[currentUser,setCurrentUser]=useState(()=>{
    try{const s=sessionStorage.getItem("es_user");return s?JSON.parse(s):null;}catch{return null;}
  });
  const[isAdmin,setIsAdmin]=useState(false);
  const[tab,setTab]=useState("inicio");
  const[preselect,setPreselect]=useState("");
  const[pinInput,setPinInput]=useState("");
  const[showPin,setShowPin]=useState(false);
  const[adminPin,setAdminPin]=useState(()=>{
    try{return localStorage.getItem("es_admin_pin")||"1234";}catch{return"1234";}
  });
  // Secret tap counter to open admin (tap logo 5 times)
  const[tapCount,setTapCount]=useState(0);
  const[tapTimer,setTapTimer]=useState(null);

  const handleSecretTap=()=>{
    const next=tapCount+1;
    setTapCount(next);
    if(tapTimer)clearTimeout(tapTimer);
    const t=setTimeout(()=>setTapCount(0),2000);
    setTapTimer(t);
    if(next>=5){setShowPin(true);setTapCount(0);}
  };

  useEffect(()=>{
    try{if(currentUser)sessionStorage.setItem("es_user",JSON.stringify(currentUser));else sessionStorage.removeItem("es_user");}catch{}
  },[currentUser]);

  const handlePinChange=(newPin)=>{
    setAdminPin(newPin);
    try{localStorage.setItem("es_admin_pin",newPin);}catch{}
  };

  const switchToAdmin=()=>{
    if(pinInput===adminPin){setIsAdmin(true);setTab("admin-agenda");setShowPin(false);setPinInput("");}
    else{setPinInput("");}
  };

function PinModal({pinInput,setPinInput,onConfirm,onCancel}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(30,24,16,0.65)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:C.surface,borderRadius:16,padding:28,width:"100%",maxWidth:320,textAlign:"center"}}>
        <h3 style={{fontFamily:FD,fontSize:22,color:C.charcoal,margin:"0 0 6px"}}>Panel Admin</h3>
        <p style={{fontFamily:FB,fontSize:13,color:C.muted,margin:"0 0 18px"}}>Ingresa tu PIN</p>
        <input
          type="password"
          value={pinInput}
          onChange={e=>setPinInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&onConfirm()}
          placeholder="PIN"
          maxLength={6}
          autoFocus
          style={{width:"100%",padding:"12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontFamily:FB,fontSize:20,textAlign:"center",letterSpacing:8,color:C.charcoal,background:C.bg,boxSizing:"border-box",outline:"none",marginBottom:14}}
        />
        <div style={{display:"flex",gap:10}}>
          <Btn label="Cancelar" onClick={onCancel} variant="ghost" full/>
          <Btn label="Ingresar" onClick={onConfirm} variant="gold" full/>
        </div>
      </div>
    </div>
  );
}

  if(!currentUser&&!isAdmin){
    return(
      <div style={{fontFamily:FB,maxWidth:430,margin:"0 auto",position:"relative",boxShadow:"0 0 50px rgba(0,0,0,0.1)"}}>
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"/>
        {showPin&&<PinModal pinInput={pinInput} setPinInput={setPinInput} onConfirm={switchToAdmin} onCancel={()=>{setShowPin(false);setPinInput("");}}/>} setCurrentUser={u=>{setCurrentUser(u);setTab("inicio");}} registerClient={registerClient} loginClient={loginClient} onSecretTap={handleSecretTap}/>
      </div>
    );
  }

  return(
    <div style={{fontFamily:FB,background:C.bg,minHeight:"100vh",maxWidth:430,margin:"0 auto",position:"relative",boxShadow:"0 0 50px rgba(0,0,0,0.1)"}}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"/>
      {!isAdmin&&<div style={{position:"fixed",top:0,right:0,width:60,height:60,zIndex:200,cursor:"default"}} onClick={handleSecretTap}/>}
      {showPin&&<PinModal pinInput={pinInput} setPinInput={setPinInput} onConfirm={switchToAdmin} onCancel={()=>{setShowPin(false);setPinInput("");}}/>}

      {!isAdmin&&(
        <>
          {tab==="inicio"&&<ViewInicio currentUser={currentUser} agenda={agenda} services={services} setTab={setTab} setCurrentUser={setCurrentUser}/>}
          {tab==="servicios"&&<ViewServicios services={services} loading={srvLoading} setTab={setTab} setPreselect={setPreselect}/>}
          {tab==="reservar"&&<ViewReservar services={services} agenda={agenda} personal={personal} bookAppointment={bookAppointment} currentUser={currentUser} setTab={setTab} preselect={preselect} setPreselect={setPreselect} updateClientAfterBooking={updateClientAfterBooking}/>}
          {tab==="perfil"&&<ViewPerfil currentUser={currentUser} setCurrentUser={setCurrentUser} agenda={agenda} updateStatus={updateStatus}/>}
        </>
      )}
      {isAdmin&&(
        <>
          {tab==="admin-agenda"&&<AdminAgenda agenda={agenda} updateStatus={updateStatus} loading={agLoading} personal={personal}/>}
          {tab==="admin-clientes"&&<AdminClientes clients={clients} loading={false} agenda={agenda}/>}
          {tab==="admin-servicios"&&<AdminServicios services={services} loading={srvLoading} addService={addService} updateService={updateService} deleteService={deleteService} addCategory={addCategory}/>}
          {tab==="admin-personal"&&<AdminPersonal personal={personal} addPersonal={addPersonal} updatePersonal={updatePersonal} deletePersonal={deletePersonal}/>}
          {tab==="admin-config"&&<AdminConfig setIsAdmin={v=>{setIsAdmin(v);setTab("inicio");}} onPinChange={handlePinChange}/>}
        </>
      )}
      <BottomNav tab={tab} setTab={setTab} isAdmin={isAdmin}/>
    </div>
  );
}
