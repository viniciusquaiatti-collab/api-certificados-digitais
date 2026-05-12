"use client";

// ============================================================
// 🔐 NexaSpark — /login/page.tsx v5.0 STRATEGIC
//
// HISTÓRICO COMPLETO — acumulativo, nunca regressivo:
//   v4.0 → Canvas partículas, layout split, floating labels,
//           password strength, clock, shimmer Google
//   v4.1 → useIsMobile hook, conditional render, única <style>
//   v4.2 → Terminal extraído, desktop height:100vh, terminal mobile
//   v4.3 → Stats mobile, badge SSL, barra acento, typing terminal,
//           separador gradiente, botão WhatsApp pill, quote confiança
//   v5.0 → REFACTOR ESTRATÉGICO (tudo preservado + elevado):
//           • Terminal vira "Presence Engine" — frases rotativas de
//             confiança/segurança, nunca expõe dados técnicos internos
//           • Copy reescrita: autoridade + pertencimento, não marketing
//           • Hero desktop: identidade visual renovada com selo de confiança
//           • Mobile: experiência focada, hierarquia premium
//           • Animação de entrada: stagger cinematográfico aprimorado
//           • Inputs: fundo mais escuro, contraste elevado
//           • Botão submit: mais sólido, menos ghostly
// ============================================================

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ============================================================
// 🏢 LOGGER — Enterprise Grade | NexaSpark Login v5.0
// ============================================================
const LOG_PREFIX = "[NexaSpark:Login:v5.0]";
const logger = {
  info:    (s: string, m: string, d?: any) => console.log(`%c${LOG_PREFIX} ℹ️  [${s}]%c ${m}`, "color:#60a5fa;font-weight:bold;", "color:inherit;", d ?? ""),
  success: (s: string, m: string, d?: any) => console.log(`%c${LOG_PREFIX} ✅ [${s}]%c ${m}`, "color:#34d399;font-weight:bold;", "color:inherit;", d ?? ""),
  warn:    (s: string, m: string, d?: any) => console.warn(`%c${LOG_PREFIX} ⚠️  [${s}]%c ${m}`, "color:#fbbf24;font-weight:bold;", "color:inherit;", d ?? ""),
  error:   (s: string, m: string, d?: any) => console.error(`%c${LOG_PREFIX} ❌ [${s}]%c ${m}`, "color:#f87171;font-weight:bold;", "color:inherit;", d ?? ""),
  perf:    (s: string, l: string, ms: number) => console.log(`%c${LOG_PREFIX} ⏱️  [${s}]%c ${l} — ${ms.toFixed(2)}ms`, "color:#a78bfa;font-weight:bold;", "color:inherit;"),
  event:   (s: string, a: string, d?: any) => console.log(`%c${LOG_PREFIX} 🎯 [${s}]%c ACTION → ${a}`, "color:#f472b6;font-weight:bold;", "color:inherit;", d ?? ""),
  auth:    (m: string, d?: any) => console.log(`%c${LOG_PREFIX} 🔐 [AUTH]%c ${m}`, "color:#c084fc;font-weight:bold;", "color:inherit;", d ?? ""),
  oauth:   (m: string, d?: any) => console.log(`%c${LOG_PREFIX} 🌐 [OAUTH]%c ${m}`, "color:#22d3ee;font-weight:bold;", "color:inherit;", d ?? ""),
  nav:     (d: string) => console.log(`%c${LOG_PREFIX} 🧭 [NAV]%c → ${d}`, "color:#fb923c;font-weight:bold;", "color:inherit;"),
  mount:   (c: string) => console.log(`%c${LOG_PREFIX} 🔧 [MOUNT]%c <${c}>`, "color:#38bdf8;font-weight:bold;", "color:inherit;"),
  unmount: (c: string) => console.log(`%c${LOG_PREFIX} 🗑️  [UNMOUNT]%c <${c}>`, "color:#94a3b8;font-weight:bold;", "color:inherit;"),
  canvas:  (m: string, d?: any) => console.log(`%c${LOG_PREFIX} 🖼️  [CANVAS]%c ${m}`, "color:#93c5fd;font-weight:bold;", "color:inherit;", d ?? ""),
  sep:     () => console.log("%c" + "─".repeat(60), "color:#374151;"),
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  google_auth_failed:  "Autenticação com Google falhou. Tente novamente.",
  oauth_failed:        "Erro no fluxo OAuth. Tente novamente.",
  oauth_invalid_user:  "Perfil Google inválido. Tente com outra conta.",
  oauth_server_error:  "Erro interno no servidor OAuth. Tente mais tarde.",
  user_not_found:      "Usuário não encontrado após autenticação Google.",
  token_error:         "Erro ao gerar sessão. Tente novamente.",
  invalid_token:       "Token inválido recebido. Tente novamente.",
  NO_USER:             "Perfil do Google não disponível. Tente com outra conta.",
};

// ============================================================
// 📱 useIsMobile — v4.1, intacto
// ============================================================
function useIsMobile(bp = 768): boolean {
  const [v, setV] = useState<boolean | null>(null);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${bp}px)`);
    setV(mql.matches);
    const h = (e: MediaQueryListEvent) => {
      setV(e.matches);
      logger.info("RESPONSIVE", "Breakpoint", { isMobile: e.matches });
    };
    mql.addEventListener("change", h);
    return () => mql.removeEventListener("change", h);
  }, [bp]);
  return v ?? false;
}

// ============================================================
// 🟢 PRESENCE ENGINE — v5.0 NEW
// Terminal estratégico: frases de confiança rotativas.
// NUNCA expõe dados técnicos internos (SHA-256, blockchain, etc).
// Objetivo: criar senso de sistema vivo aguardando o usuário.
// ============================================================

// Frases estratégicas — confiança, segurança, pertencimento
const PRESENCE_MESSAGES = [
  { text: "Sistema seguro. Aguardando sua autenticação.",      color: "#34d399" },
  { text: "Seus certificados estão protegidos e prontos.",      color: "#34d399" },
  { text: "Conexão criptografada estabelecida.",               color: "#60a5fa" },
  { text: "Pronto para emitir. Faça login para continuar.",    color: "#34d399" },
  { text: "Ambiente isolado e monitorado. Acesso seguro.",     color: "#a78bfa" },
  { text: "Plataforma operacional. Bem-vindo de volta.",       color: "#34d399" },
];

function PresenceEngine() {
  const [lines, setLines]     = useState<typeof PRESENCE_MESSAGES>([]);
  const [typing, setTyping]   = useState(false);
  const [msgIdx, setMsgIdx]   = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [displayed, setDisplayed] = useState("");

  // Rotação de mensagens com efeito typing
  useEffect(() => {
    const msg = PRESENCE_MESSAGES[msgIdx].text;

    if (charIdx < msg.length) {
      setTyping(true);
      const t = setTimeout(() => {
        setDisplayed(msg.slice(0, charIdx + 1));
        setCharIdx(c => c + 1);
      }, 38);
      return () => clearTimeout(t);
    } else {
      setTyping(false);
      // Após terminar de digitar, aguarda e avança para próxima mensagem
      const t = setTimeout(() => {
        const color = PRESENCE_MESSAGES[msgIdx].color;
        setLines(prev => [...prev.slice(-3), { text: displayed, color }]);
        const next = (msgIdx + 1) % PRESENCE_MESSAGES.length;
        setMsgIdx(next);
        setCharIdx(0);
        setDisplayed("");
      }, 2800);
      return () => clearTimeout(t);
    }
  }, [charIdx, msgIdx, displayed]);

  const currentColor = PRESENCE_MESSAGES[msgIdx].color;

  return (
    <div style={{
      borderRadius: 14,
      border: "1px solid rgba(16,185,129,0.15)",
      background: "rgba(4,7,14,0.95)",
      backdropFilter: "blur(20px)",
      overflow: "hidden",
      boxShadow: "0 0 40px rgba(16,185,129,0.06), inset 0 1px 0 rgba(16,185,129,0.08)",
    }}>
      {/* Title bar */}
      <div style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 14px", borderBottom:"1px solid rgba(16,185,129,0.08)", background:"rgba(16,185,129,0.03)" }}>
        {["#f87171","#fbbf24","#34d399"].map((c,i)=>(
          <div key={i} style={{ width:8, height:8, borderRadius:"50%", background:c, opacity:0.75 }}/>
        ))}
        <span style={{ fontSize:9, color:"rgba(255,255,255,0.18)", marginLeft:8, fontFamily:"monospace", letterSpacing:"0.06em" }}>
          nexaspark — sistema
        </span>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:5 }}>
          <div style={{ width:5, height:5, borderRadius:"50%", background:"#10b981", animation:"blink 1s ease infinite" }}/>
          <span style={{ fontSize:8, color:"rgba(16,185,129,0.6)", fontFamily:"monospace", letterSpacing:"0.12em" }}>ONLINE</span>
        </div>
      </div>

      {/* Lines history */}
      <div style={{ padding:"12px 16px", display:"flex", flexDirection:"column", gap:6, minHeight:100 }}>
        {lines.map((l,i)=>(
          <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", opacity: 0.45 + (i / lines.length) * 0.35 }}>
            <span style={{ color:"rgba(255,255,255,0.15)", fontSize:10, fontFamily:"monospace", flexShrink:0, marginTop:1 }}>›</span>
            <span style={{ color:"rgba(255,255,255,0.3)", fontSize:10, fontFamily:"monospace", lineHeight:1.5 }}>{l.text}</span>
          </div>
        ))}

        {/* Linha ativa com typing */}
        <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
          <span style={{ color:currentColor, fontSize:10, fontFamily:"monospace", flexShrink:0, marginTop:1 }}>$</span>
          <span style={{ fontSize:10, fontFamily:"monospace", lineHeight:1.5, color:currentColor, opacity:0.9 }}>
            {displayed}
            <span style={{
              display:"inline-block", width:6, height:11,
              background:currentColor, borderRadius:1,
              marginLeft:2, verticalAlign:"middle",
              animation:"cursor-blink 1.05s ease infinite",
              opacity: typing ? 1 : 0.4,
            }}/>
          </span>
        </div>
      </div>
    </div>
  );
}

// Versão compacta para mobile
function PresenceEngineCompact() {
  const [text, setText]   = useState("");
  const [idx, setIdx]     = useState(0);
  const [char, setChar]   = useState(0);
  const [done, setDone]   = useState(false);

  useEffect(() => {
    const msg = PRESENCE_MESSAGES[idx].text;
    if (char < msg.length) {
      const t = setTimeout(() => { setText(msg.slice(0, char+1)); setChar(c=>c+1); }, 40);
      return () => clearTimeout(t);
    } else {
      setDone(true);
      const t = setTimeout(() => {
        setIdx(i=>(i+1)%PRESENCE_MESSAGES.length);
        setChar(0); setText(""); setDone(false);
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [char, idx]);

  const color = PRESENCE_MESSAGES[idx].color;

  return (
    <div style={{
      borderRadius:12,
      border:`1px solid ${color}26`,
      background:"rgba(4,7,14,0.92)",
      backdropFilter:"blur(16px)",
      overflow:"hidden",
      boxShadow:`0 0 30px ${color}0a`,
    }}>
      {/* Title bar */}
      <div style={{ display:"flex", alignItems:"center", gap:5, padding:"8px 13px", borderBottom:`1px solid ${color}10`, background:`${color}06` }}>
        {["#f87171","#fbbf24","#34d399"].map((c,i)=>(
          <div key={i} style={{ width:7, height:7, borderRadius:"50%", background:c, opacity:0.75 }}/>
        ))}
        <span style={{ fontSize:9, color:"rgba(255,255,255,0.15)", marginLeft:6, fontFamily:"monospace", letterSpacing:"0.05em" }}>nexaspark — sistema</span>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:4 }}>
          <div style={{ width:4, height:4, borderRadius:"50%", background:"#10b981", animation:"blink 1s ease infinite" }}/>
          <span style={{ fontSize:8, color:"rgba(16,185,129,0.5)", fontFamily:"monospace", letterSpacing:"0.1em" }}>ONLINE</span>
        </div>
      </div>

      {/* Linha ativa */}
      <div style={{ padding:"11px 14px", display:"flex", gap:9, alignItems:"flex-start" }}>
        <span style={{ color, fontSize:10, fontFamily:"monospace", flexShrink:0, marginTop:1 }}>$</span>
        <span style={{ fontSize:10, fontFamily:"monospace", color, lineHeight:1.6, flex:1 }}>
          {text}
          <span style={{
            display:"inline-block", width:5, height:10,
            background:color, borderRadius:1, marginLeft:2, verticalAlign:"middle",
            animation:"cursor-blink 1.05s ease infinite",
          }}/>
        </span>
      </div>
    </div>
  );
}

// ============================================================
// 🖼️  CANVAS — Partículas (v4.0, intacto)
// ============================================================
function ParticleCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    logger.canvas("Canvas iniciado");
    let id: number, W=0, H=0;
    type P = { x:number;y:number;vx:number;vy:number;r:number;alpha:number;pulse:number;speed:number };
    let pts: P[] = [];
    const resize = () => { W=c.width=window.innerWidth; H=c.height=window.innerHeight; };
    const spawn = (): P => ({ x:Math.random()*W, y:Math.random()*H, vx:(Math.random()-.5)*.28, vy:(Math.random()-.5)*.28, r:Math.random()*1.4+.4, alpha:Math.random()*.35+.04, pulse:Math.random()*Math.PI*2, speed:Math.random()*.012+.004 });
    const draw = () => {
      ctx.clearRect(0,0,W,H);
      pts.forEach((p,i)=>{
        p.x+=p.vx; p.y+=p.vy; p.pulse+=p.speed;
        if(p.x<-5)p.x=W+5; if(p.x>W+5)p.x=-5; if(p.y<-5)p.y=H+5; if(p.y>H+5)p.y=-5;
        const a=p.alpha*(0.6+0.4*Math.sin(p.pulse));
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fillStyle=`rgba(16,185,129,${a})`; ctx.fill();
        for(let j=i+1;j<pts.length;j++){
          const q=pts[j], dx=p.x-q.x, dy=p.y-q.y, d=Math.sqrt(dx*dx+dy*dy);
          if(d<110){ ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y); ctx.strokeStyle=`rgba(16,185,129,${.055*(1-d/110)})`; ctx.lineWidth=.5; ctx.stroke(); }
        }
      });
      id=requestAnimationFrame(draw);
    };
    resize(); pts=Array.from({length:45},spawn); draw();
    window.addEventListener("resize",resize);
    return ()=>{ cancelAnimationFrame(id); window.removeEventListener("resize",resize); logger.canvas("Canvas destruído"); };
  },[]);
  return <canvas ref={ref} style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, opacity:.5 }}/>;
}

// ============================================================
// 🕐 useClock (v4.0)
// ============================================================
function useClock() {
  const [t,setT]=useState("");
  useEffect(()=>{
    const f=()=>new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
    setT(f()); const id=setInterval(()=>setT(f()),1000); return()=>clearInterval(id);
  },[]);
  return t;
}

// ============================================================
// 🔒 Password strength (v4.0)
// ============================================================
function getPwStrength(p:string){
  if(!p)          return{level:0,label:"",      color:"transparent"};
  if(p.length<6)  return{level:1,label:"Fraca", color:"#f87171"};
  if(p.length<10) return{level:2,label:"Média", color:"#fbbf24"};
  if(p.length<14) return{level:3,label:"Boa",   color:"#34d399"};
  return           {level:4,label:"Forte",       color:"#10b981"};
}

// ============================================================
// ⏳ Fallback
// ============================================================
function LoginLoading(){
  return(
    <div style={{minHeight:"100vh",background:"#050810",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{position:"relative",width:36,height:36}}>
        <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"1.5px solid transparent",borderTopColor:"#10b981",animation:"spin .8s linear infinite"}}/>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ============================================================
// 🔐 LOGIN INNER
// ============================================================
function LoginInner(){
  const router       = useRouter();
  const searchParams = useSearchParams();
  const clock        = useClock();
  const isMobile     = useIsMobile(768);

  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [showPass,     setShowPass]     = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [loadGoogle,   setLoadGoogle]   = useState(false);
  const [error,        setError]        = useState("");
  const [focused,      setFocused]      = useState<"email"|"password"|null>(null);
  const [attempts,     setAttempts]     = useState(0);
  const [mounted,      setMounted]      = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const t0       = useRef(0);
  const pw       = getPwStrength(password);

  useEffect(()=>{ const t=setTimeout(()=>setMounted(true),80); return()=>clearTimeout(t); },[]);

  useEffect(()=>{
    logger.sep(); logger.mount("LoginInner v5.0");
    logger.info("INIT","Login v5.0 carregado",{apiUrl:API_URL,ts:new Date().toISOString(),version:"5.0.0"});
    const oe=searchParams.get("error");
    if(oe){ logger.oauth("Erro OAuth",{error:oe}); setError(OAUTH_ERROR_MESSAGES[oe]||`Erro: ${oe}`); window.history.replaceState({},"","/login"); }
    const tok=localStorage.getItem("token");
    if(tok){
      try{
        const p=JSON.parse(atob(tok.split(".")[1]));
        const expired=Date.now()>p.exp*1000;
        logger.auth("Token encontrado",{email:p.email,expired,provider:p.auth_provider||"local"});
        if(expired){ localStorage.removeItem("token"); }
        else{ logger.nav("/dashboard"); router.replace("/dashboard"); return; }
      }catch{ localStorage.removeItem("token"); }
    }
    const ft=setTimeout(()=>{ emailRef.current?.focus(); logger.info("UX","Focus email"); },700);
    return()=>{ clearTimeout(ft); logger.unmount("LoginInner v5.0"); logger.sep(); };
  },[]);

  function validate():string|null{
    if(!email.trim())               return "Informe seu e-mail.";
    if(!/\S+@\S+\.\S+/.test(email)) return "E-mail inválido.";
    if(!password)                   return "Informe sua senha.";
    if(password.length<8)          return "Senha deve ter no mínimo 8 caracteres.";
    return null;
  }

  async function handleSubmit(e:React.FormEvent){
    e.preventDefault(); setError("");
    const ve=validate(); if(ve){ setError(ve); return; }
    t0.current=performance.now(); setLoading(true); setAttempts(n=>n+1);
    logger.sep(); logger.auth("Login iniciado",{email:email.trim().toLowerCase(),attempt:attempts+1});
    try{
      const tf=performance.now();
      const res=await fetch(`${API_URL}/api/auth/login`,{
        method:"POST",
        headers:{"Content-Type":"application/json","X-Request-ID":`login_${Date.now()}_${Math.random().toString(36).slice(2,6)}`},
        body:JSON.stringify({email:email.trim().toLowerCase(),password}),
      });
      logger.perf("AUTH:HTTP","Resposta",performance.now()-tf);
      logger.info("AUTH:HTTP","Status",{status:res.status,ok:res.ok});
      let data:any={};
      try{ data=await res.json(); logger.info("AUTH:PARSE","Body",{hasToken:!!(data.token||data.data?.token),keys:Object.keys(data)}); }
      catch(pe){ logger.error("AUTH:PARSE","JSON inválido",{pe:String(pe)}); throw new Error("Resposta inválida"); }
      if(!res.ok){
        const msg=typeof data?.error==="string"?data.error:typeof data?.message==="string"?data.message:
          Array.isArray(data?.errors)?data.errors.map((e:any)=>e.message||e).join(" • "):"Credenciais inválidas.";
        logger.warn("AUTH","Rejeitado",{status:res.status,code:data?.code,msg});
        if(data?.code==="OAUTH_ACCOUNT_NO_PASSWORD") logger.oauth("Conta OAuth sem senha local",{provider:data?.provider});
        setError(msg); setLoading(false); return;
      }
      const token=data.token||data.data?.token;
      if(!token){ setError("Erro inesperado — tente novamente."); setLoading(false); return; }
      try{
        const p=JSON.parse(atob(token.split(".")[1]));
        logger.auth("Token decodificado",{userId:p.id,email:p.email,provider:p.auth_provider||"local",expiresAt:new Date(p.exp*1000).toISOString(),tokenSize:token.length});
      }catch{ logger.warn("AUTH","Token não decodificável para log"); }
      localStorage.setItem("token",token); document.cookie=`token=${token}; path=/; SameSite=Lax`;
      logger.success("AUTH","Token armazenado ✅");
      logger.perf("LOGIN:FLOW","Completo",performance.now()-t0.current);
      logger.nav("/dashboard"); logger.sep();
      router.replace("/dashboard");
    }catch(err:any){
      logger.error("AUTH:NETWORK",`Erro — ${err.message}`,{type:err.name});
      setError("Não foi possível conectar ao servidor. Verifique sua conexão.");
      setLoading(false);
    }
  }

  function handleGoogle(){
    logger.sep(); logger.oauth("OAuth Google iniciado",{endpoint:`${API_URL}/api/auth/google`});
    setLoadGoogle(true); logger.event("AUTH:GOOGLE","Clicou Google OAuth");
    setTimeout(()=>{ logger.oauth("Redirecionando",{url:`${API_URL}/api/auth/google`}); window.location.href=`${API_URL}/api/auth/google`; },150);
  }

  const fadeIn=(delay=0):React.CSSProperties=>({
    opacity:mounted?1:0,
    transform:mounted?"translateY(0)":"translateY(18px)",
    transition:`opacity .6s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform .6s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
  });

  const ClockBadge=()=>(
    <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 11px",borderRadius:20,background:"rgba(16,185,129,0.05)",border:"1px solid rgba(16,185,129,0.12)"}}>
      <div style={{width:5,height:5,borderRadius:"50%",background:"#10b981",animation:"blink 1.2s ease infinite"}}/>
      <span style={{fontSize:10,color:"rgba(16,185,129,0.7)",fontFamily:"monospace",letterSpacing:"0.05em"}}>{clock}</span>
    </div>
  );

  // ============================================================
  // 🎨 RENDER
  // ============================================================
  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

        @keyframes spin          { to{transform:rotate(360deg)} }
        @keyframes blink         { 0%,100%{opacity:1}50%{opacity:.25} }
        @keyframes float         { 0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)} }
        @keyframes cursor-blink  { 0%,100%{opacity:1}50%{opacity:0} }
        @keyframes shimmer-sweep { 0%{transform:translateX(-100%)}100%{transform:translateX(100%)} }
        @keyframes error-shake   { 0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-4px)}40%,80%{transform:translateX(4px)} }
        @keyframes fade-slide-up { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }
        @keyframes scan-line     { 0%{top:-10%}100%{top:110%} }

        *{box-sizing:border-box}
        ::-webkit-scrollbar{display:none}
        input:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus{
          -webkit-box-shadow:0 0 0 1000px rgba(6,10,18,.98) inset !important;
          -webkit-text-fill-color:rgba(255,255,255,.85) !important;
          transition:background-color 5000s;
        }
        .nf input::placeholder{color:transparent !important}
        .gbtn::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.05),transparent);transform:translateX(-100%);}
        .gbtn:hover::after{animation:shimmer-sweep .7s ease forwards}
      `}</style>

      <div style={{minHeight:"100vh",background:"#050810",display:"flex",position:"relative",overflow:"hidden",fontFamily:"'Syne',system-ui,sans-serif"}}>

        <ParticleCanvas/>

        {/* GLOWS */}
        <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",background:"radial-gradient(ellipse 65% 55% at 18% 55%,rgba(16,185,129,.06) 0%,transparent 60%)"}}/>
        <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",background:"radial-gradient(ellipse 45% 35% at 82% 45%,rgba(96,165,250,.022) 0%,transparent 60%)"}}/>
        <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",backgroundImage:"linear-gradient(rgba(255,255,255,.016) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.016) 1px,transparent 1px)",backgroundSize:"56px 56px"}}/>

        <div style={{display:"flex",width:"100%",minHeight:"100vh",position:"relative",zIndex:1,flexDirection:isMobile?"column":"row"}}>

          {/* ══════════════════════════════════════════════════
              HERO DESKTOP — v5.0 copy estratégica
          ══════════════════════════════════════════════════ */}
          {!isMobile&&(
            <div style={{
              flex:"0 0 50%",
              height:"100vh",
              overflow:"hidden",
              display:"flex",
              flexDirection:"column",
              padding:"32px 52px",
              borderRight:"1px solid rgba(16,185,129,0.06)",
              position:"relative",
            }}>
              {/* Glows */}
              <div style={{position:"absolute",bottom:-60,left:-60,width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle,rgba(16,185,129,.08) 0%,transparent 70%)",filter:"blur(50px)",pointerEvents:"none"}}/>
              <div style={{position:"absolute",top:0,right:0,width:180,height:180,borderRadius:"50%",background:"radial-gradient(circle,rgba(96,165,250,.03) 0%,transparent 70%)",filter:"blur(30px)",pointerEvents:"none"}}/>

              {/* Logo */}
              <div style={{...fadeIn(0),display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
                <div style={{display:"flex",alignItems:"center",gap:11}}>
                  <div style={{width:36,height:36,borderRadius:11,background:"linear-gradient(135deg,rgba(16,185,129,.25),rgba(16,185,129,.06))",border:"1px solid rgba(16,185,129,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,animation:"float 3s ease-in-out infinite",boxShadow:"0 0 28px rgba(16,185,129,.14)"}}>⚡</div>
                  <span style={{fontSize:16,fontWeight:700,color:"rgba(255,255,255,.9)",letterSpacing:"-0.02em"}}>NexaSpark</span>
                </div>
                <ClockBadge/>
              </div>

              {/* Hero copy — v5.0 reescrita estratégica */}
              <div style={{...fadeIn(120),flex:1,display:"flex",flexDirection:"column",justifyContent:"center",paddingTop:12,paddingBottom:12}}>

                {/* Badge segurança */}
                <div style={{display:"inline-flex",alignItems:"center",gap:7,padding:"5px 13px",borderRadius:20,background:"rgba(16,185,129,.07)",border:"1px solid rgba(16,185,129,.2)",marginBottom:28,width:"fit-content"}}>
                  <div style={{width:5,height:5,borderRadius:"50%",background:"#10b981",animation:"blink 2s ease infinite"}}/>
                  <span style={{fontSize:9,color:"rgba(16,185,129,.8)",letterSpacing:"0.15em",textTransform:"uppercase",fontFamily:"monospace"}}>Plataforma segura · SSL 256-bit</span>
                </div>

                {/* Headline — v5.0: autoridade, não marketing */}
                <h1 style={{fontSize:"clamp(28px,3vw,44px)",fontWeight:800,lineHeight:1.12,letterSpacing:"-0.035em",color:"rgba(255,255,255,.93)",margin:"0 0 18px"}}>
                  Sua autoridade<br/>
                  <span style={{color:"#34d399"}}>começa aqui.</span>
                </h1>

                {/* Subheadline estratégico */}
                <p style={{fontSize:13,color:"rgba(255,255,255,.3)",lineHeight:1.85,margin:"0 0 36px",maxWidth:340}}>
                  Acesse a plataforma que profissionais confiam para emitir certificados com validade jurídica e rastreabilidade total.
                </p>

                {/* Trust indicators — v5.0: não técnicos, focados em benefício */}
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {[
                    { icon:"🔒", text:"Acesso com autenticação de dois fatores disponível" },
                    { icon:"⚡", text:"Certificados emitidos em menos de 3 segundos" },
                    { icon:"✦", text:"Verificação pública sem necessidade de login" },
                  ].map((item,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:28,height:28,borderRadius:8,background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>
                        {item.icon}
                      </div>
                      <span style={{fontSize:12,color:"rgba(255,255,255,.35)",lineHeight:1.5}}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Presence Engine — v5.0: sistema vivo, não dados técnicos */}
              <div style={{...fadeIn(250),flexShrink:0}}>
                <PresenceEngine/>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════
              FORM COLUMN
          ══════════════════════════════════════════════════ */}
          <div style={{
            flex:1,
            display:"flex",flexDirection:"column",alignItems:"center",
            justifyContent:isMobile?"flex-start":"center",
            padding:isMobile?"20px 18px 36px":"32px 32px",
            overflowY:isMobile?"auto":"visible",
            minWidth:0,
          }}>

            {/* Mobile: logo + clock */}
            {isMobile&&(
              <div style={{...fadeIn(0),width:"100%",maxWidth:420,marginBottom:22,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:9}}>
                  <div style={{width:32,height:32,borderRadius:10,background:"rgba(16,185,129,.14)",border:"1px solid rgba(16,185,129,.28)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,animation:"float 3s ease-in-out infinite"}}>⚡</div>
                  <span style={{fontSize:15,fontWeight:700,color:"rgba(255,255,255,.88)",letterSpacing:"-0.02em"}}>NexaSpark</span>
                </div>
                <ClockBadge/>
              </div>
            )}

            {/* Mobile: hero mini — v5.0 copy estratégica */}
            {isMobile&&(
              <div style={{...fadeIn(80),width:"100%",maxWidth:420,marginBottom:22}}>
                <div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 11px",borderRadius:20,background:"rgba(16,185,129,.07)",border:"1px solid rgba(16,185,129,.2)",marginBottom:12}}>
                  <div style={{width:4,height:4,borderRadius:"50%",background:"#10b981",animation:"blink 2s ease infinite"}}/>
                  <span style={{fontSize:8,color:"rgba(16,185,129,.8)",letterSpacing:"0.15em",textTransform:"uppercase",fontFamily:"monospace"}}>Plataforma segura</span>
                </div>
                <h1 style={{fontSize:26,fontWeight:800,lineHeight:1.15,letterSpacing:"-0.03em",color:"rgba(255,255,255,.93)",margin:"0 0 10px"}}>
                  Sua autoridade{" "}<span style={{color:"#34d399"}}>começa aqui.</span>
                </h1>
                <p style={{fontSize:12,color:"rgba(255,255,255,.28)",margin:0,lineHeight:1.7}}>
                  A plataforma que profissionais confiam para certificar com validade e rastreabilidade.
                </p>
              </div>
            )}

            {/* ── CARD ── */}
            <div style={{...fadeIn(isMobile?180:80),width:"100%",maxWidth:420}}>
              <div style={{
                borderRadius:22,
                border:"1px solid rgba(255,255,255,.08)",
                background:"rgba(8,12,22,.92)",
                backdropFilter:"blur(32px)",
                overflow:"hidden",
                boxShadow:"0 0 0 1px rgba(255,255,255,.03), 0 40px 80px rgba(0,0,0,.8), 0 0 100px rgba(16,185,129,.04)",
              }}>

                {/* Barra de acento verde no topo */}
                <div style={{height:2,background:"linear-gradient(90deg,rgba(16,185,129,0) 0%,rgba(16,185,129,.7) 40%,rgba(16,185,129,.7) 60%,rgba(16,185,129,0) 100%)"}}/>

                {/* Header */}
                <div style={{padding:isMobile?"24px 22px 20px":"28px 30px 22px"}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:18}}>
                    {/* Ícone escudo */}
                    <div style={{width:44,height:44,borderRadius:14,background:"linear-gradient(135deg,rgba(16,185,129,.18),rgba(16,185,129,.04))",border:"1px solid rgba(16,185,129,.22)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 24px rgba(16,185,129,.1)"}}>
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                    </div>
                    {/* Badge SSL */}
                    <div style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:20,background:"rgba(96,165,250,.05)",border:"1px solid rgba(96,165,250,.14)"}}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(96,165,250,.65)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      <span style={{fontSize:9,color:"rgba(96,165,250,.6)",fontFamily:"monospace",letterSpacing:"0.08em"}}>SSL 256-bit</span>
                    </div>
                  </div>

                  {/* v5.0: título direto ao ponto */}
                  <h2 style={{fontSize:21,fontWeight:700,color:"rgba(255,255,255,.9)",margin:"0 0 5px",letterSpacing:"-0.025em"}}>
                    Entrar na plataforma
                  </h2>
                  <p style={{fontSize:12,color:"rgba(255,255,255,.2)",margin:0,lineHeight:1.6}}>
                    Acesse sua conta para continuar.
                  </p>
                </div>

                {/* Separador */}
                <div style={{height:1,background:"linear-gradient(90deg,transparent,rgba(255,255,255,.055) 30%,rgba(255,255,255,.055) 70%,transparent)",margin:"0 20px"}}/>

                {/* Form body */}
                <div style={{padding:isMobile?"20px 22px 26px":"22px 30px 30px"}}>

                  {/* GOOGLE */}
                  <div style={{marginBottom:14}}>
                    <button type="button" onClick={handleGoogle} disabled={loading||loadGoogle} className="gbtn"
                      style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:10,padding:"12px 0",borderRadius:12,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.04)",color:"rgba(255,255,255,.72)",fontSize:13,fontWeight:500,cursor:loading||loadGoogle?"not-allowed":"pointer",opacity:loading||loadGoogle?.5:1,transition:"all .2s",fontFamily:"'Syne',system-ui,sans-serif",position:"relative",overflow:"hidden"}}
                      onMouseEnter={e=>{if(loading||loadGoogle)return;const b=e.currentTarget as HTMLButtonElement;b.style.borderColor="rgba(255,255,255,.2)";b.style.color="rgba(255,255,255,.9)";b.style.background="rgba(255,255,255,.07)";}}
                      onMouseLeave={e=>{const b=e.currentTarget as HTMLButtonElement;b.style.borderColor="rgba(255,255,255,.1)";b.style.color="rgba(255,255,255,.72)";b.style.background="rgba(255,255,255,.04)";}}
                    >
                      {loadGoogle?(
                        <><div style={{width:15,height:15,borderRadius:"50%",border:"1.5px solid rgba(255,255,255,.2)",borderTopColor:"rgba(255,255,255,.7)",animation:"spin .7s linear infinite"}}/><span style={{color:"rgba(255,255,255,.4)"}}>Redirecionando...</span></>
                      ):(
                        <><svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                        <span>Continuar com Google</span></>
                      )}
                    </button>
                  </div>

                  {/* Divider */}
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                    <div style={{flex:1,height:1,background:"rgba(255,255,255,.055)"}}/>
                    <span style={{fontSize:10,color:"rgba(255,255,255,.18)",fontFamily:"monospace",letterSpacing:"0.12em"}}>OU</span>
                    <div style={{flex:1,height:1,background:"rgba(255,255,255,.055)"}}/>
                  </div>

                  {/* FORM */}
                  <form onSubmit={handleSubmit} noValidate style={{display:"flex",flexDirection:"column",gap:10}}>

                    {/* EMAIL */}
                    <div className="nf">
                      <div style={{position:"relative"}}>
                        <label htmlFor="email" style={{position:"absolute",left:14,top:focused==="email"||email?7:15,fontSize:focused==="email"||email?9:13,letterSpacing:focused==="email"||email?"0.08em":"0",textTransform:focused==="email"||email?"uppercase":"none",color:focused==="email"?"#34d399":email?"rgba(255,255,255,.3)":"rgba(255,255,255,.22)",transition:"all .2s ease",pointerEvents:"none",fontFamily:"monospace",zIndex:1}}>
                          E-mail
                        </label>
                        <input ref={emailRef} id="email" type="email" value={email}
                          onChange={e=>{setEmail(e.target.value);setError("");}}
                          onFocus={()=>{setFocused("email");logger.event("FORM:FOCUS","email");}}
                          onBlur={()=>setFocused(null)}
                          autoComplete="email" disabled={loading||loadGoogle}
                          style={{width:"100%",background:"rgba(6,10,18,.95)",border:`1px solid ${focused==="email"?"rgba(16,185,129,.5)":"rgba(255,255,255,.07)"}`,borderRadius:12,padding:"22px 14px 8px",fontSize:13,color:"rgba(255,255,255,.88)",outline:"none",transition:"border-color .2s,box-shadow .2s",boxShadow:focused==="email"?"0 0 0 3px rgba(16,185,129,.09)":"none",fontFamily:"'Syne',system-ui,sans-serif",opacity:loading||loadGoogle?.5:1}}
                        />
                      </div>
                    </div>

                    {/* SENHA */}
                    <div className="nf">
                      <div style={{position:"relative"}}>
                        <label htmlFor="password" style={{position:"absolute",left:14,top:focused==="password"||password?7:15,fontSize:focused==="password"||password?9:13,letterSpacing:focused==="password"||password?"0.08em":"0",textTransform:focused==="password"||password?"uppercase":"none",color:focused==="password"?"#34d399":password?"rgba(255,255,255,.3)":"rgba(255,255,255,.22)",transition:"all .2s ease",pointerEvents:"none",fontFamily:"monospace",zIndex:1}}>
                          Senha
                        </label>
                        <input id="password" type={showPass?"text":"password"} value={password}
                          onChange={e=>{setPassword(e.target.value);setError("");}}
                          onFocus={()=>{setFocused("password");logger.event("FORM:FOCUS","password");}}
                          onBlur={()=>setFocused(null)}
                          autoComplete="current-password" disabled={loading||loadGoogle}
                          style={{width:"100%",background:"rgba(6,10,18,.95)",border:`1px solid ${focused==="password"?"rgba(16,185,129,.5)":"rgba(255,255,255,.07)"}`,borderRadius:12,padding:"22px 42px 8px 14px",fontSize:13,color:"rgba(255,255,255,.88)",outline:"none",transition:"border-color .2s,box-shadow .2s",boxShadow:focused==="password"?"0 0 0 3px rgba(16,185,129,.09)":"none",fontFamily:showPass?"monospace":"'Syne',system-ui,sans-serif",opacity:loading||loadGoogle?.5:1}}
                        />
                        <button type="button" tabIndex={-1}
                          onClick={()=>{setShowPass(v=>!v);logger.event("UX",`Senha ${showPass?"ocultada":"exibida"}`);}}
                          style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.2)",padding:4,transition:"color .2s"}}
                          onMouseEnter={e=>(e.currentTarget.style.color="rgba(255,255,255,.6)")}
                          onMouseLeave={e=>(e.currentTarget.style.color="rgba(255,255,255,.2)")}
                        >
                          {showPass?(
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          ):(
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          )}
                        </button>
                      </div>

                      {/* Password strength */}
                      {password.length>0&&(
                        <div style={{marginTop:6,display:"flex",alignItems:"center",gap:8}}>
                          <div style={{flex:1,height:2,background:"rgba(255,255,255,.05)",borderRadius:1,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${(pw.level/4)*100}%`,background:pw.color,borderRadius:1,transition:"width .35s ease,background .35s ease",boxShadow:`0 0 8px ${pw.color}66`}}/>
                          </div>
                          <span style={{fontSize:9,color:pw.color,fontFamily:"monospace",minWidth:34,transition:"color .3s"}}>{pw.label}</span>
                        </div>
                      )}
                    </div>

                    {/* ERRO */}
                    {error&&(
                      <div style={{display:"flex",alignItems:"flex-start",gap:9,padding:"11px 13px",borderRadius:10,background:"rgba(239,68,68,.04)",border:"1px solid rgba(239,68,68,.2)",animation:"error-shake .4s ease,fade-slide-up .3s ease"}}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:1}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <p style={{color:"rgba(248,113,113,.85)",fontSize:12,margin:0,lineHeight:1.6}}>{error}</p>
                      </div>
                    )}

                    {/* SUBMIT — v5.0: mais sólido, mais confiante */}
                    <button type="submit" disabled={loading||loadGoogle}
                      onClick={()=>!loading&&logger.event("AUTH","Submit clicado")}
                      style={{
                        width:"100%",
                        background:loading
                          ?"rgba(16,185,129,.05)"
                          :"linear-gradient(135deg,rgba(16,185,129,.22) 0%,rgba(16,185,129,.12) 100%)",
                        border:"1px solid rgba(16,185,129,.38)",
                        borderRadius:12,padding:"14px 0",
                        color:loading?"rgba(52,211,153,.4)":"#34d399",
                        fontSize:13,fontWeight:700,
                        cursor:loading||loadGoogle?"not-allowed":"pointer",
                        display:"flex",alignItems:"center",justifyContent:"center",gap:9,
                        transition:"all .25s",
                        opacity:loading||loadGoogle?.65:1,
                        fontFamily:"'Syne',system-ui,sans-serif",
                        letterSpacing:"0.04em",
                        boxShadow:loading?"none":"0 0 32px rgba(16,185,129,.14), inset 0 1px 0 rgba(16,185,129,.15)",
                        marginTop:4,
                      }}
                      onMouseEnter={e=>{
                        if(loading||loadGoogle)return;
                        const b=e.currentTarget as HTMLButtonElement;
                        b.style.boxShadow="0 0 48px rgba(16,185,129,.22), inset 0 1px 0 rgba(16,185,129,.2)";
                        b.style.borderColor="rgba(16,185,129,.55)";
                        b.style.background="linear-gradient(135deg,rgba(16,185,129,.28) 0%,rgba(16,185,129,.16) 100%)";
                        b.style.transform="translateY(-1px)";
                      }}
                      onMouseLeave={e=>{
                        if(loading||loadGoogle)return;
                        const b=e.currentTarget as HTMLButtonElement;
                        b.style.boxShadow="0 0 32px rgba(16,185,129,.14), inset 0 1px 0 rgba(16,185,129,.15)";
                        b.style.borderColor="rgba(16,185,129,.38)";
                        b.style.background="linear-gradient(135deg,rgba(16,185,129,.22) 0%,rgba(16,185,129,.12) 100%)";
                        b.style.transform="translateY(0)";
                      }}
                    >
                      {loading?(
                        <><div style={{width:14,height:14,borderRadius:"50%",border:"1.5px solid rgba(52,211,153,.2)",borderTopColor:"#34d399",animation:"spin .7s linear infinite"}}/><span>Verificando...</span></>
                      ):(
                        <><span style={{fontSize:13}}>→</span><span>Acessar minha conta</span></>
                      )}
                    </button>
                  </form>
                </div>
              </div>

              {/* Mobile: Presence Engine compacto */}
              {isMobile&&(
                <div style={{...fadeIn(280),marginTop:18}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <div style={{flex:1,height:1,background:"linear-gradient(90deg,transparent,rgba(16,185,129,.12))"}}/>
                    <span style={{fontSize:8,color:"rgba(16,185,129,.35)",fontFamily:"monospace",letterSpacing:"0.15em",textTransform:"uppercase"}}>Status do sistema</span>
                    <div style={{flex:1,height:1,background:"linear-gradient(270deg,transparent,rgba(16,185,129,.12))"}}/>
                  </div>
                  <PresenceEngineCompact/>
                </div>
              )}

              {/* Footer — v5.0: WhatsApp pill */}
              <div style={{...fadeIn(isMobile?360:400),marginTop:18,display:"flex",flexDirection:"column",alignItems:"center",gap:9}}>
                <a
                  href="https://wa.me/5519982714815?text=Preciso%20de%20ajuda%20para%20acessar%20a%20NexaSpark"
                  target="_blank" rel="noopener noreferrer"
                  onClick={()=>logger.event("AUTH","Suporte WhatsApp clicado")}
                  style={{display:"inline-flex",alignItems:"center",gap:7,padding:"7px 16px",borderRadius:20,border:"1px solid rgba(255,255,255,.06)",background:"rgba(255,255,255,.02)",color:"rgba(255,255,255,.25)",fontSize:11,textDecoration:"none",transition:"all .2s",fontFamily:"'Syne',system-ui,sans-serif"}}
                  onMouseEnter={e=>{const a=e.currentTarget as HTMLAnchorElement;a.style.borderColor="rgba(37,211,102,.22)";a.style.background="rgba(37,211,102,.05)";a.style.color="rgba(37,211,102,.75)";}}
                  onMouseLeave={e=>{const a=e.currentTarget as HTMLAnchorElement;a.style.borderColor="rgba(255,255,255,.06)";a.style.background="rgba(255,255,255,.02)";a.style.color="rgba(255,255,255,.25)";}}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <span>Problemas com acesso? Falar com suporte</span>
                </a>
                <p style={{fontSize:10,color:"rgba(255,255,255,.08)",margin:0,fontFamily:"monospace"}}>
                  © {new Date().getFullYear()} NexaSpark · Certificação Digital
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================
export default function LoginPage(){
  return(
    <Suspense fallback={<LoginLoading/>}>
      <LoginInner/>
    </Suspense>
  );
}