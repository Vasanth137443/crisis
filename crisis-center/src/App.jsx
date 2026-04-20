import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ══════════════════════════════════════════════════════════════════════════════
// ⚠️  PASTE YOUR GEMINI API KEY HERE
// ══════════════════════════════════════════════════════════════════════════════
const GEMINI_API_KEY = "AIzaSyA6Lw7UiiyBM0R1HNrCopzVcJP8AG7M_io";
// Get a free key at: https://aistudio.google.com

// ══════════════════════════════════════════════════════════════════════════════
// GLOBAL STYLES
// ══════════════════════════════════════════════════════════════════════════════
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#060a14; overflow-x:hidden; }
  ::-webkit-scrollbar { width:4px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:rgba(0,200,255,0.2); border-radius:2px; }
  select option { background:#0a1020; color:#fff; }

  @keyframes ping      { 0%{transform:scale(1);opacity:0.6;} 100%{transform:scale(2.8);opacity:0;} }
  @keyframes slideIn   { from{opacity:0;transform:translateY(-10px);} to{opacity:1;transform:translateY(0);} }
  @keyframes slideUp   { from{opacity:0;transform:translate(-50%,20px);} to{opacity:1;transform:translate(-50%,0);} }
  @keyframes fadeIn    { from{opacity:0;transform:translateY(24px);} to{opacity:1;transform:translateY(0);} }
  @keyframes pulseGlow { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
  @keyframes blink     { 0%,100%{opacity:1} 50%{opacity:0} }
  @keyframes sosPulse  { 0%,100%{transform:scale(1);box-shadow:0 0 30px #ff2d5566;} 50%{transform:scale(1.05);box-shadow:0 0 70px #ff2d55bb;} }
  @keyframes escalate  { 0%,100%{border-color:rgba(255,45,85,0.4);} 50%{border-color:#ff2d55;box-shadow:0 0 20px #ff2d5566;} }
  @keyframes barGrow   { from{width:0;} to{width:var(--w);} }
  @keyframes routePulse{ 0%,100%{stroke-dashoffset:0;opacity:0.8;} 50%{stroke-dashoffset:20;opacity:0.4;} }
  @keyframes spin      { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }
  @keyframes countUp   { from{opacity:0;transform:scale(0.8);} to{opacity:1;transform:scale(1);} }
  @keyframes shimmer   { 0%{background-position:-200% center;} 100%{background-position:200% center;} }
  @keyframes geminiPulse { 0%,100%{box-shadow:0 0 0 0 rgba(138,43,226,0.4);} 50%{box-shadow:0 0 0 8px rgba(138,43,226,0);} }
  @keyframes typing    { 0%,100%{opacity:1;} 50%{opacity:0;} }
`;

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTS & DATA
// ══════════════════════════════════════════════════════════════════════════════
const SEVERITY = {
  critical: { color:"#ff2d55", glow:"0 0 12px #ff2d55,0 0 30px #ff2d5588", label:"CRITICAL", priority:4 },
  high:     { color:"#ff9500", glow:"0 0 12px #ff9500,0 0 30px #ff950088", label:"HIGH",     priority:3 },
  medium:   { color:"#ffd60a", glow:"0 0 12px #ffd60a,0 0 20px #ffd60a66", label:"MEDIUM",   priority:2 },
  low:      { color:"#30d158", glow:"0 0 10px #30d158,0 0 20px #30d15866", label:"LOW",      priority:1 },
};

const ALERT_TYPES = {
  fire:      { icon:"🔥", label:"Fire Detected",      sound:880 },
  intrusion: { icon:"🚨", label:"Security Breach",    sound:660 },
  motion:    { icon:"👁",  label:"Suspicious Motion",  sound:440 },
  hazmat:    { icon:"☣️", label:"Hazmat Spill",        sound:550 },
  medical:   { icon:"🚑", label:"Medical Emergency",  sound:770 },
  smoke:     { icon:"💨", label:"Smoke Detected",     sound:520 },
  sos:       { icon:"🆘", label:"Guest SOS",          sound:990 },
};

const FLOORS = [
  { id:1, label:"Floor 1 — Lobby & Services" },
  { id:2, label:"Floor 2 — Guest Rooms"      },
  { id:3, label:"Floor 3 — Executive Suite"  },
  { id:4, label:"Rooftop & Parking"          },
];

const FLOOR_ZONES = {
  1: [
    { id:"lobby",     label:"Lobby",       x:18, y:72 },
    { id:"server",    label:"Server Rm",   x:75, y:20 },
    { id:"hallA",     label:"Hall A",      x:50, y:50 },
    { id:"exit_n",    label:"Exit North",  x:50, y:8  },
    { id:"exit_s",    label:"Exit South",  x:50, y:88 },
    { id:"cafeteria", label:"Cafeteria",   x:82, y:72 },
    { id:"parking",   label:"Reception",   x:18, y:28 },
  ],
  2: [
    { id:"r201", label:"Room 201", x:20, y:25 },
    { id:"r202", label:"Room 202", x:50, y:25 },
    { id:"r203", label:"Room 203", x:78, y:25 },
    { id:"r204", label:"Room 204", x:20, y:65 },
    { id:"r205", label:"Room 205", x:50, y:65 },
    { id:"r206", label:"Room 206", x:78, y:65 },
    { id:"corr2",label:"Corridor", x:50, y:45 },
  ],
  3: [
    { id:"suite1", label:"Suite A",    x:25, y:30 },
    { id:"suite2", label:"Suite B",    x:75, y:30 },
    { id:"board",  label:"Boardroom",  x:50, y:65 },
    { id:"exec",   label:"Exec Lounge",x:50, y:20 },
  ],
  4: [
    { id:"roof",  label:"Rooftop Bar", x:50, y:35 },
    { id:"park1", label:"Parking A",   x:25, y:70 },
    { id:"park2", label:"Parking B",   x:75, y:70 },
  ],
};

const EVAC_ROUTES = {
  1: "50,8 50,50 18,50 18,72 18,95",
  2: "50,25 50,45 50,65 50,90",
  3: "50,20 50,65 20,65 20,90",
  4: "50,35 50,70 25,70 10,90",
};

const ROOMS = ["Room 101","Room 102","Room 201","Room 202","Room 203","Room 301","Lobby","Restaurant","Pool","Gym","Conference Hall","Rooftop Bar"];
const CAMERAS = ["CAM-001","CAM-002","CAM-003","CAM-004","CAM-005","CAM-006","CAM-008","CAM-012"];

const SEED_ALERTS = [
  { id:1, type:"fire",      location:"Lobby",     severity:"critical", ts:Date.now()-95000, zone:"lobby",    floor:1, source:"AI Camera", camera:"CAM-001", confidence:0.97, resolved:false, escalated:false },
  { id:2, type:"intrusion", location:"Server Rm", severity:"high",     ts:Date.now()-61000, zone:"server",   floor:1, source:"AI Camera", camera:"CAM-003", confidence:0.88, resolved:false, escalated:false },
  { id:3, type:"motion",    location:"Hall A",    severity:"medium",   ts:Date.now()-30000, zone:"hallA",    floor:1, source:"AI Camera", camera:"CAM-005", confidence:0.74, resolved:false, escalated:false },
  { id:4, type:"smoke",     location:"Cafeteria", severity:"low",      ts:Date.now()-10000, zone:"cafeteria",floor:1, source:"AI Camera", camera:"CAM-008", confidence:0.61, resolved:false, escalated:false },
];

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════
const fmtTime    = ts => new Date(ts).toLocaleTimeString("en-US",{hour12:false});
const fmtElapsed = ts => {
  const s = Math.floor((Date.now()-ts)/1000);
  if(s<60)   return `${s}s ago`;
  if(s<3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
};
const randItem  = arr => arr[Math.floor(Math.random()*arr.length)];
const randFloat = (a,b) => +(a+Math.random()*(b-a)).toFixed(2);

const glass = (opacity=0.55) => ({
  background:`rgba(10,15,30,${opacity})`,
  backdropFilter:"blur(18px) saturate(1.4)",
  WebkitBackdropFilter:"blur(18px) saturate(1.4)",
  border:"1px solid rgba(255,255,255,0.07)",
  borderRadius:16,
});

// ══════════════════════════════════════════════════════════════════════════════
// SOUND ENGINE
// ══════════════════════════════════════════════════════════════════════════════
function playAlertSound(freq=880,duration=0.4){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.connect(gain);gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(freq,ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq*0.5,ctx.currentTime+duration);
    gain.gain.setValueAtTime(0.3,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+duration);
    osc.start();osc.stop(ctx.currentTime+duration);
  }catch(e){}
}

// ══════════════════════════════════════════════════════════════════════════════
// GEMINI AI ENGINE
// ══════════════════════════════════════════════════════════════════════════════
async function callGemini(prompt) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${AIzaSyA6Lw7UiiyBM0R1HNrCopzVcJP8AG7M_io}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 300, temperature: 0.7 },
        }),
      }
    );
    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "Analysis unavailable.";
  } catch (e) {
    return "Gemini AI offline — check API key.";
  }
}

// Returns a short action recommendation for staff
async function getAlertRecommendation(alert) {
  const prompt = `You are an emergency response AI for a hotel crisis management system.
Alert details: Type="${alert.type}", Location="${alert.location}", Severity="${alert.severity}", Floor=${alert.floor}, AI Confidence=${alert.confidence ? (alert.confidence*100).toFixed(0)+"%" : "N/A"}.
Give a SHORT (max 2 sentences, max 40 words) immediate action recommendation for hotel staff. Be specific and direct. No preamble.`;
  return callGemini(prompt);
}

// Returns safety instructions for a guest SOS
async function getGuestSafetyInstructions(emergencyType, room) {
  const prompt = `You are a calm hotel emergency assistant AI.
A guest in ${room} reported: "${emergencyType}".
Give 3 short bullet-point safety instructions for the guest RIGHT NOW. Each bullet max 10 words. Use simple language. No markdown headers, just bullets with •.`;
  return callGemini(prompt);
}

// Returns a situation summary for emergency services
async function getEmergencySummary(alerts) {
  const active = alerts.filter(a => !a.resolved).slice(0, 5);
  if (!active.length) return "All clear — no active incidents.";
  const list = active.map(a => `${a.type} at ${a.location} (${a.severity})`).join(", ");
  const prompt = `You are a crisis coordinator AI briefing first responders.
Active hotel incidents: ${list}.
Give a 2-sentence tactical summary for emergency services. Be concise and actionable. No preamble.`;
  return callGemini(prompt);
}

// ══════════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════
function Badge({color,children}){
  return(
    <span style={{fontSize:8,padding:"2px 7px",borderRadius:4,background:`${color}22`,border:`1px solid ${color}55`,color,letterSpacing:1,fontWeight:700,fontFamily:"'Space Mono',monospace"}}>
      {children}
    </span>
  );
}

// Gemini AI Panel component (reusable)
function GeminiPanel({text,loading,label="🤖 GEMINI AI ANALYSIS"}){
  return(
    <div style={{
      marginTop:10,padding:"10px 14px",borderRadius:10,
      background:"linear-gradient(135deg,rgba(138,43,226,0.08),rgba(75,0,130,0.12))",
      border:"1px solid rgba(138,43,226,0.3)",
      animation:loading?"geminiPulse 1.5s infinite":"none",
    }}>
      <div style={{fontSize:8,color:"rgba(138,43,226,0.9)",letterSpacing:2,marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
        {label}
        {loading&&<span style={{animation:"blink 0.8s infinite"}}>▋</span>}
      </div>
      <div style={{fontSize:10,color:"rgba(255,255,255,0.75)",lineHeight:1.6,fontFamily:"'Space Mono',monospace"}}>
        {loading ? (
          <span style={{color:"rgba(138,43,226,0.6)"}}>Analyzing threat data...</span>
        ) : text}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ROLE SELECTOR
// ══════════════════════════════════════════════════════════════════════════════
function RoleSelector({onSelect}){
  const [hov,setHov]=useState(null);
  const roles=[
    { id:"guest",     icon:"🆘", title:"GUEST",              sub:"Report an emergency",           color:"#ff9500", bg:"rgba(255,149,0,0.08)"     },
    { id:"staff",     icon:"🖥", title:"STAFF COMMAND",      sub:"Full dashboard & controls",     color:"#00c8ff", bg:"rgba(0,200,255,0.08)"    },
    { id:"emergency", icon:"🚒", title:"EMERGENCY SERVICES", sub:"Live responder feed",           color:"#ff2d55", bg:"rgba(255,45,85,0.08)"     },
  ];
  return(
    <div style={{minHeight:"100vh",background:"radial-gradient(ellipse at 50% 20%,#060d20 0%,#030508 100%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Space Mono',monospace",padding:24}}>
      <style>{GLOBAL_CSS}</style>
      <div style={{textAlign:"center",marginBottom:48,animation:"fadeIn 0.8s ease-out"}}>
        <div style={{fontSize:9,color:"rgba(0,200,255,0.5)",letterSpacing:6,marginBottom:12}}>RAPID CRISIS RESPONSE</div>
        <div style={{fontSize:36,fontFamily:"'Syne',sans-serif",fontWeight:800,background:"linear-gradient(135deg,#fff 0%,rgba(0,200,255,0.7) 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>COMMAND CENTER</div>
        <div style={{marginTop:10,fontSize:9,color:"rgba(255,255,255,0.2)",letterSpacing:2}}>POWERED BY GEMINI AI · SELECT YOUR ROLE TO CONTINUE</div>
      </div>

      {/* Gemini badge */}
      <div style={{
        marginBottom:36,padding:"6px 18px",borderRadius:20,
        background:"linear-gradient(90deg,rgba(138,43,226,0.2),rgba(75,0,130,0.3))",
        border:"1px solid rgba(138,43,226,0.4)",
        fontSize:9,color:"rgba(200,150,255,0.9)",letterSpacing:2,
        display:"flex",alignItems:"center",gap:8,
      }}>
        <span style={{fontSize:14}}>✨</span> GOOGLE GEMINI 1.5 FLASH INTEGRATED
      </div>

      <div style={{display:"flex",gap:20,flexWrap:"wrap",justifyContent:"center"}}>
        {roles.map((r,i)=>(
          <button key={r.id} onClick={()=>onSelect(r.id)} onMouseEnter={()=>setHov(r.id)} onMouseLeave={()=>setHov(null)}
            style={{
              width:200,padding:"28px 20px",borderRadius:18,cursor:"pointer",
              textAlign:"center",border:`1px solid ${hov===r.id?r.color:"rgba(255,255,255,0.07)"}`,
              background:hov===r.id?r.bg:"rgba(10,15,30,0.6)",
              backdropFilter:"blur(20px)",transition:"all 0.25s",
              transform:hov===r.id?"translateY(-4px)":"none",
              boxShadow:hov===r.id?`0 0 30px ${r.color}33`:"none",
              animation:`fadeIn ${0.4+i*0.15}s ease-out`,
              fontFamily:"'Space Mono',monospace",
            }}>
            <div style={{fontSize:36,marginBottom:12}}>{r.icon}</div>
            <div style={{fontSize:11,fontWeight:700,color:hov===r.id?r.color:"rgba(255,255,255,0.8)",letterSpacing:2,marginBottom:6}}>{r.title}</div>
            <div style={{fontSize:8,color:"rgba(255,255,255,0.3)",lineHeight:1.5}}>{r.sub}</div>
          </button>
        ))}
      </div>

      <div style={{marginTop:48,fontSize:7,color:"rgba(255,255,255,0.1)",letterSpacing:2,textAlign:"center"}}>
        © 2025 RAPID CRISIS RESPONSE SYSTEM · AI-POWERED BY GOOGLE GEMINI
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GUEST SOS PANEL
// ══════════════════════════════════════════════════════════════════════════════
function GuestSOS({onBack,onAlert}){
  const [phase,setPhase]=useState("form");
  const [eType,setEType]=useState("");
  const [room,setRoom]=useState("");
  const [desc,setDesc]=useState("");
  const [count,setCount]=useState(10);
  const [aiInstructions,setAiInstructions]=useState("");
  const [aiLoading,setAiLoading]=useState(false);

  const TYPES=["Fire","Security Threat","Medical Emergency","Hazmat / Gas Leak","Suspicious Person","Power Outage","Other"];

  async function handleSOS(){
    if(!eType||!room) return;
    setPhase("sent");
    playAlertSound(990,0.8);
    onAlert({type:"sos",location:room,severity:"critical",zone:"",floor:1,source:"Guest SOS",desc});

    // Fetch Gemini safety instructions
    setAiLoading(true);
    const instructions = await getGuestSafetyInstructions(eType, room);
    setAiInstructions(instructions);
    setAiLoading(false);

    // Countdown
    let c=10;
    const t=setInterval(()=>{ c--; setCount(c); if(c<=0)clearInterval(t); },1000);
  }

  if(phase==="sent") return(
    <div style={{minHeight:"100vh",background:"radial-gradient(ellipse at 50% 30%,#1a0800 0%,#080003 100%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Space Mono',monospace",padding:24}}>
      <style>{GLOBAL_CSS}</style>
      <div style={{maxWidth:420,width:"100%",textAlign:"center"}}>
        <div style={{fontSize:64,marginBottom:16,animation:"sosPulse 1s infinite"}}>🆘</div>
        <div style={{fontSize:18,fontWeight:700,color:"#ff2d55",letterSpacing:3,marginBottom:8}}>ALERT SENT</div>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginBottom:24}}>Help is on the way · Stay calm · Stay safe</div>

        <div style={{...glass(0.5),padding:20,marginBottom:16,border:"1px solid rgba(255,45,85,0.2)"}}>
          <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",marginBottom:4}}>EMERGENCY TYPE</div>
          <div style={{fontSize:14,color:"#ff2d55",fontWeight:700}}>{eType}</div>
          <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",marginTop:10,marginBottom:4}}>YOUR LOCATION</div>
          <div style={{fontSize:14,color:"#fff"}}>{room}</div>
          <div style={{marginTop:10,fontSize:9,color:"rgba(255,149,0,0.6)",letterSpacing:1}}>STAFF ALERTED · {count>0?`ESTIMATED RESPONSE: ${count}s`:"TEAM DISPATCHED ✓"}</div>
        </div>

        {/* Gemini AI Safety Instructions */}
        <GeminiPanel
          text={aiInstructions}
          loading={aiLoading}
          label="🤖 GEMINI AI — IMMEDIATE SAFETY INSTRUCTIONS"
        />

        <div style={{...glass(0.4),padding:16,marginTop:16,textAlign:"left",border:"1px solid rgba(255,255,255,0.05)"}}>
          <div style={{fontSize:8,color:"rgba(0,200,255,0.6)",letterSpacing:2,marginBottom:8}}>GENERAL SAFETY TIPS</div>
          {["Stay where you are unless instructed to move","Keep your door closed (fire events)","Do NOT use elevators","Follow all staff instructions","Call 911 if immediate danger"].map((tip,i)=>(
            <div key={i} style={{fontSize:9,color:"rgba(255,255,255,0.55)",marginBottom:4,display:"flex",gap:8}}><span style={{color:"#ff9500"}}>›</span>{tip}</div>
          ))}
        </div>

        <button onClick={onBack} style={{marginTop:16,padding:"10px 24px",borderRadius:8,cursor:"pointer",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.4)",fontSize:9,letterSpacing:1,fontFamily:"'Space Mono',monospace"}}>← BACK TO ROLES</button>
      </div>
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:"radial-gradient(ellipse at 50% 0%,#1a0800 0%,#060a14 100%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Space Mono',monospace",padding:24}}>
      <style>{GLOBAL_CSS}</style>
      <div style={{maxWidth:380,width:"100%"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:28}}>
          <button onClick={onBack} style={{background:"none",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:9,padding:"4px 10px",borderRadius:6,fontFamily:"'Space Mono',monospace"}}>← BACK</button>
          <div style={{fontSize:9,color:"rgba(255,149,0,0.6)",letterSpacing:3}}>GUEST EMERGENCY</div>
        </div>

        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:9,color:"rgba(255,45,85,0.5)",letterSpacing:4,marginBottom:10}}>EMERGENCY REPORT</div>
          <div style={{fontSize:28,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#fff"}}>Report an Incident</div>
          <div style={{fontSize:9,color:"rgba(255,255,255,0.25)",marginTop:8}}>AI-POWERED · INSTANT STAFF NOTIFICATION</div>
        </div>

        <div style={{...glass(0.5),padding:20,border:"1px solid rgba(255,45,85,0.1)"}}>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:8,color:"rgba(255,255,255,0.3)",letterSpacing:2,display:"block",marginBottom:6}}>EMERGENCY TYPE *</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {TYPES.map(t=>(
                <button key={t} onClick={()=>setEType(t)} style={{
                  padding:"5px 10px",borderRadius:6,cursor:"pointer",fontSize:8,letterSpacing:1,
                  background:eType===t?"rgba(255,45,85,0.2)":"rgba(255,255,255,0.03)",
                  border:`1px solid ${eType===t?"#ff2d55":"rgba(255,255,255,0.08)"}`,
                  color:eType===t?"#ff2d55":"rgba(255,255,255,0.35)",
                  fontFamily:"'Space Mono',monospace",transition:"all 0.15s",
                }}>{t}</button>
              ))}
            </div>
          </div>

          <div style={{marginBottom:14}}>
            <label style={{fontSize:8,color:"rgba(255,255,255,0.3)",letterSpacing:2,display:"block",marginBottom:6}}>YOUR ROOM / LOCATION *</label>
            <select value={room} onChange={e=>setRoom(e.target.value)} style={{
              width:"100%",padding:"8px 12px",borderRadius:8,background:"rgba(255,255,255,0.04)",
              border:"1px solid rgba(255,255,255,0.1)",color:"#fff",fontSize:10,fontFamily:"'Space Mono',monospace",
            }}>
              <option value="">Select location...</option>
              {ROOMS.map(r=><option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div style={{marginBottom:20}}>
            <label style={{fontSize:8,color:"rgba(255,255,255,0.3)",letterSpacing:2,display:"block",marginBottom:6}}>DESCRIPTION (OPTIONAL)</label>
            <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={2} placeholder="Describe the situation..." style={{
              width:"100%",padding:"8px 12px",borderRadius:8,background:"rgba(255,255,255,0.04)",
              border:"1px solid rgba(255,255,255,0.1)",color:"#fff",fontSize:10,resize:"none",
              fontFamily:"'Space Mono',monospace",
            }}/>
          </div>

          <button onClick={handleSOS} disabled={!eType||!room} style={{
            width:"100%",padding:"14px",borderRadius:10,cursor:eType&&room?"pointer":"not-allowed",
            background:eType&&room?"rgba(255,45,85,0.15)":"rgba(255,255,255,0.03)",
            border:`1px solid ${eType&&room?"#ff2d55":"rgba(255,255,255,0.1)"}`,
            color:eType&&room?"#ff2d55":"rgba(255,255,255,0.2)",
            fontSize:11,letterSpacing:3,fontWeight:700,fontFamily:"'Space Mono',monospace",
            boxShadow:eType&&room?"0 0 20px rgba(255,45,85,0.3)":"none",
            animation:eType&&room?"sosPulse 2s infinite":"none",transition:"all 0.2s",
          }}>🆘 SEND EMERGENCY ALERT</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STAFF DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
function StaffDashboard({onBack,alerts,setAlerts}){
  const [selected,setSelected]    = useState(null);
  const [floor,setFloor]          = useState(1);
  const [showEvac,setShowEvac]    = useState(false);
  const [showModal,setShowModal]  = useState(false);
  const [toast,setToast]          = useState(null);
  const [showAnalytics,setShowAnalytics] = useState(false);
  const [,setTick]                = useState(0);
  const [aiRec,setAiRec]          = useState("");
  const [aiLoading,setAiLoading]  = useState(false);
  const [prevAiAlertId,setPrevAiAlertId] = useState(null);

  // Manual form state
  const [mType,setMType]          = useState("fire");
  const [mLoc,setMLoc]            = useState("");
  const [mSev,setMSev]            = useState("medium");

  useEffect(()=>{ const t=setInterval(()=>setTick(x=>x+1),5000); return()=>clearInterval(t); },[]);

  // Auto-escalate unresolved critical alerts after 2 min
  useEffect(()=>{
    const t=setInterval(()=>{
      setAlerts(prev=>prev.map(a=>{
        if(a.severity==="critical"&&!a.resolved&&!a.escalated&&Date.now()-a.ts>120000)
          return{...a,escalated:true};
        return a;
      }));
    },15000);
    return()=>clearInterval(t);
  },[setAlerts]);

  // Fetch Gemini recommendation when alert is selected
  useEffect(()=>{
    if(!selected||selected.id===prevAiAlertId) return;
    setPrevAiAlertId(selected.id);
    setAiLoading(true);
    setAiRec("");
    getAlertRecommendation(selected).then(rec=>{
      setAiRec(rec);
      setAiLoading(false);
    });
  },[selected, prevAiAlertId]);

  const floorAlerts = alerts.filter(a=>a.floor===floor&&!a.resolved);
  const active      = alerts.filter(a=>!a.resolved);
  const criticals   = active.filter(a=>a.severity==="critical").length;
  const guestSOS    = active.filter(a=>a.source==="Guest SOS").length;

  function showToast(msg,color="#30d158"){
    setToast({msg,color});
    setTimeout(()=>setToast(null),3000);
  }

  function resolveAlert(){
    if(!selected) return;
    setAlerts(prev=>prev.map(a=>a.id===selected.id?{...a,resolved:true}:a));
    showToast(`✓ Incident at ${selected.location} RESOLVED`,"#30d158");
    setSelected(null);
    setAiRec("");
  }

  function dispatchAlert(){
    if(!selected) return;
    showToast(`🚨 Emergency team dispatched to ${selected.location}!`,"#ff2d55");
  }

  function submitManual(){
    if(!mLoc) return;
    const zone = FLOOR_ZONES[floor]?.find(z=>z.label===mLoc)||FLOOR_ZONES[floor]?.[0];
    setAlerts(prev=>[{
      id:Date.now(),type:mType,location:mLoc,severity:mSev,
      ts:Date.now(),zone:zone?.id||"",floor,source:"Manual",
      camera:null,confidence:null,resolved:false,escalated:false,isNew:true,
    },...prev].slice(0,100));
    playAlertSound(ALERT_TYPES[mType]?.sound||880,0.4);
    setShowModal(false);
    showToast(`⚠️ Manual incident reported: ${mType} at ${mLoc}`,"#ff9500");
  }

  const now = new Date();
  const clock = now.toLocaleTimeString("en-US",{hour12:false});

  return(
    <div style={{minHeight:"100vh",background:"radial-gradient(ellipse at 30% 10%,#060f25 0%,#030509 60%,#000 100%)",fontFamily:"'Space Mono',monospace",color:"#fff",display:"flex",flexDirection:"column"}}>
      <style>{GLOBAL_CSS}</style>

      {/* Toast */}
      {toast&&(
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:1000,padding:"10px 20px",borderRadius:10,background:`${toast.color}22`,border:`1px solid ${toast.color}55`,color:toast.color,fontSize:10,letterSpacing:1,animation:"slideUp 0.3s ease-out",whiteSpace:"nowrap"}}>
          {toast.msg}
        </div>
      )}

      {/* Nav */}
      <div style={{padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(255,255,255,0.05)",background:"rgba(0,0,0,0.3)",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={onBack} style={{background:"none",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.35)",cursor:"pointer",fontSize:9,padding:"4px 10px",borderRadius:6,fontFamily:"'Space Mono',monospace"}}>← ROLES</button>
          <div style={{fontSize:9,color:"rgba(255,255,255,0.2)",letterSpacing:3}}>RAPID CRISIS RESPONSE</div>
          <div style={{fontSize:9,fontWeight:700,color:"#00c8ff",letterSpacing:2}}>STAFF COMMAND</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          {/* Gemini badge */}
          <div style={{fontSize:8,color:"rgba(138,43,226,0.7)",letterSpacing:1,padding:"2px 8px",borderRadius:4,border:"1px solid rgba(138,43,226,0.3)",background:"rgba(138,43,226,0.05)"}}>✨ GEMINI AI</div>
          {criticals>0&&(
            <div style={{display:"flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:6,background:"rgba(255,45,85,0.1)",border:"1px solid rgba(255,45,85,0.3)",animation:"escalate 1s infinite"}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:"#ff2d55",animation:"blink 0.5s infinite"}}/>
              <span style={{fontSize:8,color:"#ff2d55",letterSpacing:1}}>{criticals} CRITICAL</span>
            </div>
          )}
          <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",letterSpacing:2}}>{clock}</div>
        </div>
      </div>

      {/* Metrics row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,padding:"12px 14px",flexShrink:0}}>
        {[
          {label:"ACTIVE ALERTS",  val:active.length,           color:"#00c8ff"},
          {label:"CRITICAL",       val:criticals,               color:"#ff2d55"},
          {label:"GUEST SOS",      val:guestSOS,                color:"#ff9500"},
          {label:"AI CAMERAS",     val:CAMERAS.length,          color:"#30d158"},
          {label:"SYSTEM HEALTH",  val:criticals>2?"DEGRADED":"NOMINAL", color:criticals>2?"#ff9500":"#30d158"},
        ].map((m,i)=>(
          <div key={i} style={{...glass(0.45),padding:"12px 14px",borderTop:`2px solid ${m.color}44`}}>
            <div style={{fontSize:18,fontWeight:700,color:m.color,textShadow:`0 0 12px ${m.color}66`,animation:"countUp 0.4s ease-out"}}>{m.val}</div>
            <div style={{fontSize:7,color:"rgba(255,255,255,0.25)",letterSpacing:1,marginTop:3}}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Main layout */}
      <div style={{flex:1,display:"grid",gridTemplateColumns:"1fr 300px",gap:10,padding:"0 14px 14px",minHeight:0,overflow:"hidden"}}>

        {/* Left: Floor map */}
        <div style={{...glass(0.4),padding:14,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexShrink:0}}>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.35)",letterSpacing:2}}>FLOOR PLAN</div>
            <div style={{display:"flex",gap:6}}>
              {FLOORS.map(f=>(
                <button key={f.id} onClick={()=>setFloor(f.id)} style={{
                  padding:"3px 8px",borderRadius:5,cursor:"pointer",fontSize:8,letterSpacing:1,
                  background:floor===f.id?"rgba(0,200,255,0.15)":"rgba(255,255,255,0.03)",
                  border:`1px solid ${floor===f.id?"#00c8ff":"rgba(255,255,255,0.08)"}`,
                  color:floor===f.id?"#00c8ff":"rgba(255,255,255,0.3)",fontFamily:"'Space Mono',monospace",
                }}>F{f.id}</button>
              ))}
              <button onClick={()=>setShowEvac(v=>!v)} style={{
                padding:"3px 10px",borderRadius:5,cursor:"pointer",fontSize:8,letterSpacing:1,
                background:showEvac?"rgba(48,209,88,0.15)":"rgba(255,255,255,0.03)",
                border:`1px solid ${showEvac?"#30d158":"rgba(255,255,255,0.08)"}`,
                color:showEvac?"#30d158":"rgba(255,255,255,0.3)",fontFamily:"'Space Mono',monospace",
              }}>EVAC {showEvac?"ON":"OFF"}</button>
              <button onClick={()=>setShowAnalytics(v=>!v)} style={{
                padding:"3px 10px",borderRadius:5,cursor:"pointer",fontSize:8,letterSpacing:1,
                background:showAnalytics?"rgba(138,43,226,0.2)":"rgba(255,255,255,0.03)",
                border:`1px solid ${showAnalytics?"rgba(138,43,226,0.7)":"rgba(255,255,255,0.08)"}`,
                color:showAnalytics?"rgba(200,150,255,0.9)":"rgba(255,255,255,0.3)",fontFamily:"'Space Mono',monospace",
              }}>ANALYTICS</button>
            </div>
          </div>

          {showAnalytics ? (
            <AnalyticsPanel alerts={alerts}/>
          ) : (
            <div style={{flex:1,position:"relative",minHeight:0}}>
              <svg viewBox="0 0 100 100" style={{width:"100%",height:"100%",position:"absolute",inset:0}}>
                {/* Background grid */}
                <defs>
                  <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                    <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(0,200,255,0.04)" strokeWidth="0.2"/>
                  </pattern>
                </defs>
                <rect width="100" height="100" fill="url(#grid)"/>

                {/* Floor outline */}
                <rect x="5" y="5" width="90" height="90" rx="2" fill="rgba(0,200,255,0.02)" stroke="rgba(0,200,255,0.12)" strokeWidth="0.5"/>

                {/* Zones */}
                {(FLOOR_ZONES[floor]||[]).map(z=>(
                  <g key={z.id}>
                    <circle cx={z.x} cy={z.y} r="4" fill="rgba(0,200,255,0.03)" stroke="rgba(0,200,255,0.12)" strokeWidth="0.3"/>
                    <text x={z.x} y={z.y+7} textAnchor="middle" fontSize="2.2" fill="rgba(255,255,255,0.2)" fontFamily="Space Mono">{z.label}</text>
                  </g>
                ))}

                {/* Evac route */}
                {showEvac&&EVAC_ROUTES[floor]&&(
                  <polyline
                    points={EVAC_ROUTES[floor]}
                    fill="none" stroke="#30d158" strokeWidth="0.8" strokeDasharray="3,2"
                    style={{animation:"routePulse 1.5s infinite"}}
                  />
                )}

                {/* Alert dots */}
                {floorAlerts.map(a=>{
                  const zone=(FLOOR_ZONES[floor]||[]).find(z=>z.id===a.zone)||(FLOOR_ZONES[floor]||[])[0];
                  if(!zone) return null;
                  const sev=SEVERITY[a.severity];
                  const isSelected=selected?.id===a.id;
                  return(
                    <g key={a.id} style={{cursor:"pointer"}} onClick={()=>setSelected(isSelected?null:a)}>
                      {[1,2,3].map(r=>(
                        <circle key={r} cx={zone.x} cy={zone.y} r={r*3.5}
                          fill="none" stroke={sev.color} strokeWidth="0.3" opacity={0.15/r}
                          style={{animation:`ping ${1+r*0.3}s ${r*0.2}s infinite`}}/>
                      ))}
                      <circle cx={zone.x} cy={zone.y} r={isSelected?3.5:2.5}
                        fill={sev.color} stroke={isSelected?"#fff":"none"} strokeWidth="0.4"
                        style={{filter:`drop-shadow(0 0 4px ${sev.color})`}}/>
                      {isSelected&&(
                        <text x={zone.x} y={zone.y-4} textAnchor="middle" fontSize="2.5" fill="#fff" fontFamily="Space Mono">{ALERT_TYPES[a.type]?.icon}</text>
                      )}
                    </g>
                  );
                })}
                {floorAlerts.length===0&&(
                  <text x="50" y="53" textAnchor="middle" fontSize="3" fill="rgba(48,209,88,0.4)" fontFamily="Space Mono">✓ ALL CLEAR</text>
                )}
              </svg>
            </div>
          )}

          {/* Incident detail panel */}
          {selected&&!showAnalytics&&(
            <div style={{...glass(0.6),padding:14,marginTop:10,border:`1px solid ${SEVERITY[selected.severity]?.color}33`,flexShrink:0,animation:"slideIn 0.3s ease-out"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:22}}>{ALERT_TYPES[selected.type]?.icon}</span>
                  <div>
                    <div style={{fontSize:11,color:SEVERITY[selected.severity]?.color,fontWeight:700,letterSpacing:1}}>{ALERT_TYPES[selected.type]?.label}</div>
                    <div style={{fontSize:8,color:"rgba(255,255,255,0.3)",marginTop:2}}>📍 {selected.location} · Floor {selected.floor} · {fmtElapsed(selected.ts)}</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <Badge color={SEVERITY[selected.severity]?.color}>{SEVERITY[selected.severity]?.label}</Badge>
                  <button onClick={()=>{setSelected(null);setAiRec("");}} style={{background:"none",border:"none",color:"rgba(255,255,255,0.2)",cursor:"pointer",fontSize:12}}>✕</button>
                </div>
              </div>
              {selected.confidence&&(
                <div style={{marginBottom:8}}>
                  <div style={{fontSize:7,color:"rgba(0,200,255,0.5)",marginBottom:3,letterSpacing:1}}>AI CONFIDENCE · {selected.camera}</div>
                  <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,0.08)",overflow:"hidden"}}>
                    <div style={{height:"100%",borderRadius:2,background:"#00c8ff",width:`${selected.confidence*100}%`,transition:"width 0.5s"}}/>
                  </div>
                  <div style={{fontSize:8,color:"rgba(0,200,255,0.6)",marginTop:2}}>{(selected.confidence*100).toFixed(0)}%</div>
                </div>
              )}

              {/* Gemini AI Recommendation */}
              <GeminiPanel text={aiRec} loading={aiLoading} label="🤖 GEMINI AI RECOMMENDATION"/>

              <div style={{display:"flex",gap:8,marginTop:10}}>
                <button onClick={dispatchAlert} style={{flex:1,padding:"7px 0",borderRadius:7,cursor:"pointer",background:"rgba(255,45,85,0.12)",border:"1px solid #ff2d5566",color:"#ff2d55",fontSize:9,letterSpacing:1,fontFamily:"'Space Mono',monospace",transition:"all 0.15s"}}>
                  🚨 DISPATCH
                </button>
                <button onClick={resolveAlert} style={{flex:1,padding:"7px 0",borderRadius:7,cursor:"pointer",background:"rgba(48,209,88,0.12)",border:"1px solid #30d15866",color:"#30d158",fontSize:9,letterSpacing:1,fontFamily:"'Space Mono',monospace",transition:"all 0.15s"}}>
                  ✓ RESOLVE
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Live feed + report button */}
        <div style={{display:"flex",flexDirection:"column",gap:10,minHeight:0}}>

          {/* Report incident button */}
          <button onClick={()=>setShowModal(true)} style={{
            padding:"12px",borderRadius:12,cursor:"pointer",flexShrink:0,
            background:"rgba(255,45,85,0.1)",border:"1px solid #ff2d5588",
            color:"#ff2d55",fontSize:10,letterSpacing:2,fontWeight:700,
            fontFamily:"'Space Mono',monospace",boxShadow:"0 0 20px rgba(255,45,85,0.2)",
            animation:"sosPulse 3s infinite",
          }}>⚠ REPORT INCIDENT</button>

          {/* Feed */}
          <div style={{...glass(0.45),flex:1,display:"flex",flexDirection:"column",minHeight:0,overflow:"hidden"}}>
            <div style={{padding:"10px 12px",borderBottom:"1px solid rgba(255,255,255,0.05)",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:8,color:"rgba(255,255,255,0.25)",letterSpacing:2}}>LIVE EVENT FEED</div>
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:"#30d158",animation:"blink 1.2s infinite"}}/>
                <span style={{fontSize:7,color:"rgba(48,209,88,0.5)",letterSpacing:1}}>LIVE</span>
              </div>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:8}}>
              {active.length===0&&(
                <div style={{textAlign:"center",padding:"30px 0",color:"rgba(48,209,88,0.4)",fontSize:9,letterSpacing:1}}>✅ ALL CLEAR</div>
              )}
              {[...active]
                .sort((a,b)=>(SEVERITY[b.severity]?.priority||0)-(SEVERITY[a.severity]?.priority||0))
                .map(a=>{
                  const sev=SEVERITY[a.severity];
                  const type=ALERT_TYPES[a.type]||{icon:"⚠️",label:a.type};
                  const isSel=selected?.id===a.id;
                  return(
                    <div key={a.id} onClick={()=>{setSelected(isSel?null:a);setAiRec("");}} style={{
                      padding:"9px 10px",marginBottom:6,borderRadius:9,cursor:"pointer",
                      background:isSel?`${sev.color}11`:"rgba(255,255,255,0.02)",
                      border:`1px solid ${isSel?sev.color:sev.color+"22"}`,
                      borderLeft:`3px solid ${sev.color}`,
                      animation:a.isNew?"slideIn 0.4s ease-out":"none",
                      transition:"all 0.15s",
                    }}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:14}}>{type.icon}</span>
                          <span style={{fontSize:9,color:sev.color,fontWeight:700}}>{type.label}</span>
                        </div>
                        <Badge color={sev.color}>{sev.label}</Badge>
                      </div>
                      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                        <span style={{fontSize:7,color:"rgba(255,255,255,0.35)"}}>📍 {a.location}</span>
                        <span style={{fontSize:7,color:"rgba(255,255,255,0.2)"}}>🕐 {fmtElapsed(a.ts)}</span>
                      </div>
                      <div style={{fontSize:7,color:"rgba(255,255,255,0.2)",marginTop:2}}>{a.source==="Guest SOS"?"🆘 Guest":a.source==="Manual"?"👮 Manual":"🤖 AI Camera"}</div>
                      {a.escalated&&<div style={{fontSize:7,color:"#ff2d55",marginTop:3,animation:"pulseGlow 0.8s infinite"}}>⬆ ESCALATED</div>}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* Manual Report Modal */}
      {showModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,backdropFilter:"blur(6px)"}}>
          <div style={{...glass(0.8),padding:24,width:320,border:"1px solid rgba(255,45,85,0.3)",animation:"fadeIn 0.25s ease-out"}}>
            <div style={{fontSize:10,color:"#ff2d55",letterSpacing:2,marginBottom:16,fontWeight:700}}>⚠ REPORT INCIDENT</div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:8,color:"rgba(255,255,255,0.3)",letterSpacing:1,display:"block",marginBottom:5}}>TYPE</label>
              <select value={mType} onChange={e=>setMType(e.target.value)} style={{width:"100%",padding:"7px 10px",borderRadius:7,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"#fff",fontSize:10,fontFamily:"'Space Mono',monospace"}}>
                {Object.entries(ALERT_TYPES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:8,color:"rgba(255,255,255,0.3)",letterSpacing:1,display:"block",marginBottom:5}}>LOCATION</label>
              <select value={mLoc} onChange={e=>setMLoc(e.target.value)} style={{width:"100%",padding:"7px 10px",borderRadius:7,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"#fff",fontSize:10,fontFamily:"'Space Mono',monospace"}}>
                <option value="">Select...</option>
                {ROOMS.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{marginBottom:16}}>
              <label style={{fontSize:8,color:"rgba(255,255,255,0.3)",letterSpacing:1,display:"block",marginBottom:5}}>SEVERITY</label>
              <div style={{display:"flex",gap:6}}>
                {Object.entries(SEVERITY).map(([k,v])=>(
                  <button key={k} onClick={()=>setMSev(k)} style={{flex:1,padding:"5px 0",borderRadius:6,cursor:"pointer",fontSize:7,letterSpacing:1,background:mSev===k?`${v.color}22`:"rgba(255,255,255,0.03)",border:`1px solid ${mSev===k?v.color:"rgba(255,255,255,0.08)"}`,color:mSev===k?v.color:"rgba(255,255,255,0.3)",fontFamily:"'Space Mono',monospace"}}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setShowModal(false)} style={{flex:1,padding:"8px 0",borderRadius:7,cursor:"pointer",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.3)",fontSize:9,fontFamily:"'Space Mono',monospace"}}>CANCEL</button>
              <button onClick={submitManual} disabled={!mLoc} style={{flex:1,padding:"8px 0",borderRadius:7,cursor:mLoc?"pointer":"not-allowed",background:mLoc?"rgba(255,45,85,0.15)":"rgba(255,255,255,0.03)",border:`1px solid ${mLoc?"#ff2d55":"rgba(255,255,255,0.08)"}`,color:mLoc?"#ff2d55":"rgba(255,255,255,0.2)",fontSize:9,fontFamily:"'Space Mono',monospace"}}>SUBMIT</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ANALYTICS PANEL
// ══════════════════════════════════════════════════════════════════════════════
function AnalyticsPanel({alerts}){
  const [geminiReport,setGeminiReport] = useState("");
  const [reportLoading,setReportLoading] = useState(false);
  const [reportFetched,setReportFetched] = useState(false);

  const bySeverity = useMemo(()=>
    Object.entries(SEVERITY).map(([k,v])=>({label:v.label,count:alerts.filter(a=>a.severity===k).length,color:v.color}))
  ,[alerts]);

  const byType = useMemo(()=>
    Object.entries(ALERT_TYPES).map(([k,v])=>({label:v.icon+" "+v.label,count:alerts.filter(a=>a.type===k).length,color:"#00c8ff"}))
      .filter(x=>x.count>0).sort((a,b)=>b.count-a.count).slice(0,5)
  ,[alerts]);

  const maxSev = Math.max(...bySeverity.map(x=>x.count),1);
  const maxType= Math.max(...byType.map(x=>x.count),1);

  async function fetchReport(){
    setReportLoading(true);
    setReportFetched(true);
    const report = await getEmergencySummary(alerts);
    setGeminiReport(report);
    setReportLoading(false);
  }

  return(
    <div style={{flex:1,overflowY:"auto",display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,padding:4}}>
      {/* By Severity */}
      <div style={{...glass(0.4),padding:14}}>
        <div style={{fontSize:8,color:"rgba(255,255,255,0.25)",letterSpacing:2,marginBottom:12}}>BY SEVERITY</div>
        {bySeverity.map((s,i)=>(
          <div key={i} style={{marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
              <span style={{fontSize:8,color:s.color}}>{s.label}</span>
              <span style={{fontSize:8,color:"rgba(255,255,255,0.4)"}}>{s.count}</span>
            </div>
            <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,0.06)"}}>
              <div style={{height:"100%",borderRadius:2,background:s.color,width:`${(s.count/maxSev)*100}%`,transition:"width 0.5s"}}/>
            </div>
          </div>
        ))}
      </div>

      {/* By Type */}
      <div style={{...glass(0.4),padding:14}}>
        <div style={{fontSize:8,color:"rgba(255,255,255,0.25)",letterSpacing:2,marginBottom:12}}>TOP THREATS</div>
        {byType.length===0&&<div style={{fontSize:9,color:"rgba(255,255,255,0.2)"}}>No data</div>}
        {byType.map((t,i)=>(
          <div key={i} style={{marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
              <span style={{fontSize:8,color:"rgba(255,255,255,0.55)"}}>{t.label}</span>
              <span style={{fontSize:8,color:"rgba(255,255,255,0.4)"}}>{t.count}</span>
            </div>
            <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,0.06)"}}>
              <div style={{height:"100%",borderRadius:2,background:"#00c8ff",width:`${(t.count/maxType)*100}%`,transition:"width 0.5s"}}/>
            </div>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div style={{...glass(0.4),padding:14}}>
        <div style={{fontSize:8,color:"rgba(255,255,255,0.25)",letterSpacing:2,marginBottom:10}}>RESPONSE METRICS</div>
        {[
          {label:"Total Alerts",   val:alerts.length},
          {label:"Resolved",       val:alerts.filter(a=>a.resolved).length},
          {label:"Active",         val:alerts.filter(a=>!a.resolved).length},
          {label:"Escalated",      val:alerts.filter(a=>a.escalated).length},
          {label:"Guest SOS",      val:alerts.filter(a=>a.source==="Guest SOS").length},
        ].map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
            <span style={{fontSize:8,color:"rgba(255,255,255,0.3)"}}>{m.label}</span>
            <span style={{fontSize:9,color:"#fff",fontWeight:700}}>{m.val}</span>
          </div>
        ))}
      </div>

      {/* Gemini AI Threat Report */}
      <div style={{...glass(0.4),padding:14}}>
        <div style={{fontSize:8,color:"rgba(255,255,255,0.25)",letterSpacing:2,marginBottom:10}}>GEMINI AI REPORT</div>
        {!reportFetched?(
          <button onClick={fetchReport} style={{
            width:"100%",padding:"10px",borderRadius:8,cursor:"pointer",
            background:"linear-gradient(135deg,rgba(138,43,226,0.2),rgba(75,0,130,0.25))",
            border:"1px solid rgba(138,43,226,0.4)",
            color:"rgba(200,150,255,0.9)",fontSize:9,letterSpacing:1,
            fontFamily:"'Space Mono',monospace",
          }}>✨ Generate AI Threat Assessment</button>
        ):(
          <GeminiPanel text={geminiReport} loading={reportLoading} label="✨ THREAT ASSESSMENT"/>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EMERGENCY SERVICES PANEL
// ══════════════════════════════════════════════════════════════════════════════
function EmergencyPanel({onBack,alerts}){
  const [filter,setFilter]         = useState("all");
  const [,setTick]                 = useState(0);
  const [geminiSummary,setGeminiSummary] = useState("");
  const [summaryLoading,setSummaryLoading] = useState(false);
  const [summaryFetched,setSummaryFetched] = useState(false);

  useEffect(()=>{ const t=setInterval(()=>setTick(x=>x+1),10000); return()=>clearInterval(t); },[]);

  const filtered   = filter==="all" ? alerts : alerts.filter(a=>a.severity===filter);
  const criticals  = alerts.filter(a=>a.severity==="critical").length;
  const sos        = alerts.filter(a=>a.source==="Guest SOS").length;
  const escalated  = alerts.filter(a=>a.escalated).length;

  async function fetchSummary(){
    setSummaryLoading(true);
    setSummaryFetched(true);
    const s = await getEmergencySummary(alerts);
    setGeminiSummary(s);
    setSummaryLoading(false);
  }

  return(
    <div style={{minHeight:"100vh",background:"radial-gradient(ellipse at 50% 0%,#1a0005 0%,#0d0003 50%,#000 100%)",fontFamily:"'Space Mono',monospace",color:"#fff",display:"flex",flexDirection:"column"}}>
      <style>{GLOBAL_CSS}</style>

      {/* Header */}
      <div style={{padding:"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(255,45,85,0.2)",background:"rgba(255,45,85,0.04)",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={onBack} style={{background:"none",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:10,padding:"4px 10px",borderRadius:6,fontFamily:"'Space Mono',monospace"}}>← ROLES</button>
          <div style={{fontSize:10,color:"#ff2d55",letterSpacing:3,fontWeight:700}}>🚒 EMERGENCY SERVICES LIVE FEED</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {/* Gemini badge */}
          <div style={{fontSize:8,color:"rgba(138,43,226,0.7)",letterSpacing:1,padding:"2px 8px",borderRadius:4,border:"1px solid rgba(138,43,226,0.3)",background:"rgba(138,43,226,0.05)"}}>✨ GEMINI AI</div>
          {escalated>0&&<div style={{fontSize:9,color:"#ff2d55",padding:"2px 8px",borderRadius:5,border:"1px solid #ff2d5566",animation:"pulseGlow 0.8s infinite"}}>⬆ {escalated} ESCALATED</div>}
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:"#ff2d55",animation:"blink 0.8s infinite"}}/>
            <span style={{fontSize:9,color:"rgba(255,45,85,0.7)",letterSpacing:1}}>LIVE SYNC</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.05)",flexShrink:0}}>
        {[
          {label:"TOTAL",    value:alerts.length,       color:"#fff"    },
          {label:"CRITICAL", value:criticals,           color:"#ff2d55" },
          {label:"ESCALATED",value:escalated,           color:"#ff2d55" },
          {label:"GUEST SOS",value:sos,                 color:"#ff9500" },
          {label:"AI ALERTS",value:alerts.length-sos,   color:"#00c8ff" },
        ].map((s,i)=>(
          <div key={i} style={{flex:1,padding:"13px 10px",textAlign:"center",borderRight:i<4?"1px solid rgba(255,255,255,0.05)":"none",background:"rgba(255,255,255,0.01)"}}>
            <div style={{fontSize:20,fontWeight:700,color:s.color,textShadow:`0 0 10px ${s.color}55`,animation:"countUp 0.5s ease-out"}}>{s.value}</div>
            <div style={{fontSize:7,color:"rgba(255,255,255,0.25)",letterSpacing:1,marginTop:2}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Gemini Situation Summary */}
      <div style={{padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,0.05)",flexShrink:0}}>
        {!summaryFetched?(
          <button onClick={fetchSummary} style={{
            padding:"7px 16px",borderRadius:7,cursor:"pointer",
            background:"linear-gradient(135deg,rgba(138,43,226,0.15),rgba(75,0,130,0.2))",
            border:"1px solid rgba(138,43,226,0.35)",
            color:"rgba(200,150,255,0.9)",fontSize:8,letterSpacing:1,
            fontFamily:"'Space Mono',monospace",
          }}>✨ Get Gemini AI Situation Briefing</button>
        ):(
          <GeminiPanel text={geminiSummary} loading={summaryLoading} label="✨ GEMINI AI SITUATION BRIEFING FOR RESPONDERS"/>
        )}
      </div>

      {/* Filter */}
      <div style={{display:"flex",gap:6,padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,0.05)",flexShrink:0,alignItems:"center"}}>
        <span style={{fontSize:8,color:"rgba(255,255,255,0.25)",letterSpacing:1,marginRight:4}}>FILTER:</span>
        {["all","critical","high","medium","low"].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{
            padding:"4px 10px",borderRadius:5,cursor:"pointer",fontSize:8,letterSpacing:1,fontFamily:"'Space Mono',monospace",
            background:filter===f?(f==="all"?"rgba(255,255,255,0.12)":`${SEVERITY[f]?.color}22`):"rgba(255,255,255,0.03)",
            border:`1px solid ${filter===f?(f==="all"?"rgba(255,255,255,0.25)":SEVERITY[f]?.color):"rgba(255,255,255,0.08)"}`,
            color:filter===f?(f==="all"?"#fff":SEVERITY[f]?.color):"rgba(255,255,255,0.35)",
          }}>{f.toUpperCase()}</button>
        ))}
      </div>

      {/* Alert list */}
      <div style={{flex:1,overflowY:"auto",padding:14}}>
        {filtered.length===0&&<div style={{textAlign:"center",color:"rgba(48,209,88,0.5)",fontSize:11,marginTop:40,letterSpacing:1}}>✅ NO INCIDENTS IN THIS FILTER</div>}
        {[...filtered].sort((a,b)=>(SEVERITY[b.severity]?.priority||0)-(SEVERITY[a.severity]?.priority||0)).map(a=>{
          const sev=SEVERITY[a.severity];
          const type=ALERT_TYPES[a.type]||{icon:"⚠️",label:a.type};
          return(
            <div key={a.id} style={{padding:"14px 16px",marginBottom:10,borderRadius:12,background:"rgba(255,255,255,0.02)",border:`1px solid ${sev.color}22`,borderLeft:`3px solid ${sev.color}`,animation:a.isNew?"slideIn 0.4s ease-out":"none"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:22}}>{type.icon}</span>
                  <div>
                    <div style={{fontSize:12,color:sev.color,fontWeight:700,letterSpacing:1}}>{type.label}</div>
                    <div style={{fontSize:8,color:"rgba(255,255,255,0.35)",marginTop:2}}>{a.source==="Guest SOS"?"🆘 Guest Reported":a.source==="Manual"?"👮 Staff Manual":"🤖 AI Camera"}</div>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <Badge color={sev.color}>{sev.label}</Badge>
                  <div style={{fontSize:8,color:"rgba(255,255,255,0.25)",marginTop:4}}>{fmtElapsed(a.ts)}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                <span style={{fontSize:9,color:"rgba(255,255,255,0.45)"}}>📍 {a.location}</span>
                <span style={{fontSize:9,color:"rgba(255,255,255,0.3)"}}>🏢 Floor {a.floor}</span>
                <span style={{fontSize:9,color:"rgba(255,255,255,0.25)"}}>🕐 {fmtTime(a.ts)}</span>
                <span style={{fontSize:9,color:"rgba(255,255,255,0.2)"}}>ID #{String(a.id).padStart(4,"0")}</span>
                {a.confidence&&<span style={{fontSize:9,color:"rgba(0,200,255,0.5)"}}>🤖 {(a.confidence*100).toFixed(0)}% conf</span>}
              </div>
              {a.escalated&&<div style={{marginTop:6,fontSize:8,color:"#ff2d55",animation:"pulseGlow 1s infinite"}}>⬆ AUTO-ESCALATED — CRITICAL UNRESOLVED &gt;2 MINUTES</div>}
            </div>
          );
        })}
      </div>

      <div style={{padding:"8px 14px",borderTop:"1px solid rgba(255,255,255,0.05)",textAlign:"center",fontSize:7,color:"rgba(255,255,255,0.12)",letterSpacing:1}}>
        READ-ONLY · AUTHORIZED EMERGENCY PERSONNEL ONLY · POWERED BY GOOGLE GEMINI AI
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ROOT APP ROUTER
// ══════════════════════════════════════════════════════════════════════════════
export default function App(){
  const [view,setView]     = useState("role");
  const [alerts,setAlerts] = useState(SEED_ALERTS);
  const nextId = useRef(200);

  const addAlert = useCallback((payload)=>{
    const a={id:nextId.current++,...payload,ts:Date.now(),isNew:true,resolved:false,escalated:false};
    if(a.severity==="critical"||a.source==="Guest SOS") playAlertSound(ALERT_TYPES[a.type]?.sound||880,0.5);
    setAlerts(prev=>[a,...prev].slice(0,100));
    setTimeout(()=>setAlerts(prev=>prev.map(x=>x.id===a.id?{...x,isNew:false}:x)),800);
  },[]);

  // AI patrol loop (simulates camera feeds)
  useEffect(()=>{
    const TYPES=Object.keys(ALERT_TYPES).filter(k=>k!=="sos");
    const loop=setInterval(()=>{
      const floorId=randItem([1,2,3,4]);
      const zones=FLOOR_ZONES[floorId];
      const zone=randItem(zones);
      const typeKey=randItem(TYPES);
      const sevKey=randItem(["critical","high","high","medium","medium","low"]);
      addAlert({
        type:typeKey,location:zone.label,severity:sevKey,
        zone:zone.id,floor:floorId,source:"AI Camera",
        camera:randItem(CAMERAS),confidence:randFloat(0.60,0.99),
      });
    },Math.random()*12000+10000);
    return()=>clearInterval(loop);
  },[addAlert]);

  if(view==="role")      return <RoleSelector onSelect={setView}/>;
  if(view==="guest")     return <GuestSOS onBack={()=>setView("role")} onAlert={addAlert}/>;
  if(view==="staff")     return <StaffDashboard onBack={()=>setView("role")} alerts={alerts} setAlerts={setAlerts}/>;
  if(view==="emergency") return <EmergencyPanel onBack={()=>setView("role")} alerts={alerts}/>;
  return null;
}