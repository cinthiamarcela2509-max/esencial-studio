import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

// ─── DESIGN TOKENS ─────────────────────────────────────────────
const C = {
  bg: "#F6F0E8", surface: "#FFFDF9", surfaceAlt: "#EFE8DC",
  charcoal: "#1E1810", muted: "#7A6A55",
  gold: "#B07D2A", goldLight: "#D4A843", champagne: "#F0E2C8",
  border: "#DDD0BC", green: "#5C8A6A", greenPale: "#E4F0E8",
  red: "#B05050", redPale: "#F5E4E4", orange: "#C47830", orangePale: "#FAF0E0",
  white: "#FFFDF9",
};
const FONT_DISPLAY = "'Cormorant Garamond', serif";
const FONT_BODY = "Inter, sans-serif";

// ─── HELPERS ───────────────────────────────────────────────────
function fp(n) { return `$${Number(n || 0).toLocaleString("es-CO")} COP`; }
function fd(m) { m = Number(m); return m >= 60 ? `${Math.floor(m/60)}h${m%60>0?` ${m%60}m`:""}` : `${m}m`; }
function today() { return new Date().toISOString().split("T")[0]; }
function fdate(d) { if (!d) return "—"; const [y,m,day] = d.split("-"); return `${day}/${m}/${y}`; }

// ─── SUPABASE DATA HOOKS ────────────────────────────────────────

function useServices() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from("servicios").select("*").eq("activo", true).order("orden");
    if (data) {
      // Group by category
      const grouped = {};
      data.forEach(s => {
        if (!grouped[s.categoria]) grouped[s.categoria] = { id: s.categoria, category: s.categoria, emoji: s.emoji, items: [] };
        grouped[s.categoria].items.push({ id: s.id, name: s.nombre, duration: s.duracion, price: s.precio, desc: s.descripcion });
      });
      setServices(Object.values(grouped));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addService = async (catName, emoji, item) => {
    await supabase.from("servicios").insert({ categoria: catName, emoji, nombre: item.name, duracion: item.duration, precio: item.price, descripcion: item.desc, orden: 99 });
    load();
  };

  const updateService = async (id, item) => {
    await supabase.from("servicios").update({ nombre: item.name, duracion: item.duration, precio: item.price, descripcion: item.desc }).eq("id", id);
    load();
  };

  const deleteService = async (id) => {
    await supabase.from("servicios").update({ activo: false }).eq("id", id);
    load();
  };

  const addCategory = async (name, emoji) => {
    // Category is implicit through services; just return an empty one
    setServices(prev => [...prev, { id: name, category: name, emoji, items: [] }]);
  };

  return { services, loading, addService, updateService, deleteService, addCategory, reload: load };
}

function useClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from("clientes").select("*").order("creado_en", { ascending: false });
    if (data) setClients(data.map(c => ({ id: c.id, name: c.nombre, phone: c.telefono, email: c.email, notes: c.notas, visits: c.visitas, lastService: c.ultimo_servicio, lastDate: c.ultima_visita })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const registerClient = async (form) => {
    // Check if phone exists
    const { data: existing } = await supabase.from("clientes").select("*").eq("telefono", form.phone).single();
    if (existing) {
      return { id: existing.id, name: existing.nombre, phone: existing.telefono, email: existing.email, notes: existing.notas, visits: existing.visitas, lastService: existing.ultimo_servicio, lastDate: existing.ultima_visita };
    }
    const { data } = await supabase.from("clientes").insert({ nombre: form.name, telefono: form.phone, email: form.email, notas: form.notes }).select().single();
    load();
    if (data) return { id: data.id, name: data.nombre, phone: data.telefono, email: data.email, notes: data.notas, visits: 0 };
    return null;
  };

  const loginClient = async (phone) => {
    const { data } = await supabase.from("clientes").select("*").eq("telefono", phone).single();
    if (data) return { id: data.id, name: data.nombre, phone: data.telefono, email: data.email, notes: data.notas, visits: data.visitas, lastService: data.ultimo_servicio, lastDate: data.ultima_visita };
    return null;
  };

  const updateClientAfterBooking = async (clientId, serviceName, date) => {
    await supabase.from("clientes").update({ visitas: (await supabase.from("citas").select("id", { count: "exact" }).eq("cliente_id", clientId)).count, ultimo_servicio: serviceName, ultima_visita: date }).eq("id", clientId);
    load();
  };

  return { clients, loading, registerClient, loginClient, updateClientAfterBooking, reload: load };
}

function useAgenda() {
  const [agenda, setAgenda] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from("citas").select("*").order("fecha").order("hora");
    if (data) setAgenda(data.map(a => ({ id: a.id, clientId: a.cliente_id, clientName: a.cliente_nombre, serviceId: a.servicio_id, serviceName: a.servicio_nombre, duration: a.duracion, date: a.fecha, time: a.hora?.slice(0,5), note: a.nota, status: a.estado })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll every 30 seconds for real-time updates
  useEffect(() => {
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const bookAppointment = async (booking) => {
    const { data } = await supabase.from("citas").insert({
      cliente_id: booking.clientId, cliente_nombre: booking.clientName,
      servicio_id: booking.serviceId, servicio_nombre: booking.serviceName,
      duracion: booking.duration, fecha: booking.date, hora: booking.time,
      nota: booking.note, estado: "pending"
    }).select().single();
    load();
    return data;
  };

  const updateStatus = async (id, estado) => {
    await supabase.from("citas").update({ estado }).eq("id", id);
    load();
  };

  const deleteAppointment = async (id) => {
    await supabase.from("citas").delete().eq("id", id);
    load();
  };

  return { agenda, loading, bookAppointment, updateStatus, deleteAppointment, reload: load };
}

// ─── REUSABLE UI ───────────────────────────────────────────────
function Inp({ label, value, onChange, type="text", placeholder, required }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <label style={{ display:"block", fontFamily:FONT_BODY, fontSize:11, letterSpacing:1.5, textTransform:"uppercase", color:C.muted, marginBottom:5 }}>
        {label}{required && <span style={{ color:C.gold }}> *</span>}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder||""}
        style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:`1.5px solid ${C.border}`, fontFamily:FONT_BODY, fontSize:14, color:C.charcoal, background:C.bg, boxSizing:"border-box", outline:"none" }} />
    </div>
  );
}

function Btn({ label, onClick, variant="gold", full, small, disabled }) {
  const styles = {
    gold: { background:`linear-gradient(135deg,${C.goldLight} 0%,${C.gold} 100%)`, color:C.charcoal, border:"none" },
    dark: { background:C.charcoal, color:C.white, border:"none" },
    ghost: { background:"none", color:C.muted, border:`1.5px solid ${C.border}` },
    red: { background:C.redPale, color:C.red, border:"none" },
  };
  return (
    <button onClick={disabled ? undefined : onClick} style={{ ...styles[variant], width:full?"100%":"auto", padding:small?"7px 14px":"12px 20px", borderRadius:10, fontFamily:FONT_BODY, fontSize:small?12:14, fontWeight:600, cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.4:1 }}>
      {label}
    </button>
  );
}

function Tag({ color }) {
  const map = { confirmed:[C.green,C.greenPale,"Confirmado"], pending:[C.orange,C.orangePale,"Pendiente"], cancelled:[C.red,C.redPale,"Cancelado"] };
  const [fg,bg,text] = map[color]||[C.muted,C.surfaceAlt,color];
  return <span style={{ display:"inline-block", padding:"3px 10px", borderRadius:20, fontFamily:FONT_BODY, fontSize:11, fontWeight:600, color:fg, background:bg }}>{text}</span>;
}

function PageHeader({ eyebrow, title, right }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:20 }}>
      <div>
        <p style={{ fontFamily:FONT_BODY, fontSize:10, letterSpacing:2.5, color:C.goldLight, textTransform:"uppercase", margin:"0 0 3px" }}>{eyebrow}</p>
        <h2 style={{ fontFamily:FONT_DISPLAY, fontSize:28, fontWeight:600, color:C.charcoal, margin:0, lineHeight:1 }}>{title}</h2>
      </div>
      {right}
    </div>
  );
}

function Loading() {
  return <div style={{ padding:"60px 20px", textAlign:"center" }}><p style={{ fontFamily:FONT_DISPLAY, fontSize:22, color:C.muted }}>Cargando...</p></div>;
}

function BottomNav({ tab, setTab, isAdmin }) {
  const tabs = isAdmin
    ? [{ id:"admin-servicios", label:"Servicios", icon:"✦" },{ id:"admin-agenda", label:"Agenda", icon:"◷" },{ id:"admin-clientes", label:"Clientes", icon:"◉" },{ id:"admin-config", label:"Config", icon:"⚙" }]
    : [{ id:"inicio", label:"Inicio", icon:"◈" },{ id:"servicios", label:"Servicios", icon:"✦" },{ id:"reservar", label:"Reservar", icon:"＋" },{ id:"perfil", label:"Mi perfil", icon:"◉" }];
  return (
    <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:430, background:C.surface, borderTop:`1px solid ${C.border}`, display:"flex", zIndex:100 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)} style={{ flex:1, padding:"13px 0 17px", background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
          <span style={{ fontSize:tab===t.id?18:15, color:tab===t.id?C.goldLight:C.muted }}>{t.icon}</span>
          <p style={{ fontFamily:FONT_BODY, fontSize:10, fontWeight:tab===t.id?600:400, color:tab===t.id?C.goldLight:C.muted, margin:0 }}>{t.label}</p>
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CLIENT VIEWS
// ═══════════════════════════════════════════════════════════════

function ViewInicio({ currentUser, agenda, services, setTab }) {
  const myBookings = agenda.filter(a => a.clientId === currentUser?.id && a.date >= today()).sort((a,b) => a.date>b.date?1:-1);
  const allSrvs = services.flatMap(c => c.items);
  return (
    <div style={{ paddingBottom:90 }}>
      <div style={{ background:C.charcoal, padding:"52px 24px 32px", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-60, right:-60, width:220, height:220, borderRadius:"50%", background:C.gold, opacity:0.08 }} />
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
          <div style={{ width:38, height:38, borderRadius:"50%", background:`radial-gradient(circle,${C.goldLight} 0%,${C.gold} 100%)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🦢</div>
          <div>
            <p style={{ fontFamily:FONT_DISPLAY, fontSize:17, fontWeight:700, color:C.goldLight, margin:0, letterSpacing:3, textTransform:"uppercase" }}>Esencial</p>
            <p style={{ fontFamily:FONT_BODY, fontSize:8, letterSpacing:4, color:"rgba(212,168,67,0.6)", margin:0, textTransform:"uppercase" }}>Studio</p>
          </div>
        </div>
        <p style={{ fontFamily:FONT_BODY, fontSize:13, color:"rgba(245,239,230,0.5)", margin:"0 0 4px" }}>{currentUser?`Hola, ${currentUser.name.split(" ")[0]} 👋`:"Bienvenida"}</p>
        <h1 style={{ fontFamily:FONT_DISPLAY, fontSize:34, fontWeight:600, color:"#F6F0E8", margin:"0 0 6px", lineHeight:1.15 }}>Belleza que llega<br/>hasta ti</h1>
        <p style={{ fontFamily:FONT_BODY, fontSize:13, color:"rgba(245,239,230,0.45)", margin:"0 0 20px" }}>A domicilio · Cúcuta, Colombia</p>
        <Btn label="Reservar turno" onClick={() => setTab("reservar")} variant="gold" />
      </div>
      <div style={{ padding:"22px 20px 0" }}>
        {currentUser && myBookings.length > 0 && (
          <div style={{ marginBottom:24 }}>
            <p style={{ fontFamily:FONT_BODY, fontSize:11, letterSpacing:2, color:C.muted, textTransform:"uppercase", marginBottom:12 }}>Mis próximas citas</p>
            {myBookings.slice(0,2).map(b => (
              <div key={b.id} style={{ background:C.surface, borderRadius:12, padding:"14px 16px", marginBottom:10, borderLeft:`3px solid ${C.goldLight}` }}>
                <p style={{ fontFamily:FONT_BODY, fontSize:14, fontWeight:600, color:C.charcoal, margin:"0 0 4px" }}>{b.serviceName}</p>
                <p style={{ fontFamily:FONT_BODY, fontSize:12, color:C.muted, margin:0 }}>📅 {fdate(b.date)} · ⏰ {b.time} <Tag color={b.status} /></p>
              </div>
            ))}
          </div>
        )}
        <p style={{ fontFamily:FONT_BODY, fontSize:11, letterSpacing:2, color:C.muted, textTransform:"uppercase", marginBottom:12 }}>Servicios destacados</p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:24 }}>
          {allSrvs.slice(0,4).map(s => (
            <div key={s.id} onClick={() => setTab("servicios")} style={{ background:C.surface, borderRadius:12, padding:"14px 12px", cursor:"pointer" }}>
              <p style={{ fontFamily:FONT_BODY, fontSize:13, fontWeight:600, color:C.charcoal, margin:"0 0 4px" }}>{s.name}</p>
              <p style={{ fontFamily:FONT_DISPLAY, fontSize:17, fontWeight:600, color:C.gold, margin:"0 0 2px" }}>{fp(s.price)}</p>
              <p style={{ fontFamily:FONT_BODY, fontSize:11, color:C.muted, margin:0 }}>{fd(s.duration)}</p>
            </div>
          ))}
        </div>
        <Btn label="Ver todos los servicios →" onClick={() => setTab("servicios")} variant="ghost" full />
      </div>
    </div>
  );
}

function ViewServicios({ services, loading, setTab, setPreselect }) {
  const [open, setOpen] = useState(null);
  if (loading) return <Loading />;
  return (
    <div style={{ padding:"24px 20px 90px" }}>
      <PageHeader eyebrow="Esencial Studio" title="Servicios" />
      {services.map(cat => (
        <div key={cat.id} style={{ marginBottom:24 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, paddingBottom:8, borderBottom:`1px solid ${C.border}` }}>
            <span style={{ fontSize:18 }}>{cat.emoji}</span>
            <p style={{ fontFamily:FONT_BODY, fontSize:12, letterSpacing:2, color:C.muted, textTransform:"uppercase", margin:0, fontWeight:600 }}>{cat.category}</p>
          </div>
          {cat.items.map(srv => (
            <div key={srv.id} style={{ background:C.surface, borderRadius:12, marginBottom:8, overflow:"hidden" }}>
              <div onClick={() => setOpen(open===srv.id?null:srv.id)} style={{ padding:"14px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}>
                <div>
                  <p style={{ fontFamily:FONT_BODY, fontSize:14, fontWeight:600, color:C.charcoal, margin:"0 0 2px" }}>{srv.name}</p>
                  <p style={{ fontFamily:FONT_BODY, fontSize:12, color:C.muted, margin:0 }}>{fd(srv.duration)}</p>
                </div>
                <div style={{ textAlign:"right" }}>
                  <p style={{ fontFamily:FONT_DISPLAY, fontSize:20, fontWeight:600, color:C.gold, margin:"0 0 2px" }}>{fp(srv.price)}</p>
                  <p style={{ fontFamily:FONT_BODY, fontSize:11, color:C.muted, margin:0 }}>{open===srv.id?"▲":"▼"}</p>
                </div>
              </div>
              {open===srv.id && (
                <div style={{ padding:"0 16px 14px", borderTop:`1px solid ${C.border}` }}>
                  <p style={{ fontFamily:FONT_BODY, fontSize:13, color:C.muted, margin:"10px 0 12px", lineHeight:1.5 }}>{srv.desc||"Servicio profesional a domicilio."}</p>
                  <Btn label="Reservar este servicio" onClick={() => { setPreselect(srv.id); setTab("reservar"); }} variant="gold" small />
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ViewReservar({ services, agenda, bookAppointment, currentUser, setTab, preselect, setPreselect, updateClientAfterBooking }) {
  const allSrvs = services.flatMap(c => c.items);
  const [step, setStep] = useState(1);
  const [srvId, setSrvId] = useState(preselect||"");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const srv = allSrvs.find(s => s.id===srvId);
  const slots = ["09:00","10:00","11:00","12:00","14:00","15:00","16:00","17:00","18:00"];
  const booked = agenda.filter(a => a.date===date && a.status!=="cancelled").map(a => a.time);
  const available = slots.filter(s => !booked.includes(s));

  const confirm = async () => {
    setSaving(true);
    await bookAppointment({ clientId:currentUser.id, clientName:currentUser.name, serviceId:srvId, serviceName:srv.name, duration:srv.duration, date, time, note });
    await updateClientAfterBooking(currentUser.id, srv.name, date);
    setSaving(false);
    setDone(true);
  };

  if (!currentUser) return (
    <div style={{ padding:"24px 20px 90px" }}>
      <PageHeader eyebrow="Esencial Studio" title="Reservar" />
      <div style={{ background:C.surface, borderRadius:14, padding:24, textAlign:"center" }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🦢</div>
        <p style={{ fontFamily:FONT_DISPLAY, fontSize:22, color:C.charcoal, margin:"0 0 10px" }}>Regístrate para reservar</p>
        <p style={{ fontFamily:FONT_BODY, fontSize:14, color:C.muted, margin:"0 0 20px", lineHeight:1.6 }}>Necesitas una cuenta para hacer una reserva. Es rápido y gratis.</p>
        <Btn label="Registrarme" onClick={() => setTab("perfil")} variant="gold" full />
      </div>
    </div>
  );

  if (done) return (
    <div style={{ padding:"24px 20px 90px" }}>
      <div style={{ background:C.surface, borderRadius:14, padding:32, textAlign:"center", marginTop:20 }}>
        <div style={{ fontSize:52, marginBottom:14 }}>🦢</div>
        <h2 style={{ fontFamily:FONT_DISPLAY, fontSize:28, color:C.charcoal, margin:"0 0 10px" }}>¡Cita solicitada!</h2>
        <p style={{ fontFamily:FONT_BODY, fontSize:14, color:C.muted, lineHeight:1.7, margin:"0 0 8px" }}><strong style={{ color:C.charcoal }}>{srv?.name}</strong></p>
        <p style={{ fontFamily:FONT_BODY, fontSize:14, color:C.muted, margin:"0 0 16px" }}>📅 {fdate(date)} · ⏰ {time}</p>
        <p style={{ fontFamily:FONT_BODY, fontSize:13, color:C.muted, margin:"0 0 24px", padding:"12px 16px", background:C.champagne, borderRadius:10 }}>
          Tu cita está <strong>pendiente</strong>. Esencial Studio la confirmará pronto.
        </p>
        <Btn label="Volver al inicio" onClick={() => { setDone(false); setStep(1); setSrvId(""); setDate(""); setTime(""); setNote(""); setPreselect(""); setTab("inicio"); }} variant="gold" full />
      </div>
    </div>
  );

  return (
    <div style={{ padding:"24px 20px 90px" }}>
      <PageHeader eyebrow="Esencial Studio" title="Reservar" />
      <div style={{ display:"flex", gap:6, marginBottom:22 }}>
        {[1,2].map(n => <div key={n} style={{ flex:1, height:3, borderRadius:4, background:step>=n?C.goldLight:C.border }} />)}
      </div>
      {step===1 && (
        <div>
          <p style={{ fontFamily:FONT_BODY, fontSize:13, fontWeight:600, color:C.charcoal, marginBottom:12 }}>¿Qué servicio deseas?</p>
          {services.map(cat => (
            <div key={cat.id} style={{ marginBottom:16 }}>
              <p style={{ fontFamily:FONT_BODY, fontSize:10, letterSpacing:2, color:C.muted, textTransform:"uppercase", marginBottom:8 }}>{cat.emoji} {cat.category}</p>
              {cat.items.map(s => (
                <div key={s.id} onClick={() => setSrvId(s.id)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 14px", borderRadius:10, marginBottom:6, cursor:"pointer", border:`1.5px solid ${srvId===s.id?C.goldLight:C.border}`, background:srvId===s.id?C.champagne:C.surface }}>
                  <div>
                    <p style={{ fontFamily:FONT_BODY, fontSize:13, fontWeight:500, color:C.charcoal, margin:0 }}>{s.name}</p>
                    <p style={{ fontFamily:FONT_BODY, fontSize:11, color:C.muted, margin:"2px 0 0" }}>{fd(s.duration)}</p>
                  </div>
                  <p style={{ fontFamily:FONT_DISPLAY, fontSize:18, fontWeight:600, color:C.gold, margin:0 }}>{fp(s.price)}</p>
                </div>
              ))}
            </div>
          ))}
          <Btn label="Continuar →" onClick={() => srvId && setStep(2)} variant="gold" full disabled={!srvId} />
        </div>
      )}
      {step===2 && (
        <div>
          {srv && <div style={{ background:C.champagne, borderRadius:10, padding:"10px 14px", marginBottom:18, display:"flex", justifyContent:"space-between" }}><p style={{ fontFamily:FONT_BODY, fontSize:13, color:C.charcoal, margin:0 }}><strong>{srv.name}</strong></p><p style={{ fontFamily:FONT_DISPLAY, fontSize:17, fontWeight:600, color:C.gold, margin:0 }}>{fp(srv.price)}</p></div>}
          <p style={{ fontFamily:FONT_BODY, fontSize:13, fontWeight:600, color:C.charcoal, marginBottom:12 }}>¿Cuándo prefieres la cita?</p>
          <Inp label="Fecha" value={date} onChange={setDate} type="date" />
          {date && (
            <div style={{ marginBottom:18 }}>
              <label style={{ display:"block", fontFamily:FONT_BODY, fontSize:11, letterSpacing:1.5, textTransform:"uppercase", color:C.muted, marginBottom:8 }}>
                Horario disponible {available.length===0 && <span style={{ color:C.red }}>— Sin disponibilidad</span>}
              </label>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                {slots.map(t => { const isAvail=available.includes(t); const isSel=time===t; return (
                  <div key={t} onClick={() => isAvail&&setTime(t)} style={{ padding:"10px 4px", textAlign:"center", borderRadius:8, border:`1.5px solid ${isSel?C.goldLight:isAvail?C.border:C.surfaceAlt}`, background:isSel?C.champagne:isAvail?C.surface:C.surfaceAlt, fontFamily:FONT_BODY, fontSize:13, color:isSel?C.gold:isAvail?C.charcoal:C.border, fontWeight:isSel?700:400, cursor:isAvail?"pointer":"not-allowed", textDecoration:!isAvail?"line-through":"none" }}>{t}</div>
                ); })}
              </div>
            </div>
          )}
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontFamily:FONT_BODY, fontSize:11, letterSpacing:1.5, textTransform:"uppercase", color:C.muted, marginBottom:5 }}>Nota (opcional)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Dirección, preferencias, alergias..." rows={2} style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:`1.5px solid ${C.border}`, fontFamily:FONT_BODY, fontSize:14, color:C.charcoal, background:C.bg, boxSizing:"border-box", outline:"none", resize:"none" }} />
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <Btn label="← Atrás" onClick={() => setStep(1)} variant="ghost" />
            <div style={{ flex:1 }}><Btn label={saving?"Guardando...":"Confirmar cita"} onClick={confirm} variant="gold" full disabled={!date||!time||saving} /></div>
          </div>
        </div>
      )}
    </div>
  );
}

function ViewPerfil({ currentUser, setCurrentUser, registerClient, loginClient, agenda }) {
  const [mode, setMode] = useState(currentUser?"profile":"register");
  const [form, setForm] = useState({ name:"", phone:"", email:"", notes:"" });
  const [loginPhone, setLoginPhone] = useState("");
  const [loginError, setLoginError] = useState("");
  const [saving, setSaving] = useState(false);
  const myBookings = currentUser ? agenda.filter(a => a.clientId===currentUser.id).sort((a,b) => a.date>b.date?-1:1) : [];

  const register = async () => {
    if (!form.name||!form.phone) return;
    setSaving(true);
    const client = await registerClient(form);
    setSaving(false);
    if (client) { setCurrentUser(client); setMode("profile"); }
  };

  const login = async () => {
    setSaving(true);
    const found = await loginClient(loginPhone);
    setSaving(false);
    if (found) { setCurrentUser(found); setMode("profile"); setLoginError(""); }
    else setLoginError("No encontramos una cuenta con ese teléfono.");
  };

  if (mode==="register") return (
    <div style={{ padding:"24px 20px 90px" }}>
      <PageHeader eyebrow="Esencial Studio" title="Crear cuenta" />
      <div style={{ background:C.surface, borderRadius:14, padding:20 }}>
        <Inp label="Nombre completo" value={form.name} onChange={v => setForm(s=>({...s,name:v}))} required />
        <Inp label="Teléfono" value={form.phone} onChange={v => setForm(s=>({...s,phone:v}))} type="tel" required />
        <Inp label="Email (opcional)" value={form.email} onChange={v => setForm(s=>({...s,email:v}))} type="email" />
        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontFamily:FONT_BODY, fontSize:11, letterSpacing:1.5, textTransform:"uppercase", color:C.muted, marginBottom:5 }}>Notas (alergias, preferencias)</label>
          <textarea value={form.notes} onChange={e => setForm(s=>({...s,notes:e.target.value}))} rows={2} style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:`1.5px solid ${C.border}`, fontFamily:FONT_BODY, fontSize:14, color:C.charcoal, background:C.bg, boxSizing:"border-box", outline:"none", resize:"none" }} />
        </div>
        <Btn label={saving?"Creando cuenta...":"Crear mi cuenta"} onClick={register} variant="gold" full disabled={!form.name||!form.phone||saving} />
        <p style={{ fontFamily:FONT_BODY, fontSize:13, color:C.muted, textAlign:"center", margin:"16px 0 0" }}>¿Ya tienes cuenta?{" "}<span onClick={() => setMode("login")} style={{ color:C.gold, cursor:"pointer", fontWeight:600 }}>Ingresa aquí</span></p>
      </div>
    </div>
  );

  if (mode==="login") return (
    <div style={{ padding:"24px 20px 90px" }}>
      <PageHeader eyebrow="Esencial Studio" title="Ingresar" />
      <div style={{ background:C.surface, borderRadius:14, padding:20 }}>
        <Inp label="Tu teléfono" value={loginPhone} onChange={setLoginPhone} type="tel" />
        {loginError && <p style={{ fontFamily:FONT_BODY, fontSize:12, color:C.red, margin:"-8px 0 12px" }}>{loginError}</p>}
        <Btn label={saving?"Buscando...":"Ingresar"} onClick={login} variant="gold" full disabled={!loginPhone||saving} />
        <p style={{ fontFamily:FONT_BODY, fontSize:13, color:C.muted, textAlign:"center", margin:"16px 0 0" }}>¿No tienes cuenta?{" "}<span onClick={() => setMode("register")} style={{ color:C.gold, cursor:"pointer", fontWeight:600 }}>Regístrate</span></p>
      </div>
    </div>
  );

  return (
    <div style={{ padding:"24px 20px 90px" }}>
      <PageHeader eyebrow="Mi cuenta" title={currentUser.name.split(" ")[0]} right={<button onClick={() => { setCurrentUser(null); setMode("register"); }} style={{ fontFamily:FONT_BODY, fontSize:12, color:C.muted, background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 12px", cursor:"pointer" }}>Salir</button>} />
      <div style={{ background:C.surface, borderRadius:14, padding:16, marginBottom:16 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {[["📞 Teléfono",currentUser.phone],["📧 Email",currentUser.email||"—"],["💅 Visitas",currentUser.visits||0],["📅 Último servicio",currentUser.lastService||"—"]].map(([k,v]) => (
            <div key={k} style={{ background:C.bg, borderRadius:8, padding:"10px 12px" }}>
              <p style={{ fontFamily:FONT_BODY, fontSize:11, color:C.muted, margin:"0 0 3px" }}>{k}</p>
              <p style={{ fontFamily:FONT_BODY, fontSize:13, fontWeight:600, color:C.charcoal, margin:0 }}>{String(v)}</p>
            </div>
          ))}
        </div>
        {currentUser.notes && <div style={{ marginTop:10, background:C.champagne, borderRadius:8, padding:"8px 12px" }}><p style={{ fontFamily:FONT_BODY, fontSize:12, color:C.muted, margin:0 }}>📝 {currentUser.notes}</p></div>}
      </div>
      <p style={{ fontFamily:FONT_BODY, fontSize:11, letterSpacing:2, color:C.muted, textTransform:"uppercase", marginBottom:12 }}>Mis citas</p>
      {myBookings.length===0 && <p style={{ fontFamily:FONT_BODY, fontSize:14, color:C.muted, textAlign:"center", margin:"20px 0" }}>No tienes citas aún.</p>}
      {myBookings.map(b => (
        <div key={b.id} style={{ background:C.surface, borderRadius:12, padding:"12px 14px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <p style={{ fontFamily:FONT_BODY, fontSize:14, fontWeight:600, color:C.charcoal, margin:"0 0 3px" }}>{b.serviceName}</p>
            <p style={{ fontFamily:FONT_BODY, fontSize:12, color:C.muted, margin:0 }}>{fdate(b.date)} · {b.time}</p>
          </div>
          <Tag color={b.status} />
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ADMIN VIEWS
// ═══════════════════════════════════════════════════════════════

function AdminAgenda({ agenda, updateStatus, loading }) {
  const [filter, setFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  if (loading) return <Loading />;
  let list = [...agenda].sort((a,b) => a.date>b.date?1:-1);
  if (filter!=="all") list = list.filter(a => a.status===filter);
  if (dateFilter) list = list.filter(a => a.date===dateFilter);
  return (
    <div style={{ padding:"24px 20px 90px" }}>
      <PageHeader eyebrow="Admin" title="Agenda" right={<div style={{ background:C.champagne, borderRadius:10, padding:"6px 12px" }}><p style={{ fontFamily:FONT_BODY, fontSize:11, color:C.gold, fontWeight:600, margin:0 }}>{agenda.filter(a=>a.status==="pending").length} pendientes</p></div>} />
      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
        {[["all","Todos"],["pending","Pendientes"],["confirmed","Confirmados"],["cancelled","Cancelados"]].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{ padding:"7px 12px", borderRadius:20, border:"none", background:filter===v?C.charcoal:C.surface, fontFamily:FONT_BODY, fontSize:11, fontWeight:filter===v?600:400, color:filter===v?C.white:C.muted, cursor:"pointer" }}>{l}</button>
        ))}
      </div>
      <div style={{ marginBottom:16 }}>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:`1.5px solid ${C.border}`, fontFamily:FONT_BODY, fontSize:13, color:C.charcoal, background:C.bg, boxSizing:"border-box", outline:"none" }} />
        {dateFilter && <button onClick={() => setDateFilter("")} style={{ marginTop:6, fontFamily:FONT_BODY, fontSize:12, color:C.muted, background:"none", border:"none", cursor:"pointer" }}>✕ Limpiar filtro</button>}
      </div>
      {list.length===0 && <p style={{ fontFamily:FONT_BODY, fontSize:14, color:C.muted, textAlign:"center", margin:"30px 0" }}>No hay citas en esta categoría.</p>}
      {list.map(a => (
        <div key={a.id} style={{ background:C.surface, borderRadius:12, padding:"14px 16px", marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
            <div>
              <p style={{ fontFamily:FONT_BODY, fontSize:14, fontWeight:600, color:C.charcoal, margin:"0 0 2px" }}>{a.clientName}</p>
              <p style={{ fontFamily:FONT_BODY, fontSize:13, color:C.muted, margin:0 }}>{a.serviceName}</p>
            </div>
            <Tag color={a.status} />
          </div>
          <div style={{ display:"flex", gap:8, marginBottom:a.note||a.status==="pending"?10:0, flexWrap:"wrap" }}>
            {[["📅",fdate(a.date)],["⏰",a.time],["⏱",fd(a.duration)]].map(([icon,val]) => (
              <span key={icon} style={{ background:C.bg, borderRadius:8, padding:"5px 10px", fontFamily:FONT_BODY, fontSize:12, color:C.charcoal }}>{icon} {val}</span>
            ))}
          </div>
          {a.note && <p style={{ fontFamily:FONT_BODY, fontSize:12, color:C.muted, margin:"0 0 10px", padding:"6px 10px", background:C.champagne, borderRadius:8 }}>📝 {a.note}</p>}
          {a.status==="pending" && <div style={{ display:"flex", gap:8 }}><Btn label="✓ Confirmar" onClick={() => updateStatus(a.id,"confirmed")} variant="gold" small /><Btn label="✕ Cancelar" onClick={() => updateStatus(a.id,"cancelled")} variant="red" small /></div>}
          {a.status==="confirmed" && <Btn label="✕ Cancelar" onClick={() => updateStatus(a.id,"cancelled")} variant="red" small />}
        </div>
      ))}
    </div>
  );
}

function AdminClientes({ clients, loading, agenda }) {
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState(null);
  if (loading) return <Loading />;
  const filtered = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase())||c.phone.includes(search));
  return (
    <div style={{ padding:"24px 20px 90px" }}>
      <PageHeader eyebrow="Admin" title="Clientes" right={<div style={{ background:C.champagne, borderRadius:10, padding:"6px 12px" }}><p style={{ fontFamily:FONT_BODY, fontSize:11, color:C.gold, fontWeight:600, margin:0 }}>{clients.length} registradas</p></div>} />
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o teléfono..." style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontFamily:FONT_BODY, fontSize:14, color:C.charcoal, background:C.surface, boxSizing:"border-box", outline:"none", marginBottom:16 }} />
      {filtered.map(c => {
        const myBookings = agenda.filter(b => b.clientId===c.id);
        const isOpen = sel===c.id;
        return (
          <div key={c.id} onClick={() => setSel(isOpen?null:c.id)} style={{ background:C.surface, borderRadius:12, padding:"14px 16px", marginBottom:8, cursor:"pointer", border:`1.5px solid ${isOpen?C.goldLight:"transparent"}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <p style={{ fontFamily:FONT_BODY, fontSize:14, fontWeight:600, color:C.charcoal, margin:"0 0 3px" }}>{c.name}</p>
                <p style={{ fontFamily:FONT_BODY, fontSize:12, color:C.muted, margin:0 }}>📞 {c.phone}{c.email?` · ${c.email}`:""}</p>
              </div>
              <div style={{ background:C.champagne, borderRadius:20, padding:"4px 10px" }}><p style={{ fontFamily:FONT_BODY, fontSize:11, fontWeight:600, color:C.gold, margin:0 }}>{c.visits||0} visitas</p></div>
            </div>
            {isOpen && (
              <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                  {[["Último servicio",c.lastService||"—"],["Última visita",fdate(c.lastDate)]].map(([k,v]) => (
                    <div key={k} style={{ background:C.bg, borderRadius:8, padding:"8px 10px" }}><p style={{ fontFamily:FONT_BODY, fontSize:11, color:C.muted, margin:"0 0 2px" }}>{k}</p><p style={{ fontFamily:FONT_BODY, fontSize:12, fontWeight:600, color:C.charcoal, margin:0 }}>{v}</p></div>
                  ))}
                </div>
                {c.notes && <div style={{ background:C.champagne, borderRadius:8, padding:"8px 12px", marginBottom:10 }}><p style={{ fontFamily:FONT_BODY, fontSize:12, color:C.muted, margin:0 }}>📝 {c.notes}</p></div>}
                <p style={{ fontFamily:FONT_BODY, fontSize:11, color:C.muted, marginBottom:6 }}>Citas ({myBookings.length})</p>
                {myBookings.slice(0,3).map(b => (
                  <div key={b.id} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
                    <p style={{ fontFamily:FONT_BODY, fontSize:12, color:C.charcoal, margin:0 }}>{b.serviceName}</p>
                    <span style={{ fontFamily:FONT_BODY, fontSize:12, color:C.muted }}>{fdate(b.date)} <Tag color={b.status} /></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {filtered.length===0 && <p style={{ fontFamily:FONT_BODY, fontSize:14, color:C.muted, textAlign:"center", margin:"30px 0" }}>No se encontraron clientes.</p>}
    </div>
  );
}

function AdminServicios({ services, loading, addService, updateService, deleteService, addCategory }) {
  const [editing, setEditing] = useState(null);
  const [newCatName, setNewCatName] = useState("");
  const [saving, setSaving] = useState(false);
  if (loading && services.length===0) return <Loading />;

  if (editing) {
    const { catId, catName, catEmoji, item } = editing;
    const [form, setForm] = useState({ name:item.name||"", duration:item.duration||60, price:item.price||0, desc:item.desc||"", id:item.id });
    const save = async () => {
      setSaving(true);
      if (form.id) await updateService(form.id, form);
      else await addService(catName, catEmoji, form);
      setSaving(false);
      setEditing(null);
    };
    return (
      <div style={{ padding:"24px 20px 90px" }}>
        <PageHeader eyebrow="Admin · Servicios" title={item.id?"Editar":"Nuevo servicio"} />
        <div style={{ background:C.surface, borderRadius:14, padding:20 }}>
          <Inp label="Nombre" value={form.name} onChange={v => setForm(s=>({...s,name:v}))} required />
          <Inp label="Duración (minutos)" value={form.duration} onChange={v => setForm(s=>({...s,duration:v}))} type="number" />
          <Inp label="Precio (COP)" value={form.price} onChange={v => setForm(s=>({...s,price:v}))} type="number" />
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontFamily:FONT_BODY, fontSize:11, letterSpacing:1.5, textTransform:"uppercase", color:C.muted, marginBottom:5 }}>Descripción</label>
            <textarea value={form.desc} onChange={e => setForm(s=>({...s,desc:e.target.value}))} rows={2} style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:`1.5px solid ${C.border}`, fontFamily:FONT_BODY, fontSize:14, color:C.charcoal, background:C.bg, boxSizing:"border-box", outline:"none", resize:"none" }} />
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <Btn label="Cancelar" onClick={() => setEditing(null)} variant="ghost" />
            <div style={{ flex:1 }}><Btn label={saving?"Guardando...":"Guardar"} onClick={save} variant="gold" full disabled={!form.name||saving} /></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding:"24px 20px 90px" }}>
      <PageHeader eyebrow="Admin" title="Servicios" />
      {services.map(cat => (
        <div key={cat.id} style={{ marginBottom:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <p style={{ fontFamily:FONT_BODY, fontSize:11, letterSpacing:2, color:C.muted, textTransform:"uppercase", margin:0 }}>{cat.emoji} {cat.category}</p>
            <Btn label="+ Agregar" onClick={() => setEditing({ catId:cat.id, catName:cat.category, catEmoji:cat.emoji, item:{ name:"", duration:60, price:0, desc:"" } })} variant="gold" small />
          </div>
          {cat.items.map(srv => (
            <div key={srv.id} style={{ background:C.surface, borderRadius:10, padding:"10px 14px", marginBottom:6, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <p style={{ fontFamily:FONT_BODY, fontSize:13, fontWeight:600, color:C.charcoal, margin:"0 0 2px" }}>{srv.name}</p>
                <p style={{ fontFamily:FONT_BODY, fontSize:11, color:C.muted, margin:0 }}>{fd(srv.duration)} · {fp(srv.price)}</p>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <Btn label="✏️" onClick={() => setEditing({ catId:cat.id, catName:cat.category, catEmoji:cat.emoji, item:srv })} variant="ghost" small />
                <Btn label="🗑" onClick={() => deleteService(srv.id)} variant="red" small />
              </div>
            </div>
          ))}
        </div>
      ))}
      <div style={{ display:"flex", gap:8, marginTop:10 }}>
        <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Nueva categoría..." style={{ flex:1, padding:"10px 12px", borderRadius:8, border:`1.5px solid ${C.border}`, fontFamily:FONT_BODY, fontSize:14, color:C.charcoal, background:C.bg, outline:"none" }} />
        <Btn label="+ Crear" onClick={() => { if(newCatName.trim()){ addCategory(newCatName.trim(),"✨"); setNewCatName(""); } }} variant="gold" />
      </div>
    </div>
  );
}

function AdminConfig({ setIsAdmin }) {
  return (
    <div style={{ padding:"24px 20px 90px" }}>
      <PageHeader eyebrow="Admin" title="Configuración" />
      <div style={{ background:C.surface, borderRadius:14, padding:20, marginBottom:16 }}>
        <p style={{ fontFamily:FONT_BODY, fontSize:13, color:C.muted, lineHeight:1.7, margin:0 }}>
          Para cambiar los horarios y días disponibles, ve al panel de Supabase → tabla <strong>configuracion</strong> y edita los valores de <em>dias_trabajo</em> y <em>horarios</em>.
        </p>
      </div>
      <div style={{ background:C.redPale, borderRadius:12, padding:16 }}>
        <p style={{ fontFamily:FONT_BODY, fontSize:13, color:C.red, margin:"0 0 10px" }}>Salir del panel de administración</p>
        <Btn label="Volver a la app cliente" onClick={() => setIsAdmin(false)} variant="ghost" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const { services, loading:srvLoading, addService, updateService, deleteService, addCategory } = useServices();
  const { clients, loading:cliLoading, registerClient, loginClient, updateClientAfterBooking } = useClients();
  const { agenda, loading:agLoading, bookAppointment, updateStatus } = useAgenda();

  const [currentUser, setCurrentUser] = useState(() => { try { const s = sessionStorage.getItem("es_user"); return s ? JSON.parse(s) : null; } catch { return null; } });
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState("inicio");
  const [preselect, setPreselect] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [showPin, setShowPin] = useState(false);
  const PIN = "1234"; // ← CAMBIA ESTE PIN ANTES DE PUBLICAR

  useEffect(() => { try { if (currentUser) sessionStorage.setItem("es_user", JSON.stringify(currentUser)); else sessionStorage.removeItem("es_user"); } catch {} }, [currentUser]);

  const switchToAdmin = () => {
    if (pinInput===PIN) { setIsAdmin(true); setTab("admin-agenda"); setShowPin(false); setPinInput(""); }
    else setPinInput("");
  };

  return (
    <div style={{ fontFamily:FONT_BODY, background:C.bg, minHeight:"100vh", maxWidth:430, margin:"0 auto", position:"relative", boxShadow:"0 0 50px rgba(0,0,0,0.1)" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />

      {!isAdmin && <button onClick={() => setShowPin(true)} style={{ position:"fixed", top:14, right:14, zIndex:200, background:C.charcoal, border:"none", borderRadius:8, padding:"6px 10px", fontFamily:FONT_BODY, fontSize:10, color:"rgba(212,168,67,0.7)", cursor:"pointer", letterSpacing:1 }}>⚙ Admin</button>}

      {showPin && (
        <div style={{ position:"fixed", inset:0, background:"rgba(30,24,16,0.6)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div style={{ background:C.surface, borderRadius:16, padding:28, width:"100%", maxWidth:320, textAlign:"center" }}>
            <div style={{ fontSize:32, marginBottom:10 }}>🦢</div>
            <h3 style={{ fontFamily:FONT_DISPLAY, fontSize:22, color:C.charcoal, margin:"0 0 6px" }}>Panel Admin</h3>
            <p style={{ fontFamily:FONT_BODY, fontSize:13, color:C.muted, margin:"0 0 18px" }}>Ingresa tu PIN de administración</p>
            <input type="password" value={pinInput} onChange={e => setPinInput(e.target.value)} onKeyDown={e => e.key==="Enter"&&switchToAdmin()} placeholder="PIN" maxLength={6} style={{ width:"100%", padding:"12px", borderRadius:8, border:`1.5px solid ${C.border}`, fontFamily:FONT_BODY, fontSize:20, textAlign:"center", letterSpacing:8, color:C.charcoal, background:C.bg, boxSizing:"border-box", outline:"none", marginBottom:14 }} />
            <div style={{ display:"flex", gap:10 }}>
              <Btn label="Cancelar" onClick={() => { setShowPin(false); setPinInput(""); }} variant="ghost" full />
              <Btn label="Ingresar" onClick={switchToAdmin} variant="gold" full />
            </div>
          </div>
        </div>
      )}

      {!isAdmin && (
        <>
          {tab==="inicio" && <ViewInicio currentUser={currentUser} agenda={agenda} services={services} setTab={setTab} />}
          {tab==="servicios" && <ViewServicios services={services} loading={srvLoading} setTab={setTab} setPreselect={setPreselect} />}
          {tab==="reservar" && <ViewReservar services={services} agenda={agenda} bookAppointment={bookAppointment} currentUser={currentUser} setTab={setTab} preselect={preselect} setPreselect={setPreselect} updateClientAfterBooking={updateClientAfterBooking} />}
          {tab==="perfil" && <ViewPerfil currentUser={currentUser} setCurrentUser={setCurrentUser} registerClient={registerClient} loginClient={loginClient} agenda={agenda} />}
        </>
      )}
      {isAdmin && (
        <>
          {tab==="admin-agenda" && <AdminAgenda agenda={agenda} updateStatus={updateStatus} loading={agLoading} />}
          {tab==="admin-clientes" && <AdminClientes clients={clients} loading={cliLoading} agenda={agenda} />}
          {tab==="admin-servicios" && <AdminServicios services={services} loading={srvLoading} addService={addService} updateService={updateService} deleteService={deleteService} addCategory={addCategory} />}
          {tab==="admin-config" && <AdminConfig setIsAdmin={(v) => { setIsAdmin(v); setTab("inicio"); }} />}
        </>
      )}

      <BottomNav tab={tab} setTab={setTab} isAdmin={isAdmin} />
    </div>
  );
}
